import { storage } from '../storage'

const DEFAULT_SOURCES = [
  { name: 'SHRM', url: 'https://www.shrm.org/resources/pages/rss.aspx', type: 'rss', category: 'hr', check_interval: 60 },
  { name: 'Harvard Business Review', url: 'https://hbr.org/rss/feed.xml', type: 'rss', category: 'hr', check_interval: 60 },
  { name: 'LinkedIn Economic Graph', url: 'https://www.linkedin.com/pulse/topic/economic-graph', type: 'rss', category: 'hr', check_interval: 120 },
  { name: 'People Matters', url: 'https://www.peoplematters.in/feed', type: 'rss', category: 'hr', check_interval: 60 },
  { name: 'HR Dive', url: 'https://www.hrdive.com/feeds/news/', type: 'rss', category: 'hr', check_interval: 60 },
  { name: 'AI in HR', url: 'https://www.hrtechnologist.com/rss/tag/artificial-intelligence/', type: 'rss', category: 'tech', check_interval: 120 },
  { name: 'Workforce Analytics', url: 'https://www.workforce.com/feed', type: 'rss', category: 'hr', check_interval: 120 },
]

export async function seedNewsSources() {
  const existing = await storage.newsSources.list()
  const existingUrls = new Set(existing.map(s => s.url))
  let created = 0
  for (const src of DEFAULT_SOURCES) {
    if (existingUrls.has(src.url)) continue
    await storage.newsSources.create(src)
    created++
  }
  return { seeded: created, total: DEFAULT_SOURCES.length }
}
