// ============================================================================
// Publish the best available news opportunity across blog + all social
// platforms in one shot. Used by /api/automation/news-publish.
// ============================================================================

import { storage } from '../storage'
import { supabase } from '../supabase'
import { analyzeNewsItem, getNewsTopics, getLearning } from './ai-decision'

export async function runNewsPublishAll() {
  const sb = supabase()

  // 1. Pick the best story — highest opportunity in the approval queue
  const { data: pending } = await sb.from('news_posts').select('*').eq('status', 'pending_approval').order('created_at', { ascending: false }).limit(10)
  let best = null
  if (pending?.length) {
    best = [...pending].sort((a, b) => (b.ai_analysis?.opportunity_score || 0) - (a.ai_analysis?.opportunity_score || 0))[0]
  } else {
    // No approved candidates — analyze the newest fresh items and pick the top scorer
    const { data: fresh } = await sb.from('news_posts').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(6)
    if (fresh?.length) {
      const topics = await getNewsTopics()
      const learning = await getLearning()
      const results = await Promise.all(fresh.slice(0, 3).map(async (it) => ({ it, a: await analyzeNewsItem(it, topics, learning, sb) })))
      const scored = results.filter(r => r.a.opportunity_score >= 70).sort((x, y) => y.a.opportunity_score - x.a.opportunity_score)
      if (scored.length) {
        best = scored[0].it
        await sb.from('news_posts').update({ status: 'pending_approval', ai_analysis: scored[0].a }).eq('id', best.id)
      }
    }
  }
  if (!best) return { ok: false, error: 'No news opportunity found (need pending_approval or a scorable fresh item)' }

  // 2. Generate social content (LinkedIn / Instagram / Facebook / Threads)
  const { generateAndSave } = await import('./generate')
  const withPosts = await generateAndSave(best.id)
  const generated = withPosts.generated_posts || {}

  // 3. Create + publish the SEO blog article to INSIGHTS
  let blogResult = null
  try {
    const { generateArticle } = await import('../blog/generate')
    const article = await generateArticle({ context: `News: ${best.title}\n\n${best.summary || ''}`, lastCategory: null })
    const bp = await storage.blogPosts.create({
      title: article.title, body_markdown: article.body_markdown,
      seo_description: article.seo_description, status: 'draft',
    })
    const { publishBlogPost } = await import('../publishers')
    const pr = await publishBlogPost(bp, { dryRun: false })
    await storage.blogPosts.update(bp.id, { status: 'published', published_url: pr.url, published_at: new Date().toISOString() })
    blogResult = { id: bp.id, url: pr.url, title: article.title }
  } catch (e) {
    blogResult = { error: e.message.slice(0, 300) }
  }

  // 4. Publish social platforms (uses META + LINKEDIN tokens; FB/Threads may fail on permissions)
  let socialResults = []
  try {
    const { publishJob } = await import('../publishers')
    const tempJob = { id: `news_${best.id}`, platform_posts: generated, image_ref: best.image_url, publish_results: {}, warnings: [] }
    const r = await publishJob(tempJob, { platforms: Object.keys(generated) })
    socialResults = r.results || []
  } catch (e) {
    socialResults = [{ ok: false, error: e.message.slice(0, 300) }]
  }

  const anySocialOk = socialResults.some(x => x.ok)
  await sb.from('news_posts').update({
    status: anySocialOk || blogResult?.url ? 'published' : 'failed',
    published_at_actual: new Date().toISOString(),
  }).eq('id', best.id)

  try {
    const { emitEvent } = await import('../event-engine')
    emitEvent({ type: anySocialOk || blogResult?.url ? 'post_published' : 'post_failed', source: 'news_publish_all', payload: { news_id: best.id, title: best.title, blog: blogResult?.url || null, social: socialResults.filter(x => x.ok).map(x => x.platform) } }).catch(() => {})
  } catch {}

  return { ok: true, news_id: best.id, title: best.title, opportunity: best.ai_analysis?.opportunity_score || 0, blog: blogResult, social: socialResults }
}
