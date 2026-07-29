import { storage } from '../storage'
import { callAi } from '../ai/providers'

const CATEGORY_KEYWORDS = {
  hr: ['hiring', 'recruitment', 'employee', 'workforce', 'talent', 'human resources', 'hr ', 'workplace', 'culture', 'engagement', 'retention', 'benefits', 'compensation', 'diversity', 'inclusion', 'dei', 'training', 'development', 'leadership', 'management', 'performance', 'labor', 'compliance', 'people analytics', 'people ops', 'hr tech', 'remote work', 'hybrid work', 'work from home', 'resignation', 'attrition', 'onboarding', 'payroll', 'wellness', 'mental health', 'upskilling', 'reskilling'],
  tech: ['ai', 'artificial intelligence', 'machine learning', 'automation', 'technology', 'digital', 'software', 'data', 'analytics', 'platform', 'innovation', 'tech', 'saas', 'cloud', 'api', 'algorithm', 'chatbot', 'nlp', 'gpt', 'llm', 'deep learning'],
}

function isRelevant(title, summary, category) {
  const keywords = CATEGORY_KEYWORDS[category]
  if (!keywords) return true
  const text = `${title} ${summary}`.toLowerCase()
  return keywords.some(kw => text.includes(kw))
}

export async function fetchRssFeed(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SocialForge/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
  const xml = await res.text()

  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const get = (tag) => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item)
      return m ? m[1].trim() : ''
    }
    const title = get('title')
    if (!title) continue
    items.push({
      title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
      url: get('link'),
      summary: get('description').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').slice(0, 1000),
      content: get('content:encoded').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').slice(0, 3000),
      author: get('author') || get('dc:creator'),
      image_url: (() => {
        const encMatch = /<enclosure[^>]*url="([^"]+)"/i.exec(item)
        if (encMatch) return encMatch[1]
        const imgMatch = /<media:content[^>]*url="([^"]+)"/i.exec(item)
        if (imgMatch) return imgMatch[1]
        const descMatch = /<img[^>]+src="([^"]+)"/i.exec(get('description'))
        return descMatch ? descMatch[1] : null
      })(),
      published_at: get('pubDate') || get('dc:date'),
    })
  }

  return items
}

export async function checkNewsSources() {
  const sources = await storage.newsSources.listActive()
  const allItems = []
  for (const source of sources) {
    try {
      const items = await fetchRssFeed(source.url)
      for (const item of items) {
        const exists = await storage.newsPosts.findByUrl(item.url)
        if (exists) continue
        if (!isRelevant(item.title, item.summary, source.category)) continue
        allItems.push({ ...item, source_id: source.id, source_name: source.name, category: source.category })
      }
      await storage.newsSources.touch(source.id)
    } catch (e) {
      console.warn(`[news] source "${source.name}" failed:`, e.message)
    }
  }
  return allItems
}

export async function detectTrending(items) {
  if (items.length === 0) return []
  const prompt = `Analyze these news headlines and identify which are trending or most impactful for social media. Return JSON array of indices (0-based) that are trending.

Headlines:
${items.map((item, i) => `${i}: ${item.title}`).join('\n')}

Respond with JSON: { "trending_indices": [0, 2, ...], "reason": "brief explanation" }`
  try {
    const providers = await storage.providers.list()
    const textProvider = providers.find(p => p.active_for_text)
    if (!textProvider) return items.map(i => ({ ...i, is_trending: false }))
    const raw = await callAi({ provider: textProvider, prompt, json: true })
    const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim())
    const trendingSet = new Set(parsed.trending_indices || [])
    return items.map((item, i) => ({ ...item, is_trending: trendingSet.has(i) }))
  } catch {
    return items.map(i => ({ ...i, is_trending: false }))
  }
}

export async function runNewsCheck() {
  const rawItems = await checkNewsSources()
  if (rawItems.length === 0) return { checked: 0, new: 0 }
  const enriched = await detectTrending(rawItems)
  let created = 0
  for (const item of enriched) {
    await storage.newsPosts.create({
      source_id: item.source_id,
      source_name: item.source_name,
      title: item.title,
      url: item.url,
      summary: item.summary,
      content: item.content,
      image_url: item.image_url,
      author: item.author,
      published_at: item.published_at ? new Date(item.published_at).toISOString() : null,
      category: item.category,
      is_trending: item.is_trending,
      status: 'new',
    })
    created++
  }
  return { checked: rawItems.length, new: created }
}
