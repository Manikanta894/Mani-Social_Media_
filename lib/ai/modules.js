// AI Automation Center — reduced set of independently-configurable modules.
// Stored in the User Settings sheet (appState 'ai_modules' / 'platform_prompts').

import { callAi } from './providers'
import { extractJson } from './prompts'
import { storage } from '../storage'

export const DEFAULT_MODULES = [
  {
    module_key: 'caption',
    display_name: 'Caption Generator',
    prompt_template: `You are a world-class social media caption writer. Given the CONTEXT below, write ONE caption that fits the following platform-specific brief.

PLATFORM: {{platform}}
CONSTRAINTS: {{constraints}}
STYLE: {{style}}
CONTEXT:
{{context}}

Output only the caption text. Do not include hashtags inline — they are added separately.`,
    settings: { temperature: 0.7 },
    enabled: true,
  },
  {
    module_key: 'hashtag',
    display_name: 'Hashtag Generator',
    prompt_template: `Given the following content, generate {{count}} relevant hashtags for {{platform}}. Prefer niche+broad mix. No spaces. Each starts with '#'.

CONTENT:
{{context}}

Respond as a JSON array of strings, e.g. ["#example","#tag"].`,
    settings: { count: 10 },
    enabled: true,
  },
  {
    module_key: 'rewriter',
    display_name: 'Content Rewriter',
    prompt_template: `Rewrite the text below.

Mode: {{mode}}    (shorten | expand | grammar | tone | translate)
Target: {{target}}  (e.g. professional | casual | urgent | Spanish | 100 words)

Original:
{{context}}

Output only the rewritten text. No commentary.`,
    settings: {},
    enabled: true,
  },
  {
    module_key: 'image_analyzer',
    display_name: 'Image Analyzer',
    prompt_template: `Analyze the attached image and respond with valid JSON matching this schema:

{
  "description": "3-5 sentence factual description",
  "objects": ["detected object", "..."],
  "visible_text": "any text visible in the image (OCR)",
  "alt_text": "one-sentence accessibility description",
  "seo_description": "1-2 sentence SEO-friendly summary with keywords",
  "suggested_platforms": ["instagram","linkedin",...],
  "suggested_best_time": "time-of-day suggestion with brief reason",
  "mood": "single word (professional | playful | serene | ...)"
}

Do not invent facts. If OCR finds nothing, use empty string. JSON only, no fences.`,
    settings: {},
    enabled: true,
  },
]

let _seeded = false
async function ensureSeeded() {
  if (_seeded) return
  const rows = await storage.appState.get('ai_modules', null)
  if (!rows || !rows.length) {
    await storage.appState.set('ai_modules', DEFAULT_MODULES)
  }
  _seeded = true
}

export const modules = {
  async list() {
    await ensureSeeded()
    return (await storage.appState.get('ai_modules', [])) || []
  },
  async get(key) {
    await ensureSeeded()
    const rows = (await storage.appState.get('ai_modules', [])) || []
    return rows.find(r => r.module_key === key) || null
  },
  async update(key, patch) {
    const rows = (await storage.appState.get('ai_modules', [])) || []
    const idx = rows.findIndex(r => r.module_key === key)
    if (idx === -1) throw new Error(`Module ${key} not found`)
    const clean = { ...patch }
    delete clean.module_key
    delete clean.created_at
    rows[idx] = { ...rows[idx], ...clean }
    await storage.appState.set('ai_modules', rows)
    return rows[idx]
  },
}

export async function runModule(key, ctx) {
  const mod = await modules.get(key)
  if (!mod) throw new Error(`Unknown module: ${key}`)
  if (!mod.enabled) throw new Error(`Module "${mod.display_name}" is disabled.`)

  // Provider selection: prefer module's own provider, else the globally active text provider.
  const providers = await storage.providers.list()
  let provider = mod.provider_id ? providers.find(p => p.id === mod.provider_id) : null
  if (!provider) {
    provider = providers.find(p =>
      key === 'image_analyzer' ? p.active_for_vision : p.active_for_text
    )
  }
  if (!provider) throw new Error('No AI provider configured for this module.')

  const model = mod.model || provider.model
  const providerToUse = { ...provider, model }

  // Interpolate the prompt template
  const prompt = interpolate(mod.prompt_template, ctx)

  const out = await callAi({
    provider: providerToUse,
    prompt,
    imageBase64: ctx.imageBase64,
    mimeType: ctx.mimeType,
    json: key === 'hashtag' || key === 'image_analyzer',
  })

  if (key === 'hashtag' || key === 'image_analyzer') {
    try { return extractJson(out) } catch (_) { return { raw: out } }
  }
  return out.trim()
}

function interpolate(tpl, ctx) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] !== undefined ? String(ctx[k]) : ''))
}

// Per-platform prompt templates (used by the Caption Generator)
export const platformPrompts = {
  async list() {
    const rows = (await storage.appState.get('platform_prompts', null)) || []
    return rows
  },
  async upsert(platform, patch) {
    const rows = (await storage.appState.get('platform_prompts', [])) || []
    const idx = rows.findIndex(r => r.platform === platform)
    const merged = { platform, ...patch }
    if (idx >= 0) rows[idx] = { ...rows[idx], ...merged }
    else rows.push(merged)
    await storage.appState.set('platform_prompts', rows)
  },
}

export const DEFAULT_PLATFORM_PROMPTS = {
  linkedin:  'Professional but human. 300–1200 chars. Lead with a hook or observation. 3–5 hashtags. Sparse emoji use.',
  instagram: 'Engaging, visual-first. 150–800 chars. Warm and conversational. 8–15 hashtags. Emojis welcome.',
  facebook:  'Conversational, community-feel. 100–400 chars. 2–4 hashtags. Emojis where natural.',
  threads:   'Casual, punchy. Under 500 chars. 1–3 hashtags. Meme energy allowed.',
  twitter:   'Ultra-punchy. Under 240 chars total. 1–2 hashtags. No fluff.',
  pinterest: 'Descriptive, keyword-rich. 100–500 chars. 3–5 hashtags. Include CTA.',
  tiktok:    'Playful, trend-aware. Under 200 chars. 3–5 hashtags.',
  youtube:   'SEO-friendly title-first hook. Description 300–800 chars. Include timestamps if applicable.',
  bluesky:   'Casual but thoughtful. Under 300 chars. 1–2 hashtags. Link-friendly. Skeet energy.',
  mastodon:  'Community-engaged, conversational. 150–500 chars. 1–3 hashtags. Friendly and authentic.',
  google_business_profile: 'Professional, local-friendly. 100–300 chars. 1–2 hashtags. Include CTA or hours. No emoji overuse.',
}
