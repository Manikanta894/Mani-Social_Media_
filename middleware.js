// Middleware — session cookie gate.
// Pages: redirect to /login without a valid session.
// API: 401 without a valid session.
// Public routes: /login, /approve, /bio, /api/auth/*, /api/telegram/webhook,
// health, secret-authed automation ticks, media proxy, events webhook.

import { NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from './lib/auth'

const PUBLIC_PATHS = ['/login', '/approve', '/bio']
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/telegram/webhook', '/api/health', '/api/events/webhook', '/api/media/']
// Secret-authenticated endpoints — middleware must NOT block them; route handler verifies the secret
const SECRET_API_PREFIXES = ['/api/automation/tick', '/api/blog/tick', '/api/automation/news', '/api/automation/news-publish', '/api/news/brief']

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

  // Public API routes (auth flow, telegram webhook, health, media proxy)
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Secret-authenticated endpoints (tick) — let route handler verify the secret
  if (SECRET_API_PREFIXES.some(p => pathname === p)) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value

  if (pathname.startsWith('/api/')) {
    // API: 401 without valid session (defense in depth — route.js also checks)
    if (!verifySession(cookie)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Pages: redirect to login without valid session
  if (!verifySession(cookie)) {
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
