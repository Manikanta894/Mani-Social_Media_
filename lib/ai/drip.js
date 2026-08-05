import { storage } from '../storage'
import { callAi } from './providers'

export async function generateDripPosts(blogId, count = 4, spreadDays = 5) {
  const blog = await storage.blogPosts.get(blogId)
  if (!blog) throw new Error('Blog post not found')
  if (!blog.body_markdown) throw new Error('Blog post has no body content')

  const provider = await storage.providers.getActive('text')
  if (!provider) throw new Error('No active text provider configured')

  const platforms = ['linkedin', 'instagram', 'facebook', 'threads', 'twitter']
  const posts = []

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((spreadDays / count) * i)
    const scheduledDate = new Date()
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset + 1)
    scheduledDate.setHours(9 + (i % 8), 0, 0, 0)

    const platform = platforms[i % platforms.length]
    const emojiGuide = {
      linkedin: 'Professional emojis like 💼 📊 🚀 ✅ (1-2 max, subtle)',
      instagram: 'Use emojis freely like ✨ 🔥 💡 👇 (3-5, engaging)',
      facebook: 'Friendly emojis like 👍 💬 🎯 🤔 (1-3, conversational)',
      threads: 'Casual emojis like 💭 🤯 👀 🧵 (1-3, discussion-style)',
      twitter: 'Bold emojis like 🧵 🔥 💡 📌 (1-2, punchy)',
    }
    const prompt = `You are a social media strategist. Extract one key insight from this blog post and write a ${platform} caption (max 200 words, engaging hook, 3-5 hashtags). Make it standalone — it should make sense without reading the full article.

Use emojis appropriately for ${platform}: ${emojiGuide[platform] || 'Use relevant emojis'}

Blog title: "${blog.title}"

Body:
${blog.body_markdown.slice(0, 2000)}

Write a caption for ${platform}. Include hashtags at the end.`

    let caption = ''
    try {
      const raw = await callAi({ provider, prompt })
      caption = raw.slice(0, 2000)
    } catch {
      caption = `📖 From "${blog.title}" — key insight: Check the full article for details. 🚀`
    }

    const platformPosts = {}
    for (const p of platforms) {
      platformPosts[p] = {
        caption: p === platform ? caption : `From our latest: "${blog.title}" — check it out for deeper insights.`,
        hashtags: ['#ContentStrategy', '#BlogToSocial', '#SocialForge'],
      }
    }

    const job = await storage.jobs.create({
      source: 'blog_drip',
      topic: `Drip ${i + 1}/${count}: ${blog.title}`,
      platform_posts: platformPosts,
      status: 'scheduled',
      scheduled_for: scheduledDate.toISOString(),
      campaign_id: `drip_${blogId}`,
    })

    posts.push({ id: job.id, platform, scheduled_for: scheduledDate.toISOString(), caption: caption.slice(0, 100) + '…', index: i + 1 })
  }

  return { blog_id: blogId, total: count, spread_days: spreadDays, posts }
}
