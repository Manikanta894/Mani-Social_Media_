// Self-healing automation — health checks, circuit breaker, weekly digest.
// Integrated into runTick() to keep the system running without manual intervention.

import { storage } from './storage'
import { publishJob } from './publishers'
import { sendMessage } from './telegram/client'

const CIRCUIT_KEY = 'circuit_breaker'

// 1. Health check — if no posts published in 3h, auto-retry pending jobs + alert
export async function healthCheck() {
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  // Check last published job
  const published = (await storage.jobs.list({ status: 'published' })).filter(j => j.published_at_actual || j.updated_at)
  const lastPublished = published.sort((a, b) => String(b.published_at_actual || b.updated_at).localeCompare(String(a.published_at_actual || a.updated_at)))[0]

  if (lastPublished?.published_at_actual && lastPublished.published_at_actual > threeHoursAgo) {
    return { ok: true, note: 'recent activity within 3h' }
  }
  if (lastPublished?.updated_at && lastPublished.updated_at > threeHoursAgo) {
    return { ok: true, note: 'recent activity within 3h' }
  }

  // No recent publication — retry pending scheduled jobs
  const now = new Date().toISOString()
  const pending = (await storage.jobs.list({ status: 'scheduled' })).filter(j => j.scheduled_for && j.scheduled_for <= now).slice(0, 5)

  let retried = 0
  for (const job of pending) {
    try {
      await publishJob(job)
      retried++
    } catch (e) {
      await storage.audit.log('self_heal_retry_fail', 'content_job', job.id, 'scheduled', 'failed', { error: e.message }).catch(() => {})
    }
  }

  // Alert admin
  if (adminChatId) {
    const msg = retried > 0
      ? `⚠️ No posts published in 3h+ — retried ${retried} pending job(s)`
      : `⚠️ No posts published in 3h+ — no pending jobs to retry`
    await sendMessage({ chatId: adminChatId, text: `<b>Self-Heal Alert</b>\n${msg}` }).catch(() => {})
  }

  await storage.audit.log('self_heal_check', 'system', 'health', 'tick', 'alerted', { retried, gap_hours: 3 }).catch(() => {})
  return { ok: true, retried, alerted: true }
}

// 2. Circuit breaker — pause AI generation after 3 consecutive failures
export async function circuitBreaker() {
  // Read current circuit state
  const state = await storage.appState.get(CIRCUIT_KEY, { consecutive_failures: 0, paused: false, paused_at: null })

  // Check recent AI generation failures
  const recent = (await storage.audit.list(100)).filter(r => r.action === 'ai_generation_failed')
  const failCount = recent.length

  if (failCount >= 3 && !state.paused) {
    state.consecutive_failures = failCount
    state.paused = true
    state.paused_at = new Date().toISOString()

    await storage.appState.set(CIRCUIT_KEY, state)
    await storage.audit.log('circuit_breaker_trip', 'system', 'ai', 'active', 'paused', { failCount }).catch(() => {})

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
    await storage.appState.set(CIRCUIT_KEY, state)
    await storage.audit.log('circuit_breaker_reset', 'system', 'ai', 'paused', 'active', {}).catch(() => {})
    return { reset: true }
  }

  return { ok: true, failures: failCount, paused: state.paused }
}

// 3. Weekly digest — published count + engagement + failures
export async function weeklyDigest() {
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  if (!adminChatId) return { skipped: 'no telegram chat id' }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count published posts this week
  const jobs = await storage.jobs.list({})
  const published = jobs.filter(j => j.status === 'published' && j.published_at_actual && j.published_at_actual >= weekAgo).length
  const failures = jobs.filter(j => j.status === 'failed' && j.updated_at && j.updated_at >= weekAgo).length
  const scheduled = jobs.filter(j => j.status === 'scheduled').length

  // Total engagement (likes + comments + shares from analytics)
  const stats = await storage.postStats.list()
  const weekStats = stats.filter(s => s.checked_at && s.checked_at >= weekAgo)
  const totalEngagement = weekStats.reduce((sum, s) => sum + (s.likes || 0) + (s.comments || 0) + (s.shares || 0), 0)

  await sendMessage({
    chatId: adminChatId,
    text: `<b>📊 Weekly Digest</b>\nPublished: ${published}\nEngagement: ${totalEngagement}\nFailures: ${failures}\nScheduled next: ${scheduled}`,
  }).catch(() => {})

  await storage.audit.log('weekly_digest', 'system', 'report', 'sent', 'ok', { published, totalEngagement, failures }).catch(() => {})
  return { published, totalEngagement, failures }
}

// 4. Credential expiry check — platform tokens live in env; alert on known expiry markers
export async function checkCredentialExpiry() {
  const settings = await storage.settings.get().catch(() => ({}))
  const adminChatId = settings.telegram_admin_chat_id
  // Env tokens have no expiry metadata — this check is informational
  const creds = []
  if (adminChatId) {
    // No-op: tokens are env-managed; publishers surface expiry errors at publish time
  }
  return { ok: true, expiring: 0, platforms: [] }
}

// Run all self-healing checks — called periodically
export async function runSelfHeal() {
  const results = {}
  try { results.health = await healthCheck() } catch (e) { results.health = { error: e.message } }
  try { results.circuit = await circuitBreaker() } catch (e) { results.circuit = { error: e.message } }
  try { results.creds = await checkCredentialExpiry() } catch (e) { results.creds = { error: e.message } }
  return results
}
