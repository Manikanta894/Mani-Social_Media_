import { storage } from './storage'
import { deriveSecret } from './auth'
import { runSelfHeal } from './self-heal'
import { weeklyDigest } from './self-heal'
import {
  syncIntakeToQueue,
  downloadIntakeAsBase64,
  archiveIntakeFile,
  nextQueuedFile,
  setQueueStatus,
} from './intake'
import { uploadBase64Image } from './media'
import { generateFromImage } from './ai/generate'
import { sendDraftToAdmin } from './telegram/handler'
import { sendPhoto, editMessageText, sendMessage } from './telegram/client'
import { formatAutomationJobMessage, buildAutomationJobKeyboard } from './telegram/formatter'
import { createJob, setStage, failJob, logStage } from './pipeline'

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
  kill_switch: false,
  auto_publish_confidence_threshold: null,
  approval_timeout_action: 'move_next',
  approval_reminders: true,
} 

export const automation = {
  async get() {
    let cur = await storage.appState.get('automation', {}) || {}
    let merged = { ...DEFAULT_AUTOMATION, ...cur }
    // Secret is derived — never persisted anywhere
    merged.tick_secret = deriveSecret('automation-tick')
    return merged
  },
  async _write(value) {
    await storage.appState.set('automation', value)
  },
  async patch(patch) {
    const cur = await this.get()
    const merged = { ...cur, ...patch }
    delete merged.tick_secret // derived, not stored
    await this._write(merged)
    return merged
  },
}

const TZ_OFFSETS = {
  'Asia/Kolkata': 330, 'Asia/Dubai': 240, 'Asia/Singapore': 480, 'Europe/London': 60,
  'Europe/Berlin': 120, 'America/New_York': -240, 'America/Los_Angeles': -420,
  'Australia/Sydney': 600, 'UTC': 0,
}

function currentLocalHM(tz) {
  const now = new Date()
  const offsetMin = TZ_OFFSETS[tz] ?? 0
  const local = new Date(now.getTime() + offsetMin * 60000)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const yyyymmdd = local.toISOString().slice(0, 10)
  return {
    year: local.getUTCFullYear(), month: String(local.getUTCMonth() + 1).padStart(2, '0'), day: String(local.getUTCDate()).padStart(2, '0'),
    hour: local.getUTCHours(), minute: local.getUTCMinutes(),
    weekday: days[local.getUTCDay()], yyyymmdd,
  }
}

function wdayToNumber(wd) {
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[wd] ?? 0
}

function tzOffsetString(tz) {
  const diff = TZ_OFFSETS[tz] ?? 0
  const sign = diff >= 0 ? '+' : '-'
  const abs = Math.abs(diff)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(Math.floor(abs % 60)).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

async function countSocialJobsToday(yyyymmdd, tz) {
  const start = new Date(`${yyyymmdd}T00:00:00${tzOffsetString(tz)}`).toISOString()
  const end = new Date(`${yyyymmdd}T23:59:59.999${tzOffsetString(tz)}`).toISOString()
  const rows = await storage.driveQueue.list({ folder_prefix: 'social' })
  return rows.filter(r => ['published', 'scheduled'].includes(r.status) && r.discovered_at && r.discovered_at >= start && r.discovered_at <= end).length
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
  await storage.audit.log(action, 'automation_activity', fileId, null, null, details).catch(() => {})
}

export async function runTick() {
  const settings = await automation.get()
  await automation.patch({ last_tick_at: new Date().toISOString() })

  // Skip background tasks — they keep the serverless function alive and cause timeouts

  if (settings.kill_switch) {
    await storage.audit.log('skip', 'automation', 'tick', null, 'kill_switch_active').catch(() => {})
    return { skipped: 'kill_switch_active' }
  }

  // Continuous Content Library sync (every 6h, tiny budget — never blocks the tick)
  try {
    const { maybeSyncLibrary } = await import('./content-library')
    const syncRes = await maybeSyncLibrary({ maxAgeMs: 6 * 60 * 60 * 1000, limit: 10, budgetMs: 5000 })
    if (!syncRes.skipped) storage.audit.log('sync', 'content_library', 'tick', null, 'auto-synced').catch(() => {})
  } catch (e) { console.warn('[tick] library sync failed:', e.message) }

  // Automatic News Radar scan — moved to its own scheduled job (/api/automation/news)
  // to keep the tick fast and under the Vercel 60s function limit.

  // Sync intake uploads (Telegram/images) into the queue — self-healing pipeline
  try {
    const { syncIntakeToQueue } = await import('./intake')
    const synced = await syncIntakeToQueue()
    if (synced?.indexed > 0) {
      storage.audit.log('sync', 'intake', 'tick', null, `${synced.indexed} new item(s) synced to queue`).catch(() => {})
      console.log(`[tick] intake sync added ${synced.indexed} item(s)`)
    }
    // Reset items stuck in 'processing' for 30+ minutes (killed by timeouts) back to queued
    const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const stuck = await storage.driveQueue.list({ status: 'processing' })
    for (const row of stuck) {
      if (row.updated_at && row.updated_at < staleCutoff) {
        await storage.driveQueue.update(row.id, { status: 'queued' })
      }
    }
  } catch (e) { console.warn('[tick] intake sync failed:', e.message) }

  // Approval reminders + timeout handling (runs every tick, before slot logic)
  await handleApprovalReminders(settings).catch(() => {})
  await handleApprovalTimeouts(settings).catch(() => {})

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

  // Try CSV topic queue first (topic + image pairing, no vision needed)
  const nextCsvTopic = await storage.csvTopics.nextUnused()
  if (nextCsvTopic) {
    await storage.csvTopics.update(nextCsvTopic.id, { status: 'processing' })
    try {
      // Find a paired image from the publishing queue
      const pairImage = await storage.driveQueue.nextQueued()
      let imageRef = '', imageBase64Data = '', mime = ''
      if (pairImage) {
        try {
          const { base64, mime_type } = await downloadIntakeAsBase64(pairImage.file_id)
          const pub = await uploadBase64Image(base64, mime_type)
          imageRef = pub.url; imageBase64Data = base64; mime = mime_type
          await storage.driveQueue.updateByFileId(pairImage.file_id, { status: 'processing' })
        } catch {}
      }

      const { generateFromTopic } = await import('./ai/topic-generator')
      const content = await generateFromTopic({
        topic: nextCsvTopic.topic, category: nextCsvTopic.category, industry: nextCsvTopic.industry,
        tone: nextCsvTopic.tone, audience: nextCsvTopic.audience, keywords: nextCsvTopic.keywords,
        cta: nextCsvTopic.cta, platform: nextCsvTopic.platform, language: nextCsvTopic.language,
      })

      const activeStyle = await storage.promptStyles.getActive()
      const fullContent = { ...content, image_ref: imageRef }
      const job = await createJob({
        source: 'csv_topic', topic: nextCsvTopic.topic, imageRef,
        styleId: activeStyle?.id, styleName: activeStyle?.name,
      })
      await setStage(job.id, 'content', { progress: 60, log: 'Content generated from topic' })
      await setStage(job.id, 'seo', { progress: 70, log: 'SEO optimization' })
      let seo = null
      try {
        const { buildSeoPackage } = await import('./seo-engine')
        seo = await buildSeoPackage({ title: nextCsvTopic.topic, content: content.PLATFORM_CAPTIONS?.linkedin || nextCsvTopic.topic })
      } catch {}
      let intelTags = []
      try {
        const intel = await import('./hashtag-intel')
        const ranked = await intel.getRankedHashtags({ topic: nextCsvTopic.topic, platform: 'instagram', count: 10 })
        intelTags = (ranked || []).map(r => r.tag)
      } catch {}
      const rawPosts = {
        linkedin: { caption: content.PLATFORM_CAPTIONS?.linkedin || '', hashtags: (content.HASHTAGS?.ten || intelTags).slice(0, 5) },
        instagram: { caption: content.PLATFORM_CAPTIONS?.instagram || '', hashtags: content.HASHTAGS?.ten || intelTags },
        facebook: { caption: content.PLATFORM_CAPTIONS?.facebook || '', hashtags: (content.HASHTAGS?.ten || intelTags).slice(0, 3) },
        threads: { caption: content.PLATFORM_CAPTIONS?.threads || '', hashtags: content.HASHTAGS?.niche || intelTags.slice(0, 3) },
        twitter: { caption: content.PLATFORM_CAPTIONS?.twitter || '', hashtags: (content.HASHTAGS?.niche || intelTags).slice(0, 2) },
      }
      const posts = {}
      try {
        const { improveIfBelow } = await import('./quality-engine')
        for (const p of Object.keys(rawPosts)) {
          const rp = rawPosts[p]
          if (!rp.caption) continue
          const q = await improveIfBelow({ platform: p, caption: rp.caption, hashtags: rp.hashtags || [] })
          posts[p] = { caption: q.caption, hashtags: q.hashtags || rp.hashtags || [] }
        }
      } catch { Object.assign(posts, rawPosts) }
      await setStage(job.id, 'quality', { progress: 80, log: 'Quality check complete' })
      const finalStatus = settings.approval_required ? 'pending_approval' : 'approved'
      await setStage(job.id, 'approval', { progress: 90, status: finalStatus })
      const jobPayload = { platform_posts: posts, warnings: [], status: finalStatus }
      if (seo) jobPayload.seo_package = seo
      await storage.jobs.update(job.id, jobPayload)

      await storage.csvTopics.update(nextCsvTopic.id, { status: settings.approval_required ? 'pending_approval' : 'approved', image_path: imageRef })
      if (pairImage) { await storage.driveQueue.updateByFileId(pairImage.file_id, { status: settings.approval_required ? 'pending_approval' : 'approved', content_job_id: job.id }) }
      await storage.audit.log('csv_generate', 'csv_topics', nextCsvTopic.id, 'processing', 'generated', { topic: nextCsvTopic.topic }).catch(() => {})

      // Send to Telegram
      const s = await storage.settings.get()
      if (s.telegram_bot_token && s.telegram_admin_chat_id) {
        const { sendMessage } = await import('./telegram/client')
        const { formatDraftMessage, buildJobKeyboard } = await import('./telegram/formatter')
        const msg = formatDraftMessage({ id: job.id, topic: nextCsvTopic.topic, platform_posts: { linkedin: { caption: (content.PLATFORM_CAPTIONS?.linkedin || '').slice(0, 100) }, instagram: { caption: (content.PLATFORM_CAPTIONS?.instagram || '').slice(0, 100) }, facebook: { caption: (content.PLATFORM_CAPTIONS?.facebook || '').slice(0, 100) }, threads: { caption: (content.PLATFORM_CAPTIONS?.threads || '').slice(0, 100) } }, status: 'pending_approval', style_name: activeStyle?.name })
        await sendMessage({ chatId: s.telegram_admin_chat_id, text: msg, replyMarkup: buildJobKeyboard(job) }).catch(() => {})
      }

      return { source: 'csv_topic', topic: nextCsvTopic.topic, job_id: job.id }
    } catch (e) {
      await storage.csvTopics.update(nextCsvTopic.id, { status: 'failed', error: e.message })
      return { source: 'csv_topic', error: e.message }
    }
  }

  // Fallback: image-only pipeline (photo → vision → research → content → seo → quality → approval)
  const nextFile = await storage.driveQueue.nextQueued()
  if (!nextFile) return { skipped: 'no CSV topics and no queued photos' }

  await storage.driveQueue.update(nextFile.id, { status: 'processing' })
  const activeStyle = await storage.promptStyles.getActive()
  const job = await createJob({
    source: 'ai_intake', topic: `Processing ${nextFile.file_name || 'photo'}`,
    styleId: activeStyle?.id, styleName: activeStyle?.name,
  })
  await setStage(job.id, 'image_selected', { progress: 5, log: `Selected ${nextFile.file_name}` })

  try {
    const { base64, mime_type } = await downloadIntakeAsBase64(nextFile.file_id)
    const publicUpload = await uploadBase64Image(base64, mime_type)
    await storage.jobs.update(job.id, { image_ref: publicUpload.url })
    const providers = await storage.providers.list()
    const textProvider = providers.find(p => p.active_for_text)
    if (!textProvider) {
      await failJob(job.id, 'No text provider configured', 'content')
      await storage.driveQueue.update(nextFile.id, { status: 'failed', error: 'No text provider' })
      return { processed: nextFile.file_id, error: 'no text provider', job_id: job.id }
    }

    await setStage(job.id, 'vision', { progress: 20, log: 'Analyzing image with NVIDIA vision' })
    let visionContext = ''
    try {
      visionContext = await Promise.race([
        analyzeImage(base64, mime_type, 12000),
        new Promise(res => setTimeout(() => res(null), 40000)),
      ])
      visionContext = visionContext || ''
    } catch (e) { await logStage(job.id, 'vision', 'Vision failed: ' + e.message) }
    await setStage(job.id, 'vision', { progress: 35, log: visionContext ? 'Vision complete' : 'Vision skipped (text-only)' })

    await setStage(job.id, 'research', { progress: 40, log: 'Researching context' })
    let research = ''
    try {
      const { buildResearchBrief } = await import('./research')
      research = await buildResearchBrief(visionContext || nextFile.file_name)
    } catch (e) { await logStage(job.id, 'research', 'Research skipped: ' + e.message) }
    await setStage(job.id, 'research', { progress: 45, log: research ? 'Research complete' : 'No research brief' })

    await setStage(job.id, 'content', { progress: 55, log: 'Generating platform-native content' })
    const topic = visionContext
      ? `Base ALL of your content strictly on this image: ${visionContext.slice(0, 700)}`
      : 'Visual storytelling and creative content'
    const content = await generateFullContent({
      topic: topic,
      keywords: 'social media, engagement, professional insights',
      styleId: activeStyle?.id,
      visionContext: visionContext || undefined,
    })
    if (research) content.RESEARCH_BRIEF = research
    await setStage(job.id, 'content', { progress: 70, log: 'Content generated' })

    await setStage(job.id, 'seo', { progress: 75, log: 'SEO optimization' })
    let seo = null
    try {
      const { buildSeoPackage } = await import('./seo-engine')
      seo = await buildSeoPackage({ title: topic.slice(0, 100), content: content.PLATFORM_CAPTIONS?.linkedin || topic })
    } catch (e) { await logStage(job.id, 'seo', 'SEO skipped: ' + e.message) }

    let intelTags = []
    try {
      const intel = await import('./hashtag-intel')
      const ranked = await intel.getRankedHashtags({ topic: topic.slice(0, 80), platform: 'instagram', count: 10 })
      intelTags = (ranked || []).map(r => r.tag)
    } catch {}

    await setStage(job.id, 'quality', { progress: 80, log: 'Quality check' })
    const posts = {}
    const rawPosts = {
      linkedin: { caption: content.PLATFORM_CAPTIONS?.linkedin || '', hashtags: (content.HASHTAGS?.ten || intelTags).slice(0, 5) },
      instagram: { caption: content.PLATFORM_CAPTIONS?.instagram || '', hashtags: content.HASHTAGS?.ten || intelTags },
      facebook: { caption: content.PLATFORM_CAPTIONS?.facebook || '', hashtags: (content.HASHTAGS?.ten || intelTags).slice(0, 3) },
      threads: { caption: content.PLATFORM_CAPTIONS?.threads || '', hashtags: content.HASHTAGS?.niche || intelTags.slice(0, 3) },
      twitter: { caption: content.PLATFORM_CAPTIONS?.twitter || '', hashtags: (content.HASHTAGS?.niche || intelTags).slice(0, 2) },
    }
    try {
      const { improveIfBelow } = await import('./quality-engine')
      for (const p of Object.keys(rawPosts)) {
        const rp = rawPosts[p]
        if (!rp.caption) continue
        const q = await improveIfBelow({ platform: p, caption: rp.caption, hashtags: rp.hashtags || [] })
        posts[p] = { caption: q.caption, hashtags: q.hashtags || rp.hashtags || [] }
      }
    } catch { Object.assign(posts, rawPosts) }
    await setStage(job.id, 'quality', { progress: 85, log: 'Quality check complete' })

    let finalStatus = settings.approval_required ? 'pending_approval' : 'approved'
    await setStage(job.id, 'approval', {
      progress: 90,
      log: finalStatus === 'pending_approval' ? 'Waiting for approval' : 'Approval skipped (auto-publish enabled)',
      status: finalStatus,
    })

    const jobPayload = { platform_posts: posts, warnings: [], status: finalStatus }
    if (seo) jobPayload.seo_package = seo
    await storage.jobs.update(job.id, jobPayload)
    await storage.driveQueue.update(nextFile.id, { status: finalStatus, content_job_id: job.id, platform_content: content })

    const s = await storage.settings.get()
    if (s.telegram_bot_token && s.telegram_admin_chat_id) {
      const { formatDraftMessage, buildJobKeyboard } = await import('./telegram/formatter')
      const { sendMessage: tgSend, sendPhoto: tgPhoto } = await import('./telegram/client')
      const card = formatDraftMessage({ id: job.id, topic: topic.slice(0, 120), platform_posts: { linkedin: { caption: (posts.linkedin?.caption || '').slice(0, 100) }, instagram: { caption: (posts.instagram?.caption || '').slice(0, 100) }, facebook: { caption: (posts.facebook?.caption || '').slice(0, 100) }, threads: { caption: (posts.threads?.caption || '').slice(0, 100) } }, status: finalStatus, style_name: activeStyle?.name }).slice(0, 1000)
      const kb = buildJobKeyboard(job)
      try {
        await tgPhoto({ chatId: s.telegram_admin_chat_id, photoUrl: publicUpload.url, caption: card, replyMarkup: kb })
      } catch (e) {
        console.warn('[tick] telegram photo send failed, falling back to text:', e.message)
        await tgSend({ chatId: s.telegram_admin_chat_id, text: card, replyMarkup: kb }).catch(() => {})
      }
    }

    await setStage(job.id, finalStatus === 'pending_approval' ? 'approval' : 'completed', { progress: 95 })
    return { processed: nextFile.file_id, job_id: job.id, status: finalStatus, current_stage: job.current_stage }
  } catch (e) {
    await failJob(job.id, e.message, 'content')
    await storage.driveQueue.update(nextFile.id, { status: 'failed', error: e.message })
    return { processed: nextFile.file_id, error: e.message, job_id: job.id }
  }
}

export async function onApprove(job) {
  const settings = await automation.get()
  await storage.audit.log('approve', 'content_job', job.id, job.status, 'approved').catch(() => {})
  const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === job.id))
  if (qr) {
    await storage.driveQueue.update(qr.id, { status: 'approved', approved_at: new Date().toISOString() })
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
    await storage.driveQueue.update(qr.id, {
      status: allOk ? 'published' : 'failed',
      published_platforms: publishedP,
      failed_platforms: failedP,
      published_date: allOk ? new Date().toISOString() : null,
    })
    await logActivity(allOk ? 'published' : 'failed', qr.file_id, job.id, { platforms: publishedP, failed: failedP })
    if (allOk) {
      try { await archiveIntakeFile(qr.file_id) } catch {}
    }
  }
  return r
}

export async function onSkip(job) {
  const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === job.id))
  if (qr) {
    const newPos = (await storage.driveQueue.maxPosition()) + 1
    await storage.driveQueue.update(qr.id, { status: 'queued', queue_position: newPos, content_job_id: null })
    await logActivity('skipped', qr.file_id, job.id, {})
  }
  await storage.jobs.update(job.id, { status: 'draft' })
  await storage.audit.log('skip', 'content_job', job.id, job.status, 'draft', { moved_to_slot: 'next' }).catch(() => {})
}

export async function onReject(job) {
  const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === job.id))
  if (qr) {
    await storage.driveQueue.update(qr.id, { status: 'archived', archive_date: new Date().toISOString() })
    await logActivity('archived', qr.file_id, job.id, {})
  }
  await storage.jobs.update(job.id, { status: 'rejected' })
  await storage.audit.log('reject', 'content_job', job.id, job.status, 'rejected').catch(() => {})
}

export async function onPublishNow(job) {
  const settings = await automation.get()
  const enabledPlatforms = settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads']
  const { publishJob } = await import('./publishers')
  const r = await publishJob(job, { platforms: enabledPlatforms, explicit: true })
  const qr = await storage.driveQueue.list({}).then(rows => rows.find(x => x.content_job_id === job.id))
  if (qr) {
    const publishedP = r.results.filter(x => x.ok).map(x => x.platform)
    const failedP = r.results.filter(x => !x.ok).map(x => x.platform)
    const allOk = failedP.length === 0
    await storage.driveQueue.update(qr.id, {
      status: allOk ? 'published' : 'failed',
      published_platforms: publishedP,
      failed_platforms: failedP,
      published_date: allOk ? new Date().toISOString() : null,
    })
    await logActivity(allOk ? 'published' : 'failed', qr.file_id, job.id, { platforms: publishedP, failed: failedP, triggered_by: 'publish_now' })
    if (allOk) {
      try { await archiveIntakeFile(qr.file_id) } catch {}
    }
  }
  return r
}

export async function retryFailed(fileId) {
  const row = await storage.driveQueue.getByFileId(fileId)
  if (!row) throw new Error('File not found')
  if (row.status !== 'failed') throw new Error('Only failed items can be retried')
  if (row.retry_count >= (row.max_retries || 3)) throw new Error('Max retries reached')
  await storage.driveQueue.update(row.id, {
    status: 'queued',
    retry_count: (row.retry_count || 0) + 1,
    error: null,
  })
  await logActivity('retry', fileId, row.content_job_id, { attempt: (row.retry_count || 0) + 1 })
  return { retried: true }
}

export async function bulkAction(fileIds, action) {
  const results = []
  for (const fileId of fileIds) {
    try {
      const row = await storage.driveQueue.getByFileId(fileId)
      if (!row) { results.push({ fileId, ok: false, error: 'File not found' }); continue }
      switch (action) {
        case 'archive':
          await storage.driveQueue.update(row.id, { status: 'archived', archive_date: new Date().toISOString() })
          await logActivity('archived', fileId, null, { bulk: true })
          results.push({ fileId, ok: true })
          break
        case 'skip':
          await storage.driveQueue.update(row.id, { status: 'skipped' })
          await logActivity('skipped', fileId, null, { bulk: true })
          results.push({ fileId, ok: true })
          break
        case 'retry':
          const r = await retryFailed(fileId)
          results.push({ fileId, ok: true, ...r })
          break
        case 'reset':
          await storage.driveQueue.update(row.id, { status: 'queued', error: null, retry_count: 0, published_platforms: [], failed_platforms: [] })
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
  for (let i = 0; i < fileIds.length; i++) {
    const row = await storage.driveQueue.getByFileId(fileIds[i])
    if (row) await storage.driveQueue.update(row.id, { queue_position: i + 1 })
  }
  await logActivity('reorder', null, null, {})
  return { reordered: fileIds.length }
}

export async function getActivityFeed(limit = 50) {
  const rows = await storage.audit.list(200)
  return rows.filter(r => r.entity_type === 'automation_activity').slice(0, limit)
}

// --- Approval reminders: pending items approaching their slot get Telegram nudges ---
async function handleApprovalReminders(settings) {
  if (!settings.approval_reminders) return
  const pending = await storage.driveQueue.list({ status: 'pending_approval' })
  for (const item of pending) {
    if (!item.scheduled_time) continue
    // scheduled_time stored as "HH:MM Asia/Kolkata" — parse minutes
    const m = item.scheduled_time.match(/(\d{1,2}):(\d{2})/)
    if (!m) continue
    const [h, mm] = m.slice(1, 3).map(Number)
    const slotMin = h * 60 + mm
    const nowLocal = currentLocalHM(settings.timezone)
    const nowMin = nowLocal.hour * 60 + nowLocal.minute
    const minsUntil = slotMin - nowMin
    if (minsUntil > 0 && minsUntil <= 3) {
      // Send at most one reminder per item per slot
      const reminderKey = `sf_reminded_${item.file_id}_${slotMin}`
      const rem = await storage.appState.get(reminderKey, null)
      if (!rem) {
        const s = await storage.settings.get()
        if (s.telegram_bot_token && s.telegram_admin_chat_id) {
          await sendMessage({ chatId: s.telegram_admin_chat_id, text: `⏰ <b>Approval pending</b>\n\n📁 ${item.file_name}\n🕒 Publishing at ${item.scheduled_time} (${minsUntil} min from now)\n\nApprove it in Telegram or it will ${settings.approval_timeout_action === 'auto_publish' ? 'be auto-published' : settings.approval_timeout_action === 'skip' ? 'be skipped' : 'move to the next slot'} at publish time.` }).catch(() => {})
        }
        try { await storage.appState.set(reminderKey, { sent: true }) } catch {}
      }
    }
  }
}

// --- Approval timeout: pending items past their slot → configured behavior ---
async function handleApprovalTimeouts(settings) {
  const action = settings.approval_timeout_action || 'move_next'
  const pending = await storage.driveQueue.list({ status: 'pending_approval' })
  for (const item of pending) {
    if (!item.scheduled_time) continue
    const m = item.scheduled_time.match(/(\d{1,2}):(\d{2})/)
    if (!m) continue
    const [h, mm] = m.slice(1, 3).map(Number)
    const slotMin = h * 60 + mm
    const nowLocal = currentLocalHM(settings.timezone)
    const nowMin = nowLocal.hour * 60 + nowLocal.minute
    const isPast = nowMin > slotMin + 5
    if (!isPast) continue

    if (action === 'skip') {
      await storage.driveQueue.update(item.id, { status: 'skipped' })
      await storage.audit.log('skip', 'drive_queue', item.file_id, 'pending_approval', 'skipped', { reason: 'approval_timeout' }).catch(() => {})
    } else if (action === 'auto_publish') {
      await storage.driveQueue.update(item.id, { status: 'approved', approved_at: new Date().toISOString() })
      await storage.audit.log('approve', 'drive_queue', item.file_id, 'pending_approval', 'approved', { reason: 'approval_timeout' }).catch(() => {})
      if (item.content_job_id) {
        try {
          const job = await storage.jobs.get(item.content_job_id)
          if (job) {
            await storage.jobs.update(job.id, { status: 'approved' })
            const { publishJob } = await import('./publishers')
            await publishJob(job, { platforms: settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads'] })
          }
        } catch {}
      }
    } else { // move_next — return to queue tail
      const newPos = (await storage.driveQueue.maxPosition()) + 1
      await storage.driveQueue.update(item.id, { status: 'queued', queue_position: newPos, scheduled_time: null, content_job_id: null })
      await storage.audit.log('reschedule', 'drive_queue', item.file_id, 'pending_approval', 'queued', { reason: 'approval_timeout' }).catch(() => {})
    }
  }
}
