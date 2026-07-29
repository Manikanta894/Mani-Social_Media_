// Supabase Storage helpers — public bucket for post media.

import { supabase } from './supabase'
import { randomUUID } from 'crypto'

const BUCKET = 'post-media'
let _bucketReady = false

async function ensureBucket() {
  if (_bucketReady) return
  const sb = supabase()
  const { data: buckets } = await sb.storage.listBuckets()
  const exists = (buckets || []).some(b => b.name === BUCKET)
  if (!exists) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (error && !/(exists|duplicate)/i.test(error.message || '')) throw error
  }
  _bucketReady = true
}

export async function uploadBase64Image(base64, mimeType = 'image/jpeg') {
  if (!base64) throw new Error('No image data')
  await ensureBucket()
  const sb = supabase()
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: mimeType,
    upsert: false,
  })
  if (error) throw error
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, path, mime_type: mimeType, size: buf.length }
}
