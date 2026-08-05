// ============================================================================
// One-shot Discord Command Center setup script.
// Run: node scripts/setup-discord.js
// Reads DISCORD_BOT_TOKEN + DISCORD_GUILD_ID from .env.local (auto-parsed).
// Creates all 21 channels across 4 categories and registers slash commands.
// ============================================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const API = 'https://discord.com/api/v10'

// ---- Parse .env.local manually (no dotenv dependency) ---------------------
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const env = {}
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key) env[key] = value
    }
  } catch (e) {
    console.error('[setup] Could not read .env.local:', e.message)
  }
  // Also check process.env (in case invoked with env vars set)
  for (const key of ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

// ---- Minimal JSON HTTP request helper -------------------------------------
function request(method, url, token, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const options = {
      method,
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SocialForge-Setup/1.0',
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        let parsed = null
        try { parsed = JSON.parse(data) } catch { parsed = data }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed)
        } else {
          reject(new Error(`Discord ${method} ${u.pathname} failed: ${res.statusCode} ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`))
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ---- Channel spec ----------------------------------------------------------
const CATEGORY_ORDER = ['Operations', 'Intelligence', 'Content', 'Publishing']

const CHANNEL_SPECS = {
  'announcements':       { category: 'Operations',   topic: 'System announcements and critical alerts' },
  'dashboard':           { category: 'Operations',   topic: 'Live AI Operations Dashboard — real-time status' },
  'news-radar':          { category: 'Intelligence', topic: 'AI-detected news opportunities with full analysis' },
  'compose':             { category: 'Content',      topic: 'Manual content composition and drafts' },
  'blog-engine':         { category: 'Content',      topic: 'SEO blog generation and publishing' },
  'scheduler':           { category: 'Operations',   topic: "Today's schedule — posts, blogs, campaigns" },
  'ai-generation':       { category: 'Content',      topic: 'AI content generation progress and live status' },
  'image-generation':    { category: 'Content',      topic: 'NVIDIA image generation — featured, banners, carousels' },
  'social-publishing':   { category: 'Publishing',   topic: 'Publishing center — live publish status and URLs' },
  'linkedin-engagement': { category: 'Intelligence', topic: 'LinkedIn engagement opportunities and comments' },
  'analytics':           { category: 'Intelligence', topic: 'Performance analytics — reach, engagement, growth' },
  'content-library':     { category: 'Content',      topic: 'Content library — all generated and published assets' },
  'approval-center':     { category: 'Publishing',   topic: 'Approval queue — approve, edit, regenerate, reject' },
  'error-center':        { category: 'Operations',   topic: 'Failed API calls and errors — never silent' },
  'automation-logs':     { category: 'Operations',   topic: 'Every automation action — full audit trail' },
  'running-jobs':        { category: 'Operations',   topic: 'Currently running jobs and their progress' },
  'daily-reports':       { category: 'Intelligence', topic: 'Daily performance reports and digests' },
  'seo-center':          { category: 'Content',      topic: 'SEO optimization — keywords, schema, meta tags' },
  'hashtag-engine':      { category: 'Content',      topic: 'Platform-specific hashtag intelligence' },
  'campaign-manager':    { category: 'Publishing',   topic: 'Campaign management — multi-platform rollouts' },
  'system-health':       { category: 'Operations',   topic: 'Live system health — APIs, providers, queue, workers' },
}

const SLASH_COMMANDS = [
  { name: 'setup', description: 'Create/verify the AI Operations Center server structure' },
  { name: 'dashboard', description: 'Update the live dashboard' },
  { name: 'news', description: 'Show recent news radar opportunities' },
  { name: 'approvals', description: 'Show pending approval queue' },
  { name: 'analytics', description: 'Show performance analytics' },
  { name: 'schedule', description: "Show today's content schedule" },
  { name: 'health', description: 'Show system health status' },
  { name: 'publish', description: 'Publish a job by ID', options: [{ type: 3, name: 'job_id', description: 'Job ID to publish', required: true }] },
  { name: 'status', description: 'Show current system status' },
  { name: 'jobs', description: 'List jobs by status', options: [{ type: 3, name: 'status', description: 'Filter by status', required: false }] },
]

// ---- Main ------------------------------------------------------------------
async function main() {
  console.log('🎛  Discord Command Center — Setup Script\n')

  const env = loadEnv()
  const token = env.DISCORD_BOT_TOKEN
  const guildId = env.DISCORD_GUILD_ID

  if (!token || !guildId) {
    console.error('❌ Missing credentials. Add to .env.local:')
    console.error('   DISCORD_BOT_TOKEN=your_bot_token')
    console.error('   DISCORD_GUILD_ID=your_server_id')
    process.exit(1)
  }

  console.log(`✅ Token loaded: ${token.slice(0, 8)}…`)
  console.log(`✅ Guild ID: ${guildId}\n`)

  // 1. Verify bot
  let me
  try {
    me = await request('GET', `${API}/users/@me`, token)
    console.log(`🤖 Connected as: ${me.username} (${me.id})\n`)
  } catch (e) {
    console.error('❌ Bot token invalid or bot not found:', e.message)
    process.exit(1)
  }

  // 2. Verify guild access
  let guild
  try {
    guild = await request('GET', `${API}/guilds/${guildId}`, token)
    console.log(`🏠 Connected to server: ${guild.name}\n`)
  } catch (e) {
    console.error(`❌ Cannot access guild ${guildId}. Make sure the bot is invited to the server.`)
    console.error('   Invite URL: https://discord.com/oauth2/authorize?client_id=' + me.id + '&permissions=268438608&scope=bot%20applications.commands')
    console.error('   Error:', e.message)
    process.exit(1)
  }

  // 3. List existing channels
  let existing = []
  try {
    existing = await request('GET', `${API}/guilds/${guildId}/channels`, token)
  } catch (e) {
    console.error('❌ Could not list channels:', e.message)
    process.exit(1)
  }
  const existingByName = new Map(existing.map(c => [c.name, c]))

  // 4. Create categories
  console.log('📚 Creating categories…')
  const categoryIds = {}
  for (const catName of CATEGORY_ORDER) {
    const found = existing.find(c => c.type === 4 && c.name.toLowerCase() === catName.toLowerCase())
    if (found) {
      categoryIds[catName] = found.id
      console.log(`   ✓ ${catName} (exists)`)
    } else {
      const cat = await request('POST', `${API}/guilds/${guildId}/channels`, token, { name: catName, type: 4 })
      categoryIds[catName] = cat.id
      console.log(`   ✓ ${catName} (created)`)
    }
  }
  console.log('')

  // 5. Create channels
  console.log('📢 Creating channels…')
  const channelIds = {}
  let position = 0
  for (const [name, spec] of Object.entries(CHANNEL_SPECS)) {
    const found = existingByName.get(name)
    if (found) {
      channelIds[name] = found.id
      console.log(`   ✓ #${name} (exists)`)
    } else {
      const ch = await request('POST', `${API}/guilds/${guildId}/channels`, token, {
        name,
        type: 0,
        topic: spec.topic,
        parent_id: categoryIds[spec.category],
        position,
      })
      channelIds[name] = ch.id
      console.log(`   ✓ #${name} (created)`)
    }
    position++
  }
  console.log(`\n✅ Created/verified ${Object.keys(channelIds).length} channels`)

  // 6. Register slash commands
  console.log('\n⚡ Registering slash commands…')
  try {
    const commands = await request('PUT', `${API}/applications/@me/guilds/${guildId}/commands`, token, SLASH_COMMANDS)
    console.log(`   ✓ Registered ${commands.length} commands: ${commands.map(c => '/' + c.name).join(', ')}`)
  } catch (e) {
    console.error('   ⚠ Could not register slash commands:', e.message)
    console.log('     (The bot may not have the applications.commands scope. Re-invite with the URL above.)')
  }

  // 7. Send welcome message
  console.log('\n📬 Sending welcome message…')
  try {
    await request('POST', `${API}/channels/${channelIds['announcements']}/messages`, token, {
      embeds: [{
        title: '🎛️ AI Operations Center — Online',
        description: 'Discord is now the primary command center. All systems connected.\n\nUse the buttons below or slash commands to control your AI Content Operating System.',
        color: 0x5865F2,
        fields: [
          { name: '📰 News Radar', value: 'AI-detected opportunities with full analysis', inline: true },
          { name: '📋 Approval Center', value: 'Approve, edit, regenerate, reject', inline: true },
          { name: '📱 Publishing', value: 'Publish to all platforms with one click', inline: true },
          { name: '📈 Analytics', value: 'Reach, engagement, growth', inline: true },
          { name: '⚙️ System Health', value: 'Live status of every service', inline: true },
          { name: '📜 Automation Logs', value: 'Every action, fully audited', inline: true },
        ],
        footer: { text: 'SocialForge AI Operations Center' },
        timestamp: new Date().toISOString(),
      }],
    })
    console.log('   ✓ Welcome message sent to #announcements')
  } catch (e) {
    console.error('   ⚠ Could not send welcome:', e.message)
  }

  // 8. Generate .env.discord.json with channel IDs (for the web app)
  const outputPath = path.join(__dirname, '..', '.env.discord.json')
  fs.writeFileSync(outputPath, JSON.stringify({ channel_ids: channelIds, guild_id: guildId }, null, 2))
  console.log(`\n📄 Saved channel IDs to .env.discord.json`)

  console.log('\n🎉 **Setup complete!** Your Discord server is now an AI Operations Center.')
  console.log('   Open your web app → Settings → Discord to see it connected, or')
  console.log('   use /dashboard, /news, /approvals, /analytics, /status in Discord.')
}

main().catch(e => {
  console.error('\n❌ Setup failed:', e.message)
  process.exit(1)
})