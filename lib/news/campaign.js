// ============================================================================
// News Campaign Engine — Generate every content type from ONE research pass.
//
// Flow:  start/continue → research once (article + knowledge pack) →
//        generate each selected platform from the same context →
//        quality checks → complete. Per-platform retry, edit, schedule, publish.
//
// State lives in app_settings `news_campaign:{newsId}` so it survives
// serverless restarts; callers poll GET and call continue until done.
// ============================================================================

import { storage } from '../storage'
import { callAi } from '../ai/providers'

export const CAMPAIGN_PLATFORMS = [
  { key: 'linkedin', label: 'LinkedIn', publishable: true },
  { key: 'blog', label: 'SEO Blog', publishable: true },
  { key: 'instagram', label: 'Instagram', publishable: true },
  { key: 'facebook', label: 'Facebook', publishable: true },
  { key: 'threads', label: 'Threads', publishable: true },
  { key: 'newsletter', label: 'Newsletter', publishable: false },
  { key: 'telegram_summary', label: 'Telegram Summary', publishable: false },
  { key: 'carousel', label: 'Carousel', publishable: false },
  { key: 'image_prompt', label: 'Image Prompt', publishable: false },
]

export const CAMPAIGN_STEPS = [
  { id: 'reading', label: 'Reading article' },
  { id: 'researching', label: 'Researching context' },
  { id: 'sources', label: 'Finding supporting sources' },
  ...CAMPAIGN_PLATFORMS.map(p => ({ id: 'gen_' + p.key, label: `Generating ${p.label}` })),
  { id: 'qa', label: 'Running quality checks' },
  { id: 'complete', label: 'Complete' },
]

const BUDGET_MS = 46000          // per request — leave headroom under Vercel's 60s
const researchCost = 1           // steps consumed by research+article reading
const MAX_PLATFORMS_PER_BATCH = 4

function keyOf(newsId) { return `news_campaign:${newsId}` }

export async function getCampaignState(newsId) {
  return await storage.appState.get(keyOf(newsId), null)
}

async function saveState(newsId, state) {
  state.updated_at = new Date().toISOString()
  await storage.appState.set(keyOf(newsId), state)
}

function freshState(newsId, title, platforms, chatRef = null) {
  const state = {
    news_id: newsId,
    title: title || 'Untitled',
    platforms: platforms.filter(p => CAMPAIGN_PLATFORMS.some(m => m.key === p)),
    status: 'running',            // running | done | error
    chat: chatRef,                // { chatId, messageId } for Telegram progress
    research: null,               // knowledge pack
    steps: CAMPAIGN_STEPS.map(s => ({ id: s.id, label: s.label, status: 'pending' })),
    assets: {},                   // platform → { status, title, caption, content, hashtags, alt_text, image_prompt, error, warnings[], scheduled_for, publish_results, published_at }
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return state
}

function setStep(state, id, status) {
  const s = state.steps.find(x => x.id === id)
  if (s) s.status = status
}

function parseAiJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) throw new Error('AI response was not JSON')
  return JSON.parse(cleaned.slice(first, last + 1))
}

async function getTextProvider() {
  const providers = await storage.providers.list()
  const p = providers.find(x => x.active_for_text)
  if (!p) throw new Error('No active text AI provider configured (Settings → AI Providers)')
  return p
}

function stripHtml(text) {
  return (text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchArticleBody(item) {
  if (item?.content && item.content.length > 300) return item.content.slice(0, 12000)
  if (item?.summary && item.summary.length > 150) return `${item.summary}\n\n(No full article content captured from the feed.)`
  if (item?.url) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(item.url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialForgeBot/1.0)' }, redirect: 'follow' })
      clearTimeout(t)
      const html = await res.text()
      const text = stripHtml(html)
      return text.slice(0, 12000) || 'No readable content extracted.'
    } catch {
      return 'Could not fetch the article body. Use the headline, summary and general knowledge only.'
    }
  }
  return 'Only the headline and summary are available.'
}

// ---- Step 1–3: single research pass → shared knowledge pack ----
async function researchArticle(item, provider) {
  const body = await fetchArticleBody(item)
  const prompt = `You are the research director of an editorial newsroom. Analyze this news article ONCE and build a complete shared knowledge pack that every content writer below will reuse.

HEADLINE: ${item.title || ''}
SOURCE: ${item.source_name || ''}
PUBLISHED: ${item.published_at || ''}
CATEGORY: ${item.category || 'general'}

ARTICLE BODY:
${body}

Return strict JSON only:
{
  "summary_150": "one neutral 150-char summary for reuse",
  "key_facts": ["4-8 bullet facts ONLY supported by the article — never invent numbers"],
  "stats": ["any statistics mentioned, verbatim with their source"],
  "quotes": ["direct quotes from the article if any, else []"],
  "audience": "who cares about this and why",
  "angle": "the sharpest editorial angle for a professional audience",
  "headline_options": ["3 strong headline options"],
  "keywords": ["6-10 SEO keywords from the article"],
  "supporting_sources": ["2-4 credible institutions/companies/experts connected to this story"],
  "sentiment": "positive | negative | neutral",
  "credibility_notes": "why this story is or is not trustworthy"
}`

  const raw = await callAi({ provider, prompt, json: true, timeoutMs: 22000 })
  const pack = parseAiJson(raw)
  pack.article_body = body.slice(0, 6000)
  pack.title = item.title
  pack.source_name = item.source_name
  pack.url = item.url
  pack.published_at = item.published_at
  return pack
}

// ---- Step 4: per-platform generation, all from the SAME knowledge pack ----
const PLATFORM_PROMPTS = {
  linkedin: `Write a professional LinkedIn post for an HR/tech thought leader. Purpose: share this industry insight credibly. Style: sharp opening hook, 2-3 evidence points from the knowledge pack, one personal-professional insight, no first-person life stories, confident tone, no engagement-bait questions, end with a definitive takeaway statement (never a question). 150-260 words. Return JSON: {"title": "...", "caption": "...", "hashtags": ["5-8"]}`,
  instagram: `Write an Instagram caption that makes people stop scrolling. Visual-first, short punchy lines with line breaks, emotive but factual, 60-120 words, 6-10 hashtags, end with a strong statement (never a question). Return JSON: {"caption": "...", "hashtags": ["6-10"], "alt_text": "detailed alt text describing the post image"}`,
  facebook: `Write a friendly, informative Facebook post sharing this news with a general audience. Conversational, easy to read, 80-150 words, 2-4 hashtags, warm sign-off line, no engagement-bait questions. Return JSON: {"caption": "...", "hashtags": ["2-4"]}`,
  threads: `Write a Threads post. Ultra-short, punchy, opinion-forward, 30-60 words, 1-3 hashtags, ends with a takeaway (never a question). Return JSON: {"caption": "...", "hashtags": ["1-3"]}`,
  blog: `Write a complete SEO blog article (1200-1800 words) based ONLY on this knowledge pack. Structure: H1 title, engaging intro stating the stakes, H2 sections with evidence from the knowledge pack, one H2 "What this means for businesses/professionals", practical takeaways, conclusion. Use markdown. Include the 2-3 strongest keywords naturally. Do NOT invent statistics. Return JSON: {"title": "...", "slug": "kebab-case", "body_markdown": "...", "seo_description": "150 chars", "tags": ["4-6"]}`,
  newsletter: `Write a newsletter edition around this story. Subject line, a personal-curator opening, 3 sections (The story / Why it matters / What to watch), a closing note, and one call to action. 350-550 words. Return JSON: {"subject": "...", "opening": "...", "sections": [{"heading": "...", "body": "..."}], "closing": "...", "cta": "..."}`,
  telegram_summary: `Write a concise Telegram briefing (200-320 words) for a busy professional: key facts, why it matters, what to watch, one line on credibility. Use simple markdown with bold headings, no emoji spam (max 2). Return JSON: {"text": "..."}`,
  carousel: `Design a 5-slide LinkedIn carousel deck summarizing this story. Slide 1 = hook title + subtitle, slides 2-4 = 3 key evidence points each with a visual prompt, slide 5 = takeaway + CTA line (not a question). Return JSON: {"title": "...", "slides": [{"heading": "...", "points": ["..."], "image_prompt": "detailed text-to-image prompt for a flat-design slide background"}]}`,
  image_prompt: `Write premium text-to-image prompts for this story: one hero image and one data-visualization style image. Photorealistic or editorial illustration style. Return JSON: {"prompt": "detailed hero prompt", "negative_prompt": "...", "style": "editorial | illustration | photorealistic", "alt_text": "..."}`,
}

async function generateAsset(provider, pack, platform) {
  const instruction = PLATFORM_PROMPTS[platform]
  if (!instruction) throw new Error(`Unknown platform: ${platform}`)
  const prompt = `You are a senior content writer. ${instruction}\n\nKNOWLEDGE PACK (the ONLY source of facts — never invent anything not in it):\n${JSON.stringify(pack)}`
  const raw = await callAi({ provider, prompt, json: true, maxTokens: 4096, timeoutMs: 22000 })
  const out = parseAiJson(raw)
  const asset = { status: 'done', generated_at: new Date().toISOString(), error: null, warnings: [], scheduled_for: null, publish_results: null, published_at: null, ...out }
  if (platform === 'instagram') { if (!asset.alt_text) asset.alt_text = asset.caption?.slice(0, 500) }
  if (platform === 'blog') { if (!asset.body_markdown) asset.body_markdown = asset.content || '' }
  if (platform === 'carousel') { if (!Array.isArray(asset.slides)) throw new Error('Carousel response missing slides') }
  return asset
}

// ---- Step 5: quality checks (heuristic, instant) ----
const QA_LIMITS = { linkedin: 3000, instagram: 2200, facebook: 63206, threads: 500, blog: 40000, newsletter: 10000, telegram_summary: 3500 }
function runQualityChecks(state) {
  const warnings = {}
  for (const [platform, asset] of Object.entries(state.assets)) {
    const w = []
    if (asset.status !== 'done') continue
    const text = asset.caption || asset.body_markdown || asset.text || asset.subject || ''
    if (!text || text.trim().length < 20) w.push('content appears empty')
    const limit = QA_LIMITS[platform]
    if (limit && text.length > limit) w.push(`over ${limit.toLocaleString()} chars (${text.length})`)
    if (platform === 'instagram' && !(asset.hashtags || []).length) w.push('missing hashtags')
    if (platform === 'blog') {
      if (!asset.seo_description) w.push('missing SEO description')
      if (!asset.slug) w.push('missing slug')
      if ((text.match(/^#+\s/m) || []).length < 3) w.push('fewer than 3 H2 sections')
    }
    if (platform === 'carousel' && !Array.isArray(asset.slides)) w.push('missing slides')
    if (asset.warnings) asset.warnings = []
    asset.warnings = w
    if (w.length) warnings[platform] = w
  }
  state.qa_warnings = warnings
  return warnings
}

async function finalizeCampaign(state) {
  state.status = 'done'
  state.steps.forEach(s => { if (s.status === 'pending') s.status = 'skipped' })
  const s = state.steps.find(x => x.id === 'complete')
  if (s) s.status = 'done'

  // Mirror into news_posts so funnel KPIs + legacy publish route keep working
  const mirrored = {}
  for (const [p, a] of Object.entries(state.assets)) {
    if (a.status === 'done') mirrored[p] = { caption: a.caption || a.text || a.body_markdown, hashtags: a.hashtags || [], title: a.title || null, alt_text: a.alt_text || null }
  }
  const anyDone = Object.keys(mirrored).length > 0
  await storage.newsPosts.update(state.news_id, {
    generated_posts: mirrored,
    status: anyDone ? 'pending_approval' : 'failed',
  }).catch(() => {})

  // Register a campaign row for the calendar/queue views
  try {
    const existing = await storage.campaigns.get(`news_${state.news_id}`)
    const row = {
      id: `news_${state.news_id}`, name: state.title.slice(0, 90),
      description: 'AI news campaign — one research pass, all platforms',
      platforms: Object.keys(state.assets), schedule_settings: { source: 'news_radar', news_id: state.news_id },
      post_count: Object.keys(state.assets).length,
    }
    if (existing) await storage.campaigns.update(row.id, row)
    else await storage.campaigns.create(row)
  } catch { /* optional integration */ }
}

export async function notifyCampaignDone(state) {
  if (!state?.chat?.chatId) return
  const { sendMessage } = await import('../telegram/client')
  const lines = [`🎉 <b>Campaign complete</b> — ${escapeHtml((state.title || '').slice(0, 120))}`]
  const failed = []
  for (const [p, a] of Object.entries(state.assets)) {
    lines.push(`${a.status === 'done' ? '✅' : '❌'} ${platformLabel(p)}${a.warnings?.length ? ' ⚠️' : ''}${a.publish_results?.url ? ' · 🔗' : ''}`)
    if (a.status === 'error') failed.push(p)
  }
  const qaCount = Object.keys(state.qa_warnings || {}).length
  if (qaCount) lines.push(`\n⚠️ Quality notes: ${qaCount} platform(s)`)
  lines.push(`\nEdit, retry or publish from the dashboard — or use the buttons below.`)
  const kb = { inline_keyboard: [] }
  failed.forEach(p => kb.inline_keyboard.push([{ text: `🔄 Retry ${platformLabel(p)}`, callback_data: `nwcp:${state.news_id}:retry:${p}` }]))
  kb.inline_keyboard.push([{ text: '🚀 Publish all', callback_data: `nwcp:${state.news_id}:puball` }, { text: '📅 Schedule', callback_data: `nwcp:${state.news_id}:sched` }])
  await sendMessage({ chatId: state.chat.chatId, text: lines.join('\n'), replyMarkup: kb }).catch(() => {})
}

// ---- Public driver: processes one batch per call, persists every step ----
export async function startOrContinueCampaign(newsId, opts = {}) {
  const { platforms = CAMPAIGN_PLATFORMS.map(p => p.key), chat = null, force = false, budgetMs = BUDGET_MS } = opts
  const item = await storage.newsPosts.get(newsId)
  if (!item) return { ok: false, error: 'News post not found' }

  let state = await getCampaignState(newsId)
  if (!state || force) {
    state = freshState(newsId, item.title, platforms, chat)
    await saveState(newsId, state)
    indexRunningCampaign(newsId).catch(() => {})
  } else {
    // Union requested platforms so "Generate All" can add missing ones later
    const merged = [...new Set([...state.platforms, ...platforms])]
    if (merged.length !== state.platforms.length) {
      state.platforms = merged
      for (const p of merged) {
        if (!state.steps.some(s => s.id === 'gen_' + p)) {
          const qi = state.steps.findIndex(s => s.id === 'qa')
          state.steps.splice(qi === -1 ? state.steps.length : qi, 0, { id: 'gen_' + p, label: `Generating ${platformLabel(p)}`, status: 'pending' })
        }
      }
    }
    if (state.status === 'done' && !force) {
      const missing = platforms.filter(p => !state.assets[p] || state.assets[p].status !== 'done')
      if (missing.length === 0) return { ok: true, state }
      state.status = 'running'
    }
  }

  const deadline = Date.now() + budgetMs
  const done = () => Date.now() > deadline

  try {
    // Research phase (once)
    if (!state.research) {
      setStep(state, 'reading', 'active'); await saveState(newsId, state)
      const provider = await getTextProvider()
      const pack = await researchArticle(item, provider)
      setStep(state, 'reading', 'done')
      setStep(state, 'researching', 'active')
      state.research = { pack, provider: provider.id }
      setStep(state, 'researching', 'done')
      setStep(state, 'sources', 'active')
      await saveState(newsId, state)
      const sCount = (pack.supporting_sources || []).length
      setStep(state, 'sources', 'done')
      await saveState(newsId, state)
      if (sCount === 0) state.research = { pack: { ...pack, supporting_sources: [item.source_name].filter(Boolean) }, provider: provider.id }
    }

    const provider = await storage.providers.get(state.research.provider)
    if (!provider) throw new Error('Research provider no longer active — regenerate campaign')

    // Generate platforms sequentially, one batch per call
    let processed = 0
    for (const platform of state.platforms) {
      const asset = state.assets[platform]
      if (asset && (asset.status === 'done' || asset.status === 'error')) continue
      if (done()) break
      if (processed >= MAX_PLATFORMS_PER_BATCH && !asset) break
      setStep(state, 'gen_' + platform, 'active')
      state.assets[platform] = { status: 'pending', generated_at: null }
      await saveState(newsId, state)
      try {
        const out = await generateAsset(provider, state.research.pack, platform)
        state.assets[platform] = { ...out }
        setStep(state, 'gen_' + platform, 'done')
      } catch (e) {
        state.assets[platform] = { status: 'error', error: (e.message || 'Generation failed').slice(0, 300), generated_at: new Date().toISOString() }
        setStep(state, 'gen_' + platform, 'error')
      }
      processed++
      await saveState(newsId, state)
    }

    // All platforms done → QA + finalize
    if (state.platforms.every(p => state.assets[p] && state.assets[p].status === 'done')) {
      setStep(state, 'qa', 'active')
      runQualityChecks(state)
      setStep(state, 'qa', 'done')
      await finalizeCampaign(state)
      await saveState(newsId, state)
      notifyCampaignDone(state).catch(() => {})
      return { ok: true, state, complete: true }
    }

    const anyError = state.platforms.some(p => state.assets[p]?.status === 'error')
    const noPending = state.platforms.every(p => state.assets[p] && state.assets[p].status !== 'pending')
    if (noPending) {
      // All errored or partially errored with nothing left to try
      setStep(state, 'qa', 'active')
      runQualityChecks(state)
      setStep(state, 'qa', 'done')
      state.status = anyError ? 'done' : 'done'
      await finalizeCampaign(state)
      await saveState(newsId, state)
      notifyCampaignDone(state).catch(() => {})
      return { ok: true, state, complete: true }
    }

    await saveState(newsId, state)
    return { ok: true, state, complete: false }
  } catch (e) {
    console.error('[news-campaign] batch failed:', e)
    state.error = (e.message || 'Unknown error').slice(0, 300)
    await saveState(newsId, state)
    return { ok: false, state, error: state.error }
  }
}

export async function regenerateCampaignAsset(newsId, platform) {
  const state = await getCampaignState(newsId)
  if (!state) return { ok: false, error: 'No campaign — run Generate first' }
  if (!state.platforms.includes(platform)) return { ok: false, error: 'Platform not in campaign' }
  state.assets[platform] = { status: 'pending', generated_at: null }
  setStep(state, 'gen_' + platform, 'active')
  state.status = 'running'
  await saveState(newsId, state)
  try {
    const provider = await storage.providers.get(state.research.provider)
    const out = await generateAsset(provider, state.research.pack, platform)
    state.assets[platform] = { ...out }
    setStep(state, 'gen_' + platform, 'done')
  } catch (e) {
    state.assets[platform] = { status: 'error', error: (e.message || 'Generation failed').slice(0, 300), generated_at: new Date().toISOString() }
    setStep(state, 'gen_' + platform, 'error')
  }
  await saveState(newsId, state)
  if (state.platforms.every(p => state.assets[p] && (state.assets[p].status === 'done' || state.assets[p].status === 'error'))) {
    setStep(state, 'qa', 'active'); runQualityChecks(state); setStep(state, 'qa', 'done')
    await finalizeCampaign(state)
  }
  await saveState(newsId, state)
  return { ok: true, state }
}

export async function updateCampaignAsset(newsId, platform, patch) {
  const state = await getCampaignState(newsId)
  if (!state) return { ok: false, error: 'No campaign' }
  const asset = state.assets[platform]
  if (!asset) return { ok: false, error: 'No asset for ' + platform }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) asset[k] = v
  asset.edited_at = new Date().toISOString()
  await saveState(newsId, state)
  await finalizeCampaign(state)
  return { ok: true, state }
}

// ---- Scheduling & publishing ----
export async function scheduleCampaignAssets(newsId, platforms, when) {
  const state = await getCampaignState(newsId)
  if (!state) return { ok: false, error: 'No campaign' }
  const list = Array.isArray(platforms) ? platforms : state.platforms
  for (const p of list) {
    const a = state.assets[p]
    if (!a) continue
    a.scheduled_for = when ? new Date(when).toISOString() : null
    a.status = when ? 'scheduled' : a.status
  }
  await saveState(newsId, state)
  return { ok: true, state }
}

export async function publishCampaignAssets(newsId, platforms) {
  const state = await getCampaignState(newsId)
  if (!state) return { ok: false, error: 'No campaign' }
  const list = Array.isArray(platforms) ? platforms : state.platforms
  const results = []
  for (const p of list) {
    const asset = state.assets[p]
    if (!asset || (asset.status !== 'done' && asset.status !== 'scheduled')) { results.push({ platform: p, ok: false, error: 'not generated' }); continue }
    try {
      const r = await publishCampaignAsset(newsId, state, p, asset)
      results.push({ platform: p, ...r })
      asset.status = r.ok ? 'published' : 'error'
      asset.publish_error = r.ok ? null : (r.error || '').slice(0, 300)
      asset.publish_results = r.ok ? r : null
      if (r.ok) asset.published_at = new Date().toISOString()
      await saveState(newsId, state)
    } catch (e) {
      asset.status = 'error'; asset.publish_error = (e.message || '').slice(0, 300)
      results.push({ platform: p, ok: false, error: e.message })
      await saveState(newsId, state)
    }
  }
  // After publishing social assets, reflect status on the news post
  try {
    const published = list.filter(p => state.assets[p]?.status === 'published')
    if (published.length) {
      const item = await storage.newsPosts.get(newsId)
      if (item && item.status !== 'published') await storage.newsPosts.update(newsId, { status: 'published', published_at_actual: new Date().toISOString() })
    }
  } catch {}
  return { ok: true, results }
}

async function publishCampaignAsset(newsId, state, platform, asset) {
  if (platform === 'blog') {
    const { publishToInsights } = await import('../blog/generate')
    const r = await publishToInsights({
      title: asset.title, content: asset.body_markdown, excerpt: asset.seo_description || '',
      category: 'news', coverImage: '', tags: asset.tags || [], status: 'published',
    })
    return { ok: true, url: r.url, id: r.id }
  }
  const meta = CAMPAIGN_PLATFORMS.find(m => m.key === platform)
  if (meta?.publishable) {
    const { publishJob } = await import('../publishers')
    const tempJob = {
      id: `news_${newsId}_${platform}`, platform_posts: { [platform]: asset },
      image_ref: state.research?.pack?.image_url || state.research?.pack?.url ? (state.hero_image || '') : '',
      publish_results: {}, warnings: [],
    }
    const r = await publishJob(tempJob, { platforms: [platform] })
    const okR = r.results?.[0]
    if (!okR?.ok) throw new Error(okR?.error || 'Publish failed')
    return { ok: true, url: okR.url || okR.post_url || '', post_id: okR.post_id || okR.id || '' }
  }
  if (platform === 'telegram_summary') {
    const { sendMessage } = await import('../telegram/client')
    const settings = await storage.settings.get()
    const chatId = settings.telegram_admin_chat_id || process.env.TELEGRAM_ADMIN_CHAT_ID
    if (chatId) await sendMessage({ chatId, text: asset.text || asset.caption }).catch(() => {})
  }
  // newsletter / carousel / image_prompt have no external destination — mark exported
  return { ok: true, exported: true, note: 'No external destination — saved to campaign' }
}

function platformLabel(key) {
  return CAMPAIGN_PLATFORMS.find(p => p.key === key)?.label || key
}

function escapeHtml(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---- Resume any running campaigns (called by the scheduler + webhooks) ----
export async function resumeRunningCampaigns(budgetMs = 9000) {
  const idx = await storage.appState.get('news_campaigns:index', {}) || {}
  const list = idx.ids || []
  let resumed = 0
  for (const id of list) {
    const state = await getCampaignState(id)
    if (!state || state.status !== 'running') continue
    if (resumed >= 2) break
    await startOrContinueCampaign(id, { budgetMs })
    resumed++
  }
  return { resumed }
}

export async function indexRunningCampaign(newsId) {
  const idx = await storage.appState.get('news_campaigns:index', {}) || {}
  const ids = idx.ids || []
  if (!ids.includes(newsId)) await storage.appState.set('news_campaigns:index', { ids: [...ids, newsId] })
}
