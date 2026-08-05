import { storage } from './storage'
import { callAi } from './ai/providers'

const WEIGHTS = { grammar: 0.2, hook: 0.2, cta: 0.15, hashtags: 0.1, platform_fit: 0.15, readability: 0.1, emoji: 0.1 }

const LIMITS = {
  linkedin: [300, 1200],
  instagram: [50, 300],
  facebook: [80, 400],
  threads: [50, 480],
  twitter: [0, 280],
}

const HASHTAG_IDEAL = {
  instagram: [5, 10],
  linkedin: [1, 3],
  threads: [1, 3],
  facebook: [1, 3],
  twitter: [1, 3],
}

const CTA_WORDS = ['follow', 'comment', 'share', 'save', 'dm', 'subscribe', 'learn', 'click', 'link', 'reply', 'visit']
const HOOK_WORDS = ['stop', 'nobody', 'everyone', 'secret', 'why', 'how', 'never', 'always', 'truth', 'warning', 'breakthrough', 'shocking', 'real', 'did you know']
const BANNED = ['guaranteed growth', 'viral', 'make money fast', 'click here', 'free money', 'miracle cure', 'crypto pump', 'instant results', 'buy now', 'act now']

const VOICES = {
  linkedin: 'professional thought leadership',
  instagram: 'storytelling, emotional',
  facebook: 'community-focused',
  threads: 'conversational',
}

const CTAS = {
  linkedin: 'What are your thoughts? Share them in the comments.',
  instagram: 'Follow for more and drop a comment below!',
  facebook: 'Join the conversation and comment below!',
  threads: 'Reply and let us keep the convo going!',
  twitter: 'Follow and share to spread the word!',
}

const GENERIC_HASHTAGS = ['socialmedia', 'content', 'marketing', 'community', 'tips', 'insights', 'daily', 'inspo']

const STOPWORDS = new Set('the,and,this,that,with,from,your,you,our,for,are,was,were,have,has,been,will,just,like,about,into,when,what,they,them,their,there,here,than,then,but,not,dont,cant,come,more,most,some,such,only,very,even,also,over,again,could,should,would,because,before,after,yourself,its,it'.split(','))

const clamp = n => Math.max(0, Math.min(100, Math.round(n)))

export async function assessQuality({ platform = 'instagram', caption = '', hashtags = [], styleName = '' } = {}) {
  try {
    const text = String(caption || '')
    const tags = parseHashtags(hashtags)
    const checks = {
      grammar: scoreGrammar(text),
      hook: scoreHook(text),
      cta: scoreCta(text),
      hashtags: scoreHashtags(platform, tags),
      platform_fit: scorePlatformFit(platform, text),
      readability: scoreReadability(text),
      emoji: scoreEmoji(text),
    }
    const score = Math.round(Object.keys(checks).reduce((sum, key) => sum + checks[key] * WEIGHTS[key], 0))
    return { score, checks, issues: buildIssues(platform, text, tags, checks), passed: score >= 70 }
  } catch (e) {
    const degraded = { grammar: 0, hook: 0, cta: 0, hashtags: 0, platform_fit: 0, readability: 0, emoji: 0 }
    return { score: 0, checks: degraded, issues: [`Quality engine error: ${e.message}`], passed: false }
  }
}

export async function improveIfBelow({ platform = 'instagram', caption = '', hashtags = [], styleName = '', threshold = 70, noAi = false } = {}) {
  try {
    const initial = await assessQuality({ platform, caption, hashtags, styleName })
    if (initial.score >= threshold) {
      return { improved: false, caption: String(caption || ''), hashtags: parseHashtags(hashtags), score: initial.score }
    }

    if (noAi) return applyLocalFixes({ platform, caption: String(caption || ''), hashtags: parseHashtags(hashtags) })

    let provider = null
    try {
      const providers = await storage.providers.list()
      provider = providers.find(p => p.active_for_text && p.api_key) || providers.find(p => p.active_for_text) || null
    } catch (e) {
      console.warn('[quality-engine] no provider available:', e.message)
    }

    if (provider) {
      try {
        const ai = await callAi({
          provider,
          prompt: buildImprovePrompt({ platform, caption, hashtags, styleName }),
          json: true,
          maxTokens: 2048,
          timeoutMs: 20000,
        })
        const parsed = typeof ai === 'string' ? JSON.parse(stripJsonFence(ai)) : ai
        if (parsed && typeof parsed.caption === 'string' && Array.isArray(parsed.hashtags)) {
          const newCaption = parsed.caption.trim()
          const newHashtags = parseHashtags(parsed.hashtags)
          const score = (await assessQuality({ platform, caption: newCaption, hashtags: newHashtags, styleName })).score
          return {
            improved: true,
            caption: newCaption,
            hashtags: newHashtags,
            score,
            changes: Array.isArray(parsed.changes) ? parsed.changes : ['AI rewrite'],
            used_ai: true,
          }
        }
      } catch (e) {
        console.warn('[quality-engine] AI improve failed, applying local fixes:', e.message)
      }
    }

    return await applyLocalFixes({ platform, caption, hashtags })
  } catch (e) {
    return { improved: false, caption: String(caption || ''), hashtags: parseHashtags(hashtags), score: 0, error: e.message }
  }
}

async function applyLocalFixes({ platform, caption, hashtags }) {
  const changes = []
  let text = String(caption || '').trim()
  let tags = parseHashtags(hashtags)

  if (text && /^[a-z]/.test(text)) {
    text = text[0].toUpperCase() + text.slice(1)
    changes.push('Capitalized first letter')
  }

  const deDouble = text.replace(/ {2,}/g, ' ')
  if (deDouble !== text) changes.push('Removed double spaces')
  text = deDouble

  const lower = text.toLowerCase()
  const bannedHit = BANNED.find(phrase => lower.includes(phrase))
  if (bannedHit) {
    text = text.replace(new RegExp(bannedHit, 'ig'), '').replace(/ {2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
    changes.push(`Removed banned phrase: "${bannedHit}"`)
  }

  const hasCta = CTA_WORDS.some(word => new RegExp(`\\b${word}\\b`).test(text.toLowerCase()))
  if (!hasCta && text) {
    text = `${text.replace(/[.\s]+$/, '')}. ${CTAS[platform] || CTAS.instagram}`
    changes.push('Appended platform-appropriate CTA')
  }

  const ideal = HASHTAG_IDEAL[platform] || [1, 3]
  if (tags.length > ideal[1]) {
    tags = tags.slice(0, ideal[1])
    changes.push(`Trimmed hashtags to ${ideal[1]} for ${platform}`)
  } else if (tags.length < ideal[0]) {
    const needed = ideal[0] - tags.length
    const seen = new Set(tags.map(t => t.toLowerCase()))
    const added = []
    for (const candidate of deriveHashtags(text).concat(GENERIC_HASHTAGS)) {
      if (added.length >= needed) break
      const key = candidate.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        added.push(candidate)
      }
    }
    tags = tags.concat(added)
    if (added.length) changes.push(`Added ${added.length} hashtag(s) to reach the ${platform} ideal`)
  }

  const result = await assessQuality({ platform, caption: text, hashtags: tags })
  return { improved: true, caption: text, hashtags: tags, score: result.score, changes, used_ai: false }
}

function scoreGrammar(text) {
  if (!text) return 0
  let score = 100
  if (/ {2,}/.test(text)) score -= 25
  if (/\s+[,.;:!?]/.test(text)) score -= 25
  if (/(\b\w+\b)\s+\1\b/i.test(text)) score -= 25
  const first = text.trim()[0]
  if (first && /[a-z]/.test(first)) score -= 25
  return clamp(score)
}

function scoreHook(text) {
  const firstLine = (String(text || '').split('\n')[0] || '').trim()
  if (!firstLine) return 30
  const hasSignal = /[!?]/.test(firstLine) || /^\d/.test(firstLine) || HOOK_WORDS.some(word => firstLine.toLowerCase().includes(word))
  let score = 100
  if (firstLine.length < 15) score -= 40
  if (!hasSignal) score -= 40
  return clamp(score)
}

function scoreCta(text) {
  const lower = String(text || '').toLowerCase()
  const matches = CTA_WORDS.filter(word => new RegExp(`\\b${word}\\b`).test(lower))
  if (matches.length === 0) return 30
  if (matches.length === 1) return 80
  return 100
}

function scoreHashtags(platform, tags) {
  const count = tags.length
  if (count === 0) return 25
  if (count >= 12) return 20
  if (platform === 'instagram') {
    if (count >= 5 && count <= 10) return 100
    if (count <= 4) return 60
    return 50
  }
  if (count <= 3) return 100
  if (count >= 10) return 30
  return 60
}

function scorePlatformFit(platform, text) {
  const length = String(text || '').length
  const limits = LIMITS[platform] || [50, 1000]
  const [min, max] = limits
  if (length < min) return clamp((100 * length) / Math.max(min, 1))
  if (length > max) return clamp((100 * max) / length)
  return 100
}

function scoreReadability(text) {
  const sentences = String(text || '').split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return 0
  const avgWords = words.length / Math.max(sentences.length, 1)
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0)
  const flesch = 206.835 - 1.015 * avgWords - 84.6 * (syllables / words.length)
  let score = flesch >= 60 ? 100 : flesch >= 40 ? 75 : flesch >= 20 ? 50 : 30
  if (avgWords > 28) score -= 20
  else if (avgWords < 4) score -= 10
  return clamp(score)
}

function scoreEmoji(text) {
  const count = (String(text || '').match(/\p{Extended_Pictographic}/gu) || []).length
  if (count === 0) return 70
  let score = count <= 3 ? 100 : count <= 6 ? 75 : count <= 10 ? 50 : 20
  const words = String(text || '').split(/\s+/).filter(Boolean).length
  if (words > 0 && count > words / 4) score = Math.min(score, 40)
  return score
}

function buildIssues(platform, text, tags, checks) {
  const issues = []
  if (checks.grammar < 80) issues.push('Grammar: fix double spaces, spacing before punctuation, repeated words or missing capital letter.')
  if (checks.hook < 70) issues.push('Weak hook: open with a question, statistic or bold claim in the first line (15+ characters).')
  if (checks.cta < 70) issues.push('Missing call-to-action: use follow, comment, share, save, dm, subscribe, learn, click, link, reply or visit.')
  if (checks.hashtags < 70) issues.push(`Hashtag count (${tags.length}) is not ideal for ${platform}.`)
  if (checks.platform_fit < 70) issues.push(`Caption length is outside the ideal range for ${platform}.`)
  if (checks.readability < 70) issues.push('Hard to read: shorten sentences and simplify wording.')
  if (checks.emoji < 60) issues.push('Too many emojis: keep them balanced.')
  if (!text) issues.push('Caption is empty.')
  return issues
}

function buildImprovePrompt({ platform, caption, hashtags, styleName }) {
  const voice = VOICES[platform] || 'authentic'
  const limits = LIMITS[platform] || [50, 1000]
  const ideal = HASHTAG_IDEAL[platform] || [1, 3]
  const tagList = parseHashtags(hashtags).map(t => `#${t}`).join(', ') || 'none'
  return [
    `You are a senior social media editor. Improve the caption below for ${platform} in a ${voice} voice.`,
    'Keep the core message and facts intact. Requirements:',
    '1. Strengthen the hook: question, statistic or bold claim in the first line.',
    '2. Include a clear call-to-action (follow, comment, share, save, dm, subscribe, learn, click, link, reply or visit).',
    `3. Right-size hashtags: ${ideal[0]}-${ideal[1]} for ${platform}, never more than 10, no hashtag spam.`,
    `4. Stay within the platform length limit: maximum ${limits[1]} characters.`,
    `5. No banned phrases: ${BANNED.join(', ')}.`,
    `6. Match the requested style: ${styleName ? `"${styleName}"` : 'none specified'}.`,
    'Respond with JSON only: {"caption": "...", "hashtags": ["tag1", "tag2"], "changes": ["what you fixed"]}.',
    '',
    'Current caption:',
    String(caption || ''),
    '',
    `Current hashtags: ${tagList}`,
  ].join('\n')
}

function parseHashtags(input) {
  if (input == null) return []
  const raw = Array.isArray(input) ? input : String(input).split(/[\s,]+/)
  return raw.map(t => String(t).trim().replace(/^#+/, '')).filter(Boolean)
}

function deriveHashtags(text) {
  const seen = new Set()
  const out = []
  for (const word of String(text || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []) {
    if (STOPWORDS.has(word)) continue
    const tag = word[0].toUpperCase() + word.slice(1)
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 1
  let count = (clean.match(/[aeiouy]+/g) || []).length
  if (count > 1 && /e$/.test(clean)) count -= 1
  return Math.max(count, 1)
}

function stripJsonFence(str) {
  return String(str).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
}
