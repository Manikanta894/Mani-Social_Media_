import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } }
  )

  try {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'SocialForge', friendlyName: 'Authenticator' })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    return NextResponse.json({
      ok: true,
      data: {
        id: data.id,
        type: data.type,
        totp: {
          qr_code: data.totp?.qr_code,       // SVG QR code
          secret: data.totp?.secret,
          uri: data.totp?.uri,
        },
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
