import { storage } from '../storage'
import { sendMessage, editMessageText, answerCallbackQuery } from './client'
import { formatDraftMessage, buildJobKeyboard, formatHelp } from './formatter'
import { regeneratePlatform, generateFromImage } from '../ai/generate'
import { publishJob } from '../publishers'
import { runModule } from '../ai/modules'
import { onApprove, onSkip } from '../automation'
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
  const jobId = parts[1]

  if (action === 'noop') { await answerCallbackQuery({ callbackQueryId: cq.id }); return }

  // --- Approve ---
  if (action === 'appv') {
    try {
      const job = await storage.jobs.get(jobId)
      if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
      const updated = await storage.jobs.update(jobId, { status: 'approved' })
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '✅ Approved — will publish at scheduled time' })
      await editMessageText({ chatId, messageId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
      try {
        const r = await onApprove(updated)
        const summary = (r.results || []).map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
        const final = await storage.jobs.get(jobId)
        await editMessageText({ chatId, messageId, text: formatDraftMessage(final) + (summary ? `\n\n<b>Publish result</b>\n${escapeHtml(summary)}` : ''), replyMarkup: buildJobKeyboard(final) })
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
      const r = await publishJob(job)
      const summary = r.results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
      const updated = await storage.jobs.get(jobId)
      await storage.audit.log('publish', 'content_job', jobId, job.status, 'published', { triggered_by: 'telegram_postnow' })
      await editMessageText({ chatId, messageId, text: formatDraftMessage(updated) + `\n\n<b>Publish result</b>\n${escapeHtml(summary)}`, replyMarkup: buildJobKeyboard(updated) })
    } catch (e) {
      await sendMessage({ chatId, text: `❌ Publish failed: ${escapeHtml(e.message)}` })
    }
    return
  }

  // --- Schedule ---
  if (action === 'schd') {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const updated = await storage.jobs.update(jobId, { status: 'scheduled', scheduled_for: scheduledFor })
    await storage.audit.log('schedule', 'content_job', jobId, 'pending_approval', 'scheduled', { scheduled_for: scheduledFor })
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '📆 Scheduled — in 1h' })
    await editMessageText({ chatId, messageId, text: formatDraftMessage(updated) + `\n\n<i>Scheduled for: ${new Date(scheduledFor).toLocaleString()}</i>`, replyMarkup: buildJobKeyboard(updated) })
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
      await editMessageText({ chatId, messageId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
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
    await sb.from('app_settings').upsert({ key: `pending_edit_${chatId}`, value: { jobId } }, { onConflict: 'key' })

    await sendMessage({ chatId, text: lines.join('\n') })
    return
  }

  // --- Skip ---
  if (action === 'skip') {
    const job = await storage.jobs.get(jobId)
    if (!job) { await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true }); return }
    await answerCallbackQuery({ callbackQueryId: cq.id, text: '⏭ Skipped — moved to next slot' })
    await onSkip(job)
    await editMessageText({ chatId, messageId, text: formatDraftMessage(await storage.jobs.get(jobId)) + '\n\n<i>⏭ Skipped. Will be reprocessed later.</i>', replyMarkup: { inline_keyboard: [[{ text: '⏭ Skipped', callback_data: 'noop' }]] } })
    return
  }

  // --- Reject ---
  if (action === 'rejt') {
    try {
      const updated = await storage.jobs.update(jobId, { status: 'rejected' })
      await storage.audit.log('reject', 'content_job', jobId, 'pending_approval', 'rejected')
      await answerCallbackQuery({ callbackQueryId: cq.id, text: '❌ Rejected' })
      await editMessageText({ chatId, messageId, text: formatDraftMessage(updated), replyMarkup: buildJobKeyboard(updated) })
    } catch (e) {
      await answerCallbackQuery({ callbackQueryId: cq.id, text: 'Job not found', showAlert: true })
    }
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
