// Google Drive intake: bulk photos live in the Drive intake folder
// (env GOOGLE_DRIVE_INTAKE_FOLDER_ID). Each file becomes a drive_queue row
// (sheet 'Publishing Queue') with file_id = the Drive file id. Automation
// picks the next 'queued' row, downloads, uploads to the Drive media folder
// (public URL via /api/media/:id), and hands to AI.

import { randomUUID } from 'crypto'
import { storage } from './storage'
import { mediaStore, publicUrl } from './media-store'

export async function uploadIntakeImage(base64, mimeType = 'image/jpeg', fileName) {
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const clean = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  const name = `${new Date().toISOString().slice(0, 10)}_${Date.now()}-${randomUUID().slice(0, 8)}-${clean}.${ext}`
  const up = await mediaStore.upload(name, mimeType, buf, process.env.GOOGLE_DRIVE_INTAKE_FOLDER_ID)
  return { path: up.fileId, file_id: up.fileId, mime_type: mimeType, size: buf.length, url: publicUrl(up.fileId) }
}

export async function listIntakeFiles(limit = 500) {
  const files = await mediaStore.list(process.env.GOOGLE_DRIVE_INTAKE_FOLDER_ID)
  return files.map(f => ({
    file_id: f.id,
    path: f.id,
    name: f.name,
    size: Number(f.size || 0),
    mimetype: f.mimeType || 'image/jpeg',
    created_at: f.createdTime || new Date().toISOString(),
  })).slice(0, limit)
}

export async function syncIntakeToQueue() {
  const files = await listIntakeFiles()
  // Existing file_ids in queue
  const existing = await storage.driveQueue.list({})
  const known = new Set(existing.map(r => r.file_id))
  let pos = (await storage.driveQueue.maxPosition()) + 1

  let indexed = 0
  for (const f of files) {
    if (known.has(f.file_id)) continue
    await storage.driveQueue.create({
      file_id: f.file_id,
      file_name: f.name,
      folder_prefix: 'social',
      mime_type: f.mimetype,
      file_type: 'image',
      upload_date: f.created_at,
      queue_position: pos++,
      status: 'queued',
    })
    indexed++
  }
  return { indexed, total_files_in_bucket: files.length, queue_seen: known.size }
}

export async function getSignedIntakeUrl(fileId, ttlSec = 60 * 60) {
  // Drive files are served through our public proxy — no signed URL needed
  return publicUrl(fileId)
}

export async function downloadIntakeAsBase64(fileId) {
  // Retry up to 3x — Drive downloads occasionally fail with "fetch failed"
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buf = await mediaStore.download(fileId)
      const meta = await mediaStore.metadata(fileId).catch(() => ({}))
      return { base64: buf.toString('base64'), mime_type: meta.mimeType || 'image/jpeg', size: buf.length }
    } catch (e) {
      lastErr = e
      console.warn(`[intake] download attempt ${attempt}/3 failed for ${fileId}:`, e.message)
      if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt))
    }
  }
  throw lastErr || new Error(`Download failed for ${fileId}`)
}

// Queue query helpers (reads the 'Publishing Queue' sheet)
export async function listQueue(status = null) {
  return await storage.driveQueue.list({ status })
}

export async function queueStats() {
  const statuses = ['queued', 'processing', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived', 'skipped']
  const rows = await storage.driveQueue.list({})
  const out = { total: rows.length }
  for (const s of statuses) {
    out[s] = rows.filter(r => r.status === s).length
  }
  return out
}

export async function nextQueuedFile() {
  return await storage.driveQueue.nextQueued()
}

export async function setQueueStatus(fileId, status, extra = {}) {
  return await storage.driveQueue.updateByFileId(fileId, { status, ...extra })
}

export async function archiveIntakeFile(fileId) {
  // TRUE MOVE: transfer the Drive file into the Archive folder (no copy).
  // The file is moved ONLY after successful publishing (caller's job).
  const folder = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID
  if (folder) {
    try {
      await mediaStore.move(fileId, folder)
      await storage.driveQueue.updateByFileId(fileId, { status: 'archived', archive_date: new Date().toISOString() })
      await storage.imageLibrary.markArchived(fileId).catch(() => {})
      return { archived_to: folder }
    } catch (e) {
      console.warn('[intake] archive move failed, marking row archived:', e.message)
    }
  }
  // If no folder configured (or move failed), just mark the queue row archived
  await storage.driveQueue.updateByFileId(fileId, { status: 'archived', archive_date: new Date().toISOString() })
  await storage.imageLibrary.markArchived(fileId).catch(() => {})
  return { archived_to: null }
}
