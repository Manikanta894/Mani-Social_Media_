import { storage } from '../storage'
import { callAi } from './providers'

export async function generateFromTopic({ topic, category, industry, tone, audience, keywords, cta, platform: targetPlatform, language, styleId }) {
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) throw new Error('No active text provider')

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  const prompt = `You are a world-class social media content strategist. Generate a complete content package for this topic. Use ONLY the provided metadata — do NOT invent facts.

TOPIC: ${topic}
${category ? `CATEGORY: ${category}` : ''}
${industry ? `INDUSTRY: ${industry}` : ''}
${tone ? `TONE: ${tone}` : ''}
${audience ? `AUDIENCE: ${audience}` : ''}
${keywords ? `KEYWORDS: ${keywords}` : ''}
${cta ? `CTA REQUESTED: ${cta}` : ''}
${targetPlatform ? `TARGET PLATFORM: ${targetPlatform}` : ''}
${language ? `LANGUAGE: ${language}` : ''}
${style ? `STYLE: ${style.name} — ${style.instructions}` : ''}

Generate ALL of the following as a single JSON object:

1. PLATFORM_CAPTIONS — one unique caption for each platform:
   - linkedin: Professional storytelling. Hook → Insight → Takeaway → CTA. 250-500 chars.
   - instagram: Short, visual, emotional. 50-150 chars. 8-12 hashtags.
   - facebook: Conversational, community tone. 80-250 chars. 2-4 hashtags.
   - threads: Casual hot take or question. 50-200 chars. 1-2 hashtags.
   - twitter: Punchy, under 280 chars. 1-2 hashtags.

2. ALTERNATIVE_CAPTIONS:
   - short: Under 100 chars
   - medium: 100-200 chars
   - long: 200-400 chars

3. HOOKS: Array of 5 hook variations (e.g. "Did you know...", "Stop doing this...")

4. CTA_VARIATIONS: Array of 5 CTAs (e.g. "Save this", "Share this", "Comment below")

5. HASHTAGS:
   - ten: 10 hashtags
   - twenty: 20 hashtags
   - trending: 5 trending hashtags
   - niche: 5 niche hashtags

6. KEYWORDS: 5-10 SEO keywords

7. ALT_TEXT: Descriptive alt text based on the topic (not the image)

8. SOCIAL_METADATA:
   - title, subtitle, description, meta_description, social_preview_text

9. EMOJI_VERSION: Emoji-rich version of the caption (Instagram style)

10. PROFESSIONAL_VERSION: Clean corporate version (LinkedIn style)

11. CAROUSEL_TEXT: Array of 3-5 slide texts

12. STORY_CAPTION: Short story-style caption (under 200 chars)

13. REEL_CAPTION: { hook, caption, cta }

14. POLL: { question, options: ["option1", "option2", "option3", "option4"] }

15. FAQ: Array of 5 { question, answer } objects

16. COMMENT_STARTERS: Array of 10 engagement comment strings

17. IMAGE_CAPTION: Simple pairing caption for the uploaded image

Respond with valid JSON only. No markdown fences. No explanation.`

  const raw = await callAi({ provider: textProvider, prompt, json: true, maxTokens: 8192 })
  let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  let parsed
  try { parsed = JSON.parse(cleaned) } catch { throw new Error('Failed to parse AI response') }
  return parsed
}