import { storage } from '../storage'
import { sendMessage, editMessageText, answerCallbackQuery, sendPhoto, editMessageCaption, editMessageReplyMarkup } from './client'
import { formatDraftMessage, buildJobKeyboard, formatHelp, formatAutomationJobMessage, buildAutomationJobKeyboard } from './formatter'
import { regeneratePlatform, generateFromImage } from '../ai/generate'
import { publishJob } from '../publishers'
import { runModule } from '../ai/modules'
import { onApprove, onSkip, onReject, onPublishNow } from '../automation'
import { supabase } from '../supabase'

const PLATFORM_KEYS = ['linkedin', 'instagram', 'facebook', 'threads']

export async function handleUpdate(update) {
  try {
    if (update.callback_query) return await handleCallback(update.callback_query)
    if (update.message) return await handleMessage(update.message)
  } catch (e) {
    console.error('[telegram] handler error:', e)
    try {
      const chatId = update?.callback_query?.message?.chat?.id || update?.message?.chat?.id
      if (chatId) await sendMessage({ chatId, text: `⚠️ Error: <code>${(e.message || e).toString().slice(0, 300)}</code>` })
      if (update.callback_query?.id) await answerCallbackQuery({ callbackQueryId: update.callback_query.id, text: 'Error — see chat' })
    } catch (_) {}
  }
}

async function handleMessage(msg) {
  const text = (msg.text || '').trim()
  const chatId = msg.chat?.id
  if (!text || !chatId) return

  const s = await storage.settings.get()
  const admin = String(s.telegram_admin_chat_id || '')
  if (admin && String(chatId) !== admin) {
    await sendMessage({ chatId, text: '🔒 This bot is private. Contact the admin.' })
    return
  }

  if (text.startsWith('/start')) {
    if (!s.telegram_admin_chat_id) await storage.settings.patch({ telegram_admin_chat_id: String(chatId) })
    await sendMessage({ chatId, text: `👋 Hi, I'm <b>SocialForge</b>. This chat is now the control surface. Send /help to see what I can do.` })
    return
  }

  if (text.startsWith('/help')) { await sendMessage({ chatId, text: formatHelp() }); return }

  if (text.startsWith('/queue-manual')) {
    const jobs = (await storage.jobs.list()).filter(j => (j.source === 'ai_manual' || j.source === 'compose') && j.status !== 'published')
    if (jobs.length === 0) { await sendMessage({ chatId, text: '✍️ No manual posts in queue.' }); return }
    await sendMessage({ chatId, text: `✍️ Manual posts: <b>${jobs.length}</b>` })
    for (const j of jobs.slice(0, 5)) { await sendMessage({ chatId, text: formatDraftMessage(j), replyMarkup: buildJobKeyboard(j) }) }
    return
  }

  if (text.startsWith('/queue-social')) {
    const sb = supabase()
    const { data: items } = await sb.from('drive_queue').select('*').in('status', ['queued', 'processing', 'pending_approval', 'failed']).order('queue_position', { ascending: true }).limit(10)
    if (!items || items.length === 0) { await sendMessage({ chatId, text: '📸 No social automation items in queue.' }); return }
    await sendMessage({ chatId, text: `📸 Social queue: <b>${items.length}</b> items` })
    for (const item of items) { await sendMessage({ chatId, text: `<b>${item.file_name}</b>\nStatus: ${item.status}\n#${item.queue_position}`, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skip', callback_data: `skip:${item.file_id}` }]] } }) }
    return
  }

  if (text.startsWith('/queue-news')) {
    const news = await storage.newsPosts.list('pending_approval')
    if (!news || news.length === 0) { await sendMessage({ chatId, text: '📡 No news items pending.' }); return }
    await sendMessage({ chatId, text: `📡 News queue: <b>${news.length}</b> items` })
    for (const n of news.slice(0, 5)) { await sendMessage({ chatId, text: `<b>${escapeHtml(n.title || 'Untitled')}</b>\n${escapeHtml((n.summary || '').slice(0, 200))}`, replyMarkup: { inline_keyboard: [[{ text: '✅ Approve', callback_data: `appv:${n.id}` }, { text: '❌ Reject', callback_data: `rejt:${n.id}` }]] } }) }
    return
  }

  if (text.startsWith('/queue-blog')) {
    const sb = supabase()
    const { data: items } = await sb.from('blog_queue').select('*').in('status', ['queued', 'pending_approval', 'failed']).order('queue_position', { ascending: true }).limit(10)
    if (!items || items.length === 0) { await sendMessage({ chatId, text: '📝 No blog items in queue.' }); return }
    await sendMessage({ chatId, text: `📝 Blog queue: <b>${items.length}</b> items` })
    for (const item of items) { await sendMessage({ chatId, text: `<b>${item.file_name}</b>\nStatus: ${item.status}`, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skip', callback_data: `blg_skip:${item.file_id}` }]] } }) }
    return
  }

  if (text.startsWith('/status')) {
    const providers = await storage.providers.list()
    const styles = await storage.promptStyles.list()
    const active = styles.find(x => x.is_active)
    const t = providers.find(p => p.active_for_text)
    const v = providers.find(p => p.active_for_vision)
    const lines = [
      '<b>SocialForge status</b>',
      `Providers: ${providers.length}`,
      `Text: ${t ? `${t.name} · ${t.model}` : '— none active'}`,
      `Vision: ${v ? `${v.name} · ${v.model}` : '— none active'}`,
      `Active style: ${active ? active.name : '—'}`,
      `Admin chat id: <code>${s.telegram_admin_chat_id || '(this one)'}</code>`,
    ]
    await sendMessage({ chatId, text: lines.join('\n') })
    return
  }

  if (text.startsWith('/pending')) {
    const jobs = (await storage.jobs.list()).filter(j => j.status === 'draft' || j.status === 'pending_approval')
    if (jobs.length === 0) { await sendMessage({ chatId, text: '📦 No pending drafts.' }); return }
    await sendMessage({ chatId, text: `📦 Pending drafts: <b>${jobs.length}</b>` })
    for (const j of jobs.slice(0, 5)) {
      await sendMessage({ chatId, text: formatDraftMessage(j), replyMarkup: buildJobKeyboard(j) })
    }
    return
  }

  if (text.startsWith('/nexttopic')) {
    await sendMessage({ chatId, text: '⏳ Picking next topic and generating article...' })
    try {
      const sb = supabase()
      const { data: next } = await sb.from('topic_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle()
      if (!next) { await sendMessage({ chatId, text: '📭 No pending topics in queue. Add topics in the blog page.' }); return }
      const { generateBlogPost } = await import('@/lib/ai/generate')
      const result = await generateBlogPost({ context: next.topic })
      const bp = await storage.blogPosts.create({ title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description, status: 'draft' })
      await sb.from('topic_queue').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', next.id)
      await storage.audit.log('blog_generate', 'topic_queue', next.id, 'pending', 'used', { topic: next.topic, blog_id: bp.id })
      const { formatBlogMessage, buildBlogKeyboard } = await import('@/lib/blog/formatter')
      await sendMessage({ chatId, text: formatBlogMessage(result, { file_name: next.topic }, 'pending_approval'), replyMarkup: buildBlogKeyboard(bp.id, result, 'pending_approval') })
      await sendMessage({ chatId, text: `✅ Generated article from topic: "${next.topic}"\nTitle: ${result.title}\nSent for approval above.` })
    } catch (e) { await sendMessage({ chatId, text: `❌ Failed: ${escapeHtml(e.message)}` }) }
    return
  }

  if (text.startsWith('/publish ')) {
    const jobId = text.slice('/publish '.length).trim()
    const job = await storage.jobs.get(jobId)
    if (!job) { await sendMessage({ chatId, text: `Job not found: <code>${escapeHtml(jobId)}</code>` }); return }
    await sendMessage({ chatId, text: `🚀 Publishing <code>${escapeHtml(jobId)}</code>…` })
    try {
      const r = await publishJob(job)
      const summary = r.results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
      await sendMessage({ chatId, text: `<b>Result</b>\n${escapeHtml(summary)}` })
    } catch (e) { await sendMessage({ chatId, text: `❌ ${escapeHtml(e.message)}` }) }
    return
  }

  if (text.startsWith('/rewrite ') || text.startsWith('/shorten ') || text.startsWith('/expand ') || text.startsWith('/translate ')) {
    let mode, target = ''
    if (text.startsWith('/rewrite '))   { mode = 'tone'; target = 'friendly' }
    if (text.startsWith('/shorten '))   { mode = 'shorten'; target = '60 words' }
    if (text.startsWith('/expand '))    { mode = 'expand'; target = '250 words' }
    if (text.startsWith('/translate ')) { mode = 'translate'; target = 'Spanish' }
    const idx = text.indexOf(' ')
    const content = text.slice(idx + 1).trim()
    if (!content) { await sendMessage({ chatId, text: 'Usage: /rewrite <text> — provide text after the command.' }); return }
    try {
      const out = await runModule('rewriter', { context: content, mode, target })
      await sendMessage({ chatId, text: `<b>${mode}</b>\n${escapeHtml(String(out))}` })
    } catch (e) { await sendMessage({ chatId, text: `❌ ${escapeHtml(e.message)}` }) }
    return
  }

  // Check for pending edit reply (format: "platform: new caption" or "all: new caption")
  const sb = supabase()
  const { data: pendingEdit } = await sb.from('app_settings').select('value').eq('key', `pending_edit_${chatId}`).maybeSingle()
  if (pendingEdit?.value?.jobId && !text.startsWith('/')) {
    const { jobId } = pendingEdit.value
    await sb.from('app_settings').delete().eq('key', `pending_edit_${chatId}`)
    const job = await storage.jobs.get(jobId)
    if (!job) { await sendMessage({ chatId, text: 'Job no longer exists.' }); return }

    const colonIdx = text.indexOf(':')
    const platform = colonIdx > 0 ? text.slice(0, colonIdx).trim().toLowerCase() : 'all'
    const newCaption = colonIdx > 0 ? text.slice(colonIdx + 1).trim() : text

    if (!newCaption) { await sendMessage({ chatId, text: 'Empty caption. Edit cancelled.' }); return }

    const posts = { ...job.platform_posts }
    if (platform === 'all') {
      for (const p of PLATFORM_KEYS) {
        if (posts[p]) posts[p] = { ...posts[p], caption: newCaption }
      }
    } else if (posts[platform]) {
      posts[platform] = { ...posts[platform], caption: newCaption }
    } else {
      await sendMessage({ chatId, text: `Unknown platform "${platform}". Use: linkedin, instagram, facebook, threads, or all.` })
      return
    }
    const updated = await storage.jobs.update(jobId, { platform_posts: posts })
    await storage.audit.log('edit', 'content_job', jobId, 'pending_approval', 'pending_approval', { platform, edited_by: 'telegram' })
    await sendMessage({ chatId, text: `✏️ Caption updated for <b>${platform}</b>.` })
    await sendMessage({ chatId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
    return
  }

  // Check for pending blog edit reply
  const { data: pendingBlogEdit } = await sb.from('app_settings').select('value').eq('key', `pending_blog_edit_${chatId}`).maybeSingle()
  if (pendingBlogEdit?.value?.fileId && !text.startsWith('/')) {
    const { fileId: bFileId, isBlogPost } = pendingBlogEdit.value
    await sb.from('app_settings').delete().eq('key', `pending_blog_edit_${chatId}`)
    let blogRow = await sb.from('blog_queue').select('*').eq('file_id', bFileId).maybeSingle().then(r => r.data)
    if (!blogRow) blogRow = await sb.from('blog_posts').select('*').eq('id', bFileId).maybeSingle().then(r => r.data)
    if (!blogRow) { await sendMessage({ chatId, text: 'Blog item no longer exists.' }); return }

    const colonIdx = text.indexOf(':')
    const field = colonIdx > 0 ? text.slice(0, colonIdx).trim().toLowerCase() : 'content'
    const value = colonIdx > 0 ? text.slice(colonIdx + 1).trim() : text
    if (!value) { await sendMessage({ chatId, text: 'Empty value. Edit cancelled.' }); return }

    if (isBlogPost) {
      const patch = {}
      if (field === 'title') patch.title = value
      else if (field === 'category') patch.section = value
      else if (field === 'excerpt') patch.seo_description = value
      else patch.body_markdown = text
      await sb.from('blog_posts').update(patch).eq('id', bFileId)
    } else {
      const article = { ...(blogRow.article_data || {}) }
      if (field === 'title') article.title = value
      else if (field === 'category') article.category = value
      else if (field === 'tags') article.tags = value.split(',').map(t => t.trim())
      else if (field === 'excerpt') article.excerpt = value
      else article.content = text
      await sb.from('blog_queue').update({ article_data: article }).eq('file_id', bFileId)
    }
    await storage.audit.log('blog_edit', isBlogPost ? 'blog_posts' : 'blog_queue', bFileId, 'pending_approval', 'pending_approval', { field, edited_by: 'telegram' })
    await sendMessage({ chatId, text: `✏️ <b>${field}</b> updated for blog article.` })
    return
  }

  await sendMessage({ chatId, text: 'Unknown command. Send /help.' })
}

async function handleCallback(cq) {
  const data = cq.data || ''
  const chatId = cq.message?.chat?.id
  const messageId = cq.message?.message_id

  const s = await storage.settings.get()
  const admin = String(s.telegram_admin_chat_id || '')
  if (admin && String(chatId) !== admin) {
    await ack('Not allowed', true)
    return
  }

  const parts = data.split(':')
  const action = parts[0]
  const fileId = parts.length === 3 ? parts[1] : null
  const jobId = parts.length === 3 ? parts[2] : parts[1]

  // Safe answer — never let expired query block the action
  const ack = async (text, showAlert) => { try { await answerCallbackQuery({ callbackQueryId: cq.id, text, showAlert }) } catch {} }
  const ackSilent = async () => { try { await answerCallbackQuery({ callbackQueryId: cq.id }) } catch {} }

  if (action === 'noop') { await ackSilent(); return }

  // --- Approve ---
  if (action === 'appv') {
    try {
      const job = await storage.jobs.get(jobId)
      if (!job) { await ack('Job not found', true); return }
      const updated = await storage.jobs.update(jobId, { status: 'approved' })
      await ack('✅ Approved — will publish at scheduled time')
      try {
        await editMessageCaption({
          chatId, messageId,
          caption: formatAutomationJobMessage(updated, null, null),
          replyMarkup: buildAutomationJobKeyboard(updated, fileId),
        })
      } catch {
        await editMessageText({ chatId, messageId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
      }
      try {
        const r = await onApprove(updated)
        const summary = (r.results || []).map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
        const final = await storage.jobs.get(jobId)
        const newText = formatAutomationJobMessage(final, null, null) + (summary ? `\n\n<b>Publish result</b>\n${escapeHtml(summary)}` : '')
        try {
          await editMessageCaption({ chatId, messageId, caption: newText, replyMarkup: buildAutomationJobKeyboard(final, fileId) })
        } catch {
          await editMessageText({ chatId, messageId, text: newText, replyMarkup: buildJobKeyboard(final) })
        }
      } catch (e) {
        await sendMessage({ chatId, text: `⚠️ Approved, but auto-publish note: ${escapeHtml(e.message)}` })
      }
    } catch (e) {
      await ack('Job no longer exists', true)
    }
    return
  }

  // --- Publish Now ---
  if (action === 'pubn') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await ack('Job not found', true); return }
    await ack('🚀 Publishing now…')
    try {
      const r = await onPublishNow(job)
      const summary = r.results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
      await storage.audit.log('publish', 'content_job', jobId, job.status, 'published', { triggered_by: 'telegram_postnow' })
      const final = await storage.jobs.get(jobId)
      const newText = formatAutomationJobMessage(final, null, null) + `\n\n<b>Publish result</b>\n${escapeHtml(summary)}`
      try {
        await editMessageCaption({ chatId, messageId, caption: newText, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } })
      } catch {
        await editMessageText({ chatId, messageId, text: newText, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } })
      }
    } catch (e) {
      await sendMessage({ chatId, text: `❌ Publish failed: ${escapeHtml(e.message)}` })
    }
    return
  }

  // --- Schedule (in-1h) ---
  if (action === 'schd') {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const updated = await storage.jobs.update(jobId, { status: 'scheduled', scheduled_for: scheduledFor })
    await storage.audit.log('schedule', 'content_job', jobId, 'pending_approval', 'scheduled', { scheduled_for: scheduledFor })
    await ack('📆 Scheduled — in 1h')
    try {
      await editMessageCaption({ chatId, messageId, caption: formatAutomationJobMessage(updated, null, null) + `\n\n<i>Scheduled for: ${new Date(scheduledFor).toLocaleString()}</i>`, replyMarkup: buildAutomationJobKeyboard(updated, fileId) })
    } catch {
      await editMessageText({ chatId, messageId, text: formatDraftMessage(updated) + `\n\n<i>Scheduled for: ${new Date(scheduledFor).toLocaleString()}</i>`, replyMarkup: buildJobKeyboard(updated) })
    }
    return
  }

  // --- Reschedule ---
  if (action === 'rsch') {
    const sb = supabase()
    if (fileId) {
      const { data: row } = await sb.from('drive_queue').select('*').eq('file_id', fileId).maybeSingle()
      if (row) {
        await sb.from('drive_queue').update({ status: 'queued', content_job_id: null, scheduled_time: null, scheduled_slot_index: null }).eq('file_id', fileId)
      }
    }
    await storage.jobs.update(jobId, { status: 'draft' })
    await storage.audit.log('reschedule', 'content_job', jobId, 'pending_approval', 'draft', { rescheduled: true })
    await ack('⏰ Rescheduled — will be picked up in next slot')
    const msg = `⏰ <b>Rescheduled</b>\n\nThis content has been returned to the queue and will be picked up in the next available slot.\n\nJob: <code>${escapeHtml(jobId)}</code>`
    try {
      await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '⏰ Rescheduled', callback_data: 'noop' }]] } })
    } catch {
      await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '⏰ Rescheduled', callback_data: 'noop' }]] } })
    }
    return
  }

  // --- Regenerate ---
  if (action === 'regn') {
    await ack('🔁 Regenerating all…')
    const job = await storage.jobs.get(jobId)
    if (!job) { await ack('Job not found', true); return }
    try {
      const result = await generateFromImage({
        imageBase64: undefined,
        context: (job.research_context || '') + (job.topic ? '\n\nTopic: ' + job.topic : ''),
        styleId: job.style_id,
        jobId: job.id,
      })
      const updated = await storage.jobs.update(jobId, { platform_posts: result.posts, warnings: result.warnings })
      await storage.audit.log('regenerate', 'content_job', jobId, 'pending_approval', 'pending_approval', { providers: result.providers_used })
      if (fileId) {
        const sb = supabase()
        await sb.from('drive_queue').update({ platform_content: result.posts, ai_provider_used: result.providers_used?.text?.name, version: sb.rpc('increment') }).eq('file_id', fileId)
      }
      try {
        await editMessageCaption({ chatId, messageId, caption: formatAutomationJobMessage(updated, null, null), replyMarkup: buildAutomationJobKeyboard(updated, fileId) })
      } catch {
        await editMessageText({ chatId, messageId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
      }
    } catch (e) {
      await sendMessage({ chatId, text: `❌ Regeneration failed: ${escapeHtml(e.message)}` })
    }
    return
  }

  // --- Edit ---
  if (action === 'edit') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await ack('Job not found', true); return }
    const platforms = Object.keys(job.platform_posts || {}).filter(p => job.platform_posts[p]?.caption)
    const lines = ['✏️ <b>Edit caption</b>', '', 'Reply to this message with:']
    for (const p of platforms) {
      const firstLine = (job.platform_posts[p]?.caption || '').slice(0, 60)
      lines.push(`<b>${p}</b>: "${escapeHtml(firstLine)}…"`)
    }
    lines.push('', `Format: <code>${platforms[0] || 'linkedin'}: your new caption here</code>`)
    lines.push(`Or: <code>all: same caption for all platforms</code>`)
    lines.push(`\nJob: <code>${escapeHtml(jobId)}</code>`)
    await ack('✏️ Reply with platform: caption')

    const sb = supabase()
    try { await sb.from('app_settings').upsert({ key: `pending_edit_${chatId}`, value: { jobId } }, { onConflict: 'key' }) } catch {}

    await sendMessage({ chatId, text: lines.join('\n') })
    return
  }

  // --- Skip ---
  if (action === 'skip') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await ack('Job not found', true); return }
    await ack('⏭ Skipped — moved to next slot')
    await onSkip(job)
    const skippedMsg = formatAutomationJobMessage(await storage.jobs.get(jobId), null, null) + '\n\n<i>⏭ Skipped. Will be reprocessed later.</i>'
    try {
      await editMessageCaption({ chatId, messageId, caption: skippedMsg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } })
    } catch {
      await editMessageText({ chatId, messageId, text: skippedMsg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } })
    }
    return
  }

  // --- Reject ---
  if (action === 'rejt') {
    try {
      const job = await storage.jobs.get(jobId)
      if (!job) { await ack('Job not found', true); return }
      await onReject(job)
      await ack('❌ Rejected and archived')
      const rejectMsg = `❌ <b>Rejected</b>\n\nPhoto has been archived and will not be published.\n\nJob: <code>${escapeHtml(jobId)}</code>`
      try {
        await editMessageCaption({ chatId, messageId, caption: rejectMsg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } })
      } catch {
        await editMessageText({ chatId, messageId, text: rejectMsg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } })
      }
    } catch (e) {
      await ack('Job not found', true)
    }
    return
  }

  // --- AI News Decision callbacks (nw prefix) ---
  if (['nwgn', 'nwbl', 'nwsch', 'nwign', 'nwrgn'].includes(action)) {
    const newsId = parts[1]
    const sb = supabase()
    const item = await sb.from('news_posts').select('*').eq('id', newsId).maybeSingle().then(r => r.data)
    if (!item) { await ack('News item not found', true); return }
    try {
      const { recordFeedback } = await import('../news/ai-decision')
      if (action === 'nwign') {
        await sb.from('news_posts').update({ status: 'rejected' }).eq('id', newsId)
        await recordFeedback(newsId, 'reject')
        await ack('Ignored — learning recorded')
        await editMessageCaption({ chatId, messageId, caption: `❌ Ignored: ${escapeHtml((item.title || '').slice(0, 100))}`, replyMarkup: { inline_keyboard: [[{ text: 'Ignored', callback_data: 'noop' }]] } }).catch(() => {})
        return
      }
      if (action === 'nwgn' || action === 'nwbl') {
        const { generateAndSave } = await import('../news/generate')
        const saved = await generateAndSave(newsId)
        const platform = action === 'nwbl' ? 'blog' : 'social'
        await ack('Content generated')
        const kb = { inline_keyboard: [[{ text: '📅 Schedule', callback_data: `nwsch:${newsId}` }, { text: '✅ Approve', callback_data: `appv:${newsId}` }]] }
        const msg = `✅ <b>Content generated</b> (${platform})\n${escapeHtml((item.title || '').slice(0, 120))}\nPlatforms: ${Object.keys(saved?.platform_posts || {}).map(p => '✓ ' + p).join(' ')}`
        await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: kb }).catch(async () => { await editMessageText({ chatId, messageId, text: msg, replyMarkup: kb }).catch(() => {}) })
        return
      }
      if (action === 'nwrgn') {
        const { analyzeNewsItem, getNewsTopics, getLearning, buildNewsCard } = await import('../news/ai-decision')
        const analysis = await analyzeNewsItem(item, await getNewsTopics(), await getLearning())
        await sb.from('news_posts').update({ ai_analysis: analysis }).eq('id', newsId)
        const { text, kb } = await buildNewsCard(item, analysis)
        await ack('Re-analyzed')
        await editMessageCaption({ chatId, messageId, caption: text, replyMarkup: kb }).catch(async () => { await editMessageText({ chatId, messageId, text, replyMarkup: kb }).catch(() => {}) })
        return
      }
      if (action === 'nwsch') {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
        await sb.from('news_posts').update({ status: 'scheduled', scheduled_for: d.toISOString() }).eq('id', newsId)
        await recordFeedback(newsId, 'approve')
        await ack('Scheduled for tomorrow 10:00')
        await editMessageCaption({ chatId, messageId, caption: `📅 Scheduled: ${escapeHtml((item.title || '').slice(0, 100))} — tomorrow 10:00`, replyMarkup: { inline_keyboard: [[{ text: 'Scheduled', callback_data: 'noop' }]] } }).catch(() => {})
        return
      }
    } catch (e) {
      await ack('Action failed: ' + e.message, true)
    }
    return
  }

  // --- Blog Automation callbacks (blg_ prefix) ---
  if (action.startsWith('blg_')) {
    const blogAction = action.replace('blg_', '')
    const bFileId = parts[1]
    const sb = supabase()
    let blogRow = await sb.from('blog_queue').select('*').eq('file_id', bFileId).maybeSingle().then(r => r.data)
    let isBlogPost = false
    if (!blogRow) { blogRow = await sb.from('blog_posts').select('*').eq('id', bFileId).maybeSingle().then(r => r.data); isBlogPost = !!blogRow }
    if (!blogRow && blogAction !== 'reorder') {
      await ack('Blog item not found', true); return
    }

    const publishBlogFromPost = async (post) => {
      const { publishToInsights } = await import('../blog/generate')
      return await publishToInsights({
        title: post.title, content: post.body_markdown, excerpt: post.seo_description || '',
        category: post.section || 'tech', coverImage: post.cover_image_url || '', tags: [],
        status: 'published',
      })
    }

    if (blogAction === 'appv') {
      await ack('✅ Approving…')
      try {
        let result
        if (isBlogPost) {
          result = await publishBlogFromPost(blogRow)
          await sb.from('blog_posts').update({ status: 'published', published_url: result.url, published_at: new Date().toISOString() }).eq('id', bFileId)
        } else {
          const { blogApprove } = await import('../blog/automation')
          result = await blogApprove(bFileId)
        }
        const title = blogRow?.article_data?.title || blogRow?.title || ''
        const msg = `✅ <b>Article Published</b>\n\n${title}\n🔗 ${result.url || 'published'}`
        try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '✅ Published', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '✅ Published', callback_data: 'noop' }]] } }) }
      } catch (e) { await sendMessage({ chatId, text: `❌ Blog approve failed: ${escapeHtml(e.message)}` }) }
      return
    }

    if (blogAction === 'pubn') {
      await ack('🚀 Publishing now…')
      try {
        let result
        if (isBlogPost) {
          result = await publishBlogFromPost(blogRow)
          await sb.from('blog_posts').update({ status: 'published', published_url: result.url, published_at: new Date().toISOString() }).eq('id', bFileId)
        } else {
          const { blogPublishNow } = await import('../blog/automation')
          result = await blogPublishNow(bFileId)
        }
        const title = blogRow?.article_data?.title || blogRow?.title || ''
        const msg = `🚀 <b>Published Now</b>\n\n${title}\n🔗 ${result.url || ''}`
        try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } }) }
      } catch (e) { await sendMessage({ chatId, text: `❌ Blog publish failed: ${escapeHtml(e.message)}` }) }
      return
    }

    if (blogAction === 'edit') {
      await ack('✏️ Edit mode')
      const a = blogRow?.article_data || blogRow
      if (!a) { await sendMessage({ chatId, text: 'No article data found' }); return }
      const lines = [
        `✏️ <b>Edit Article</b>\n`, `Reply with edits:`, ``,
        `TITLE: ${a.title || a.topic || ''}`,
        `CATEGORY: ${a.category || 'tech'}`,
        `EXCERPT: ${a.seo_description || a.excerpt || ''}`,
        `CONTENT: (markdown content)`, ``,
        `Send: <code>TITLE: My New Title</code>`,
      ]
      await sendMessage({ chatId, text: lines.join('\n') })
      try { await sb.from('app_settings').upsert({ key: `pending_blog_edit_${chatId}`, value: { fileId: bFileId, isBlogPost } }, { onConflict: 'key' }) } catch {}
      return
    }

    if (blogAction === 'regn') {
      await ack('🔄 Regenerating…')
      const { generateBlogPost } = await import('../ai/generate')
      try {
        const newResult = await generateBlogPost({ context: blogRow?.article_data?.title || blogRow?.title || 'Regeneration' })
        if (isBlogPost) {
          await sb.from('blog_posts').update({ title: newResult.title, body_markdown: newResult.body_markdown, seo_description: newResult.seo_description }).eq('id', bFileId)
        } else {
          await sb.from('blog_queue').update({ article_data: newResult }).eq('file_id', bFileId)
        }
        await sendMessage({ chatId, text: `🔄 Regenerated: "${newResult.title}"` })
      } catch (e) { await sendMessage({ chatId, text: `❌ Regeneration failed: ${escapeHtml(e.message)}` }) }
      return
    }

    if (blogAction === 'prev') {
      await ack('👀 Opening preview…')
      const a = blogRow?.article_data
      if (!a?.content) { await ack('No content to preview', true); return }
      const preview = a.content.slice(0, 3000)
      const msg = `👀 <b>Article Preview</b>\n\n<b>${escapeHtml(a.title)}</b>\n\n${escapeHtml(preview)}\n\n<i>— truncated, full article ${a.content.length} chars —</i>`
      await sendMessage({ chatId, text: msg })
      return
    }

    if (blogAction === 'rsch') {
      await ack('📅 Rescheduled')
      if (isBlogPost) { await sb.from('blog_posts').update({ status: 'draft' }).eq('id', bFileId) }
      else { const { blogReschedule } = await import('../blog/automation'); await blogReschedule(bFileId) }
      const title = blogRow?.article_data?.title || blogRow?.title || ''
      const msg = `📅 <b>Rescheduled</b>\n\n${title}\n\nReturned to queue.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '📅 Rescheduled', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '📅 Rescheduled', callback_data: 'noop' }]] } }) }
      return
    }

    if (blogAction === 'skip') {
      await ack('⏭ Skipped')
      if (isBlogPost) { await sb.from('blog_posts').update({ status: 'draft' }).eq('id', bFileId) }
      else { const { blogSkip } = await import('../blog/automation'); await blogSkip(bFileId) }
      const title = blogRow?.article_data?.title || blogRow?.title || blogRow?.file_name || ''
      const msg = `⏭ <b>Skipped</b>\n\n${title}\n\nReturned to queue.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } }) }
      return
    }

    if (blogAction === 'rejt') {
      await ack('❌ Rejected')
      if (isBlogPost) { await sb.from('blog_posts').update({ status: 'rejected' }).eq('id', bFileId) }
      else { const { blogReject } = await import('../blog/automation'); await blogReject(bFileId) }
      const title = blogRow?.article_data?.title || blogRow?.title || blogRow?.file_name || ''
      const msg = `❌ <b>Rejected</b>\n\n${title}\n\nArchived.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } }) }
      return
    }

    await ack('Unknown blog action')
    return
  }

  await ack('Unknown action')
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendDraftToAdmin(job) {
  const s = await storage.settings.get()
  const chatId = s.telegram_admin_chat_id
  if (!chatId) throw new Error('No admin chat id configured for Telegram.')
  const sent = await sendMessage({ chatId, text: formatDraftMessage(job), replyMarkup: buildJobKeyboard(job) })
  await storage.jobs.update(job.id, {
    telegram_chat_id: String(chatId),
    telegram_message_id: sent.message_id,
    status: job.status === 'draft' ? 'pending_approval' : job.status,
  })
  return sent
}
