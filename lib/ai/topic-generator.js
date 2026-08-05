import { storage } from '../storage'
import { callAi, callVisionWithFallback } from './providers'

export async function analyzeImage(imageBase64, mimeType, timeoutMs = 20000) {
  const prompt = `Describe this image in detail for social media content generation. Cover:
- Main subject and setting
- Mood, colors, atmosphere
- Notable visual details
- Any products, brands, logos, or visible text
- The story or message the image conveys
Be factual. 4-8 concise sentences.`
  try {
    return await callVisionWithFallback(prompt, imageBase64, mimeType, timeoutMs)
  } catch (e) {
    console.warn('[vision] all providers failed:', e.message)
    return null
  }
}

export async function generateFullContent({ topic, category, industry, tone, audience, keywords, cta, platform: targetPlatform, language, styleId, visionContext }) {
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) throw new Error('No active text provider')

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  const prompt = `You are a world-class social media content strategist. Generate a complete content package for EVERY platform listed below.

${visionContext ? `IMAGE ANALYSIS — THIS IS THE MOST IMPORTANT INPUT. EVERY caption MUST be about what is ACTUALLY in this image: its subject, visible text/message, mood, colors, and scene. NEVER write generic filler.\nIMAGE: ${visionContext}\n` : ''}

TOPIC: ${topic}
${category ? `CATEGORY: ${category}` : ''}
${industry ? `INDUSTRY: ${industry}` : ''}
${tone ? `TONE: ${tone}` : ''}
${keywords ? `KEYWORDS: ${keywords}` : ''}

Generate ALL of the following fields as a single JSON object. EVERY field is required — do not skip any:

1. "PLATFORM_CAPTIONS": Must include ALL 5 platforms:
    "linkedin": "Explain what this content is about: describe the subject, the message, and why it matters to professionals. Informative and insightful. 250-500 chars. 3-5 relevant hashtags. NO personal stories, NO 'I' storytelling."
    "instagram": "Describe the post in 2-4 short informative lines. 50-150 chars. Include 10-15 hashtags. ABSOLUTELY NO questions, NO 'share with us', NO 'tell me in the comments', NO 'what's your'."
    "facebook": "Friendly, informative post explaining the topic clearly. 80-250 chars. 3-5 hashtags. NO questions, NO 'share your story', NO engagement-bait."
    "threads": "Short punchy informative take about the content. One paragraph. 50-200 chars. 1-3 hashtags. NO questions."
    "twitter": "Punchy single informative thought. Under 280 chars. 1-2 hashtags. NO questions."

2. "CAPTION_VARIATIONS": { "short": "under 100 chars", "medium": "100-200 chars", "long": "200-400 chars" }

3. "HOOKS": Array of exactly 5 hook variations like "Did you know...", "Stop doing this...", "Here is why...", "Most people do not realize...", "The biggest mistake is..."

4. "CTA": "One clear call-to-action string that is NOT a question. Examples: 'Follow for more insights', 'Save this post', 'Bookmark this guide'. Never start with Do/Does/What/Why/How/Would/Could/Can."

5. "HASHTAGS": { "ten": ["10 relevant hashtags"], "twenty": ["20 relevant hashtags"], "trending": ["5 trending hashtags"], "niche": ["5 niche hashtags"] }

6. "CAROUSEL_CONTENT": Array of exactly 5 slide texts for a carousel post

7. "STORY_CAPTION": "Short story-style caption under 200 chars"

8. "REEL_CAPTION": { "hook": "string", "caption": "string", "cta": "string" }

9. "POLL": { "question": "string", "options": ["A", "B", "C", "D"] }

10. "FAQ": Array of exactly 5 { "question": "string", "answer": "string" } objects

11. "FIRST_COMMENT": "An informative engagement comment about the content"

12. "ALT_TEXT": "SEO-friendly alt text describing the concept"

13. "SEO_KEYWORDS": Array of 5-10 SEO keywords

IMPORTANT: Every platform caption must be unique and optimized for that specific platform's style. Include hashtags in each caption as specified. Do not leave any field empty. CRITICAL: when image analysis is provided, every caption must reference the actual image content (subject, visible text, mood, scene) — never generic advice unrelated to the image. ABSOLUTE RULE: never ask questions in any caption or CTA — captions explain and inform the reader about the content, they never ask the reader anything.

Respond with valid JSON only. No markdown fences. No explanation.`

  const raw = await callAi({ provider: textProvider, prompt, json: true, maxTokens: 2000, timeoutMs: 90000 })
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) } catch { throw new Error('Failed to parse AI response. Raw: ' + cleaned.slice(0, 200)) }
  return parsed
}

// Backward compat
export const generateFromTopic = generateFullContent