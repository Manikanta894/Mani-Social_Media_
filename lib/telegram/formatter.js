const PLATFORM_META = {
  linkedin:  { emoji: '💼', label: 'LinkedIn',  limit: 3000 },
  instagram: { emoji: '📷', label: 'Instagram', limit: 2200 },
  facebook:  { emoji: '👥', label: 'Facebook',  limit: 5000 },
  threads:   { emoji: '🧵', label: 'Threads',   limit: 500 },
}
const PLATFORM_KEYS = ['linkedin', 'instagram', 'facebook', 'threads']

function esc(s) {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function statusBadge(status) {
  const map = {
    draft:            '📝 draft',
    pending_approval: '⏳ pending',
    approved:         '✅ approved',
    scheduled:        '📆 scheduled',
    published:        '🚀 published',
    rejected:         '❌ rejected',
    processing:       '⚙️ processing',
    queued:           '📋 queued',
    failed:           '❌ failed',
    archived:         '📦 archived',
    skipped:          '⏭ skipped',
  }
  return map[status] || '📝 draft'
}

export function formatDraftMessage(job) {
  const style = job.style_name ? ` · style: <i>${esc(job.style_name)}</i>` : ''
  const statusLine = statusBadge(job.status)
  const queuePos = job.drive_file_id ? ` · #${job.queue_position || '?'}` : ''
  const lines = []
  lines.push(`🎨 <b>Draft</b>${style}   ${statusLine}${queuePos}`)
  if (job.topic) lines.push(`<i>${esc(truncate(job.topic, 140))}</i>`)
  lines.push(`<b>Scheduled time:</b> ${job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : 'Next available slot'}`)
  lines.push('')

  for (const key of PLATFORM_KEYS) {
    const post = job.platform_posts?.[key]
    if (!post) continue
    const meta = PLATFORM_META[key]
    const caption = post.caption || ''
    const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : ''
    const over = caption.length > meta.limit
    const counter = `${caption.length}/${meta.limit}${over ? ' ⚠️' : ''}`
    const confidence = post.ai_confidence ? ` · confidence: ${(post.ai_confidence * 100).toFixed(0)}%` : ''
    lines.push(`${meta.emoji} <b>${meta.label}</b>  <code>${counter}</code>${confidence}`)
    lines.push(esc(truncate(caption, 700)))
    if (tags) lines.push(`<i>${esc(truncate(tags, 300))}</i>`)
    if (post.description) lines.push(`📝 ${esc(truncate(post.description, 200))}`)
    if (post.alt_text) lines.push(`🔍 Alt: <i>${esc(truncate(post.alt_text, 150))}</i>`)
    if (post.seo_keywords) lines.push(`🏷 SEO: <i>${esc(truncate(post.seo_keywords, 150))}</i>`)
    if (post.cta) lines.push(`👉 CTA: <i>${esc(truncate(post.cta, 100))}</i>`)
    lines.push('')
  }

  if (Array.isArray(job.warnings) && job.warnings.length > 0) {
    lines.push(`⚠️ <b>Validator warnings</b>`)
    for (const w of job.warnings.slice(0, 4)) lines.push(`• ${esc(w)}`)
  }

  const text = lines.join('\n')
  return text.length > 4000 ? text.slice(0, 3990) + '\n…' : text
}

export function buildJobKeyboard(job) {
  const id = job.id
  const isPublished = job.status === 'published'
  const isRejected  = job.status === 'rejected'
  if (isPublished || isRejected) {
    return { inline_keyboard: [[{ text: statusBadge(job.status), callback_data: 'noop' }]] }
  }
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve',    callback_data: `appv:${id}` },
        { text: '🚀 Post now',   callback_data: `pubn:${id}` },
        { text: '📅 Schedule',   callback_data: `schd:${id}` },
      ],
      [
        { text: '🔄 Regenerate', callback_data: `regn:${id}` },
        { text: '✏️ Edit',       callback_data: `edit:${id}` },
        { text: '⏭ Skip',        callback_data: `skip:${id}` },
        { text: '❌ Reject',     callback_data: `rejt:${id}` },
      ],
    ],
  }
}

export function formatAutomationJobMessage(job, slotIndex, scheduledTime) {
  const lines = []
  lines.push(`📸 <b>New content generated</b>`)
  lines.push(`<i>${esc(truncate(job.topic || 'Photo', 80))}</i>`)
  lines.push(`<b>Slot:</b> ${slotIndex !== undefined ? `#${slotIndex + 1} at ${scheduledTime || 'next slot'}` : 'Next available'}`)
  lines.push(`<b>Status:</b> ${statusBadge(job.status)}`)
  lines.push('')

  for (const key of PLATFORM_KEYS) {
    const post = job.platform_posts?.[key]
    if (!post) continue
    const meta = PLATFORM_META[key]
    const caption = post.caption || ''
    const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : ''
    const confidence = post.ai_confidence ? ` (${(post.ai_confidence * 100).toFixed(0)}%)` : ''
    lines.push(`${meta.emoji} <b>${meta.label}</b>${confidence}`)
    lines.push(esc(truncate(caption, 400)))
    if (tags) lines.push(`<i>${esc(truncate(tags, 200))}</i>`)
    if (post.cta) lines.push(`👉 ${esc(truncate(post.cta, 80))}`)
    lines.push('')
  }

  if (Array.isArray(job.warnings) && job.warnings.length > 0) {
    const maxWarn = job.warnings.slice(0, 2)
    lines.push(`⚠️ ${esc(maxWarn.join('; '))}`)
  }

  const text = lines.join('\n')
  return text.length > 3800 ? text.slice(0, 3770) + '\n…' : text
}

export function buildAutomationJobKeyboard(job, fileId) {
  const id = job.id
  const isPublishedOrRejected = ['published', 'rejected', 'archived'].includes(job.status)
  if (isPublishedOrRejected) {
    return { inline_keyboard: [[{ text: statusBadge(job.status), callback_data: 'noop' }]] }
  }
  const prefix = fileId ? `${fileId}:` : ''
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve',      callback_data: `appv:${prefix}${id}` },
        { text: '🚀 Publish Now',  callback_data: `pubn:${prefix}${id}` },
        { text: '⏰ Reschedule',    callback_data: `rsch:${prefix}${id}` },
      ],
      [
        { text: '✏️ Edit',         callback_data: `edit:${prefix}${id}` },
        { text: '🔄 Regenerate',   callback_data: `regn:${prefix}${id}` },
        { text: '⏭ Skip',          callback_data: `skip:${prefix}${id}` },
        { text: '❌ Reject',       callback_data: `rejt:${prefix}${id}` },
      ],
    ],
  }
}

export function formatHelp() {
  return [
    '🤖 <b>SocialForge control commands</b>',
    '',
    '<b>General</b>',
    '/start — register this chat as admin',
    '/help — this message',
    '/status — show current setup',
    '',
    '<b>Content queue</b>',
    '/pending — list pending drafts',
    '/today — scheduled/published for today',
    '/tomorrow — scheduled for tomorrow',
    '/publish &lt;jobId&gt; — publish a specific job now',
    '',
    '<b>Prompt styles</b>',
    '/styles — list styles',
    '/style &lt;name&gt; — activate a style',
    '',
    '<b>AI on the fly</b>',
    '/caption &lt;context&gt; — generate 4 platform captions',
    '/hashtag &lt;context&gt; — generate hashtags',
    '/rewrite &lt;text&gt; — friendly tone rewrite',
    '/shorten &lt;text&gt; — condense to ~60 words',
    '/expand &lt;text&gt; — expand to ~250 words',
    '/translate &lt;text&gt; — translate to Spanish',
    '',
    'Use the inline buttons under each draft to Approve, Post now, Schedule, Regenerate, Edit, Skip, or Reject.',
    'After tapping Edit, send your new caption as a reply to this message.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// LinkedIn Engagement Assistant cards
// ---------------------------------------------------------------------------

export function formatLinkedInIntelCard(item) {
  const age = item.post_age_minutes
  const ageLabel = age < 60 ? `${age}m` : age < 1440 ? `${Math.round(age / 60)}h` : `${Math.round(age / 1440)}d`
  const vis = { high: 'High', medium: 'Medium', low: 'Low' }[item.visibility] || item.visibility
  const lines = []
  lines.push(`💬 <b>LinkedIn Engagement Opportunity</b>`)
  lines.push('')
  lines.push(`<b>Author:</b> ${esc(item.author || 'LinkedIn discussion')}`)
  lines.push(`<b>Post Age:</b> ${ageLabel}`)
  lines.push(`<b>Topic:</b> ${esc(item.topic || '—')}`)
  lines.push('')
  lines.push(`<b>Why this post?</b>`)
  lines.push(`✓ Matches ${esc(item.topic || 'interests')}`)
  lines.push(`✓ High engagement potential (${item.engagement || 0}/100)`)
  lines.push(`✓ Relevant to your audience`)
  lines.push('')
  lines.push(`<b>Suggested Comment</b>`)
  lines.push(`"${esc(item.comment || '')}"`)
  lines.push('')
  lines.push(`Comment Quality: <b>${item.quality || 0}/100</b>`)
  lines.push(`Estimated Visibility: <b>${vis}</b>`)
  if (item.url) lines.push(esc(item.url).slice(0, 300))
  return lines.join('\n')
}

export function buildLinkedInIntelKeyboard(id) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve & Comment', callback_data: `lcmt_appv:${id}` },
        { text: '✏️ Edit', callback_data: `lcmt_edit:${id}` },
      ],
      [
        { text: '🔄 Regenerate', callback_data: `lcmt_regn:${id}` },
        { text: '❌ Skip', callback_data: `lcmt_skip:${id}` },
        { text: '🔖 Save', callback_data: `lcmt_sav:${id}` },
      ],
    ],
  }
}
