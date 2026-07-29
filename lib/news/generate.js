import { storage } from '../storage'
import { callAi } from '../ai/providers'

const PLATFORMS = ['linkedin', 'instagram', 'facebook', 'threads']

export async function generateNewsPost(newsItem) {
  const providers = await storage.providers.list()
  const textProvider = providers.find(p => p.active_for_text)
  if (!textProvider) throw new Error('No active text AI provider configured')

  const prompt = `You are a social media news writer. Turn this news article into engaging posts for 4 platforms.

Title: ${newsItem.title}
Summary: ${newsItem.summary || 'N/A'}
Content: ${(newsItem.content || newsItem.summary || '').slice(0, 1500)}
${newsItem.is_trending ? 'This is a TRENDING/important news item.' : ''}
${newsItem.is_urgent ? 'This is URGENT.' : ''}

For each platform, create a compelling post. LinkedIn = professional/insightful. Facebook = conversational. Instagram = visual/inspiring caption. Threads = casual/conversational.

Respond with JSON:
{
  "linkedin": { "caption": "...", "hashtags": ["tag1", "tag2"], "description": null, "alt_text": null },
  "instagram": { "caption": "...", "hashtags": ["tag1", "tag2"], "description": null, "alt_text": "..." },
  "facebook": { "caption": "...", "hashtags": ["tag1", "tag2"], "description": null, "alt_text": null },
  "threads": { "caption": "...", "hashtags": ["tag1", "tag2"], "description": null, "alt_text": null }
}`

  const raw = await callAi({ provider: textProvider, prompt, json: true })
  let parsed
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim())
  } catch {
    throw new Error('Failed to parse news AI response')
  }
  return parsed
}

export async function generateAndSave(newsId) {
  const item = await storage.newsPosts.get(newsId)
  if (!item) throw new Error('News post not found')
  const generated = await generateNewsPost(item)
  await storage.newsPosts.update(newsId, {
    generated_posts: generated,
    status: 'pending_approval',
  })
  return { ...item, generated_posts: generated, status: 'pending_approval' }
}
