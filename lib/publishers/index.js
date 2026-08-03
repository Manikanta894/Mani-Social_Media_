// Orchestrator: publish a content_job to one or more platforms.

import { publishToLinkedIn }  from './linkedin'
import { publishToFacebook }  from './facebook'
import { publishToInstagram } from './instagram'
import { publishToThreads }   from './threads'
import { publishToInsights }  from '../blog/generate'
import { publishToBluesky }   from './bluesky'
import { publishToMastodon }  from './mastodon'
import { publishToGoogleBusinessProfile } from './google_business_profile'
import { storage } from '../storage'
import { appendUTM } from '../ai/prompts'

const SUPPORTED = ['linkedin', 'facebook', 'instagram', 'threads']
const STUBBED = ['bluesky', 'mastodon', 'google_business_profile']

async function publishToPlatform(p, args) {
  if      (p === 'linkedin')               return await publishToLinkedIn(args)
  else if (p === 'facebook')               return await publishToFacebook(args)
  else if (p === 'instagram')              return await publishToInstagram(args)
  else if (p === 'threads')                return await publishToThreads(args)
  else if (p === 'bluesky')                return await publishToBluesky(args)
  else if (p === 'mastodon')               return await publishToMastodon(args)
  else if (p === 'google_business_profile') return await publishToGoogleBusinessProfile(args)
  return { platform: p, ok: false, error: `No publisher for ${p}` }
}

export async function publishJob(job, options = {}) {
  const settings = await storage.settings.get()
  if (settings.kill_switch) throw new Error('Global kill switch is active. Publishing paused.')

  if (options.dryRun) {
    const requested = options.platforms || Object.keys(job.platform_posts || {})
    const targets = requested.filter(p => SUPPORTED.includes(p) || STUBBED.includes(p))
    const validation = targets.map(p => {
      const post = job.platform_posts?.[p]
      return { platform: p, valid: !!post?.caption, caption_preview: post?.caption?.slice(0, 100) }
    })
    return { status: 'dry_run', results: validation }
  }

  const requested = options.platforms || Object.keys(job.platform_posts || {})
  const targets = requested.filter(p => SUPPORTED.includes(p) || STUBBED.includes(p))
  const results = []

  for (const p of targets) {
    const post = job.platform_posts?.[p]
    if (!post || !post.caption) {
      results.push({ platform: p, ok: false, error: 'No caption for this platform' })
      continue
    }
    const args = {
      caption: appendUTM(post.caption, job.id, p),
      hashtags: post.hashtags || [],
      imageUrl: job.image_ref && /^https?:\/\//.test(job.image_ref) ? job.image_ref : null,
    }
    try {
      const r = await publishToPlatform(p, args)
      results.push({ ok: true, ...r })
    } catch (e) {
      results.push({ platform: p, ok: false, error: e.message })
      if (e.message.includes('429') || e.message.includes('rate limit') || e.message.includes('too many requests')) {
        await recordRateLimit(p, 300).catch(() => {})
      }
    }
  }

  // First-comment follow-up
  const firstComments = job.first_comment || {}
  for (const r of results) {
    if (!r.ok || !r.post_id) continue
    const fc = firstComments[r.platform]
    if (!fc || !fc.text) continue
    try {
      await postFirstComment(r.platform, r.post_id, fc.text)
      if (!job.publish_results) job.publish_results = {}
      if (!job.publish_results[r.platform]) job.publish_results[r.platform] = {}
      job.publish_results[r.platform].first_comment_posted = true
    } catch (e) {
      if (!job.warnings) job.warnings = []
      job.warnings.push(`${r.platform}: first-comment failed — ${e.message}`)
    }
  }

  const anyOk = results.some(r => r.ok)
  const status = anyOk ? 'published' : 'failed'
  const first = results.find(r => r.ok)
  const publishResults = { ...(job.publish_results || {}) }
  for (const r of results) {
    if (r.ok) publishResults[r.platform] = { post_id: r.post_id, url: r.url, published_at: new Date().toISOString() }
  }
  // Build per-platform status
  const platformStatus = {}
  for (const p of targets) {
    const result = results.find(r => r.platform === p)
    if (!result) platformStatus[p] = 'pending'
    else if (result.ok) platformStatus[p] = 'success'
    else if (result.error?.includes('429') || result.error?.includes('rate limit')) platformStatus[p] = 'rate_limited'
    else platformStatus[p] = 'failed'
  }
  const updatePayload = {
    status,
    published_at: anyOk ? new Date().toISOString() : null,
    published_url: first?.url || null,
    platform_status: platformStatus,
    warnings: [
      ...(job.warnings || []),
      ...results.filter(r => !r.ok).map(r => `${r.platform}: ${r.error}`),
    ],
  }
  try { updatePayload.publish_results = publishResults } catch {}
  await storage.jobs.update(job.id, updatePayload).catch(e => console.warn('[publish] update failed:', e.message))

  if (anyOk) {
    crossLinkAfterPublish({
      ...job,
      published_url: first?.url || null,
      topic: job.topic,
    }).catch(() => {})
  }

  // Event Engine: emit publish outcome
  try {
    const { emitEvent } = await import('../event-engine')
    await emitEvent({
      type: anyOk ? 'post_published' : 'post_failed',
      source: 'publisher',
      platform: null,
      payload: { job_id: job.id, topic: (job.topic || '').slice(0, 120), ok: results.filter(r => r.ok).map(r => r.platform), failed: results.filter(r => !r.ok).map(r => ({ platform: r.platform, error: r.error })) },
      notify: !anyOk,
    }).catch(() => {})
  } catch (e) { console.warn('[publish] event emit failed:', e.message) }

  return { status, results }
}

async function postFirstComment(platform, postId, text) {
  if (platform === 'linkedin') {
    const token = process.env.LINKEDIN_ACCESS_TOKEN
    if (!token) throw new Error('LinkedIn token not configured')
    const res = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify({ actor: process.env.LINKEDIN_URN, object: postId, message: { text } }),
    })
    if (!res.ok) throw new Error(`LinkedIn comment: ${res.status} ${await res.text().then(t => t.slice(0, 200))}`)
  } else if (platform === 'instagram' || platform === 'facebook') {
    const token = process.env.META_ACCESS_TOKEN
    if (!token) throw new Error('Meta token not configured')
    const mediaId = postId
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}/comments?message=${encodeURIComponent(text)}&access_token=${token}`, { method: 'POST' })
    if (!res.ok) throw new Error(`Meta comment: ${res.status} ${await res.text().then(t => t.slice(0, 200))}`)
  }
  // Other platforms: stub
}

export async function publishBlogPost(blogPost, { dryRun = false } = {}) {
  const result = await publishToInsights({
    title: blogPost.title,
    content: blogPost.body_markdown || blogPost.content,
    excerpt: blogPost.seo_description || blogPost.excerpt,
    category: blogPost.section || 'tech',
    coverImage: blogPost.cover_image_url || blogPost.imageUrl,
    tags: blogPost.tags || [],
    status: dryRun ? 'draft' : 'published',
  })
  return result
}

export async function isPlatformRateLimited(platform) {
  try {
    const rl = await storage.rateLimits.get(platform)
    if (!rl || !rl.cooldown_until) return false
    return new Date(rl.cooldown_until) > new Date()
  } catch { return false }
}

export async function recordRateLimit(platform, retryAfterSeconds = 60) {
  await storage.rateLimits.record(platform, retryAfterSeconds)
}

export async function crossLinkAfterPublish(job) {
  if (!job.published_url || !job.topic) return
  try {
    const blogs = await storage.blogPosts.list('published')
    const recentBlog = blogs.slice(0, 5).find(b => {
      if (!b.published_url || b.published_url === job.published_url) return false
      const topicWords = (job.topic || '').toLowerCase().split(/\s+/).filter(Boolean)
      const blogWords = (b.title || '').toLowerCase().split(/\s+/).filter(Boolean)
      const common = topicWords.filter(w => blogWords.includes(w))
      return common.length >= 2
    })
    if (recentBlog) {
      await storage.jobs.update(job.id, { cross_link_url: recentBlog.published_url })
    }
  } catch (e) {
    console.warn('[crosslink] failed:', e.message)
  }
}

export const SUPPORTED_PLATFORMS = SUPPORTED
