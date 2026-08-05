import { storage } from './storage'
import { callAi } from './ai/providers'

const STOPWORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and','any','are','arent',
  'as','at','be','because','been','before','being','below','between','both','but','by',
  'can','cant','cannot','could','couldnt','did','didnt','do','does','doesnt','doing','dont',
  'down','during','each','few','for','from','further','had','hadnt','has','hasnt','have',
  'havent','having','he','hed','hell','hes','her','here','heres','hers','herself','him',
  'himself','his','how','hows','i','id','ill','im','ive','if','in','into','is','isnt','it',
  'its','itself','lets','me','more','most','mustnt','my','myself','no','nor','not','of',
  'off','on','once','only','or','other','ought','our','ours','ourselves','out','over','own',
  'same','shant','she','shed','shell','shes','should','shouldnt','so','some','such','than',
  'that','thats','the','their','theirs','them','themselves','then','there','theres','these',
  'they','theyd','theyll','theyre','theyve','this','those','through','to','too','under',
  'until','up','very','was','wasnt','we','wed','well','were','weve','werent','what','whats',
  'when','whens','where','wheres','which','while','who','whos','whom','why','whys','with',
  'wont','would','wouldnt','you','youd','youll','youre','youve','your','yours','yourself',
  'yourselves','just','also','get','got','going','one','two','new','way','ways','use',
  'using','used','like','make','made','may','might','us','things','thing','really','much',
  'many','will','could','should','need','needs','want','wants','etc','ever','never','yet',
  'instead','without','within','upon','here','there','other','another',
])

function cleanText(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*`~\-_|]+/g, ' ')
    .replace(/[\n\r]+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9']+/g) || []).filter(t => t.length > 2 && !STOPWORDS.has(t))
}

function termFrequencies(text) {
  const tokens = tokenize(text)
  const freq = new Map()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  const bigrams = new Map()
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i]
    const b = tokens[i + 1]
    if (a === b) continue
    const bg = `${a} ${b}`
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1)
  }
  return { freq, bigrams }
}

function capFirst(s) {
  const str = String(s || '').trim()
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

function slugify(s) {
  const base = String(s || '').toLowerCase().trim()
  if (!base) return 'article'
  const slug = base
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.slice(0, 80) || 'article'
}

function clampLen(s, max) {
  const str = String(s || '').trim()
  if (str.length <= max) return str
  const cut = str.slice(0, max - 1)
  const idx = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('-'))
  return (idx > max * 0.6 ? cut.slice(0, idx) : cut).trim() + '…'
}

function cleanString(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function cleanStrings(input, fallback, max) {
  const out = []
  for (const item of Array.isArray(input) ? input : []) {
    if (typeof item !== 'string') continue
    const s = item.trim()
    if (s && !out.includes(s)) out.push(s)
    if (out.length >= max) break
  }
  return out.length ? out : (fallback || []).slice(0, max)
}

function cleanFaqs(input, fallback) {
  const out = []
  for (const item of Array.isArray(input) ? input : []) {
    if (!item || typeof item !== 'object') continue
    const q = cleanString(item.question || item.q)
    const a = cleanString(item.answer || item.a)
    if (q && a && !out.some(f => f.question === q)) out.push({ question: q, answer: a })
    if (out.length >= 5) break
  }
  return out.length >= 3 ? out : (fallback || [])
}

function pickPrimaryKeyword(title, content) {
  const tf = termFrequencies(content)
  const tfTitle = termFrequencies(title)
  let bestWord = ''
  let bestWordScore = 0
  for (const [w, c] of tf.freq) {
    const score = c + (tfTitle.freq.get(w) || 0) * 3
    if (score > bestWordScore) { bestWordScore = score; bestWord = w }
  }
  let bestBigram = ''
  let bestBigramScore = 0
  for (const [b, c] of tf.bigrams) {
    const score = c + (tfTitle.bigrams.get(b) || 0) * 3
    if (score > bestBigramScore) { bestBigramScore = score; bestBigram = b }
  }
  if (bestBigram && bestBigramScore >= 2 && bestBigramScore * 0.9 >= bestWordScore) return bestBigram
  if (bestWord) return bestWord
  const titleTokens = tokenize(title)
  if (titleTokens.length >= 2) return `${titleTokens[0]} ${titleTokens[1]}`
  if (titleTokens.length === 1) return titleTokens[0]
  if (title) return String(title).split(/\s+/).slice(0, 3).join(' ').toLowerCase()
  return 'article'
}

function pickSecondary(title, content, primary, count) {
  const tf = termFrequencies(content)
  const tfTitle = termFrequencies(title)
  const candidates = []
  for (const [w, c] of tf.freq) {
    if (w === primary || primary.includes(w)) continue
    candidates.push({ term: w, score: c + (tfTitle.freq.get(w) || 0) * 2 })
  }
  for (const [b, c] of tf.bigrams) {
    if (b === primary) continue
    candidates.push({ term: b, score: c + (tfTitle.bigrams.get(b) || 0) * 2 })
  }
  candidates.sort((a, b) => b.score - a.score)
  const out = []
  for (const c of candidates) {
    if (out.some(o => o.includes(c.term) || c.term.includes(o))) continue
    out.push(c.term)
    if (out.length >= count) break
  }
  return out
}

function buildLongTail(primary, secondary) {
  const out = [`${primary} guide`, `best ${primary} tips`]
  if (secondary[0]) out.push(`${primary} for ${secondary[0]}`)
  else out.push(`${primary} for beginners`)
  return out.slice(0, 3)
}

function detectIntent(title, content) {
  const text = `${title} ${content}`.toLowerCase()
  if (/\bhow (to|can|do|does|should|would)\b/.test(text) || /^\s*how\b/.test(text)) return 'how-to'
  if (/\b(vs\.?|versus|compare|comparison|alternative|best)\b/.test(text)) return 'comparison'
  if (/\b(guide|tutorial|learn|explain|understand|walkthrough|beginner)\b/.test(text)) return 'educational'
  return 'informational'
}

function extractEntities(title, content, primary) {
  const text = `${title}\n${content}`
  const counts = new Map()
  const titleTokens = new Set(tokenize(title))
  for (const m of text.match(/\b[A-Z][a-zA-Z0-9]{1,}/g) || []) {
    const lower = m.toLowerCase()
    if (STOPWORDS.has(lower) || m.length < 3) continue
    counts.set(lower, (counts.get(lower) || 0) + 1)
  }
  const out = []
  const primaryLower = primary.toLowerCase()
  for (const [w, c] of [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)) {
    if (w === primaryLower || w.startsWith(primaryLower)) continue
    if (c >= 2 || titleTokens.has(w)) {
      out.push(capFirst(w))
      if (out.length >= 5) break
    }
  }
  if (out.length < 3) {
    const tf = termFrequencies(`${title} ${content}`)
    for (const [w] of [...tf.freq.entries()].sort((a, b) => b[1] - a[1])) {
      if (w === primaryLower || out.some(o => o.toLowerCase() === w)) continue
      out.push(capFirst(w))
      if (out.length >= 3) break
    }
  }
  return out.slice(0, 5)
}

async function internalLinkSuggestions(keywords, max = 3) {
  try {
    const jobs = await storage.jobs.list({})
    const kws = (keywords || []).map(k => String(k).toLowerCase()).filter(Boolean)
    const scored = []
    const seen = new Set()
    for (const job of jobs) {
      const topic = String(job.topic || '').trim()
      if (!topic || seen.has(topic.toLowerCase())) continue
      const topicLower = topic.toLowerCase()
      let score = 0
      for (const kw of kws) {
        if (topicLower.includes(kw)) score += kw.split(' ').length
        else if (kw.split(' ').some(t => topicLower.includes(t))) score += 0.5
      }
      if (score > 0) {
        seen.add(topicLower)
        scored.push({ job_id: job.id, topic, url: job.cross_link_url || null, score })
      }
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, max).map(({ score, ...rest }) => rest)
  } catch (e) {
    return []
  }
}

function buildMetaTitle(title, kw) {
  const clean = String(title || '').replace(/\s+/g, ' ').trim()
  const kwCap = capFirst(kw)
  if (clean.toLowerCase().includes(kw) && clean.length <= 60) return clean
  const combined = `${kwCap}: ${clean}`
  if (combined.length <= 60) return combined
  return clampLen(combined, 60)
}

function buildMetaDescription(content, kw, min = 120, max = 158) {
  const sentences = (cleanText(content).match(/[^.!?\n]+[.!?\s]*/g) || []).map(s => s.trim()).filter(s => s.length > 10)
  const kwLower = kw.toLowerCase()
  const kwSentences = sentences.filter(s => s.toLowerCase().includes(kwLower))
  const parts = kwSentences.length ? kwSentences : sentences.slice(0, 2)
  let desc = parts.join(' ')
  if (!desc.toLowerCase().includes(kwLower)) desc = `${capFirst(kw)} — ${desc}`.trim()
  if (desc.length > max) return clampLen(desc, max)
  let i = kwSentences.length ? sentences.findIndex(s => s === kwSentences[kwSentences.length - 1]) + 1 : 2
  while (desc.length < min && i < sentences.length) {
    const next = `${desc} ${sentences[i]}`.trim()
    if (next.length <= max) desc = next
    i++
  }
  if (desc.length < min) {
    const filler = ` This article covers practical insights, actionable steps, and expert guidance on ${kw} for readers seeking reliable, up-to-date information.`
    desc = clampLen(desc + filler, max)
  }
  return desc.trim()
}

function buildFaqs(content, kw) {
  const sentences = (cleanText(content).match(/[^.!?\n]+[.!?\s]*/g) || []).map(s => s.trim()).filter(s => s.length > 2)
  const faqs = []
  for (const q of sentences.filter(s => s.endsWith('?'))) {
    if (faqs.length >= 5) break
    const idx = sentences.indexOf(q)
    let answer = ''
    for (let i = idx + 1; i < Math.min(idx + 4, sentences.length); i++) {
      if (sentences[i].endsWith('?') || sentences[i].toLowerCase() === q.toLowerCase()) break
      answer = sentences[i]
      break
    }
    if (!answer) {
      answer = sentences.find(s => s.toLowerCase().includes(kw.toLowerCase()) && s !== q) || sentences.find(s => s !== q) || ''
    }
    if (answer) faqs.push({ question: q, answer })
  }
  const synth = [`What is ${kw}?`, `Why is ${kw} important?`, `How can I improve ${kw}?`, `What are common ${kw} mistakes?`]
  let guard = 0
  while (faqs.length < 3 && guard < 4) {
    const q = synth[faqs.length] || synth[3]
    if (faqs.some(f => f.question === q)) break
    const answer = sentences.find(s => s.toLowerCase().includes(kw.toLowerCase())) || sentences[0] || `This article explains ${kw} in practical, actionable detail.`
    faqs.push({ question: q, answer })
    guard++
  }
  return faqs.slice(0, 5)
}

function buildArticleSchema({ title, description, keywords, wordCount, slug, faqs }) {
  const now = new Date().toISOString()
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    keywords: keywords.join(', '),
    wordCount,
    inLanguage: 'en',
    datePublished: now,
    dateModified: now,
    author: { '@type': 'Person', name: 'Editorial Team' },
    publisher: { '@type': 'Organization', name: 'Ishaan Social Forage' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `/blog/${slug}` },
    about: faqs.map(f => f.question),
  }
}

function buildEeat(content) {
  const text = cleanText(content).toLowerCase()
  const notes = []
  if (/\b(i|we|my|our|me)\b/.test(text)) {
    notes.push('Experience: first-person perspective present')
  } else {
    notes.push('Experience: no first-person perspective found — add personal examples')
  }
  const hasStats = /\d+%|\b\d+\s*(times|years|users|people|hours|days)\b/.test(text)
  const hasSources = (/\[[^\]]*\]\([^)]*\)/g.test(content) || /\b(study|research|report|survey)\b/.test(text))
  if (hasStats || hasSources) {
    notes.push('Authority: data points or sources present')
  } else {
    notes.push('Authority: missing citations or statistics — add credible sources')
  }
  const hasDate = /(20\d\d|january|february|march|april|may|june|july|august|september|october|november|december)/.test(text)
  const hasCred = /\b(ceo|founder|expert|certified|experienced|author|analyst|specialist|researcher)\b/.test(text)
  if (hasDate && hasCred) notes.push('Trust: recency and author credentials present')
  else if (hasDate) notes.push('Trust: recency present, author credentials not explicit')
  else notes.push('Trust: add author bio and publish date to build trust')
  return notes
}

function parseAiJson(raw) {
  if (!raw) return null
  let s = String(raw).trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try { return JSON.parse(s.slice(start, end + 1)) } catch (e) { return null }
}

function mergePackage(base, ai) {
  const kw = cleanString(ai.primary_keyword) || base.primary_keyword
  const secondary = cleanStrings(ai.secondary_keywords, base.secondary_keywords, 3)
  const longTail = cleanStrings(ai.long_tail_keywords, base.long_tail_keywords, 3)
  const intent = ['informational', 'educational', 'comparison', 'how-to'].includes(ai.search_intent) ? ai.search_intent : base.search_intent
  const entities = cleanStrings(ai.entities, base.entities, 5)
  const internalLinks = Array.isArray(ai.internal_links) && ai.internal_links.length ? ai.internal_links.slice(0, 3) : base.internal_links
  let metaTitle = clampLen(cleanString(ai.meta_title) || base.meta_title, 60)
  if (!metaTitle.toLowerCase().includes(kw.toLowerCase())) metaTitle = base.meta_title
  let metaDesc = cleanString(ai.meta_description)
  if (metaDesc.length < 100 || metaDesc.length > 158 || !metaDesc.toLowerCase().includes(kw.toLowerCase())) {
    metaDesc = base.meta_description
  } else {
    metaDesc = clampLen(metaDesc, 158)
  }
  const slug = slugify(cleanString(ai.slug) || base.slug)
  const faqs = cleanFaqs(ai.faqs, base.faqs)
  const schema = ai.schema_jsonld && typeof ai.schema_jsonld === 'object' && ai.schema_jsonld['@type'] ? ai.schema_jsonld : base.schema_jsonld
  const eeat = cleanStrings(ai.eeat, base.eeat, 3)
  return {
    primary_keyword: kw,
    secondary_keywords: secondary,
    long_tail_keywords: longTail,
    search_intent: intent,
    entities,
    internal_links: internalLinks,
    meta_title: metaTitle,
    meta_description: metaDesc,
    slug,
    faqs,
    schema_jsonld: schema,
    eeat,
  }
}

async function enhanceWithAi(base, title, content) {
  try {
    const providers = await storage.providers.list()
    const active = providers.find(p => p.active_for_text && p.api_key && p.model)
    if (!active) return base
    const prompt = [
      'You are an expert SEO analyst. Improve the deterministic SEO package below for the article titled "' + String(title) + '".',
      'Return ONLY valid JSON with exactly these keys: primary_keyword, secondary_keywords (array), long_tail_keywords (array), search_intent (one of informational|educational|comparison|how-to), entities (array), internal_links (array), meta_title, meta_description, slug, faqs (array of {question, answer}), schema_jsonld (valid Article schema object), eeat (array of strings).',
      'Current package: ' + JSON.stringify(base),
      'Article content: ' + String(content).slice(0, 6000),
    ].join('\n')
    const raw = await callAi({ provider: active, prompt, json: true, maxTokens: 2048, timeoutMs: 30000 })
    const parsed = parseAiJson(raw)
    if (!parsed) return base
    return mergePackage(base, parsed)
  } catch (e) {
    return base
  }
}

async function buildDeterministic(title, content, platform) {
  try {
    const kw = pickPrimaryKeyword(title, content)
    const secondary = pickSecondary(title, content, kw, 3)
    const longTail = buildLongTail(kw, secondary)
    const intent = detectIntent(title, content)
    const entities = extractEntities(title, content, kw)
    const internalLinks = await internalLinkSuggestions([kw, ...secondary, ...longTail], 3)
    const metaTitle = buildMetaTitle(title, kw)
    const metaDescription = buildMetaDescription(content, kw)
    const slug = slugify(kw)
    const faqs = buildFaqs(content, kw)
    const eeat = buildEeat(content)
    const wordCount = tokenize(cleanText(content)).length
    const schema = buildArticleSchema({
      title: title || metaTitle,
      description: metaDescription,
      keywords: [kw, ...secondary, ...longTail],
      wordCount,
      slug,
      faqs,
    })
    return {
      primary_keyword: kw,
      secondary_keywords: secondary,
      long_tail_keywords: longTail,
      search_intent: intent,
      entities,
      internal_links: internalLinks,
      meta_title: metaTitle,
      meta_description: metaDescription,
      slug,
      faqs,
      schema_jsonld: schema,
      eeat,
    }
  } catch (e) {
    return {
      primary_keyword: pickPrimaryKeyword(title, content),
      secondary_keywords: pickSecondary(title, content, pickPrimaryKeyword(title, content), 3),
      long_tail_keywords: buildLongTail(pickPrimaryKeyword(title, content), pickSecondary(title, content, pickPrimaryKeyword(title, content), 3)),
      search_intent: detectIntent(title, content),
      entities: extractEntities(title, content, pickPrimaryKeyword(title, content)),
      internal_links: [],
      meta_title: buildMetaTitle(title, pickPrimaryKeyword(title, content)),
      meta_description: buildMetaDescription(content, pickPrimaryKeyword(title, content)),
      slug: slugify(pickPrimaryKeyword(title, content)),
      faqs: buildFaqs(content, pickPrimaryKeyword(title, content)),
      schema_jsonld: null,
      eeat: buildEeat(content),
    }
  }
}

export async function buildSeoPackage({ title, content, platform = 'blog' } = {}) {
  const t = String(title || '').trim()
  const c = String(content || '')
  const base = await buildDeterministic(t, c, platform)
  return await enhanceWithAi(base, t, c)
}

export async function optimizeBlog({ title, body_markdown, seo_description, slug } = {}) {
  const t = String(title || '').trim()
  const body = String(body_markdown || '')
  const meta = String(seo_description || '').trim()
  const wordCount = tokenize(cleanText(body)).length
  const issues = []
  const fixes = []
  let score = 0

  const tl = t.length
  if (tl >= 30 && tl <= 65) {
    score += 15
  } else if (tl < 30) {
    issues.push(`Title is ${tl} characters (target 30-65).`)
    fixes.push(`Expand the title to at least 30 characters; e.g. "${t || 'Untitled'} — A Complete Guide".`)
  } else {
    issues.push(`Title is ${tl} characters (target 30-65).`)
    fixes.push('Trim the title to under 65 characters while keeping your primary keyword.')
  }

  const ml = meta.length
  if (ml >= 120 && ml <= 165) {
    score += 15
  } else if (ml === 0) {
    issues.push('Meta description is missing (target 120-165 characters).')
    fixes.push('Write a meta description of 120-165 characters that includes the primary keyword and a clear benefit.')
  } else if (ml < 120) {
    issues.push(`Meta description is ${ml} characters (target 120-165).`)
    fixes.push(`Extend the meta description to 120+ characters; add the primary keyword and benefit. Current: "${meta}".`)
  } else {
    issues.push(`Meta description is ${ml} characters (target 120-165).`)
    fixes.push('Shorten the meta description to under 165 characters while keeping the primary keyword near the start.')
  }

  const h2Count = (body.match(/^##\s+.+$/gm) || []).length
  if (h2Count >= 3) {
    score += 15
  } else {
    issues.push(`${h2Count} H2 heading(s) found (need at least 3).`)
    fixes.push(`Add ${Math.max(3 - h2Count, 1)} or more H2 headings, e.g. "## What is ...", "## How to ...", "## Key takeaways".`)
  }

  if (wordCount >= 800) {
    score += 15
  } else {
    issues.push(`Word count is ${wordCount} (need at least 800).`)
    fixes.push(`Expand the article by ${800 - wordCount} words: add examples, step-by-step sections, and a FAQ.`)
  }

  const kw = pickPrimaryKeyword(t, body)
  const bodyLower = body.toLowerCase()
  const kwCount = bodyLower.split(kw.toLowerCase()).length - 1
  const inTitle = t.toLowerCase().includes(kw.toLowerCase())
  const inMeta = meta.toLowerCase().includes(kw.toLowerCase())
  if (inTitle && kwCount >= 1) {
    score += 20
  } else if (kwCount >= 1 || inTitle || inMeta) {
    score += 10
    issues.push(`Primary keyword "${kw}" appears ${kwCount} time(s) and is not in the title.`)
    fixes.push(`Add "${kw}" to the title, meta description, first paragraph, and at least one H2 heading.`)
  } else {
    issues.push(`Primary keyword "${kw}" is not used in the title or body.`)
    fixes.push(`Use "${kw}" in the title, meta description, first paragraph, and 1-2 H2 headings.`)
  }

  const links = [...body.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)].map(m => m[1])
  const internal = links.filter(u => u.startsWith('/') || /^https?:\/\/(www\.)?[^/]+\/?$/i.test(u))
  if (internal.length >= 2) {
    score += 10
  } else {
    issues.push(`${internal.length} internal link(s) found (need at least 2).`)
    fixes.push(links.length
      ? 'Convert some external links to internal links pointing to related articles on the same domain.'
      : 'Add 2+ internal links to related articles to distribute authority and guide readers.')
  }

  const faqHeading = /^##\s*faq/i.test(body)
  const faqLines = body.split(/\r?\n/).filter(l => l.trim().endsWith('?')).length
  if (faqHeading || faqLines >= 2) {
    score += 10
  } else {
    issues.push('No FAQ section detected.')
    fixes.push('Add a "## FAQ" section with 3-5 question/answer pairs related to the primary keyword.')
  }

  return { score, issues, fixes }
}
