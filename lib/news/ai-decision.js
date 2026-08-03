// ============================================================================
// AI News Decision Engine v2.1 — enterprise editorial intelligence
// Confidence verification · duplicate merging · lifecycle · competition ·
// content gaps · multi-angle · editorial board · learning
// ============================================================================

import { storage } from '../storage'
import { sendMessage } from '../telegram/client'
import { emitEvent } from '../event-engine'

const DEFAULT_TOPICS = ['Artificial Intelligence', 'Machine Learning', 'Business Analytics', 'Human Resources', 'People Analytics', 'MBA', 'Leadership', 'Productivity', 'Technology', 'Marketing', 'Finance', 'Data Analytics', 'Career', 'Research', 'Education', 'Retail']
const TOPICS_KEY = 'news_topics'
const LEARNING_KEY = 'news_learning'
const AUTHORITY_SOURCES = ['reuters', 'ap news', 'associated press', 'bloomberg', 'cnbc', 'bbc', 'forbes', 'economist', 'ft.com', 'financial times', 'wsj', 'wall street journal', 'the verge', 'techcrunch', 'venturebeat', 'mit technology review', 'harvard business review', 'hbr.org', 'nvidia', 'openai', 'anthropic', 'google', 'microsoft', 'economictimes', 'business-standard', 'business standard', 'mckinsey', 'deloitte', 'pwc', 'kpmg', 'wef', 'world economic forum', 'imf', 'world bank', 'who', 'nasscom', 'peoplematters', 'shrm']

export async function getNewsTopics() {
  try { const s = await storage.settings.get(); return (s[TOPICS_KEY] || DEFAULT_TOPICS) } catch { return DEFAULT_TOPICS }
}
export async function saveNewsTopics(topics) {
  const clean = topics.filter(Boolean).map(t => t.trim()).filter(t => t.length > 1).slice(0, 30)
  await storage.settings.patch({ [TOPICS_KEY]: clean })
  return clean
}

export async function getLearning() {
  try { const s = await storage.settings.get(); return s[LEARNING_KEY] || {} } catch { return {} }
}
export async function recordFeedback(newsId, action) {
  const { supabase } = await import('../supabase')
  const sb = supabase()
  const { data: item } = await sb.from('news_posts').select('*').eq('id', newsId).maybeSingle()
  const learning = await getLearning()
  const topics = item?.ai_analysis?.matched_topics || [item?.category || 'general']
  for (const t of topics) {
    const key = t.toLowerCase()
    learning[key] = learning[key] || { approves: 0, rejects: 0 }
    if (action === 'approve') learning[key].approves++
    else if (action === 'reject') learning[key].rejects++
  }
  await storage.settings.patch({ [LEARNING_KEY]: learning })
  return learning
}

function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 3)
}
function titleOverlap(a, b) {
  const wa = normalizeTitle(a), wb = normalizeTitle(b)
  if (!wa.length || !wb.length) return 0
  const set = new Set(wb)
  const hits = wa.filter(w => set.has(w)).length
  return hits / Math.min(wa.length, wb.length)
}

// Find corroborating / duplicate stories in the DB
async function findRelated(item, sb) {
  const { data: all } = await sb.from('news_posts').select('id, title, source_name, published_at, status').neq('id', item.id).limit(200)
  const related = (all || []).map(r => ({ ...r, overlap: titleOverlap(item.title, r.title) })).filter(r => r.overlap >= 0.45)
  const sameStory = related.filter(r => r.overlap >= 0.6)
  const sources = [item.source_name, ...sameStory.map(r => r.source_name)].filter(Boolean)
  const unique = [...new Set(sources)]
  const authorityHits = unique.filter(s => AUTHORITY_SOURCES.some(a => String(s || '').toLowerCase().includes(a)))
  return {
    same_story_ids: sameStory.map(r => r.id),
    related_ids: related.map(r => r.id),
    related_count: related.length,
    sources: unique,
    authority_count: authorityHits.length,
  }
}

// AI editorial analysis with all v2.1 dimensions
export async function analyzeNewsItem(item, topics, learning = {}, sb = null) {
  const { storage: st } = await import('../storage')
  const providers = await st.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  const { callAi } = await import('../ai/providers')

  const title = (item.title || '').slice(0, 300)
  const summary = (item.summary || '').slice(0, 600)
  const topicList = topics.join(', ')
  const ageH = item.published_at ? Math.max(0, (Date.now() - new Date(item.published_at).getTime()) / 3600000) : null
  const ageNote = ageH != null ? `Article age: ${ageH.toFixed(1)} hours old.` : ''

  let corroboration = { related_count: 0, sources: [], authority_count: 0, same_story_ids: [] }
  if (sb) corroboration = await findRelated(item, sb).catch(() => corroboration)
  const learnHistory = Object.entries(learning).filter(([, v]) => (v.approves || 0) > 0)
  const totalApproved = learnHistory.reduce((a, [, v]) => a + (v.approves || 0), 0)
  const learningNote = learnHistory.slice(0, 6).map(([t, v]) => `${t}: ${v.approves} approves, ${v.rejects || 0} rejects`).join('; ')

  const prompt = `You are the AI Editorial Board of a business publication for a professional who posts about: ${topicList}.
${ageNote}

NEWS: "${title}"
${summary ? `SUMMARY: ${summary}\n` : ''}
Corroborating sources (${corroboration.sources.length}): ${corroboration.sources.join(', ') || 'none yet'}
${learningNote ? `USER HISTORY: ${learningNote}. ${totalApproved} total approvals.\n` : ''}

Respond with ONLY JSON:
{
  "opportunity_score": 0-100,
  "overall_relevance": 0-100,
  "mba_score": 0-100, "hr_score": 0-100, "business_analytics_score": 0-100,
  "marketing_score": 0-100, "technology_score": 0-100, "research_score": 0-100,
  "virality_score": 0-100, "seo_opportunity": 0-100, "authority_score": 0-100,
  "business_impact": 0-100, "audience_match": 0-100, "trend_score": 0-100,
  "confidence": 0-100,
  "lifecycle": "breaking|developing|trending|peak|declining|expired",
  "time_left_hours": 1-72,
  "peak_in_hours": 0-48,
  "priority": "critical|immediate|today|tomorrow|weekly|evergreen",
  "competition": "none|low|medium|high|saturated",
  "competition_note": "short explanation e.g. 'fresh angle, few posts yet'",
  "content_gap": "the angle NOBODY has covered yet (MBA/Leadership/HR/Business Analytics/Marketing/Career/Research)",
  "matched_topics": ["max 4"],
  "why_matters": "1-2 sentences", "why_now": "1 sentence", "why_audience_cares": "1 sentence",
  "business_implications": "1 sentence", "career_implications": "1 sentence",
  "leadership_lessons": "1 sentence", "marketing_lessons": "1 sentence", "research_opportunities": "1 sentence",
  "recommendations": {"linkedin": 0-100, "blog": 0-100, "newsletter": 0-100, "carousel": 0-100, "threads": 0-100, "instagram": 0-100},
  "recommendation_reason": "one sentence why the top channel is best",
  "trend_next_hours": 0-12, "trend_peak_hours": 0-72, "trend_decline_hours": 12-120,
  "estimated_reach": 1000-50000,
  "recommended_content": "one-line recommended format",
  "image_prompt": "text-to-image prompt",
  "angles": [
    {"angle": "MBA", "title": "suggested angle title", "why": "one sentence"},
    {"angle": "Leadership", "title": "...", "why": "..."},
    {"angle": "HR", "title": "...", "why": "..."},
    {"angle": "Business Analytics", "title": "...", "why": "..."},
    {"angle": "Marketing", "title": "...", "why": "..."},
    {"angle": "Career", "title": "...", "why": "..."},
    {"angle": "Research", "title": "...", "why": "..."}
  ],
  "editorial_board": {
    "news_editor": {"verdict": "relevant|not_relevant", "note": "1 sentence"},
    "mba_professor": {"verdict": "excellent_case_study|good|weak", "note": "1 sentence"},
    "seo_expert": {"verdict": "high_rank_potential|medium|low", "note": "1 sentence"},
    "social_strategist": {"verdict": "viral_hook|good_hook|weak", "note": "1 sentence"},
    "copywriter": {"verdict": "approved|needs_angle|rejected", "note": "1 sentence"}
  }
}`

  try {
    const raw = await Promise.race([
      callAi({ provider: textProvider, prompt, json: true, maxTokens: 2000, timeoutMs: 20000 }),
      new Promise(res => setTimeout(() => res(null), 22000)),
    ])
    if (!raw) return heuristicAnalysis(item, topics, corroboration, learning)
    const parsed = JSON.parse(String(raw).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim())
    const a = parsed
    const board = a.editorial_board || {}
    const majority = Object.values(board).filter(v => v?.verdict && !/not_relevant|weak|rejected|low/.test(v.verdict)).length
    return {
      opportunity_score: clamp(a.opportunity_score, 0, 100),
      overall_relevance: clamp(a.overall_relevance, 0, 100),
      mba_score: clamp(a.mba_score, 0, 100), hr_score: clamp(a.hr_score, 0, 100),
      business_analytics_score: clamp(a.business_analytics_score, 0, 100),
      marketing_score: clamp(a.marketing_score, 0, 100), technology_score: clamp(a.technology_score, 0, 100),
      research_score: clamp(a.research_score, 0, 100),
      virality_score: clamp(a.virality_score, 0, 100), seo_opportunity: clamp(a.seo_opportunity, 0, 100),
      authority_score: clamp(a.authority_score, 0, 100), business_impact: clamp(a.business_impact, 0, 100),
      audience_match: clamp(a.audience_match, 0, 100), trend_score: clamp(a.trend_score, 0, 100),
      confidence: clamp(a.confidence ?? 50, 0, 100),
      lifecycle: a.lifecycle || 'developing',
      time_left_hours: clamp(a.time_left_hours, 1, 72),
      peak_in_hours: clamp(a.peak_in_hours, 0, 48),
      priority: a.priority || 'today',
      competition: a.competition || 'low',
      competition_note: a.competition_note || '',
      content_gap: a.content_gap || '',
      matched_topics: (a.matched_topics || []).slice(0, 4),
      why_matters: a.why_matters || 'Relevant update.', why_now: a.why_now || '', why_audience_cares: a.why_audience_cares || '',
      business_implications: a.business_implications || '', career_implications: a.career_implications || '',
      leadership_lessons: a.leadership_lessons || '', marketing_lessons: a.marketing_lessons || '', research_opportunities: a.research_opportunities || '',
      recommendations: a.recommendations || {},
      recommendation_reason: a.recommendation_reason || '',
      trend_next_hours: clamp(a.trend_next_hours, 0, 12), trend_peak_hours: clamp(a.trend_peak_hours, 0, 72),
      trend_decline_hours: clamp(a.trend_decline_hours, 12, 120),
      estimated_reach: Math.round(a.estimated_reach || 5000),
      recommended_content: a.recommended_content || 'Thought leadership post',
      image_prompt: a.image_prompt || `Editorial visual for: ${title.slice(0, 80)}`,
      angles: Array.isArray(a.angles) ? a.angles.slice(0, 7) : [],
      editorial_board: board,
      board_majority: majority,
      corroboration,
      approved_similar: totalApproved,
      analysis_at: new Date().toISOString(),
    }
  } catch {
    return heuristicAnalysis(item, topics, corroboration, learning)
  }
}

function heuristicAnalysis(item, topics, corroboration = {}, learning = {}) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.category || ''}`.toLowerCase()
  const matched = topics.filter(t => text.includes(t.toLowerCase())).slice(0, 3)
  const base = matched.length > 0 ? 55 : 35
  const boost = item.is_trending ? 20 : item.is_urgent ? 15 : 0
  const opportunity = clamp(base + boost + ((text.length % 10) * 2), 0, 100)
  const ageH = item.published_at ? (Date.now() - new Date(item.published_at).getTime()) / 3600000 : 0
  const totalApproved = Object.values(learning).reduce((a, v) => a + (v.approves || 0), 0)
  return {
    opportunity_score: opportunity,
    overall_relevance: clamp(base + 10, 0, 100),
    mba_score: 45, hr_score: 45, business_analytics_score: 45, marketing_score: 45, technology_score: 45, research_score: 40,
    virality_score: clamp((item.is_trending ? 70 : 45) + (text.length % 15), 0, 100),
    seo_opportunity: 50, authority_score: 55, business_impact: 55, audience_match: clamp(base, 0, 100), trend_score: clamp(40 + boost, 0, 100),
    confidence: clamp(45 + (corroboration.authority_count || 0) * 12, 0, 100),
    lifecycle: ageH > 72 ? 'declining' : ageH > 48 ? 'peak' : ageH > 24 ? 'trending' : ageH > 6 ? 'developing' : 'breaking',
    time_left_hours: Math.max(1, Math.round(72 - ageH)),
    peak_in_hours: Math.max(0, Math.round(24 - ageH)),
    priority: opportunity >= 85 ? 'critical' : opportunity >= 70 ? 'today' : 'weekly',
    competition: (corroboration.sources?.length || 0) > 3 ? 'high' : (corroboration.sources?.length || 0) > 1 ? 'medium' : 'low',
    competition_note: 'Coverage is fresh — early opportunity.',
    content_gap: matched.length ? `Nobody covered the ${matched[0]} angle yet.` : 'General industry angle.',
    matched_topics: matched,
    why_matters: matched.length ? `Relates to your topics: ${matched.join(', ')}.` : 'Industry movement worth monitoring.',
    why_now: '', why_audience_cares: '', business_implications: '', career_implications: '',
    leadership_lessons: '', marketing_lessons: '', research_opportunities: '',
    recommendations: { linkedin: 70, blog: 60, newsletter: 40, carousel: 30, threads: 40 },
    recommendation_reason: 'LinkedIn is your strongest channel for thought leadership.',
    trend_next_hours: 4, trend_peak_hours: 24, trend_decline_hours: 48,
    estimated_reach: 3000 + opportunity * 60,
    recommended_content: 'Thought leadership post',
    image_prompt: `Editorial visual for: ${(item.title || '').slice(0, 80)}`,
    angles: matched.slice(0, 3).map((m, i) => ({ angle: m, title: `${m} perspective on ${(item.title || '').slice(0, 40)}`, why: 'High audience match.' })),
    editorial_board: {},
    board_majority: matched.length ? 3 : 1,
    corroboration,
    approved_similar: totalApproved,
    analysis_at: new Date().toISOString(),
  }
}

function clamp(v, a, b) { const n = Number(v); if (isNaN(n)) return a; return Math.max(a, Math.min(b, n)) }

export function priorityLabel(p) {
  return { critical: '🔴 Critical', immediate: '🚨 Immediate', today: '🟠 Today', tomorrow: '🟡 Tomorrow', weekly: '🟢 Weekly', evergreen: '🌲 Evergreen' }[p] || p
}

// Rich Telegram approval card (v2.1)
export async function buildNewsCard(item, analysis) {
  const stars = Math.round((analysis.opportunity_score / 100) * 5)
  const recs = Object.entries(analysis.recommendations || {}).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const lines = [
    `🚨 <b>AI Content Opportunity</b> — ${priorityLabel(analysis.priority)}`,
    ``,
    `${escapeHtml(item.title || 'Untitled')}`,
    `Source: ${escapeHtml(item.source_name || '—')} · ${item.published_at ? timeAgo(item.published_at) : ''}`,
    `━━━━━━━━━━━━━━`,
    `<b>Verification</b>`,
    `Confidence: <b>${analysis.confidence}%</b> ${analysis.confidence >= 75 ? '✔ Multi-source' : analysis.confidence >= 50 ? '🟡 Needs verification' : '🔴 Unverified'}`,
    `Sources: ${(analysis.corroboration?.sources || [item.source_name]).map(escapeHtml).join(', ') || 'single source'}`,
    ``,
    `<b>Why you received this</b>`,
    `Matches: ${analysis.matched_topics.map(escapeHtml).join(', ') || 'General interest'}`,
    ...(analysis.approved_similar > 0 ? [`You previously approved <b>${analysis.approved_similar}</b> similar stories.`] : []),
    ``,
    `<b>Editorial review</b>`,
    `• ${escapeHtml(analysis.why_matters || '')}`,
    ...(analysis.why_now ? [`• Now: ${escapeHtml(analysis.why_now)}`] : []),
    ...(analysis.why_audience_cares ? [`• Audience: ${escapeHtml(analysis.why_audience_cares)}`] : []),
    ...(analysis.content_gap ? [`<b>Content gap</b>: ${escapeHtml(analysis.content_gap)}`] : []),
    ...(analysis.competition_note ? [`Competition: ${escapeHtml(analysis.competition)} — ${escapeHtml(analysis.competition_note)}`] : []),
    ``,
    `<b>Scoring</b>`,
    `Opportunity: <b>${analysis.opportunity_score}/100</b> ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
    `MBA: ${analysis.mba_score} · HR: ${analysis.hr_score} · BA: ${analysis.business_analytics_score} · Mkt: ${analysis.marketing_score} · Tech: ${analysis.technology_score}`,
    `Virality: ${analysis.virality_score} · SEO: ${analysis.seo_opportunity} · Authority: ${analysis.authority_score} · Trend: ${analysis.trend_score}`,
    `Lifecycle: <b>${analysis.lifecycle}</b> · Peak in ~${analysis.peak_in_hours}h · Opportunity window: ${analysis.time_left_hours}h`,
    `Reach: <b>${(analysis.estimated_reach / 1000).toFixed(1)}K</b>`,
    ``,
    `<b>Recommendation</b>`,
    ...(recs.map(([p, v]) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}: <b>${v}%</b>`)),
    ...(analysis.recommendation_reason ? [`Reason: ${escapeHtml(analysis.recommendation_reason)}`] : []),
    ``,
    ...(analysis.editorial_board ? Object.entries(analysis.editorial_board).map(([role, v]) => {
      const mark = v?.verdict && /not_relevant|weak|rejected|low/.test(v.verdict) ? '✖' : '✔'
      return `${mark} ${role.replace(/_/g, ' ')}: ${escapeHtml(v?.verdict || '')}`
    }) : []),
    ...(Object.keys(analysis.editorial_board || {}).length ? [`<b>Editorial board</b>: ${analysis.board_majority}/${Object.keys(analysis.editorial_board || {}).length} specialists approve`] : []),
  ]
  const kb = {
    inline_keyboard: [
      [{ text: '📘 LinkedIn', callback_data: `nwgl:${item.id}` }, { text: '📝 Blog', callback_data: `nwbl:${item.id}` }, { text: '🎬 All', callback_data: `nwga:${item.id}` }],
      [{ text: '🎭 Multi-angle', callback_data: `nwagn:${item.id}` }, { text: '📅 Schedule', callback_data: `nwsch:${item.id}` }, { text: '🔖 Save', callback_data: `nwsav:${item.id}` }],
      [{ text: '🔗 Read', callback_data: `nwrd:${item.id}` }, { text: '🔄 Regenerate', callback_data: `nwrgn:${item.id}` }, { text: '❌ Ignore', callback_data: `nwign:${item.id}` }],
    ],
  }
  return { text: lines.join('\n'), kb }
}

// Main pipeline: analyze → verify → merge duplicates → decide → notify
export async function runNewsDecisionPipeline(limit = 6) {
  const { supabase } = await import('../supabase')
  const sb = supabase()
  const topics = await getNewsTopics()
  const learning = await getLearning()
  const settings = await storage.settings.get()

  const { data: items } = await sb.from('news_posts').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(limit)
  if (!items || items.length === 0) return { analyzed: 0, notified: 0, ignored: 0, merged: 0 }

  const results = await Promise.allSettled(items.map(async (item) => {
    const analysis = await analyzeNewsItem(item, topics, learning, sb)
    return { item, analysis }
  }))

  let notified = 0, ignored = 0, merged = 0
  const processedIds = new Set()
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { item, analysis } = r.value
    if (processedIds.has(item.id)) continue
    // Merge duplicates: mark same-story items as duplicate_of this one
    const sameIds = analysis.corroboration?.same_story_ids || []
    if (sameIds.length > 0) {
      for (const dupId of sameIds) {
        if (dupId === item.id || processedIds.has(dupId)) continue
        await sb.from('news_posts').update({ status: 'duplicate', duplicate_of: item.id }).eq('id', dupId)
        processedIds.add(dupId)
        merged++
      }
    }
    await sb.from('news_posts').update({ ai_analysis: analysis }).eq('id', item.id)
    processedIds.add(item.id)

    const score = analysis.opportunity_score
    if (score >= 70) {
      await sb.from('news_posts').update({ status: 'pending_approval', priority: analysis.priority }).eq('id', item.id)
      if (settings.telegram_admin_chat_id) {
        const { text, kb } = await buildNewsCard(item, analysis)
        await sendMessage({ chatId: settings.telegram_admin_chat_id, text, replyMarkup: kb }).catch(() => {})
      }
      try { emitEvent({ type: score >= 85 ? 'breaking_news' : 'industry_news', source: 'news_ai', platform: item.category, payload: { id: item.id, title: item.title, opportunity: score, confidence: analysis.confidence } }).catch(() => {}) } catch {}
      notified++
    } else {
      await sb.from('news_posts').update({ status: 'ignored_by_ai', ai_ignored_reason: `opportunity ${score}/100 below 70` }).eq('id', item.id)
      ignored++
    }
  }
  return { analyzed: items.length, notified, ignored, merged }
}

// Morning / evening editorial briefs
export async function sendEditorialBrief(type = 'morning') {
  const { supabase } = await import('../supabase')
  const sb = supabase()
  const settings = await storage.settings.get()
  if (!settings.telegram_admin_chat_id) return { sent: false, reason: 'no telegram chat' }
  const today = new Date().toDateString()
  const { data: all } = await sb.from('news_posts').select('*').limit(500)
  const posts = all || []
  const todays = posts.filter(p => new Date(p.created_at || 0).toDateString() === today)
  const pending = posts.filter(p => p.status === 'pending_approval').length
  const published = todays.filter(p => p.status === 'published').length
  const ignored = todays.filter(p => p.status === 'ignored_by_ai').length
  const high = posts.filter(p => p.ai_analysis?.opportunity_score >= 85 && p.status === 'pending_approval').length
  const best = [...posts].sort((a, b) => (b.ai_analysis?.opportunity_score || 0) - (a.ai_analysis?.opportunity_score || 0))[0]

  const lines = type === 'morning'
    ? [
        `🌅 <b>Good Morning — Editorial Brief</b>`,
        ``,
        `Today's opportunities: <b>${todays.length}</b>`,
        `• Breaking / high priority: <b>${high}</b>`,
        `• Pending approval: <b>${pending}</b>`,
        `• Published: <b>${published}</b>`,
        `• AI ignored: <b>${ignored}</b>`,
        ...(best ? [``, `Best story: ${escapeHtml((best.title || '').slice(0, 80))} — AI ${best.ai_analysis?.opportunity_score || 0}/100`] : []),
      ]
    : [
        `🌙 <b>Evening Performance Brief</b>`,
        ``,
        `News scanned today: <b>${todays.length}</b>`,
        `• Approved: <b>${pending}</b>`,
        `• Ignored: <b>${ignored}</b>`,
        `• Published: <b>${published}</b>`,
        ``,
        `Tomorrow: ${pending} opportunity(ies) in your approval queue.`,
      ]
  const kb = { inline_keyboard: [[{ text: '📋 Review Queue', callback_data: 'nwq' }]] }
  await sendMessage({ chatId: settings.telegram_admin_chat_id, text: lines.join('\n'), replyMarkup: kb }).catch(() => {})
  return { sent: true, type }
}

function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour(s) ago`
  return `${Math.floor(hrs / 24)} day(s) ago`
}
