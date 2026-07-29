import { supabase } from '../supabase'
import { randomUUID } from 'crypto'

const INTAKE_BUCKET = 'intake'
const BLOG_PREFIX = 'blogs'
const PROCESSED_PREFIX = 'processed/blogs/'

let _bucketReady = false

async function ensureBucket() {
  if (_bucketReady) return
  const sb = supabase()
  const { data: buckets } = await sb.storage.listBuckets()
  if (!(buckets || []).some(b => b.name === INTAKE_BUCKET)) {
    const { error } = await sb.storage.createBucket(INTAKE_BUCKET, { public: false, fileSizeLimit: 25 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] })
    if (error && !/exists|duplicate/i.test(error.message || '')) throw error
  }
  _bucketReady = true
}

export async function uploadBlogImage(base64, mimeType = 'image/jpeg', fileName) {
  await ensureBucket()
  const sb = supabase()
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const clean = (fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
  const path = `${BLOG_PREFIX}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${randomUUID().slice(0, 8)}-${clean}.${ext}`
  const { error } = await sb.storage.from(INTAKE_BUCKET).upload(path, buf, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message)
  return { path, mime_type: mimeType, size: buf.length }
}

export async function listBlogFiles(limit = 500) {
  await ensureBucket()
  const sb = supabase()
  const files = []
  async function walk(walkPrefix) {
    let offset = 0
    while (true) {
      const { data, error } = await sb.storage.from(INTAKE_BUCKET).list(walkPrefix, { limit: 100, offset, sortBy: { column: 'created_at', order: 'asc' } })
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
          files.push({ path, name: item.name, size: item.metadata?.size || 0, mimetype: item.metadata?.mimetype || 'image/jpeg', created_at: item.created_at })
        }
      }
      offset += data.length
      if (data.length < 100) break
      if (files.length >= limit) break
    }
  }
  await walk(BLOG_PREFIX)
  return files
}

export async function syncBlogToQueue() {
  const sb = supabase()
  const files = await listBlogFiles()
  const { data: existing } = await sb.from('blog_queue').select('file_id')
  const known = new Set((existing || []).map(r => r.file_id))
  const { data: maxRow } = await sb.from('blog_queue').select('queue_position').order('queue_position', { ascending: false }).limit(1).maybeSingle()
  let pos = (maxRow?.queue_position || 0) + 1
  const toInsert = []
  for (const f of files) {
    if (known.has(f.path)) continue
    toInsert.push({ file_id: f.path, file_name: f.name, mime_type: f.mimetype, upload_date: f.created_at || new Date().toISOString(), queue_position: pos++, status: 'queued' })
  }
  if (toInsert.length > 0) {
    const { error } = await sb.from('blog_queue').insert(toInsert)
    if (error) throw new Error(error.message)
  }
  return { indexed: toInsert.length, total_files_in_bucket: files.length, queue_seen: known.size }
}

export async function getSignedBlogUrl(path, ttlSec = 60 * 60) {
  await ensureBucket()
  const sb = supabase()
  const { data, error } = await sb.storage.from(INTAKE_BUCKET).createSignedUrl(path, ttlSec)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function downloadBlogAsBase64(path) {
  await ensureBucket()
  const sb = supabase()
  const { data, error } = await sb.storage.from(INTAKE_BUCKET).download(path)
  if (error) throw new Error(error.message)
  const buf = Buffer.from(await data.arrayBuffer())
  return { base64: buf.toString('base64'), mime_type: data.type || 'image/jpeg', size: buf.length }
}

export async function uploadBlogImagePublic(base64, mimeType) {
  const { uploadBase64Image } = await import('../media')
  return await uploadBase64Image(base64, mimeType)
}

export async function archiveBlogFile(path) {
  await ensureBucket()
  const sb = supabase()
  const fileName = path.split('/').pop()
  const destination = `${PROCESSED_PREFIX}${fileName}`
  const { error } = await sb.storage.from(INTAKE_BUCKET).move(path, destination)
  if (error && !/not found/i.test(error.message || '')) throw new Error(error.message)
  return { archived_to: destination }
}

export async function listBlogQueue(status = null) {
  const sb = supabase()
  let q = sb.from('blog_queue').select('*').order('queue_position', { ascending: true }).limit(500)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export async function blogQueueStats() {
  const sb = supabase()
  const statuses = ['queued', 'processing', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived', 'skipped']
  const out = { total: 0 }
  for (const s of statuses) {
    const { count } = await sb.from('blog_queue').select('file_id', { count: 'exact', head: true }).eq('status', s)
    out[s] = count || 0
    out.total += out[s]
  }
  return out
}

export async function nextBlogFile() {
  const sb = supabase()
  const { data } = await sb.from('blog_queue').select('*').eq('status', 'queued').order('queue_position', { ascending: true }).limit(1).maybeSingle()
  return data || null
}

export async function setBlogStatus(fileId, status, extra = {}) {
  const sb = supabase()
  const { data, error } = await sb.from('blog_queue').update({ status, ...extra }).eq('file_id', fileId).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function publicUploadImage(base64, mimeType) {
  const sb = supabase()
  const buf = Buffer.from(base64, 'base64')
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `blog-covers/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
  const { error } = await sb.storage.from('post-media').upload(path, buf, { contentType: mimeType, upsert: false })
  if (error) throw new Error(error.message)
  const { data: pubData } = await sb.storage.from('post-media').getPublicUrl(path)
  return pubData.publicUrl
}