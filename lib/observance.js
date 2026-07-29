// Observance/seasonal auto-draft module.
// Checks upcoming Indian festivals and auto-creates draft content_jobs.

import { storage } from './storage'
import { getUpcomingFestivals, getTemplate, getHashtags } from './festivals'

const OBSERVANCE_KEY = 'observance_last_check'
const DRAFT_AHEAD_DAYS = 5

async function alreadyDrafted(name, month, day) {
  const sb = (await import('./supabase')).supabase()
  const tag = `observance:${name}:${month}/${day}`
  const { data } = await sb.from('content_jobs')
    .select('id')
    .eq('source', 'observance')
    .eq('topic', tag)
    .maybeSingle()
  return !!data
}

export async function checkObservance() {
  const sb = (await import('./supabase')).supabase()

  // Check when we last ran
  const { data: last } = await sb.from('app_settings').select('value').eq('key', OBSERVANCE_KEY).maybeSingle()
  const lastAt = last?.value?.at ? new Date(last.value.at) : new Date(0)
  if (Date.now() - lastAt.getTime() < 12 * 60 * 60 * 1000) {
    return { skipped: 'checked within last 12h' }
  }

  const upcoming = getUpcomingFestivals(DRAFT_AHEAD_DAYS)
  const created = []

  for (const fest of upcoming) {
    if (await alreadyDrafted(fest.name, fest.month, fest.day)) continue

    const caption = getTemplate(fest)
    const hashtags = getHashtags(fest.industry)
    const tag = `observance:${fest.name}:${fest.month}/${fest.day}`

    // Create platform posts for all supported platforms
    const platformPosts = {}
    const platforms = ['linkedin', 'instagram', 'facebook', 'threads', 'twitter']
    for (const p of platforms) {
      const ht = [...hashtags, `#${fest.name.replace(/[^a-zA-Z0-9]/g, '')}`]
      platformPosts[p] = { caption: caption + '\n\n' + ht.join(' '), hashtags: ht }
    }

    // Schedule for the festival day
    const scheduledFor = new Date(2026, fest.month - 1, fest.day, 9, 0, 0).toISOString()

    try {
      await storage.jobs.create({
        source: 'observance',
        topic: tag,
        platform_posts: platformPosts,
        status: 'draft',
        scheduled_for: scheduledFor,
        research_context: `Auto-generated post for ${fest.name} (${fest.type})`,
      })
      created.push(fest.name)
    } catch (e) {
      console.warn('[observance] failed to create draft for', fest.name, e.message)
    }
  }

  // Record check time
  await sb.from('app_settings').upsert(
    { key: OBSERVANCE_KEY, value: { at: new Date().toISOString(), created } },
    { onConflict: 'key' }
  ).catch(() => {})

  return { checked: true, created, upcoming: upcoming.length }
}

export async function listObservanceDrafts() {
  const sb = (await import('./supabase')).supabase()
  const { data } = await sb.from('content_jobs')
    .select('*')
    .eq('source', 'observance')
    .order('scheduled_for', { ascending: true })
  return data || []
}
