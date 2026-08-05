import { storage } from '../storage'
import { callAi, pickTextProvider } from '../ai/providers'

const CATEGORIES = ['ai', 'tech', 'business', 'essays', 'productivity']

export async function generateArticle({ imageBase64, mimeType, imageUrl, context, styleId, lastCategory }) {
  const providers = await storage.providers.list()
  const visionProvider = providers.find(p => p.active_for_vision)
  const textProvider = pickTextProvider(providers) || providers.find(p => p.active_for_text)
  if (!visionProvider) throw new Error('No vision provider configured')
  if (!textProvider) throw new Error('No text provider configured')

  const styles = await storage.promptStyles.list()
  const style = (styleId && styles.find(s => s.id === styleId)) || styles.find(s => s.is_active) || styles[0]

  let visionContext = ''
  if (imageBase64 && visionProvider) {
    try {
      visionContext = await callAi({
        provider: visionProvider,
        prompt: `Analyze this image in detail for a premium editorial blog article on INSIGHTS (insights.manikantar.in). Cover:
- Main subject and setting
- Industry and business relevance
- Mood, colors, atmosphere
- Any products, services, branding, or visible text
- The story or message this image conveys
- How this image relates to AI, technology, business, or productivity trends

Be factual. Do NOT invent facts not visible in the image. Respond with 4-8 concise sentences.`,
        images: [{ base64: imageBase64, mimeType: mimeType || 'image/jpeg' }],
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
      })
    } catch (e) {
      // Vision is best-effort — continue with text-only generation on failure
      console.warn('[blog] vision analysis failed, continuing without image context:', e.message)
      visionContext = ''
    }
  }

  const categoryInstruction = lastCategory
    ? `The last published article was in the "${lastCategory}" category. Choose a DIFFERENT category if possible from: ${CATEGORIES.join(', ')}.`
    : `Choose the most relevant category from: ${CATEGORIES.join(', ')}.`

  const prompt = `You are the AI Editor-in-Chief of **INSIGHTS** (insights.manikantar.in), a premium editorial publication covering AI, Technology, Business, Productivity, and Modern Thought Leadership.

Your publication is trusted like Harvard Business Review, MIT Technology Review, and Stripe Atlas.

Write an original, high-quality, SEO-optimized blog article based on this image analysis:

IMAGE ANALYSIS:
${visionContext || '(No image description available — write a general article about relevant industry topics)'}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

${style ? `WRITING STYLE: ${style.name} — ${style.instructions}` : ''}

${categoryInstruction}

WRITING REQUIREMENTS (must include ALL):
- SEO Title (under 70 chars, includes primary keyword)
- Meta Title (compelling, includes brand "INSIGHTS")
- Meta Description (under 160 chars, includes keyword)
- URL Slug (short, keyword-rich, no special chars)
- Excerpt (2-3 sentences summarizing the article, under 200 chars)
- Introduction with a strong opening hook
- At least 4 H2 sections with detailed content
- At least 2 H3 subsections per H2
- Bullet lists where appropriate
- Relevant quotes (can be attributed to industry leaders)
- Practical examples and case studies
- Actionable insights and key takeaways
- Conclusion that ties everything together
- FAQ section (3-5 questions with answers)
- Reading time (approximate minutes)
- Tags (5-8 relevant tags)
- Keywords (5-10 comma-separated SEO keywords)
- Image alt text for the featured image

STYLE GUIDE:
- Professional, editorial quality — like Harvard Business Review or MIT Technology Review
- Zero emojis. NEVER use emojis anywhere in the article — this is the most important rule.
- No Wikipedia references or links — never cite or link to Wikipedia
- Research-backed but easy to read
- Natural, human voice — never sound AI-generated
- Never use repetitive wording
- Never plagiarize
- Include recent developments (2025-2026) and modern examples
- Make every paragraph valuable — no fluff
- Target high-ranking keywords naturally
- Suggest internal links (e.g., "Read more on our analysis of [topic]")
- Quotes: use blockquote (> ) for a key insight from the article itself, NOT a generic quote. Pull one powerful sentence from the content as a highlighted quote. Only one quote block per article. No emoji in or around quotes.

OUTPUT FORMAT — respond with valid JSON only:
{
  "title": "SEO Title",
  "metaTitle": "Meta Title with INSIGHTS brand",
  "metaDescription": "Under 160 chars",
  "slug": "url-friendly-slug",
  "excerpt": "2-3 sentence excerpt",
  "content": "Full article in markdown format. Include H2 (##) and H3 (###) headings, bullet lists, quotes (>), and all required sections above.",
  "category": "ai|tech|business|essays|productivity",
  "tags": ["tag1", "tag2", "tag3"],
  "keywords": "keyword1, keyword2, keyword3",
  "readingTime": 8,
  "altText": "SEO-friendly alt text for featured image",
  "seoScore": 85,
  "faq": [
    { "question": "Q1?", "answer": "A1" }
  ]
}

Quality check BEFORE responding:
- Is the title under 70 chars? Yes/No
- Is the meta description under 160 chars? Yes/No
- Are there at least 4 H2 sections? Yes/No
- Is the content at least 800 words? Yes/No
- Does it include recent/2025-2026 references? Yes/No
- Is it factual and not generic? Yes/No

Respond with ONLY valid JSON. No markdown fences. No commentary.`

  let lastError = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callAi({ provider: textProvider, prompt, json: true })
      let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      if (!parsed.title || !parsed.content) throw new Error('Missing title or content')
      if (!parsed.category) parsed.category = 'tech'
      if (!parsed.tags) parsed.tags = ['technology']
      if (!parsed.metaDescription) parsed.metaDescription = parsed.excerpt?.slice(0, 160) || parsed.title
      if (!parsed.slug) parsed.slug = parsed.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return { ...parsed, imageUrl, visionProvider: visionProvider.name, textProvider: textProvider.name, styleName: style?.name }
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(`Article generation failed: ${lastError?.message || 'Unknown error'}`)
}

export async function publishToInsights({ title, content, excerpt, category, coverImage, tags, status = 'published' }) {
  const apiSecret = process.env.INSIGHTS_API_SECRET
  if (!apiSecret) throw new Error('INSIGHTS_API_SECRET not configured in .env')

  const res = await fetch('https://insights.manikantar.in/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-secret': apiSecret },
    body: JSON.stringify({ title, content, excerpt, section: category, coverImage, hashtags: tags, status }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`INSIGHTS API ${res.status}: ${text.slice(0, 400)}`)
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`INSIGHTS bad JSON: ${text.slice(0, 300)}`) }

  // Robust field extraction across CMS response shapes
  const pick = (...paths) => {
    for (const p of paths) {
      let v = data
      for (const k of p.split('.')) { if (v == null) break; v = v[k] }
      if (v && typeof v === 'string') return v
    }
    return null
  }
  const url = pick('article.url', 'url', 'data.article.url', 'data.url', 'article.permalink', 'data.article.permalink', 'data.data.url', 'data.data.article.url', 'result.url')
  const slug = pick('article.slug', 'slug', 'data.article.slug', 'data.slug', 'data.data.slug', 'data.data.article.slug')
  const id = pick('article._id', 'article.id', 'id', 'data.article._id', 'data.article.id', 'data.id', 'data.data.id')
  const finalUrl = url || (slug ? `https://insights.manikantar.in/articles/${slug}` : '')
  return { platform: 'insights', url: finalUrl, id: id || '', slug: slug || '', raw: text.slice(0, 200) }
}

export const BLOG_CATEGORIES = CATEGORIES