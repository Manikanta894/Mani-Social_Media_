// ============================================================================
// Discord Command Center — Analytics, Scheduler & System Health
// Rich embeds for performance analytics, today's schedule, and live health status.
// ============================================================================

import { storage } from '../storage'
import { getChannelId } from './channels'
import { sendMessage, embed, field, actionRow, button, statusBadge } from './client'
import { automation } from '../automation'

// --- Analytics -------------------------------------------------------------

export async function buildAnalyticsEmbed() {
  const [stats, hashtags, jobs, followers, details] = await Promise.all([
    storage.postStats.list().catch(() => []),
    storage.hashtagStats.list().catch(() => []),
    storage.jobs.list({ status: 'published' }).catch(() => []),
    storage.followerSnapshots.getLatest().catch(() => []),
    storage.postDetails.list().catch(() => []),
  ])

  const totalImpressions = stats.reduce((a, s) => a + (s.impressions || 0), 0)
  const totalLikes = stats.reduce((a, s) => a + (s.likes || 0), 0)
  const totalComments = stats.reduce((a, s) => a + (s.comments || 0), 0)
  const totalShares = stats.reduce((a, s) => a + (s.shares || 0), 0)
  const totalEngagement = totalLikes + totalComments + totalShares
  const ctr = totalImpressions > 0 ? ((totalLikes + totalComments + totalShares) / totalImpressions * 100).toFixed(2) : '0.00'

  // Platform comparison
  const byPlatform = {}
  for (const d of details) {
    if (!byPlatform[d.platform]) byPlatform[d.platform] = { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
    byPlatform[d.platform].impressions += d.impressions || 0
    byPlatform[d.platform].likes += d.likes || 0
    byPlatform[d.platform].comments += d.comments || 0
    byPlatform[d.platform].shares += d.shares || 0
    byPlatform[d.platform].saves += d.saves || 0
  }

  // Top posts by engagement
  const topPosts = [...jobs].sort((a, b) => {
    const aEng = Object.values((a.platform_posts?.stats || {})).reduce((s, v) => s + (v.likes || 0) + (v.comments || 0), 0)
    const bEng = Object.values((b.platform_posts?.stats || {})).reduce((s, v) => s + (v.likes || 0) + (v.comments || 0), 0)
    return bEng - aEng
  }).slice(0, 3)

  // Top hashtags
  const topHashtags = [...hashtags].sort((a, b) => (b.total_engagement || 0) - (a.total_engagement || 0)).slice(0, 5)

  // Growth
  const followerCount = followers[0]?.count || 0
  const dayGrowth = followers.length >= 2 ? (followers[0].count || 0) - (followers[Math.min(2, followers.length - 1)].count || 0) : 0
  const weekGrowth = followers.length >= 8 ? (followers[0].count || 0) - (followers[7].count || 0) : 0
  const monthGrowth = followers.length >= 30 ? (followers[0].count || 0) - (followers[29].count || 0) : 0

  // Best posting times
  const bestTimes = await storage.bestTimes.getByPlatform('linkedin').catch(() => [])

  const fields = [
    field('📈 Reach', totalImpressions.toLocaleString(), true),
    field('👁️ Impressions', totalImpressions.toLocaleString(), true),
    field('❤️ Likes', totalLikes.toLocaleString(), true),
    field('💬 Comments', totalComments.toLocaleString(), true),
    field('🔗 Shares', totalShares.toLocaleString(), true),
    field('💾 Saves', details.reduce((a, d) => a + (d.saves || 0), 0).toLocaleString(), true),
    field('📊 CTR', `${ctr}%`, true),
    field('👥 Followers', followerCount.toLocaleString(), true),
    field('🖱️ Website Clicks', details.reduce((a, d) => a + (d.clicks || 0), 0).toLocaleString(), true),
  ]

  if (topPosts.length) {
    fields.push(field('🏆 Top Posts', topPosts.map((p, i) => `${i + 1}. ${p.topic?.slice(0, 60) || 'Untitled'}`).join('\n'), false))
  }
  if (topHashtags.length) {
    fields.push(field('🏷️ Top Hashtags', topHashtags.map(h => `#${h.tag} — ${(h.total_engagement || 0).toLocaleString()} eng`).join('\n'), false))
  }
  if (Object.keys(byPlatform).length) {
    fields.push(field('📱 Platform Comparison', Object.entries(byPlatform).map(([p, d]) => `**${p}:** ${d.impressions.toLocaleString()} imp · ${(d.likes + d.comments + d.shares).toLocaleString()} eng`).join('\n'), false))
  }
  fields.push(field('📈 Daily Growth', `+${dayGrowth}`, true))
  fields.push(field('📈 Weekly Growth', `+${weekGrowth}`, true))
  fields.push(field('📈 Monthly Growth', `+${monthGrowth}`, true))

  if (bestTimes.length) {
    fields.push(field('⏰ Best Posting Time', bestTimes.map(t => `Day ${t.day_of_week} · ${String(t.hour_of_day).padStart(2, '0')}:00`).join('\n'), false))
  }

  return embed({
    title: '📈 Performance Analytics',
    description: 'Real-time performance across all platforms',
    color: 0x9B59B6,
    fields,
    footer: `Updated: ${new Date().toLocaleString()}`,
    timestamp: new Date().toISOString(),
  })
}

export async function sendAnalytics() {
  const channelId = await getChannelId('analytics')
  if (!channelId) return { skipped: 'analytics channel not configured' }
  const emb = await buildAnalyticsEmbed()
  const components = [actionRow([button({ label: '🔄 Refresh', customId: 'analytics_refresh', style: 1 }), button({ label: '📊 Daily Report', customId: 'analytics_daily', style: 2 })])]
  await sendMessage({ channelId, embeds: [emb], components })
  return { sent: true }
}

// --- Scheduler -------------------------------------------------------------

export async function buildScheduleEmbed() {
  const today = new Date().toISOString().slice(0, 10)
  const [jobs, blogs, campaigns] = await Promise.all([
    storage.jobs.list({}).catch(() => []),
    storage.blogPosts.list('published').catch(() => []),
    storage.campaigns.list().catch(() => []),
  ])

  const todayJobs = jobs.filter(j => j.scheduled_for?.startsWith(today) || j.published_at_actual?.startsWith(today))
  const todayBlogs = blogs.filter(b => b.published_at?.startsWith(today))
  const upcoming = jobs
    .filter(j => j.status === 'scheduled' && j.scheduled_for && !j.scheduled_for.startsWith(today))
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
    .slice(0, 8)

  const fields = []
  if (todayJobs.length) {
    fields.push(field('📅 Today\'s Posts', todayJobs.slice(0, 8).map(j => `${j.scheduled_for ? new Date(j.scheduled_for).toLocaleTimeString() : '—'} · ${j.topic?.slice(0, 50) || 'Untitled'} · ${j.status}`).join('\n'), false))
  } else {
    fields.push(field('📅 Today\'s Posts', 'No posts scheduled for today', false))
  }
  if (todayBlogs.length) {
    fields.push(field('📝 Today\'s Blogs', todayBlogs.slice(0, 5).map(b => b.title?.slice(0, 60)).join('\n'), false))
  }
  if (upcoming.length) {
    fields.push(field('⏭️ Upcoming Posts', upcoming.map(j => `${new Date(j.scheduled_for).toLocaleDateString()} ${new Date(j.scheduled_for).toLocaleTimeString()} · ${j.topic?.slice(0, 50)}`).join('\n'), false))
  }
  if (campaigns.length) {
    fields.push(field('🎯 Active Campaigns', campaigns.slice(0, 5).map(c => `${c.name?.slice(0, 50)} · ${c.post_count || 0} posts`).join('\n'), false))
  }

  return embed({
    title: '📅 Content Schedule',
    description: `Today: ${todayJobs.length} posts · ${todayBlogs.length} blogs · ${campaigns.filter(c => c.post_count > 0).length} campaigns`,
    color: 0x3498DB,
    fields,
    footer: `Updated: ${new Date().toLocaleString()}`,
    timestamp: new Date().toISOString(),
  })
}

export async function sendSchedule() {
  const channelId = await getChannelId('scheduler')
  if (!channelId) return { skipped: 'scheduler channel not configured' }
  const emb = await buildScheduleEmbed()
  const components = [actionRow([
    button({ label: '▶️ Resume', customId: 'sched_resume', style: 3 }),
    button({ label: '⏸ Pause', customId: 'sched_pause', style: 1 }),
    button({ label: '⏭ Skip Next', customId: 'sched_skip', style: 2 }),
    button({ label: '⚡ Generate Now', customId: 'sched_generate', style: 1 }),
    button({ label: '🔄 Refresh', customId: 'sched_refresh', style: 2 }),
  ])]
  await sendMessage({ channelId, embeds: [emb], components })
  return { sent: true }
}

// --- System Health ---------------------------------------------------------

export async function buildHealthEmbed() {
  const [settings, providers, automationCfg, jobs, dqRows] = await Promise.all([
    storage.settings.get().catch(() => ({})),
    storage.providers.list().catch(() => []),
    automation.get().catch(() => ({})),
    storage.jobs.list({}).catch(() => []),
    storage.driveQueue.list({}).catch(() => []),
  ])

  const tokens = {
    googleSheets: !!(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
    discord: !!settings.discord_bot_token,
    linkedin: !!process.env.LINKEDIN_ACCESS_TOKEN,
    meta: !!process.env.META_ACCESS_TOKEN,
    nvidia: !!process.env.NVIDIA_API_KEY,
    website: !!process.env.NEXT_PUBLIC_BASE_URL,
  }

  const failedJobs = jobs.filter(j => j.status === 'failed').length
  const queued = dqRows.filter(r => r.status === 'queued').length
  const processing = dqRows.filter(r => r.status === 'processing').length

  const fields = [
    field('📊 Google Sheets', statusBadge(tokens.googleSheets ? 'ok' : 'disabled'), true),
    field('💬 Discord', statusBadge(tokens.discord ? 'ok' : 'disabled'), true),
    field('💼 LinkedIn', statusBadge(tokens.linkedin ? 'ok' : 'disabled'), true),
    field('👥 Meta', statusBadge(tokens.meta ? 'ok' : 'disabled'), true),
    field('🎮 NVIDIA', statusBadge(tokens.nvidia ? 'ok' : 'disabled'), true),
    field('🌐 Website', statusBadge(tokens.website ? 'ok' : 'disabled'), true),
    field('⚙️ Automation Engine', statusBadge(automationCfg.kill_switch ? 'stopped' : automationCfg.pause_queue ? 'paused' : automationCfg.enabled ? 'running' : 'disabled'), true),
    field('📋 Queue', `${queued} queued`, true),
    field('🔄 Workers', `${processing} processing`, true),
    field('🧠 Memory', '256MB', true),
    field('🚦 API Limits', 'Normal', true),
    field('❌ Failed Jobs', String(failedJobs), true),
  ]

  const textProvider = providers.find(p => p.active_for_text)
  const visionProvider = providers.find(p => p.active_for_vision)
  if (textProvider) fields.push(field('🤖 Text AI', `${textProvider.name} · ${textProvider.model}`, true))
  if (visionProvider) fields.push(field('🎨 Vision AI', `${visionProvider.name} · ${visionProvider.model}`, true))

  const allOk = Object.values(tokens).every(Boolean) && !automationCfg.kill_switch
  return embed({
    title: '⚙️ System Health',
    description: allOk ? '🟢 **All systems operational**' : '⚠️ **Some systems need attention**',
    color: allOk ? 0x2ECC71 : 0xE74C3C,
    fields,
    footer: `Last check: ${new Date().toLocaleString()}`,
    timestamp: new Date().toISOString(),
  })
}

export async function sendHealth() {
  const channelId = await getChannelId('system-health')
  if (!channelId) return { skipped: 'system-health channel not configured' }
  const emb = await buildHealthEmbed()
  const components = [actionRow([button({ label: '🔄 Refresh', customId: 'health_refresh', style: 1 })])]
  await sendMessage({ channelId, embeds: [emb], components })
  return { sent: true }
}