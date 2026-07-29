import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { factorId, challengeId, code } = await request.json()
  if (!factorId || !challengeId || !code) return NextResponse.json({ ok: false, error: 'factorId, challengeId, and code required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, data: { verified: true } })
}
