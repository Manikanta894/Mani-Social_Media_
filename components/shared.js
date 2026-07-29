'use client'

import { Sparkles, PlugZap, X, Settings as SettingsIcon } from 'lucide-react'

export const PLATFORMS = [
  { key: 'linkedin',  label: 'LinkedIn',  limit: 3000, letter: 'in' },
  { key: 'instagram', label: 'Instagram', limit: 2200, letter: 'ig' },
  { key: 'facebook',  label: 'Facebook',  limit: 5000, letter: 'fb' },
  { key: 'threads',   label: 'Threads',   limit: 500,  letter: '@' },
  { key: 'twitter',   label: 'X',         limit: 280,  letter: 'X' },
]

export const PROVIDER_TYPES = [
  { value: 'gemini',    label: 'Google Gemini',           defaultModel: 'gemini-2.5-flash',            supportsVision: true  },
  { value: 'openai',    label: 'OpenAI',                  defaultModel: 'gpt-4o',                      supportsVision: true  },
  { value: 'anthropic', label: 'Anthropic Claude',        defaultModel: 'claude-sonnet-4-5-20250929',  supportsVision: true  },
  { value: 'groq',      label: 'Groq (OpenAI-compat.)',   defaultModel: 'llama-3.3-70b-versatile',     supportsVision: false },
  { value: 'custom',    label: 'Custom (OpenAI-compat.)', defaultModel: '',                            supportsVision: true  },
]

export async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  })
  const j = await res.json().catch(() => ({ ok: false, error: 'Bad JSON' }))
  if (!j.ok) throw new Error(j.error || 'API error')
  return j.data
}

export function resizeImageToBase64(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      const scale = Math.min(1, maxDim / Math.max(width, height))
      width = Math.round(width * scale)
      height = Math.round(height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Failed to encode image')); return }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          const base64 = String(dataUrl).split(',')[1]
          resolve({ base64, mimeType: 'image/jpeg', previewUrl: URL.createObjectURL(blob), width, height })
          URL.revokeObjectURL(objUrl)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = objUrl
  })
}

export function StatusStamp({ status, className = '' }) {
  const map = {
    draft:            { label: 'DRAFT', cls: 'status-stamp--draft' },
    pending_approval: { label: 'PENDING', cls: 'status-stamp--pending' },
    approved:         { label: 'APPROVED', cls: 'status-stamp--approved' },
    scheduled:        { label: 'SCHEDULED', cls: 'status-stamp--approved' },
    published:        { label: 'LIVE', cls: 'status-stamp--live' },
    live:             { label: 'LIVE', cls: 'status-stamp--live' },
    rejected:         { label: 'REJECTED', cls: 'status-stamp--failed' },
    failed:           { label: 'FAILED', cls: 'status-stamp--failed' },
    queued:           { label: 'QUEUED', cls: 'status-stamp--draft' },
    processing:       { label: 'PROCESSING', cls: 'status-stamp--pending' },
    archived:         { label: 'ARCHIVED', cls: 'status-stamp--draft' },
    new:              { label: 'NEW', cls: 'status-stamp--pending' },
    ai_generated:     { label: 'AI READY', cls: 'status-stamp--approved' },
    replied:          { label: 'REPLIED', cls: 'status-stamp--approved' },
    ignored:          { label: 'IGNORED', cls: 'status-stamp--draft' },
    pending:          { label: 'PENDING', cls: 'status-stamp--pending' },
  }
  const m = map[status] || { label: status, cls: 'status-stamp--draft' }
  return (
    <span className={`status-stamp stamp-animate ${m.cls} ${className}`}>
      {m.label}
    </span>
  )
}

export function RunningOrderRow({ index, children, className = '' }) {
  return (
    <div className={`running-order-row row-enter ${className}`} style={{ animationDelay: `${index * 40}ms` }}>
      <span className="running-order-number">{index + 1}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function PlatformEyebrow({ platform }) {
  const p = PLATFORMS.find(x => x.key === platform)
  if (!p) return <span className="editorial-eyebrow">{platform}</span>
  return <span className="editorial-eyebrow">{p.label}</span>
}
