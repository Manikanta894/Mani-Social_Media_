import { supabase } from './supabase'
import { storage } from './storage'
import { randomUUID } from 'crypto'
import { runSelfHeal } from './self-heal'
import { weeklyDigest } from './self-heal'
import {
  syncIntakeToQueue,
  downloadIntakeAsBase64,
  archiveIntakeFile,
} from './intake'
import { uploadBase64Image } from './media'
import { generateFromImage } from './ai/generate'
import { sendDraftToAdmin } from './telegram/handler'

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

async function countIntakeJobsToday(yyyymmdd, tz) {
  const sb = supabase()
  const start = new Date(`${yyyymmdd}T00:00:00${tzOffsetString(tz)}`).toISOString()
  const end = new Date(`${yyyymmdd}T23:59:59.999${tzOffsetString(tz)}`).toISOString()
  const { count } = await sb.from('content_jobs').select('id', { count: 'exact', head: true }).eq('source', 'ai_intake').gte('created_at', start).lte('created_at', end)
  return count || 0
}

function findDueSlotIndex(times, hour, minute, bufferMin = 5) {
  const nowMin = hour * 60 + minute
  let bestIdx = -1
  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(':').map(Number)
    const slotMin = h * 60 + m
    if (nowMin >= slotMin - bufferMin && bestIdx === -1) bestIdx = i
  }
  return bestIdx
}

export async function runTick() {
  const settings = await automation.get()
  await automation.patch({ last_tick_at: new Date().toISOString() })

  // Self-healing checks (fire-and-forget, don't block tick)
  runSelfHeal().catch(() => {})

  // Seasonal Intelligence detection (runs every tick)
  import('./seasonal-engine').then(m => m.detectUpcomingEvents()).catch(() => {})

  // Weekly digest — every 7 days
  const { data: lastDigest } = await supabase().from('app_settings').select('value').eq('key', 'last_weekly_digest').maybeSingle()
  const lastDigestAt = lastDigest?.value?.at ? new Date(lastDigest.value.at) : new Date(0)
  if (Date.now() - lastDigestAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    weeklyDigest().catch(() => {})
    await supabase().from('app_settings').upsert({ key: 'last_weekly_digest', value: { at: new Date().toISOString() } }, { onConflict: 'key' }).catch(() => {})
  }

  if (!settings.enabled) return { skipped: 'automation disabled' }

  const now = currentLocalHM(settings.timezone)
  const wd = wdayToNumber(now.weekday)
  if (!(settings.working_days || []).includes(wd)) return { skipped: `not a working day (${now.weekday})` }

  const times = settings.posting_times || []
  const dueIdx = findDueSlotIndex(times, now.hour, now.minute, 5)
  if (dueIdx === -1) return { skipped: `no slots in buffer window (now ${now.hour}:${now.minute})` }

  const created = await countIntakeJobsToday(now.yyyymmdd, settings.timezone)
  if (created >= (settings.posts_per_day || 5)) return { skipped: `daily cap reached (${created}/${settings.posts_per_day})` }

  if (created >= dueIdx + 1) return { skipped: `slot ${dueIdx + 1} already processed (${created} of ${dueIdx + 1})` }

  const sb = supabase()
  const { data: nextFile } = await sb.from('drive_queue').select('*').eq('status', 'queued').order('queue_position', { ascending: true }).limit(1).maybeSingle()

  if (!nextFile) return { skipped: 'no queued files' }

  await sb.from('drive_queue').update({ status: 'processing' }).eq('file_id', nextFile.file_id)
  await storage.audit.log('process', 'drive_queue', nextFile.file_id, 'queued', 'processing')

  try {
    const { base64, mime_type } = await downloadIntakeAsBase64(nextFile.file_id)
    const publicUpload = await uploadBase64Image(base64, mime_type)

    const activeStyle = await storage.promptStyles.getActive()

    // Create job first so we can pass jobId for version history
    const job = await storage.jobs.create({
      source: 'ai_intake',
      topic: nextFile.file_name,
      image_ref: publicUpload.url,
      style_id: activeStyle?.id,
      style_name: activeStyle?.name,
      status: 'draft',
    })

    const result = await generateFromImage({
      imageBase64: base64,
      mimeType: mime_type,
      context: `Auto-processed from intake bucket. File: ${nextFile.file_name}`,
      styleId: activeStyle?.id,
      jobId: job.id,
    })

    const updatedJob = await storage.jobs.update(job.id, {
      research_context: result.research_context,
      platform_posts: result.posts,
      warnings: result.warnings,
      status: settings.approval_required ? 'pending_approval' : 'approved',
    })

    await sb.from('drive_queue').update({ status: 'pending_approval', content_job_id: job.id }).eq('file_id', nextFile.file_id)
    await storage.audit.log('generate', 'content_job', job.id, 'draft', settings.approval_required ? 'pending_approval' : 'approved', { providers: result.providers_used })

    try {
      await sendDraftToAdmin(updatedJob)
    } catch (e) {
      console.warn('[tick] telegram send failed:', e.message)
    }

    if (!settings.approval_required && settings.auto_publish_after_approve) {
      const { publishJob } = await import('./publishers')
      try {
        const r = await publishJob(updatedJob)
        await storage.audit.log('publish', 'content_job', job.id, 'approved', 'published', { results: r.results })
        await sb.from('drive_queue').update({ status: 'published' }).eq('file_id', nextFile.file_id)
        try { await archiveIntakeFile(nextFile.file_id) } catch (_) {}
        await sb.from('drive_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', nextFile.file_id)
      } catch (e) {
        await sb.from('drive_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
        await storage.audit.log('fail', 'content_job', job.id, 'approved', 'failed', { error: e.message })
      }
    }

    return { processed: nextFile.file_id, job_id: job.id, slot: dueIdx + 1, of_expected: created + 1 }
  } catch (e) {
    await sb.from('drive_queue').update({ status: 'failed', error: e.message }).eq('file_id', nextFile.file_id)
    await storage.audit.log('fail', 'drive_queue', nextFile.file_id, 'processing', 'failed', { error: e.message })
    return { processed: nextFile.file_id, error: e.message }
  }
}

export async function onApprove(job) {
  const settings = await automation.get()
  await storage.audit.log('approve', 'content_job', job.id, job.status, 'approved')

  if (!settings.auto_publish_after_approve) return { skipped: 'auto_publish_after_approve is off' }
  const { publishJob } = await import('./publishers')
  const r = await publishJob(job)
  const sb = supabase()

  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    if (r.status === 'published') {
      await storage.audit.log('publish', 'drive_queue', qr.file_id, 'pending_approval', 'published')
      try { await archiveIntakeFile(qr.file_id) } catch (_) {}
      await sb.from('drive_queue').update({ status: 'archived', archive_date: new Date().toISOString() }).eq('file_id', qr.file_id)
    } else {
      await sb.from('drive_queue').update({ status: 'failed' }).eq('file_id', qr.file_id)
    }
  }
  return r
}

export async function onSkip(job) {
  const sb = supabase()
  const { data: qr } = await sb.from('drive_queue').select('*').eq('content_job_id', job.id).maybeSingle()
  if (qr) {
    const maxPos = await sb.from('drive_queue').select('queue_position').order('queue_position', { ascending: false }).limit(1).maybeSingle()
    const newPos = (maxPos?.data?.queue_position || 0) + 1
    await sb.from('drive_queue').update({ status: 'queued', queue_position: newPos, content_job_id: null }).eq('file_id', qr.file_id)
  }
  await storage.jobs.update(job.id, { status: 'draft' })
  await storage.audit.log('skip', 'content_job', job.id, job.status, 'draft', { moved_to_slot: 'next' })
}
