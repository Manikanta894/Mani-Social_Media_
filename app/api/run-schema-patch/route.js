import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Missing env' }, { status: 500 })
  const sb = createClient(url, key)
  const fs = require('fs')
  const path = require('path')
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'schema-patch.sql'), 'utf8')
  try {
    const { error } = await sb.rpc('exec_sql', { query: sql })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message, note: 'exec_sql may not exist; use SQL Editor manually' }, { status: 500 })
  }
}
