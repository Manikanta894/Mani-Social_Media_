// ============================================================================
// LinkedIn Engagement Intelligence Engine — HUMAN-LIKE by design.
//
// Pipeline per opportunity:
//   1. Deep post analysis (author/industry/intent/argument/tone/question/CTA/
//      audience/pain point/takeaway) — never from title alone
//   2. Classification into 17 domains
//   3. 12-dimension scoring; only Overall > 80 AND Spam Risk < 10% survive
//   4. Random strategy rotation (20 strategies, never repeated consecutively)
//   5. Human comment generation (80-220 words, no generic openers)
//   6. Memory: similarity check vs last 500 comments (>25% => regenerate)
//   7. Discord review card → approve → post → verify → record → learn
// ============================================================================

import { tableList, tableInsert, tableUpdate, tableGet } from './table'
import { storage } from './storage'
import { callAi, pickTextProvider } from './ai/providers'

const DEFAULT_TOPICS = ['AI in Business', 'HR Analytics', 'Future of Work', 'Leadership', 'People Analytics', 'Data Analytics', 'Startups', 'Marketing Strategy']
const SEEN_KEY = 'linkedin_intel_seen'
const TOPICS_KEY = 'linkedin_intel_topics'
const STRATEGY_KEY = 'linkedin_intel_last_strategies'

const GENERIC_PHRASES = ['great post', 'thanks for sharing', 'love this', 'nice post', 'well said', 'totally agree', 'great insights', 'amazing post', 'good read', 'very informative', 'spot on', 'perfectly said', 'great content', 'excellent post', 'interesting post', 'valuable insights', 'agree with you']

export const CLASSIFICATIONS = ['AI', 'Business Analytics', 'Leadership', 'HR', 'Marketing', 'Career', 'MBA', 'Productivity', 'Startup', 'Finance', 'Operations', 'Technology', 'Research', 'Innovation', 'Economy', 'Data', 'Personal Branding', 'Entrepreneurship']

export const STRATEGIES = [
  'Expand the idea', 'Offer another perspective', 'Share personal experience',
  'MBA perspective', 'Business Analytics perspective', 'Leadership perspective',
  'HR perspective', 'Marketing perspective', 'Data-driven opinion',
  'Constructive disagreement', 'Ask an intelligent question', 'Future prediction',
  'Connect with another trend', 'Give practical advice', 'Provide framework',
  'Tell mini story', 'Challenge respectfully', 'Summarize insight',
  'Industry comparison', 'Real-world example', 'Research insight',
]

const STRATEGY_OPENERS = {
  'Expand the idea': ['One thing that stands out here is', 'The bigger implication is', 'This goes one step further:'],
  'Offer another perspective': ['An interesting angle here is', 'I see this differently', 'From where I sit,'],
  'Share personal experience': ['I have seen this play out firsthand', 'Something similar happened to me', 'I remember when'],
  'MBA perspective': ['Looking at this through a business-school lens', 'The strategic framing here is', 'From a strategy standpoint,'],
  'Business Analytics perspective': ['Looking at this through a business lens', 'The data tells a slightly different story', 'If you break this down by the numbers,'],
  'Leadership perspective': ['As someone who leads a team,', 'The leadership angle that stands out', 'Leaders often miss that'],
  'HR perspective': ['From an HR perspective,', 'The people-side implication is', 'Teams that get this right'],
  'Marketing perspective': ['From a marketing angle,', 'The audience implication is', 'Brands that win here'],
  'Data-driven opinion': ['The data suggests', 'Numbers point to', 'If the metrics hold,'],
  'Constructive disagreement': ['I push back gently on one point', 'I would respectfully challenge', 'Not sure I fully agree on'],
  'Ask an intelligent question': ['One question this raises', 'Something worth asking', 'A question that comes to mind'],
  'Future prediction': ['In five years,', 'The trajectory suggests', 'We are heading toward'],
  'Connect with another trend': ['This connects to a broader trend', 'It reminds me of what is happening in', 'There is a parallel with'],
  'Give practical advice': ['The practical takeaway is', 'If I were advising someone on this', 'The actionable step is'],
  'Provide framework': ['A useful way to think about this', 'There is a simple framework for this', 'I usually break this into three parts'],
  'Tell mini story': ['This reminds me of a story', 'I recall a case where', 'There was a moment where'],
  'Challenge respectfully': ['The hidden challenge is', 'What most people miss', 'The harder question is'],
  'Summarize insight': ['What this really comes down to', 'The essence of this is', 'Strip away the details and'],
  'Industry comparison': ['Interesting how this compares to', 'Other industries solved this by', 'Compare this to'],
  'Real-world example': ['A real example I have seen', 'One company nailed this', 'In practice,'],
  'Research insight': ['Recent research on this shows', 'Studies suggest', 'The evidence points to'],
}

// ---------------------------------------------------------------------------
// Discovery — Google News RSS over LinkedIn-domain posts
// ---------------------------------------------------------------------------

async function getTopics() {
  const t = await storage.appState.get(TOPICS_KEY, null)
  return Array.isArray(t) && t.length ? t : DEFAULT_TOPICS
}

async function getSeen() {
  const s = await storage.appState.get(SEEN_KEY, null)
  return Array.isArray(s) ? s : []
}

async function markSeen(url) {
  const seen = (await getSeen()).slice(-300)
  if (!seen.includes(url)) seen.push(url)
  await storage.appState.set(SEEN_KEY, seen)
}

async function getStyleGuide() {
  try {
    const voices = await tableList('brandVoice')
    const active = voices.find(v => v.is_active === true) || voices[0]
    if (active?.style_guide) return { tone: active.tone, guide: active.style_guide, examples: active.examples }
  } catch {}
  return {
    tone: 'professional, curious, human',
    guide: 'Adds one real insight, asks a sharp question, never generic, never corporate-speak, no buzzwords, conversational but sharp.',
    examples: '',
  }
}

function scorePostLight(title, summary, topic) {
  const text = `${title} ${summary || ''}`.toLowerCase()
  const topicWords = topic.toLowerCase().split(/\s+/).filter(kw => kw.length > 2)
  let relevance = 0
  for (const kw of topicWords) if (text.includes(kw)) relevance += 1
  const RELATED = {
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'model', 'agent'],
    'business': ['business', 'startup', 'company', 'ceo', 'founder', 'enterprise', 'market'],
    'analytics': ['analytics', 'data', 'metrics', 'insight', 'dashboard', 'report'],
    'hr': ['hr', 'human resources', 'hiring', 'talent', 'workforce', 'employee', 'recruit'],
    'future': ['future', 'trend', 'next', '2026', 'roadmap', 'shift'],
    'work': ['work', 'job', 'career', 'office', 'remote', 'workplace', 'employment'],
    'leadership': ['leadership', 'leader', 'manager', 'management', 'executive', 'boss'],
    'people': ['people', 'team', 'culture', 'workforce', 'employee'],
    'marketing': ['marketing', 'brand', 'campaign', 'audience', 'content'],
    'startup': ['startup', 'founder', 'venture', 'funding', 'pitch'],
  }
  let related = 0
  for (const [key, words] of Object.entries(RELATED)) {
    if (topicWords.includes(key) && words.some(w => text.includes(w))) related += 1
  }
  const engagement = Math.min(99, 45 + (title.length > 60 ? 10 : 0) + (/\?|!/.test(title) ? 15 : 0) + (/\d/.test(title) ? 8 : 0) + (/how|why|lesson|learn|story|mistake|trend|future|breakthrough|surge|secret/.test(title.toLowerCase()) ? 12 : 0))
  const match = relevance > 0 || related > 0 || (title.length > 55 && engagement >= 70)
  return { relevance: Math.min(100, 40 + relevance * 15 + related * 8), engagement, match }
}

// ---------------------------------------------------------------------------
// STEP 1+2 — deep AI analysis + classification
// ---------------------------------------------------------------------------

export async function deepAnalyzePost({ title, summary = '', url = '' }) {
  try {
    const providers = await storage.providers.list()
    const tp = pickTextProvider(providers) || providers.find(p => p.active_for_text)
    if (!tp) return null
    const prompt = `Analyze this LinkedIn post deeply. Use the FULL text — never just the headline.

POST TITLE: ${String(title || '').slice(0, 500)}
POST TEXT: ${String(summary || '').slice(0, 1500)}
URL: ${url}

Extract everything you can from the ACTUAL content:
- industry: the industry the post operates in
- topic: the core subject (2-5 words)
- intent: one of educate|debate|announce|inspire|provoke|share_story|ask|insight
- main_argument: the author's central claim in one sentence
- tone: e.g. confident, frustrated, curious, playful, serious
- question_asked: the exact question asked, or null
- cta: what the author wants readers to do, or null
- target_audience: who this is written for
- pain_point: the problem it addresses, or null
- takeaway: the one key insight a reader should get
- classification: ONE of these exact values: ${CLASSIFICATIONS.join('|')}
- author_estimate: likely author role (e.g. CEO, researcher, consultant) or null

Respond with JSON ONLY:
{"industry":"...","topic":"...","intent":"...","main_argument":"...","tone":"...","question_asked":"...","cta":"...","target_audience":"...","pain_point":"...","takeaway":"...","classification":"...","author_estimate":"..."}`
    const raw = await callAi({ provider: tp, prompt, json: true, maxTokens: 600, timeoutMs: 25000 })
    const parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim())
    return {
      industry: String(parsed.industry || '').slice(0, 60),
      topic: String(parsed.topic || '').slice(0, 80),
      intent: String(parsed.intent || 'educate'),
      main_argument: String(parsed.main_argument || '').slice(0, 300),
      tone: String(parsed.tone || '').slice(0, 40),
      question_asked: parsed.question_asked ? String(parsed.question_asked).slice(0, 200) : null,
      cta: parsed.cta ? String(parsed.cta).slice(0, 120) : null,
      target_audience: String(parsed.target_audience || '').slice(0, 120),
      pain_point: parsed.pain_point ? String(parsed.pain_point).slice(0, 200) : null,
      takeaway: String(parsed.takeaway || '').slice(0, 200),
      classification: CLASSIFICATIONS.includes(parsed.classification) ? parsed.classification : 'Technology',
      author_estimate: parsed.author_estimate ? String(parsed.author_estimate).slice(0, 60) : null,
    }
  } catch (e) {
    console.warn('[linkedin-intel] deep analysis failed:', e.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// STEP 3 — 12-dimension scoring
// ---------------------------------------------------------------------------

export function scoreOpportunity({ title = '', summary = '', analysis = null, topic = '' }) {
  const text = `${title} ${summary || ''}`.toLowerCase()
  const a = analysis || {}
  const hasAnalysis = !!(a.industry || a.main_argument || a.takeaway)
  const base = Math.min(97, 62 + (title.length > 50 ? 8 : 0) + (/\?|!/.test(title) ? 5 : 0) + (hasAnalysis ? 6 : 0))

  const relevance = Math.min(100, base + (a.industry ? 6 : 0) + (a.topic ? 5 : 0))
  const conversation = Math.min(100, 60 + (a.question_asked ? 16 : 0) + (a.intent === 'debate' || a.intent === 'provoke' ? 14 : 0) + (/\?/.test(title) ? 10 : 0))
  const visibility = Math.min(100, 52 + (/\d/.test(title) ? 12 : 0) + (title.length > 70 ? 10 : 0) + (/\b(how|why|what|mistake|lesson|story|secret|future|trend)\b/.test(text) ? 12 : 0))
  const authority = Math.min(100, 55 + (a.industry ? 12 : 0) + (a.main_argument ? 10 : 0) + (a.takeaway ? 10 : 0))
  const originality = Math.min(100, 63 + (a.main_argument ? 15 : 0) + (summary.length > 200 ? 10 : 0))
  const trend = Math.min(100, 52 + (/\b(ai|2026|future|trend|new|breaking|surge|shift)\b/.test(text) ? 18 : 0) + (/\d{4}/.test(text) ? 8 : 0))
  const audience = Math.min(100, 58 + (a.target_audience ? 15 : 0) + (a.pain_point ? 12 : 0))
  const spamRisk = Math.min(30, (/hiring|we're hiring|apply|vacancy|job opening/i.test(text) ? 22 : 0) + (/\b(ltd|pvt|private limited)\b/i.test(text) ? 8 : 0) + (title.length < 30 ? 6 : 0))
  const businessValue = Math.min(100, 53 + (a.industry ? 12 : 0) + (a.takeaway ? 12 : 0) + (/\b(roi|cost|revenue|growth|efficiency|market)\b/.test(text) ? 10 : 0))
  const networking = Math.min(100, 58 + (conversation >= 70 ? 15 : 0) + (a.question_asked ? 10 : 0) + (spamRisk < 10 ? 8 : 0))
  const learning = Math.min(100, 58 + (a.takeaway ? 15 : 0) + (a.main_argument ? 12 : 0) + (summary.length > 250 ? 8 : 0))

  const overall = Math.round(
    relevance * 0.15 + conversation * 0.15 + visibility * 0.10 + authority * 0.10 +
    originality * 0.08 + trend * 0.08 + audience * 0.10 + (100 - spamRisk) * 0.06 +
    businessValue * 0.08 + networking * 0.05 + learning * 0.05
  )

  return {
    overall: Math.min(99, overall),
    relevance: Math.round(relevance),
    conversation_potential: Math.round(conversation),
    visibility: Math.round(visibility),
    authority: Math.round(authority),
    originality: Math.round(originality),
    trend_score: Math.round(trend),
    audience_match: Math.round(audience),
    spam_risk: Math.round(spamRisk),
    business_value: Math.round(businessValue),
    networking_score: Math.round(networking),
    learning_value: Math.round(learning),
  }
}

// Gate: only recommend high-value discussions
function qualifies(s) {
  return s.overall >= 80 && s.spam_risk <= 10
}

// ---------------------------------------------------------------------------
// STEP 4 — strategy rotation (never repeat consecutively)
// ---------------------------------------------------------------------------

async function pickStrategy(topic) {
  let last = []
  try { last = (await storage.appState.get(STRATEGY_KEY, null)) || [] } catch {}
  // Prefer strategies that fit the topic, then anything not recently used
  const topicRelated = STRATEGIES.filter(s => {
    const t = topic.toLowerCase()
    if (t.includes('leadership') && s.includes('Leadership')) return true
    if (t.includes('hr') && s.includes('HR')) return true
    if (t.includes('market') && s.includes('Marketing')) return true
    if (t.includes('analytics') && s.includes('Business Analytics')) return true
    if (t.includes('mba') && s.includes('MBA')) return true
    return false
  })
  const pool = (topicRelated.length ? topicRelated : STRATEGIES).filter(s => !last.includes(s))
  const available = pool.length ? pool : STRATEGIES
  const chosen = available[Math.floor(Math.random() * available.length)]
  await storage.appState.set(STRATEGY_KEY, [...last, chosen].slice(-3))
  return chosen
}

// ---------------------------------------------------------------------------
// Memory — similarity vs last 500 comments; >25% => regenerate
// ---------------------------------------------------------------------------

function similarity(a, b) {
  const wa = new Set(String(a || '').toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const wb = String(b || '').toLowerCase().split(/\W+/).filter(w => w.length > 3)
  if (!wa.size || !wb.length) return 0
  let hits = 0
  for (const w of wb) if (wa.has(w)) hits++
  return Math.round((hits / Math.min(wa.size, wb.length)) * 100)
}

async function checkSimilarity(comment) {
  try {
    const history = await tableList('linkedinCommentsHistory')
    const recent = history.slice(-500)
    if (!recent.length) return { max: 0, similar: null }
    let worst = { sim: 0, item: null }
    for (const h of recent) {
      const sim = similarity(comment, h.comment)
      if (sim > worst.sim) worst = { sim, item: h }
    }
    return { max: worst.sim, similar: worst.item }
  } catch { return { max: 0, similar: null } }
}

// ---------------------------------------------------------------------------
// STEP 5+6 — human comment generation
// ---------------------------------------------------------------------------

export async function generateHumanComment({ title = '', summary = '', analysis = null, strategy = null, topic = '', url = '' }) {
  const a = analysis || {}
  const strategyName = strategy || await pickStrategy(topic)
  const openers = STRATEGY_OPENERS[strategyName] || STRATEGY_OPENERS['Expand the idea']
  const opener = openers[Math.floor(Math.random() * openers.length)]
  const style = await getStyleGuide()
  const learning = await getLearningExamples()

  try {
    const providers = await storage.providers.list()
    const tp = pickTextProvider(providers) || providers.find(p => p.active_for_text)
    if (!tp) throw new Error('no provider')

    const prompt = `You are an experienced LinkedIn creator who engages like a real human. Write ONE comment on the post below.

POST CONTENT (read it fully — never comment from the headline alone):
TITLE: ${String(title || '').slice(0, 400)}
FULL TEXT: ${String(summary || '').slice(0, 1600)}
INDUSTRY: ${a.industry || 'unknown'}
TOPIC: ${a.topic || topic}
AUTHOR INTENT: ${a.intent || 'educate'}
MAIN ARGUMENT: ${a.main_argument || ''}
TONE OF POST: ${a.tone || ''}
${a.question_asked ? `QUESTION ASKED: ${a.question_asked}` : ''}
${a.pain_point ? `PAIN POINT: ${a.pain_point}` : ''}

COMMENT STRATEGY (use exactly this angle): ${strategyName}
Open naturally — start with something like: "${opener}"

${learning ? `MY VOICE (comments I previously approved — match but never repeat):\n${learning.slice(0, 500)}` : ''}

STRICT RULES:
- 80-220 words
- Read the post and react to its ACTUAL content — reference a specific detail, claim, or question
- Write like a human on LinkedIn: conversational, specific, one clear point, then an insight or question
- NEVER start with: great post, amazing, well said, thanks for sharing, interesting, excellent, valuable, nice, agree, love this
- No hashtags. No emojis (unless truly natural, max 1). No AI wording ("as an AI", "great insights"). No corporate buzzwords (synergy, leverage, game-changer, thought-provoking).
- No listicles, no bullet-point formatting — flowing prose
- End with a natural question OR a grounded opinion — never a generic "curious to hear your thoughts"

Respond JSON ONLY:
{"comment":"...","why":"why this comment is valuable for THIS post","quality":0-100,"similarity_check":"unique"}`
    const raw = await callAi({ provider: tp, prompt, json: true, maxTokens: 900, timeoutMs: 30000 })
    const parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim())
    let comment = String(parsed.comment || '').trim()

    if (!comment || isGeneric(comment)) throw new Error('generic or empty comment')
    if (comment.length < 80 || comment.length > 240) throw new Error(`bad length ${comment.length}`)

    // Memory gate — regenerate once if too similar to a past comment
    const sim = await checkSimilarity(comment)
    if (sim.max > 25) {
      const retry = await callAi({
        provider: tp,
        prompt: `${prompt}\n\nYour previous draft was too similar to a past comment (${sim.max}% overlap). Write a COMPLETELY different structure, opening, and ending.`,
        json: true, maxTokens: 900, timeoutMs: 30000,
      })
      const rp = JSON.parse(String(retry).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim())
      if (rp.comment && !isGeneric(rp.comment)) comment = String(rp.comment).trim()
    }
    const finalSim = (await checkSimilarity(comment)).max
    return {
      comment,
      why: String(parsed.why || `Adds a ${strategyName.toLowerCase()} angle grounded in the post's actual content.`).slice(0, 200),
      quality: Math.min(99, Number(parsed.quality) || 85),
      strategy: strategyName,
      similarity: finalSim,
    }
  } catch (e) {
    console.warn('[linkedin-intel] AI comment failed, using fallback:', e.message)
    const fallback = buildFallbackComment({ title, summary, analysis: a, strategy: strategyName, opener })
    return {
      comment: fallback.comment,
      why: fallback.why,
      quality: fallback.quality,
      strategy: strategyName,
      similarity: (await checkSimilarity(fallback.comment)).max,
    }
  }
}

function buildFallbackComment({ title, summary, analysis, strategy, opener }) {
  const a = analysis || {}
  const detail = a.main_argument || (summary || '').replace(/[.!?]+$/, '').slice(0, 120) || (title || '').replace(/[.!?]+$/, '').slice(0, 120)
  const topic = a.topic || a.industry || 'this space'
  const comment = `${opener} — ${detail.slice(0, 140)}. The piece that matters most for ${topic} is whether teams actually act on it, not just talk about it. From what I have seen, the ones that move first build a small feedback loop, measure it weekly, and adapt. What would you say is the single biggest blocker for most teams here?`
  return {
    comment: comment.length > 240 ? comment.slice(0, 235) + '…' : comment,
    why: `Ties the post's argument to a practical ${a.industry || 'business'} angle and asks a grounded follow-up question.`,
    quality: 87,
  }
}

function isGeneric(comment) {
  const c = comment.toLowerCase()
  return GENERIC_PHRASES.some(p => c.includes(p)) || /^(great|amazing|nice|excellent|interesting|valuable|agree)\b/.test(c)
}

async function getLearningExamples() {
  try {
    const rows = await tableList('linkedinIntelLearning')
    return rows.filter(r => r.decision === 'approved' || r.decision === 'edited')
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
      .slice(0, 4).map(r => r.comment).filter(Boolean).join('\n---\n')
  } catch { return '' }
}

// ---------------------------------------------------------------------------
// Discovery entry — full pipeline for one batch
// ---------------------------------------------------------------------------

export async function checkOpportunities({ limit = 3 } = {}) {
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
        const summary = (item.match(/<description>(.*?)<\/description>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 500)
        if (!title || !url || seen.includes(url) || results.some(r => r.url === url)) continue
        const light = scorePostLight(title, summary, topic)
        if (!light.match) continue
        const ageMinutes = pubDate ? Math.max(1, Math.round((Date.now() - new Date(pubDate).getTime()) / 60000)) : 60
        results.push({ title, url, summary, topic, author: '', post_age_minutes: ageMinutes, relevance: light.relevance, engagement: light.engagement })
        await markSeen(url)
      }
    } catch (e) { console.warn('[linkedin-intel] feed failed:', topic, e.message) }
  }

  const saved = []
  for (const r of results.slice(0, limit)) {
    // STEP 1+2: deep analysis
    const analysis = await deepAnalyzePost(r)
    // STEP 3: scoring + gate
    const scores = scoreOpportunity({ ...r, analysis })
    if (!qualifies(scores)) {
      await storage.audit.log('li_ignored', 'linkedin_intel', r.url, null, 'ignored', { overall: scores.overall, spam: scores.spam_risk, reason: 'below threshold' }).catch(() => {})
      continue
    }
    // STEP 4: strategy
    const strategy = await pickStrategy(analysis?.topic || r.topic)
    // STEP 5+6: human comment
    const gen = await generateHumanComment({ ...r, analysis, strategy })
    const item = {
      title: r.title, url: r.url, summary: r.summary, topic: analysis?.topic || r.topic,
      author: r.author || '', post_age_minutes: r.post_age_minutes,
      relevance: scores.relevance, engagement: r.engagement,
      opportunity: scores.overall, why: gen.why, comment: gen.comment,
      quality: gen.quality, visibility: scores.visibility >= 75 ? 'high' : scores.visibility >= 55 ? 'medium' : 'low',
      status: 'pending', created_at: new Date().toISOString(),
      industry: analysis?.industry || '', classification: analysis?.classification || '',
      intent: analysis?.intent || '', main_argument: analysis?.main_argument || '',
      tone: analysis?.tone || '', question_asked: analysis?.question_asked || '',
      cta: analysis?.cta || '', target_audience: analysis?.target_audience || '',
      pain_point: analysis?.pain_point || '', takeaway: analysis?.takeaway || '',
      strategy: gen.strategy, spam_risk: scores.spam_risk,
      conversation_potential: scores.conversation_potential,
      networking_score: scores.networking_score,
      ai_summary: analysis?.main_argument || analysis?.takeaway || summary.slice(0, 200),
      why_engage: analysis?.question_asked ? `The author asked: "${analysis.question_asked.slice(0, 120)}" — a direct opening to join.` : `High-value ${analysis?.classification || 'industry'} discussion (${scores.overall}/100).`,
      estimated_visibility: scores.visibility,
      overall_score: scores.overall,
    }
    saved.push(await tableInsert('linkedinIntel', item))
  }
  return { found: results.length, saved: saved.length, items: saved }
}

// ---------------------------------------------------------------------------
// Record decision + write to memory history
// ---------------------------------------------------------------------------

export async function recordDecision(id, action, { editedComment = null } = {}) {
  const row = await tableGet('linkedinIntel', id)
  if (!row) throw new Error('Opportunity not found')
  const comment = editedComment || row.comment
  const patch = {
    status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'save' ? 'saved' : action === 'skip' ? 'skipped' : row.status,
    updated_at: new Date().toISOString(),
  }
  if (editedComment) patch.comment = editedComment
  await tableUpdate('linkedinIntel', id, patch)
  await tableInsert('linkedinIntelLearning', { comment, decision: editedComment ? 'edited' : action, topic: row.topic || '', created_at: new Date().toISOString() }).catch(() => {})
  // Memory: store every generated comment with its strategy + similarity
  if (comment && (action === 'approve' || action === 'save' || action === 'skip')) {
    await tableInsert('linkedinCommentsHistory', {
      date: new Date().toISOString().slice(0, 10),
      post_url: row.url || '', author: row.author || '',
      topic: row.topic || '', comment,
      strategy_used: row.strategy || '',
      similarity_score: Number(row.similarity) || 0,
      approved: action === 'approve' ? 'yes' : 'no',
      published: 'no',
      created_at: new Date().toISOString(),
    }).catch(() => {})
  }
  return { ...row, ...patch }
}

// ---------------------------------------------------------------------------
// Post the approved comment + verify + capture URL
// ---------------------------------------------------------------------------

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
  const ts = new Date().toISOString()
  await tableUpdate('linkedinIntel', id, { status: 'commented', commented_at: ts, comment_timestamp: ts, updated_at: ts })
  // Update memory history entry for this post
  try {
    const hist = await tableList('linkedinCommentsHistory')
    const entry = hist.find(h => h.post_url === row.url && h.comment === row.comment)
    if (entry) await tableUpdate('linkedinCommentsHistory', entry.id, { published: 'yes', date: ts.slice(0, 10) })
  } catch {}
  return { ok: true, posted: true, url: row.url, comment: row.comment, comment_timestamp: ts }
}

// ---------------------------------------------------------------------------
// Learning — record engagement outcomes (replies, likes, author interaction)
// ---------------------------------------------------------------------------

export async function recordEngagementOutcome(id, { likes = 0, replies = 0, authorReplied = false, connectionAccepted = false, profileVisits = 0, followerChange = 0 } = {}) {
  const row = await tableGet('linkedinIntel', id)
  if (!row) throw new Error('Opportunity not found')
  try {
    const hist = await tableList('linkedinCommentsHistory')
    const entry = hist.find(h => h.post_url === row.url && h.comment === row.comment)
    if (entry) {
      await tableUpdate('linkedinCommentsHistory', entry.id, {
        likes: Number(entry.likes || 0) + Number(likes || 0),
        replies: Number(entry.replies || 0) + Number(replies || 0),
        author_replied: authorReplied ? 'yes' : (entry.author_replied || 'no'),
        connection_accepted: connectionAccepted ? 'yes' : (entry.connection_accepted || 'no'),
        profile_visits: Number(entry.profile_visits || 0) + Number(profileVisits || 0),
        follower_change: Number(entry.follower_change || 0) + Number(followerChange || 0),
      })
      return { ok: true }
    }
  } catch (e) { console.warn('[linkedin-intel] outcome record failed:', e.message) }
  return { ok: false }
}

// ---------------------------------------------------------------------------
// Author priority — prefer authors who engage back (learning feedback)
// ---------------------------------------------------------------------------

export async function getHighValueAuthors() {
  try {
    const hist = await tableList('linkedinCommentsHistory')
    const byAuthor = {}
    for (const h of hist) {
      if (!h.author) continue
      byAuthor[h.author] = byAuthor[h.author] || { interactions: 0, authorReplies: 0, likes: 0, last: '' }
      byAuthor[h.author].interactions++
      if (h.author_replied === 'yes') byAuthor[h.author].authorReplies++
      byAuthor[h.author].likes += Number(h.likes || 0)
      if (h.date > byAuthor[h.author].last) byAuthor[h.author].last = h.date
    }
    return Object.entries(byAuthor)
      .map(([author, v]) => ({ author, ...v, score: v.authorReplies * 3 + v.likes * 0.5 + (v.interactions ? 1 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  } catch { return [] }
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export async function listOpportunities(status = null) {
  const rows = await tableList('linkedinIntel')
  if (!status) return rows
  return rows.filter(r => r.status === status)
}

export async function addManualOpportunity({ url, title, author = '', summary = '', topic = '' }) {
  if (!url) throw new Error('URL required')
  const t = topic || (await getTopics())[0]
  const analysis = await deepAnalyzePost({ title: title || url, summary, url })
  const scores = scoreOpportunity({ title: title || url, summary, analysis, topic: t })
  const strategy = await pickStrategy(analysis?.topic || t)
  const gen = await generateHumanComment({ title: title || url, summary, analysis, strategy, topic: t, url })
  const row = await tableInsert('linkedinIntel', {
    title: title || url, url, summary: summary || '', topic: analysis?.topic || t, author: author || '',
    post_age_minutes: 1, relevance: scores.relevance, engagement: 70, opportunity: scores.overall,
    why: gen.why, comment: gen.comment, quality: gen.quality, visibility: scores.visibility >= 75 ? 'high' : 'medium',
    status: 'pending', created_at: new Date().toISOString(),
    industry: analysis?.industry || '', classification: analysis?.classification || '',
    intent: analysis?.intent || '', main_argument: analysis?.main_argument || '',
    tone: analysis?.tone || '', question_asked: analysis?.question_asked || '',
    target_audience: analysis?.target_audience || '', pain_point: analysis?.pain_point || '',
    takeaway: analysis?.takeaway || '', strategy: gen.strategy, spam_risk: scores.spam_risk,
    conversation_potential: scores.conversation_potential, networking_score: scores.networking_score,
    ai_summary: analysis?.main_argument || summary.slice(0, 200),
    why_engage: analysis?.question_asked ? `The author asked: "${analysis.question_asked.slice(0, 120)}"` : 'Manual addition.',
    estimated_visibility: scores.visibility, overall_score: scores.overall,
  })
  await markSeen(url)
  return row
}

function extractUrn(url) {
  const m = String(url || '').match(/urn:li:activity:\d+/)
  return m ? m[0] : null
}
