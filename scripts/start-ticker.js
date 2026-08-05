// ============================================================================
// SocialForge Local Ticker — 24/7 automation heartbeat.
// Hits /api/automation/tick every minute so scheduled posts publish on time.
//
// Run: node scripts/start-ticker.js
// Requires: BASE_URL in .env.local (optional — defaults to localhost:3000)
//
// The tick secret is AUTO-DERIVED from APP_SESSION_SECRET using the same
// HMAC-SHA256 derivation the app uses (lib/auth.js → deriveSecret). No manual
// step needed.
// ============================================================================

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

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
  for (const key of ['BASE_URL', 'APP_SESSION_SECRET', 'TICK_SECRET']) {
    if (process.env[key]) env[key] = process.env[key]
  }
  return env
}

// ---- Derive tick secret exactly like lib/auth.js --------------------------
// deriveSecret(salt) = HMAC-SHA256(APP_SESSION_SECRET, salt).hex
// tick_secret        = deriveSecret('automation-tick')
function deriveSecret(env, salt) {
  const sessionSecret = env.APP_SESSION_SECRET || 'dev-session-secret-change-me'
  return crypto.createHmac('sha256', sessionSecret).update(String(salt)).digest('hex')
}

// ---- Config ----------------------------------------------------------------
const env = loadEnv()
const BASE_URL = env.BASE_URL || 'http://localhost:3000'
const TICK_SECRET = env.TICK_SECRET || deriveSecret(env, 'automation-tick')

console.log('🔄 SocialForge Local Ticker')
console.log(`   Base URL: ${BASE_URL}`)
console.log(`   Tick secret: auto-derived ${TICK_SECRET.slice(0, 8)}…`)
console.log('')
console.log('   Fires /api/automation/tick every 60 seconds.')
console.log('   Scheduled posts will publish exactly on time.')
console.log('   Press Ctrl+C to stop.\n')

let tickCount = 0

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
    } else {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`⏰ [${new Date().toLocaleTimeString()}] tick timed out (55s)`)
    } else {
      console.error(`❌ [${new Date().toLocaleTimeString()}] tick failed: ${e.message}`)
      if (String(e.message).includes('403') || String(e.message).includes('Unauthorized')) {
        console.error('   Secret mismatch — make sure APP_SESSION_SECRET in .env.local matches the app.')
      } else if (String(e.message).includes('ECONNREFUSED') || String(e.message).includes('fetch failed')) {
        console.error(`   Make sure your app is running at ${BASE_URL} (npm run dev)`)
      }
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