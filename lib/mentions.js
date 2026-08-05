import { storage } from './storage'

const DEFAULT_KEYWORDS = ['Ishaan', 'Ishaan Social', 'SocialForge']

export async function checkMentions() {
  const keywords = DEFAULT_KEYWORDS
  const results = []
  for (const kw of keywords) {
    try {
      const res = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(kw)}&hl=en-IN&gl=IN&ceid=IN:en`, {
        signal: AbortSignal.timeout(10000),
      })
      const text = await res.text()
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items.slice(0, 5)) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || ''
        const existing = await storage.mentions.findByUrl(link)
        if (!existing) {
          const data = await storage.mentions.create({
            source: 'google_news',
            url: link,
            title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
            snippet: desc.replace(/<!\[CDATA\[|\]\]>/g, '').slice(0, 500),
            matched_keyword: kw,
          })
          results.push(data)
        }
      }
    } catch (e) { console.warn('[mentions] search failed:', e.message) }
  }
  return results
}

export async function listMentions() {
  return await storage.mentions.list()
}
