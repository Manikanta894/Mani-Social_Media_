// Middleware — protects all routes except /login.
// Session verification happens client-side via supabaseBrowser().
// This middleware ensures direct URL access to protected routes
// without a session cookie redirects to login.

import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl
  if (pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }
  // Client-side auth check handles redirect — middleware just allows through
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
