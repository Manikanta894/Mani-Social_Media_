// ============================================================================
// SocialForge Local Ticker — 24/7 automation heartbeat.
// Hits /api/automation/tick every minute so scheduled posts publish on time.
//
// Run: node scripts/start-ticker.js
// Requires: BASE_URL + TICK_SECRET in .env.local
//
// The tick secret can be found in: Settings → Automation (or via the API).
// ============================================================================

const fs = require('fs')
const path = require('path')

// ---- Parse .env.local manually --------------------------------------------
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
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
  } catch (e) {
    console.error('[ticker] Could not read .env.local:', e.message)
  }
  for (const key of ['BASE_URL', 'TICK_SECRET']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

// ---- Config ----------------------------------------------------------------
const env = loadEnv()
const BASE_URL = env.BASE_URL || 'http://localhost:3000'
const TICK_SECRET = env.TICK_SECRET || process.env.TICK_SECRET

if (!TICK_SECRET) {
  console.error('❌ Missing TICK_SECRET.')
  console.error('   Get it from: Settings → Automation (the app shows it)')
  console.error('   Then add to .env.local: TICK_SECRET=your_secret_here')
  process.exit(1)
}

console.log('🔄 SocialForge Local Ticker')
console.log(`   Base URL: ${BASE_URL}`)
console.log(`   Secret: ${TICK_SECRET.slice(0, 4)}…\n`)
console.log('   Fires /api/automation/tick every 60 seconds.')
console.log('   Press Ctrl+C to stop.\n')

let tickCount = 0
let lastError = null

async function tick() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)

    const res = await fetch(`${BASE_URL}/api/automation/tick`, {
      method: 'POST',
      headers: {
        'X-Automation-Secret': TICK_SECRET,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const data = await res.json().catch(() => ({}))

    if (res.ok) {
      tickCount++
      const time = new Date().toLocaleTimeString()
      console.log(`✅ [${time}] tick #${tickCount}: ${JSON.stringify(data?.data || data).slice(0, 300)}`)
      lastError = null
    } else {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`⏰ [${new Date().toLocaleTimeString()}] tick timed out (55s)`)
    } else {
      console.error(`❌ [${new Date().toLocaleTimeString()}] tick failed: ${e.message}`)
      if (String(e.message).includes('403') || String(e.message).includes('Unauthorized')) {
        console.error('   Secret may be wrong. Check TICK_SECRET in .env.local')
      }
      lastError = String(e.message)
    }
  }
}

// Fire once immediately, then every 60s
tick()
setInterval(tick, 60 * 1000)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹ Ticker stopped.')
  process.exit(0)
})