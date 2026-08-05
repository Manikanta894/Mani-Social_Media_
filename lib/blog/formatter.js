function esc(s) {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function statusEmoji(status) {
  const map = {
    queued: '📋', processing: '⚙️', pending_approval: '⏳', approved: '✅',
    scheduled: '📆', published: '🚀', failed: '❌', archived: '📦', skipped: '⏭',
  }
  return map[status] || '📋'
}

export function formatBlogMessage(article, fileRow, status) {
  const lines = []
  lines.push(`📝 <b>New Article Generated</b>  ${statusEmoji(status)}`)
  lines.push('')
  lines.push(`<b>${esc(article.title)}</b>`)
  if (article.excerpt) lines.push(`<i>${esc(truncate(article.excerpt, 300))}</i>`)
  lines.push('')
  lines.push(`📂 Category: <b>${article.category || 'uncategorized'}</b>`)
  lines.push(`⏱ ${article.readingTime || '~8'} min read · 📐 SEO score: ${article.seoScore || 'N/A'}/100`)
  if (article.keywords) lines.push(`🏷 Keywords: <i>${esc(truncate(article.keywords, 200))}</i>`)
  if (article.tags?.length) lines.push(`🔖 Tags: ${article.tags.slice(0, 5).join(', ')}`)
  lines.push('')
  if (article.faq?.length) {
    const firstQ = article.faq[0]
    lines.push(`💡 <b>FAQ preview</b>`)
    lines.push(`Q: ${esc(truncate(firstQ.question, 100))}`)
    lines.push(`A: ${esc(truncate(firstQ.answer, 150))}`)
  }
  lines.push('')
  lines.push(`📎 ${esc(fileRow?.file_name || '')}`)
  lines.push(`🕒 ${status === 'pending_approval' ? 'Waiting for your decision' : status}`)
  return lines.join('\n')
}

export function buildBlogKeyboard(fileId, article, status) {
  const isDone = ['published', 'archived', 'failed'].includes(status)
  if (isDone) {
    return { inline_keyboard: [[{ text: `${statusEmoji(status)} ${status}`, callback_data: 'noop' }]] }
  }
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve',        callback_data: `blg_appv:${fileId}` },
        { text: '🚀 Publish Now',    callback_data: `blg_pubn:${fileId}` },
        { text: '✏️ Edit',           callback_data: `blg_edit:${fileId}` },
      ],
      [
        { text: '🔄 Regenerate',     callback_data: `blg_regn:${fileId}` },
        { text: '👀 Preview',        callback_data: `blg_prev:${fileId}` },
        { text: '📅 Reschedule',     callback_data: `blg_rsch:${fileId}` },
      ],
      [
        { text: '⏭ Skip',           callback_data: `blg_skip:${fileId}` },
        { text: '❌ Reject',         callback_data: `blg_rejt:${fileId}` },
      ],
    ],
  }
}

export function formatBlogStatusCard(fileRow) {
  const data = fileRow.article_data || {}
  const lines = []
  lines.push(`📝 <b>Blog Queue Item</b>`)
  lines.push(`📎 ${esc(fileRow.file_name || '')}`)
  if (data.title) lines.push(`<b>${esc(data.title)}</b>`)
  lines.push(`📊 Status: ${statusEmoji(fileRow.status)} <b>${fileRow.status}</b>`)
  lines.push(`#${fileRow.queue_position} in queue`)
  if (data.category) lines.push(`📂 ${data.category}`)
  if (data.readingTime) lines.push(`⏱ ${data.readingTime} min read`)
  if (fileRow.published_url) lines.push(`🔗 ${fileRow.published_url}`)
  if (fileRow.error) lines.push(`❌ Error: ${esc(truncate(fileRow.error, 200))}`)
  return lines.join('\n')
}