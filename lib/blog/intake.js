// Blog intake via Google Drive (blogs subfolder / configured folder).
// Replaces the Supabase Storage 'blogs' prefix pipeline.

import { randomUUID } from 'crypto'
import { storage } from '../storage'
import { mediaStore, publicUrl } from '../media-store'
import { uploadBase64Image } from '../media'

const BLOG_FOLDER = () => process.env.GOOGLE_DRIVE_BLOG_FOLDER_ID

export async function uploadBlogImage(base64, mimeType = 'image/jpeg', fileName) {
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const clean = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  const name = `${new Date().toISOString().slice(0, 10)}_${Date.now()}-${randomUUID().slice(0, 8)}-${clean}.${ext}`
  const up = await mediaStore.upload(name, mimeType, buf, BLOG_FOLDER())
  return { path: up.fileId, file_id: up.fileId, mime_type: mimeType, size: buf.length, url: publicUrl(up.fileId) }
}

export async function listBlogFiles(limit = 500) {
  const files = await mediaStore.list(BLOG_FOLDER())
  return files.map(f => ({
    file_id: f.id, path: f.id, name: f.name,
    size: Number(f.size || 0), mimetype: f.mimeType || 'image/jpeg',
    created_at: f.createdTime || new Date().toISOString(),
  })).slice(0, limit)
}

export async function syncBlogToQueue() {
  const files = await listBlogFiles()
  const existing = await storage.blogQueue.list()
  const known = new Set(existing.map(r => r.file_id))
  let indexed = 0
  for (const f of files) {
    if (known.has(f.file_id)) continue
    await storage.blogQueue.create({ file_id: f.file_id, file_name: f.name, mime_type: f.mimetype, upload_date: f.created_at || new Date().toISOString(), status: 'queued' })
    indexed++
  }
  return { indexed, total_files_in_bucket: files.length, queue_seen: known.size }
}

export async function getSignedBlogUrl(fileId, ttlSec = 60 * 60) {
  return publicUrl(fileId)
}

export async function downloadBlogAsBase64(fileId) {
  let lastErr = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buf = await mediaStore.download(fileId)
      const meta = await mediaStore.metadata(fileId).catch(() => ({}))
      return { base64: buf.toString('base64'), mime_type: meta.mimeType || 'image/jpeg', size: buf.length }
    } catch (e) {
      lastErr = e
      console.warn(`[blog] download attempt ${attempt}/3 failed for ${fileId}:`, e.message)
      if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt))
    }
  }
  throw lastErr || new Error(`Download failed for ${fileId}`)
}

export async function uploadBlogImagePublic(base64, mimeType) {
  return await uploadBase64Image(base64, mimeType)
}

export async function archiveBlogFile(fileId) {
  // TRUE MOVE into the dedicated Blog Archive folder (never the social archive).
  const folder = process.env.GOOGLE_DRIVE_BLOG_ARCHIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID
  if (folder) {
    try {
      await mediaStore.move(fileId, folder)
      const row = await storage.blogQueue.getByFileId(fileId)
      if (row) await storage.blogQueue.update(row.id, { status: 'archived', archive_date: new Date().toISOString() })
      await storage.imageLibrary.markArchived(fileId).catch(() => {})
      return { archived_to: folder }
    } catch (e) {
      console.warn('[blog] archive move failed, marking row archived:', e.message)
    }
  }
  const row = await storage.blogQueue.getByFileId(fileId)
  if (row) await storage.blogQueue.update(row.id, { status: 'archived', archive_date: new Date().toISOString() })
  await storage.imageLibrary.markArchived(fileId).catch(() => {})
  return { archived_to: null }
}

export async function listBlogQueue(status = null) {
  return await storage.blogQueue.list(status)
}

export async function blogQueueStats() {
  const statuses = ['queued', 'processing', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived', 'skipped']
  const rows = await storage.blogQueue.list()
  const out = { total: rows.length }
  for (const s of statuses) out[s] = rows.filter(r => r.status === s).length
  return out
}

export async function nextBlogFile() {
  // FIFO ONLY: oldest eligible blog image (status 'queued' only).
  const rows = await storage.blogQueue.list('queued')
  if (!rows.length) return null
  return rows.sort((a, b) =>
    (Number(a.queue_position) || 0) - (Number(b.queue_position) || 0) ||
    String(a.discovered_at || a.upload_date || '').localeCompare(String(b.discovered_at || b.upload_date || ''))
  )[0] || null
}

export async function setBlogStatus(fileId, status, extra = {}) {
  const row = await storage.blogQueue.getByFileId(fileId)
  if (!row) throw new Error('Blog queue item not found')
  return await storage.blogQueue.update(row.id, { status, ...extra })
}

export async function publicUploadImage(base64, mimeType) {
  const up = await uploadBase64Image(base64, mimeType)
  return up.url
}
