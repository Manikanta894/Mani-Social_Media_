import { supabase } from './supabase'
import { storage } from './storage'
import { randomUUID } from 'crypto'
import { runSelfHeal } from './self-heal'
import { weeklyDigest } from './self-heal'
import {
  syncIntakeToQueue,
  downloadIntakeAsBase64,
  archiveIntakeFile,
  getSignedIntakeUrl,
  nextQueuedFile,
  setQueueStatus,
} from './intake'
import { uploadBase64Image } from './media'
import { generateFromImage } from './ai/generate'
import { sendDraftToAdmin } from './telegram/handler'
import { sendPhoto, editMessageText, sendMessage } from './telegram/client'
import { formatAutomationJobMessage, buildAutomationJobKeyboard } from './telegram/formatter'

export const DEFAULT_AUTOMATION = {
  enabled: false,
  posts_per_day: 5,
  posting_times: ['09:00', '12:30', '15:30', '18:30', '21:00'],
  timezone: 'Asia/Kolkata',
  working_days: [0, 1, 2, 3, 4, 5, 6],
  approval_required: true,
  auto_publish_after_approve: true,
  tick_secret: null,
  last_tick_at: null,
  buffer_minutes: 5,
  queue_order: 'fifo',
  max_retries: 3,
  retry_delay_minutes: 15,
  publishing_order: 'sequential',
  enabled_platforms: ['linkedin', 'instagram', 'facebook', 'threads'],
  ai_temperature: 0.7,
  emoji_enabled: true,
  hashtag_count: 5,
  cta_style: 'conversational',
  writing_tone: 'professional',
  regeneration_limit: 3,
  pause_queue: false,
} 

export const automation = {
  async get() {
    const sb = supabase()
    const { data } = await sb.from('app_settings').select('value').eq('key', 'automation').maybeSingle()
    let cur = (data && data.value) || {}
    let merged = { ...DEFAULT_AUTOMATION, ...cur }
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
    const { error } = await sb.from('app_settings').upsert({ key: 'automation', value }, { onConflict: 'key' })
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
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = t => parts.find(p => p.type === t)?.value
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10),
    weekday: get('weekday'), yyyymmdd: `${get('year')}-${get('month')}-${get('day')}`,
  }
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

async function countSocialJobsToday(yyyymmdd, tz) {
  const sb = supabase()
  const start = new Date(`${yyyymmdd}T00:00:00${tzOffsetString(tz)}`).toISOString()
  const end = new Date(`${yyyymmdd}T23:59:59.999${tzOffsetString(tz)}`).toISOString()
  const { count } = await sb.from('drive_queue').select('id', { count: 'exact', head: true })
    .eq('folder_prefix', 'social')
    .in('status', ['published', 'scheduled'])
    .gte('discovered_at', start).lte('discovered_at', end)
  return count || 0
}

function findDueSlotIndex(times, hour, minute, bufferMin = 5) {
  const nowMin = hour * 60 + minute
  let bestIdx = -1
  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(':').map(Number)
    const slotMin = h * 60 + m
    if (nowMin >= slotMin - bufferMin && nowMin < slotMin + 5 && bestIdx === -1) bestIdx = i
  }
  return bestIdx
}

async function logActivity(action, fileId, jobId, details = {}) {
  const sb = supabase()
  try {
    await sb.from('automation_activity').insert({ action, file_id: fileId, job_id: jobId, details })
  } catch {}
}

export async function runTick() {
  const settings = await automation.get()
  await automation.patch({ last_tick_at: new Date().toISOString() })

  runSelfHeal().catch(() => {})

  import('./seasonal-engine').then(m => m.detectUpcomingEvents()).catch(() => {})

  const { data: lastDigest } = await supabase().from('app_settings').select('value').eq('key', 'last_weekly_digest').maybeSingle()
  const lastDigestAt = lastDigest?.value?.at ? new Date(lastDigest.value.at) : new Date(0)
  if (Date.now() - lastDigestAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    weeklyDigest().catch(() => {})
    try { await supabase().from('app_settings').upsert({ key: 'last_weekly_digest', value: { at: new Date().toISOString() } }, { onConflict: 'key' }) } catch {}
  }

  if (!settings.enabled) return { skipped: 'automation disabled' }
  if (settings.pause_queue) return { skipped: 'queue paused' }

  const now = currentLocalHM(settings.timezone)
  const wd = wdayToNumber(now.weekday)
  if (!(settings.working_days || []).includes(wd)) return { skipped: `not a working day (${now.weekday})` }

  const times = settings.posting_times || []
  const dueIdx = findDueSlotIndex(times, now.hour, now.minute, settings.buffer_minutes || 5)
  if (dueIdx === -1) return { skipped: `no slots in buffer window (now ${now.hour}:${now.minute})` }

  const created = await countSocialJobsToday(now.yyyymmdd, settings.timezone)
  if (created >= (settings.posts_per_day || 5)) return { skipped: `daily cap reached (${created}/${settings.posts_per_day})` }

  if (created >= dueIdx + 1) return { skipped: `slot ${dueIdx + 1} already processed (${created}/${settings.posts_per_day})` }

  const sb = supabase()
  const baseQuery = () => sb.from('drive_queue').select('*').eq('status', 'queued').or('paused.eq.false,paused.is.null')
  let q = baseQuery().order('queue_position', { ascending: true }).limit(1)
  if (settings.queue_order === 'lifo') {
    q = baseQuery().order('queue_position', { ascending: false }).limit(1)
    if (!q) q = baseQuery().order('queue_position', { ascending: true }).limit(1)
  }
  const { data: nextFile } = await q.maybeSingle()
  if (!nextFile) return { skipped: 'no queued files in intake/social/' }

  await sb.from('drive_queue').update({ status: 'processing' }).eq('file_id', nextFile.file_id)
  await storage.audit.log('process', 'drive_queue', nextFile.file_id, 'queued', 'processing')

  try {
    const { base64, mime_type } = await downloadIntakeAsBase64(nextFile.file_id)
    const publicUpload = await uploadBase64Image(base64, mime_type)
    const signedUrl = await getSignedIntakeUrl(nextFile.file_id)

    const providers = await storage.providers.list()
    const textProvider = providers.find(p => p.active_for_text)
    if (!textProvider) {
      await sb.from('drive_queue').update({ status: 'failed', error: 'No AI text provider configured' }).eq('file_id', nextFile.file_id)
      return { skipped: 'no AI text provider configured' }
    }

    const activeStyle = await storage.promptStyles.getActive()
    const job = await storage.jobs.create({
      source: 'ai_intake',
      topic: nextFile.file_name,
      image_ref: publicUpload.url,
      style_id: activeStyle?.id,
      style_name: activeStyle?.name,
      status: 'draft',
    })

    const tone = settings.writing_tone || 'professional'
    const emojiInstruction = settings.emoji_enabled !== false ? '' : 'Do NOT use emojis in any caption.'
    const ctaInstruction = settings.cta_style === 'conversational'
      ? 'Include a conversational call-to-action like "What do you think?" or "Share your thoughts below."'
      : settings.cta_style === 'direct'
        ? 'Include a direct call-to-action like "Click the link to learn more" or "Sign up today."'
        : 'Include a soft call-to-action.'
    const hashtagInstruction = `Use exactly ${settings.hashtag_count || 5} relevant hashtags per platform.`

    const platformInstruction = settings.enabled_platforms?.length
      ? `Generate content ONLY for these platforms: ${settings.enabled_platforms.join(', ')}. Skip any platforms not in this list.`
      : ''

    const aiContext = `Image: ${nextFile.file_name}
Tone: ${tone}
${emojiInstruction}
${ctaInstruction}
${hashtagInstruction}
${platformInstruction}
Current trends context: Create engaging, platform-optimized social media content based on the analyzed image.
The content should feel natural, not robotic. Use the image details to craft relevant posts.`

    const result = await generateFromImage({
      imageBase64: base64,
      mimeType: mime_type,
      context: aiContext,
      styleId: activeStyle?.id,
      jobId: job.id,
      tone,
    })

    const updatedJob = await storage.jobs.update(job.id, {
      research_context: result.research_context,
      platform_posts: result.posts,
      warnings: result.warnings,
      status: settings.approval_required ? 'pending_approval' : 'approved',
    })

    const scheduledTime = `${times[dueIdx]} ${settings.timezone}`
    await sb.from('drive_queue').update({
      status: settings.approval_required ? 'pending_approval' : 'approved',
      content_job_id: job.id,
      ai_analysis: { research_context: result.research_context, objects: null, scene: null, mood: null, colors: null },
      platform_content: result.posts,
      ai_provider_used: result.providers_used?.text?.name || textProvider.name,
      ai_confidence: result.posts?.linkedin?.ai_confidence || null,
      generation_time: new Date().toISOString(),
      scheduled_slot_index: dueIdx,
      scheduled_time: scheduledTime,
    }).eq('file_id', nextFile.file_id)

    await storage.audit.log('generate', 'drive_queue', nextFile.file_id, 'processing', settings.approval_required ? 'pending_approval' : 'approved',
      { providers: result.providers_used, slot: dueIdx + 1 })
    await logActivity('ai_generated', nextFile.file_id, job.id, { slot: dueIdx + 1, provider: result.providers_used?.text?.name })

    try {
      const s = await storage.settings.get()
      if (s.telegram_bot_token && s.telegram_admin_chat_id) {
        await sendPhoto({
          chatId: s.telegram_admin_chat_id,
          photoUrl: signedUrl,
          caption: formatAutomationJobMessage(updatedJob, dueIdx, scheduledTime),
          replyMarkup: buildAutomationJobKeyboard(updatedJob, nextFile.file_id),
        })
      }
    } catch (e) {
      console.warn('[tick] telegram send failed:', e.message)
    }

    if (!settings.approval_required && settings.auto_publish_after_approve) {
      const { publishJob } = await import('./publishers')
      try {
        const enabledPlatforms = settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads']
        const r = await publishJob(updatedJob, { platforms: enabledPlatforms })
        const publishedP = r.results.filter(x => x.ok).map(x => x.platform)
        const failedP = r.results.filter(x => !x.ok).map(x => x.platform)
        await sb.from('drive_queue').update({
          status: failedP.length === 0 ? 'published' : 'failed',
          published_platforms: publishedP,
          failed_platforms: failedP,
          published_date: new Date().toISOString(),
        }).eq('file_id', nextFile.file_id)
        await storage.audit.log('publish', 'drive_queue', nextFile.file_id, 'approved', 'published', { results: r.results })
        await logActivity('published', nextFile.file_id, job.id, { platforms: publishedP, failed: failedP })
        try { await archiveIntakeFile(nextFile.file_id) } catch {}
      } catch (e) {
        await sb.from('drive_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
        await storage.audit.log('fail', 'drive_queue', nextFile.file_id, 'approved', 'failed', { error: e.message })
        await logActivity('failed', nextFile.file_id, job.id, { error: e.message })
      }
    }

    return { processed: nextFile.file_id, job_id: job.id, slot: dueIdx + 1, of_expected: created + 1 }
  } catch (e) {
    await sb.from('drive_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
    await storage.audit.log('fail', 'drive_queue', nextFile.file_id, 'processing', 'failed', { error: e.message })
    await logActivity('failed', nextFile.file_id, null, { error: e.message })
    return { processed: nextFile.file_id, error: e.message }
  }
}

export async function onApprove(job) {
  const settings = await automation.get()
  await storage.audit.log('approve', 'content_job', job.id, job.status, 'approved')
  const sb = supabase()
  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    await sb.from('drive_queue').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('file_id', qr.file_id)
    await logActivity('approved', qr.file_id, job.id, {})
  }
  if (!settings.auto_publish_after_approve) return { skipped: 'auto_publish_after_approve is off' }
  const { publishJob } = await import('./publishers')
  const enabledPlatforms = settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads']
  const r = await publishJob(job, { platforms: enabledPlatforms })
  if (qr) {
    const publishedP = r.results.filter(x => x.ok).map(x => x.platform)
    const failedP = r.results.filter(x => !x.ok).map(x => x.platform)
    const allOk = failedP.length === 0
    await sb.from('drive_queue').update({
      status: allOk ? 'published' : publishedP.length > 0 ? 'failed' : 'failed',
      published_platforms: publishedP,
      failed_platforms: failedP,
      published_date: allOk ? new Date().toISOString() : null,
    }).eq('file_id', qr.file_id)
    await logActivity(allOk ? 'published' : 'failed', qr.file_id, job.id, { platforms: publishedP, failed: failedP })
    if (allOk) {
      try { await archiveIntakeFile(qr.file_id) } catch {}
    }
  }
  return r
}

export async function onSkip(job) {
  const sb = supabase()
  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    const maxPos = await sb.from('drive_queue').select('queue_position').order('queue_position', { ascending: false }).limit(1).maybeSingle()
    const newPos = (maxPos?.queue_position || 0) + 1
    await sb.from('drive_queue').update({ status: 'queued', queue_position: newPos, content_job_id: null }).eq('file_id', qr.file_id)
    await logActivity('skipped', qr.file_id, job.id, {})
  }
  await storage.jobs.update(job.id, { status: 'draft' })
  await storage.audit.log('skip', 'content_job', job.id, job.status, 'draft', { moved_to_slot: 'next' })
}

export async function onReject(job) {
  const sb = supabase()
  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    await sb.from('drive_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', qr.file_id)
    await logActivity('archived', qr.file_id, job.id, {})
  }
  await storage.jobs.update(job.id, { status: 'rejected' })
  await storage.audit.log('reject', 'content_job', job.id, job.status, 'rejected')
}

export async function onPublishNow(job) {
  const sb = supabase()
  const settings = await automation.get()
  const enabledPlatforms = settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads']
  const { publishJob } = await import('./publishers')
  const r = await publishJob(job, { platforms: enabledPlatforms })
  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    const publishedP = r.results.filter(x => x.ok).map(x => x.platform)
    const failedP = r.results.filter(x => !x.ok).map(x => x.platform)
    const allOk = failedP.length === 0
    await sb.from('drive_queue').update({
      status: allOk ? 'published' : 'failed',
      published_platforms: publishedP,
      failed_platforms: failedP,
      published_date: allOk ? new Date().toISOString() : null,
    }).eq('file_id', qr.file_id)
    await logActivity(allOk ? 'published' : 'failed', qr.file_id, job.id, { platforms: publishedP, failed: failedP, triggered_by: 'publish_now' })
    if (allOk) {
      try { await archiveIntakeFile(qr.file_id) } catch {}
    }
  }
  return r
}

export async function retryFailed(fileId) {
  const sb = supabase()
  const { data: row } = await sb.from('drive_queue').select('*').eq('file_id', fileId).single()
  if (!row) throw new Error('File not found')
  if (row.status !== 'failed') throw new Error('Only failed items can be retried')
  if (row.retry_count >= (row.max_retries || 3)) throw new Error('Max retries reached')
  await sb.from('drive_queue').update({
    status: 'queued',
    retry_count: (row.retry_count || 0) + 1,
    error: null,
  }).eq('file_id', fileId)
  await logActivity('retry', fileId, row.content_job_id, { attempt: (row.retry_count || 0) + 1 })
  return { retried: true }
}

export async function bulkAction(fileIds, action) {
  const sb = supabase()
  const results = []
  for (const fileId of fileIds) {
    try {
      switch (action) {
        case 'archive':
          await sb.from('drive_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', fileId)
          await logActivity('archived', fileId, null, { bulk: true })
          results.push({ fileId, ok: true })
          break
        case 'skip':
          await sb.from('drive_queue').update({ status: 'skipped' }).eq('file_id', fileId)
          await logActivity('skipped', fileId, null, { bulk: true })
          results.push({ fileId, ok: true })
          break
        case 'retry':
          const r = await retryFailed(fileId)
          results.push({ fileId, ok: true, ...r })
          break
        case 'reset':
          await sb.from('drive_queue').update({ status: 'queued', error: null, retry_count: 0, published_platforms: [], failed_platforms: [] }).eq('file_id', fileId)
          results.push({ fileId, ok: true })
          break
        default:
          results.push({ fileId, ok: false, error: 'Unknown action' })
      }
    } catch (e) {
      results.push({ fileId, ok: false, error: e.message })
    }
  }
  return results
}

export async function reorderQueue(fileIds) {
  const sb = supabase()
  for (let i = 0; i < fileIds.length; i++) {
    await sb.from('drive_queue').update({ queue_position: i + 1 }).eq('file_id', fileIds[i])
  }
  await logActivity('reorder', null, null, {})
  return { reordered: fileIds.length }
}

export async function getActivityFeed(limit = 50) {
  const sb = supabase()
  const { data } = await sb.from('automation_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}