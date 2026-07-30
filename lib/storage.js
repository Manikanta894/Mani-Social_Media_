// Storage layer — Supabase adapter.
// Same public interface as before, backed by Postgres via @supabase/supabase-js.

import { randomUUID } from 'crypto'
import { supabase } from './supabase'

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

let _seededStyles = false
async function ensureStylesSeeded() {
  if (_seededStyles) return
  const sb = supabase()
  const { count, error } = await sb.from('prompt_styles').select('id', { head: true, count: 'exact' })
  if (error) {
    if (/relation .* does not exist/i.test(error.message || '')) {
      throw new Error('Supabase schema not initialized. Run supabase/schema.sql in the SQL Editor first.')
    }
    throw error
  }
  if ((count || 0) === 0) {
    const { error: insErr } = await sb.from('prompt_styles').insert(DEFAULT_STYLES)
    if (insErr) throw insErr
  }
  _seededStyles = true
}

function throwIf(e) { if (e) throw new Error(e.message || String(e)) }
function simpleHash(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
  return 'h' + Math.abs(h).toString(36)
}

export const storage = {
  // ---------- AI Providers ----------
  providers: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('ai_providers').select('*').order('created_at')
      throwIf(error)
      return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('ai_providers').select('*').eq('id', id).maybeSingle()
      throwIf(error)
      return data
    },
    async create(item) {
      const sb = supabase()
      const all = await this.list()
      const row = {
        name: item.name || 'Untitled',
        type: item.type || 'gemini',
        api_key: item.api_key || '',
        model: item.model || '',
        base_url: item.base_url || '',
        active_for_vision: !!item.active_for_vision,
        active_for_text: !!item.active_for_text,
      }
      if (all.length === 0) {
        row.active_for_vision = true
        row.active_for_text = true
      }
      if (row.active_for_vision) throwIf((await sb.from('ai_providers').update({ active_for_vision: false }).neq('id', 'x')).error)
      if (row.active_for_text)   throwIf((await sb.from('ai_providers').update({ active_for_text: false   }).neq('id', 'x')).error)
      const { data, error } = await sb.from('ai_providers').insert(row).select().single()
      throwIf(error)
      return data
    },
    async update(id, patch) {
      const sb = supabase()
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      if (clean.active_for_vision) throwIf((await sb.from('ai_providers').update({ active_for_vision: false }).neq('id', id)).error)
      if (clean.active_for_text)   throwIf((await sb.from('ai_providers').update({ active_for_text: false   }).neq('id', id)).error)
      const { data, error } = await sb.from('ai_providers').update(clean).eq('id', id).select().single()
      throwIf(error)
      return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('ai_providers').delete().eq('id', id)
      throwIf(error)
    },
    async setActive(role, providerId) {
      const sb = supabase()
      const col = role === 'vision' ? 'active_for_vision' : 'active_for_text'
      throwIf((await sb.from('ai_providers').update({ [col]: false }).neq('id', 'x')).error)
      throwIf((await sb.from('ai_providers').update({ [col]: true  }).eq('id', providerId)).error)
    },
    async getActive(role) {
      const sb = supabase()
      const col = role === 'vision' ? 'active_for_vision' : 'active_for_text'
      const { data, error } = await sb.from('ai_providers').select('*').eq(col, true).maybeSingle()
      throwIf(error)
      return data
    },
    usage: {
      async list(providerId) {
        const sb = supabase()
        let query = sb.from('provider_usage').select('*').order('month', { ascending: false })
        if (providerId) query = query.eq('provider_id', providerId)
        const { data, error } = await query
        throwIf(error)
        return data || []
      },
      async record(providerId, { calls = 1, tokens = 0 }) {
        const sb = supabase()
        const month = new Date().toISOString().slice(0, 7)
        const { data: existing } = await sb.from('provider_usage').select('id, call_count, token_count').eq('provider_id', providerId).eq('month', month).maybeSingle()
        if (existing) {
          const { data, error } = await sb.from('provider_usage').update({
            call_count: existing.call_count + calls,
            token_count: existing.token_count + tokens,
            updated_at: new Date().toISOString(),
          }).eq('id', existing.id).select().single()
          throwIf(error)
          return data
        } else {
          const { data, error } = await sb.from('provider_usage').insert({
            provider_id: providerId,
            month,
            call_count: calls,
            token_count: tokens,
          }).select().single()
          throwIf(error)
          return data
        }
      },
    },
  },

  // ---------- Prompt styles ----------
  promptStyles: {
    async list() {
      await ensureStylesSeeded()
      const sb = supabase()
      const { data, error } = await sb.from('prompt_styles').select('*').order('created_at')
      throwIf(error)
      return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('prompt_styles').select('*').eq('id', id).maybeSingle()
      throwIf(error)
      return data
    },
    async create(item) {
      const sb = supabase()
      const row = {
        id: 'style-' + randomUUID().slice(0, 8),
        name: item.name || 'Untitled Style',
        instructions: item.instructions || '',
        is_active: !!item.is_active,
      }
      if (row.is_active) throwIf((await sb.from('prompt_styles').update({ is_active: false }).neq('id', 'x')).error)
      const { data, error } = await sb.from('prompt_styles').insert(row).select().single()
      throwIf(error)
      return data
    },
    async update(id, patch) {
      const sb = supabase()
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      if (clean.is_active) throwIf((await sb.from('prompt_styles').update({ is_active: false }).neq('id', id)).error)
      const { data, error } = await sb.from('prompt_styles').update(clean).eq('id', id).select().single()
      throwIf(error)
      return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('prompt_styles').delete().eq('id', id)
      throwIf(error)
    },
    async setActive(id) {
      const sb = supabase()
      throwIf((await sb.from('prompt_styles').update({ is_active: false }).neq('id', 'x')).error)
      throwIf((await sb.from('prompt_styles').update({ is_active: true  }).eq('id', id)).error)
    },
    async getActive() {
      const sb = supabase()
      const { data, error } = await sb.from('prompt_styles').select('*').eq('is_active', true).maybeSingle()
      throwIf(error)
      return data
    },
  },

  // ---------- Content jobs ----------
  jobs: {
    async list(opts = {}) {
      const sb = supabase()
      let query = sb.from('content_jobs').select('*')
      if (opts.campaign_id) query = query.eq('campaign_id', opts.campaign_id)
      if (opts.source) query = query.eq('source', opts.source)
      if (opts.status) query = query.eq('status', opts.status)
      const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
      throwIf(error)
      return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('content_jobs').select('*').eq('id', id).maybeSingle()
      throwIf(error)
      return data
    },
    async create(item) {
      const sb = supabase()
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
      const { data, error } = await sb.from('content_jobs').insert(row).select().single()
      throwIf(error)
      return data
    },
    async update(id, patch) {
      const sb = supabase()
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const { data, error } = await sb.from('content_jobs').update(clean).eq('id', id).select().maybeSingle()
      throwIf(error)
      if (!data) throw new Error(`Job ${id} not found`)
      return data
    },
  },

  // ---------- Content versions (AI generation history) ----------
  contentVersions: {
    async list(jobId) {
      const sb = supabase()
      const { data, error } = await sb.from('content_versions').select('*').eq('job_id', jobId).order('version', { ascending: false })
      throwIf(error)
      return data || []
    },
    async create(version) {
      const sb = supabase()
      const { data, error } = await sb.from('content_versions').insert({
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
      }).select().single()
      throwIf(error)
      return data
    },
  },

  // ---------- Audit log ----------
  audit: {
    async log(action, entityType, entityId, previousStatus, newStatus, metadata) {
      const sb = supabase()
      const { error } = await sb.from('audit_log').insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        previous_status: previousStatus,
        new_status: newStatus,
        metadata: metadata || null,
      })
      throwIf(error)
    },
    async list(limit = 100) {
      const sb = supabase()
      const { data, error } = await sb.from('audit_log').select('*').order('performed_at', { ascending: false }).limit(limit)
      throwIf(error)
      return data || []
    },
    async listByEntity(entityType, entityId) {
      const sb = supabase()
      const { data, error } = await sb.from('audit_log').select('*').eq('entity_type', entityType).eq('entity_id', entityId).order('performed_at', { ascending: false })
      throwIf(error)
      return data || []
    },
  },

  // ---------- Comments queue ----------
  comments: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').select('*').order('created_at', { ascending: false }).limit(200)
      throwIf(error)
      return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').select('*').eq('id', id).maybeSingle()
      throwIf(error)
      return data
    },
    async getByPlatform(platform) {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').select('*').eq('platform', platform).order('created_at', { ascending: false })
      throwIf(error)
      return data || []
    },
    async create(item) {
      const sb = supabase()
      const row = {
        platform: item.platform,
        platform_comment_id: item.platform_comment_id,
        author: item.author,
        comment_text: item.comment_text,
        draft_reply: item.draft_reply || null,
        status: item.status || 'pending',
        post_job_id: item.post_job_id || null,
      }
      const { data, error } = await sb.from('comments_queue').insert(row).select().single()
      throwIf(error)
      return data
    },
    async update(id, patch) {
      const sb = supabase()
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const { data, error } = await sb.from('comments_queue').update(clean).eq('id', id).select().maybeSingle()
      throwIf(error)
      if (!data) throw new Error(`Comment ${id} not found`)
      return data
    },
  },

  // ---------- Post stats (analytics) ----------
  postStats: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('post_stats').select('*').order('checked_at', { ascending: false })
      throwIf(error)
      return data || []
    },
    async getByJob(jobId) {
      const sb = supabase()
      const { data, error } = await sb.from('post_stats').select('*').eq('job_id', jobId).order('checked_at', { ascending: false })
      throwIf(error)
      return data || []
    },
    async upsert(row) {
      const sb = supabase()
      const { data, error } = await sb.from('post_stats').insert({
        job_id: row.job_id,
        platform: row.platform,
        impressions: row.impressions || 0,
        reach: row.reach || 0,
        likes: row.likes || 0,
        comments: row.comments || 0,
        shares: row.shares || 0,
        saves: row.saves || 0,
        checked_at: row.checked_at || new Date().toISOString(),
      }).select().maybeSingle()
      throwIf(error)
      return data
    },
    async deleteBefore(date) {
      const sb = supabase()
      const { error } = await sb.from('post_stats').delete().lt('checked_at', date)
      throwIf(error)
    },
  },

  // ---------- Post details (per-post analytics) ----------
  postDetails: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('post_details').select('*').order('checked_at', { ascending: false })
      throwIf(error)
      return data || []
    },
    async getByJob(jobId) {
      const sb = supabase()
      const { data, error } = await sb.from('post_details').select('*').eq('job_id', jobId).order('checked_at', { ascending: false })
      throwIf(error)
      return data || []
    },
    async upsert(row) {
      const sb = supabase()
      const { data, error } = await sb.from('post_details').insert({
        job_id: row.job_id, platform: row.platform, impressions: row.impressions || 0, reach: row.reach || 0,
        likes: row.likes || 0, comments: row.comments || 0, shares: row.shares || 0, saves: row.saves || 0,
        clicks: row.clicks || 0, profile_visits: row.profile_visits || 0, caption: row.caption || '',
        checked_at: row.checked_at || new Date().toISOString(),
      }).select().maybeSingle()
      throwIf(error)
      return data
    },
  },

  // ---------- Hashtag stats ----------
  hashtagStats: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('hashtag_stats').select('*').order('count', { ascending: false })
      throwIf(error); return data || []
    },
    async upsert(row) {
      const sb = supabase()
      const { data: existing } = await sb.from('hashtag_stats').select('id').eq('tag', row.tag).maybeSingle()
      if (existing) {
        const { data, error } = await sb.from('hashtag_stats').update({
          count: row.count, total_impressions: row.total_impressions, total_engagement: row.total_engagement,
          platforms: row.platforms, updated_at: new Date().toISOString(),
        }).eq('id', existing.id).select().maybeSingle()
        throwIf(error); return data
      }
      const { data, error } = await sb.from('hashtag_stats').insert({
        tag: row.tag, count: row.count || 1, total_impressions: row.total_impressions || 0,
        total_engagement: row.total_engagement || 0, platforms: row.platforms || [],
      }).select().maybeSingle()
      throwIf(error); return data
    },
  },

  // ---------- News sources ----------
  newsSources: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('news_sources').select('*').order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async listActive() {
      const sb = supabase()
      const { data, error } = await sb.from('news_sources').select('*').eq('is_active', true)
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('news_sources').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('news_sources').insert({
        name: row.name, url: row.url, type: row.type || 'rss', category: row.category || 'general',
        check_interval: row.check_interval || 15, is_active: row.is_active !== false,
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('news_sources').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('news_sources').delete().eq('id', id)
      throwIf(error)
    },
    async touch(id) {
      const sb = supabase()
      const { error } = await sb.from('news_sources').update({ last_checked_at: new Date().toISOString() }).eq('id', id)
      throwIf(error)
    },
  },

  // ---------- News posts ----------
  newsPosts: {
    async list(status) {
      const sb = supabase()
      let q = sb.from('news_posts').select('*')
      if (status) q = q.eq('status', status)
      const { data, error } = await q.order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('news_posts').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async findByUrl(url) {
      const sb = supabase()
      const { data, error } = await sb.from('news_posts').select('id').eq('url', url).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('news_posts').insert({
        source_id: row.source_id, source_name: row.source_name, title: row.title, url: row.url,
        summary: row.summary, content: row.content, image_url: row.image_url, author: row.author,
        published_at: row.published_at, category: row.category || 'general', is_trending: row.is_trending || false,
        status: row.status || 'new',
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('news_posts').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('news_posts').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Campaigns ----------
  campaigns: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('campaigns').select('*').order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('campaigns').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('campaigns').insert({
        name: row.name, description: row.description || '', platforms: row.platforms || [],
        schedule_settings: row.schedule_settings || {}, post_count: row.post_count || 0,
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('campaigns').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('campaigns').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Blog posts ----------
  blogPosts: {
    async list(status) {
      const sb = supabase()
      let q = sb.from('blog_posts').select('*')
      if (status) q = q.eq('status', status)
      const { data, error } = await q.order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('blog_posts').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('blog_posts').insert({
        job_id: row.job_id || null, title: row.title || '', slug: row.slug || null,
        body_markdown: row.body_markdown || '', cover_image_url: row.cover_image_url || null,
        seo_description: row.seo_description || '', status: row.status || 'draft',
        target: row.target || 'hashnode',
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('blog_posts').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('blog_posts').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Rate-limit tracking (per platform) ----------
  rateLimits: {
    async get(platform) {
      const sb = supabase()
      const { data, error } = await sb.from('rate_limits').select('*').eq('platform', platform).maybeSingle()
      throwIf(error); return data || null
    },
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('rate_limits').select('*').order('platform')
      throwIf(error); return data || []
    },
    async record(platform, retryAfterSeconds = 60) {
      const sb = supabase()
      const now = new Date().toISOString()
      const cooldown = new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
      const { data, error } = await sb.from('rate_limits').upsert({
        platform,
        last_429_at: now,
        retry_after_seconds: retryAfterSeconds,
        cooldown_until: cooldown,
      }, { onConflict: 'platform' }).select().maybeSingle()
      throwIf(error); return data
    },
    async clear(platform) {
      const sb = supabase()
      const { error } = await sb.from('rate_limits').delete().eq('platform', platform)
      throwIf(error)
    },
  },

  // ---------- Dedup log ----------
  dedupLog: {
    async findByTopic(topic) {
      const sb = supabase()
      // Use content_hash as a simple topic hash
      const hash = simpleHash(topic)
      const { data, error } = await sb.from('dedup_log').select('*').eq('content_hash', hash).maybeSingle()
      throwIf(error); return data
    },
    async log(topic) {
      const sb = supabase()
      const hash = simpleHash(topic)
      const { data, error } = await sb.from('dedup_log').insert({
        content_hash: hash, topic,
      }).select().maybeSingle()
      if (error && error.code === '23505') return { already_exists: true } // unique violation
      throwIf(error); return data
    },
  },

  // ---------- App settings (single row 'main') ----------
  settings: {
    async _read() {
      const sb = supabase()
      const { data, error } = await sb.from('app_settings').select('value').eq('key', 'main').maybeSingle()
      throwIf(error)
      return (data && data.value) || {}
    },
    async _write(value) {
      const sb = supabase()
      const { error } = await sb.from('app_settings').upsert({ key: 'main', value }, { onConflict: 'key' })
      throwIf(error)
    },
    async get() {
      const stored = await this._read()
      let settings = { ...stored }
      let needsWrite = false
      if (settings.kill_switch === undefined) {
        settings.kill_switch = false
      }
      if (!settings.telegram_bot_token && process.env.TELEGRAM_BOT_TOKEN) {
        settings.telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN
        needsWrite = true
      }
      if (!settings.telegram_admin_chat_id && process.env.TELEGRAM_ADMIN_CHAT_ID) {
        settings.telegram_admin_chat_id = process.env.TELEGRAM_ADMIN_CHAT_ID
        needsWrite = true
      }
      if (!settings.telegram_webhook_secret) {
        settings.telegram_webhook_secret = randomUUID().replace(/-/g, '')
        needsWrite = true
      }
      if (needsWrite) await this._write(settings)
      return settings
    },
    async patch(patch) {
      const cur = await this._read()
      const merged = { ...cur, ...patch }
      if (!merged.telegram_bot_token && process.env.TELEGRAM_BOT_TOKEN) merged.telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN
      if (!merged.telegram_admin_chat_id && process.env.TELEGRAM_ADMIN_CHAT_ID) merged.telegram_admin_chat_id = process.env.TELEGRAM_ADMIN_CHAT_ID
      if (!merged.telegram_webhook_secret) merged.telegram_webhook_secret = randomUUID().replace(/-/g, '')
      await this._write(merged)
      return merged
    },
  },

  // ---------- Hashtag sets ----------
  hashtagSets: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('hashtag_sets').select('*').order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('hashtag_sets').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('hashtag_sets').insert({
        name: row.name, tags: row.tags || [], platform: row.platform || null,
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('hashtag_sets').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('hashtag_sets').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Channel groups ----------
  channelGroups: {
    async list() {
      const sb = supabase()
      const { data, error } = await sb.from('channel_groups').select('*').order('created_at', { ascending: false })
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('channel_groups').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('channel_groups').insert({
        name: row.name, platform_credential_ids: row.platform_credential_ids || [],
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('channel_groups').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('channel_groups').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Best-time cache ----------
  bestTimes: {
    async getByPlatform(platform) {
      const sb = supabase()
      const { data, error } = await sb.from('best_time_cache')
        .select('*').eq('platform', platform).order('avg_engagement', { ascending: false }).limit(3)
      throwIf(error); return data || []
    },
    async compute() {
      const sb = supabase()
      const { data: details, error } = await sb.from('post_details')
        .select('platform, checked_at, likes, comments, shares, impressions')
        .gte('checked_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      if (error) throw new Error(error.message)
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
        const { error: upsErr } = await sb.from('best_time_cache').upsert({
          platform: b.platform, hour_of_day: b.hour_of_day, day_of_week: b.day_of_week,
          avg_engagement: rate, post_count: b.count, updated_at: new Date().toISOString(),
        }, { onConflict: 'platform,day_of_week,hour_of_day', ignoreDuplicates: false })
        if (!upsErr) inserted++
      }
      return { computed: inserted }
    },
  },

  // ---------- Seasonal Intelligence Queue (isolated from content_jobs) --
  seasonal: {
    async list(status) {
      const sb = supabase()
      let q = sb.from('seasonal_queue').select('*').order('created_at', { ascending: false })
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      throwIf(error)
      return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('seasonal_queue').select('*').eq('id', id).maybeSingle()
      throwIf(error)
      return data
    },
    async create(data) {
      const sb = supabase()
      const { data: row, error } = await sb.from('seasonal_queue').insert({
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
      }).select().single()
      throwIf(error)
      return row
    },
    async update(id, patch) {
      const sb = supabase()
      const clean = { ...patch }
      delete clean.id
      delete clean.created_at
      const { data, error } = await sb.from('seasonal_queue').update(clean).eq('id', id).select().maybeSingle()
      throwIf(error)
      if (!data) throw new Error(`Seasonal queue item ${id} not found`)
      return data
    },
    async remove(id) {
      const sb = supabase()
      const { error } = await sb.from('seasonal_queue').delete().eq('id', id)
      throwIf(error)
    },
  },

  // ---------- Expanded engagement inbox ----------
  engagement: {
    async list(opts = {}) {
      const sb = supabase()
      let q = sb.from('comments_queue').select('*')
      if (opts.status) q = q.eq('status', opts.status)
      if (opts.platform) q = q.eq('platform', opts.platform)
      if (opts.type) q = q.eq('type', opts.type)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(100)
      throwIf(error); return data || []
    },
    async get(id) {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').select('*').eq('id', id).maybeSingle()
      throwIf(error); return data
    },
    async update(id, patch) {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').update(patch).eq('id', id).select().maybeSingle()
      throwIf(error); return data
    },
    async create(row) {
      const sb = supabase()
      const { data, error } = await sb.from('comments_queue').insert({
        platform: row.platform, platform_comment_id: row.platform_comment_id || null,
        author: row.author || '', comment_text: row.comment_text || '',
        draft_reply: row.draft_reply || '', status: row.status || 'pending',
        post_job_id: row.post_job_id || null, type: row.type || 'comment',
        dm_content: row.dm_content || null, reaction_summary: row.reaction_summary || null,
      }).select().maybeSingle()
      throwIf(error); return data
    },
    async fetchAll() {
      const { fetchAllComments } = await import('@/lib/comments/fetchers')
      return await fetchAllComments()
    },
  },

  // Compose templates
  composeTemplates: {
    async list() { const sb = supabase(); const { data, error } = await sb.from('compose_templates').select('*').order('created_at', { ascending: false }); throwIf(error); return data || [] },
    async get(id) { const sb = supabase(); const { data, error } = await sb.from('compose_templates').select('*').eq('id', id).maybeSingle(); throwIf(error); return data },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('compose_templates').insert({ name: row.name, context: row.context || '', style_id: row.style_id || null, tone_adjustment: row.tone_adjustment || 0 }).select().maybeSingle(); throwIf(error); return data },
    async update(id, patch) { const sb = supabase(); const { data, error } = await sb.from('compose_templates').update(patch).eq('id', id).select().maybeSingle(); throwIf(error); return data },
    async remove(id) { const sb = supabase(); const { error } = await sb.from('compose_templates').delete().eq('id', id); throwIf(error) },
  },

  // Follower snapshots
  followerSnapshots: {
    async list(limit = 90) { const sb = supabase(); const { data, error } = await sb.from('follower_snapshots').select('*').order('captured_at', { ascending: true }).limit(limit); throwIf(error); return data || [] },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('follower_snapshots').insert({ platform: row.platform, count: row.count }).select().maybeSingle(); throwIf(error); return data },
    async getLatest() { const sb = supabase(); const { data, error } = await sb.from('follower_snapshots').select('*').order('captured_at', { ascending: false }).limit(20); throwIf(error); return data || [] },
  },

  // Pending hashtag suggestions
  pendingHashtagSuggestions: {
    async list() { const sb = supabase(); const { data, error } = await sb.from('pending_hashtag_suggestions').select('*').order('created_at', { ascending: false }); throwIf(error); return data || [] },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('pending_hashtag_suggestions').insert({ tag: row.tag, source: row.source || 'trending', set_id: row.set_id || null }).select().maybeSingle(); throwIf(error); return data },
    async update(id, patch) { const sb = supabase(); const { data, error } = await sb.from('pending_hashtag_suggestions').update(patch).eq('id', id).select().maybeSingle(); throwIf(error); return data },
    async remove(id) { const sb = supabase(); const { error } = await sb.from('pending_hashtag_suggestions').delete().eq('id', id); throwIf(error) },
  },

  // Bio links
  bioLinks: {
    async list() { const sb = supabase(); const { data, error } = await sb.from('bio_links').select('*').order('sort_order', { ascending: true }); throwIf(error); return data || [] },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('bio_links').insert({ title: row.title, url: row.url, icon: row.icon || 'link', sort_order: row.sort_order || 0, visible: row.visible !== false }).select().maybeSingle(); throwIf(error); return data },
    async update(id, patch) { const sb = supabase(); const { data, error } = await sb.from('bio_links').update(patch).eq('id', id).select().maybeSingle(); throwIf(error); return data },
    async remove(id) { const sb = supabase(); const { error } = await sb.from('bio_links').delete().eq('id', id); throwIf(error) },
  },

  topicQueue: {
    async list() { const sb = supabase(); const { data, error } = await sb.from('topic_queue').select('*').order('created_at', { ascending: false }); throwIf(error); return data || [] },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('topic_queue').insert({ topic: row.topic }).select().maybeSingle(); throwIf(error); return data },
    async bulkCreate(topics) { const sb = supabase(); const rows = topics.map(t => ({ topic: t })); const { data, error } = await sb.from('topic_queue').insert(rows).select(); throwIf(error); return data || [] },
    async update(id, patch) { const sb = supabase(); const { data, error } = await sb.from('topic_queue').update(patch).eq('id', id).select().maybeSingle(); throwIf(error); return data },
    async remove(id) { const sb = supabase(); const { error } = await sb.from('topic_queue').delete().eq('id', id); throwIf(error) },
    async nextPending() { const sb = supabase(); const { data, error } = await sb.from('topic_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(); throwIf(error); return data },
    async count() { const sb = supabase(); const { count, error } = await sb.from('topic_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'); throwIf(error); return count || 0 },
  },

  csvTopics: {
    async list() { const sb = supabase(); const { data, error } = await sb.from('csv_topics').select('*').order('created_at', { ascending: false }); throwIf(error); return data || [] },
    async create(row) { const sb = supabase(); const { data, error } = await sb.from('csv_topics').insert({ topic: row.topic, category: row.category || '', industry: row.industry || '', tone: row.tone || '', audience: row.audience || '', keywords: row.keywords || '', cta: row.cta || '', platform: row.platform || '', language: row.language || '', image_path: row.image_path || '', csv_batch: row.csv_batch || '' }).select().maybeSingle(); throwIf(error); return data },
    async bulkCreate(rows) { const sb = supabase(); const { data, error } = await sb.from('csv_topics').insert(rows).select(); throwIf(error); return data || [] },
    async update(id, patch) { const sb = supabase(); const { data, error } = await sb.from('csv_topics').update(patch).eq('id', id).select().maybeSingle(); throwIf(error); return data },
    async remove(id) { const sb = supabase(); const { error } = await sb.from('csv_topics').delete().eq('id', id); throwIf(error) },
    async nextUnused() { const sb = supabase(); const { data, error } = await sb.from('csv_topics').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(); throwIf(error); return data },
    async countPending() { const sb = supabase(); const { count, error } = await sb.from('csv_topics').select('id', { count: 'exact', head: true }).eq('status', 'pending'); throwIf(error); return count || 0 },
  },
}
