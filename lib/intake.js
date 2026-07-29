// Supabase Storage intake: bulk photos live in bucket 'intake', archived to 'intake/processed/'.
// One-time sync writes each file into drive_queue with a stable file_id (= storage path).
// Automation picks the next 'queued' row, downloads, uploads to post-media (public), and hands to AI.

import { supabase } from './supabase'
import { randomUUID } from 'crypto'

const INTAKE_BUCKET = 'intake'
const SOCIAL_PREFIX = 'social'
const PROCESSED_PREFIX = 'processed/social/'
let _bucketReady = false

async function ensureBucket() {
  if (_bucketReady) return
  const sb = supabase()
  const { data: buckets } = await sb.storage.listBuckets()
  if (!(buckets || []).some(b => b.name === INTAKE_BUCKET)) {
    const { error } = await sb.storage.createBucket(INTAKE_BUCKET, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (error && !/exists|duplicate/i.test(error.message || '')) throw error
  }
  _bucketReady = true
}

export async function uploadIntakeImage(base64, mimeType = 'image/jpeg', fileName) {
  await ensureBucket()
  const sb = supabase()
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const clean = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  const path = `${SOCIAL_PREFIX}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID().slice(0, 8)}-${clean}.${ext}`
  const { error } = await sb.storage.from(INTAKE_BUCKET).upload(path, buf, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message)
  return { path, mime_type: mimeType, size: buf.length }
}

export async function listIntakeFiles(limit = 500, prefix = SOCIAL_PREFIX) {
  await ensureBucket()
  const sb = supabase()
  const files = []
  async function walk(walkPrefix) {
    let offset = 0
    while (true) {
      const { data, error } = await sb.storage.from(INTAKE_BUCKET).list(walkPrefix, {
        limit: 100,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      })
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      for (const item of data) {
        if (item.id === null) {
          const nextPrefix = walkPrefix ? `${walkPrefix}/${item.name}` : item.name
          if (nextPrefix.startsWith('processed')) continue
          await walk(nextPrefix)
        } else {
          const path = walkPrefix ? `${walkPrefix}/${item.name}` : item.name
          if (path.startsWith('processed')) continue
          files.push({
            path,
            name: item.name,
            size: item.metadata?.size || 0,
            mimetype: item.metadata?.mimetype || 'image/jpeg',
            created_at: item.created_at,
          })
        }
      }
      offset += data.length
      if (data.length < 100) break
      if (files.length >= limit) break
    }
  }
  await walk(prefix)
  return files
}

export async function syncIntakeToQueue() {
  const sb = supabase()
  const files = await listIntakeFiles()
  // Existing file_ids in queue
  const { data: existing } = await sb.from('drive_queue').select('file_id')
  const known = new Set((existing || []).map(r => r.file_id))
  // Find current max queue_position
  const { data: maxRow } = await sb.from('drive_queue').select('queue_position').order('queue_position', { ascending: false }).limit(1).maybeSingle()
  let pos = (maxRow?.queue_position || 0) + 1

  const toInsert = []
  for (const f of files) {
    if (known.has(f.path)) continue
    toInsert.push({
      file_id: f.path,
      file_name: f.name,
      drive_folder: INTAKE_BUCKET,
      mime_type: f.mimetype,
      file_type: 'image',
      upload_date: f.created_at || new Date().toISOString(),
      queue_position: pos++,
      status: 'queued',
    })
  }
  if (toInsert.length > 0) {
    const { error } = await sb.from('drive_queue').insert(toInsert)
    if (error) throw new Error(error.message)
  }
  return { indexed: toInsert.length, total_files_in_bucket: files.length, queue_seen: known.size }
}

export async function getSignedIntakeUrl(path, ttlSec = 60 * 60) {
  await ensureBucket()
  const sb = supabase()
  const { data, error } = await sb.storage.from(INTAKE_BUCKET).createSignedUrl(path, ttlSec)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function downloadIntakeAsBase64(path) {
  await ensureBucket()
  const sb = supabase()
  const { data, error } = await sb.storage.from(INTAKE_BUCKET).download(path)
  if (error) throw new Error(error.message)
  const buf = Buffer.from(await data.arrayBuffer())
  return { base64: buf.toString('base64'), mime_type: data.type || 'image/jpeg', size: buf.length }
}

// Queue query helpers (reads drive_queue table — renamed from the original Drive concept)
export async function listQueue(status = null) {
  const sb = supabase()
  let q = sb.from('drive_queue').select('*').order('queue_position', { ascending: true }).limit(500)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function queueStats() {
  const sb = supabase()
  const statuses = ['queued', 'processing', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived', 'skipped']
  const out = { total: 0 }
  for (const s of statuses) {
    const { count } = await sb.from('drive_queue').select('file_id', { count: 'exact', head: true }).eq('status', s)
    out[s] = count || 0
    out.total += out[s]
  }
  return out
}

export async function nextQueuedFile() {
  const sb = supabase()
  const { data } = await sb.from('drive_queue').select('*').eq('status', 'queued').order('queue_position', { ascending: true }).limit(1).maybeSingle()
  return data || null
}

export async function setQueueStatus(fileId, status, extra = {}) {
  const sb = supabase()
  const { data, error } = await sb.from('drive_queue').update({ status, ...extra }).eq('file_id', fileId).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function archiveIntakeFile(path) {
  await ensureBucket()
  const sb = supabase()
  const fileName = path.split('/').pop()
  const destination = `${PROCESSED_PREFIX}${fileName}`
  const { error } = await sb.storage.from(INTAKE_BUCKET).move(path, destination)
  if (error && !/not found/i.test(error.message || '')) throw new Error(error.message)
  return { archived_to: destination }
}
