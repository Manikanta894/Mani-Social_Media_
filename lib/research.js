import { storage } from './storage'
import { callAi } from './ai/providers'

// Live research briefing — one AI call (text provider) that grounds the
// content in real stats, developments and examples instead of generic copy.
// Best-effort: any failure returns an empty brief and callers proceed.
export async function buildResearchBrief(context) {
  try {
    const providers = await storage.providers.list()
    const tp = providers.find(p => p.active_for_text)
    if (!tp) return ''
    const prompt = `You are a research analyst. Topic/visual context: "${String(context || '').slice(0, 900)}"

Produce a concise research brief with:
- 2-3 relevant statistics with plausible sources (name the publication)
- 2-3 recent industry developments (2025-2026) related to the context
- 1-2 concrete real-world examples or case studies
- 1-2 supporting source names (publications, not Wikipedia)

Keep it under 220 words, factual, no invented numbers. Return plain text only.`
    const raw = await callAi({ provider: tp, prompt, maxTokens: 600, timeoutMs: 15000 })
    return String(raw || '').trim().slice(0, 2500)
  } catch (e) {
    console.warn('[research] failed:', e.message)
    return ''
  }
}
