// Unified adapter for calling any of the supported AI providers.
// Each user-configured provider row in storage looks like:
//   { id, name, type: 'gemini'|'openai'|'anthropic'|'groq'|'openrouter'|'nvidia-llama'|'nvidia-nemotron'|'nvidia-kimi'|'custom', api_key, model, base_url?, active_for_vision, active_for_text }

import { storage } from '../storage'

const OPENAI_BASE = 'https://api.openai.com/v1'
const GROQ_BASE = 'https://api.groq.com/openai/v1'
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1'

// NVIDIA-FIRST: prefer NVIDIA models for final writing. Groq is a fallback
// only. Returns the best text provider for generation.
export function pickTextProvider(providers) {
  const active = (providers || []).filter(p => p.active_for_text && p.api_key)
  if (!active.length) return null
  const nvidia = active.filter(p => String(p.type || '').startsWith('nvidia'))
  if (nvidia.length) {
    return nvidia.find(p => p.model?.toLowerCase().includes('llama')) || nvidia[0]
  }
  // Prefer non-groq premium providers next
  const premium = active.filter(p => p.type !== 'groq')
  return (premium.length ? premium : active)[0]
}

export async function callAi({ provider, prompt, imageBase64, mimeType, images, json = false, maxTokens = 4096, timeoutMs = 90000 }) {
  if (!provider) throw new Error('No AI provider configured. Add one in Settings → AI Providers.')
  if (!provider.api_key) throw new Error(`Provider "${provider.name}" has no API key set.`)
  if (!provider.model) throw new Error(`Provider "${provider.name}" has no model set.`)

  const type = provider.type
  const common = {
    apiKey: provider.api_key,
    model: provider.model,
    prompt,
    images,
    imageBase64,
    mimeType: mimeType || 'image/jpeg',
    json,
    maxTokens,
    timeoutMs,
  }

  let result
  if (type === 'gemini')    result = await callGemini(common)
  else if (type === 'openai')    result = await callOpenAiCompatible({ ...common, baseUrl: OPENAI_BASE, label: 'OpenAI' })
  else if (type === 'groq')      result = await callOpenAiCompatible({ ...common, baseUrl: GROQ_BASE, label: 'Groq' })
  else if (type === 'openrouter') result = await callOpenAiCompatible({ ...common, baseUrl: OPENROUTER_BASE, label: 'OpenRouter' })
  else if (type === 'nvidia-llama') result = await callOpenAiCompatible({ ...common, baseUrl: (provider.base_url || NVIDIA_BASE).replace(/\/+$/, ''), label: 'NVIDIA Llama' })
  else if (type === 'nvidia-nemotron') result = await callOpenAiCompatible({ ...common, baseUrl: (provider.base_url || NVIDIA_BASE).replace(/\/+$/, ''), label: 'NVIDIA Nemotron' })
  else if (type === 'nvidia-kimi') result = await callOpenAiCompatible({ ...common, baseUrl: (provider.base_url || NVIDIA_BASE).replace(/\/+$/, ''), label: 'NVIDIA Kimi' })
  else if (type === 'anthropic') result = await callAnthropic(common)
  else if (type === 'custom')    result = await callOpenAiCompatible({ ...common, baseUrl: (provider.base_url || OPENAI_BASE).replace(/\/+$/, ''), label: 'Custom' })
  else throw new Error(`Unknown provider type: ${type}`)

  const inputTokens = Math.ceil(prompt.length / 4) + (images?.length ? images.length * 1000 : imageBase64 ? 1000 : 0)
  const outputTokens = Math.ceil(result.length / 4)
  try { await storage.providers.usage.record(provider.id, { calls: 1, tokens: inputTokens + outputTokens }) } catch (e) { /* non-blocking */ }

  return result
}

async function callGemini({ apiKey, model, prompt, imageBase64, mimeType, images, json }) {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const parts = [{ text: prompt }]
  if (images && images.length > 0) {
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType || mimeType || 'image/jpeg', data: img.base64 } })
    }
  } else if (imageBase64) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } })
  }
  const body = {
    contents: [{ role: 'user', parts }],
    ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${truncate(text)}`)
  const data = safeJson(text)
  const out = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('') || ''
  if (!out) throw new Error(`Gemini returned empty response: ${truncate(text)}`)
  return out
}

async function callOpenAiCompatible({ apiKey, model, prompt, imageBase64, mimeType, images, json, maxTokens, baseUrl, label, timeoutMs = 20000 }) {
  const content = [{ type: 'text', text: prompt }]
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType || mimeType || 'image/jpeg'};base64,${img.base64}` } })
    }
  } else if (imageBase64) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } })
  }
  const body = {
    model,
    messages: [{ role: 'user', content }],
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  if (!res.ok) {
    // Show the REAL provider error, not a guess
    throw new Error(`${label} ${res.status}: ${truncate(text)}`)
  }
  const data = safeJson(text)
  const out = data?.choices?.[0]?.message?.content
  if (!out) throw new Error(`${label} returned empty response: ${truncate(text)}`)
  return out
}

async function callAnthropic({ apiKey, model, prompt, imageBase64, mimeType, images, maxTokens }) {
  const content = []
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType || mimeType || 'image/jpeg', data: img.base64 },
      })
    }
  } else if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: imageBase64 },
    })
  }
  content.push({ type: 'text', text: prompt })
  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${truncate(text)}`)
  const data = safeJson(text)
  const out = data?.content?.map(c => c.text).filter(Boolean).join('') || ''
  if (!out) throw new Error(`Anthropic returned empty response: ${truncate(text)}`)
  return out
}

export async function testProvider(provider) {
  const started = Date.now()
  const text = await callAi({ provider, prompt: 'Reply with only the two characters: OK' })
  return { ok: true, sample: text.slice(0, 200), ms: Date.now() - started }
}

export async function callVisionWithFallback(prompt, imageBase64, mimeType, timeoutMs = 20000) {
  const providers = await storage.providers.list()
  // Ordered vision providers: NVIDIA Llama → NVIDIA Nemotron → NVIDIA Kimi → OpenRouter vision → any custom
  const visionOrder = ['nvidia-llama', 'nvidia-nemotron', 'nvidia-kimi', 'openrouter']
  const tried = []
  for (const type of visionOrder) {
    const p = providers.find(pr => pr.type === type && pr.active_for_vision && pr.api_key)
    if (!p) continue
    tried.push(type)
    try {
      return await callAi({ provider: p, prompt, imageBase64, mimeType, maxTokens: 2048, timeoutMs })
    } catch (e) {
      console.warn(`[vision] ${type} failed: ${e.message}`)
      continue
    }
  }
  // Try any other vision provider as last resort
  const anyVision = providers.find(pr => pr.active_for_vision && pr.api_key && !visionOrder.includes(pr.type))
  if (anyVision) {
    tried.push(anyVision.type)
    try { return await callAi({ provider: anyVision, prompt, imageBase64, mimeType, maxTokens: 2048, timeoutMs }) } catch {}
  }
  console.warn('[vision] all providers failed:', tried.join(', ') || 'none')
  return null
}

function truncate(s, n = 400) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
function safeJson(s) {
  try { return JSON.parse(s) } catch { return null }
}
