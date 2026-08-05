// Threads publisher via Meta's Threads Graph API v1.0.
// Supports image + text posts. Requires THREADS_USER_ID and META_ACCESS_TOKEN.

const API_BASE = 'https://graph.threads.net/v1.0'

export async function publishToThreads({ caption, hashtags, imageUrl }) {
  const token = process.env.META_ACCESS_TOKEN
  const threadsId = process.env.THREADS_USER_ID
  if (!token || !threadsId) throw new Error('Threads not configured (META_ACCESS_TOKEN / THREADS_USER_ID missing).')

  const text = [caption, (hashtags || []).join(' ')].filter(Boolean).join('\n\n')

  // Step 1: create media container
  const params = { access_token: token, text }
  if (imageUrl) {
    params.media_type = 'IMAGE'
    params.image_url = imageUrl
  }

  const c1 = await fetch(`${API_BASE}/${threadsId}/threads`, {
    method: 'POST',
    body: new URLSearchParams(params),
  })
  const d1raw = await c1.text()
  let d1 = {}
  try { d1 = JSON.parse(d1raw) } catch (_) {}
  if (!c1.ok) throw new Error(`Threads create container: ${d1raw.slice(0, 400)}`)
  const creationId = d1.id

  // Step 2: poll container status (max ~15s)
  for (let i = 0; i < 10; i++) {
    const stRes = await fetch(`${API_BASE}/${creationId}?fields=status,error&access_token=${encodeURIComponent(token)}`)
    const stJson = await stRes.json().catch(() => ({}))
    if (stJson.status === 'FINISHED') break
    if (stJson.status === 'ERROR') throw new Error(`Threads container error: ${JSON.stringify(stJson).slice(0, 300)}`)
    await new Promise(r => setTimeout(r, 1500))
  }

  // Step 3: publish
  const c2 = await fetch(`${API_BASE}/${threadsId}/threads_publish`, {
    method: 'POST',
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  })
  const d2raw = await c2.text()
  let d2 = {}
  try { d2 = JSON.parse(d2raw) } catch (_) {}
  if (!c2.ok) throw new Error(`Threads publish: ${d2raw.slice(0, 400)}`)

  return {
    platform: 'threads',
    post_id: d2.id,
    url: d2.id ? `https://www.threads.net/@user/post/${d2.id}` : null,
  }
}
