// ============================================================================
// Media store — Google Drive (same service account as Sheets).
// Replaces Supabase Storage entirely. Public URLs are served through our own
// /api/media/:fileId proxy so Telegram/IG/FB/Threads always get fetchable URLs.
// ============================================================================

import { driveList, driveUpload, driveDownload, driveDelete, driveMetadata } from './gsheets'

export const mediaStore = {
  async list(folderId) {
    const folder = folderId || process.env.GOOGLE_DRIVE_INTAKE_FOLDER_ID
    if (!folder) return []
    return await driveList(folder)
  },

  async upload(name, mimeType, bytes, folderId) {
    const folder = folderId || process.env.GOOGLE_DRIVE_MEDIA_FOLDER_ID || null
    const file = await driveUpload(name, mimeType, bytes, folder)
    return { fileId: file.id, name: file.name, mimeType, url: publicUrl(file.id), size: bytes.length }
  },

  async download(fileId) {
    return await driveDownload(fileId)
  },

  async metadata(fileId) {
    return await driveMetadata(fileId)
  },

  async remove(fileId) {
    await driveDelete(fileId)
  },
}

export function publicUrl(fileId) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000'}`
  return `${base}/api/media/${fileId}`
}
