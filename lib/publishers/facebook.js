// Facebook Page publisher (text or photo). Uses the long-lived Page/User access token in META_ACCESS_TOKEN.

export async function publishToFacebook({ caption, hashtags, imageUrl }) {
  const token = process.env.META_ACCESS_TOKEN
  const pageId = process.env.FB_PAGE_ID
  if (!token || !pageId) throw new Error('Facebook not configured (META_ACCESS_TOKEN / FB_PAGE_ID missing).')

  const message = [caption, (hashtags || []).join(' ')].filter(Boolean).join('\n\n')

  let endpoint, params
  if (imageUrl) {
    endpoint = `https://graph.facebook.com/v20.0/${pageId}/photos`
    params = { url: imageUrl, caption: message, access_token: token }
  } else {
    endpoint = `https://graph.facebook.com/v20.0/${pageId}/feed`
    params = { message, access_token: token }
  }
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) form.append(k, v)

  const res = await fetch(endpoint, { method: 'POST', body: form })
  const raw = await res.text()
  if (!res.ok) throw new Error(`Facebook ${res.status}: ${raw.slice(0, 400)}`)
  let data = {}
  try { data = JSON.parse(raw) } catch (_) {}
  const id = data.post_id || data.id
  return {
    platform: 'facebook',
    post_id: id,
    url: id ? `https://www.facebook.com/${id}` : null,
  }
}
