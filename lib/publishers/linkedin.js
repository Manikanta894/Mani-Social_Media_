// LinkedIn UGC Post publisher.
// Image posts via the register-upload flow (Assets API) when imageUrl exists.
// Never publishes a text-only post when an image is available.

export async function resolveLinkedInAuthor(token) {
  const stored = process.env.LINKEDIN_URN
  if (stored && stored.includes(':') && !/^urn:li:person:86nthikk/.test(stored)) return stored
  try {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    if (d.sub) return `urn:li:person:${d.sub}`
  } catch (e) { console.warn('[linkedin] author resolve failed:', e.message) }
  return stored
}

// Register an image upload and return the media URN ready for a UGC post.
async function uploadLinkedInImage(token, imageUrl) {
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: process.env.LINKEDIN_URN || '',
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  })
  const regRaw = await registerRes.text()
  if (!registerRes.ok) throw new Error(`LinkedIn register upload: ${regRaw.slice(0, 400)}`)
  let reg = {}
  try { reg = JSON.parse(regRaw) } catch (_) {}
  const value = reg.value || {}
  const uploadUrl = value.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
  const asset = value.asset
  if (!uploadUrl || !asset) throw new Error(`LinkedIn register upload missing URL/asset: ${regRaw.slice(0, 400)}`)

  // Download the image (via our media proxy) and upload bytes to LinkedIn
  const dl = await fetch(imageUrl)
  if (!dl.ok) throw new Error(`LinkedIn image download failed: ${dl.status}`)
  const buf = Buffer.from(await dl.arrayBuffer())
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: buf,
  })
  if (!up.ok) throw new Error(`LinkedIn image upload failed: ${up.status} ${(await up.text()).slice(0, 200)}`)
  return asset
}

export async function publishToLinkedIn({ caption, hashtags, imageUrl }) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (!token) throw new Error('LinkedIn not configured (LINKEDIN_ACCESS_TOKEN missing).')
  const urn = await resolveLinkedInAuthor(token)
  if (!urn) throw new Error('LinkedIn author URN could not be resolved.')

  const text = [caption, (hashtags || []).join(' ')].filter(Boolean).join('\n\n')

  const body = {
    author: urn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }

  // IMAGE-FIRST: if an image exists, upload it and publish an IMAGE post.
  if (imageUrl) {
    const mediaUrn = await uploadLinkedInImage(token, imageUrl)
    body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE'
    body.specificContent['com.linkedin.ugc.ShareContent'].media = [
      { status: 'READY', description: { text: caption.slice(0, 2000) }, media: mediaUrn },
    ]
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${raw.slice(0, 400)}`)
  let data = {}
  try { data = JSON.parse(raw) } catch (_) {}
  const postId = data.id || res.headers.get('x-restli-id') || null
  return {
    platform: 'linkedin',
    post_id: postId,
    url: postId ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/` : null,
    media: imageUrl ? 'image' : 'text',
  }
}
