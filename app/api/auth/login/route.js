// Login audit logging endpoint.
// Actual sign-in happens client-side via supabaseBrowser() for reliable session persistence.
// This endpoint is called after successful login for rate-limit tracking and audit log only.

import { NextResponse } from 'next/server'
import { storage } from '@/lib/storage'

const rateLimitMap = new Map()
const RATE_WINDOW = 15 * 60 * 1000
const RATE_MAX = 5

function ip(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'unknown'
}

function checkRateLimit(clientIp) {
  const now = Date.now()
  const entry = rateLimitMap.get(clientIp)
  if (!entry) { rateLimitMap.set(clientIp, { count: 1, start: now }); return true }
  if (now - entry.start > RATE_WINDOW) { rateLimitMap.set(clientIp, { count: 1, start: now }); return true }
  if (entry.count >= RATE_MAX) return false
  entry.count++
  return true
}

export async function POST(request) {
  try {
    const clientIp = ip(request)
    const { email, success } = await request.json().catch(() => ({ email: null, success: false }))
    if (!email) return NextResponse.json({ ok: false, error: 'Email required' }, { status: 400 })

    if (!checkRateLimit(clientIp)) {
      await storage.audit.log('rate_limited', 'auth', clientIp, null, null, { email }).catch(() => {})
      return NextResponse.json({ ok: false, error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
    }

    await storage.audit.log(success ? 'login_success' : 'login_failed', 'auth', email, null, null, { ip: clientIp })
      .catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
