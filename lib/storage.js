// ============================================================================
// Storage layer — Google Sheets adapter.
// Same public interface as before, backed by one spreadsheet where every
// module = one sheet (lib/table.js). No Supabase anywhere.
// ============================================================================

import { randomUUID } from 'crypto'
import {
  tableList, tableGet, tableInsert, tableUpdate, tableRemove, tableCount,
  stateGet, stateSet, stateDelete, syncMirrorSheet,
} from './table'
import { deriveSecret } from './auth'

const DEFAULT_STYLES = [
  {
    id: 'style-playful',
    name: 'Playful',
    is_active: true,
    instructions:
      'Tone: witty, energetic, slightly irreverent. Use emojis freely (2–5 per post). Ask rhetorical questions. Short, punchy sentences. First-person casual. Break the fourth wall occasionally. Never corporate. The reader should smile or laugh.',
  },
  {
    id: 'style-professional',
    name: 'Professional',
    is_active: false,
    instructions:
      'Tone: polished, credible, insight-driven. Third-person or measured first-person. Lead with a hook or observation. Include one concrete takeaway. Sparse emoji use — only where it clarifies (0–1 per post). Suitable for a senior executive reading LinkedIn on Monday morning.',
  },
  {
    id: 'style-minimal',
    name: 'Minimal',
    is_active: false,
    instructions:
      'Tone: quiet confidence. Fewest possible words that carry the meaning. No filler, no exclamation points. Almost no emoji (0–1 per post max). Sentences under 12 words. Let the image do the talking. Think Muji, not Times Square.',
  },
  {
    id: 'style-salesy',
    name: 'Salesy',
    is_active: false,
    instructions:
      'Tone: direct, benefit-oriented, urgency-driven — without being spammy. Lead with a clear value proposition. Include a soft call-to-action (“check the link”, “DM me”, “book a call”). Use social proof or numbers when possible. Confidence without arrogance. 1–3 emojis if they add punch.',
  },
]

function throwIf(e) { if (e) throw new Error(e.message || String(e)) }
function simpleHash(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return 'h' + Math.abs(h).toString(36)
}
function withTs(row) {
  const now = new Date().toISOString()
  return { created_at: now, updated_at: now, ...row }
}
function sortedDesc(rows, col = 'created_at') {
  return [...(rows || [])].sort((a, b) => String(b[col] || '').localeCompare(String(a[col] || '')))
}

// Provider API keys are NEVER written to Sheets — resolved from env by type.
const ENV_KEY_BY_TYPE = {
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  'nvidia-llama': 'NVIDIA_API_KEY',
  'nvidia-nemotron': 'NVIDIA_API_KEY',
  'nvidia-kimi': 'NVIDIA_API_KEY',
  custom: 'CUSTOM_API_KEY',
}
function resolveKey(provider) {
  if (!provider) return ''
  const envName = ENV_KEY_BY_TYPE[provider.type]
  return (envName && process.env[envName]) || ''
}

export const storage = {
  // ---------- AI Providers ----------
  providers: {
    async list() {
      const rows = await tableList('providers')
      return rows.map(p => ({ ...p, api_key: resolveKey(p) }))
    },
    async get(id) {
      const p = await tableGet('providers', id)
      return p ? { ...p, api_key: resolveKey(p) } : null
    },
    async create(item) {
      const all = await tableList('providers')
      const row = {
        name: item.name || 'Untitled',
        type: item.type || 'gemini',
        model: item.model || '',
        base_url: item.base_url || '',
        active_for_vision: !!item.active_for_vision,
        active_for_text: !!item.active_for_text,
      }
      if (all.length === 0) { row.active_for_vision = true; row.active_for_text = true }
      if (row.active_for_vision) for (const p of all) await tableUpdate('providers', p.id, { active_for_vision: false })
      if (row.active_for_text) for (const p of all) await tableUpdate('providers', p.id, { active_for_text: false })
      const created = await tableInsert('providers', withTs(row))
      return { ...created, api_key: resolveKey(created) }
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      delete clean.api_key // never persisted
      if (clean.active_for_vision) { const all = await tableList('providers'); for (const p of all) if (p.id !== id) await tableUpdate('providers', p.id, { active_for_vision: false }) }
      if (clean.active_for_text) { const all = await tableList('providers'); for (const p of all) if (p.id !== id) await tableUpdate('providers', p.id, { active_for_text: false }) }
      const updated = await tableUpdate('providers', id, clean)
      return { ...updated, api_key: resolveKey(updated) }
    },
    async remove(id) { await tableRemove('providers', id) },
    async setActive(role, providerId) {
      const col = role === 'vision' ? 'active_for_vision' : 'active_for_text'
      const all = await tableList('providers')
      for (const p of all) await tableUpdate('providers', p.id, { [col]: p.id === providerId })
    },
    async getActive(role) {
      const col = role === 'vision' ? 'active_for_vision' : 'active_for_text'
      const rows = await tableList('providers')
      const p = rows.find(r => r[col] === true)
      return p ? { ...p, api_key: resolveKey(p) } : null
    },
    usage: {
      async list(providerId) {
        const rows = await tableList('analytics', r => r.kind === 'usage' && (!providerId || r.provider_id === providerId))
        return sortedDesc(rows, 'month')
      },
      async record(providerId, { calls = 1, tokens = 0 }) {
        const month = new Date().toISOString().slice(0, 7)
        const rows = await tableList('analytics', r => r.kind === 'usage' && r.provider_id === providerId && r.month === month)
        if (rows.length) {
          return tableUpdate('analytics', rows[0].id, {
            call_count: (rows[0].call_count || 0) + calls,
            token_count: (rows[0].token_count || 0) + tokens,
            updated_at: new Date().toISOString(),
          })
        }
        return tableInsert('analytics', { kind: 'usage', provider_id: providerId, month, call_count: calls, token_count: tokens })
      },
    },
  },

  // ---------- Prompt styles ----------
  promptStyles: {
    async list() {
      let rows = await tableList('promptStyles')
      if (!rows.length) {
        for (const s of DEFAULT_STYLES) await tableInsert('promptStyles', withTs(s)).catch(() => {})
        rows = await tableList('promptStyles')
      }
      return sortedDesc(rows)
    },
    async get(id) { return await tableGet('promptStyles', id) },
    async create(item) {
      const row = { id: 'style-' + randomUUID().slice(0, 8), name: item.name || 'Untitled Style', instructions: item.instructions || '', is_active: !!item.is_active }
      if (row.is_active) { const all = await tableList('promptStyles'); for (const p of all) await tableUpdate('promptStyles', p.id, { is_active: false }) }
      return await tableInsert('promptStyles', withTs(row))
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      if (clean.is_active) { const all = await tableList('promptStyles'); for (const p of all) if (p.id !== id) await tableUpdate('promptStyles', p.id, { is_active: false }) }
      return await tableUpdate('promptStyles', id, clean)
    },
    async remove(id) { await tableRemove('promptStyles', id) },
    async setActive(id) {
      const all = await tableList('promptStyles')
      for (const p of all) await tableUpdate('promptStyles', p.id, { is_active: p.id === id })
    },
    async getActive() {
      const rows = await tableList('promptStyles')
      return rows.find(r => r.is_active === true) || null
    },
  },

  // ---------- Content jobs ----------
  jobs: {
    async list(opts = {}) {
      let rows = await tableList('jobs', r => {
        if (opts.campaign_id && r.campaign_id !== opts.campaign_id) return false
        if (opts.source && r.source !== opts.source) return false
        if (opts.status && r.status !== opts.status) return false
        return true
      })
      return sortedDesc(rows).slice(0, 200)
    },
    async get(id) { return await tableGet('jobs', id) },
    async create(item) {
      const row = {
        source: item.source || 'ai_manual',
        topic: item.topic || '',
        research_context: item.research_context || '',
        image_ref: item.image_ref || null,
        style_id: item.style_id || null,
        style_name: item.style_name || null,
        platform_posts: item.platform_posts || {},
        warnings: item.warnings || [],
        status: item.status || 'draft',
        campaign_id: item.campaign_id || null,
        scheduled_for: item.scheduled_for || null,
        pillar: item.pillar || 'general',
        cross_link_url: item.cross_link_url || null,
      }
      return await tableInsert('jobs', withTs(row))
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const updated = await tableUpdate('jobs', id, { ...clean, updated_at: new Date().toISOString() })
      if (!updated) throw new Error(`Job ${id} not found`)
      return updated
    },
  },

  // ---------- Content versions (AI generation history) ----------
  contentVersions: {
    async list(jobId) {
      const rows = await tableList('contentVersions', r => r.job_id === jobId)
      return sortedDesc(rows, 'version')
    },
    async create(version) {
      return await tableInsert('contentVersions', {
        job_id: version.job_id,
        version: version.version,
        platform: version.platform,
        caption: version.caption || '',
        description: version.description || '',
        hashtags: version.hashtags || [],
        alt_text: version.alt_text || '',
        seo_keywords: version.seo_keywords || '',
        cta: version.cta || '',
        ai_confidence: version.ai_confidence || null,
        providers_used: version.providers_used || null,
      })
    },
  },

  // ---------- Audit log ----------
  audit: {
    async log(action, entityType, entityId, previousStatus, newStatus, metadata) {
      const row = {
        action,
        entity_type: entityType,
        entity_id: entityId,
        previous_status: previousStatus ?? null,
        new_status: newStatus !== undefined && newStatus !== null ? newStatus : (previousStatus !== undefined ? null : null),
      }
      if (metadata !== undefined && arguments.length >= 6) row.metadata = metadata
      await tableInsert('audit', row).catch(() => {})
    },
    async list(limit = 100) {
      const rows = sortedDesc(await tableList('audit'))
      return rows.slice(0, limit)
    },
    async listByEntity(entityType, entityId) {
      const rows = await tableList('audit', r => r.entity_type === entityType && r.entity_id === entityId)
      return sortedDesc(rows)
    },
  },

  // ---------- Comments queue ----------
  comments: {
    async list() { return sortedDesc(await tableList('comments')).slice(0, 200) },
    async get(id) { return await tableGet('comments', id) },
    async getByPlatform(platform) { return sortedDesc(await tableList('comments', r => r.platform === platform)) },
    async create(item) {
      return await tableInsert('comments', {
        platform: item.platform,
        platform_comment_id: item.platform_comment_id,
        author: item.author,
        comment_text: item.comment_text,
        draft_reply: item.draft_reply || null,
        status: item.status || 'pending',
        post_job_id: item.post_job_id || null,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const updated = await tableUpdate('comments', id, clean)
      if (!updated) throw new Error(`Comment ${id} not found`)
      return updated
    },
  },

  // ---------- Post stats (analytics) ----------
  postStats: {
    async list() {
      return sortedDesc(await tableList('analytics', r => r.kind === 'post_stats'), 'checked_at')
    },
    async getByJob(jobId) {
      return sortedDesc(await tableList('analytics', r => r.kind === 'post_stats' && r.job_id === jobId), 'checked_at')
    },
    async upsert(row) {
      return await tableInsert('analytics', {
        kind: 'post_stats',
        job_id: row.job_id,
        platform: row.platform,
        impressions: row.impressions || 0,
        reach: row.reach || 0,
        likes: row.likes || 0,
        comments: row.comments || 0,
        shares: row.shares || 0,
        saves: row.saves || 0,
        checked_at: row.checked_at || new Date().toISOString(),
      })
    },
    async deleteBefore(date) {
      const rows = await tableList('analytics', r => r.kind === 'post_stats' && r.checked_at && r.checked_at < date)
      for (const r of rows) await tableRemove('analytics', r.id)
    },
  },

  // ---------- Post details (per-post analytics) ----------
  postDetails: {
    async list() {
      return sortedDesc(await tableList('analytics', r => r.kind === 'post_details'), 'checked_at')
    },
    async getByJob(jobId) {
      return sortedDesc(await tableList('analytics', r => r.kind === 'post_details' && r.job_id === jobId), 'checked_at')
    },
    async upsert(row) {
      const rows = await tableList('analytics', r => r.kind === 'post_details' && r.job_id === row.job_id && r.platform === row.platform)
      const data = {
        kind: 'post_details', job_id: row.job_id, platform: row.platform,
        impressions: row.impressions || 0, reach: row.reach || 0,
        likes: row.likes || 0, comments: row.comments || 0, shares: row.shares || 0, saves: row.saves || 0,
        clicks: row.clicks || 0, profile_visits: row.profile_visits || 0, caption: row.caption || '',
        checked_at: row.checked_at || new Date().toISOString(),
      }
      if (rows.length) return await tableUpdate('analytics', rows[rows.length - 1].id, data)
      return await tableInsert('analytics', data)
    },
  },

  // ---------- Content Library (unified historical archive) ----------
  contentLibrary: {
    async list({ platform = null, limit = 500 } = {}) {
      const rows = await tableList('contentLibrary', r => !platform || r.platform === platform)
      return sortedDesc(rows, 'published_at').slice(0, limit)
    },
    async getByJob(jobId) {
      return await tableList('contentLibrary', r => r.job_id === jobId)
    },
    async upsert(row) {
      const existing = (await tableList('contentLibrary', r => r.platform === row.platform && r.platform_post_id === row.postId))[0]
      const data = {
        platform: row.platform, platform_post_id: row.postId, url: row.url, caption: row.caption,
        thumbnail_url: row.thumbnail, media_type: row.mediaType, source: row.source, job_id: row.jobId,
        published_at: row.publishedAt, likes: row.likes, comments: row.comments, shares: row.shares, saves: row.saves,
        impressions: row.impressions, reach: row.reach, clicks: row.clicks, profile_visits: row.profile_visits,
        engagement_rate: row.engagement_rate, updated_at: new Date().toISOString(),
      }
      if (existing) { await tableUpdate('contentLibrary', existing.id, data); return { imported: false, data } }
      return { imported: true, data: await tableInsert('contentLibrary', data) }
    },
    async remove(id) { await tableRemove('contentLibrary', id); return true },
  },

  // ---------- Hashtag stats ----------
  hashtagStats: {
    async list() {
      const rows = await tableList('analytics', r => r.kind === 'hashtag_stats')
      return rows.sort((a, b) => (b.count || 0) - (a.count || 0))
    },
    async upsert(row) {
      const existing = (await tableList('analytics', r => r.kind === 'hashtag_stats' && r.tag === row.tag))[0]
      if (existing) {
        return await tableUpdate('analytics', existing.id, {
          count: row.count, total_impressions: row.total_impressions, total_engagement: row.total_engagement,
          platforms: row.platforms, updated_at: new Date().toISOString(),
        })
      }
      return await tableInsert('analytics', {
        kind: 'hashtag_stats', tag: row.tag, count: row.count || 1,
        total_impressions: row.total_impressions || 0, total_engagement: row.total_engagement || 0, platforms: row.platforms || [],
      })
    },
  },

  // ---------- News sources ----------
  newsSources: {
    async list() { return sortedDesc(await tableList('newsSources')) },
    async listActive() { return await tableList('newsSources', r => r.is_active !== false) },
    async get(id) { return await tableGet('newsSources', id) },
    async create(row) {
      return await tableInsert('newsSources', {
        name: row.name, url: row.url, type: row.type || 'rss', category: row.category || 'general',
        check_interval: row.check_interval || 15, is_active: row.is_active !== false,
      })
    },
    async update(id, patch) { return await tableUpdate('newsSources', id, patch) },
    async remove(id) { await tableRemove('newsSources', id) },
    async touch(id) { await tableUpdate('newsSources', id, { last_checked_at: new Date().toISOString() }) },
  },

  // ---------- News posts ----------
  newsPosts: {
    async list(status) {
      const rows = await tableList('newsPosts', r => !status || r.status === status)
      return sortedDesc(rows)
    },
    async get(id) { return await tableGet('newsPosts', id) },
    async findByUrl(url) {
      const rows = await tableList('newsPosts', r => r.url === url)
      return rows[0] || null
    },
    async create(row) {
      return await tableInsert('newsPosts', {
        source_id: row.source_id, source_name: row.source_name, title: row.title, url: row.url,
        summary: row.summary, content: row.content, image_url: row.image_url, author: row.author,
        published_at: row.published_at, category: row.category || 'general', is_trending: row.is_trending || false,
        status: row.status || 'new',
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      return await tableUpdate('newsPosts', id, { ...clean, updated_at: new Date().toISOString() })
    },
    async remove(id) { await tableRemove('newsPosts', id) },
  },

  // ---------- Campaigns ----------
  campaigns: {
    async list() { return sortedDesc(await tableList('campaigns')) },
    async get(id) { return await tableGet('campaigns', id) },
    async create(row) {
      return await tableInsert('campaigns', {
        name: row.name, description: row.description || '', platforms: row.platforms || [],
        schedule_settings: row.schedule_settings || {}, post_count: row.post_count || 0,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      return await tableUpdate('campaigns', id, { ...clean, updated_at: new Date().toISOString() })
    },
    async remove(id) { await tableRemove('campaigns', id) },
  },

  // ---------- Blog posts ----------
  blogPosts: {
    async list(status) {
      const rows = await tableList('blogPosts', r => !status || r.status === status)
      return sortedDesc(rows)
    },
    async get(id) { return await tableGet('blogPosts', id) },
    async create(row) {
      return await tableInsert('blogPosts', {
        job_id: row.job_id || null, title: row.title || '', slug: row.slug || null,
        body_markdown: row.body_markdown || '', cover_image_url: row.cover_image_url || null,
        image_base64: row.image_base64 || null, image_mime: row.image_mime || null,
        seo_description: row.seo_description || '', status: row.status || 'draft',
        target: row.target || 'hashnode', section: row.section || null,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      return await tableUpdate('blogPosts', id, { ...clean, updated_at: new Date().toISOString() })
    },
    async remove(id) { await tableRemove('blogPosts', id) },
  },

  // ---------- Blog queue (intake pipeline) ----------
  blogQueue: {
    async list(status) {
      const rows = await tableList('blogQueue', r => !status || r.status === status)
      return sortedDesc(rows)
    },
    async get(id) { return await tableGet('blogQueue', id) },
    async getByFileId(fileId) {
      return (await tableList('blogQueue', r => r.file_id === fileId))[0] || null
    },
    async create(row) {
      return await tableInsert('blogQueue', {
        file_id: row.file_id, status: row.status || 'pending', article_data: row.article_data || {},
        title: row.title || '', section: row.section || null, error: row.error || null,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      return await tableUpdate('blogQueue', id, { ...clean, updated_at: new Date().toISOString() })
    },
    async remove(id) { await tableRemove('blogQueue', id) },
    async count(status) { return await tableCount('blogQueue', r => !status || r.status === status) },
  },

  // ---------- Blog topics ----------
  blogTopics: {
    async list() { return sortedDesc(await tableList('blogTopics')) },
    async get(id) { return await tableGet('blogTopics', id) },
    async create(row) { return await tableInsert('blogTopics', withTs({ topic: row.topic, status: row.status || 'pending', priority: row.priority || 'medium', note: row.note || '' })) },
    async update(id, patch) { return await tableUpdate('blogTopics', id, patch) },
    async remove(id) { await tableRemove('blogTopics', id) },
  },

  // ---------- Rate-limit tracking (per platform) ----------
  rateLimits: {
    async get(platform) { return (await tableList('rateLimits', r => r.platform === platform))[0] || null },
    async list() { return await tableList('rateLimits') },
    async record(platform, retryAfterSeconds = 60) {
      const existing = (await tableList('rateLimits', r => r.platform === platform))[0]
      const data = {
        platform,
        last_429_at: new Date().toISOString(),
        retry_after_seconds: retryAfterSeconds,
        cooldown_until: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
      }
      if (existing) return await tableUpdate('rateLimits', existing.id, data)
      return await tableInsert('rateLimits', data)
    },
    async clear(platform) {
      const rows = await tableList('rateLimits', r => r.platform === platform)
      for (const r of rows) await tableRemove('rateLimits', r.id)
    },
  },

  // ---------- Dedup log ----------
  dedupLog: {
    async findByTopic(topic) {
      const hash = simpleHash(topic)
      return (await tableList('dedupLog', r => r.content_hash === hash))[0] || null
    },
    async log(topic) {
      const hash = simpleHash(topic)
      const existing = (await tableList('dedupLog', r => r.content_hash === hash))[0]
      if (existing) return { already_exists: true }
      return await tableInsert('dedupLog', { content_hash: hash, topic })
    },
  },

  // ---------- App settings (single row 'main') ----------
  settings: {
    async _read() {
      const stored = await stateGet('main', {})
      return stored || {}
    },
    async _write(value) {
      await stateSet('main', value)
    },
    async get() {
      const stored = await this._read()
      let settings = { ...stored }
      if (settings.kill_switch === undefined) settings.kill_switch = false
      // Secrets come from env only — never stored in Sheets
      settings.telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN || settings.telegram_bot_token || ''
      settings.telegram_admin_chat_id = process.env.TELEGRAM_ADMIN_CHAT_ID || settings.telegram_admin_chat_id || ''
      settings.telegram_webhook_secret = deriveSecret('telegram-webhook')
      settings.discord_bot_token = process.env.DISCORD_BOT_TOKEN || settings.discord_bot_token || ''
      settings.discord_public_key = process.env.DISCORD_PUBLIC_KEY || settings.discord_public_key || ''
      settings.discord_guild_id = process.env.DISCORD_GUILD_ID || settings.discord_guild_id || ''
      settings.discord_channel_ids = settings.discord_channel_ids || {}
      return settings
    },
    async patch(patch) {
      const cur = await this._read()
      const safe = { ...patch }
      delete safe.telegram_bot_token
      delete safe.telegram_admin_chat_id
      delete safe.telegram_webhook_secret
      const merged = { ...cur, ...safe }
      await this._write(merged)
      return await this.get()
    },
  },

  // ---------- App state (key/value JSON blobs in User Settings sheet) ----------
  appState: {
    async get(key, fallback = null) { return await stateGet(key, fallback) },
    async set(key, value) { await stateSet(key, value) },
    async patch(key, patch) {
      const cur = await stateGet(key, {}) || {}
      await stateSet(key, { ...cur, ...patch })
      return { ...cur, ...patch }
    },
    async delete(key) { await stateDelete(key) },
  },

  // ---------- Hashtag sets ----------
  hashtagSets: {
    async list() { return sortedDesc(await tableList('hashtagSets')) },
    async get(id) { return await tableGet('hashtagSets', id) },
    async create(row) { return await tableInsert('hashtagSets', { name: row.name, tags: row.tags || [], platform: row.platform || null }) },
    async update(id, patch) { return await tableUpdate('hashtagSets', id, patch) },
    async remove(id) { await tableRemove('hashtagSets', id) },
  },

  // ---------- Channel groups ----------
  channelGroups: {
    async list() { return sortedDesc(await tableList('channelGroups')) },
    async get(id) { return await tableGet('channelGroups', id) },
    async create(row) { return await tableInsert('channelGroups', { name: row.name, platform_credential_ids: row.platform_credential_ids || [] }) },
    async update(id, patch) { return await tableUpdate('channelGroups', id, patch) },
    async remove(id) { await tableRemove('channelGroups', id) },
  },

  // ---------- Best-time cache ----------
  bestTimes: {
    async getByPlatform(platform) {
      const rows = await tableList('analytics', r => r.kind === 'best_time' && r.platform === platform)
      return rows.sort((a, b) => (b.avg_engagement || 0) - (a.avg_engagement || 0)).slice(0, 3)
    },
    async compute() {
      const details = await tableList('analytics', r => r.kind === 'post_details' && r.checked_at && r.checked_at >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      if (!details || details.length < 5) return { computed: 0, reason: 'insufficient_data' }
      const buckets = {}
      for (const d of details) {
        const dt = new Date(d.checked_at)
        const key = `${d.platform}|${dt.getUTCDay()}|${dt.getUTCHours()}`
        if (!buckets[key]) buckets[key] = { platform: d.platform, day_of_week: dt.getUTCDay(), hour_of_day: dt.getUTCHours(), totalEng: 0, totalImp: 0, count: 0 }
        buckets[key].totalEng += (d.likes || 0) + (d.comments || 0) + (d.shares || 0)
        buckets[key].totalImp += (d.impressions || 1)
        buckets[key].count++
      }
      let inserted = 0
      for (const b of Object.values(buckets)) {
        const avgEng = b.totalEng / Math.max(b.count, 1)
        const imp = b.totalImp / Math.max(b.count, 1)
        const rate = imp > 0 ? avgEng / imp : 0
        await tableInsert('analytics', { kind: 'best_time', platform: b.platform, hour_of_day: b.hour_of_day, day_of_week: b.day_of_week, avg_engagement: rate, post_count: b.count }).catch(() => {})
        inserted++
      }
      return { computed: inserted }
    },
  },

  // ---------- Seasonal Intelligence Queue ----------
  seasonal: {
    async list(status) {
      const rows = await tableList('seasonal', r => !status || r.status === status)
      return sortedDesc(rows)
    },
    async get(id) { return await tableGet('seasonal', id) },
    async create(data) {
      return await tableInsert('seasonal', {
        event_name: data.event_name,
        event_month: data.event_month,
        event_day: data.event_day,
        event_type: data.event_type || 'observance',
        event_country: data.event_country || null,
        event_industry: data.event_industry || 'general',
        emoji: data.emoji || '📅',
        platform_posts: data.platform_posts || {},
        analysis: data.analysis || null,
        scheduled_for: data.scheduled_for || null,
        status: data.status || 'draft',
        source: data.source || 'auto',
        versions: data.versions || [],
        ai_confidence: data.ai_confidence || null,
        draft_reply: data.draft_reply || null,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const updated = await tableUpdate('seasonal', id, { ...clean, updated_at: new Date().toISOString() })
      if (!updated) throw new Error(`Seasonal queue item ${id} not found`)
      return updated
    },
    async remove(id) { await tableRemove('seasonal', id) },
  },

  // ---------- Expanded engagement inbox ----------
  engagement: {
    async list(opts = {}) {
      const rows = await tableList('comments', r => {
        if (opts.status && r.status !== opts.status) return false
        if (opts.platform && r.platform !== opts.platform) return false
        if (opts.type && r.type !== opts.type) return false
        return true
      })
      return sortedDesc(rows).slice(0, 100)
    },
    async get(id) { return await tableGet('comments', id) },
    async update(id, patch) { return await tableUpdate('comments', id, patch) },
    async create(row) {
      return await tableInsert('comments', {
        platform: row.platform, platform_comment_id: row.platform_comment_id || null,
        author: row.author || '', comment_text: row.comment_text || '',
        draft_reply: row.draft_reply || '', status: row.status || 'pending',
        post_job_id: row.post_job_id || null, type: row.type || 'comment',
        dm_content: row.dm_content || null, reaction_summary: row.reaction_summary || null,
      })
    },
    async fetchAll() {
      const { fetchAllComments } = await import('@/lib/comments/fetchers')
      return await fetchAllComments()
    },
  },

  // Compose templates
  composeTemplates: {
    async list() { return sortedDesc(await tableList('composeTemplates')) },
    async get(id) { return await tableGet('composeTemplates', id) },
    async create(row) { return await tableInsert('composeTemplates', { name: row.name, context: row.context || '', style_id: row.style_id || null, tone_adjustment: row.tone_adjustment || 0 }) },
    async update(id, patch) { return await tableUpdate('composeTemplates', id, patch) },
    async remove(id) { await tableRemove('composeTemplates', id) },
  },

  // Follower snapshots
  followerSnapshots: {
    async list(limit = 90) {
      const rows = await tableList('analytics', r => r.kind === 'follower')
      return rows.sort((a, b) => String(a.captured_at).localeCompare(String(b.captured_at))).slice(0, limit)
    },
    async create(row) { return await tableInsert('analytics', { kind: 'follower', platform: row.platform, count: row.count, captured_at: new Date().toISOString() }) },
    async getLatest() {
      const rows = await tableList('analytics', r => r.kind === 'follower')
      return rows.sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at))).slice(0, 20)
    },
  },

  // Pending hashtag suggestions
  pendingHashtagSuggestions: {
    async list() { return sortedDesc(await tableList('pendingHashtagSuggestions')) },
    async create(row) { return await tableInsert('pendingHashtagSuggestions', { tag: row.tag, source: row.source || 'trending', set_id: row.set_id || null }) },
    async update(id, patch) { return await tableUpdate('pendingHashtagSuggestions', id, patch) },
    async remove(id) { await tableRemove('pendingHashtagSuggestions', id) },
  },

  // Bio links
  bioLinks: {
    async list() {
      const rows = await tableList('bioLinks')
      return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    },
    async create(row) { return await tableInsert('bioLinks', { title: row.title, url: row.url, icon: row.icon || 'link', sort_order: row.sort_order || 0, visible: row.visible !== false }) },
    async update(id, patch) { return await tableUpdate('bioLinks', id, patch) },
    async remove(id) { await tableRemove('bioLinks', id) },
  },

  topicQueue: {
    async list() { return sortedDesc(await tableList('topicQueue')) },
    async create(row) { return await tableInsert('topicQueue', withTs({ topic: row.topic, status: row.status || 'pending' })) },
    async bulkCreate(topics) {
      const rows = []
      for (const t of topics) rows.push(await tableInsert('topicQueue', withTs({ topic: t, status: 'pending' })))
      return rows
    },
    async update(id, patch) { return await tableUpdate('topicQueue', id, patch) },
    async remove(id) { await tableRemove('topicQueue', id) },
    async nextPending() {
      const rows = await tableList('topicQueue', r => r.status === 'pending')
      return rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] || null
    },
    async count() { return await tableCount('topicQueue', r => r.status === 'pending') },
  },

  csvTopics: {
    async list() { return sortedDesc(await tableList('csvTopics')) },
    async create(row) {
      return await tableInsert('csvTopics', {
        topic: row.topic, category: row.category || '', industry: row.industry || '', tone: row.tone || '', audience: row.audience || '',
        keywords: row.keywords || '', cta: row.cta || '', platform: row.platform || '', language: row.language || '',
        image_path: row.image_path || '', csv_batch: row.csv_batch || '', status: row.status || 'pending',
      })
    },
    async bulkCreate(rows) {
      const out = []
      for (const r of rows) out.push(await storage.csvTopics.create(r))
      return out
    },
    async update(id, patch) { return await tableUpdate('csvTopics', id, patch) },
    async remove(id) { await tableRemove('csvTopics', id) },
    async nextUnused() {
      const rows = await tableList('csvTopics', r => r.status === 'pending')
      return rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] || null
    },
    async countPending() { return await tableCount('csvTopics', r => r.status === 'pending') },
  },

  // ---------- Publishing Queue (intake file pipeline) ----------
  driveQueue: {
    async list(opts = {}) {
      let rows = await tableList('driveQueue', r => {
        if (opts.status && r.status !== opts.status) return false
        if (opts.folder_prefix && r.folder_prefix !== opts.folder_prefix) return false
        return true
      })
      return rows.sort((a, b) => (Number(a.queue_position) || 0) - (Number(b.queue_position) || 0))
    },
    async getByFileId(fileId) {
      return (await tableList('driveQueue', r => r.file_id === fileId))[0] || null
    },
    async get(id) { return await tableGet('driveQueue', id) },
    async create(row) {
      const now = new Date().toISOString()
      const pos = (Math.max(0, ...(await tableList('driveQueue')).map(r => Number(r.queue_position) || 0))) + 1
      return await tableInsert('driveQueue', {
        file_id: row.file_id, file_name: row.file_name || row.file_id, status: row.status || 'queued',
        folder_prefix: row.folder_prefix || 'social', source: row.source || 'drive',
        queue_position: row.queue_position || pos, discovered_at: row.discovered_at || now,
        max_retries: row.max_retries || 3, content: row.content || null, image_url: row.image_url || null,
      })
    },
    async update(id, patch) {
      const clean = { ...patch }
      delete clean.id
      return await tableUpdate('driveQueue', id, { ...clean, updated_at: new Date().toISOString() })
    },
    async updateByFileId(fileId, patch) {
      const row = await this.getByFileId(fileId)
      if (!row) return null
      return await this.update(row.id, patch)
    },
    async remove(id) { await tableRemove('driveQueue', id) },
    // RANDOM selection among eligible images. Eligibility:
    // - status 'queued' (never archived / locked / processing / used)
    // - not flagged as recently used in the Image Library sheet
    async nextQueued() {
      const rows = await tableList('driveQueue', r => r.status === 'queued')
      if (!rows.length) return null
      // Exclude recently used images (Image Library marks last_used_at)
      let eligible = rows
      try {
        const lib = await tableList('mediaLibrary')
        const recent = new Set(lib.filter(r => r.status === 'used').map(r => r.file_id))
        const filtered = rows.filter(r => !recent.has(r.file_id))
        if (filtered.length) eligible = filtered
      } catch {}
      return eligible[Math.floor(Math.random() * eligible.length)] || null
    },
    async maxPosition() {
      const rows = await tableList('driveQueue')
      return Math.max(0, ...rows.map(r => Number(r.queue_position) || 0))
    },
    async count(opts = {}) {
      return await tableCount('driveQueue', r => {
        if (opts.status && r.status !== opts.status) return false
        if (opts.folder_prefix && r.folder_prefix !== opts.folder_prefix) return false
        return true
      })
    },
  },

  // ---------- Image Library (image history / reuse tracking) ----------
  imageLibrary: {
    async list() { return sortedDesc(await tableList('mediaLibrary')) },
    async getByFileId(fileId) {
      const rows = await tableList('mediaLibrary', r => r.file_id === fileId)
      return rows.sort((a, b) => (b.reuse_count || 0) - (a.reuse_count || 0))[0] || null
    },
    async upsert(entry) {
      const existing = (await tableList('mediaLibrary', r => r.file_id === entry.file_id))[0]
      if (existing) {
        const merged = {
          ...existing,
          ...entry,
          reuse_count: entry.reuse_count ?? existing.reuse_count,
          updated_at: new Date().toISOString(),
        }
        delete merged.id
        delete merged.created_at
        return await tableUpdate('mediaLibrary', existing.id, merged)
      }
      return await tableInsert('mediaLibrary', {
        file_id: entry.file_id,
        name: entry.name || entry.file_id,
        mime: entry.mime || '',
        url: entry.url || '',
        size: entry.size || 0,
        source: entry.source || 'drive',
        prompt: entry.prompt || '',
        job_id: entry.job_id || null,
        platform: entry.platform || null,
        published_url: entry.published_url || null,
        published_date: entry.published_date || null,
        archive_date: entry.archive_date || null,
        reuse_count: entry.reuse_count || 0,
        status: entry.status || 'queued',
        last_used: entry.last_used || null,
      })
    },
    async markUsed(fileId, { jobId, name = '' }) {
      const now = new Date().toISOString()
      return await this.upsert({
        file_id: fileId,
        name,
        job_id: jobId,
        status: 'used',
        last_used: now,
        reuse_count: ((await this.getByFileId(fileId))?.reuse_count || 0) + 1,
      })
    },
    async markArchived(fileId, archiveDate) {
      return await this.upsert({ file_id: fileId, status: 'archived', archive_date: archiveDate || new Date().toISOString() })
    },
  },

  // ---------- Notifications ----------
  notifications: {
    async list(limit = 100) {
      return sortedDesc(await tableList('notifications')).slice(0, limit)
    },
    async create(row) {
      return await tableInsert('notifications', {
        channel: row.channel || 'app', title: row.title || '', body: row.body || '',
        status: row.status || 'unread', sent_at: row.sent_at || null,
      })
    },
    async update(id, patch) { return await tableUpdate('notifications', id, patch) },
    async markAllRead() {
      const rows = await tableList('notifications', r => r.status === 'unread')
      for (const r of rows) await tableUpdate('notifications', r.id, { status: 'read' })
      return rows.length
    },
  },

  // ---------- Telegram logs ----------
  telegramLogs: {
    async log(entry) {
      await tableInsert('telegramLogs', {
        chat_id: entry.chat_id || null, message_id: entry.message_id || null,
        action: entry.action || 'message', status: entry.status || 'ok', payload: entry.payload || null, ts: new Date().toISOString(),
      }).catch(() => {})
    },
    async list(limit = 100) { return sortedDesc(await tableList('telegramLogs'), 'ts').slice(0, limit) },
  },

  // ---------- Discord logs ----------
  discordLogs: {
    async log(entry) {
      await tableInsert('discordLogs', {
        channel_id: entry.channel_id || null, message_id: entry.message_id || null,
        action: entry.action || 'message', status: entry.status || 'ok', payload: entry.payload || null, ts: new Date().toISOString(),
      }).catch(() => {})
    },
    async list(limit = 100) { return sortedDesc(await tableList('discordLogs'), 'ts').slice(0, limit) },
  },

  // ---------- AI Learning (news feedback) ----------
  newsLearning: {
    async list() { return sortedDesc(await tableList('learning')) },
    async record(row) {
      return await tableInsert('learning', {
        news_id: row.news_id, topic: row.topic || null, decision: row.decision || 'approve', weight: row.weight || 1,
      })
    },
  },

  // ---------- Mentions ----------
  mentions: {
    async list() {
      return sortedDesc(await tableList('mentions'), 'discovered_at').slice(0, 50)
    },
    async create(row) {
      return await tableInsert('mentions', {
        platform: row.platform || null, url: row.url, author: row.author || '', text: row.text || '',
        status: row.status || 'new', discovered_at: new Date().toISOString(),
      })
    },
    async findByUrl(url) {
      return (await tableList('mentions', r => r.url === url))[0] || null
    },
  },
}

// expose table layer for advanced use
export { tableList, tableGet, tableInsert, tableUpdate, tableRemove, stateGet, stateSet, stateDelete, syncMirrorSheet }
