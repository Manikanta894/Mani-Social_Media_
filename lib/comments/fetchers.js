import { storage } from '../storage'

const PLATFORMS = ['facebook', 'instagram', 'linkedin']

async function fetchFacebookComments(postId) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !postId) return []
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${postId}/comments?fields=id,from{name,id},message,created_time&access_token=${token}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.data || []).map(c => ({
      platform_comment_id: c.id,
      author: c.from?.name || 'Unknown',
      comment_text: c.message || '',
      created_at: c.created_time,
    }))
  } catch { return [] }
}

async function fetchInstagramComments(mediaId) {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !mediaId) return []
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${mediaId}/comments?fields=id,username,text,timestamp&access_token=${token}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.data || []).map(c => ({
      platform_comment_id: c.id,
      author: c.username || 'Unknown',
      comment_text: c.text || '',
      created_at: c.timestamp,
    }))
  } catch { return [] }
}

async function fetchLinkedInComments(postUrn) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  if (!token || !postUrn) return []
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postUrn)}/comments?start=0&count=50`,
      { headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.elements || []).map(c => {
      const actor = c.actor?.[0] || c.actor || ''
      const name = typeof actor === 'string' ? actor.split(':').pop() || actor : 'Unknown'
      return {
        platform_comment_id: c.$URN || c.id || '',
        author: name,
        comment_text: c.message?.text || '',
        created_at: c.created?.time ? new Date(Number(c.created.time)).toISOString() : null,
      }
    })
  } catch { return [] }
}

export async function fetchAllComments() {
  const jobs = await storage.jobs.list()
  const published = jobs.filter(j => j.status === 'published' || j.published_at)
  const results = []

  for (const job of published) {
    const pr = job.publish_results || {}
    for (const platform of PLATFORMS) {
      const pi = pr[platform]
      if (!pi?.post_id) continue

      let comments
      if (platform === 'facebook') comments = await fetchFacebookComments(pi.post_id)
      else if (platform === 'instagram') comments = await fetchInstagramComments(pi.post_id)
      else if (platform === 'linkedin') comments = await fetchLinkedInComments(pi.post_id)
      else continue

      const existing = await storage.comments.list()
      const existingIds = new Set(existing.map(c => c.platform_comment_id).filter(Boolean))

      for (const c of comments) {
        if (c.platform_comment_id && existingIds.has(c.platform_comment_id)) continue
        const saved = await storage.comments.create({
          platform,
          platform_comment_id: c.platform_comment_id,
          author: c.author,
          comment_text: c.comment_text,
          post_job_id: job.id,
          status: 'pending',
        })
        results.push(saved)
      }
    }
  }
  return { fetched: results.length, results }
}

export async function replyToComment(commentId, replyText) {
  const comment = await storage.comments.get(commentId)
  if (!comment) throw new Error('Comment not found')

  const token = process.env.META_ACCESS_TOKEN
  if (comment.platform === 'facebook' || comment.platform === 'instagram') {
    if (!token) throw new Error('META_ACCESS_TOKEN not configured')
    const url = `https://graph.facebook.com/v20.0/${comment.platform_comment_id}/replies?message=${encodeURIComponent(replyText)}&access_token=${token}`
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message || 'Reply failed')
    }
    await storage.comments.update(commentId, { status: 'replied', draft_reply: replyText })
    return { ok: true }
  }

  if (comment.platform === 'linkedin') {
    await storage.comments.update(commentId, { status: 'replied', draft_reply: replyText })
    return { ok: true, note: 'Saved as draft — LinkedIn comment replies require additional API permissions.' }
  }

  throw new Error(`Reply not supported for ${comment.platform}`)
}
