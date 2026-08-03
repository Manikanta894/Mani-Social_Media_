// ============================================================================
// Single-user auth — password from env, signed session cookie. No database.
// APP_PASSWORD         login password
// APP_SESSION_SECRET   HMAC key for the session cookie
// ============================================================================

import crypto from 'crypto'

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'sf_session'

function secret() { return process.env.APP_SESSION_SECRET || 'dev-session-secret-change-me' }

function sign(data) {
  return crypto.createHmac('sha256', secret()).update(String(data)).digest('base64url')
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export function verifyPassword(password) {
  const expected = process.env.APP_PASSWORD
  if (!expected || !password) return false
  const hash = (s) => crypto.createHash('sha256').update(String(s)).digest()
  return safeEqual(hash(password), hash(expected))
}

export function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySession(cookie) {
  if (!cookie) return false
  const [payload, sig] = String(cookie).split('.')
  if (!payload || !sig) return false
  if (!safeEqual(sig, sign(payload))) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return !!exp && exp > Date.now()
  } catch { return false }
}

// Stable derived secrets — never stored in Sheets, survive redeploys
export function deriveSecret(salt) {
  return crypto.createHmac('sha256', secret()).update(String(salt)).digest('hex')
}

export { COOKIE_NAME }
