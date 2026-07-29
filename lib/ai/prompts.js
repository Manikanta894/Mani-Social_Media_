// Prompt templates, banned words, platform limits, and JSON extraction helpers.

export const BANNED_WORDS = [
  'game-changer',
  'game changer',
  'revolutionary',
  'synergy',
  'leverage',
  'unlock',
  'empower',
  'circle back',
  'move the needle',
  'low-hanging fruit',
  'ideate',
  'disrupt',
  'paradigm shift',
]

export const PLATFORM_LIMITS = {
  linkedin:  { max: 3000, ideal: 1200 },
  instagram: { max: 2200, ideal: 800  },
  facebook:  { max: 5000, ideal: 400  },
  threads:   { max: 500,  ideal: 400  },
  twitter:   { max: 280,  ideal: 240  },
}

export const PLATFORMS = ['linkedin', 'instagram', 'facebook', 'threads']

export function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch (_) {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch (_) {}
    }
    throw new Error('Failed to parse LLM JSON response. Preview: ' + cleaned.slice(0, 250))
  }
}

export function buildVisionPrompt() {
  return `Describe this image in detail for social-media caption writing. Cover:
- Main subject and setting
- Mood, colors, atmosphere
- Notable visual details, textures, composition
- Any products, brands, logos, or visible text
- Emotions or story the image conveys

Be factual and observational. Do NOT invent facts. Respond with 3–6 concise sentences.`
}

function getToneInstruction(tone) {
  if (tone === undefined || tone === null) return ''
  if (tone <= 20) return '\nTONE: very casual, conversational, use slang and emojis freely'
  if (tone <= 40) return '\nTONE: casual but professional, warm tone'
  if (tone <= 60) return '\nTONE: neutral, balanced tone'
  if (tone <= 80) return '\nTONE: professional, polished, slightly formal'
  return '\nTONE: formal, authoritative, business language'
}

export function buildCaptionPrompt({ researchContext, userContext, style, tone }) {
  return `You are a world-class social media caption writer. Generate content for a single piece of media across 5 platforms.

ACTIVE STYLE: ${style.name}
STYLE INSTRUCTIONS:
${style.instructions}${getToneInstruction(tone)}

CONTENT DESCRIPTION (from vision pass or user):
${researchContext || '(no image description provided)'}

${userContext ? `ADDITIONAL USER CONTEXT:\n${userContext}\n` : ''}

Generate one content set per platform. Constraints per platform:
- linkedin:  Professional but human. 300–1200 chars. 3–5 relevant hashtags.
- instagram: Engaging, visual-first. 150–800 chars. 8–15 hashtags.
- facebook:  Conversational, community-feel. 100–400 chars. 2–4 hashtags.
- threads:   Casual, punchy. Under 500 chars. 1–3 hashtags.

For each platform, provide:
- caption: The main post text
- description: A short 1-2 sentence description of the post
- hashtags: Array of relevant hashtags
- alt_text: SEO-friendly image alt text (10-15 words)
- seo_keywords: 3-5 comma-separated SEO keywords
- cta: A suggested call-to-action string
- ai_confidence: Your confidence score from 0.0 to 1.0

Respond ONLY with valid JSON matching EXACTLY this schema:
{
  "posts": {
    "linkedin":  { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "instagram": { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "facebook":  { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "threads":   { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 }
  }
}

HARD RULES (violations cause retry):
1. Do NOT embed hashtags inside caption text. Keep them in the hashtags array ONLY.
2. Do NOT use these banned buzzwords: ${BANNED_WORDS.join(', ')}
3. Do NOT invent facts not present in the description or user context.
4. Respect character limits above.
5. Emojis inside caption text are welcome where they fit the STYLE.
6. Every hashtag must start with '#' and contain no spaces.

Respond with JSON only — no prose, no markdown fences, no explanation.`
}

export function appendUTM(caption, jobId, platform) {
  if (!caption) return caption
  return caption.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}utm_source=socialforge&utm_medium=${platform || 'unknown'}&utm_campaign=${jobId || 'organic'}`
  })
}
