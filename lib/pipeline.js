import { storage } from './storage'

export const STAGES = [
  'created',
  'image_selected',
  'vision',
  'research',
  'content',
  'seo',
  'quality',
  'approval',
  'publishing',
  'published',
  'analytics',
  'completed',
]

export const STAGE_STATUS = {
  created: 'created',
  image_selected: 'processing',
  vision: 'processing',
  research: 'processing',
  content: 'processing',
  seo: 'processing',
  quality: 'processing',
  approval: 'pending_approval',
  publishing: 'publishing',
  published: 'published',
  analytics: 'published',
  completed: 'completed',
}

export function stageIndex(stage) {
  return STAGES.indexOf(stage)
}

function parseList(raw, fallback) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : fallback } catch { return fallback }
  }
  return fallback
}

export async function createJob({ source, topic, imageRef = null, styleId = null, styleName = null, meta = {} }) {
  const now = new Date().toISOString()
  const job = await storage.jobs.create({
    source: source || 'pipeline',
    topic: topic || 'Untitled job',
    image_ref: imageRef,
    style_id: styleId,
    style_name: styleName,
    status: 'created',
    current_stage: 'created',
    stage_progress: 0,
    started_at: now,
    finished_at: null,
    retry_count: 0,
    stage_logs: JSON.stringify([{ stage: 'created', at: now, note: 'Job created' }]),
    errors: JSON.stringify([]),
    ...meta,
  })
  return job
}

export async function getJob(jobId) {
  const job = await storage.jobs.get(jobId)
  if (job) {
    job.stage_logs = parseList(job.stage_logs, [])
    job.errors = parseList(job.errors, [])
  }
  return job
}

export async function setStage(jobId, stage, { progress, log, error, status } = {}) {
  const job = await storage.jobs.get(jobId)
  if (!job) return null
  const now = new Date().toISOString()
  const logs = parseList(job.stage_logs, [])
  logs.push({ stage, at: now, note: log || null, error: error || null })
  const errors = parseList(job.errors, [])
  if (error) errors.push({ stage, at: now, error })
  const patch = {
    current_stage: stage,
    stage_progress: progress != null ? progress : 0,
    stage_logs: JSON.stringify(logs.slice(-100)),
    errors: JSON.stringify(errors.slice(-50)),
  }
  if (status) patch.status = status
  else if (STAGE_STATUS[stage]) patch.status = STAGE_STATUS[stage]
  if (stage === 'completed' || stage === 'published' || stage === 'failed') patch.finished_at = now
  const updated = await storage.jobs.update(jobId, patch)
  return { ...job, ...updated, stage_logs: logs, errors }
}

export async function failJob(jobId, error, stage = null) {
  const job = await storage.jobs.get(jobId)
  if (!job) return null
  return await setStage(jobId, stage || job.current_stage || 'failed', {
    error: String(error || 'Unknown error'),
    status: 'failed',
  })
}

export async function logStage(jobId, stage, note) {
  return await setStage(jobId, stage, { log: note })
}

export async function retryJob(jobId) {
  const job = await storage.jobs.get(jobId)
  if (!job) return null
  const retryCount = (job.retry_count || 0) + 1
  return await storage.jobs.update(jobId, {
    retry_count: retryCount,
    status: 'retrying',
    errors: JSON.stringify(parseList(job.errors, [])),
  })
}
