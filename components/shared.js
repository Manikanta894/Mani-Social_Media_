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
  { value: 'nvidia-llama', label: 'NVIDIA Llama 3.2 90B Vision', defaultModel: 'nvidia/llama-3.2-90b-vision', supportsVision: true  },
  { value: 'nvidia-nemotron', label: 'NVIDIA Nemotron 3 Nano',    defaultModel: 'nvidia/nemotron-3-nano-omni', supportsVision: true  },
  { value: 'nvidia-kimi', label: 'NVIDIA Kimi K2.6',             defaultModel: 'nvidia/kimi-k2-6',            supportsVision: true  },
  { value: 'openrouter', label: 'OpenRouter',              defaultModel: 'openai/gpt-4o',               supportsVision: true  },
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

export function StatusPill({ status, className = '', pulse = false }) {
  const map = {
    draft:            { label: 'Draft', cls: 'studio-pill--draft' },
    pending_approval: { label: 'Pending', cls: 'studio-pill--pending' },
    approved:         { label: 'Approved', cls: 'studio-pill--live' },
    scheduled:        { label: 'Scheduled', cls: 'studio-pill--live' },
    published:        { label: 'Published', cls: 'studio-pill--published' },
    live:             { label: 'Live', cls: 'studio-pill--live' },
    rejected:         { label: 'Rejected', cls: 'studio-pill--rejected' },
    failed:           { label: 'Failed', cls: 'studio-pill--failed' },
    queued:           { label: 'Queued', cls: 'studio-pill--draft' },
    processing:       { label: 'Processing', cls: 'studio-pill--pending' },
    archived:         { label: 'Archived', cls: 'studio-pill--archived' },
    new:              { label: 'New', cls: 'studio-pill--pending' },
    ai_generated:     { label: 'AI Ready', cls: 'studio-pill--live' },
    replied:          { label: 'Replied', cls: 'studio-pill--published' },
    ignored:          { label: 'Ignored', cls: 'studio-pill--draft' },
    pending:          { label: 'Pending', cls: 'studio-pill--pending' },
  }
  const m = map[status] || { label: status, cls: 'studio-pill--draft' }
  return <span className={`studio-pill ${m.cls} ${pulse ? 'studio-card--pulse' : ''} ${className}`}>{m.label}</span>
}

// Keep old export name for backward compatibility
export const StatusStamp = StatusPill

export function StudioCard({ children, active = false, pulse = false, style = {}, className = '' }) {
  const cls = `studio-card ${active ? 'studio-card--active' : ''} ${pulse ? 'studio-card--pulse' : ''} ${className}`
  return <div className={cls} style={style}>{children}</div>
}

// Card-based board row — replaces RunningOrderRow
export function BoardRow({ index, children, active = false, pulse = false, className = '' }) {
  return (
    <StudioCard active={active} pulse={pulse} style={{ animationDelay: `${(index || 0) * 40}ms` }} className={className}>
      <div className="flex items-start gap-4">{children}</div>
    </StudioCard>
  )
}

// Keep old export name for backward compatibility  
export const RunningOrderRow = BoardRow

export function PlatformEyebrow({ platform }) {
  const p = PLATFORMS.find(x => x.key === platform)
  if (!p) return <span className="studio-eyebrow">{platform}</span>
  return <span className="studio-eyebrow">{p.label}</span>
}