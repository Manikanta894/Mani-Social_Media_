import { storage } from './storage'
import { sendMessage } from './telegram/client'
import { callAi } from './ai/providers'

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'threads']

async function fetchLinkedInStats(postId) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (!token || !postId) return null
  const urn = encodeURIComponent(postId)
  try {
    const res = await fetch(`https://api.linkedin.com/v2/ugcPosts/${urn}/lifetimeShareStatistics?projection=(shares*)`, { headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' } })
    if (!res.ok) return null
    const data = await res.json()
    const shares = data?.shares?.[0] || {}
    return { impressions: shares.impressionCount || 0, likes: shares.likeCount || 0, comments: shares.commentCount || 0, shares: shares.shareCount || 0, saves: 0, reach: 0, clicks: 0, profile_visits: 0 }
  } catch { return null }
}

async function fetchFacebookStats(postId) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !postId) return null
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${postId}/insights?metric=post_impressions,post_impressions_unique,post_reactions_by_type_total,post_comments,post_shares&access_token=${token}`)
    if (!res.ok) return null
    const data = await res.json()
    const map = {}
    for (const row of data.data || []) {
      const val = row.values?.[0]?.value
      if (row.name === 'post_impressions') map.impressions = typeof val === 'number' ? val : 0
      if (row.name === 'post_impressions_unique') map.reach = typeof val === 'number' ? val : 0
      if (row.name === 'post_comments') map.comments = typeof val === 'number' ? val : 0
      if (row.name === 'post_shares') map.shares = typeof val === 'number' ? val : 0
      if (row.name === 'post_reactions_by_type_total') { const total = Object.values(val || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0); map.likes = total }
    }
    return { ...map, saves: 0, clicks: 0, profile_visits: 0 }
  } catch { return null }
}

async function fetchInstagramStats(mediaId) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !mediaId) return null
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${mediaId}/insights?metric=impressions,reach,likes,comments,saved&access_token=${token}`)
    if (!res.ok) return null
    const data = await res.json()
    const map = {}
    for (const row of data.data || []) {
      const val = row.values?.[0]?.value
      if (row.name === 'impressions') map.impressions = typeof val === 'number' ? val : 0
      if (row.name === 'reach') map.reach = typeof val === 'number' ? val : 0
      if (row.name === 'likes') map.likes = typeof val === 'number' ? val : 0
      if (row.name === 'comments') map.comments = typeof val === 'number' ? val : 0
      if (row.name === 'saved') map.saves = typeof val === 'number' ? val : 0
    }
    return { ...map, shares: 0, clicks: 0, profile_visits: 0 }
  } catch { return null }
}

async function fetchOne(job) {
  const results = job.publish_results || {}
  const stats = []
  for (const platform of PLATFORMS) {
    const pr = results[platform]
    if (!pr?.post_id) continue
    let data
    if (platform === 'linkedin') data = await fetchLinkedInStats(pr.post_id)
    else if (platform === 'facebook') data = await fetchFacebookStats(pr.post_id)
    else if (platform === 'instagram') data = await fetchInstagramStats(pr.post_id)
    if (data) {
      const row = { job_id: job.id, platform, checked_at: new Date().toISOString(), ...data }
      await storage.postDetails.upsert(row)
      await storage.postDetails.upsert({ job_id: job.id, platform, ...data, caption: (job.platform_posts?.[platform]?.caption || '').slice(0, 500), checked_at: new Date().toISOString() })
      stats.push(row)
    }
  }
  return stats
}

export async function fetchAllStats() {
  const jobs = await storage.jobs.list()
  const published = jobs.filter(j => j.status === 'published' || j.published_at)
  const results = []
  for (const job of published) { const r = await fetchOne(job); results.push(...r) }
  return { fetched: results.length, results }
}

export async function getAggregatedStats() {
  const all = await storage.postDetails.list()
  const byPlatform = {}
  let totals = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, clicks: 0, profile_visits: 0 }
  for (const row of all) {
    byPlatform[row.platform] = byPlatform[row.platform] || { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: 0, clicks: 0, profile_visits: 0 }
    const p = byPlatform[row.platform]
    p.impressions += row.impressions || 0; p.reach += row.reach || 0; p.likes += row.likes || 0; p.comments += row.comments || 0
    p.shares += row.shares || 0; p.saves += row.saves || 0; p.clicks += row.clicks || 0; p.profile_visits += row.profile_visits || 0; p.posts++
    totals.impressions += row.impressions || 0; totals.reach += row.reach || 0; totals.likes += row.likes || 0
    totals.comments += row.comments || 0; totals.shares += row.shares || 0; totals.saves += row.saves || 0; totals.clicks += row.clicks || 0; totals.profile_visits += row.profile_visits || 0; totals.posts++
  }
  const engagement = totals.likes + totals.comments + totals.shares + totals.saves
  return { totals, byPlatform, engagement, engagement_rate: totals.impressions > 0 ? ((engagement / totals.impressions) * 100).toFixed(2) : 0, raw: all }
}

export async function getPostAnalytics() {
  const all = await storage.postDetails.list()
  const jobs = await storage.jobs.list()
  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]))
  return all.map(pd => ({ ...pd, caption: pd.caption || jobMap[pd.job_id]?.platform_posts?.[pd.platform]?.caption || '', image_ref: jobMap[pd.job_id]?.image_ref || null, published_at: jobMap[pd.job_id]?.published_at || null }))
}

export async function getHashtagAnalytics() {
  const all = await storage.postDetails.list()
  const jobs = await storage.jobs.list()
  const tagStats = {}
  for (const job of jobs) {
    if (!job.platform_posts) continue
    for (const [platform, post] of Object.entries(job.platform_posts)) {
      const tags = post?.hashtags || []
      for (const tag of tags) {
        if (!tagStats[tag]) tagStats[tag] = { tag, count: 0, total_impressions: 0, total_engagement: 0, platforms: new Set() }
        tagStats[tag].count++
        tagStats[tag].platforms.add(platform)
      }
    }
  }
  for (const row of all) {
    const job = jobs.find(j => j.id === row.job_id)
    if (!job?.platform_posts?.[row.platform]) continue
    const tags = job.platform_posts[row.platform].hashtags || []
    for (const tag of tags) {
      if (tagStats[tag]) { tagStats[tag].total_impressions += row.impressions || 0; tagStats[tag].total_engagement += (row.likes || 0) + (row.comments || 0) + (row.shares || 0) }
    }
  }
  return Object.values(tagStats).map(t => ({ ...t, platforms: [...t.platforms], avg_impressions: t.count > 0 ? Math.round(t.total_impressions / t.count) : 0, avg_engagement: t.count > 0 ? Math.round(t.total_engagement / t.count) : 0 }))
}

// AI Coach
export async function getCoachInsights() {
  const agg = await getAggregatedStats()
  const posts = await getPostAnalytics()
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) return { insight: 'No active text provider configured. Add one in Settings → AI Providers.', recommendations: [] }

  const topPosts = [...posts].sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))).slice(0, 3)
  const worstPosts = [...posts].sort((a, b) => ((a.likes || 0) + (a.comments || 0)) - ((b.likes || 0) + (b.comments || 0))).slice(0, 3)

  const prompt = `You are a social media analytics AI coach. Analyze this data and provide insights in plain English.

## Overall Stats
Total posts: ${agg.totals.posts}
Impressions: ${agg.totals.impressions}
Reach: ${agg.totals.reach}
Likes: ${agg.totals.likes}
Comments: ${agg.totals.comments}
Shares: ${agg.totals.shares}
Saves: ${agg.totals.saves}
Engagement Rate: ${agg.engagement_rate}%

## Per Platform
${Object.entries(agg.byPlatform).map(([p, d]) => `${p}: ${d.posts} posts, ${d.impressions} impressions, ${d.likes} likes, ${d.comments} comments`).join('\n')}

## Top Posts
${topPosts.map(p => `${p.platform}: "${(p.caption || '').slice(0, 100)}" — ${p.likes} likes, ${p.comments} comments, ${p.impressions} impressions`).join('\n')}

## Worst Posts
${worstPosts.map(p => `${p.platform}: "${(p.caption || '').slice(0, 100)}" — ${p.likes} likes, ${p.comments} comments, ${p.impressions} impressions`).join('\n')}

Respond with JSON:
{
  "insight": "2-3 sentence summary of overall performance",
  "recommendations": [
    { "category": "posting_time|content_format|platform_focus|hashtag_strategy|engagement", "text": "Specific actionable recommendation" }
  ],
  "best_time": "Best posting time based on data",
  "best_platform": "Top performing platform"
}`

  try {
    const raw = await callAi({ provider: textProvider, prompt, json: true })
    const parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim())
    return { insight: parsed.insight || 'No insights available.', recommendations: parsed.recommendations || [], best_time: parsed.best_time || 'N/A', best_platform: parsed.best_platform || 'N/A' }
  } catch {
    return { insight: 'AI analysis unavailable. Try again later.', recommendations: [] }
  }
}

// Daily/Weekly Report
export async function generateReport(type = 'daily') {
  const agg = await getAggregatedStats()
  const coach = await getCoachInsights()
  const s = await storage.settings.get()
  const { totals, byPlatform } = agg
  const lines = [`<b>📊 SocialForge — ${type === 'daily' ? 'Daily' : 'Weekly'} Analytics Report</b>`, '']
  lines.push(`<b>Posts tracked:</b> ${totals.posts}`)
  lines.push(`<b>Impressions:</b> ${totals.impressions.toLocaleString()}`)
  lines.push(`<b>Reach:</b> ${totals.reach.toLocaleString()}`)
  lines.push(`<b>Engagement:</b> ${agg.engagement} (${agg.engagement_rate}%)`)
  lines.push(`<b>Likes:</b> ${totals.likes.toLocaleString()} · <b>Comments:</b> ${totals.comments.toLocaleString()} · <b>Shares:</b> ${totals.shares.toLocaleString()}`)
  lines.push('')
  for (const [platform, p] of Object.entries(byPlatform)) {
    lines.push(`<b>${platform.charAt(0).toUpperCase() + platform.slice(1)}</b> — ${p.posts} post(s)`)
    lines.push(`  👁 ${p.impressions} · 👥 ${p.reach} · ❤️ ${p.likes} · 💬 ${p.comments} · 🔁 ${p.shares}`)
  }
  if (coach.insight) { lines.push('', '<b>🤖 AI Coach</b>', coach.insight) }
  if (coach.recommendations?.length > 0) {
    lines.push('', '<b>Recommendations</b>')
    for (const r of coach.recommendations) lines.push(`• [${r.category}] ${r.text}`)
  }
  const text = lines.join('\n')
  if (s.telegram_admin_chat_id) {
    try { await sendMessage({ chatId: s.telegram_admin_chat_id, text }) } catch (e) { console.warn('[report] telegram failed:', e.message) }
  }
  return { type, sent: !!s.telegram_admin_chat_id, totals, coach }
}
