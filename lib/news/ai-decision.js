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

  const prompt = `You are an AI content strategist for a business professional who posts about: ${topicList}.

NEWS: "${title}"
${summary ? `SUMMARY: ${summary}\n` : ''}
${learningNote ? `USER HISTORY: ${learningNote} — favor topics they approve, avoid topics they reject.\n` : ''}

Analyze whether this news is a good content opportunity for their audience. Respond with ONLY JSON:
{
  "opportunity_score": 0-100,
  "relevance_score": 0-100,
  "virality_score": 0-100,
  "business_impact": 0-10,
  "learning_value": 0-10,
  "content_potential": 0-10,
  "matched_topics": ["topics it relates to, max 4"],
  "why_it_matters": "2-3 sentences: why this matters and how it aligns with the user's expertise",
  "suggested_platforms": ["linkedin", "instagram", "facebook", "threads", "blog", "newsletter", "twitter"],
  "estimated_reach": 1000-50000,
  "recommended_content": "one-line recommended content format"
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
      relevance_score: clamp(parsed.relevance_score, 0, 100),
      virality_score: clamp(parsed.virality_score, 0, 100),
      business_impact: clamp(parsed.business_impact, 0, 10),
      learning_value: clamp(parsed.learning_value, 0, 10),
      content_potential: clamp(parsed.content_potential, 0, 10),
      matched_topics: (parsed.matched_topics || []).slice(0, 4),
      why_it_matters: parsed.why_it_matters || 'Relevant update for your professional audience.',
      suggested_platforms: (parsed.suggested_platforms || ['linkedin', 'blog']).slice(0, 5),
      estimated_reach: Math.round(parsed.estimated_reach || 5000),
      recommended_content: parsed.recommended_content || 'Thought leadership post',
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
    relevance_score: clamp(base + 10, 0, 100),
    virality_score: clamp((item.is_trending ? 70 : 45) + (text.length % 15), 0, 100),
    business_impact: 6, learning_value: 6, content_potential: 6,
    matched_topics: matched,
    why_it_matters: matched.length ? `Relates to your topics: ${matched.join(', ')}.` : 'Industry movement worth monitoring.',
    suggested_platforms: ['linkedin', 'blog'],
    estimated_reach: 3000 + opportunity * 60,
    recommended_content: 'Thought leadership post',
  }
}

function clamp(v, a, b) { const n = Number(v); if (isNaN(n)) return a; return Math.max(a, Math.min(b, n)) }

// Rich Telegram approval card
export async function buildNewsCard(item, analysis) {
  const stars = Math.round((analysis.opportunity_score / 100) * 5)
  const priority = analysis.opportunity_score >= 85 ? '🔴 HIGH PRIORITY' : '🟡 Approval needed'
  const lines = [
    `📰 <b>AI News Opportunity</b> — ${priority}`,
    ``,
    `${escapeHtml(item.title || 'Untitled')}`,
    `━━━━━━━━━━━━━━`,
    `<b>Why you received this</b>`,
    `✓ Matches your topics: ${analysis.matched_topics.map(escapeHtml).join(', ') || 'General interest'}`,
    ``,
    `<b>Why it matters</b>`,
    `${escapeHtml(analysis.why_it_matters || '')}`,
    ``,
    `<b>Content Opportunity</b>`,
    `${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
    `Estimated reach: <b>${(analysis.estimated_reach / 1000).toFixed(1)}K</b> · Engagement: ${analysis.opportunity_score >= 85 ? 'High' : 'Good'}`,
    `Opportunity: <b>${analysis.opportunity_score}/100</b> · Relevance: ${analysis.relevance_score} · Virality: ${analysis.virality_score}`,
    ``,
    `<b>Suggested platforms</b>`,
    `${analysis.suggested_platforms.map(p => `✓ ${p.charAt(0).toUpperCase() + p.slice(1)}`).join('\n')}`,
    ``,
    `<b>Recommended content</b>: ${escapeHtml(analysis.recommended_content || '')}`,
    ``,
    `Source: ${escapeHtml(item.source_name || '—')} · ${item.published_at ? timeAgo(item.published_at) : ''}`,
  ]
  const kb = {
    inline_keyboard: [
      [{ text: '✅ Generate Content', callback_data: `nwgn:${item.id}` }, { text: '📝 Generate Blog', callback_data: `nwbl:${item.id}` }],
      [{ text: '📷 Carousel', callback_data: `nwgn:${item.id}` }, { text: '📅 Schedule', callback_data: `nwsch:${item.id}` }],
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
