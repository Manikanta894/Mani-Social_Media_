import { supabase } from '../supabase'
import { storage } from '../storage'
import { randomUUID } from 'crypto'
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
    const sb = supabase()
    const { data } = await sb.from('app_settings').select('value').eq('key', 'blog_automation').maybeSingle()
    let cur = (data && data.value) || {}
    let merged = { ...DEFAULT_BLOG_AUTOMATION, ...cur }
    let needsWrite = false
    if (!merged.tick_secret) {
      merged.tick_secret = randomUUID().replace(/-/g, '')
      needsWrite = true
    }
    if (needsWrite) await this._write(merged)
    return merged
  },
  async _write(value) {
    const sb = supabase()
    const { error } = await sb.from('app_settings').upsert({ key: 'blog_automation', value }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
  },
  async patch(patch) {
    const cur = await this.get()
    const merged = { ...cur, ...patch }
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
  const sb = supabase()
  try { await sb.from('blog_activity').insert({ action, file_id: fileId, details }) } catch {}
}

export async function runBlogTick() {
  const settings = await blogAutomation.get()
  await blogAutomation.patch({ last_tick_at: new Date().toISOString() })

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

  const sb = supabase()
  const start = new Date(`${now.yyyymmdd}T00:00:00${tzOffsetString(settings.timezone)}`).toISOString()
  const end = new Date(`${now.yyyymmdd}T23:59:59.999${tzOffsetString(settings.timezone)}`).toISOString()
  const { count } = await sb.from('blog_queue').select('id', { count: 'exact', head: true }).in('status', ['published', 'scheduled']).gte('discovered_at', start).lte('discovered_at', end)
  if ((count || 0) >= (settings.articles_per_day || 1)) return { skipped: `daily cap reached (${count}/${settings.articles_per_day})` }

  let q = sb.from('blog_queue').select('*').eq('status', 'queued').order('queue_position', { ascending: true }).limit(1)
  if (settings.queue_order === 'lifo') {
    q = sb.from('blog_queue').select('*').eq('status', 'queued').order('queue_position', { ascending: false }).limit(1)
  }
  const { data: nextFile } = await q.maybeSingle()
  if (!nextFile) return { skipped: 'no queued blog images' }

  await sb.from('blog_queue').update({ status: 'processing' }).eq('file_id', nextFile.file_id)
  await storage.audit.log('blog_process', 'blog_queue', nextFile.file_id, 'queued', 'processing')

  try {
    const { base64, mime_type } = await downloadBlogAsBase64(nextFile.file_id)
    const publicUrl = await publicUploadImage(base64, mime_type)
    const signedUrl = await getSignedBlogUrl(nextFile.file_id)

    const article = await generateArticle({
      imageBase64: base64,
      mimeType: mime_type,
      imageUrl: publicUrl,
      context: `Image file: ${nextFile.file_name}. Write for INSIGHTS (insights.manikantar.in).`,
      lastCategory: settings.last_category,
    })

    const status = settings.approval_required ? 'pending_approval' : (settings.draft_mode ? 'draft' : 'approved')
    await sb.from('blog_queue').update({
      status,
      article_data: article,
      ai_provider_used: `${article.visionProvider}/${article.textProvider}`,
      generation_time: new Date().toISOString(),
    }).eq('file_id', nextFile.file_id)

    await storage.audit.log('blog_generate', 'blog_queue', nextFile.file_id, 'processing', status, { title: article.title, category: article.category })
    await logActivity('generated', nextFile.file_id, { title: article.title, category: article.category })

    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      try {
        await sendPhoto({
          chatId: s.telegram_admin_chat_id,
          photoUrl: signedUrl,
          caption: formatBlogMessage(article, nextFile, status),
          replyMarkup: buildBlogKeyboard(nextFile.file_id, article, status),
        })
      } catch (e) {
        console.warn('[blog] telegram sendPhoto failed:', e.message)
        await sendMessage({ chatId: s.telegram_admin_chat_id, text: formatBlogMessage(article, nextFile, status), replyMarkup: buildBlogKeyboard(nextFile.file_id, article, status) }).catch(() => {})
      }
    }

    if (!settings.approval_required && !settings.draft_mode && settings.auto_publish) {
      try {
        const result = await publishToInsights({
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
          category: article.category,
          coverImage: publicUrl,
          tags: article.tags || [],
          status: 'published',
        })
        await sb.from('blog_queue').update({ status: 'published', published_url: result.url, published_date: new Date().toISOString() }).eq('file_id', nextFile.file_id)
        await blogAutomation.patch({ last_category: article.category })
        await storage.audit.log('blog_publish', 'blog_queue', nextFile.file_id, 'approved', 'published', { url: result.url })
        await logActivity('published', nextFile.file_id, { url: result.url, title: article.title })
        try { await archiveBlogFile(nextFile.file_id) } catch {}
        return { processed: nextFile.file_id, title: article.title, url: result.url }
      } catch (e) {
        await sb.from('blog_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
        await storage.audit.log('blog_fail', 'blog_queue', nextFile.file_id, 'approved', 'failed', { error: e.message })
        await logActivity('failed', nextFile.file_id, { error: e.message })
        return { processed: nextFile.file_id, error: e.message }
      }
    }

    return { processed: nextFile.file_id, title: article.title, status }
  } catch (e) {
    await sb.from('blog_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
    await storage.audit.log('blog_fail', 'blog_queue', nextFile.file_id, 'processing', 'failed', { error: e.message })
    await logActivity('failed', nextFile.file_id, { error: e.message })
    return { processed: nextFile.file_id, error: e.message }
  }
}

export async function blogApprove(fileId) {
  const sb = supabase()
  const { data: row } = await sb.from('blog_queue').select('*').eq('file_id', fileId).single()
  if (!row) throw new Error('File not found')
  const settings = await blogAutomation.get()
  await sb.from('blog_queue').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('file_id', fileId)
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
    await sb.from('blog_queue').update({ status: 'published', published_url: result.url, published_date: new Date().toISOString() }).eq('file_id', fileId)
    await blogAutomation.patch({ last_category: row.article_data.category })
    await logActivity('published', fileId, { url: result.url, title: row.article_data.title })
    try { await archiveBlogFile(fileId) } catch {}
    return result
  } catch (e) {
    await sb.from('blog_queue').update({ status: 'failed', error: e.message }).eq('file_id', fileId)
    await logActivity('failed', fileId, { error: e.message })
    throw e
  }
}

export async function blogPublishNow(fileId) {
  const sb = supabase()
  const { data: row } = await sb.from('blog_queue').select('*').eq('file_id', fileId).single()
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
  await sb.from('blog_queue').update({ status: 'published', published_url: result.url, published_date: new Date().toISOString() }).eq('file_id', fileId)
  await blogAutomation.patch({ last_category: row.article_data.category })
  await logActivity('published', fileId, { url: result.url, title: row.article_data.title, triggered_by: 'publish_now' })
  try { await archiveBlogFile(fileId) } catch {}
  return result
}

export async function blogReschedule(fileId) {
  const sb = supabase()
  await sb.from('blog_queue').update({ status: 'queued', article_data: null, generation_time: null }).eq('file_id', fileId)
  await logActivity('rescheduled', fileId, {})
}

export async function blogSkip(fileId) {
  const sb = supabase()
  const maxPos = await sb.from('blog_queue').select('queue_position').order('queue_position', { ascending: false }).limit(1).maybeSingle()
  const newPos = (maxPos?.queue_position || 0) + 1
  await sb.from('blog_queue').update({ status: 'queued', queue_position: newPos, article_data: null, generation_time: null }).eq('file_id', fileId)
  await logActivity('skipped', fileId, {})
}

export async function blogReject(fileId) {
  const sb = supabase()
  await sb.from('blog_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', fileId)
  await logActivity('rejected', fileId, {})
}

export async function blogRegenerate(fileId) {
  const sb = supabase()
  const { data: row } = await sb.from('blog_queue').select('*').eq('file_id', fileId).single()
  if (!row) throw new Error('File not found')
  await sb.from('blog_queue').update({ status: 'processing', article_data: null, generation_time: null, error: null }).eq('file_id', fileId)
  await logActivity('regenerating', fileId, {})
  return row
}

export async function blogRetryFailed(fileId) {
  const sb = supabase()
  const { data: row } = await sb.from('blog_queue').select('*').eq('file_id', fileId).single()
  if (!row) throw new Error('File not found')
  if (row.status !== 'failed') throw new Error('Only failed items can be retried')
  await sb.from('blog_queue').update({ status: 'queued', error: null, retry_count: ((row.retry_count || 0) + 1) }).eq('file_id', fileId)
  await logActivity('retry', fileId, { attempt: (row.retry_count || 0) + 1 })
}

export async function blogBulkAction(fileIds, action) {
  const sb = supabase()
  const results = []
  for (const fileId of fileIds) {
    try {
      switch (action) {
        case 'archive':
          await sb.from('blog_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', fileId)
          await logActivity('archived', fileId, { bulk: true })
          results.push({ fileId, ok: true }); break
        case 'skip':
          await sb.from('blog_queue').update({ status: 'skipped' }).eq('file_id', fileId)
          await logActivity('skipped', fileId, { bulk: true })
          results.push({ fileId, ok: true }); break
        case 'retry':
          await blogRetryFailed(fileId)
          results.push({ fileId, ok: true }); break
        case 'reset':
          await sb.from('blog_queue').update({ status: 'queued', error: null, retry_count: 0, article_data: null }).eq('file_id', fileId)
          results.push({ fileId, ok: true }); break
        default: results.push({ fileId, ok: false, error: 'Unknown action' })
      }
    } catch (e) { results.push({ fileId, ok: false, error: e.message }) }
  }
  return results
}

export async function blogReorderQueue(fileIds) {
  const sb = supabase()
  for (let i = 0; i < fileIds.length; i++) {
    await sb.from('blog_queue').update({ queue_position: i + 1 }).eq('file_id', fileIds[i])
  }
  await logActivity('reorder', null, {})
  return { reordered: fileIds.length }
}

export async function getBlogActivity(limit = 50) {
  const sb = supabase()
  const { data } = await sb.from('blog_activity').select('*').order('created_at', { ascending: false }).limit(limit)
  return data || []
}