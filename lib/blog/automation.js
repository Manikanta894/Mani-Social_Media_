import { storage } from '../storage'
import { deriveSecret } from '../auth'
import { downloadBlogAsBase64, getSignedBlogUrl, publicUploadImage, archiveBlogFile, nextBlogFile } from './intake'
import { generateArticle, publishToInsights } from './generate'
import { sendPhoto, sendMessage } from '../telegram/client'
import { formatBlogMessage, buildBlogKeyboard } from './formatter'

export const DEFAULT_BLOG_AUTOMATION = {
  enabled: false,
  articles_per_day: 1,
  publishing_time: '10:00',
  timezone: 'Asia/Kolkata',
  publishing_days: [0, 1, 2, 3, 4, 5, 6],
  approval_required: true,
  auto_publish: true,
  tick_secret: null,
  last_tick_at: null,
  buffer_minutes: 5,
  queue_order: 'fifo',
  max_retries: 3,
  word_count: 1200,
  writing_tone: 'professional',
  seo_enabled: true,
  draft_mode: false,
  last_category: null,
  pause_queue: false,
}

export const blogAutomation = {
  async get() {
    let cur = await storage.appState.get('blog_automation', {}) || {}
    let merged = { ...DEFAULT_BLOG_AUTOMATION, ...cur }
    merged.tick_secret = deriveSecret('blog-tick')
    return merged
  },
  async _write(value) {
    await storage.appState.set('blog_automation', value)
  },
  async patch(patch) {
    const cur = await this.get()
    const merged = { ...cur, ...patch }
    delete merged.tick_secret
    await this._write(merged)
    return merged
  },
}

function currentLocalHM(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = t => parts.find(p => p.type === t)?.value
  return { year: get('year'), month: get('month'), day: get('day'), hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10), weekday: get('weekday'), yyyymmdd: `${get('year')}-${get('month')}-${get('day')}` }
}

function wdayToNumber(wd) {
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[wd] ?? 0
}

function tzOffsetString(tz) {
  const now = new Date()
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
  const diff = (local.getTime() - utc.getTime()) / 60000
  const sign = diff >= 0 ? '+' : '-'
  const abs = Math.abs(diff)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(Math.floor(abs % 60)).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

async function logActivity(action, fileId, details = {}) {
  await storage.audit.log(action, 'blog_activity', fileId, null, null, details).catch(() => {})
}

export async function runBlogTick() {
  const settings = await blogAutomation.get()
  await blogAutomation.patch({ last_tick_at: new Date().toISOString() })

  // Sync blog intake uploads into the queue — self-healing pipeline
  try {
    const { syncBlogToQueue } = await import('./intake')
    const synced = await syncBlogToQueue()
    if (synced?.indexed > 0) {
      storage.audit.log('sync', 'blog_intake', 'tick', null, `${synced.indexed} new item(s) synced`).catch(() => {})
      console.log(`[blog tick] intake sync added ${synced.indexed} item(s)`)
    }
  } catch (e) { console.warn('[blog tick] intake sync failed:', e.message) }
  // Approval timeout handling for blog queue (pending past publishing time)
  await handleBlogApprovalTimeouts(settings).catch(() => {})

  if (!settings.enabled) return { skipped: 'blog automation disabled' }
  if (settings.pause_queue) return { skipped: 'blog queue paused' }

  const now = currentLocalHM(settings.timezone)
  const wd = wdayToNumber(now.weekday)
  if (!(settings.publishing_days || []).includes(wd)) return { skipped: `not a publishing day (${now.weekday})` }

  const [h, m] = (settings.publishing_time || '10:00').split(':').map(Number)
  const slotMin = h * 60 + m
  const nowMin = now.hour * 60 + now.minute
  const buffer = settings.buffer_minutes || 5

  if (nowMin < slotMin - buffer || nowMin >= slotMin + 5) return { skipped: `outside publishing window (${settings.publishing_time} ±${buffer}m, now ${now.hour}:${now.minute})` }

  const start = new Date(`${now.yyyymmdd}T00:00:00${tzOffsetString(settings.timezone)}`).toISOString()
  const end = new Date(`${now.yyyymmdd}T23:59:59.999${tzOffsetString(settings.timezone)}`).toISOString()
  const todayBlogs = (await storage.blogQueue.list()).filter(r => ['published', 'scheduled'].includes(r.status) && r.discovered_at && r.discovered_at >= start && r.discovered_at <= end).length
  if (todayBlogs >= (settings.articles_per_day || 1)) return { skipped: `daily cap reached (${todayBlogs}/${settings.articles_per_day})` }

  // Try topic_queue first (topics only, no images)
  const nextTopic = await storage.topicQueue.nextPending()
  
  if (nextTopic) {
    await storage.topicQueue.update(nextTopic.id, { status: 'processing' })
    try {
      const article = await generateArticle({
        context: nextTopic.topic,
        lastCategory: settings.last_category,
      })
      // Quality review — score + issues attached to the article
      const review = qualityReview(article)
      article.quality = review

      const status = settings.approval_required ? 'pending_approval' : (settings.draft_mode ? 'draft' : 'approved')
      await storage.topicQueue.update(nextTopic.id, { status: 'used', used_at: new Date().toISOString() })
      await storage.audit.log('blog_generate', 'topic_queue', nextTopic.id, 'pending', 'used', { title: article.title, category: article.category })
      await logActivity('generated', null, { title: article.title, category: article.category, source: 'topic' })

      const s = await storage.settings.get()
      if (s.telegram_bot_token && s.telegram_admin_chat_id) {
        const msg = formatBlogMessage(article, { file_name: nextTopic.topic }, status)
        const kb = buildBlogKeyboard(nextTopic.id.toString(), article, status)
        await sendMessage({ chatId: s.telegram_admin_chat_id, text: msg, replyMarkup: kb }).catch(() => {})
      }

      if (!settings.approval_required && !settings.draft_mode && settings.auto_publish) {
        try {
          const result = await publishToInsights({
            title: article.title, content: article.content, excerpt: article.excerpt,
            category: article.category, coverImage: '', tags: article.tags || [], status: 'published',
          })
          await blogAutomation.patch({ last_category: article.category })
          await logActivity('published', null, { url: result.url, title: article.title, source: 'topic' })
          return { source: 'topic', topic: nextTopic.topic, title: article.title, url: result.url }
        } catch (e) {
          await logActivity('failed', null, { error: e.message, source: 'topic' })
          return { source: 'topic', error: e.message }
        }
      }
      return { source: 'topic', topic: nextTopic.topic, title: article.title, status }
    } catch (e) {
      await storage.topicQueue.update(nextTopic.id, { status: 'failed', error: e.message })
      await logActivity('failed', null, { error: e.message, source: 'topic' })
      return { source: 'topic', error: e.message }
    }
  }

  // Fallback: blog_queue (image-based)
  let queue = (await storage.blogQueue.list('queued')).sort((a, b) => (Number(a.queue_position) || 0) - (Number(b.queue_position) || 0))
  if (settings.queue_order === 'lifo') queue = [...queue].reverse()
  const nextFile = queue[0] || null
  if (!nextFile) return { skipped: 'no pending topics or queued blog images' }

  await storage.blogQueue.update(nextFile.id, { status: 'processing' })
  await storage.audit.log('blog_process', 'blog_queue', nextFile.file_id, 'queued', 'processing')

  try {
    let article, publicUrl = '', signedUrl = ''
    try {
      const { base64, mime_type } = await downloadBlogAsBase64(nextFile.file_id)
      publicUrl = await publicUploadImage(base64, mime_type)
      signedUrl = await getSignedBlogUrl(nextFile.file_id)
      article = await generateArticle({
        imageBase64: base64, mimeType: mime_type, imageUrl: publicUrl,
        context: `Image file: ${nextFile.file_name}`,
        lastCategory: settings.last_category,
      })
    } catch (visionErr) {
      // Vision failed — try text-only generation
      article = await generateArticle({
        context: `Blog post based on image: ${nextFile.file_name}`,
        lastCategory: settings.last_category,
      })
    }

    const status = settings.approval_required ? 'pending_approval' : (settings.draft_mode ? 'draft' : 'approved')
    await storage.blogQueue.update(nextFile.id, { status, article_data: article, generation_time: new Date().toISOString() })
    await storage.audit.log('blog_generate', 'blog_queue', nextFile.file_id, 'processing', status, { title: article.title, category: article.category })
    await logActivity('generated', nextFile.file_id, { title: article.title, category: article.category })

    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const msg = formatBlogMessage(article, nextFile, status)
      const kb = buildBlogKeyboard(nextFile.file_id, article, status)
      if (signedUrl) { try { await sendPhoto({ chatId: s.telegram_admin_chat_id, photoUrl: signedUrl, caption: msg, replyMarkup: kb }) } catch { await sendMessage({ chatId: s.telegram_admin_chat_id, text: msg, replyMarkup: kb }).catch(() => {}) } }
      else { await sendMessage({ chatId: s.telegram_admin_chat_id, text: msg, replyMarkup: kb }).catch(() => {}) }
    }

    if (!settings.approval_required && !settings.draft_mode && settings.auto_publish) {
      try {
        const result = await publishToInsights({
          title: article.title, content: article.content, excerpt: article.excerpt,
          category: article.category, coverImage: publicUrl, tags: article.tags || [], status: 'published',
        })
        await storage.blogQueue.update(nextFile.id, { status: 'published', published_url: result.url, published_date: new Date().toISOString() })
        await blogAutomation.patch({ last_category: article.category })
        await logActivity('published', nextFile.file_id, { url: result.url, title: article.title })
        try { await archiveBlogFile(nextFile.file_id) } catch {}
        return { processed: nextFile.file_id, title: article.title, url: result.url }
      } catch (e) {
        await storage.blogQueue.update(nextFile.id, { status: 'failed', error: e.message })
        await logActivity('failed', nextFile.file_id, { error: e.message })
        return { processed: nextFile.file_id, error: e.message }
      }
    }
    return { processed: nextFile.file_id, title: article.title, status }
  } catch (e) {
    await storage.blogQueue.update(nextFile.id, { status: 'failed', error: e.message })
    await logActivity('failed', nextFile.file_id, { error: e.message })
    return { processed: nextFile.file_id, error: e.message }
  }
}

export async function blogApprove(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (!row) throw new Error('File not found')
  const settings = await blogAutomation.get()
  await storage.blogQueue.update(row.id, { status: 'approved', approved_at: new Date().toISOString() })
  await logActivity('approved', fileId, { title: row.article_data?.title })
  if (!settings.auto_publish) return { skipped: 'auto_publish disabled' }
  if (!row.article_data) throw new Error('No article data found')
  try {
    const result = await publishToInsights({
      title: row.article_data.title,
      content: row.article_data.content,
      excerpt: row.article_data.excerpt,
      category: row.article_data.category,
      coverImage: row.article_data.imageUrl,
      tags: row.article_data.tags || [],
      status: settings.draft_mode ? 'draft' : 'published',
    })
    await storage.blogQueue.update(row.id, { status: 'published', published_url: result.url, published_date: new Date().toISOString() })
    await blogAutomation.patch({ last_category: row.article_data.category })
    await logActivity('published', fileId, { url: result.url, title: row.article_data.title })
    try { await archiveBlogFile(fileId) } catch {}
    // Promo: create a social job from the published article (if promo enabled)
    try { await createBlogPromoJob(row.article_data, result.url) } catch {}
    return result
  } catch (e) {
    await storage.blogQueue.update(row.id, { status: 'failed', error: e.message })
    await logActivity('failed', fileId, { error: e.message })
    throw e
  }
}

export async function blogPublishNow(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (!row) throw new Error('File not found')
  if (!row.article_data) throw new Error('No article data')
  const result = await publishToInsights({
    title: row.article_data.title,
    content: row.article_data.content,
    excerpt: row.article_data.excerpt,
    category: row.article_data.category,
    coverImage: row.article_data.imageUrl,
    tags: row.article_data.tags || [],
    status: 'published',
  })
  await storage.blogQueue.update(row.id, { status: 'published', published_url: result.url, published_date: new Date().toISOString() })
  await blogAutomation.patch({ last_category: row.article_data.category })
  await logActivity('published', fileId, { url: result.url, title: row.article_data.title, triggered_by: 'publish_now' })
  try { await archiveBlogFile(fileId) } catch {}
  return result
}

export async function blogReschedule(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (row) await storage.blogQueue.update(row.id, { status: 'queued', article_data: null, generation_time: null })
  await logActivity('rescheduled', fileId, {})
}

export async function blogSkip(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  const newPos = (await storage.blogQueue.list()).reduce((m, r) => Math.max(m, Number(r.queue_position) || 0), 0) + 1
  if (row) await storage.blogQueue.update(row.id, { status: 'queued', queue_position: newPos, article_data: null, generation_time: null })
  await logActivity('skipped', fileId, {})
}

export async function blogReject(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (row) await storage.blogQueue.update(row.id, { status: 'archived', archive_date: new Date().toISOString() })
  await logActivity('rejected', fileId, {})
}

export async function blogRegenerate(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (!row) throw new Error('File not found')
  await storage.blogQueue.update(row.id, { status: 'processing', article_data: null, generation_time: null, error: null })
  await logActivity('regenerating', fileId, {})
  return row
}

export async function blogRetryFailed(fileId) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (!row) throw new Error('File not found')
  if (row.status !== 'failed') throw new Error('Only failed items can be retried')
  await storage.blogQueue.update(row.id, { status: 'queued', error: null, retry_count: ((row.retry_count || 0) + 1) })
  await logActivity('retry', fileId, { attempt: (row.retry_count || 0) + 1 })
}

export async function blogBulkAction(fileIds, action) {
  const results = []
  for (const fileId of fileIds) {
    try {
      const row = await storage.blogQueue.getByFileId(fileId)
      if (!row) { results.push({ fileId, ok: false, error: 'File not found' }); continue }
      switch (action) {
        case 'archive':
          await storage.blogQueue.update(row.id, { status: 'archived', archive_date: new Date().toISOString() })
          await logActivity('archived', fileId, { bulk: true })
          results.push({ fileId, ok: true }); break
        case 'skip':
          await storage.blogQueue.update(row.id, { status: 'skipped' })
          await logActivity('skipped', fileId, { bulk: true })
          results.push({ fileId, ok: true }); break
        case 'retry':
          await blogRetryFailed(fileId)
          results.push({ fileId, ok: true }); break
        case 'reset':
          await storage.blogQueue.update(row.id, { status: 'queued', error: null, retry_count: 0, article_data: null })
          results.push({ fileId, ok: true }); break
        default: results.push({ fileId, ok: false, error: 'Unknown action' })
      }
    } catch (e) { results.push({ fileId, ok: false, error: e.message }) }
  }
  return results
}

export async function blogReorderQueue(fileIds) {
  for (let i = 0; i < fileIds.length; i++) {
    const row = await storage.blogQueue.getByFileId(fileIds[i])
    if (row) await storage.blogQueue.update(row.id, { queue_position: i + 1 })
  }
  await logActivity('reorder', null, {})
  return { reordered: fileIds.length }
}

// --- Promo: create a scheduled social post from a published blog article ---
async function createBlogPromoJob(article, url) {
  const { storage } = await import('../storage')
  const title = article.title || 'New article'
  const excerpt = article.excerpt || article.metaDescription || ''
  const content = article.content || ''
  const firstPara = content.split('\n').find(p => p.trim().length > 40)?.trim().slice(0, 200) || excerpt.slice(0, 200)
  const post = {
    linkedin: { caption: `Just published: "${title}"\n\n${firstPara}\n\nRead the full article → ${url}`, hashtags: ['#INSIGHTS', '#ThoughtLeadership'] },
    instagram: { caption: `New on INSIGHTS ✨\n"${title}"\n\n${excerpt.slice(0, 100)}\n\nLink in bio!`, hashtags: ['#INSIGHTS', '#FutureOfWork', '#AI', '#Business'] },
    facebook: { caption: `New article on INSIGHTS:\n\n"${title}"\n\n${firstPara}\n\nRead more → ${url}`, hashtags: ['#INSIGHTS'] },
    threads: { caption: `New on INSIGHTS: "${title}"\n\n${excerpt.slice(0, 80)}…`, hashtags: ['#INSIGHTS'] },
    twitter: { caption: `New: "${title}"\n\n${excerpt.slice(0, 100)}…\n\n${url}`, hashtags: ['#INSIGHTS'] },
  }
  await storage.jobs.create({
    source: 'blog_promo', topic: `Promo: ${title.slice(0, 90)}`, platform_posts: post,
    status: 'pending_approval', scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  }).catch(() => {})
  await storage.audit.log('blog_promo', 'content_job', null, 'published', 'created', { title }).catch(() => {})
}

// --- Quality review: score generated article before approval ---
export function qualityReview(article) {
  if (!article) return { score: 0, issues: ['No article data'] }
  const issues = []
  const content = article.content || ''
  const wordCount = content.split(/\s+/).filter(Boolean).length
  if (wordCount < 400) issues.push(`Too short (${wordCount} words)`)
  if (!article.title || article.title.length < 10) issues.push('Title too short')
  if (!article.metaDescription || article.metaDescription.length < 60) issues.push('Meta description too short')
  if (!article.slug) issues.push('Missing slug')
  const h2Count = (content.match(/^##\s/gm) || []).length
  if (h2Count < 3) issues.push(`Only ${h2Count} H2 headings`)
  const tags = article.tags || []
  if (tags.length < 3) issues.push('Fewer than 3 tags')
  const faqCount = Array.isArray(article.faq) ? article.faq.length : 0
  if (faqCount < 3) issues.push(`Only ${faqCount} FAQ items`)
  const score = Math.max(0, 100 - issues.length * 10 - (wordCount < 800 ? 10 : 0))
  return { score, issues, wordCount, h2Count }
}

// --- Blog approval timeout: pending past publishing time → configured behavior ---
async function handleBlogApprovalTimeouts(settings) {
  const action = settings.approval_timeout_action || 'move_next'
  const nowLocal = currentLocalHM(settings.timezone)
  const slotMin = (settings.publishing_time || '10:00').split(':').map(Number).reduce((a, b) => a * 60 + b, 0)
  const nowMin = nowLocal.hour * 60 + nowLocal.minute
  if (nowMin <= slotMin + 5) return

  const pending = await storage.blogQueue.list('pending_approval')
  for (const item of pending || []) {
    if (action === 'skip') {
      await storage.blogQueue.update(item.id, { status: 'skipped' })
      await storage.audit.log('blog_skip', 'blog_queue', item.file_id, 'pending_approval', 'skipped', { reason: 'approval_timeout' }).catch(() => {})
    } else if (action === 'auto_publish') {
      await storage.blogQueue.update(item.id, { status: 'approved', approved_at: new Date().toISOString() })
      await storage.audit.log('blog_approve', 'blog_queue', item.file_id, 'pending_approval', 'approved', { reason: 'approval_timeout' }).catch(() => {})
      if (item.article_data) {
        try {
          const result = await publishToInsights({
            title: item.article_data.title, content: item.article_data.content, excerpt: item.article_data.excerpt,
            category: item.article_data.category, coverImage: item.article_data.imageUrl || '', tags: item.article_data.tags || [], status: 'published',
          })
          await storage.blogQueue.update(item.id, { status: 'published', published_url: result.url, published_date: new Date().toISOString() })
        } catch {}
      }
    } else {
      const maxPos = (await storage.blogQueue.list()).reduce((m, r) => Math.max(m, Number(r.queue_position) || 0), 0)
      await storage.blogQueue.update(item.id, { status: 'queued', queue_position: maxPos + 1, article_data: null })
      await storage.audit.log('blog_reschedule', 'blog_queue', item.file_id, 'pending_approval', 'queued', { reason: 'approval_timeout' }).catch(() => {})
    }
  }
}

export async function getBlogActivity(limit = 50) {
  const rows = await storage.audit.list(200)
  return rows.filter(r => r.entity_type === 'blog_activity').slice(0, limit)
}