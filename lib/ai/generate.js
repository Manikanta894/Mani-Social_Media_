import { storage } from '../storage'
import { callAi } from './providers'
import { BANNED_WORDS, PLATFORM_LIMITS, PLATFORMS, buildVisionPrompt, buildCaptionPrompt, extractJson } from './prompts'

async function runGeneration({ providers, visionProvider, textProvider, style, images: imgs, context, tone, jobId }) {
  let researchContext = ''
  if (imgs.length > 0 && visionProvider) {
    try {
      researchContext = await callAi({
        provider: visionProvider,
        prompt: buildVisionPrompt(),
        images: imgs,
        imageBase64: imgs.length === 1 ? imgs[0].base64 : undefined,
        mimeType: imgs.length === 1 ? imgs[0].mimeType : undefined,
      })
    } catch (e) {
      throw new Error(`Vision analysis failed: ${e.message}. Try selecting a different model in Settings → AI Providers that supports image input (e.g. Gemini 1.5 Pro, GPT-4o, llama-3.2-90b-vision-preview).`)
    }
  }

  const genPrompt = buildCaptionPrompt({ researchContext, userContext: context, style, tone })
  let raw = await callTextWithFallback(providers, textProvider, { prompt: genPrompt, json: true })
  let parsed
  try {
    parsed = extractJson(raw)
  } catch (e) {
    parsed = null
  }

  let firstErrors = validate(parsed)

  if (firstErrors.hardErrors.length > 0) {
    const retryPrompt = genPrompt + `\n\nYour previous attempt had these problems: ${firstErrors.hardErrors.join('; ')}. Fix them and respond again with valid JSON only.`
    raw = await callTextWithFallback(providers, textProvider, { prompt: retryPrompt, json: true })
    try { parsed = extractJson(raw) } catch (e) { parsed = null }
  }

  const finalErrors = validate(parsed)

  if (!parsed || !parsed.posts) {
    throw new Error('AI response could not be parsed. Try again or check provider model. Raw: ' + String(raw).slice(0, 300))
  }

  for (const p of PLATFORMS) {
    if (!parsed.posts[p]) parsed.posts[p] = { caption: '', hashtags: [], description: '', alt_text: '', seo_keywords: '', cta: '', ai_confidence: null }
    if (!Array.isArray(parsed.posts[p].hashtags)) parsed.posts[p].hashtags = []
    if (!parsed.posts[p].description) parsed.posts[p].description = ''
    if (!parsed.posts[p].alt_text) parsed.posts[p].alt_text = ''
    if (!parsed.posts[p].seo_keywords) parsed.posts[p].seo_keywords = ''
    if (!parsed.posts[p].cta) parsed.posts[p].cta = ''
    if (!parsed.posts[p].ai_confidence) parsed.posts[p].ai_confidence = null
  }

  if (jobId) {
    const existing = await storage.contentVersions.list(jobId)
    const nextVersion = (existing.length > 0 ? Math.max(...existing.map(v => v.version)) : 0) + 1
    for (const [platform, post] of Object.entries(parsed.posts)) {
      await storage.contentVersions.create({
        job_id: jobId,
        version: nextVersion,
        platform,
        caption: post.caption,
        description: post.description,
        hashtags: post.hashtags || [],
        alt_text: post.alt_text,
        seo_keywords: post.seo_keywords,
        cta: post.cta,
        ai_confidence: post.ai_confidence,
        providers_used: {
          vision: visionProvider ? { name: visionProvider.name, model: visionProvider.model, type: visionProvider.type } : null,
          text: { name: textProvider.name, model: textProvider.model, type: textProvider.type },
        },
      })
    }
  }

  return {
    research_context: researchContext,
    posts: parsed.posts,
    warnings: finalErrors.all,
    force_passed: finalErrors.hardErrors.length > 0,
    style_used: { id: style.id, name: style.name },
    providers_used: {
      vision: visionProvider ? { name: visionProvider.name, model: visionProvider.model, type: visionProvider.type } : null,
      text: { name: textProvider.name, model: textProvider.model, type: textProvider.type },
    },
  }
}

export async function generateFromImage({ images, imageBase64, mimeType, context, styleId, jobId, tone, variants }) {
  const providers = await storage.providers.list()
  const visionProvider = providers.find(p => p.active_for_vision)
  const textProvider = providers.find(p => p.active_for_text)

  const contextStr = (context || '').trim().toLowerCase()
  if (contextStr.length > 10) {
    const existing = await storage.dedupLog.findByTopic(contextStr)
    if (existing && !existing.already_exists) {
      console.warn('[dedup] Similar topic already generated:', existing.topic)
    }
  }

  if (imageBase64 && !visionProvider) {
    throw new Error('No provider is marked "active for vision". Go to Settings → AI Providers.')
  }
  if (!textProvider) {
    throw new Error('No provider is marked "active for text". Go to Settings → AI Providers.')
  }

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]
  if (!style) throw new Error('No prompt style found. Add one in Settings → Prompt Styles.')

  const imgs = (images && images.length > 0)
    ? images
    : (imageBase64 ? [{ base64: imageBase64, mimeType: mimeType || 'image/jpeg' }] : [])

  const sharedArgs = { providers, visionProvider, textProvider, style, images: imgs, tone }

  if (variants === 2) {
    const resultA = await runGeneration({ ...sharedArgs, context, jobId })

    const variantContext = (context || '') + '\n\n[ALTERNATIVE ANGLE: Take a completely different approach. Use a more conversational tone with a different hook. Vary the structure significantly from the first version.]'
    const resultB = await runGeneration({ ...sharedArgs, context: variantContext })

    return { variant_a: resultA, variant_b: resultB, variants: true }
  }

  const result = await runGeneration({ ...sharedArgs, context, jobId })

  if (contextStr.length > 10) {
    await storage.dedupLog.log(contextStr).catch(() => {})
  }

  return result
}

export async function regeneratePlatform({ images, imageBase64, mimeType, context, styleId, platform, currentResearchContext, tone }) {
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) throw new Error('No provider marked active for text.')

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  const prompt = buildCaptionPrompt({ researchContext: currentResearchContext || '', userContext: context, style, tone })
    + `\n\nIMPORTANT: only regenerate the "${platform}" post. Return the same full JSON shape but focus your creativity on "${platform}". Use a fresh angle.`

  const raw = await callTextWithFallback(providers, textProvider, { prompt, json: true })
  const parsed = extractJson(raw)
  const post = parsed?.posts?.[platform]
  if (!post) throw new Error('Regeneration failed to return the platform post')
  return post
}

export async function generateBulk({ topic, count = 10, tone, platforms, styleId }) {
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) throw new Error('No active text AI provider configured')

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  const platformList = platforms || ['linkedin', 'instagram', 'facebook', 'threads']
  const prompt = `You are a social media content strategist. Generate ${count} unique social media posts about this topic.

Topic: ${topic}
Tone: ${tone || 'professional'}
${style ? `Style: ${style.name} — ${style.instructions}` : ''}

For EACH of the ${count} posts, generate content for ALL these platforms: ${platformList.join(', ')}.

Each post should have a UNIQUE angle — don't repeat the same idea. Vary the format: some educational, some opinion, some question-based, some tips, some storytelling.

Respond with a JSON array of exactly ${count} objects:
[
  {
    "topic": "Specific angle for this post",
    "platforms": {
      "linkedin": { "caption": "...", "hashtags": ["#tag1"] },
      "instagram": { "caption": "...", "hashtags": ["#tag1"] },
      "facebook": { "caption": "...", "hashtags": ["#tag1"] },
      "threads": { "caption": "...", "hashtags": ["#tag1"] }
    }
  }
]

Make captions platform-appropriate:
- LinkedIn: professional, insightful, 300-1200 chars
- Instagram: visual, engaging, emojis ok, 150-800 chars  
- Facebook: conversational, community-focused, 100-400 chars
- Threads: casual, punchy discussion starters, under 500 chars

Respond with ONLY the JSON array, no other text.`

  const raw = await callAi({ provider: textProvider, prompt, json: true })
  let parsed
  try { parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()) } catch { parsed = null }
  if (!Array.isArray(parsed)) throw new Error('Bulk generation returned invalid format. Try again.' + raw.slice(0, 200))
  return parsed.slice(0, count).map((item, i) => ({
    topic: item.topic || `${topic} — post ${i + 1}`,
    platform_posts: item.platforms || {},
    warnings: [],
    status: 'draft',
    source: 'bulk',
  }))
}

export async function generateBlogPost({ imageBase64, mimeType, context, styleId }) {
  const providers = await storage.providers.list()
  const textProviders = providers.filter(p => p.active_for_text)
  if (textProviders.length === 0) throw new Error('No provider marked active for text.')

  // Dedup check
  if (context) {
    const existing = await storage.dedupLog.findByTopic(context)
    if (existing) throw new Error(`Duplicate topic detected — already generated about "${existing.topic}"`)
  }

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  const prompt = `You are a professional blog writer. Write a long-form blog article in Markdown.

TOPIC / CONTEXT: ${context || 'General technology insight'}
${style ? `STYLE: ${style.name} — ${style.instructions}` : ''}

STRUCTURE REQUIREMENTS:
- Hook opening (2-3 sentences that grab attention)
- 3-4 subheadings with substantive body paragraphs
- Closing paragraph with a clear takeaway or CTA
- Total length: 600-900 words

OUTPUT FORMAT — respond with valid JSON only, no fences:
{
  "title": "Compelling blog title (under 80 chars)",
  "body_markdown": "Full article in GitHub-flavored markdown",
  "seo_description": "1-2 sentence SEO meta description (under 160 chars)",
  "cover_image_prompt": "Brief description of a cover image that would fit this article"
}

Write as if for a professional developer/tech audience. Use code examples where relevant. Link to concepts naturally. Avoid fluff.`

  const primaryProvider = textProviders[0]
  let lastError = null

  // Try primary, then fallback
  for (let attempt = 0; attempt < 2; attempt++) {
    const provider = attempt === 0 ? primaryProvider : textProviders[attempt]
    if (!provider) continue
    try {
      let raw = await callAi({ provider, prompt, imageBase64, mimeType, json: true })
      let parsed = extractJson(raw)
      if (!parsed || !parsed.title || !parsed.body_markdown) throw new Error('Missing title or body_markdown')
      if (!parsed.seo_description) parsed.seo_description = parsed.title

      // Log dedup
      if (context) await storage.dedupLog.log(context).catch(() => {})

      return {
        ...parsed,
        providers_used: attempt === 0
          ? { primary: { name: provider.name, type: provider.type, model: provider.model } }
          : { primary: { name: primaryProvider.name, type: primaryProvider.type, model: primaryProvider.model }, fallback: { name: provider.name, type: provider.type, model: provider.model } },
        style_used: style ? { id: style.id, name: style.name } : null,
      }
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(`Blog generation failed after ${textProviders.length} provider(s): ${lastError?.message || 'Unknown error'}`)
}

async function callTextWithFallback(providers, textProvider, params) {
  try {
    return await callAi({ ...params, provider: textProvider })
  } catch (e) {
    const fallback = providers.find(p => p.id !== textProvider.id && p.api_key)
    if (fallback) {
      return await callAi({ ...params, provider: fallback })
    }
    throw e
  }
}

function validate(parsed) {
  const warnings = []
  const hardErrors = []

  if (!parsed || typeof parsed !== 'object' || !parsed.posts) {
    hardErrors.push('Missing "posts" object in AI response')
    return { all: warnings, hardErrors }
  }

  for (const platform of PLATFORMS) {
    const post = parsed.posts[platform]
    if (!post) continue
    const caption = post.caption || ''
    const limit = PLATFORM_LIMITS[platform]

    // Embedded hashtags in caption
    const embedded = caption.match(/#[\w\u00c0-\uffff]+/g)
    if (embedded && embedded.length > 0) {
      hardErrors.push(`${platform}: hashtags embedded in caption (${embedded.slice(0, 3).join(', ')})`)
    }

    // Banned words
    const lower = caption.toLowerCase()
    for (const banned of BANNED_WORDS) {
      if (lower.includes(banned.toLowerCase())) {
        warnings.push(`${platform}: contains banned phrase “${banned}”`)
      }
    }

    // Length
    if (limit && caption.length > limit.max) {
      warnings.push(`${platform}: caption is ${caption.length} chars (max ${limit.max})`)
    }

    // Hashtags shape
    if (Array.isArray(post.hashtags)) {
      for (const tag of post.hashtags) {
        if (typeof tag !== 'string' || !tag.startsWith('#')) {
          warnings.push(`${platform}: bad hashtag “${tag}”`)
        }
      }
    }
  }

  return { all: [...hardErrors, ...warnings], hardErrors }
}
