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
    const { fileId: bFileId } = pendingBlogEdit.value
    await sb.from('app_settings').delete().eq('key', `pending_blog_edit_${chatId}`)
    const { data: blogRow } = await sb.from('blog_queue').select('*').eq('file_id', bFileId).maybeSingle()
    if (!blogRow) { await sendMessage({ chatId, text: 'Blog item no longer exists.' }); return }

    const colonIdx = text.indexOf(':')
    const field = colonIdx > 0 ? text.slice(0, colonIdx).trim().toLowerCase() : 'content'
    const value = colonIdx > 0 ? text.slice(colonIdx + 1).trim() : text
    if (!value) { await sendMessage({ chatId, text: 'Empty value. Edit cancelled.' }); return }

    const article = { ...(blogRow.article_data || {}) }
    if (field === 'title') article.title = value
    else if (field === 'category') article.category = value
    else if (field === 'tags') article.tags = value.split(',').map(t => t.trim())
    else if (field === 'excerpt') article.excerpt = value
    else if (field === 'content') article.content = value
    else article.content = text

    await sb.from('blog_queue').update({ article_data: article }).eq('file_id', bFileId)
    await storage.audit.log('blog_edit', 'blog_queue', bFileId, 'pending_approval', 'pending_approval', { field, edited_by: 'telegram' })
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
    await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Not allowed', showAlert: true })
    return
  }

  const parts = data.split(':')
  const action = parts[0]
  const fileId = parts.length === 3 ? parts[1] : null
  const jobId = parts.length === 3 ? parts[2] : parts[1]

  if (action === 'noop') { await answerCallbackQuery({ callbackQueryId: cq.id }); return }

  // --- Approve ---
  if (action === 'appv') {
    try {
      const job = await storage.jobs.get(jobId)
      if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
      const updated = await storage.jobs.update(jobId, { status: 'approved' })
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '✅ Approved — will publish at scheduled time' })
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
      await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job no longer exists', showAlert: true })
    }
    return
  }

  // --- Publish Now ---
  if (action === 'pubn') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '🚀 Publishing now…' })
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
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '📆 Scheduled — in 1h' })
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
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '⏰ Rescheduled — will be picked up in next slot' })
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
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '🔁 Regenerating all…' })
    const job = await storage.jobs.get(jobId)
    if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
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
    if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
    const platforms = Object.keys(job.platform_posts || {}).filter(p => job.platform_posts[p]?.caption)
    const lines = ['✏️ <b>Edit caption</b>', '', 'Reply to this message with:']
    for (const p of platforms) {
      const firstLine = (job.platform_posts[p]?.caption || '').slice(0, 60)
      lines.push(`<b>${p}</b>: "${escapeHtml(firstLine)}…"`)
    }
    lines.push('', `Format: <code>${platforms[0] || 'linkedin'}: your new caption here</code>`)
    lines.push(`Or: <code>all: same caption for all platforms</code>`)
    lines.push(`\nJob: <code>${escapeHtml(jobId)}</code>`)
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '✏️ Reply with platform: caption' })

    const sb = supabase()
    try { await sb.from('app_settings').upsert({ key: `pending_edit_${chatId}`, value: { jobId } }, { onConflict: 'key' }) } catch {}

    await sendMessage({ chatId, text: lines.join('\n') })
    return
  }

  // --- Skip ---
  if (action === 'skip') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '⏭ Skipped — moved to next slot' })
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
      if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
      await onReject(job)
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '❌ Rejected and archived' })
      const rejectMsg = `❌ <b>Rejected</b>\n\nPhoto has been archived and will not be published.\n\nJob: <code>${escapeHtml(jobId)}</code>`
      try {
        await editMessageCaption({ chatId, messageId, caption: rejectMsg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } })
      } catch {
        await editMessageText({ chatId, messageId, text: rejectMsg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } })
      }
    } catch (e) {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true })
    }
    return
  }

  // --- Blog Automation callbacks (blg_ prefix) ---
  if (action.startsWith('blg_')) {
    const blogAction = action.replace('blg_', '')
    const [blogFileId, ...rest] = parts.slice(1)
    const bFileId = blogFileId || parts[1]
    const sb = supabase()
    const { data: blogRow } = await sb.from('blog_queue').select('*').eq('file_id', bFileId).maybeSingle()
    if (!blogRow && blogAction !== 'reorder') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Blog item not found', showAlert: true })
      return
    }

    if (blogAction === 'appv') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '✅ Approving…' })
      const { blogApprove } = await import('../blog/automation')
      try {
        const result = await blogApprove(bFileId)
        const msg = `✅ <b>Article Published</b>\n\n${blogRow?.article_data?.title || ''}\n🔗 ${result.url || 'published'}`
        try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '✅ Published', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '✅ Published', callback_data: 'noop' }]] } }) }
      } catch (e) {
        await sendMessage({ chatId, text: `❌ Blog approve failed: ${escapeHtml(e.message)}` })
      }
      return
    }

    if (blogAction === 'pubn') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '🚀 Publishing now…' })
      const { blogPublishNow } = await import('../blog/automation')
      try {
        const result = await blogPublishNow(bFileId)
        const msg = `🚀 <b>Published Now</b>\n\n${blogRow?.article_data?.title || ''}\n🔗 ${result.url || ''}`
        try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '🚀 Published', callback_data: 'noop' }]] } }) }
      } catch (e) { await sendMessage({ chatId, text: `❌ Blog publish failed: ${escapeHtml(e.message)}` }) }
      return
    }

    if (blogAction === 'edit') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '✏️ Edit mode' })
      if (!blogRow?.article_data) { await sendMessage({ chatId, text: 'No article data found' }); return }
      const a = blogRow.article_data
      const lines = [
        `✏️ <b>Edit Article</b>\n`,
        `Reply with edits in this format:`,
        ``,
        `TITLE: ${a.title}`,
        `CATEGORY: ${a.category}`,
        `TAGS: ${(a.tags || []).join(', ')}`,
        `EXCERPT: ${a.excerpt || ''}`,
        `CONTENT: (markdown content)`,
        ``,
        `Send just the field you want to change, e.g.:`,
        `<code>TITLE: My New Title</code>`,
        `<code>CATEGORY: ai</code>`,
      ]
      await sendMessage({ chatId, text: lines.join('\n') })
      try { await sb.from('app_settings').upsert({ key: `pending_blog_edit_${chatId}`, value: { fileId: bFileId } }, { onConflict: 'key' }) } catch {}
      return
    }

    if (blogAction === 'regn') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '🔄 Regenerating…' })
      const { blogRegenerate, runBlogTick } = await import('../blog/automation')
      try {
        await blogRegenerate(bFileId)
        await sendMessage({ chatId, text: `🔄 Article queued for regeneration. Will be processed next tick.\nFile: ${escapeHtml(bFileId)}` })
        try { await editMessageCaption({ chatId, messageId, caption: `🔄 <b>Regeneration queued</b>\n\n${blogRow?.article_data?.title || ''}\n\nWill regenerate on next tick.`, replyMarkup: { inline_keyboard: [[{ text: '🔄 Regenerating…', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: `🔄 <b>Regeneration queued</b>\n\n${blogRow?.article_data?.title || ''}\n\nWill regenerate on next tick.`, replyMarkup: { inline_keyboard: [[{ text: '🔄 Regenerating…', callback_data: 'noop' }]] } }) }
      } catch (e) { await sendMessage({ chatId, text: `❌ Regeneration failed: ${escapeHtml(e.message)}` }) }
      return
    }

    if (blogAction === 'prev') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '👀 Opening preview…' })
      const a = blogRow?.article_data
      if (!a?.content) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'No content to preview', showAlert: true }); return }
      const preview = a.content.slice(0, 3000)
      const msg = `👀 <b>Article Preview</b>\n\n<b>${escapeHtml(a.title)}</b>\n\n${escapeHtml(preview)}\n\n<i>— truncated, full article ${a.content.length} chars —</i>`
      await sendMessage({ chatId, text: msg })
      return
    }

    if (blogAction === 'rsch') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '📅 Rescheduled to next slot' })
      const { blogReschedule } = await import('../blog/automation')
      await blogReschedule(bFileId)
      const msg = `📅 <b>Rescheduled</b>\n\n${blogRow?.article_data?.title || ''}\n\nReturned to queue for the next publishing slot.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '📅 Rescheduled', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '📅 Rescheduled', callback_data: 'noop' }]] } }) }
      return
    }

    if (blogAction === 'skip') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '⏭ Skipped' })
      const { blogSkip } = await import('../blog/automation')
      await blogSkip(bFileId)
      const msg = `⏭ <b>Skipped</b>\n\n${blogRow?.article_data?.title || blogRow?.file_name || ''}\n\nReturned to queue for later slot.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } }) }
      return
    }

    if (blogAction === 'rejt') {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '❌ Rejected' })
      const { blogReject } = await import('../blog/automation')
      await blogReject(bFileId)
      const msg = `❌ <b>Rejected and archived</b>\n\n${blogRow?.article_data?.title || blogRow?.file_name || ''}\n\nArchived without publishing.`
      try { await editMessageCaption({ chatId, messageId, caption: msg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } }) } catch { await editMessageText({ chatId, messageId, text: msg, replyMarkup: { inline_keyboard: [[{ text: '❌ Rejected', callback_data: 'noop' }]] } }) }
      return
    }

    await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Unknown blog action' })
    return
  }

  await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Unknown action' })
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
