// ============================================================================
// Discord Command Center — Notification Router
// Routes events to Discord channels (primary) and optionally Telegram (legacy).
// ============================================================================

import { storage } from '../storage'
import { sendNewsOpportunity } from './news-radar'
import { sendDraftToApproval, sendPublishResult, sendLinkedInOpportunity } from './approval'
import { logToChannel, logError } from './dashboard'

// Send a news opportunity to Discord (and optionally Telegram)
export async function notifyNewsOpportunity(item, analysis) {
  const results = { discord: false, telegram: false }
  try {
    const r = await sendNewsOpportunity(item, analysis)
    results.discord = !!r.sent
  } catch (e) { console.warn('[discord] news notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendMessage: tgSend } = await import('../telegram/client')
      const { buildNewsCard } = await import('../news/ai-decision')
      const { text, kb } = await buildNewsCard(item, analysis)
      await tgSend({ chatId: s.telegram_admin_chat_id, text, replyMarkup: kb }).catch(() => {})
      results.telegram = true
    }
  } catch {}
  return results
}

// Send a draft to Discord approval center (and optionally Telegram)
export async function notifyDraft(job, fileId = null) {
  const results = { discord: false, telegram: false }
  try {
    const r = await sendDraftToApproval(job, fileId)
    results.discord = !!r.sent
  } catch (e) { console.warn('[discord] draft notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendDraftToAdmin } = await import('../telegram/handler')
      await sendDraftToAdmin(job).catch(() => {})
      results.telegram = true
    }
  } catch {}
  return results
}

// Send publish result to Discord (and optionally Telegram)
export async function notifyPublishResult({ job, results }) {
  const out = { discord: false, telegram: false }
  try {
    await sendPublishResult({ job, results })
    out.discord = true
  } catch (e) { console.warn('[discord] publish notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendMessage: tgSend } = await import('../telegram/client')
      const summary = results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok && x.url ? ` → ${x.url}` : ''}`).join('\n')
      await tgSend({ chatId: s.telegram_admin_chat_id, text: `🚀 <b>Publish result</b>\nJob: <code>${job.id.slice(0, 8)}</code>\n${summary}` }).catch(() => {})
      out.telegram = true
    }
  } catch {}
  return out
}

// Send LinkedIn opportunity to Discord (and optionally Telegram)
export async function notifyLinkedInOpportunity(item) {
  const out = { discord: false, telegram: false }
  try {
    const r = await sendLinkedInOpportunity(item)
    out.discord = !!r.sent
  } catch (e) { console.warn('[discord] linkedin notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendMessage: tgSend } = await import('../telegram/client')
      const { formatLinkedInIntelCard, buildLinkedInIntelKeyboard } = await import('../telegram/formatter')
      await tgSend({ chatId: s.telegram_admin_chat_id, text: formatLinkedInIntelCard(item), replyMarkup: buildLinkedInIntelKeyboard(item.id) }).catch(() => {})
      out.telegram = true
    }
  } catch {}
  return out
}

// Send a generic event notification to Discord
export async function notifyEvent({ type, source, payload = {}, priority = 'low' }) {
  const emoji = { breaking_news: '🔥', post_failed: '❌', workflow_failed: '⚠️', post_published: '✅', campaign_ready: '🎉', blog_published: '📝', ai_generation_failed: '❌' }[type] || '🔔'
  const color = priority === 'high' ? 0xE74C3C : priority === 'medium' ? 0xF1C40F : 0x3498DB

  try {
    await logToChannel('announcements', {
      title: `${emoji} ${type.replace(/_/g, ' ').toUpperCase()}`,
      description: `**Source:** ${source}${payload?.title ? `\n**Title:** ${String(payload.title).slice(0, 200)}` : ''}${payload?.error ? `\n**Error:** \`\`\`${String(payload.error).slice(0, 500)}\`\`\`` : ''}`,
      color,
    })
  } catch (e) { console.warn('[discord] event notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendMessage: tgSend } = await import('../telegram/client')
      await tgSend({ chatId: s.telegram_admin_chat_id, text: `${emoji} <b>${type.replace(/_/g, ' ')}</b> — ${source}${payload?.title ? ': ' + String(payload.title).slice(0, 120) : ''}` }).catch(() => {})
    }
  } catch {}
}

// Send a system error to Discord error-center
export async function notifyError({ module, error, retryCount = 0, fix = null }) {
  try {
    await logError({ module, error, retryCount, fix })
  } catch (e) { console.warn('[discord] error notify failed:', e.message) }

  // Legacy Telegram fallback
  try {
    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { sendMessage: tgSend } = await import('../telegram/client')
      await tgSend({ chatId: s.telegram_admin_chat_id, text: `❌ <b>${module}</b>\n${String(error).slice(0, 300)}` }).catch(() => {})
    }
  } catch {}
}

// Send a daily report to Discord
export async function notifyDailyReport(report) {
  try {
    await logToChannel('daily-reports', {
      title: '📊 Daily Performance Report',
      description: report?.text || 'Report generated',
      color: 0x9B59B6,
    })
  } catch (e) { console.warn('[discord] daily report failed:', e.message) }
}

// Send approval reminder to Discord
export async function notifyApprovalReminder({ fileId, fileName, scheduledTime, minsUntil, action }) {
  try {
    await logToChannel('approval-center', {
      title: '⏰ Approval Pending',
      description: `**File:** ${fileName}\n**Publishing at:** ${scheduledTime} (${minsUntil} min from now)\n\nApprove in Discord or it will ${action === 'auto_publish' ? 'be auto-published' : action === 'skip' ? 'be skipped' : 'move to the next slot'} at publish time.`,
      color: 0xF1C40F,
    })
  } catch (e) { console.warn('[discord] approval reminder failed:', e.message) }
}

// Send circuit breaker alert to Discord
export async function notifyCircuitBreaker({ failCount }) {
  try {
    await logToChannel('error-center', {
      title: '🔌 Circuit Breaker Tripped',
      description: `AI generation paused after **${failCount}** consecutive failures.\nCheck your provider keys in Settings.`,
      color: 0xE74C3C,
    })
  } catch (e) { console.warn('[discord] circuit breaker failed:', e.message) }
}