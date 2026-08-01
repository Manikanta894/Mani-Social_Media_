import { supabase } from './supabase'
import { storage } from './storage'
import { getUpcomingEvents, getEventWindows, getTemplate, getHashtags, getEventByName, CATEGORY_META, getAllEvents } from './seasonal-events'

setEventCount(getAllEvents().length)

const SETTINGS_KEY = 'seasonal_settings'

const DEFAULT_SETTINGS = {
  countries: ['India'],
  industries: [],
  detectionWindow: 7,
  autoDraft: false,
  telegramNotify: false,
  approvalRequired: true,
  autoPublish: false,
}

async function getActiveTextProvider() {
  try {
    return await storage.providers.getActive('text')
  } catch {
    return null
  }
}

function computeRelevance(event, userIndustries = []) {
  if (!userIndustries || userIndustries.length === 0) return 7
  if (userIndustries.includes(event.industry)) return 9
  if (event.industry === 'general') return 6
  return 5
}

function computeEngagementPotential(event) {
  const highEngagement = ['festival', 'national', 'global']
  if (highEngagement.includes(event.type)) return 8
  if (event.type === 'industry') return 6
  return 5
}

export async function detectUpcomingEvents(daysAhead = 14, userSettings = {}) {
  const settings = userSettings && Object.keys(userSettings).length > 0
    ? userSettings
    : await getSeasonalSettings().catch(() => DEFAULT_SETTINGS)

  const window = settings.detectionWindow || daysAhead
  const events = getUpcomingEvents(window, settings)

  const { data: drafted } = await supabase()
    .from('seasonal_queue')
    .select('event_name, event_month, event_day, status')
    .in('status', ['draft', 'pending_approval', 'approved', 'scheduled'])

  const draftedSet = new Set((drafted || []).map(d => `${d.event_name}:${d.event_month}/${d.event_day}`))

  return events.map(e => {
    const key = `${e.name}:${e.month}/${e.day}`
    const isDrafted = draftedSet.has(key)
    return {
      ...e,
      daysUntil: e.daysUntil,
      relevanceScore: computeRelevance(e, settings.industries),
      engagementPotential: computeEngagementPotential(e),
      isDrafted,
    }
  })
}

export async function generateSeasonalDraft(event, context = {}) {
  if (!event || !event.name) throw new Error('Event object with name required')

  const sb = supabase()

  const existing = await sb.from('seasonal_queue')
    .select('id, status')
    .eq('event_name', event.name)
    .eq('event_month', event.month)
    .eq('event_day', event.day)
    .in('status', ['draft', 'pending_approval', 'approved', 'scheduled'])
    .maybeSingle()

  if (existing) {
    return { skipped: true, id: existing.id, message: 'Already drafted' }
  }

  const textProvider = await getActiveTextProvider()
  let analysis = null
  let platformPosts = {}
  let aiConfidence = null

  if (textProvider) {
    try {
      analysis = await getAIAnalysis(event)
      aiConfidence = analysis?.relevanceScore ? analysis.relevanceScore / 10 : null
    } catch (e) {
      console.warn('[seasonal] AI analysis failed:', e.message)
    }
  }

  if (analysis && analysis.recommendedPlatforms && analysis.recommendedPlatforms.length > 0) {
    const platforms = analysis.recommendedPlatforms.slice(0, 5)
    for (const p of platforms) {
      const caption = getTemplate(event)
      const hashtags = getHashtags(event.industry)
      platformPosts[p] = { caption, hashtags }
    }
  } else {
    const platforms = ['linkedin', 'instagram', 'facebook', 'threads', 'twitter']
    for (const p of platforms) {
      const caption = getTemplate(event)
      const hashtags = getHashtags(event.industry)
      platformPosts[p] = { caption, hashtags }
    }
  }

  const scheduledFor = new Date()
  scheduledFor.setFullYear(scheduledFor.getFullYear(), event.month - 1, event.day)
  scheduledFor.setHours(9, 0, 0, 0)

  const defaultAnalysis = {
    relevanceScore: computeRelevance(event),
    engagementPotential: computeEngagementPotential(event),
    recommendedPlatforms: ['linkedin', 'instagram', 'facebook'],
    bestPublishingTime: '09:00',
    audienceNote: `Content relevant to ${event.industry} audience.`,
    coachAdvice: 'Add a personal take or company-specific angle.',
  }

  const { data, error } = await sb.from('seasonal_queue').insert({
    event_name: event.name,
    event_month: event.month,
    event_day: event.day,
    event_type: event.type || 'observance',
    event_country: event.country || null,
    event_industry: event.industry || 'general',
    emoji: event.emoji || '📅',
    platform_posts: platformPosts,
    analysis: analysis || defaultAnalysis,
    scheduled_for: scheduledFor.toISOString(),
    status: context.status || 'draft',
    source: context.source || 'auto',
    versions: [{
      version: 1,
      created_at: new Date().toISOString(),
      platform_posts: platformPosts,
      analysis: analysis || defaultAnalysis,
    }],
    ai_confidence: aiConfidence,
  }).select().single()

  if (error) throw new Error(error.message)

  if (context.notify !== false) {
    try {
      const { sendSeasonalNotification } = await import('./telegram/handler')
      sendSeasonalNotification(data).catch(() => {})
    } catch {}
  }

  return data
}

export async function getAIAnalysis(event) {
  const textProvider = await getActiveTextProvider()
  if (!textProvider) return null

  const { callAi } = await import('./ai/providers')
  const prompt = `You are a social media strategy analyst. Analyze the following event for a brand's content calendar.

Event: ${event.name}
Date: ${event.month}/${event.day}
Type: ${event.type}
Country: ${event.country || 'Global'}
Industry: ${event.industry}
Description: ${event.description || ''}

Provide a JSON analysis with these fields:
- relevanceScore: number 1-10 (how relevant is this event for brands in the ${event.industry} industry?)
- engagementPotential: number 1-10 (how much engagement will content about this event generate?)
- recommendedPlatforms: array of strings (best social platforms for this event, choose from: linkedin, instagram, facebook, threads, twitter, youtube, tiktok, pinterest)
- bestPublishingTime: string (best time to publish in HH:MM format, e.g. "09:00")
- audienceNote: string (1-2 sentences about the target audience for this event)
- coachAdvice: string (1-2 sentences of strategic advice for content creators)

Respond with ONLY valid JSON, no other text.`

  try {
    const raw = await callAi({ provider: textProvider, prompt, json: true })
    const parsed = JSON.parse(raw)
    return {
      relevanceScore: parsed.relevanceScore || 5,
      engagementPotential: parsed.engagementPotential || 5,
      recommendedPlatforms: parsed.recommendedPlatforms || ['linkedin', 'instagram', 'facebook'],
      bestPublishingTime: parsed.bestPublishingTime || '09:00',
      audienceNote: parsed.audienceNote || '',
      coachAdvice: parsed.coachAdvice || '',
    }
  } catch (e) {
    console.warn('[seasonal] AI analysis parse failed:', e.message)
    return null
  }
}

export async function listSeasonalQueue(status) {
  const sb = supabase()
  let q = sb.from('seasonal_queue').select('*').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function updateSeasonalQueueItem(id, patch) {
  const sb = supabase()
  const clean = { ...patch }
  delete clean.id
  delete clean.created_at
  const { data, error } = await sb.from('seasonal_queue').update(clean).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error(`Seasonal queue item ${id} not found`)
  return data
}

export async function deleteSeasonalQueueItem(id) {
  const sb = supabase()
  const { error } = await sb.from('seasonal_queue').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveSeasonalSettings(settings) {
  const sb = supabase()
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  const { error } = await sb.from('app_settings').upsert(
    { key: SETTINGS_KEY, value: merged },
    { onConflict: 'key' }
  )
  if (error) throw new Error(error.message)
  return merged
}

export async function getSeasonalSettings() {
  const sb = supabase()
  const { data, error } = await sb.from('app_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return { ...DEFAULT_SETTINGS, ...((data && data.value) || {}) }
}

// ===========================================================================
// Event Discovery Engine — always knows today / tomorrow / week / month / 90d
// ===========================================================================

export async function detectEventWindows(daysAhead = 90, userSettings = {}) {
  const settings = userSettings && Object.keys(userSettings).length > 0
    ? userSettings
    : await getSeasonalSettings().catch(() => DEFAULT_SETTINGS)

  const { windows, milestones } = getEventWindows(daysAhead, settings)

  const { data: drafted } = await supabase()
    .from('seasonal_queue')
    .select('event_name, event_month, event_day, status')
    .in('status', ['draft', 'pending_approval', 'approved', 'scheduled'])

  const draftedSet = new Set((drafted || []).map(d => `${d.event_name}:${d.event_month}/${d.event_day}`))

  const decorate = (list) => list.map(e => ({
    ...e,
    relevanceScore: computeRelevance(e, settings.industries),
    engagementPotential: computeEngagementPotential(e),
    isDrafted: draftedSet.has(`${e.name}:${e.month}/${e.day}`),
  }))

  const out = {}
  for (const [k, v] of Object.entries(windows)) out[k] = decorate(v)
  const milestonesOut = {}
  for (const [k, v] of Object.entries(milestones)) milestonesOut[k] = decorate(v)

  // Notification milestones: events hitting 30/14/7/3/1 days or today
  const notifications = []
  for (const [d, list] of Object.entries(milestonesOut)) {
    for (const e of list) {
      const label = d === 0 ? `${e.name} is TODAY — campaign window open`
        : `${e.name} is in ${d} day(s) — ${e.isDrafted ? 'campaign ready' : 'draft not yet generated'}`
      notifications.push({ daysUntil: Number(d), event: e.name, emoji: e.emoji, label, isDrafted: e.isDrafted, priority: d <= 3 ? 'high' : d <= 7 ? 'medium' : 'low' })
    }
  }
  notifications.sort((a, b) => a.daysUntil - b.daysUntil)

  return {
    generated_at: new Date().toISOString(),
    total_events: ALL_EVENT_COUNT,
    categories: CATEGORY_META,
    windows: out,
    notifications: notifications.slice(0, 40),
  }
}

let ALL_EVENT_COUNT = 0
export function setEventCount(n) { ALL_EVENT_COUNT = n }
