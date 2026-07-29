import { NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { generateFromImage, regeneratePlatform, generateBulk, generateBlogPost } from '@/lib/ai/generate'
import { testProvider } from '@/lib/ai/providers'
import { handleUpdate, sendDraftToAdmin } from '@/lib/telegram/handler'
import { setWebhook, deleteWebhook, getWebhookInfo, getMe, sendMessage } from '@/lib/telegram/client'
import { publishJob, SUPPORTED_PLATFORMS } from '@/lib/publishers'
import { publishSweep } from '@/lib/scheduler'
import { fetchAllStats, getAggregatedStats, getPostAnalytics, getHashtagAnalytics, getCoachInsights, generateReport } from '@/lib/analytics'
import { fetchAllComments, replyToComment } from '@/lib/comments/fetchers'
import { uploadBase64Image } from '@/lib/media'
import { modules as aiModules, runModule, platformPrompts, DEFAULT_PLATFORM_PROMPTS } from '@/lib/ai/modules'

import { automation, runTick, retryFailed, bulkAction, reorderQueue, getActivityFeed } from '@/lib/automation'
import { syncIntakeToQueue, uploadIntakeImage, listIntakeFiles, listQueue, queueStats } from '@/lib/intake'
import { runNewsCheck, generateAndSave, detectConflicts, findNextSlot } from '@/lib/news'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ok = (data) => NextResponse.json({ ok: true, data })
const err = (message, status = 400, extra = {}) =>
  NextResponse.json({ ok: false, error: message, ...extra }, { status })

async function route(request, method) {
  const url = new URL(request.url)
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const [resource, id, action] = parts

  try {
    // --- Health -------------------------------------------------------------
    if (!resource || resource === 'health') {
      if (id === 'last-run' && method === 'GET') {
        const [recentAudit, recentJobs] = await Promise.all([
          storage.audit.list(50),
          storage.jobs.list({}),
        ])
        const lastPublish = recentAudit.find(a => a.action === 'publish' || a.action === 'publish_sweep')
        const lastGenerate = recentAudit.find(a => a.action === 'generate')
        const lastFetch = recentAudit.find(a => a.action === 'fetch_stats')
        const failedJobs = recentJobs.filter(j => j.status === 'failed').slice(0, 3)
        return ok({
          last_publish_at: lastPublish?.performed_at || null,
          last_generate_at: lastGenerate?.performed_at || null,
          last_fetch_at: lastFetch?.performed_at || null,
          recent_failures: failedJobs.map(j => ({ id: j.id, topic: j.topic, error: j.warnings?.[0] })),
        })
      }
      return ok({ status: 'ok', ts: new Date().toISOString() })
    }

    // --- Providers ----------------------------------------------------------
    if (resource === 'providers') {
      if (method === 'GET' && !id) {
        const providers = await storage.providers.list()
        // Never send raw api_key to client; send a masked variant.
        return ok(providers.map(p => ({
          ...p,
          api_key: p.api_key ? maskKey(p.api_key) : '',
          api_key_set: !!p.api_key,
        })))
      }
      if (method === 'POST' && !id) {
        const body = await request.json()
        const created = await storage.providers.create(body)
        return ok(sanitize(created))
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        // If api_key is empty string, don't overwrite existing key
        if (body.api_key === '' || body.api_key === undefined) delete body.api_key
        const updated = await storage.providers.update(id, body)
        return ok(sanitize(updated))
      }
      if (method === 'DELETE' && id) {
        await storage.providers.remove(id)
        return ok(true)
      }
      if (method === 'POST' && id === 'set-active') {
        const body = await request.json()
        await storage.providers.setActive(body.role, body.providerId)
        return ok(true)
      }
      if (method === 'POST' && id && action === 'test') {
        const provider = await storage.providers.get(id)
        if (!provider) return err('Provider not found', 404)
        try {
          const result = await testProvider(provider)
          return ok(result)
        } catch (e) {
          return err(e.message || 'Test failed', 400)
        }
      }
      if (method === 'GET' && id === 'usage') {
        const providerId = url.searchParams.get('provider_id')
        return ok(await storage.providers.usage.list(providerId))
      }
    }

    // --- Prompt Styles ------------------------------------------------------
    if (resource === 'prompt-styles') {
      if (method === 'GET' && !id) return ok(await storage.promptStyles.list())
      if (method === 'POST' && !id) {
        const body = await request.json()
        return ok(await storage.promptStyles.create(body))
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        return ok(await storage.promptStyles.update(id, body))
      }
      if (method === 'DELETE' && id) {
        await storage.promptStyles.remove(id)
        return ok(true)
      }
      if (method === 'POST' && id === 'set-active') {
        const body = await request.json()
        await storage.promptStyles.setActive(body.id)
        return ok(true)
      }
      if (method === 'POST' && id === 'preview') {
        const body = await request.json()
        const { callAi } = await import('@/lib/ai/providers')
        const provider = await storage.providers.getActive('text')
        if (!provider) return err('No active text provider', 400)
        const style = await storage.promptStyles.get(body.styleId)
        const prompt = `Write a short social media post about a new software launch. Keep it under 100 words.\n\nWriting style:\n${style ? style.instructions : 'Professional, clear tone.'}`
        const result = await callAi({ provider, prompt })
        return ok({ preview: result })
      }
    }

    // --- Generate -----------------------------------------------------------
    if (resource === 'generate' && method === 'POST') {
      const body = await request.json()
      const result = await generateFromImage(body)
      return ok(result)
    }

    // --- Recycle (evergreen candidates) ------------------------------------
    if (resource === 'recycle' && method === 'POST') {
      const { findEvergreenCandidates } = await import('@/lib/evergreen')
      return ok(await findEvergreenCandidates())
    }

    // --- Regenerate a single platform --------------------------------------
    if (resource === 'regenerate' && method === 'POST') {
      const body = await request.json()
      const post = await regeneratePlatform(body)
      return ok(post)
    }

    // --- URL content extraction --------------------------------------------
    if (resource === 'extract' && method === 'POST') {
      const body = await request.json()
      if (!body.url) return err('Missing url')
      try {
        const res = await fetch(body.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) })
        const html = await res.text()
        const title = html.match(/<title[^>]*>([^<]+)/i)?.[1] || ''
        const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ||
                     html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1] || ''
        const bodyText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
        return ok({ title, description: desc, body: bodyText })
      } catch (e) {
        return err('Failed to extract: ' + e.message)
      }
    }

    // --- Jobs (drafts) ------------------------------------------------------
    if (resource === 'jobs') {
      if (method === 'GET' && !id) {
        const campaign_id = url.searchParams.get('campaign_id')
        const source = url.searchParams.get('source')
        return ok(await storage.jobs.list({ campaign_id, source }))
      }
      if (method === 'GET' && id) {
        const j = await storage.jobs.get(id)
        return j ? ok(j) : err('Not found', 404)
      }
      if (method === 'POST' && !id) {
        const body = await request.json()
        // If base64 image is included, upload to Storage and use its URL
        if (body.image_base64) {
          try {
            const up = await uploadBase64Image(body.image_base64, body.image_mime || 'image/jpeg')
            body.image_ref = up.url
          } catch (e) {
            console.warn('[jobs] image upload failed:', e.message)
          }
          delete body.image_base64
          delete body.image_mime
        }
        return ok(await storage.jobs.create(body))
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        return ok(await storage.jobs.update(id, body))
      }
      if (method === 'POST' && id && action === 'retry') {
        const job = await storage.jobs.get(id)
        if (!job) return err('Job not found', 404)
        if (job.status !== 'failed') return err('Only failed jobs can be retried', 400)
        await storage.jobs.update(id, { status: 'approved', warnings: [] })
        return ok({ retried: true })
      }
    }

    // --- Telegram -----------------------------------------------------------
    if (resource === 'telegram') {
      const sub = id  // second path segment

      if (sub === 'webhook' && method === 'POST') {
        const settings = await storage.settings.get()
        const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
        if (settings.telegram_webhook_secret && secretHeader !== settings.telegram_webhook_secret) {
          console.warn('[telegram] bad secret header:', secretHeader)
          return err('Forbidden', 403)
        }
        const update = await request.json().catch(() => ({}))
        // Fire-and-log: Telegram expects fast 200
        handleUpdate(update).catch(e => console.error('[telegram] handler:', e))
        return ok(true)
      }

      if (sub === 'status' && method === 'GET') {
        const settings = await storage.settings.get()
        let botInfo = null
        let webhookInfo = null
        try { if (settings.telegram_bot_token) botInfo = await getMe() } catch (e) { botInfo = { error: e.message } }
        try { if (settings.telegram_bot_token) webhookInfo = await getWebhookInfo() } catch (e) { webhookInfo = { error: e.message } }
        return ok({
          bot_token_set: !!settings.telegram_bot_token,
          bot_token_masked: settings.telegram_bot_token ? maskKey(settings.telegram_bot_token) : '',
          admin_chat_id: settings.telegram_admin_chat_id || '',
          webhook_secret_set: !!settings.telegram_webhook_secret,
          webhook_registered_at: settings.webhook_registered_at || null,
          expected_webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/telegram/webhook`,
          bot: botInfo,
          webhook: webhookInfo,
        })
      }

      if (sub === 'settings' && method === 'PUT') {
        const body = await request.json()
        const patch = {}
        if (body.bot_token && body.bot_token.trim()) patch.telegram_bot_token = body.bot_token.trim()
        if (body.admin_chat_id !== undefined) patch.telegram_admin_chat_id = String(body.admin_chat_id || '').trim()
        await storage.settings.patch(patch)
        return ok(true)
      }

      if (sub === 'register' && method === 'POST') {
        const settings = await storage.settings.get()
        if (!settings.telegram_bot_token) return err('Bot token not set. Save token in Settings first.')
        const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/telegram/webhook`
        const result = await setWebhook({ url, secret: settings.telegram_webhook_secret })
        await storage.settings.patch({ webhook_registered_at: new Date().toISOString() })
        return ok({ url, result })
      }

      if (sub === 'unregister' && method === 'POST') {
        const result = await deleteWebhook()
        await storage.settings.patch({ webhook_registered_at: null })
        return ok(result)
      }

      if (sub === 'test' && method === 'POST') {
        const s = await storage.settings.get()
        if (!s.telegram_admin_chat_id) return err('Admin chat id not set. Send /start to your bot first, or set it in Settings.')
        const sent = await sendMessage({
          chatId: s.telegram_admin_chat_id,
          text: '\u2705 SocialForge is connected. Send /help to see commands.',
        })
        return ok({ message_id: sent.message_id })
      }

      if (sub === 'send-draft' && method === 'POST') {
        const body = await request.json()
        const job = await storage.jobs.get(body.jobId)
        if (!job) return err('Job not found', 404)
        const sent = await sendDraftToAdmin(job)
        return ok({ message_id: sent.message_id })
      }
    }

    // --- Upload image (Supabase Storage public bucket) ---------------------
    if (resource === 'upload' && method === 'POST') {
      const body = await request.json()
      if (!body.base64) return err('Missing base64')
      const r = await uploadBase64Image(body.base64, body.mime_type || 'image/jpeg')
      return ok(r)
    }

    // --- Publish (real) ----------------------------------------------------
    if (resource === 'publish') {
      if (method === 'POST' && id === 'sweep') {
        const settings = await storage.settings.get()
        if (settings.kill_switch) return ok({ skipped: 'kill_switch_active' })
        const r = await publishSweep()
        await storage.audit.log('publish_sweep', 'automation', 'tick', null, r.status || 'completed')
        return ok(r)
      }
      if (method === 'POST' && id) {
        const settings = await storage.settings.get()
        if (settings.kill_switch) return err('Global kill switch is active')
        const job = await storage.jobs.get(id)
        if (!job) return err('Job not found', 404)
        const body = await request.json().catch(() => ({}))
        const r = await publishJob(job, { platforms: body.platforms, dryRun: body.dry_run === true })
        return ok(r)
      }
      if (method === 'GET' && id === 'platforms') {
        return ok({ supported: SUPPORTED_PLATFORMS })
      }
    }

    // --- Automation modules ------------------------------------------------
    if (resource === 'automation') {
      if (id === 'modules' && method === 'GET') {
        return ok(await aiModules.list())
      }
      // /api/automation/module/:key
      if (id === 'module' && action && method === 'PUT') {
        const body = await request.json()
        return ok(await aiModules.update(action, body))
      }
      if (id === 'module' && action && method === 'POST') {
        // /api/automation/module/:key/run
        const nextSeg = parts[3]
        if (nextSeg === 'run') {
          const body = await request.json()
          const out = await runModule(action, body)
          return ok({ result: out })
        }
      }
    }

    // --- Platform prompts --------------------------------------------------
    if (resource === 'platform-prompts') {
      if (method === 'GET' && !id) {
        const list = await platformPrompts.list()
        const map = Object.fromEntries(list.map(r => [r.platform, r]))
        // Seed defaults for any missing platform
        const out = {}
        for (const [platform, tpl] of Object.entries(DEFAULT_PLATFORM_PROMPTS)) {
          out[platform] = map[platform] || { platform, prompt_template: tpl, settings: {} }
        }
        return ok(out)
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        await platformPrompts.upsert(id, {
          prompt_template: body.prompt_template || '',
          settings: body.settings || {},
        })
        return ok(true)
      }
    }

    // --- Intake (Supabase Storage bucket + media queue) ------------------
    if (resource === 'intake') {
      if (id === 'upload' && method === 'POST') {
        const body = await request.json()
        if (!body.base64) return err('Missing base64')
        const r = await uploadIntakeImage(body.base64, body.mime_type || 'image/jpeg', body.file_name)
        return ok(r)
      }
      if (id === 'sync' && method === 'POST') {
        return ok(await syncIntakeToQueue())
      }
      if (id === 'list' && method === 'GET') {
        return ok(await listIntakeFiles())
      }
      if (id === 'queue' && method === 'GET') {
        const status = url.searchParams.get('status')
        return ok(await listQueue(status))
      }
      if (id === 'stats' && method === 'GET') {
        return ok(await queueStats())
      }
      if (id === 'signed-url' && method === 'GET') {
        const path = url.searchParams.get('path')
        if (!path) return err('Missing path')
        const { getSignedIntakeUrl } = await import('@/lib/intake')
        const signedUrl = await getSignedIntakeUrl(path, 60 * 60)
        return ok({ url: signedUrl })
      }
    }

    // --- Analytics --------------------------------------------------------
    if (resource === 'analytics') {
      if (id === 'fetch' && method === 'POST') {
        return ok(await fetchAllStats())
      }
      if (id === 'stats' && method === 'GET') {
        return ok(await getAggregatedStats())
      }
      if (id === 'digest' && method === 'POST') {
        const a = await automation.get()
        const provided = request.headers.get('x-analytics-secret')
        if (a.tick_secret && provided !== a.tick_secret) return err('Forbidden', 403)
        return ok(await generateReport('daily'))
      }
      if (id === 'posts' && method === 'GET') {
        return ok(await getPostAnalytics())
      }
      if (id === 'hashtags' && method === 'GET') {
        return ok(await getHashtagAnalytics())
      }
      if (id === 'coach' && method === 'GET') {
        return ok(await getCoachInsights())
      }
      if (id === 'report' && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        return ok(await generateReport(body.type || 'daily'))
      }
    }

    // --- UTM analytics -----------------------------------------------
    if (resource === 'analytics' && id === 'utm' && method === 'GET') {
      const sb = (await import('@/lib/supabase')).supabase()
      const { data: details } = await sb.from('post_details').select('job_id, platform, caption, impressions, likes, comments, shares')
        .like('caption', '%utm_source=socialforge%').order('checked_at', { ascending: false }).limit(100)
      const results = (details || []).map(d => {
        const match = d.caption?.match(/utm_source=socialforge&utm_medium=([^&]+)&utm_campaign=([^&\s]+)/)
        return {
          job_id: d.job_id, platform: d.platform,
          utm_medium: match?.[1] || '', utm_campaign: match?.[2] || '',
          impressions: d.impressions, likes: d.likes, comments: d.comments, shares: d.shares,
        }
      })
      return ok(results)
    }

    // --- News (Breaking News Radar) --------------------------------------
    if (resource === 'news') {
      // Sources
      if (id === 'sources' && method === 'GET') {
        return ok(await storage.newsSources.list())
      }
      if (id === 'sources' && method === 'POST') {
        const body = await request.json()
        return ok(await storage.newsSources.create(body))
      }
      if (id && action === 'source') {
        if (method === 'PUT') return ok(await storage.newsSources.update(id, await request.json()))
        if (method === 'DELETE') { await storage.newsSources.remove(id); return ok({}) }
      }
      if (id === 'check' && method === 'POST') {
        return ok(await runNewsCheck())
      }
      if (id === 'seed' && method === 'POST') {
        const { seedNewsSources } = await import('@/lib/news/seed')
        return ok(await seedNewsSources())
      }
      // Posts
      if (!action && (!id || id === 'all')) {
        if (method === 'GET') {
          const status = request.nextUrl.searchParams.get('status')
          return ok(await storage.newsPosts.list(status))
        }
      }
      if (id && !action && method === 'GET') {
        return ok(await storage.newsPosts.get(id))
      }
      if (id && !action && method === 'PUT') {
        return ok(await storage.newsPosts.update(id, await request.json()))
      }
      if (id && !action && method === 'DELETE') {
        await storage.newsPosts.remove(id); return ok({})
      }
      if (id === 'generate' && method === 'POST') {
        const body = await request.json()
        return ok(await generateAndSave(body.news_id))
      }
      if (id === 'conflicts' && method === 'POST') {
        const body = await request.json()
        return ok(await detectConflicts({ platform: body.platform, scheduledFor: body.scheduled_for, excludeNewsId: body.exclude_id }))
      }
      if (id === 'next-slot' && method === 'POST') {
        const body = await request.json()
        return ok(await findNextSlot({ platform: body.platform, after: body.after }))
      }
      if (id === 'publish' && method === 'POST') {
        const body = await request.json()
        const newsItem = await storage.newsPosts.get(body.news_id)
        if (!newsItem) return err('News post not found', 404)
        if (!newsItem.generated_posts) return err('No AI-generated posts — run generate first', 400)
        const { publishJob } = await import('@/lib/publishers')
        // Build a temporary content_job shape and publish
        const tempJob = {
          id: `news_${newsItem.id}`,
          platform_posts: newsItem.generated_posts,
          image_ref: newsItem.image_url,
          publish_results: {},
          warnings: [],
        }
        const r = await publishJob(tempJob, { platforms: body.platforms || Object.keys(newsItem.generated_posts) })
        await storage.newsPosts.update(newsItem.id, {
          status: r.results.some(rr => rr.ok) ? 'published' : 'failed',
          published_at_actual: new Date().toISOString(),
          publish_results: tempJob.publish_results,
          conflict_warning: null,
        })
        return ok(r)
      }
    }

    // --- Comments ---------------------------------------------------------
    if (resource === 'comments') {
      if (method === 'GET' && !id) {
        return ok(await storage.comments.list())
      }
      if (method === 'POST' && id === 'fetch') {
        return ok(await fetchAllComments())
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        return ok(await storage.comments.update(id, body))
      }
      if (method === 'POST' && id && action === 'reply') {
        const body = await request.json()
        if (!body.reply_text) return err('Missing reply_text')
        return ok(await replyToComment(id, body.reply_text))
      }
      if (method === 'POST' && id && action === 'to-idea') {
        const comment = await storage.comments.get(id)
        if (!comment) return err('Comment not found', 404)
        return ok({ text: comment.comment_text || comment.dm_content || '', platform: comment.platform })
      }
    }

    // --- Blog (long-form articles for Hashnode) -------------------------
    if (resource === 'blog') {
      if (id === 'generate' && method === 'POST') {
        const body = await request.json()
        return ok(await generateBlogPost({
          imageBase64: body.image_base64,
          mimeType: body.mime_type,
          context: body.context,
          styleId: body.style_id,
        }))
      }
      if (id === 'posts' && !action && method === 'GET') {
        const status = url.searchParams.get('status')
        return ok(await storage.blogPosts.list(status))
      }
      if (id === 'posts' && !action && method === 'POST') {
        return ok(await storage.blogPosts.create(await request.json()))
      }
      if (action === 'posts' && method === 'GET') {
        return ok(await storage.blogPosts.get(id))
      }
      if (action === 'posts' && method === 'PUT') {
        return ok(await storage.blogPosts.update(id, await request.json()))
      }
      if (action === 'posts' && method === 'DELETE') {
        await storage.blogPosts.remove(id); return ok({})
      }
      if (id === 'publish' && action && method === 'POST') {
        const body = await request.json()
        const { publishBlogPost } = await import('@/lib/publishers')
        const blog = await storage.blogPosts.get(action)
        if (!blog) return err('Blog post not found', 404)
        const dryRun = body.dry_run === true
        try {
          const result = await publishBlogPost(blog, { dryRun })
          if (!dryRun) {
            await storage.blogPosts.update(blog.id, {
              status: 'published', published_url: result.url, published_at: new Date().toISOString(),
            })
          }
          return ok(result)
        } catch (e) {
          await storage.blogPosts.update(blog.id, { status: 'failed', publish_error: e.message })
          return err(e.message, 400)
        }
      }
    }

    // --- Campaigns (Bulk Post Creator) -----------------------------------
    if (resource === 'campaigns') {
      if (method === 'GET' && !id) return ok(await storage.campaigns.list())
      if (method === 'GET' && id) {
        const c = await storage.campaigns.get(id)
        return c ? ok(c) : err('Not found', 404)
      }
      if (method === 'POST' && !id) return ok(await storage.campaigns.create(await request.json()))
      if (method === 'PUT' && id) return ok(await storage.campaigns.update(id, await request.json()))
      if (method === 'DELETE' && id) { await storage.campaigns.remove(id); return ok({}) }
    }

    // --- Generate (AI content generation) --------------------------------
    if (resource === 'generate') {
      if (id === 'bulk' && method === 'POST') {
        const body = await request.json()
        return ok(await generateBulk(body))
      }
    }

    // --- Automation settings + tick ---------------------------------------
    if (resource === 'automation') {
      if (id === 'settings' && method === 'GET') {
        return ok(await automation.get())
      }
      if (id === 'settings' && method === 'PUT') {
        const body = await request.json()
        // Never let client change tick_secret via this API
        delete body.tick_secret
        return ok(await automation.patch(body))
      }
      if (id === 'tick' && method === 'POST') {
        // Verify shared secret
        const s = await automation.get()
        const provided = request.headers.get('x-automation-secret')
        if (s.tick_secret && provided !== s.tick_secret) {
          return err('Forbidden', 403)
        }
        const r = await runTick()
        return ok(r)
      }
      // Queue management endpoints
      if (id === 'queue' && method === 'GET') {
        const status = url.searchParams.get('status')
        const { listQueue } = await import('@/lib/intake')
        return ok(await listQueue(status))
      }
      if (id === 'retry' && action && method === 'POST') {
        return ok(await retryFailed(action))
      }
      if (id === 'bulk' && method === 'POST') {
        const body = await request.json()
        return ok(await bulkAction(body.fileIds || [], body.action))
      }
      if (id === 'reorder' && method === 'POST') {
        const body = await request.json()
        return ok(await reorderQueue(body.fileIds || []))
      }
      if (id === 'activity' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50', 10)
        return ok(await getActivityFeed(limit))
      }
      if (id === 'queue-settings' && method === 'PUT') {
        const body = await request.json()
        return ok(await automation.patch(body))
      }
      if (id === 'sync' && method === 'POST') {
        const { syncIntakeToQueue } = await import('@/lib/intake')
        return ok(await syncIntakeToQueue())
      }
    }

    // --- Hashtag sets ----------------------------------------------------
    if (resource === 'hashtag-sets') {
      if (method === 'GET' && !id) return ok(await storage.hashtagSets.list())
      if (method === 'POST' && !id) return ok(await storage.hashtagSets.create(await request.json()))
      if (method === 'GET' && id) { const h = await storage.hashtagSets.get(id); return h ? ok(h) : err('Not found', 404) }
      if (method === 'PUT' && id) return ok(await storage.hashtagSets.update(id, await request.json()))
      if (method === 'DELETE' && id) { await storage.hashtagSets.remove(id); return ok({}) }
    }

    // --- Channel groups --------------------------------------------------
    if (resource === 'channel-groups') {
      if (method === 'GET' && !id) return ok(await storage.channelGroups.list())
      if (method === 'POST' && !id) return ok(await storage.channelGroups.create(await request.json()))
      if (method === 'GET' && id) { const c = await storage.channelGroups.get(id); return c ? ok(c) : err('Not found', 404) }
      if (method === 'PUT' && id) return ok(await storage.channelGroups.update(id, await request.json()))
      if (method === 'DELETE' && id) { await storage.channelGroups.remove(id); return ok({}) }
    }

    // --- Calendar (aggregated scheduled items) ---------------------------
    if (resource === 'calendar' && method === 'GET') {
      const [jobs, blogs] = await Promise.all([
        storage.jobs.list({ status: 'scheduled' }),
        storage.blogPosts.list('published'),
      ])
      const items = [
        ...jobs.filter(j => j.scheduled_for).map(j => ({
          id: j.id, type: 'content_job', title: j.topic || 'Untitled',
          scheduled_for: j.scheduled_for, platform_posts: j.platform_posts,
          image_ref: j.image_ref, status: j.status,
        })),
        ...blogs.filter(b => b.published_at).map(b => ({
          id: b.id, type: 'blog_post', title: b.title || 'Untitled',
          scheduled_for: b.published_at, platform_posts: { hashnode: { caption: b.seo_description || '' } },
          image_ref: b.cover_image_url, status: b.status,
        })),
      ].sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
      return ok(items)
    }

    // --- Best-time-to-post -----------------------------------------------
    if (resource === 'best-times') {
      if (id === 'compute' && method === 'POST') return ok(await storage.bestTimes.compute())
      if (id && method === 'GET') {
        const times = await storage.bestTimes.getByPlatform(id)
        return ok(times.length > 0 ? times : { fallback: true, slots: ['09:00', '12:00', '17:00'] })
      }
    }

    // --- Bulk jobs -------------------------------------------------------
    if (resource === 'jobs' && id === 'bulk' && method === 'POST') {
      const body = await request.json()
      if (!Array.isArray(body.jobs)) return err('jobs must be an array')
      const results = []
      for (const item of body.jobs) {
        try {
          if (item.image_base64) {
            try {
              const up = await uploadBase64Image(item.image_base64, item.image_mime || 'image/jpeg')
              item.image_ref = up.url
            } catch (e) { console.warn('[bulk] upload failed:', e.message) }
            delete item.image_base64; delete item.image_mime
          }
          const created = await storage.jobs.create({
            source: item.source || 'bulk', topic: item.topic || '',
            platform_posts: item.platform_posts || {}, status: item.status || 'draft',
            scheduled_for: item.scheduled_for || null, image_ref: item.image_ref || null,
            campaign_id: item.campaign_id || null,
          })
          results.push({ ok: true, id: created.id })
        } catch (e) { results.push({ ok: false, error: e.message }) }
      }
      return ok({ total: body.jobs.length, succeeded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results })
    }

    // --- Reports export --------------------------------------------------
    if (resource === 'reports' && id === 'export' && method === 'GET') {
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      if (!from || !to) return err('from and to params required')
      // Aggregate data
      const sb = (await import('@/lib/supabase')).supabase()
      const [statsRes, hashtagRes, detailsRes, postsRes] = await Promise.all([
        sb.from('post_stats').select('*').gte('checked_at', from).lte('checked_at', to),
        sb.from('hashtag_stats').select('*').order('total_impressions', { ascending: false }).limit(10),
        sb.from('post_details').select('*').gte('checked_at', from).lte('checked_at', to),
        sb.from('content_jobs').select('id,topic,published_at,publish_results').eq('status', 'published').gte('published_at', from).lte('published_at', to),
      ])
      const stats = statsRes.data || []
      const hashtags = hashtagRes.data || []
      const details = detailsRes.data || []
      const posts = postsRes.data || []
      // Compute top by engagement
      const topPosts = [...posts].sort((a, b) => {
        const aEng = Object.values(a.publish_results || {}).reduce((s, r) => s + (r.impressions || 0), 0)
        const bEng = Object.values(b.publish_results || {}).reduce((s, r) => s + (r.impressions || 0), 0)
        return bEng - aEng
      }).slice(0, 5)
      // Engagement by platform
      const byPlatform = {}
      for (const d of details) {
        if (!byPlatform[d.platform]) byPlatform[d.platform] = { impressions: 0, likes: 0, comments: 0, shares: 0 }
        byPlatform[d.platform].impressions += d.impressions || 0
        byPlatform[d.platform].likes += d.likes || 0
        byPlatform[d.platform].comments += d.comments || 0
        byPlatform[d.platform].shares += d.shares || 0
      }
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SocialForge Report</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:auto;padding:40px 20px;color:#1c1917}h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:32px;margin-bottom:12px;border-bottom:2px solid #e7e5e4;padding-bottom:6px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}.card{background:#f5f5f4;border-radius:8px;padding:12px}.num{font-size:20px;font-weight:700;color:#7c3aed}.label{font-size:11px;color:#78716c;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:6px 8px;background:#f5f5f4;border-bottom:2px solid #e7e5e4}td{padding:6px 8px;border-bottom:1px solid #e7e5e4}.footer{margin-top:40px;font-size:10px;color:#a8a29e;text-align:center}</style></head><body>
<h1>SocialForge — Performance Report</h1>
<p style="color:#78716c;font-size:13px">${from} → ${to}</p>
<div class="grid"><div class="card"><div class="num">${posts.length}</div><div class="label">Posts Published</div></div>
<div class="card"><div class="num">${stats.reduce((s, r) => s + (r.impressions || 0), 0).toLocaleString()}</div><div class="label">Total Impressions</div></div>
<div class="card"><div class="num">${stats.reduce((s, r) => s + (r.likes || 0) + (r.comments || 0) + (r.shares || 0), 0).toLocaleString()}</div><div class="label">Total Engagement</div></div>
<div class="card"><div class="num">${hashtags.length}</div><div class="label">Tracked Hashtags</div></div></div>
<h2>Top Posts</h2>${topPosts.length === 0 ? '<p style="color:#a8a29e;font-size:13px">No published posts in this period.</p>' : '<table><tr><th>Post</th><th>Published</th></tr>' + topPosts.map(p => '<tr><td>' + (p.topic || 'Untitled') + '</td><td>' + (p.published_at ? new Date(p.published_at).toLocaleDateString() : '—') + '</td></tr>').join('') + '</table>'}
<h2>Top Hashtags</h2>${hashtags.length === 0 ? '<p style="color:#a8a29e;font-size:13px">No hashtag data yet.</p>' : '<table><tr><th>Tag</th><th>Impressions</th><th>Engagement</th></tr>' + hashtags.map(h => '<tr><td>' + h.tag + '</td><td>' + (h.total_impressions || 0).toLocaleString() + '</td><td>' + (h.total_engagement || 0).toLocaleString() + '</td></tr>').join('') + '</table>'}
<h2>Engagement by Platform</h2>${Object.keys(byPlatform).length === 0 ? '<p style="color:#a8a29e;font-size:13px">No platform data yet.</p>' : '<table><tr><th>Platform</th><th>Impressions</th><th>Likes</th><th>Comments</th><th>Shares</th></tr>' + Object.entries(byPlatform).map(([p, d]) => '<tr><td>' + p + '</td><td>' + d.impressions.toLocaleString() + '</td><td>' + d.likes.toLocaleString() + '</td><td>' + d.comments.toLocaleString() + '</td><td>' + d.shares.toLocaleString() + '</td></tr>').join('') + '</table>'}
<div class="footer">Generated by SocialForge on ${new Date().toISOString()}</div></body></html>`
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // --- Engagement inbox (unified comments + DMs + reactions) -----------
    if (resource === 'engagement') {
      if (method === 'GET' && !id) {
        const status = url.searchParams.get('status')
        const type = url.searchParams.get('type')
        return ok(await storage.engagement.list({ status, type }))
      }
      if (method === 'POST' && id === 'fetch') {
        return ok(await storage.engagement.fetchAll())
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        return ok(await storage.engagement.update(id, body))
      }
      if (method === 'POST' && id === 'auto-reply' && action) {
        // Auto-generate draft reply using rewriter module
        const item = await storage.engagement.get(action)
        if (!item) return err('Engagement item not found', 404)
        const { runModule } = await import('@/lib/ai/modules')
        const reply = await runModule('rewriter', {
          mode: 'reply', target: 'professional response',
          context: item.comment_text || item.dm_content || '',
        }).catch(() => null)
        if (reply) {
          await storage.engagement.update(item.id, { draft_reply: reply })
          return ok({ draft_reply: reply })
        }
        return err('Could not generate reply', 400)
      }
    }

    // --- App settings (main) -----------------------------------------------
    if (resource === 'settings') {
      if (method === 'GET') return ok(await storage.settings.get())
      if (method === 'PATCH') {
        const body = await request.json()
        return ok(await storage.settings.patch(body))
      }
    }

    // --- Audit log ---------------------------------------------------------
    if (resource === 'audit' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)
      return ok(await storage.audit.list(limit))
    }

    // --- Seasonal Intelligence Engine (replaces observance) ----------------
    if (resource === 'seasonal') {
      if (method === 'GET' && !id) return ok(await storage.seasonal.list(url.searchParams.get('status')))
      if (method === 'GET' && id === 'settings') {
        const { getSeasonalSettings } = await import('@/lib/seasonal-engine')
        return ok(await getSeasonalSettings())
      }
      if (method === 'GET' && id) {
        const item = await storage.seasonal.get(id)
        return item ? ok(item) : err('Not found', 404)
      }
      if (method === 'POST' && id === 'detect') {
        const { detectUpcomingEvents } = await import('@/lib/seasonal-engine')
        const body = await request.json().catch(() => ({}))
        return ok(await detectUpcomingEvents(body.daysAhead || 14, body.userSettings || {}))
      }
      if (method === 'POST' && id === 'generate') {
        const body = await request.json()
        const { generateSeasonalDraft } = await import('@/lib/seasonal-engine')
        return ok(await generateSeasonalDraft(body.event, body.context || {}))
      }
      if (method === 'POST' && id === 'settings') {
        const body = await request.json()
        const { saveSeasonalSettings } = await import('@/lib/seasonal-engine')
        return ok(await saveSeasonalSettings(body))
      }
      if (method === 'PUT' && id) {
        const body = await request.json()
        return ok(await storage.seasonal.update(id, body))
      }
      if (method === 'DELETE' && id) {
        await storage.seasonal.remove(id)
        return ok({})
      }
    }

    // --- Blog drip mode (one-asset-into-many) --------------------
    if (resource === 'blog' && id === 'drip' && method === 'POST') {
      const body = await request.json()
      const { generateDripPosts } = await import('@/lib/ai/drip')
      const result = await generateDripPosts(body.blog_id, body.count || 4, body.spread_days || 5)
      return ok(result)
    }

    // --- Branded PDF report (print-to-PDF) ----------------------
    if (resource === 'reports' && id === 'export-pdf' && method === 'GET') {
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      if (!from || !to) return err('from and to params required')
      const sb = (await import('@/lib/supabase')).supabase()
      const [statsRes, hashtagRes, detailsRes, postsRes] = await Promise.all([
        sb.from('post_stats').select('*').gte('checked_at', from).lte('checked_at', to),
        sb.from('hashtag_stats').select('*').order('total_impressions', { ascending: false }).limit(10),
        sb.from('post_details').select('*').gte('checked_at', from).lte('checked_at', to),
        sb.from('content_jobs').select('id,topic,published_at,publish_results,platform_posts').eq('status', 'published').gte('published_at', from).lte('published_at', to),
      ])
      const stats = statsRes.data || []
      const hashtags = hashtagRes.data || []
      const details = detailsRes.data || []
      const posts = postsRes.data || []

      const totalImpressions = stats.reduce((s, r) => s + (r.impressions || 0), 0)
      const totalLikes = stats.reduce((s, r) => s + (r.likes || 0), 0)
      const totalComments = stats.reduce((s, r) => s + (r.comments || 0), 0)
      const totalShares = stats.reduce((s, r) => s + (r.shares || 0), 0)

      const byPlatform = {}
      for (const d of details) {
        if (!byPlatform[d.platform]) byPlatform[d.platform] = { impressions: 0, likes: 0, comments: 0, shares: 0 }
        byPlatform[d.platform].impressions += d.impressions || 0
        byPlatform[d.platform].likes += d.likes || 0
        byPlatform[d.platform].comments += d.comments || 0
        byPlatform[d.platform].shares += d.shares || 0
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SocialForge — Performance Report</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #1C1A17; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 3px solid #2E5339; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-family: Georgia, serif; font-size: 28px; color: #2E5339; }
  .header .subtitle { font-size: 12px; color: #8A8477; margin-top: 4px; }
  .logo { font-family: Georgia, serif; font-size: 18px; font-weight: bold; color: #2E5339; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #FAF7F0; border-radius: 6px; padding: 12px; text-align: center; }
  .stat .num { font-size: 24px; font-weight: 700; color: #2E5339; }
  .stat .label { font-size: 10px; color: #8A8477; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  h2 { font-family: Georgia, serif; font-size: 16px; margin: 20px 0 10px; color: #2E5339; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th { text-align: left; padding: 6px 8px; background: #FAF7F0; border-bottom: 2px solid #e7e5e4; font-size: 10px; text-transform: uppercase; color: #8A8477; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0ebe3; }
  .footer { margin-top: 32px; font-size: 9px; color: #a8a29e; text-align: center; border-top: 1px solid #e7e5e4; padding-top: 12px; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <div class="logo">SocialForge</div>
  <h1>Performance Report</h1>
  <div class="subtitle">${from} to ${to}</div>
</div>
<div class="stats">
  <div class="stat"><div class="num">${posts.length}</div><div class="label">Posts Published</div></div>
  <div class="stat"><div class="num">${totalImpressions.toLocaleString()}</div><div class="label">Impressions</div></div>
  <div class="stat"><div class="num">${(totalLikes + totalComments + totalShares).toLocaleString()}</div><div class="label">Total Engagement</div></div>
  <div class="stat"><div class="num">${hashtags.length}</div><div class="label">Tracked Hashtags</div></div>
</div>
<h2>Engagement by Platform</h2>
<table><tr><th>Platform</th><th>Impressions</th><th>Likes</th><th>Comments</th><th>Shares</th></tr>
${Object.entries(byPlatform).map(([p, d]) => `<tr><td>${p}</td><td>${d.impressions.toLocaleString()}</td><td>${d.likes.toLocaleString()}</td><td>${d.comments.toLocaleString()}</td><td>${d.shares.toLocaleString()}</td></tr>`).join('')}
</table>
<h2>Top Hashtags</h2>
<table><tr><th>Tag</th><th>Impressions</th><th>Engagement</th></tr>
${hashtags.map(h => `<tr><td>${h.tag}</td><td>${(h.total_impressions || 0).toLocaleString()}</td><td>${(h.total_engagement || 0).toLocaleString()}</td></tr>`).join('')}
</table>
<div class="footer">Generated by SocialForge on ${new Date().toLocaleDateString()} — Confidential</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // --- Social listening mentions ---------------------------
    if (resource === 'mentions') {
      if (method === 'GET') {
        const { listMentions } = await import('@/lib/mentions')
        return ok(await listMentions())
      }
      if (method === 'POST' && id === 'check') {
        const { checkMentions } = await import('@/lib/mentions')
        return ok(await checkMentions())
      }
    }

    // --- Blog Automation Engine (independent from social) ---
    if (resource === 'blog') {
      if (id === 'tick' && method === 'POST') {
        const { blogAutomation, runBlogTick } = await import('@/lib/blog/automation')
        const s = await blogAutomation.get()
        const provided = request.headers.get('x-automation-secret')
        if (s.tick_secret && provided !== s.tick_secret) return err('Forbidden', 403)
        return ok(await runBlogTick())
      }
      if (id === 'settings' && method === 'GET') {
        const { blogAutomation } = await import('@/lib/blog/automation')
        return ok(await blogAutomation.get())
      }
      if (id === 'settings' && method === 'PUT') {
        const { blogAutomation } = await import('@/lib/blog/automation')
        const body = await request.json()
        delete body.tick_secret
        return ok(await blogAutomation.patch(body))
      }
      if (id === 'sync' && method === 'POST') {
        const { syncBlogToQueue } = await import('@/lib/blog/intake')
        return ok(await syncBlogToQueue())
      }
      if (id === 'upload' && method === 'POST') {
        const body = await request.json()
        if (!body.base64) return err('Missing base64')
        const { uploadBlogImage } = await import('@/lib/blog/intake')
        return ok(await uploadBlogImage(body.base64, body.mime_type || 'image/jpeg', body.file_name))
      }
      if (id === 'queue' && method === 'GET') {
        const status = url.searchParams.get('status')
        const { listBlogQueue } = await import('@/lib/blog/intake')
        return ok(await listBlogQueue(status))
      }
      if (id === 'stats' && method === 'GET') {
        const { blogQueueStats } = await import('@/lib/blog/intake')
        return ok(await blogQueueStats())
      }
      if (id === 'signed-url' && method === 'GET') {
        const path = url.searchParams.get('path')
        if (!path) return err('Missing path')
        const { getSignedBlogUrl } = await import('@/lib/blog/intake')
        const signedUrl = await getSignedBlogUrl(path, 60 * 60)
        return ok({ url: signedUrl })
      }
      if (id === 'activity' && method === 'GET') {
        const { getBlogActivity } = await import('@/lib/blog/automation')
        const limit = parseInt(url.searchParams.get('limit') || '50', 10)
        return ok(await getBlogActivity(limit))
      }
      if (id === 'bulk' && method === 'POST') {
        const { blogBulkAction } = await import('@/lib/blog/automation')
        const body = await request.json()
        return ok(await blogBulkAction(body.fileIds || [], body.action))
      }
      if (id === 'reorder' && method === 'POST') {
        const { blogReorderQueue } = await import('@/lib/blog/automation')
        const body = await request.json()
        return ok(await blogReorderQueue(body.fileIds || []))
      }
    }

    // --- Backup export -----------------------------------------
    if (resource === 'backup') {
      if (id === 'export' && method === 'GET') {
        const { exportAllData } = await import('@/lib/backup')
        const data = await exportAllData()
        return new NextResponse(JSON.stringify(data, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="socialforge-backup-${new Date().toISOString().split('T')[0]}.json"`,
          },
        })
      }
    }

    // --- Benchmarking -------------------------------------------
    if (resource === 'benchmarking') {
      if (id === 'peers' && method === 'GET') {
        const { checkPeers } = await import('@/lib/benchmarking')
        return ok(await checkPeers())
      }
      if (id === 'gap' && method === 'GET') {
        const { getPostingGap } = await import('@/lib/benchmarking')
        return ok(await getPostingGap())
      }
    }

    // --- Public approval (no auth required) --------------------
    if (resource === 'approve' && method === 'GET') {
      const jobId = url.searchParams.get('job')
      if (!jobId) return err('Missing job parameter')
      const job = await storage.jobs.get(jobId)
      if (!job) return err('Job not found', 404)
      return ok({ id: job.id, topic: job.topic, status: job.status, platform_posts: job.platform_posts })
    }
    if (resource === 'approve' && method === 'POST') {
      const body = await request.json()
      if (!body.job_id || !body.action) return err('Missing job_id or action')
      const job = await storage.jobs.get(body.job_id)
      if (!job) return err('Job not found', 404)
      if (body.action === 'approve') {
        await storage.jobs.update(body.job_id, { status: 'approved' })
        return ok({ approved: true })
      }
      if (body.action === 'reject') {
        await storage.jobs.update(body.job_id, { status: 'rejected' })
        return ok({ rejected: true })
      }
      return err('Invalid action')
    }

    return err(`No route for ${method} /${parts.join('/')}`, 404)

  } catch (e) {
    console.error('[api] error:', e)
    return err(e?.message || 'Server error', 500)
  }
}

function sanitize(p) {
  if (!p) return p
  return { ...p, api_key: p.api_key ? maskKey(p.api_key) : '', api_key_set: !!p.api_key }
}
function maskKey(k) {
  if (!k) return ''
  if (k.length <= 8) return '*'.repeat(k.length)
  return k.slice(0, 4) + '•'.repeat(Math.max(4, k.length - 8)) + k.slice(-4)
}

export const GET    = (req) => route(req, 'GET')
export const POST   = (req) => route(req, 'POST')
export const PUT    = (req) => route(req, 'PUT')
export const DELETE = (req) => route(req, 'DELETE')
export const PATCH  = (req) => route(req, 'PATCH')
