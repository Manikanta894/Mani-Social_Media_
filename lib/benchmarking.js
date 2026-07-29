import { supabase } from './supabase'

const DEFAULT_PEERS = [
  { name: 'SHRM', feed_url: 'https://www.shrm.org/resources/pages/rss.aspx' },
  { name: 'HBR', feed_url: 'https://hbr.org/rss/feed.xml' },
  { name: 'People Matters', feed_url: 'https://www.peoplematters.in/feed' },
]

export async function checkPeers() {
  const results = []
  for (const peer of DEFAULT_PEERS) {
    try {
      const res = await fetch(peer.feed_url, { signal: AbortSignal.timeout(10000) })
      const text = await res.text()
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || []
      const recentItems = items.slice(0, 5).map(item => {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        return { title: title.replace(/<!\[CDATA\[|\]\]>/g, ''), published: pubDate }
      })
      results.push({ peer: peer.name, post_count: items.length, recent: recentItems })
    } catch (e) { results.push({ peer: peer.name, error: e.message }) }
  }
  return results
}

export async function getPostingGap() {
  const benchmarks = await checkPeers()
  const avgPeerPosts = benchmarks.filter(b => b.post_count).reduce((s, b) => s + b.post_count, 0) / Math.max(benchmarks.filter(b => b.post_count).length, 1)
  const { count } = await supabase().from('content_jobs').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).eq('status', 'published')
  const myPosts = count || 0
  return {
    my_posts_last_30_days: myPosts,
    avg_peer_posts_last_30_days: Math.round(avgPeerPosts),
    gap: Math.round(avgPeerPosts) - myPosts,
    recommendation: myPosts < avgPeerPosts ? `Post ${Math.round(avgPeerPosts) - myPosts} more times to match peer average` : 'You\'re matching or exceeding peer average',
    peers: benchmarks,
  }
}
