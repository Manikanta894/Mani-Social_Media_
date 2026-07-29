import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return NextResponse.json({ ok: false, error: 'Invalid session' }, { status: 401 })

  // Check MFA
  const { data: mfa } = await supabase.auth.mfa.listFactors().catch(() => ({ data: null }))
  const enrolled = mfa?.all?.filter(f => f.status === 'verified') || []

  return NextResponse.json({
    ok: true,
    data: { user: data.user, has_mfa: enrolled.length > 0 },
  })
}
