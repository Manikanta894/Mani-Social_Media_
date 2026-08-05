// ============================================================================
// SocialForge Event Engine — centralized event bus for every platform event.
// Storage: audit_log table (action=event_type, entity=source, metadata=payload)
// No new tables required. Provider-agnostic by design.
// ============================================================================

import { storage } from './storage'

const RETRY_SCHEDULE = [1, 5, 15, 30, 60] // minutes

const WEBHOOKS_KEY = 'event_webhooks'

export const EVENT_TYPES = {
  auth: ['account_connected', 'account_disconnected', 'token_expiring', 'token_refreshed'],
  publishing: ['post_published', 'post_scheduled', 'post_failed', 'post_deleted', 'post_updated'],
  analytics: ['new_analytics', 'followers_updated', 'reach_updated', 'engagement_updated', 'comments_updated', 'reactions_updated'],
  news: ['breaking_news', 'trending_topic', 'government_update', 'ai_news', 'industry_news'],
  seasonal: ['event_detected', 'campaign_generated', 'campaign_ready', 'campaign_scheduled'],
  approval: ['telegram_approved', 'telegram_rejected', 'dashboard_approved', 'dashboard_rejected'],
  blog: ['blog_published', 'blog_scheduled', 'seo_updated', 'indexing_completed'],
  automation: ['workflow_started', 'workflow_completed', 'workflow_failed'],
  ai: ['ai_generation_completed', 'ai_generation_failed', 'ai_suggestions_ready', 'ai_report_ready'],
  system: ['api_error', 'webhook_failed', 'database_error', 'storage_warning', 'rate_limit_warning'],
}

const PRIORITY = {
  breaking_news: 'high', post_failed: 'high', workflow_failed: 'high', api_error: 'high', webhook_failed: 'high',
  token_expiring: 'high', post_published: 'medium', blog_published: 'medium', campaign_generated: 'medium',
  campaign_ready: 'medium', ai_generation_failed: 'medium',
  followers_updated: 'low', reach_updated: 'low', engagement_updated: 'low', ai_report_ready: 'low',
}

export function normalizeEventType(raw) {
  const t = String(raw || '').toLowerCase().replace(/\s+/g, '_')
  for (const group of Object.values(EVENT_TYPES)) {
    if (group.includes(t)) return t
  }
  // map common audit actions → event types
  const map = { generate: 'ai_generation_completed', publish: 'post_published', published: 'post_published', approve: 'dashboard_approved', rejected: 'dashboard_rejected', blog_publish: 'blog_published', blog_generate: 'ai_generation_completed', news: 'breaking_news', skip: 'workflow_completed' }
  return map[t] || t
}

// Emit one event into the bus. Returns the stored event.
export async function emitEvent({ type, source = 'system', platform = null, payload = {}, priority = null, notify = false }) {
  const eventType = normalizeEventType(type)
  const event = {
    event_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    platform: platform || null,
    type: eventType,
    source,
    priority: priority || PRIORITY[eventType] || 'low',
    timestamp: new Date().toISOString(),
    payload,
    status: 'processed',
    retries: 0,
  }
  try {
    await storage.audit.log(
      eventType, source, event.event_id, null, event.status,
      { ...payload, event: true, platform: event.platform, priority: event.priority, timestamp: event.timestamp },
    )
  } catch (e) { console.warn('[events] emit failed:', e.message) }

  // Optional notification routing (Discord primary, Telegram legacy fallback)
  if (notify) {
    try {
      const { notifyEvent } = await import('./discord/notify')
      await notifyEvent({ type: eventType, source, payload, priority: event.priority })
    } catch (e) { console.warn('[events] discord notify failed:', e.message) }
  }
  return event
}

// ---------------------------------------------------------------------------
// Webhook management (provider registry stored in app_settings)
// ---------------------------------------------------------------------------

export async function listWebhooks() {
  const s = await storage.settings.get()
  return (s[WEBHOOKS_KEY] || []).map(h => ({ ...h, retry_schedule: RETRY_SCHEDULE }))
}

export async function saveWebhook(hook) {
  const s = await storage.settings.get()
  const list = s[WEBHOOKS_KEY] || []
  const idx = list.findIndex(h => h.id === hook.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...hook }
  else list.push({ id: hook.id || `${Date.now()}_${hook.provider}`, created_at: new Date().toISOString(), ...hook, enabled: true, deliveries: 0, failures: 0, success_rate: 100, last_delivery: null })
  await storage.settings.patch({ [WEBHOOKS_KEY]: list })
  return list
}

export async function removeWebhook(id) {
  const s = await storage.settings.get()
  const list = (s[WEBHOOKS_KEY] || []).filter(h => h.id !== id)
  await storage.settings.patch({ [WEBHOOKS_KEY]: list })
  return list
}

export async function recordWebhookDelivery(id, ok, ms, error = null) {
  const s = await storage.settings.get()
  const list = (s[WEBHOOKS_KEY] || []).map(h => {
    if (h.id !== id) return h
    const deliveries = (h.deliveries || 0) + 1
    const failures = (h.failures || 0) + (ok ? 0 : 1)
    return { ...h, deliveries, failures, success_rate: Math.round(((deliveries - failures) / deliveries) * 100), last_delivery: new Date().toISOString(), last_ms: ms, last_error: error }
  })
  await storage.settings.patch({ [WEBHOOKS_KEY]: list })
  return list
}

// ---------------------------------------------------------------------------
// Webhook entry: verify → normalize → emit
// ---------------------------------------------------------------------------

export async function handleWebhook(provider, body, headers, searchParams) {
  const s = await storage.settings.get()
  const hooks = (s[WEBHOOKS_KEY] || []).filter(h => h.provider === provider && h.enabled)
  if (hooks.length === 0) return { accepted: false, reason: 'no active webhook for provider' }

  const started = Date.now()
  const secret = headers.get('x-webhook-secret') || searchParams.get('secret')
  const hook = hooks.find(h => !h.secret || h.secret === secret) || hooks[0]
  if (hook.secret && secret !== hook.secret) {
    await recordWebhookDelivery(hook.id, false, Date.now() - started, 'invalid secret')
    return { accepted: false, reason: 'invalid secret' }
  }

  const payload = typeof body === 'string' ? safeParse(body) : (body || {})
  const eventType = payload.event_type || payload.type || (provider === 'telegram' ? 'message' : 'webhook_event')
  const event = await emitEvent({
    type: eventType,
    source: provider,
    platform: payload.platform || null,
    payload: payload.payload || payload,
    priority: payload.priority || null,
  })
  await recordWebhookDelivery(hook.id, true, Date.now() - started)
  return { accepted: true, event_id: event.event_id }
}

export async function retryWebhookEvent(id) {
  // Events are idempotent — re-emit with a retry marker
  const rows = await storage.audit.list(500)
  const data = rows.find(r => r.entity_id === id)
  if (!data) return { retried: false, reason: 'event not found' }
  await emitEvent({ type: data.action, source: data.entity_type, platform: data.metadata?.platform, payload: data.metadata, priority: data.metadata?.priority })
  return { retried: true }
}

export async function listEvents({ limit = 100, type = null, source = null, status = null } = {}) {
  const rows = await storage.audit.list(limit)
  const filtered = rows.filter(r => {
    if (type && r.action !== type) return false
    if (source && r.entity_type !== source) return false
    if (status && r.new_status !== status) return false
    return true
  })
  return filtered.map(r => ({
    event_id: r.entity_id,
    type: r.action,
    source: r.entity_type,
    platform: r.metadata?.platform || null,
    priority: r.metadata?.priority || PRIORITY[r.action] || 'low',
    timestamp: r.performed_at,
    payload: r.metadata || {},
    status: r.new_status,
    user: r.user_id || null,
  }))
}

export async function eventStats() {
  const data = await storage.audit.list(500).catch(() => [])
  const now = Date.now()
  const todayKey = new Date().toDateString()
  const byType = {}
  let today = 0, failed = 0, published = 0
  const lastHour = []
  for (const r of data || []) {
    const t = r.action || 'event'
    byType[t] = (byType[t] || 0) + 1
    const ts = new Date(r.performed_at).getTime()
    if (new Date(r.performed_at).toDateString() === todayKey) today++
    if (r.new_status === 'failed') failed++
    if (t.includes('publish') && r.new_status === 'published') published++
    if (now - ts < 3600 * 1000) lastHour.push({ type: t, source: r.entity_type, ts: r.performed_at })
  }
  return { total: (data || []).length, today, byType, failed, published, lastHour }
}

function safeParse(s) { try { return JSON.parse(s) } catch { return { raw: s } } }
