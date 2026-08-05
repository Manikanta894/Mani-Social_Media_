// Discord Interactions webhook — verifies Ed25519 signatures, answers PING,
// and dispatches every button/menu/slash interaction to the Command Center.
import { NextResponse } from 'next/server'
import { verifyKey } from 'discord-interactions'
import { handleInteraction } from '@/lib/discord/handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) {
    return NextResponse.json({ ok: false, error: 'DISCORD_PUBLIC_KEY not configured' }, { status: 500 })
  }

  // --- 1. Verify Ed25519 signature (Discord REQUIRES this) ---
  const signature = request.headers.get('x-signature-ed25519') || ''
  const timestamp = request.headers.get('x-signature-timestamp') || ''
  const rawBody = await request.text()
  let valid = false
  try {
    valid = await verifyKey(rawBody, signature, timestamp, publicKey)
  } catch (e) {
    console.warn('[discord] verify failed:', e.message)
  }
  if (!valid) {
    console.warn('[discord] invalid signature rejected')
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
  }

  // --- 2. Parse interaction ---
  let interaction
  try { interaction = JSON.parse(rawBody) } catch (e) { return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 }) }

  // --- 3. PING check (interaction type 1) — must return {"type":1} ---
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 })
  }

  // --- 4. Dispatch to the Command Center handler ---
  try {
    const response = await handleInteraction(interaction)
    // If the handler returns a response object, use it; else default ACK
    return NextResponse.json(response || { type: 5 })
  } catch (e) {
    console.error('[discord] handler error:', e)
    return NextResponse.json({ type: 4, data: { content: `❌ ${String(e.message || 'Unknown error').slice(0, 1900)}`, flags: 64 } })
  }
}
