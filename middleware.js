// Middleware — session cookie gate.
// Pages: redirect to /login without a valid session.
// API: 401 without a valid session.
// Public routes: /login, /approve, /bio, /api/auth/*, /api/telegram/webhook,
// health, secret-authed automation ticks, media proxy, events webhook.

import { NextResponse } from 'next/server'

// Same cookie contract as lib/auth.js (HMAC-SHA256, base64url), but implemented
// with the isomorphic WebCrypto API so this file runs on the Edge runtime
// (Node's `crypto` module is NOT available in middleware).
const COOKIE_NAME = 'sf_session'

const PUBLIC_PATHS = ['/login', '/approve', '/bio']
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/telegram/webhook', '/api/discord/webhook', '/api/health', '/api/events/webhook', '/api/media/']
// Secret-authenticated endpoints — middleware must NOT block them; route handler verifies the secret
const SECRET_API_PREFIXES = ['/api/automation/tick', '/api/blog/tick', '/api/automation/news', '/api/automation/news-publish', '/api/news/brief', '/api/linkedin-intel', '/api/cron']

function secret() {
  return process.env.APP_SESSION_SECRET || 'dev-session-secret-change-me'
}

function bytesToBase64Url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s) {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sign(payload) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(payload)))
  return bytesToBase64Url(new Uint8Array(sig))
}

async function verifySession(cookie) {
  if (!cookie) return false
  const [payload, sig] = String(cookie).split('.')
  if (!payload || !sig) return false
  const expected = await sign(payload)
  if (!safeEqual(sig, expected)) return false
  try {
    const { exp } = JSON.parse(base64UrlToBytes(payload).reduce((a, b) => a + String.fromCharCode(b), ''))
    return !!exp && exp > Date.now()
  } catch { return false }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Always allow static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname === '/manifest.json' || pathname === '/sw.js') {
    return NextResponse.next()
  }

  // Public pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Public API routes (auth flow, telegram webhook, health, media proxy)
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Secret-authenticated endpoints (tick) — let route handler verify the secret
  if (SECRET_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value

  if (pathname.startsWith('/api/')) {
    // API: 401 without valid session (defense in depth — route.js also checks)
    if (!(await verifySession(cookie))) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Pages: redirect to login without valid session
  if (!(await verifySession(cookie))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
