// LinkedIn UGC Post publisher (text posts — works with r_liteprofile+w_member_social scopes).
// Image posts require the register-upload flow which is out of scope for slice 3.

export async function publishToLinkedIn({ caption, hashtags }) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const urn = process.env.LINKEDIN_URN
  if (!token || !urn) throw new Error('LinkedIn not configured (LINKEDIN_ACCESS_TOKEN / LINKEDIN_URN missing).')

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
  }
}
