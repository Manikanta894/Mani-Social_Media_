// Instagram Business publisher via Meta Graph API. Requires public imageUrl.

export async function publishToInstagram({ caption, hashtags, imageUrl }) {
  const token = process.env.META_ACCESS_TOKEN
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID
  if (!token || !igId) return { platform: 'instagram', skipped: true, note: 'Not configured' }
  if (!imageUrl) return { platform: 'instagram', skipped: true, note: 'Instagram requires an image — no image on this post' }

  const captionText = [caption, (hashtags || []).join(' ')].filter(Boolean).join('\n\n')

  // Step 1: create media container
  const c1 = await fetch(`https://graph.facebook.com/v20.0/${igId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: imageUrl,
      caption: captionText,
      access_token: token,
    }),
  })
  const d1raw = await c1.text()
  let d1 = {}
  try { d1 = JSON.parse(d1raw) } catch (_) {}
  if (!c1.ok) throw new Error(`IG create: ${d1raw.slice(0, 400)}`)
  const creationId = d1.id

  // Step 2: poll container status (max ~15s)
  for (let i = 0; i < 10; i++) {
    const stRes = await fetch(`https://graph.facebook.com/v20.0/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`)
    const stJson = await stRes.json().catch(() => ({}))
    if (stJson.status_code === 'FINISHED') break
    if (stJson.status_code === 'ERROR') throw new Error(`IG container error: ${JSON.stringify(stJson).slice(0, 300)}`)
    await new Promise(r => setTimeout(r, 1500))
  }

  // Step 3: publish
  const c2 = await fetch(`https://graph.facebook.com/v20.0/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    }),
  })
  const d2raw = await c2.text()
  let d2 = {}
  try { d2 = JSON.parse(d2raw) } catch (_) {}
  if (!c2.ok) throw new Error(`IG publish: ${d2raw.slice(0, 400)}`)

  return {
    platform: 'instagram',
    post_id: d2.id,
    url: d2.id ? `https://www.instagram.com/reel/${d2.id}/` : null,
  }
}
