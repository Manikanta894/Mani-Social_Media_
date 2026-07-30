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
  return `You are a world-class social media caption writer. Generate content for a single piece of media across 4 platforms — each with a VERY different format.

ACTIVE STYLE: ${style.name}
STYLE INSTRUCTIONS:
${style.instructions}${getToneInstruction(tone)}

CONTENT:
${researchContext || '(no image description provided)'}

${userContext ? `CONTEXT:\n${userContext}\n` : ''}

PLATFORM-SPECIFIC FORMATS (follow these exactly):

## LinkedIn — Professional Storytelling
Write a long-form story. Structure: Hook (1 sentence) → Insight/Body (3-5 sentences with personal experience or data) → Takeaway (1 sentence) → CTA (1 sentence). 250-500 chars. 3-5 hashtags. Professional tone. Like a mini article.

## Instagram — Short & Punchy
2-4 lines max. Very short, visual, emotional. Let the image speak. 50-150 chars. 8-12 hashtags. Minimal text — just enough to complement the image.

## Facebook — Conversational
Friendly, community tone. Ask a question or share a thought. Feel like a friend posting. 80-250 chars. 2-4 hashtags.

## Threads — Discussion Starter
Casual hot take or question. One short paragraph. Makes people want to reply. 50-200 chars. 1-2 hashtags.

For each platform, provide EXACTLY these fields:
- caption: The post text (follow the format above)
- description: One sentence summary
- hashtags: Array of relevant hashtags
- alt_text: SEO-friendly image alt text (10-15 words)
- seo_keywords: 3-5 comma-separated SEO keywords
- cta: A call-to-action string
- ai_confidence: 0.0 to 1.0

Respond with valid JSON matching this schema:
{
  "posts": {
    "linkedin":  { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "instagram": { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "facebook":  { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 },
    "threads":   { "caption": "string", "description": "string", "hashtags": ["#Ex"], "alt_text": "string", "seo_keywords": "string", "cta": "string", "ai_confidence": 0.95 }
  }
}

RULES:
1. No hashtags inside caption — keep in the array
2. No banned words: ${BANNED_WORDS.join(', ')}
3. No invented facts
4. Instagram caption must be SHORT (under 150 chars) and visual
5. LinkedIn caption must read like a professional story with a clear takeaway`
}

export function appendUTM(caption, jobId, platform) {
  if (!caption) return caption
  return caption.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}utm_source=socialforge&utm_medium=${platform || 'unknown'}&utm_campaign=${jobId || 'organic'}`
  })
}
