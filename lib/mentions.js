import { supabase } from './supabase'

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
        const existing = await supabase().from('mentions').select('id').eq('url', link).maybeSingle()
        if (!existing.data) {
          const { data } = await supabase().from('mentions').insert({
            source: 'google_news',
            url: link,
            title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
            snippet: desc.replace(/<!\[CDATA\[|\]\]>/g, '').slice(0, 500),
            matched_keyword: kw,
          }).select().single()
          if (data) results.push(data)
        }
      }
    } catch (e) { console.warn('[mentions] search failed:', e.message) }
  }
  return results
}

export async function listMentions() {
  const { data } = await supabase().from('mentions').select('*').order('discovered_at', { ascending: false }).limit(50)
  return data || []
}
