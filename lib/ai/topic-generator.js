import { storage } from '../storage'
import { callAi, callVisionWithFallback } from './providers'

export async function analyzeImage(imageBase64, mimeType) {
  const prompt = `Describe this image in detail for social media content generation. Cover:
- Main subject and setting
- Mood, colors, atmosphere
- Notable visual details
- Any products, brands, logos, or visible text
- The story or message the image conveys
Be factual. 4-8 concise sentences.`
  try {
    return await callVisionWithFallback(prompt, imageBase64, mimeType)
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

  const prompt = `You are a world-class social media content strategist. Generate a complete content package.

${visionContext ? `IMAGE ANALYSIS:\n${visionContext}\n\nUse this image analysis to inform the content.` : 'No image available — generate based solely on the topic.'}

TOPIC: ${topic}
${category ? `CATEGORY: ${category}` : ''}
${industry ? `INDUSTRY: ${industry}` : ''}
${tone ? `TONE: ${tone}` : ''}
${audience ? `AUDIENCE: ${audience}` : ''}
${keywords ? `KEYWORDS: ${keywords}` : ''}
${cta ? `CTA: ${cta}` : ''}
${targetPlatform ? `PLATFORM FOCUS: ${targetPlatform}` : ''}
${style ? `STYLE: ${style.name} — ${style.instructions}` : ''}

Generate ALL of the following as a single JSON object:

1. "PLATFORM_CAPTIONS": {
    "linkedin": "Professional storytelling. Hook → Insight → Takeaway. 250-500 chars.",
    "instagram": "Short, visual, emotional. 50-150 chars.",
    "facebook": "Conversational, community tone. 80-250 chars.",
    "threads": "Casual hot take. 50-200 chars.",
    "twitter": "Punchy, under 280 chars."
  }

2. "CAPTION_VARIATIONS": { "short": "under 100 chars", "medium": "100-200 chars", "long": "200-400 chars" }

3. "HOOKS": ["5 hook variations like 'Did you know...'"] 

4. "CTA": "Primary call-to-action string"

5. "HASHTAGS": { "ten": ["10 hashtags"], "twenty": ["20 hashtags"], "trending": ["5 trending"], "niche": ["5 niche"] }

6. "CAROUSEL_CONTENT": ["Slide 1 text", "Slide 2 text", "Slide 3 text", "Slide 4 text", "Slide 5 text"]

7. "STORY_CAPTION": "Short story-style caption under 200 chars"

8. "REEL_CAPTION": { "hook": "", "caption": "", "cta": "" }

9. "POLL": { "question": "", "options": ["A", "B", "C", "D"] }

10. "FAQ": [{"question": "", "answer": ""}] (5 items)

11. "FIRST_COMMENT": "Engagement comment to post as first comment"

12. "ALT_TEXT": "SEO alt text based on topic"

13. "SEO_KEYWORDS": ["keyword1", "keyword2", "keyword3"]

Respond with valid JSON only. No markdown fences. No explanation.`

  const raw = await callAi({ provider: textProvider, prompt, json: true, maxTokens: 8192 })
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) } catch { throw new Error('Failed to parse AI response. Raw: ' + cleaned.slice(0, 200)) }
  return parsed
}

// Backward compat
export const generateFromTopic = generateFullContent