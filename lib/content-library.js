import { storage } from './storage'

// ---------------------------------------------------------------------------
// Unified Content Library — imports the COMPLETE publishing history from each
// connected platform API and merges it with app-published posts.
// ---------------------------------------------------------------------------

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'threads']
const UA = { 'User-Agent': 'SocialForge/1.0' }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const safeJson = async res => {
  try { return await res.json() } catch { return {} }
}
const num = v => (typeof v === 'number' && !isNaN(v) ? v : 0)

// Cache-backed storage — works even before the content_library table exists.
// The cache lives in app_settings JSONB; the real table takes over when migrated.
async function tableReady() {
  try { await storage.contentLibrary.list({ limit: 1 }); return true } catch { return false }
}
async function cacheGet() {
  try { const s = await storage.settings.get(); return s.content_library_cache || [] } catch { return [] }
}
async function cacheSet(rows) {
  try { await storage.settings.patch({ content_library_cache: rows.slice(0, 800) }) } catch {}
}
async function libraryUpsert(row) {
  let res
  try { res = await storage.contentLibrary.upsert(row); return res } catch {}
  const rows = await cacheGet()
  const existing = rows.find(r => r.platform === row.platform && r.platform_post_id === row.postId)
  const entry = {
    platform: row.platform, platform_post_id: row.postId, url: row.url, caption: row.caption,
    thumbnail_url: row.thumbnail, media_type: row.mediaType, source: row.source, job_id: row.jobId,
    published_at: row.publishedAt, likes: row.likes, comments: row.comments, shares: row.shares, saves: row.saves,
    impressions: row.impressions, reach: row.reach, clicks: row.clicks, profile_visits: row.profile_visits,
    engagement_rate: row.engagement_rate,
  }
  if (existing) Object.assign(existing, entry)
  else rows.unshift(entry)
  await cacheSet(rows)
  return { imported: !existing, data: entry }
}

function perfStatus(post) {
  const eng = (post.likes || 0) + (post.comments || 0) + (post.shares || 0)
  if (eng >= 500) return { label: 'Top performer', tone: 'success' }
  if (eng >= 100) return { label: 'Healthy', tone: 'info' }
  if (eng > 0) return { label: 'Gaining traction', tone: 'warning' }
  return { label: 'Needs boost', tone: 'muted' }
}

function extractTags(caption) {
  const tags = []
  const re = /#([a-zA-Z0-9_]{2,40})/g
  let m
  while ((m = re.exec(caption || ''))) tags.push(m[1].toLowerCase())
  return tags
}

// --------------------------- LinkedIn -------------------------------------

async function importLinkedIn({ limit = 25, out = {} }) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN
  const urn = process.env.LINKEDIN_URN
  if (!token || !urn) return out
  const author = urn.includes('urn:') ? urn : `urn:li:person:${urn}`
  try {
    const res = await fetch(`https://api.linkedin.com/v2/ugcPosts?q=authors&authors=${encodeURIComponent(author)}&count=${limit}&start=0&sortBy=LAST_MODIFIED`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0', ...UA },
    })
    if (!res.ok) { out.linkedin = { error: `HTTP ${res.status}` }; return out }
    const data = await safeJson(res)
    for (const item of data.elements || []) {
      const postUrn = item.id
      if (!postUrn) continue
      const share = item.specificContent?.['com.linkedin.ugc.ShareContent'] || {}
      const stats = await fetchLinkedInStatsByUrn(token, postUrn)
      const published = item.created?.time ? new Date(item.created.time).toISOString() : null
      await upsertLib({
        platform: 'linkedin',
        postId: postUrn,
        url: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`,
        caption: share.shareCommentary?.text || '',
        mediaType: share.shareMediaCategory === 'IMAGE' ? 'image' : share.shareMediaCategory === 'VIDEO' ? 'video' : 'text',
        publishedAt: published,
        ...stats,
      }, out)
    }
  } catch (e) { out.linkedin = { error: e.message } }
  return out
}

async function fetchLinkedInStatsByUrn(token, postUrn) {
  const base = { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, reach: 0, clicks: 0, profile_visits: 0 }
  try {
    const res = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postUrn)}/lifetimeShareStatistics?projection=(shares*)`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0', ...UA },
    })
    if (res.ok) {
      const data = await safeJson(res)
      const s = data?.shares?.[0] || {}
      return {
        impressions: num(s.impressionCount), likes: num(s.likeCount), comments: num(s.commentCount), shares: num(s.shareCount),
        saves: 0, reach: 0, clicks: 0, profile_visits: 0,
      }
    }
  } catch {}
  return base
}

// --------------------------- Facebook -------------------------------------

async function importFacebook({ limit = 25, out = {} }) {
  const token = process.env.META_ACCESS_TOKEN
  const pageId = process.env.FB_PAGE_ID
  if (!token || !pageId) return out
  try {
    const fields = 'id,message,created_time,full_picture,permalink_url,type,status_type,is_published'
    const res = await fetch(`https://graph.facebook.com/v20.0/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${token}`)
    if (!res.ok) { out.facebook = { error: `HTTP ${res.status}` }; return out }
    const data = await safeJson(res)
    for (const post of data.data || []) {
      const stats = await fetchFacebookStats(token, post.id)
      const mediaType = post.type === 'photo' ? 'image' : post.type === 'video' ? 'video' : post.status_type === 'shared_story' ? 'text' : post.type || 'text'
      await upsertLib({
        platform: 'facebook',
        postId: post.id,
        url: post.permalink_url || (post.id ? `https://www.facebook.com/${post.id}` : null),
        caption: post.message || '',
        thumbnail: post.full_picture || null,
        mediaType,
        publishedAt: post.created_time ? new Date(post.created_time).toISOString() : null,
        ...stats,
      }, out)
    }
  } catch (e) { out.facebook = { error: e.message } }
  return out
}

async function fetchFacebookStats(token, postId) {
  const base = { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, reach: 0, clicks: 0, profile_visits: 0 }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${postId}/insights?metric=post_impressions,post_impressions_unique,post_reactions_by_type_total,post_comments,post_shares&access_token=${token}`)
    if (!res.ok) return base
    const data = await safeJson(res)
    const map = {}
    for (const row of data.data || []) {
      const val = row.values?.[0]?.value
      if (row.name === 'post_impressions') map.impressions = num(val)
      if (row.name === 'post_impressions_unique') map.reach = num(val)
      if (row.name === 'post_comments') map.comments = num(val)
      if (row.name === 'post_shares') map.shares = num(val)
      if (row.name === 'post_reactions_by_type_total') map.likes = Object.values(val || {}).reduce((a, b) => a + num(b), 0)
    }
    return { ...base, ...map }
  } catch { return base }
}

// --------------------------- Instagram ------------------------------------

async function importInstagram({ limit = 25, out = {} }) {
  const token = process.env.META_ACCESS_TOKEN
  const accId = process.env.IG_BUSINESS_ACCOUNT_ID
  if (!token || !accId) return out
  try {
    const fields = 'id,caption,timestamp,media_type,thumbnail_url,permalink,like_count,comments_count'
    const res = await fetch(`https://graph.facebook.com/v20.0/${accId}/media?fields=${fields}&limit=${limit}&access_token=${token}`)
    if (!res.ok) { out.instagram = { error: `HTTP ${res.status}` }; return out }
    const data = await safeJson(res)
    for (const media of data.data || []) {
      const insights = await fetchInstagramInsights(token, media.id)
      const mediaType = media.media_type === 'VIDEO' ? 'video' : media.media_type === 'CAROUSEL_ALBUM' ? 'carousel' : 'image'
      await upsertLib({
        platform: 'instagram',
        postId: media.id,
        url: media.permalink || (media.id ? `https://www.instagram.com/p/${media.id}/` : null),
        caption: media.caption || '',
        thumbnail: media.thumbnail_url || null,
        mediaType,
        publishedAt: media.timestamp ? new Date(media.timestamp).toISOString() : null,
        likes: num(media.like_count), comments: num(media.comments_count),
        ...insights,
      }, out)
    }
  } catch (e) { out.instagram = { error: e.message } }
  return out
}

async function fetchInstagramInsights(token, mediaId) {
  const base = { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, reach: 0, clicks: 0, profile_visits: 0 }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${mediaId}/insights?metric=impressions,reach,saved&access_token=${token}`)
    if (!res.ok) return base
    const data = await safeJson(res)
    const map = {}
    for (const row of data.data || []) {
      const val = row.values?.[0]?.value
      if (row.name === 'impressions') map.impressions = num(val)
      if (row.name === 'reach') map.reach = num(val)
      if (row.name === 'saved') map.saves = num(val)
    }
    return { ...base, ...map }
  } catch { return base }
}

// --------------------------- Threads --------------------------------------

async function importThreads({ limit = 25, out = {} }) {
  const token = process.env.META_ACCESS_TOKEN
  const userId = process.env.THREADS_USER_ID
  if (!token || !userId) return out
  try {
    const fields = 'id,text,timestamp,permalink,media_type,thumbnail_url,like_count,replies_count,reposts_count,quotes_count'
    const res = await fetch(`https://graph.threads.net/v1.0/${userId}/threads?fields=${fields}&limit=${limit}&access_token=${token}`)
    if (!res.ok) { out.threads = { error: `HTTP ${res.status}` }; return out }
    const data = await safeJson(res)
    for (const thread of data.data || []) {
      const mediaType = thread.media_type === 'VIDEO' ? 'video' : thread.media_type === 'IMAGE' ? 'image' : 'text'
      await upsertLib({
        platform: 'threads',
        postId: thread.id,
        url: thread.permalink || (thread.id ? `https://www.threads.net/@user/post/${thread.id}` : null),
        caption: thread.text || '',
        thumbnail: thread.thumbnail_url || null,
        mediaType,
        publishedAt: thread.timestamp ? new Date(thread.timestamp).toISOString() : null,
        likes: num(thread.like_count), comments: num(thread.replies_count), shares: num(thread.reposts_count),
        saves: 0, impressions: 0, reach: 0, clicks: 0, profile_visits: 0,
      }, out)
    }
  } catch (e) { out.threads = { error: e.message } }
  return out
}

// --------------------------- App posts backfill ---------------------------

async function importAppPosts({ out = {} }) {
  const jobs = await storage.jobs.list().catch(() => [])
  let count = 0
  for (const job of jobs) {
    if (job.status !== 'published' && !job.published_at) continue
    const results = job.publish_results || {}
    for (const platform of PLATFORMS) {
      const pr = results[platform]
      if (!pr?.post_id) continue
      const caption = job.platform_posts?.[platform]?.caption || ''
      await storage.contentLibrary.upsert({
        platform,
        postId: pr.post_id,
        url: pr.url || null,
        caption,
        thumbnail: typeof job.image_ref === 'string' && job.image_ref.startsWith('http') ? job.image_ref : null,
        mediaType: 'image',
        source: 'app',
        jobId: job.id,
        publishedAt: pr.published_at || job.published_at || null,
      })
      count++
    }
  }
  out.app_posts = { imported: count }
  return out
}

// --------------------------- Core upsert ----------------------------------

async function upsertLib({ platform, postId, url, caption, thumbnail, mediaType, publishedAt, likes = 0, comments = 0, shares = 0, saves = 0, impressions = 0, reach = 0, clicks = 0, profile_visits = 0, source = 'import', jobId = null }, out) {
  if (!platform || !postId) return
  const engagement = likes + comments + shares + saves
  const rate = impressions > 0 ? Math.round((engagement / impressions) * 1000) / 10 : 0
  try {
    const res = await libraryUpsert({
      platform, postId, url, caption: (caption || '').slice(0, 2000), thumbnail, mediaType,
      publishedAt: publishedAt || null, likes, comments, shares, saves, impressions, reach, clicks, profile_visits, engagement_rate: rate, source, jobId,
    })
    out[platform] = out[platform] || { imported: 0, updated: 0 }
    if (res?.imported === true) out[platform].imported++
    else out[platform].updated++
  } catch (e) { console.warn(`[library] upsert ${platform} failed:`, e.message) }
}

// --------------------------- Public API -----------------------------------

export async function syncLibrary({ limit = 25, budgetMs = 40000 } = {}) {
  const out = {}
  const started = Date.now()
  const remaining = () => budgetMs - (Date.now() - started)
  const run = async (fn) => {
    if (remaining() < 5000) return out
    await fn({ limit, out })
  }
  await run(importLinkedIn)
  await sleep(200)
  await run(importFacebook)
  await sleep(200)
  await run(importInstagram)
  await sleep(200)
  await run(importThreads)
  await run(importAppPosts)
  return out
}

export async function getLibrary({ platform = null, limit = 500 } = {}) {
  let rows = []
  try {
    rows = await storage.contentLibrary.list({ platform, limit })
  } catch (e) {
    console.warn('[library] table missing — using cache:', e.message)
    const cached = await cacheGet()
    rows = cached.filter(r => !platform || r.platform === platform).slice(0, limit)
  }
  return rows.map(r => ({
    id: r.id,
    platform: r.platform,
    platform_post_id: r.platform_post_id,
    url: r.url,
    caption: r.caption,
    thumbnail_url: r.thumbnail_url,
    media_type: r.media_type,
    source: r.source,
    job_id: r.job_id,
    published_at: r.published_at,
    likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves,
    impressions: r.impressions, reach: r.reach, clicks: r.clicks, profile_visits: r.profile_visits,
    engagement_rate: r.engagement_rate,
    status: perfStatus(r),
    hashtags: extractTags(r.caption),
  }))
}

export async function maybeSyncLibrary({ maxAgeMs = 6 * 60 * 60 * 1000, limit = 10, budgetMs = 20000 } = {}) {
  const s = await storage.settings.get()
  const last = s.library_last_sync ? new Date(s.library_last_sync).getTime() : 0
  if (Date.now() - last < maxAgeMs) return { skipped: true }
  const result = await syncLibrary({ limit, budgetMs })
  await storage.settings.patch({ library_last_sync: new Date().toISOString() })
  return { skipped: false, result }
}

export async function getLibraryStats() {
  let rows = []
  try { rows = await storage.contentLibrary.list({ limit: 10000 }) } catch { rows = await cacheGet() }
  const total = rows.length
  const byPlatform = {}
  for (const r of rows) byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1
  return { total, byPlatform }
}
