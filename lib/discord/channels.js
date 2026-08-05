// ============================================================================
// Discord Command Center — automatic server structure setup
// Creates/verifies all operational channels and stores their IDs in settings.
// ============================================================================

import { storage } from '../storage'
import { listChannels, createChannel, createCategory, sendMessage, embed, field } from './client'

// Channel spec: name → { emoji, topic, category }
const CHANNEL_SPECS = {
  'announcements':      { emoji: '📢', category: 'Operations', topic: 'System announcements and critical alerts' },
  'dashboard':          { emoji: '🏠', category: 'Operations', topic: 'Live AI Operations Dashboard — real-time status' },
  'news-radar':         { emoji: '📰', category: 'Intelligence', topic: 'AI-detected news opportunities with full analysis' },
  'compose':            { emoji: '✍️', category: 'Content', topic: 'Manual content composition and drafts' },
  'blog-engine':        { emoji: '📚', category: 'Content', topic: 'SEO blog generation and publishing' },
  'scheduler':          { emoji: '📅', category: 'Operations', topic: 'Today\'s schedule — posts, blogs, campaigns' },
  'ai-generation':      { emoji: '🤖', category: 'Content', topic: 'AI content generation progress and live status' },
  'image-generation':   { emoji: '🖼️', category: 'Content', topic: 'NVIDIA image generation — featured, banners, carousels' },
  'social-publishing':  { emoji: '📱', category: 'Publishing', topic: 'Publishing center — live publish status and URLs' },
  'linkedin-engagement':{ emoji: '💬', category: 'Intelligence', topic: 'LinkedIn engagement opportunities and comments' },
  'analytics':          { emoji: '📈', category: 'Intelligence', topic: 'Performance analytics — reach, engagement, growth' },
  'content-library':    { emoji: '📂', category: 'Content', topic: 'Content library — all generated and published assets' },
  'approval-center':    { emoji: '📋', category: 'Publishing', topic: 'Approval queue — approve, edit, regenerate, reject' },
  'error-center':       { emoji: '⚠️', category: 'Operations', topic: 'Failed API calls and errors — never silent' },
  'automation-logs':    { emoji: '📜', category: 'Operations', topic: 'Every automation action — full audit trail' },
  'running-jobs':       { emoji: '🔄', category: 'Operations', topic: 'Currently running jobs and their progress' },
  'daily-reports':      { emoji: '📊', category: 'Intelligence', topic: 'Daily performance reports and digests' },
  'seo-center':         { emoji: '🌍', category: 'Content', topic: 'SEO optimization — keywords, schema, meta tags' },
  'hashtag-engine':     { emoji: '🏷️', category: 'Content', topic: 'Platform-specific hashtag intelligence' },
  'campaign-manager':   { emoji: '🎯', category: 'Publishing', topic: 'Campaign management — multi-platform rollouts' },
  'system-health':      { emoji: '⚙️', category: 'Operations', topic: 'Live system health — APIs, providers, queue, workers' },
}

const CATEGORY_ORDER = ['Operations', 'Intelligence', 'Content', 'Publishing']

export async function setupServer(guildId) {
  const existing = await listChannels(guildId)
  const existingByName = new Map(existing.map(c => [c.name, c]))

  // Create categories first
  const categories = {}
  for (const catName of CATEGORY_ORDER) {
    const key = catName.toLowerCase()
    const found = existing.find(c => c.type === 4 && c.name.toLowerCase() === key)
    if (found) {
      categories[catName] = found.id
    } else {
      const cat = await createCategory(guildId, catName)
      categories[catName] = cat.id
    }
  }

  // Create/verify channels
  const channelIds = {}
  let position = 0
  for (const [name, spec] of Object.entries(CHANNEL_SPECS)) {
    const found = existingByName.get(name)
    if (found) {
      channelIds[name] = found.id
    } else {
      const ch = await createChannel(guildId, {
        name,
        type: 0,
        topic: spec.topic,
        parentId: categories[spec.category],
        position,
      })
      channelIds[name] = ch.id
    }
    position++
  }

  // Persist channel IDs in settings
  await storage.settings.patch({ discord_channel_ids: channelIds, discord_guild_id: guildId })

  // Send welcome message to announcements
  try {
    await sendMessage({
      channelId: channelIds['announcements'],
      embeds: [embed({
        title: '🎛️ AI Operations Center — Online',
        description: 'Discord is now the primary command center. All systems connected.\n\nUse the buttons below or slash commands to control your AI Content Operating System.',
        color: 0x5865F2,
        fields: [
          field('📰 News Radar', 'AI-detected opportunities with full analysis', true),
          field('📋 Approval Center', 'Approve, edit, regenerate, reject', true),
          field('📱 Publishing', 'Publish to all platforms with one click', true),
          field('📈 Analytics', 'Reach, engagement, growth', true),
          field('⚙️ System Health', 'Live status of every service', true),
          field('📜 Automation Logs', 'Every action, fully audited', true),
        ],
        footer: 'SocialForge AI Operations Center',
        timestamp: new Date().toISOString(),
      })],
    })
  } catch (e) { console.warn('[discord] welcome message failed:', e.message) }

  return { channelIds, categories }
}

export async function getChannelId(name) {
  const s = await storage.settings.get()
  const ids = s.discord_channel_ids || {}
  return ids[name] || null
}

export async function sendToChannel(name, payload) {
  const channelId = await getChannelId(name)
  if (!channelId) throw new Error(`Discord channel "${name}" not configured — run /setup`)
  return await sendMessage({ channelId, ...payload })
}

export async function ensureServer() {
  const s = await storage.settings.get()
  const guildId = s.discord_guild_id
  if (!guildId) return { configured: false, reason: 'No guild configured' }
  const ids = s.discord_channel_ids || {}
  if (Object.keys(ids).length === 0) {
    await setupServer(guildId)
    return { configured: true, setup: 'fresh' }
  }
  return { configured: true, setup: 'existing' }
}