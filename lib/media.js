// Google Drive-backed media helpers — replaces Supabase Storage.
// Images are uploaded to the Drive media folder and served via /api/media/:id.

import { mediaStore, publicUrl } from './media-store'
import { randomUUID } from 'crypto'

export async function uploadBase64Image(base64, mimeType = 'image/jpeg', folderId = null) {
  if (!base64) throw new Error('No image data')
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const name = `${new Date().toISOString().slice(0, 10)}_${randomUUID().slice(0, 8)}.${ext}`
  const up = await mediaStore.upload(name, mimeType, buf, folderId)
  return { url: up.url, file_id: up.fileId, path: up.fileId, mime_type: mimeType, size: buf.length }
}
