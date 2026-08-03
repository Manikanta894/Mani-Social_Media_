// ============================================================================
// AI News Decision Engine — analyzes news BEFORE notifying.
// Pipeline: monitor → topic match → AI intelligence → decision → rich approval
// ============================================================================

import { storage } from '../storage'
import { sendMessage } from '../telegram/client'
import { emitEvent } from '../event-engine'

const DEFAULT_TOPICS = ['Artificial Intelligence', 'Machine Learning', 'Business Analytics', 'Human Resources', 'People Analytics', 'MBA', 'Leadership', 'Productivity', 'Technology', 'Marketing', 'Finance', 'Data Analytics', 'Career', 'Research', 'Education', 'Retail']
const TOPICS_KEY = 'news_topics'
const LEARNING_KEY = 'news_learning'

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

// Semantic AI analysis with heuristic fallback
export async function analyzeNewsItem(item, topics, learning = {}) {
  const { storage: st } = await import('../storage')
  const providers = await st.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  const { callAi } = await import('../ai/providers')

  const title = (item.title || '').slice(0, 300)
  const summary = (item.summary || '').slice(0, 600)
  const topicList = topics.join(', ')
  const learningNote = Object.entries(learning).filter(([, v]) => (v.approves || 0) + (v.rejects || 0) > 0)
    .map(([t, v]) => `${t}: ${v.approves} approvals, ${v.rejects} rejects`).slice(0, 8).join('; ')

  const prompt = `You are the AI Editor-in-Chief for a business professional who posts about: ${topicList}.

NEWS: "${title}"
${summary ? `SUMMARY: ${summary}\n` : ''}
${learningNote ? `USER HISTORY: ${learningNote} — favor topics they approve, avoid topics they reject.\n` : ''}

Perform a full editorial review and respond with ONLY JSON:
{
  "opportunity_score": 0-100,
  "overall_relevance": 0-100,
  "mba_score": 0-100,
  "hr_score": 0-100,
  "business_analytics_score": 0-100,
  "marketing_score": 0-100,
  "technology_score": 0-100,
  "research_score": 0-100,
  "virality_score": 0-100,
  "seo_opportunity": 0-100,
  "authority_score": 0-100,
  "business_impact": 0-100,
  "audience_match": 0-100,
  "trend_score": 0-100,
  "matched_topics": ["max 4"],
  "why_matters": "1-2 sentences why this matters",
  "why_now": "1 sentence why now",
  "why_audience_cares": "1 sentence why the audience should care",
  "business_implications": "1 sentence",
  "career_implications": "1 sentence",
  "leadership_lessons": "1 sentence",
  "marketing_lessons": "1 sentence",
  "research_opportunities": "1 sentence",
  "recommendations": ["linkedin", "blog", "newsletter", "carousel", "threads", "facebook", "instagram", "twitter"],
  "suggested_platforms": ["linkedin", "instagram", "facebook", "threads", "blog", "newsletter", "twitter"],
  "estimated_reach": 1000-50000,
  "recommended_content": "one-line recommended content format",
  "image_prompt": "text-to-image prompt for a visual to accompany the post"
}`

  try {
    const raw = await Promise.race([
      callAi({ provider: textProvider, prompt, json: true, maxTokens: 800, timeoutMs: 15000 }),
      new Promise(res => setTimeout(() => res(null), 16000)),
    ])
    if (!raw) return heuristicAnalysis(item, topics)
    const parsed = JSON.parse(String(raw).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim())
    return {
      opportunity_score: clamp(parsed.opportunity_score, 0, 100),
      overall_relevance: clamp(parsed.overall_relevance ?? parsed.relevance_score, 0, 100),
      mba_score: clamp(parsed.mba_score, 0, 100),
      hr_score: clamp(parsed.hr_score, 0, 100),
      business_analytics_score: clamp(parsed.business_analytics_score, 0, 100),
      marketing_score: clamp(parsed.marketing_score, 0, 100),
      technology_score: clamp(parsed.technology_score, 0, 100),
      research_score: clamp(parsed.research_score, 0, 100),
      virality_score: clamp(parsed.virality_score, 0, 100),
      seo_opportunity: clamp(parsed.seo_opportunity, 0, 100),
      authority_score: clamp(parsed.authority_score, 0, 100),
      business_impact: clamp(parsed.business_impact, 0, 100),
      audience_match: clamp(parsed.audience_match, 0, 100),
      trend_score: clamp(parsed.trend_score, 0, 100),
      matched_topics: (parsed.matched_topics || []).slice(0, 4),
      why_matters: parsed.why_matters || 'Relevant update for your professional audience.',
      why_now: parsed.why_now || 'Timely given current industry momentum.',
      why_audience_cares: parsed.why_audience_cares || 'It directly affects your professional field.',
      business_implications: parsed.business_implications || '',
      career_implications: parsed.career_implications || '',
      leadership_lessons: parsed.leadership_lessons || '',
      marketing_lessons: parsed.marketing_lessons || '',
      research_opportunities: parsed.research_opportunities || '',
      recommendations: (parsed.recommendations || []).slice(0, 8),
      suggested_platforms: (parsed.suggested_platforms || ['linkedin', 'blog']).slice(0, 6),
      estimated_reach: Math.round(parsed.estimated_reach || 5000),
      recommended_content: parsed.recommended_content || 'Thought leadership post',
      image_prompt: parsed.image_prompt || `Editorial visual for: ${title.slice(0, 80)}`,
    }
  } catch {
    return heuristicAnalysis(item, topics)
  }
}

function heuristicAnalysis(item, topics) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.category || ''}`.toLowerCase()
  const matched = topics.filter(t => text.includes(t.toLowerCase())).slice(0, 3)
  const base = matched.length > 0 ? 55 : 35
  const boost = item.is_trending ? 20 : item.is_urgent ? 15 : 0
  const opportunity = clamp(base + boost + ((text.length % 10) * 2), 0, 100)
  return {
    opportunity_score: opportunity,
    overall_relevance: clamp(base + 10, 0, 100),
    mba_score: 45, hr_score: 45, business_analytics_score: 45, marketing_score: 45, technology_score: 45, research_score: 40,
    virality_score: clamp((item.is_trending ? 70 : 45) + (text.length % 15), 0, 100),
    seo_opportunity: 50, authority_score: 55, business_impact: 55, audience_match: clamp(base, 0, 100), trend_score: clamp(40 + boost, 0, 100),
    matched_topics: matched,
    why_matters: matched.length ? `Relates to your topics: ${matched.join(', ')}.` : 'Industry movement worth monitoring.',
    why_now: 'Timely given current industry momentum.',
    why_audience_cares: 'It directly affects your professional field.',
    business_implications: '', career_implications: '', leadership_lessons: '', marketing_lessons: '', research_opportunities: '',
    recommendations: ['linkedin', 'blog'],
    suggested_platforms: ['linkedin', 'blog'],
    estimated_reach: 3000 + opportunity * 60,
    recommended_content: 'Thought leadership post',
    image_prompt: `Editorial visual for: ${(item.title || '').slice(0, 80)}`,
  }
}

function clamp(v, a, b) { const n = Number(v); if (isNaN(n)) return a; return Math.max(a, Math.min(b, n)) }

// Rich Telegram approval card
export async function buildNewsCard(item, analysis) {
  const stars = Math.round((analysis.opportunity_score / 100) * 5)
  const priority = analysis.opportunity_score >= 85 ? '🔴 HIGH PRIORITY' : '🟡 Approval needed'
  const lines = [
    `🚨 <b>AI Content Opportunity</b> — ${priority}`,
    ``,
    `${escapeHtml(item.title || 'Untitled')}`,
    `Source: ${escapeHtml(item.source_name || '—')} · ${item.published_at ? timeAgo(item.published_at) : ''}`,
    `━━━━━━━━━━━━━━`,
    `<b>Why this matters</b>`,
    `${escapeHtml(analysis.why_matters || '')}`,
    `<b>Why now</b>: ${escapeHtml(analysis.why_now || '')}`,
    `<b>Why your audience cares</b>: ${escapeHtml(analysis.why_audience_cares || '')}`,
    ``,
    `<b>Matched topics</b>: ${analysis.matched_topics.map(escapeHtml).join(', ') || 'General interest'}`,
    ``,
    `<b>Scoring</b>`,
    `Opportunity: <b>${analysis.opportunity_score}/100</b> · Relevance: ${analysis.overall_relevance || analysis.relevance_score}`,
    `MBA: ${analysis.mba_score} · HR: ${analysis.hr_score} · BA: ${analysis.business_analytics_score} · Mkt: ${analysis.marketing_score}`,
    `Virality: ${analysis.virality_score} · SEO: ${analysis.seo_opportunity} · Trend: ${analysis.trend_score} · Reach: <b>${(analysis.estimated_reach / 1000).toFixed(1)}K</b>`,
    `Business impact: ${analysis.business_impact} · Audience match: ${analysis.audience_match}`,
    ``,
    `<b>Editorial notes</b>`,
    ...(analysis.business_implications ? [`• Biz: ${escapeHtml(analysis.business_implications)}`] : []),
    ...(analysis.career_implications ? [`• Career: ${escapeHtml(analysis.career_implications)}`] : []),
    ...(analysis.leadership_lessons ? [`• Leadership: ${escapeHtml(analysis.leadership_lessons)}`] : []),
    ...(analysis.marketing_lessons ? [`• Marketing: ${escapeHtml(analysis.marketing_lessons)}`] : []),
    ...(analysis.research_opportunities ? [`• Research: ${escapeHtml(analysis.research_opportunities)}`] : []),
    ``,
    `<b>Recommended content</b>: ${escapeHtml(analysis.recommended_content || '')}`,
    `Channels: ${(analysis.recommendations || analysis.suggested_platforms || []).map(p => '✓ ' + p.charAt(0).toUpperCase() + p.slice(1)).join(' ')}`,
  ]
  const kb = {
    inline_keyboard: [
      [{ text: '📘 Generate LinkedIn', callback_data: `nwgl:${item.id}` }, { text: '📝 Generate Blog', callback_data: `nwbl:${item.id}` }, { text: '🎬 Generate All', callback_data: `nwga:${item.id}` }],
      [{ text: '📅 Schedule', callback_data: `nwsch:${item.id}` }, { text: '🔖 Save', callback_data: `nwsav:${item.id}` }, { text: '🔗 Read Article', callback_data: `nwrd:${item.id}` }],
      [{ text: '🔄 Regenerate', callback_data: `nwrgn:${item.id}` }, { text: '❌ Ignore', callback_data: `nwign:${item.id}` }],
    ],
  }
  return { text: lines.join('\n'), kb }
}

// Main pipeline: analyze new items → decision → notify high-value only
export async function runNewsDecisionPipeline(limit = 6) {
  const { supabase } = await import('../supabase')
  const sb = supabase()
  const topics = await getNewsTopics()
  const learning = await getLearning()
  const settings = await storage.settings.get()

  const { data: items } = await sb.from('news_posts').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(limit)
  if (!items || items.length === 0) return { analyzed: 0, notified: 0, ignored: 0 }

  const results = await Promise.allSettled(items.map(async (item) => {
    const analysis = await analyzeNewsItem(item, topics, learning)
    await sb.from('news_posts').update({ ai_analysis: analysis }).eq('id', item.id)
    return { item, analysis }
  }))

  let notified = 0, ignored = 0
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { item, analysis } = r.value
    const score = analysis.opportunity_score
    if (score >= 70) {
      const status = score >= 85 ? 'pending_approval' : 'pending_approval'
      await sb.from('news_posts').update({ status, priority: score >= 85 ? 'high' : 'medium' }).eq('id', item.id)
      if (settings.telegram_admin_chat_id) {
        const { text, kb } = await buildNewsCard(item, analysis)
        await sendMessage({ chatId: settings.telegram_admin_chat_id, text, replyMarkup: kb }).catch(() => {})
      }
      try { emitEvent({ type: score >= 85 ? 'breaking_news' : 'industry_news', source: 'news_ai', platform: item.category, payload: { id: item.id, title: item.title, opportunity: score }, notify: false }).catch(() => {}) } catch {}
      notified++
    } else {
      await sb.from('news_posts').update({ status: 'ignored_by_ai', ai_ignored_reason: `opportunity ${score}/100 below 70` }).eq('id', item.id)
      ignored++
    }
  }
  return { analyzed: items.length, notified, ignored }
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
