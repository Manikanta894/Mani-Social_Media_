// ============================================================================
// Sheet-backed table layer — the entire operational database.
//
// Every module = one sheet (tab) in the single Google Spreadsheet. This module
// provides generic CRUD + caching + auto-created sheets/headers + derived
// mirror sheets. The UI keeps calling storage.* — only the storage backend
// changes (lib/storage.js re-implements everything on top of this layer).
//
// Row model: each row = one sheet row. Column `id` is the primary key.
// Objects/arrays are JSON-encoded in their cell; booleans/numbers are stored
// as literal values for easy manual editing.
// ============================================================================

import { randomUUID } from 'crypto'
import { ensureSheet, readValues, appendValues, writeValues, clearSheet, sheetsConfigured } from './gsheets'

// ---------------------------------------------------------------------------
// Schema — table key → sheet name + canonical columns (auto-created headers)
// ---------------------------------------------------------------------------
export const TABLES = {
  providers:      { sheet: 'AI Providers',      columns: ['id', 'name', 'type', 'model', 'base_url', 'active_for_vision', 'active_for_text', 'created_at'] },
  promptStyles:   { sheet: 'Prompt Library',    columns: ['id', 'name', 'instructions', 'is_active', 'created_at'] },
  jobs:           { sheet: 'Posts',             columns: ['id', 'source', 'topic', 'research_context', 'image_ref', 'style_id', 'style_name', 'platform_posts', 'warnings', 'status', 'campaign_id', 'scheduled_for', 'pillar', 'cross_link_url', 'publish_results', 'published_at_actual', 'conflict_warning', 'created_at', 'updated_at'] },
  contentVersions:{ sheet: 'Content Versions',  columns: ['id', 'job_id', 'version', 'platform', 'caption', 'description', 'hashtags', 'alt_text', 'seo_keywords', 'cta', 'ai_confidence', 'providers_used', 'created_at'] },
  drafts:         { sheet: 'Drafts',            columns: ['id', 'platform', 'title', 'caption', 'hashtags', 'image', 'notes', 'source', 'status', 'created_at', 'updated_at'] },
  newsPosts:      { sheet: 'News Queue',        columns: ['id', 'source_id', 'source_name', 'title', 'url', 'summary', 'content', 'image_url', 'author', 'published_at', 'category', 'is_trending', 'is_urgent', 'status', 'ai_analysis', 'generated_posts', 'saved', 'publish_results', 'published_at_actual', 'conflict_warning', 'scheduled_for', 'created_at', 'updated_at'] },
  newsSources:    { sheet: 'News Sources',      columns: ['id', 'name', 'url', 'type', 'category', 'check_interval', 'is_active', 'last_checked_at', 'created_at'] },
  campaigns:      { sheet: 'Campaign Queue',    columns: ['id', 'name', 'description', 'platforms', 'schedule_settings', 'post_count', 'created_at', 'updated_at'] },
  blogPosts:      { sheet: 'SEO Library',       columns: ['id', 'job_id', 'title', 'slug', 'body_markdown', 'cover_image_url', 'image_base64', 'image_mime', 'seo_description', 'status', 'target', 'section', 'category', 'published_url', 'published_at', 'created_at', 'updated_at'] },
  blogQueue:      { sheet: 'Blog Queue',        columns: ['id', 'file_id', 'file_name', 'status', 'article_data', 'title', 'section', 'error', 'draft_reply', 'mime_type', 'upload_date', 'queue_position', 'generation_time', 'approved_at', 'published_date', 'published_url', 'archive_date', 'retry_count', 'created_at', 'updated_at'] },
  blogTopics:     { sheet: 'Blog Topics',       columns: ['id', 'topic', 'status', 'priority', 'note', 'created_at', 'updated_at'] },
  seasonal:       { sheet: 'Seasonal Events',   columns: ['id', 'event_name', 'event_month', 'event_day', 'event_type', 'event_country', 'event_industry', 'emoji', 'platform_posts', 'analysis', 'scheduled_for', 'status', 'source', 'versions', 'ai_confidence', 'draft_reply', 'created_at', 'updated_at'] },
  hashtagSets:    { sheet: 'Hashtag Library',   columns: ['id', 'name', 'tags', 'platform', 'created_at', 'updated_at'] },
  channelGroups:  { sheet: 'Channel Groups',    columns: ['id', 'name', 'platform_credential_ids', 'created_at', 'updated_at'] },
  comments:       { sheet: 'Comments Queue',    columns: ['id', 'platform', 'platform_comment_id', 'author', 'comment_text', 'draft_reply', 'status', 'post_job_id', 'type', 'dm_content', 'reaction_summary', 'created_at', 'updated_at'] },
  analytics:      { sheet: 'Analytics',         columns: ['id', 'kind', 'job_id', 'provider_id', 'platform', 'impressions', 'reach', 'likes', 'comments', 'shares', 'saves', 'clicks', 'profile_visits', 'caption', 'checked_at', 'count', 'total_impressions', 'total_engagement', 'tags', 'month', 'call_count', 'token_count', 'tag', 'volume', 'captured_at', 'period', 'avg_engagement', 'post_count', 'day_of_week', 'hour_of_day', 'url', 'thumbnail_url', 'media_type', 'source', 'published_at', 'engagement_rate', 'platform_post_id', 'created_at', 'updated_at'] },
  hashtagStats:   { sheet: 'Analytics',         columns: ['id', 'tag', 'count', 'total_impressions', 'total_engagement', 'platforms', 'updated_at'] },
  contentLibrary: { sheet: 'Content Library',   columns: ['id', 'platform', 'platform_post_id', 'url', 'caption', 'thumbnail_url', 'media_type', 'source', 'job_id', 'published_at', 'likes', 'comments', 'shares', 'saves', 'impressions', 'reach', 'clicks', 'profile_visits', 'engagement_rate', 'created_at', 'updated_at'] },
  rateLimits:     { sheet: 'Rate Limits',       columns: ['id', 'platform', 'last_429_at', 'retry_after_seconds', 'cooldown_until'] },
  dedupLog:       { sheet: 'Dedup Log',         columns: ['id', 'content_hash', 'topic', 'created_at'] },
  bioLinks:       { sheet: 'Bio Links',         columns: ['id', 'title', 'url', 'icon', 'sort_order', 'visible', 'created_at'] },
  topicQueue:     { sheet: 'Topic Queue',       columns: ['id', 'topic', 'status', 'article_data', 'used_at', 'published_url', 'published_at', 'created_at', 'updated_at'] },
  csvTopics:      { sheet: 'CSV Topics',        columns: ['id', 'topic', 'category', 'industry', 'tone', 'audience', 'keywords', 'cta', 'platform', 'language', 'image_path', 'csv_batch', 'status', 'created_at'] },
  composeTemplates:{ sheet: 'Compose Templates', columns: ['id', 'name', 'context', 'style_id', 'tone_adjustment', 'created_at'] },
  followerSnapshots:{ sheet: 'Analytics',       columns: ['id', 'platform', 'count', 'captured_at'] },
  pendingHashtagSuggestions:{ sheet: 'Hashtag Suggestions', columns: ['id', 'tag', 'source', 'set_id', 'created_at'] },
  notifications:  { sheet: 'Notifications',     columns: ['id', 'channel', 'title', 'body', 'status', 'sent_at', 'created_at'] },
  telegramLogs:   { sheet: 'Telegram Logs',     columns: ['id', 'chat_id', 'message_id', 'action', 'status', 'payload', 'ts'] },
  discordLogs:    { sheet: 'Discord Logs',      columns: ['id', 'channel_id', 'message_id', 'action', 'status', 'payload', 'ts'] },
  whatsappLogs:   { sheet: 'WhatsApp Logs',     columns: ['id', 'phone', 'action', 'status', 'payload', 'ts'] },
  audit:          { sheet: 'Automation Logs',   columns: ['id', 'action', 'entity_type', 'entity_id', 'previous_status', 'new_status', 'metadata', 'performed_at'] },
  learning:       { sheet: 'AI Learning',       columns: ['id', 'news_id', 'topic', 'decision', 'weight', 'created_at'] },
  keywords:       { sheet: 'Keyword Bank',      columns: ['id', 'keyword', 'category', 'volume', 'difficulty', 'notes', 'created_at'] },
  brandVoice:     { sheet: 'Brand Voice',       columns: ['id', 'voice_name', 'tone', 'style_guide', 'banned_words', 'examples', 'is_active', 'created_at'] },
  mentions:       { sheet: 'Mentions',          columns: ['id', 'platform', 'url', 'author', 'text', 'discovered_at', 'status'] },
  mediaLibrary:   { sheet: 'Image Library',     columns: ['id', 'file_id', 'name', 'mime', 'url', 'size', 'source', 'prompt', 'job_id', 'platform', 'published_url', 'published_date', 'archive_date', 'reuse_count', 'status', 'last_used', 'created_at'] },
  appState:       { sheet: 'User Settings',     columns: ['id', 'key', 'value', 'updated_at'] },
  driveQueue:     { sheet: 'Publishing Queue',  columns: ['id', 'file_id', 'file_name', 'status', 'folder_prefix', 'source', 'discovered_at', 'updated_at', 'queue_position', 'content_job_id', 'scheduled_time', 'platform_content', 'published_platforms', 'failed_platforms', 'published_date', 'archive_date', 'approved_at', 'error', 'retry_count', 'max_retries', 'content', 'image_url', 'tick_step'] },
  linkedinIntel:  { sheet: 'LinkedIn Intel',     columns: ['id', 'title', 'url', 'summary', 'author', 'topic', 'post_age_minutes', 'relevance', 'engagement', 'opportunity', 'why', 'comment', 'quality', 'visibility', 'status', 'commented_at', 'created_at', 'updated_at', 'industry', 'classification', 'intent', 'main_argument', 'tone', 'question_asked', 'cta', 'target_audience', 'pain_point', 'takeaway', 'strategy', 'spam_risk', 'conversation_potential', 'networking_score', 'ai_summary', 'why_engage', 'estimated_visibility', 'overall_score', 'comment_url', 'comment_timestamp', 'notified'] },
  linkedinCommentsHistory: { sheet: 'LinkedIn Comments History', columns: ['id', 'date', 'post_url', 'author', 'topic', 'comment', 'strategy_used', 'similarity_score', 'approved', 'published', 'likes', 'replies', 'author_replied', 'connection_accepted', 'profile_visits', 'follower_change', 'created_at'] },
  linkedinIntelLearning: { sheet: 'LinkedIn Learning', columns: ['id', 'comment', 'decision', 'topic', 'created_at'] },
}

// Derived mirror sheets — kept in sync automatically on writes to their source
const MIRRORS = {
  'AI News Analysis': { source: 'newsPosts', filter: r => !!r.ai_analysis },
  'Ignored News':     { source: 'newsPosts', filter: r => ['ignored_by_ai', 'rejected'].includes(r.status) },
  'Approved News':    { source: 'newsPosts', filter: r => ['approved', 'published', 'scheduled', 'pending_approval'].includes(r.status) },
  'Published Blogs':  { source: 'blogPosts', filter: r => r.status === 'published' },
}

const MIRROR_COLUMNS = {
  'AI News Analysis': ['id', 'news_id', 'title', 'url', 'ai_analysis', 'analyzed_at'],
  'Ignored News':     ['id', 'news_id', 'title', 'url', 'status', 'ignored_at'],
  'Approved News':    ['id', 'news_id', 'title', 'url', 'status', 'approved_at'],
  'Published Blogs':  ['id', 'blog_id', 'title', 'slug', 'url', 'published_at'],
}

// ---------------------------------------------------------------------------
// Caching — read cache (TTL), write-through invalidation, mirror debounce
// ---------------------------------------------------------------------------
const cache = new Map()          // tableKey → { rows, ts }
const CACHE_TTL = 60000          // 60s — single user; keeps us under the 60 reads/min quota
const mirrorDebounce = new Map() // sheetTitle → last sync ts

function invalidate(tableKey) {
  cache.delete(tableKey)
}

// ---------------------------------------------------------------------------
// Row encoding/decoding
// ---------------------------------------------------------------------------
function encodeCell(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function decodeCell(raw, header) {
  if (raw === '' || raw === null || raw === undefined) return null
  const s = String(raw)
  if (/^(true|false)$/i.test(s) && header !== 'content' && header !== 'text') return s.toLowerCase() === 'true'
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
    try { return JSON.parse(s) } catch { return s }
  }
  if (s !== '' && !isNaN(Number(s)) && header !== 'name' && header !== 'platform' && header !== 'title' && header !== 'caption' && header !== 'topic' && header !== 'tag') {
    return Number(s)
  }
  return s
}

// ---------------------------------------------------------------------------
// Low-level sheet read with header support
// ---------------------------------------------------------------------------
const headerCache = new Map() // sheet → [columns]

async function readTable(tableKey) {
  const cached = cache.get(tableKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rows
  const spec = TABLES[tableKey]
  if (!spec) throw new Error(`Unknown table: ${tableKey}`)
  await ensureSheet(spec.sheet)
  const values = await readValues(spec.sheet)
  if (!values.length) { const rows = []; cache.set(tableKey, { rows, ts: Date.now() }); return rows }
  const header = values[0].map((h, i) => (h || `col${i}`).trim())
  headerCache.set(spec.sheet, header)
  const rows = values.slice(1).filter(r => r && r[0]).map(row => {
    const obj = { id: String(row[0]) }
    header.forEach((h, i) => {
      if (h === 'id') return
      const raw = row[i]
      if (raw === undefined || raw === '') return
      obj[h] = decodeCell(raw, h)
    })
    return obj
  })
  cache.set(tableKey, { rows, ts: Date.now() })
  return rows
}

async function ensureHeader(spec, extraKeys) {
  const header = headerCache.get(spec.sheet) || []
  const needed = [...spec.columns]
  for (const k of extraKeys || []) if (!needed.includes(k)) needed.push(k)
  if (header.length === 0) {
    // Check the live sheet — it may already have headers from a migration
    const values = await readValues(spec.sheet, 'A1:AN1')
    const live = (values[0] || []).map((h, i) => (h || `col${i}`).trim())
    if (live.length && live[0] === 'id') {
      headerCache.set(spec.sheet, live)
      return live
    }
    await writeValues(spec.sheet, [needed])
    headerCache.set(spec.sheet, needed)
    return needed
  }
  if (needed.some(c => !header.includes(c))) {
    const merged = [...header]
    for (const c of needed) if (!merged.includes(c)) merged.push(c)
    await writeValues(spec.sheet, [merged])
    headerCache.set(spec.sheet, merged)
    return merged
  }
  return header
}

// ---------------------------------------------------------------------------
// Public CRUD API
// ---------------------------------------------------------------------------

export async function tableList(tableKey, filterFn) {
  const rows = await readTable(tableKey)
  if (!filterFn) return rows
  return rows.filter(filterFn)
}

export async function tableGet(tableKey, id) {
  const rows = await readTable(tableKey)
  return rows.find(r => r.id === String(id)) || null
}

export async function tableInsert(tableKey, data) {
  const spec = TABLES[tableKey]
  await ensureSheet(spec.sheet)
  const row = { id: randomUUID(), ...data }
  const header = await ensureHeader(spec, Object.keys(row))
  const values = header.map(h => encodeCell(row[h]))
  await appendValues(spec.sheet, [values])
  invalidate(tableKey)
  syncMirrorIfNeeded(tableKey).catch(() => {})
  return { ...row }
}

export async function tableUpdate(tableKey, id, patch) {
  const spec = TABLES[tableKey]
  const rows = await readTable(tableKey)
  const idx = rows.findIndex(r => r.id === String(id))
  if (idx === -1) throw new Error(`${spec.sheet} row ${id} not found`)
  const merged = { ...rows[idx], ...patch }
  const header = await ensureHeader(spec, Object.keys(merged))
  // Build the full row image from the row start in the sheet
  const values = await readValues(spec.sheet, `A${idx + 2}:AN${idx + 2}`)
  const liveRow = values[0] || []
  const fullHeader = headerCache.get(spec.sheet) || header
  const newRow = fullHeader.map((h, i) => (h === 'id' ? String(id) : encodeCell(merged[h])))
  // Write back full row preserving other columns not in merged
  const finalRow = fullHeader.map((h, i) => {
    if (i < liveRow.length && liveRow[i] !== undefined && merged[h] === undefined && h !== 'id') return liveRow[i]
    return newRow[i] !== undefined ? newRow[i] : ''
  })
  await writeValues(spec.sheet, [finalRow], `A${idx + 2}`)
  invalidate(tableKey)
  syncMirrorIfNeeded(tableKey).catch(() => {})
  return merged
}

export async function tableRemove(tableKey, id) {
  const rows = await readTable(tableKey)
  const idx = rows.findIndex(r => r.id === String(id))
  if (idx === -1) return false
  const spec = TABLES[tableKey]
  // Blank the row (Sheets delete-row would shift ids; blanking keeps ids stable)
  const header = await ensureHeader(spec)
  await writeValues(spec.sheet, [header.map(() => '')], `A${idx + 2}`)
  invalidate(tableKey)
  syncMirrorIfNeeded(tableKey).catch(() => {})
  return true
}

export async function tableCount(tableKey, filterFn) {
  const rows = await readTable(tableKey)
  if (!filterFn) return rows.length
  return rows.filter(filterFn).length
}

// ---------------------------------------------------------------------------
// Key/value app state (settings, automation config, campaign state, learning)
// ---------------------------------------------------------------------------

export async function stateGet(key, fallback = null) {
  const rows = await readTable('appState')
  const row = rows.find(r => r.key === key)
  if (!row) return fallback
  return row.value !== null && row.value !== undefined ? row.value : fallback
}

export async function stateSet(key, value) {
  const rows = await readTable('appState')
  const row = rows.find(r => r.key === key)
  if (row) {
    await tableUpdate('appState', row.id, { key, value, updated_at: new Date().toISOString() })
  } else {
    await tableInsert('appState', { key, value, updated_at: new Date().toISOString() })
  }
}

export async function stateDelete(key) {
  const rows = await readTable('appState')
  const row = rows.find(r => r.key === key)
  if (row) await tableRemove('appState', row.id)
}

// ---------------------------------------------------------------------------
// Mirror sheets (Publishing Queue, AI News Analysis, Ignored/Approved News,
// Published Blogs) — re-synced on writes, debounced to protect quota
// ---------------------------------------------------------------------------
async function syncMirrorIfNeeded(tableKey) {
  for (const [sheetTitle, cfg] of Object.entries(MIRRORS)) {
    if (cfg.source !== tableKey) continue
    const last = mirrorDebounce.get(sheetTitle) || 0
    if (Date.now() - last < 5000) continue
    mirrorDebounce.set(sheetTitle, Date.now())
    try { await syncMirrorSheet(sheetTitle, cfg) } catch {}
  }
}

export async function syncMirrorSheet(sheetTitle, cfg) {
  cfg = cfg || MIRRORS[sheetTitle]
  if (!cfg) return
  await ensureSheet(sheetTitle)
  const rows = await readTable(cfg.source)
  const cols = MIRROR_COLUMNS[sheetTitle]
  const header = [['id', ...cols.slice(1)]]
  const out = rows.filter(cfg.filter).map(r => [r.id, ...cols.slice(1).map(c => encodeCell(r[c] !== undefined ? r[c] : ''))])
  await clearSheet(sheetTitle)
  if (out.length) await writeValues(sheetTitle, [...header, ...out])
}

export function sheetsReady() {
  return sheetsConfigured()
}
