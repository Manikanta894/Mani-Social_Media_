import { tableList, tableInsert, tableUpdate, tableGet } from './table'
import { storage } from './storage'
import { callAi } from './ai/providers'

const DEFAULT_TOPICS = ['AI in Business', 'HR Analytics', 'Future of Work', 'Leadership', 'People Analytics']
const GENERIC_PHRASES = ['great post', 'thanks for sharing', 'love this', 'nice post', 'well said', 'totally agree', 'great insights', 'amazing post', 'good read', 'very informative', 'spot on', 'perfectly said']

const SEEN_KEY = 'linkedin_intel_seen'
const TOPICS_KEY = 'linkedin_intel_topics'

async function getTopics() {
  const t = await storage.appState.get(TOPICS_KEY, null)
  return Array.isArray(t) && t.length ? t : DEFAULT_TOPICS
}

async function getSeen() {
  const s = await storage.appState.get(SEEN_KEY, null)
  return Array.isArray(s) ? s : []
}

async function markSeen(url) {
  const seen = (await getSeen()).slice(-200)
  if (!seen.includes(url)) seen.push(url)
  await storage.appState.set(SEEN_KEY, seen)
}

async function getStyleGuide() {
  try {
    const voices = await tableList('brandVoice')
    const active = voices.find(v => v.is_active === true) || voices[0]
    if (active?.style_guide) return { tone: active.tone, guide: active.style_guide, examples: active.examples }
  } catch {}
  return { tone: 'professional but approachable', guide: 'Short, specific, adds one real insight. Asks a sharp question. No buzzwords. No generic praise.', examples: '' }
}

function scorePost(title, summary, topic) {
  const text = `${title} ${summary || ''}`.toLowerCase()
  let relevance = 0
  for (const kw of topic.toLowerCase().split(/\s+/)) if (kw.length > 2 && text.includes(kw)) relevance += 1
  const engagement = Math.min(99, 45 + (title.length > 60 ? 10 : 0) + (/\?|!/.test(title) ? 15 : 0) + (/\d/.test(title) ? 8 : 0) + (/how|why|lesson|learn|story|mistake|trend|future|breakthrough|surge/.test(title.toLowerCase()) ? 12 : 0))
  const match = topic.toLowerCase().split(/\s+/).filter(kw => kw.length > 2 && text.includes(kw)).length > 0
  return { relevance: Math.min(100, 40 + relevance * 15), engagement, match }
}

export async function checkOpportunities({ limit = 5 } = {}) {
  const topics = await getTopics()
  const seen = await getSeen()
  const results = []
  for (const topic of topics.slice(0, 3)) {
    try {
      const q = encodeURIComponent(`site:linkedin.com ${topic}`)
      const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`, { signal: AbortSignal.timeout(12000) })
      const text = await res.text()
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items.slice(0, 6)) {
        const title = (item.match(/<title>(.*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const url = (item.match(/<link>(.*?)<\/link>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const summary = (item.match(/<description>(.*?)<\/description>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 300)
        if (!title || !url || seen.includes(url) || results.some(r => r.url === url)) continue
        const score = scorePost(title, summary, topic)
        if (!score.match) continue
        const ageMinutes = pubDate ? Math.max(1, Math.round((Date.now() - new Date(pubDate).getTime()) / 60000)) : 60
        const opportunity = Math.min(99, Math.round(score.relevance * 0.5 + score.engagement * 0.5))
        results.push({ title, url, summary, topic, author: '', post_age_minutes: ageMinutes, relevance: score.relevance, engagement: score.engagement, opportunity })
        await markSeen(url)
      }
    } catch (e) { console.warn('[linkedin-intel] feed failed:', topic, e.message) }
  }
  const saved = []
  for (const r of results.slice(0, limit)) {
    const item = await generateComment(r)
    saved.push(await tableInsert('linkedinIntel', {
      title: r.title, url: r.url, summary: r.summary, topic: r.topic, author: r.author || '',
      post_age_minutes: r.post_age_minutes, relevance: r.relevance, engagement: r.engagement,
      opportunity: r.opportunity, why: item.why, comment: item.comment, quality: item.quality,
      visibility: item.visibility, status: 'pending', created_at: new Date().toISOString(),
    }))
  }
  return { found: results.length, saved: saved.length, items: saved }
}

export async function generateComment(post) {
  const style = await getStyleGuide()
  const topic = post.topic || 'business'
  try {
    const providers = await storage.providers.list()
    const tp = providers.find(p => p.active_for_text)
    if (tp) {
      const learning = await getLearningExamples()
      const prompt = `Write a professional LinkedIn comment on this post.

Post title: ${post.title || ''}
Post summary: ${(post.summary || '').slice(0, 400)}
Topic: ${topic}

Writing style: ${style.tone}. ${style.guide}
${style.examples ? `Example of my style:\n${String(style.examples).slice(0, 500)}` : ''}
${learning ? `Comments I previously approved (match this voice):\n${learning.slice(0, 600)}` : ''}

Rules:
- Adds one specific, non-generic insight or a sharp question
- Ties the topic to business/analytics/leadership value
- 40-90 words, no emojis, no hashtags
- NEVER use: great post, thanks for sharing, love this, nice post, well said, totally agree

Return JSON only: {"comment":"...","why":"why this comment adds value","quality":85,"visibility":"high|medium"}`
      const raw = await callAi({ provider: tp, prompt, json: true, maxTokens: 500, timeoutMs: 20000 })
      const parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim())
      const comment = String(parsed.comment || '').trim()
      if (comment && !isGeneric(comment)) {
        return { comment, why: String(parsed.why || ''), quality: Number(parsed.quality) || 80, visibility: String(parsed.visibility || 'medium') }
      }
    }
  } catch (e) { console.warn('[linkedin-intel] AI comment failed:', e.message) }
  return fallbackComment(post, topic, style)
}

function isGeneric(comment) {
  const c = comment.toLowerCase()
  return GENERIC_PHRASES.some(p => c.includes(p))
}

function fallbackComment(post, topic, style) {
  const t = (post.title || '').replace(/[.!?]+$/, '').slice(0, 90)
  const angle = topic.toLowerCase()
  let insight = 'the real advantage comes from turning signals into decisions others miss'
  if (angle.includes('hr') || angle.includes('people')) insight = 'teams that build data literacy around people decisions will consistently out-execute the rest'
  if (angle.includes('leadership')) insight = 'leaders who ask better questions about the data will pull ahead of those who just follow the dashboard'
  const comment = `The sharpest takeaway here is that ${insight}. Curious how you'd weigh speed of execution against getting the data infrastructure right first — that trade-off decides most outcomes.`
  return {
    comment,
    why: `Adds a specific ${topic.toLowerCase()} insight and asks a decision-oriented question — stands out from generic praise`,
    quality: 88,
    visibility: 'high',
  }
}

async function getLearningExamples() {
  try {
    const rows = await tableList('linkedinIntelLearning')
    return rows.filter(r => r.decision === 'approved' || r.decision === 'edited').sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).slice(0, 3).map(r => r.comment).filter(Boolean).join('\n---\n')
  } catch { return '' }
}

export async function listOpportunities(status = null) {
  const rows = await tableList('linkedinIntel')
  if (!status) return rows
  return rows.filter(r => r.status === status)
}

export async function recordDecision(id, action, { editedComment = null } = {}) {
  const row = await tableGet('linkedinIntel', id)
  if (!row) throw new Error('Opportunity not found')
  const comment = editedComment || row.comment
  const patch = { status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'save' ? 'saved' : row.status, updated_at: new Date().toISOString() }
  if (editedComment) patch.comment = editedComment
  await tableUpdate('linkedinIntel', id, patch)
  await tableInsert('linkedinIntelLearning', { comment, decision: editedComment ? 'edited' : action === 'approve' ? 'approved' : 'rejected', topic: row.topic || '', created_at: new Date().toISOString() }).catch(() => {})
  return { ...row, ...patch }
}

export async function postComment(id) {
  const row = await tableGet('linkedinIntel', id)
  if (!row) throw new Error('Opportunity not found')
  if (row.status !== 'approved') throw new Error('Comment must be approved before posting')
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (!token) return { ok: false, error: 'LINKEDIN_ACCESS_TOKEN not configured', posted: false }
  const urn = extractUrn(row.url)
  if (!urn) return { ok: false, posted: false, url_needed: true, comment: row.comment, error: 'Post URN not resolvable from URL — open the post and paste the comment manually' }
  const actor = process.env.LINKEDIN_URN
  const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(urn)}/comments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify({ actor, message: { text: row.comment } }),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`LinkedIn comment ${res.status}: ${raw.slice(0, 300)}`)
  await tableUpdate('linkedinIntel', id, { status: 'commented', commented_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  return { ok: true, posted: true, url: row.url, comment: row.comment }
}

function extractUrn(url) {
  const m = String(url || '').match(/urn:li:activity:\d+/)
  return m ? m[0] : null
}

export async function addManualOpportunity({ url, title, author = '', summary = '', topic = '' }) {
  if (!url) throw new Error('URL required')
  const t = topic || (await getTopics())[0]
  const item = await generateComment({ title: title || url, summary, topic: t, url })
  const row = await tableInsert('linkedinIntel', {
    title: title || url, url, summary: summary || '', topic: t, author: author || '',
    post_age_minutes: 1, relevance: 70, engagement: 70, opportunity: 75,
    why: item.why, comment: item.comment, quality: item.quality, visibility: item.visibility,
    status: 'pending', created_at: new Date().toISOString(),
  })
  await markSeen(url)
  return row
}
