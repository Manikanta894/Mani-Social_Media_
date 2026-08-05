// Media proxy — streams Drive-stored images to the browser, Telegram,
// Instagram/Facebook/Threads publish APIs. Public by design (post media).

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIME = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
}

async function mimeFor(fileId) {
  try {
    const { driveMetadata } = await import('@/lib/gsheets')
    const meta = await driveMetadata(fileId)
    return meta.mimeType || 'application/octet-stream'
  } catch { return 'application/octet-stream' }
}

export async function GET(request, { params }) {
  const fileId = params?.fileId?.[0]
  if (!fileId || !/^[a-zA-Z0-9_-]{6,}$/.test(fileId)) {
    return NextResponse.json({ ok: false, error: 'Bad file id' }, { status: 400 })
  }
  try {
    const { mediaStore } = await import('@/lib/media-store')
    const buf = await mediaStore.download(fileId)
    const mime = await mimeFor(fileId)
    const ext = Object.entries(MIME).find(([, exts]) => exts.includes(mime?.split('/')[1]))?.[0]
    const cache = mime?.startsWith('image/') ? 'public, max-age=3600' : 'no-store'
    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime || 'application/octet-stream',
        'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }
}
