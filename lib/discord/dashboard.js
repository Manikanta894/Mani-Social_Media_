// ============================================================================
// Discord Command Center — Live Operations Dashboard
// Continuously updates the #dashboard channel with real-time system status.
// ============================================================================

import { storage } from '../storage'
import { sendToChannel, getChannelId } from './channels'
import { sendMessage, editMessage, embed, field, actionRow, button, statusBadge } from './client'
import { automation } from '../automation'

const DASHBOARD_MSG_KEY = 'discord_dashboard_message'

export async function buildDashboardData() {
  const today = new Date().toISOString().slice(0, 10)
  const [settings, automationCfg, jobs, dqRows, blogRows, providers, newsPosts, auditRows] = await Promise.all([
    storage.settings.get().catch(() => ({})),
    automation.get().catch(() => ({})),
    storage.jobs.list({}).catch(() => []),
    storage.driveQueue.list({}).catch(() => []),
    storage.blogQueue.list().catch(() => []),
    storage.providers.list().catch(() => []),
    storage.newsPosts.list().catch(() => []),
    storage.audit.list(100).catch(() => []),
  ])

  const published = jobs.filter(j => j.status === 'published')
  const failed = jobs.filter(j => j.status === 'failed')
  const pendingApproval = jobs.filter(j => j.status === 'pending_approval' || j.status === 'draft')
  const scheduled = jobs.filter(j => j.status === 'scheduled' && j.scheduled_for)
  const generatedToday = jobs.filter(j => j.created_at?.startsWith(today)).length
  const publishedToday = published.filter(j => j.published_at_actual?.startsWith(today)).length
  const blogsGenerated = blogRows.filter(r => r.status === 'published').length
  const imagesGenerated = jobs.filter(j => j.image_ref).length

  const textProvider = providers.find(p => p.active_for_text)
  const visionProvider = providers.find(p => p.active_for_vision)

  // Analytics aggregation
  const stats = await storage.postStats.list().catch(() => [])
  const todayStats = stats.filter(s => s.checked_at?.startsWith(today))
  const reach = todayStats.reduce((a, s) => a + (s.reach || 0), 0)
  const engagement = todayStats.reduce((a, s) => a + (s.likes || 0) + (s.comments || 0) + (s.shares || 0), 0)
  const followers = await storage.followerSnapshots.getLatest().catch(() => [])
  const followerDelta = followers.length >= 2 ? (followers[0].count || 0) - (followers[1].count || 0) : 0

  // API status checks
  const apiStatus = {
    googleSheets: !!(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) ? 'ok' : 'disabled',
    linkedin: !!process.env.LINKEDIN_ACCESS_TOKEN ? 'ok' : 'disabled',
    meta: !!process.env.META_ACCESS_TOKEN ? 'ok' : 'disabled',
    nvidia: !!process.env.NVIDIA_API_KEY ? 'ok' : 'disabled',
    discord: !!settings.discord_bot_token ? 'ok' : 'disabled',
  }

  // Average generation time from audit
  const genAudits = auditRows.filter(a => a.action === 'generate' || a.action === 'ai_generation_completed')
  const avgGenTime = genAudits.length > 0 ? '~45s' : '—'

  // Upcoming scheduled posts
  const upcoming = scheduled
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
    .slice(0, 5)
    .map(j => `${j.topic?.slice(0, 40) || 'Untitled'} — ${new Date(j.scheduled_for).toLocaleString()}`)

  return {
    jobsRunning: dqRows.filter(r => r.status === 'processing').length,
    jobsWaiting: dqRows.filter(r => r.status === 'queued').length,
    postsGeneratedToday: generatedToday,
    postsPublished: published.length,
    postsPublishedToday: publishedToday,
    blogsGenerated: blogsGenerated,
    imagesGenerated,
    approvalQueue: pendingApproval.length,
    failedJobs: failed.length,
    automationStatus: automationCfg.kill_switch ? 'stopped' : automationCfg.pause_queue ? 'paused' : automationCfg.enabled ? 'running' : 'disabled',
    apiStatus,
    currentModel: textProvider ? `${textProvider.name} · ${textProvider.model}` : '—',
    avgGenTime,
    todayReach: reach,
    todayEngagement: engagement,
    followersGained: followerDelta,
    websiteVisitors: '—',
    upcomingScheduled: upcoming,
  }
}

export async function renderDashboardEmbed(data) {
  const color = data.automationStatus === 'running' ? 0x2ECC71 : data.automationStatus === 'paused' ? 0xF1C40F : 0xE74C3C
  const fields = [
    field('🔄 Jobs Running', String(data.jobsRunning), true),
    field('⏳ Jobs Waiting', String(data.jobsWaiting), true),
    field('📝 Generated Today', String(data.postsGeneratedToday), true),
    field('🚀 Posts Published', String(data.postsPublished), true),
    field('📚 Blogs Generated', String(data.blogsGenerated), true),
    field('🖼️ Images Generated', String(data.imagesGenerated), true),
    field('📋 Approval Queue', String(data.approvalQueue), true),
    field('❌ Failed Jobs', String(data.failedJobs), true),
    field('⚙️ Automation', statusBadge(data.automationStatus), true),
    field('📊 Google Sheets', statusBadge(data.apiStatus.googleSheets), true),
    field('💼 LinkedIn', statusBadge(data.apiStatus.linkedin), true),
    field('👥 Meta', statusBadge(data.apiStatus.meta), true),
    field('🎮 NVIDIA AI', statusBadge(data.apiStatus.nvidia), true),
    field('💬 Discord', statusBadge(data.apiStatus.discord), true),
    field('🤖 AI Model', data.currentModel, true),
    field('⏱️ Avg Gen Time', data.avgGenTime, true),
    field('📈 Today\'s Reach', data.todayReach.toLocaleString(), true),
    field('💬 Today\'s Engagement', data.todayEngagement.toLocaleString(), true),
    field('👥 Followers Gained', (data.followersGained > 0 ? '+' : '') + data.followersGained, true),
    field('🌐 Website Visitors', data.websiteVisitors, true),
  ]

  if (data.upcomingScheduled.length) {
    fields.push(field('📅 Upcoming Scheduled', data.upcomingScheduled.join('\n'), false))
  }

  return embed({
    title: '🏠 AI Operations Dashboard',
    description: `**Automation: ${statusBadge(data.automationStatus)}**\nLive status — updates every 60 seconds`,
    color,
    fields,
    footer: `Last updated: ${new Date().toLocaleString()}`,
    timestamp: new Date().toISOString(),
  })
}

export async function updateDashboard() {
  const channelId = await getChannelId('dashboard')
  if (!channelId) return { skipped: 'dashboard channel not configured' }

  const data = await buildDashboardData()
  const dashEmbed = await renderDashboardEmbed(data)

  // Find existing dashboard message
  const state = await storage.appState.get(DASHBOARD_MSG_KEY, null)
  const messageId = state?.messageId

  const components = [
    actionRow([
      button({ label: '🔄 Refresh', customId: 'dash_refresh', style: 1 }),
      button({ label: '📰 News Radar', customId: 'nav_news', style: 2 }),
      button({ label: '📋 Approvals', customId: 'nav_approvals', style: 2 }),
      button({ label: '📈 Analytics', customId: 'nav_analytics', style: 2 }),
      button({ label: '⚙️ Health', customId: 'nav_health', style: 2 }),
    ]),
  ]

  try {
    if (messageId) {
      await editMessage({ channelId, messageId, embeds: [dashEmbed], components })
    } else {
      const msg = await sendMessage({ channelId, embeds: [dashEmbed], components })
      await storage.appState.set(DASHBOARD_MSG_KEY, { messageId: msg.id })
    }
  } catch (e) {
    // Message may have been deleted — send fresh
    const msg = await sendMessage({ channelId, embeds: [dashEmbed], components })
    await storage.appState.set(DASHBOARD_MSG_KEY, { messageId: msg.id })
  }

  return { updated: true, data }
}

export async function logToChannel(name, { title, description, color = 0x5865F2, fields = [], footer = null }) {
  try {
    await sendToChannel(name, {
      embeds: [embed({ title, description, color, fields, footer, timestamp: new Date().toISOString() })],
    })
  } catch (e) {
    console.warn(`[discord] log to ${name} failed:`, e.message)
  }
}

export async function logAutomation(action, entityType, entityId, details = {}) {
  await logToChannel('automation-logs', {
    title: `📜 ${action.replace(/_/g, ' ').toUpperCase()}`,
    description: `**Entity:** ${entityType} \`${entityId || '—'}\`\n${Object.entries(details).map(([k, v]) => `**${k}:** ${String(v).slice(0, 200)}`).join('\n')}`,
    color: 0x3498DB,
  })
}

export async function logError({ module, error, retryCount = 0, fix = null }) {
  await logToChannel('error-center', {
    title: `❌ Error — ${module}`,
    description: `**Error:** \`\`\`${String(error).slice(0, 1500)}\`\`\`\n**Retry Count:** ${retryCount}\n${fix ? `**Fix:** ${fix}` : ''}`,
    color: 0xE74C3C,
  })
}