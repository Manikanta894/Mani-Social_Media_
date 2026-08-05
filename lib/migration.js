// ============================================================================
// One-shot migration: Supabase → Google Sheets.
// Reads every legacy table (if SUPABASE_URL is still configured) and writes it
// into the matching sheet via the table layer. Safe to re-run (skips by id).
// ============================================================================

import { tableGet, tableInsert } from './table'
import { stateSet } from './table'

let _client = null
function legacyClient() {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const { createClient } = require('@supabase/supabase-js')
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _client
}

const TABLES = [
  ['ai_providers', 'providers'],
  ['prompt_styles', 'promptStyles'],
  ['content_jobs', 'jobs'],
  ['content_versions', 'contentVersions'],
  ['audit_log', 'audit'],
  ['comments_queue', 'comments'],
  ['content_library', 'contentLibrary'],
  ['news_sources', 'newsSources'],
  ['news_posts', 'newsPosts'],
  ['campaigns', 'campaigns'],
  ['blog_posts', 'blogPosts'],
  ['rate_limits', 'rateLimits'],
  ['dedup_log', 'dedupLog'],
  ['hashtag_sets', 'hashtagSets'],
  ['channel_groups', 'channelGroups'],
  ['seasonal_queue', 'seasonal'],
  ['topic_queue', 'topicQueue'],
  ['csv_topics', 'csvTopics'],
  ['compose_templates', 'composeTemplates'],
  ['pending_hashtag_suggestions', 'pendingHashtagSuggestions'],
  ['bio_links', 'bioLinks'],
  ['drive_queue', 'driveQueue'],
  ['blog_queue', 'blogQueue'],
  ['mentions', 'mentions'],
]

// analytics-table rows get a `kind` marker by source table
const ANALYTICS_KINDS = {
  post_stats: 'post_stats',
  post_details: 'post_details',
  hashtag_stats: 'hashtag_stats',
  follower_snapshots: 'follower',
}

const SKIP_COLUMNS = { providers: ['api_key'] }

async function migrateTable(sb, legacy, tableKey) {
  let migrated = 0
  const { data, error } = await sb.from(legacy).select('*')
  if (error) return { table: legacy, error: error.message, migrated: 0 }
  const skipCols = SKIP_COLUMNS[tableKey] || []
  const kind = ANALYTICS_KINDS[legacy] || null
  for (const row of data || []) {
    if (!row.id) continue
    const existing = await tableGet(tableKey, row.id)
    if (existing) continue
    const clean = { ...row }
    for (const c of skipCols) delete clean[c]
    if (kind && !clean.kind) clean.kind = kind
    if (tableKey === 'analytics') clean.kind = kind
    delete clean.published_at // computed by storage
    try { await tableInsert(tableKey, clean); migrated++ } catch (e) { /* duplicate or col mismatch — skip */ }
  }
  return { table: legacy, migrated }
}

export async function migrateAllToSheets() {
  const sb = legacyClient()
  if (!sb) return { ok: false, reason: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — nothing to migrate (fresh start on Sheets)' }

  const results = []
  for (const [legacy, tableKey] of TABLES) {
    results.push(await migrateTable(sb, legacy, tableKey))
  }

  // app_settings key/value → User Settings sheet
  let appSettingsMigrated = 0
  const { data: settings, error: sErr } = await sb.from('app_settings').select('*')
  if (!sErr) {
    for (const row of settings || []) {
      try {
        await stateSet(row.key, row.value)
        appSettingsMigrated++
      } catch {}
    }
  }
  results.push({ table: 'app_settings', migrated: appSettingsMigrated, error: sErr?.message || null })

  return { ok: true, results, total_migrated: results.reduce((s, r) => s + (r.migrated || 0), 0) + appSettingsMigrated }
}
