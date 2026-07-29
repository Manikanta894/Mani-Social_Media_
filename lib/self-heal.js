// Self-healing automation — health checks, circuit breaker, weekly digest.
// Integrated into runTick() to keep the system running without manual intervention.

import { storage } from './storage'
import { publishJob } from './publishers'
import { sendMessage } from './telegram/client'

const CIRCUIT_KEY = 'circuit_breaker'

// 1. Health check — if no posts published in 3h, auto-retry pending jobs + alert
export async function healthCheck() {
  const sb = (await import('./supabase')).supabase()
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  // Check last published job
  const { data: lastPublished } = await sb.from('content_jobs')
    .select('published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastPublished?.published_at && lastPublished.published_at > threeHoursAgo) {
    return { ok: true, note: 'recent activity within 3h' }
  }

  // No recent publication — retry pending scheduled jobs
  const { data: pending } = await sb.from('content_jobs')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())
    .limit(5)

  let retried = 0
  for (const job of pending || []) {
    try {
      await publishJob(job)
      retried++
    } catch (e) {
      await storage.audit.log('self_heal_retry_fail', 'content_job', job.id, 'scheduled', 'failed', { error: e.message })
    }
  }

  // Alert admin
  if (adminChatId) {
    const msg = retried > 0
      ? `⚠️ No posts published in 3h+ — retried ${retried} pending job(s)`
      : `⚠️ No posts published in 3h+ — no pending jobs to retry`
    await sendMessage({ chatId: adminChatId, text: `<b>Self-Heal Alert</b>\n${msg}` }).catch(() => {})
  }

  await storage.audit.log('self_heal_check', 'system', 'health', 'tick', 'alerted', { retried, gap_hours: 3 })
  return { ok: true, retried, alerted: true }
}

// 2. Circuit breaker — pause AI generation after 3 consecutive failures
export async function circuitBreaker() {
  const sb = (await import('./supabase')).supabase()

  // Read current circuit state
  const { data: cb } = await sb.from('app_settings').select('value').eq('key', CIRCUIT_KEY).maybeSingle()
  const state = (cb?.value) || { consecutive_failures: 0, paused: false, paused_at: null }

  // Check recent AI generation failures
  const { data: recent } = await sb.from('audit_log')
    .select('*')
    .eq('action', 'ai_generation_failed')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const failCount = recent?.length || 0

  if (failCount >= 3 && !state.paused) {
    state.consecutive_failures = failCount
    state.paused = true
    state.paused_at = new Date().toISOString()

    await sb.from('app_settings').upsert({ key: CIRCUIT_KEY, value: state }, { onConflict: 'key' })
    await storage.audit.log('circuit_breaker_trip', 'system', 'ai', 'active', 'paused', { failCount })

    // Alert admin
    const settings = await storage.settings.get().catch(() => ({}))
    if (settings.telegram_admin_chat_id) {
      await sendMessage({
        chatId: settings.telegram_admin_chat_id,
        text: `<b>🔌 Circuit Breaker Tripped</b>\nAI generation paused after ${failCount} consecutive failures.\nCheck your provider keys in Settings.`,
      }).catch(() => {})
    }
    return { paused: true, failCount }
  }

  // Auto-reset if failures have stopped
  if (state.paused && failCount === 0) {
    state.consecutive_failures = 0
    state.paused = false
    state.paused_at = null
    await sb.from('app_settings').upsert({ key: CIRCUIT_KEY, value: state }, { onConflict: 'key' })
    await storage.audit.log('circuit_breaker_reset', 'system', 'ai', 'paused', 'active', {})
    return { reset: true }
  }

  return { ok: true, failures: failCount, paused: state.paused }
}

// 3. Weekly digest — published count + engagement + failures
export async function weeklyDigest() {
  const sb = (await import('./supabase')).supabase()
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  if (!adminChatId) return { skipped: 'no telegram chat id' }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count published posts this week
  const { count: published } = await sb.from('content_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', weekAgo)

  // Count failures this week
  const { count: failures } = await sb.from('content_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('updated_at', weekAgo)

  // Total engagement (likes + comments + shares from post_stats)
  const { data: stats } = await sb.from('post_stats')
    .select('likes, comments, shares')
    .gte('created_at', weekAgo)

  const totalEngagement = (stats || []).reduce((sum, s) => sum + (s.likes || 0) + (s.comments || 0) + (s.shares || 0), 0)

  // Scheduled next week
  const { count: scheduled } = await sb.from('content_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'scheduled')

  await sendMessage({
    chatId: adminChatId,
    text: `<b>📊 Weekly Digest</b>\nPublished: ${published || 0}\nEngagement: ${totalEngagement}\nFailures: ${failures || 0}\nScheduled next: ${scheduled || 0}`,
  }).catch(() => {})

  await storage.audit.log('weekly_digest', 'system', 'report', 'sent', 'ok', { published, totalEngagement, failures })
  return { published, totalEngagement, failures }
}

// 4. Credential expiry check — alert a week before token expiry
export async function checkCredentialExpiry() {
  const sb = (await import('./supabase')).supabase()
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: creds } = await sb.from('platform_credentials')
    .select('*')
    .not('expires_at', 'is', null)
    .lte('expires_at', weekFromNow)

  if (!creds || creds.length === 0) return { ok: true, expiring: 0 }

  for (const c of creds) {
    await storage.audit.log('credential_expiry_warning', 'platform_credentials', c.platform, 'active', 'expiring_soon', {
      expires_at: c.expires_at,
    })
  }

  if (adminChatId) {
    const msg = `🔑 Token expiry alert\n${creds.map(c => `• ${c.platform}: expires ${new Date(c.expires_at).toLocaleDateString()}`).join('\n')}`
    await sendMessage({ chatId: adminChatId, text: `<b>Credential Expiry</b>\n${msg}` }).catch(() => {})
  }

  return { ok: true, expiring: creds.length, platforms: creds.map(c => c.platform) }
}

// Run all self-healing checks — called periodically
export async function runSelfHeal() {
  const results = {}
  try { results.health = await healthCheck() } catch (e) { results.health = { error: e.message } }
  try { results.circuit = await circuitBreaker() } catch (e) { results.circuit = { error: e.message } }
  try { results.creds = await checkCredentialExpiry() } catch (e) { results.creds = { error: e.message } }
  return results
}
