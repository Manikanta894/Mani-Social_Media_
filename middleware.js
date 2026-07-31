// Middleware — verifies Supabase session cookie server-side.
// Pages: redirects to /login if no valid session.
// API: returns 401 for protected routes if no valid session.
// Public routes: /login, /approve, /bio, /api/auth/*, /api/telegram/webhook.

import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/approve', '/bio']
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/telegram/webhook', '/api/health']
// Secret-authenticated endpoints — middleware must NOT block them; route handler verifies the secret
const SECRET_API_PREFIXES = ['/api/automation/tick', '/api/blog/tick']

function getSessionCookie(request) {
  // Supabase cookie name: sb-<storageKey>-auth-token
  // storageKey is 'socialforge-auth' (see lib/supabase-browser.js)
  const cookieName = 'sb-socialforge-auth-auth-token'
  const cookie = request.cookies.get(cookieName)
  return cookie?.value || null
}

function base64UrlDecode(str) {
  // Edge runtime has no Buffer — use atob with URL-safe padding fix
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
  return decodeURIComponent(escape(atob(padded)))
}

function isTokenValid(token) {
  if (!token) return false
  try {
    // JWT payload is the middle segment, base64url encoded
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    if (!payload.exp) return false
    // Allow 30s clock skew
    return payload.exp * 1000 > Date.now() - 30000
  } catch {
    return false
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Always allow static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname === '/manifest.json' || pathname === '/sw.js') {
    return NextResponse.next()
  }

  // Public pages
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Public API routes (auth flow, telegram webhook, health)
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Secret-authenticated endpoints (tick) — let route handler verify the secret
  if (SECRET_API_PREFIXES.some(p => pathname === p)) {
    return NextResponse.next()
  }

  const token = getSessionCookie(request)

  if (pathname.startsWith('/api/')) {
    // API: 401 without valid session (defense in depth — route.js also checks)
    if (!isTokenValid(token)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Pages: redirect to login without valid session
  if (!isTokenValid(token)) {
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