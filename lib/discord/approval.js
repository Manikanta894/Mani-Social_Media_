// ============================================================================
// Discord Command Center — Approval Center & Publishing
// Content previews, approve/edit/regenerate/reject, and live publishing status.
// ============================================================================

import { storage } from '../storage'
import { getChannelId } from './channels'
import { sendMessage, editMessage, embed, field, actionRow, button, progressBar } from './client'

const PLATFORM_META = {
  linkedin:  { emoji: '💼', label: 'LinkedIn',  limit: 3000 },
  instagram: { emoji: '📷', label: 'Instagram', limit: 2200 },
  facebook:  { emoji: '👥', label: 'Facebook',  limit: 5000 },
  threads:   { emoji: '🧵', label: 'Threads',   limit: 500 },
  blog:      { emoji: '📝', label: 'Blog',      limit: 40000 },
  newsletter:{ emoji: '✉️', label: 'Newsletter', limit: 10000 },
}

export function statusColor(status) {
  return {
    draft: 0x95A5A6, pending_approval: 0xF1C40F, approved: 0x2ECC71,
    scheduled: 0x3498DB, published: 0x27AE60, rejected: 0xE74C3C,
    failed: 0xE74C3C, processing: 0x9B59B6, queued: 0x95A5A6,
  }[status] || 0x5865F2
}

export function statusLabel(status) {
  return {
    draft: '📝 Draft', pending_approval: '⏳ Pending Approval', approved: '✅ Approved',
    scheduled: '📆 Scheduled', published: '🚀 Published', rejected: '❌ Rejected',
    failed: '❌ Failed', processing: '⚙️ Processing', queued: '📋 Queued',
  }[status] || status
}

// Build an AI Quality Panel (visible progress bars) for a job's drafts.
export async function buildQualityPanel(job) {
  try {
    const { assessQuality } = await import('../quality-engine')
    const posts = job.platform_posts || {}
    const platforms = Object.keys(posts).filter(p => posts[p]?.caption)
    if (!platforms.length) return null
    const rows = await Promise.all(platforms.map(async p => ({
      platform: p,
      quality: await assessQuality({
        platform: p,
        caption: posts[p].caption || '',
        hashtags: posts[p].hashtags || [],
        styleName: job.style_name || '',
      }),
    })))
    const average = Math.round(rows.reduce((a, r) => a + (r.quality.score || 0), 0) / rows.length)
    const lines = rows.map(r => {
      const q = r.quality
      const label = PLATFORM_META[r.platform]?.label || r.platform
      return `${label} — **${q.score}/100** ${progressBar(q.score, 10)}\n` +
        `Grammar ${q.checks.grammar} · Hook ${q.checks.hook} · CTA ${q.checks.cta} · SEO/Hashtags ${q.checks.hashtags} · Readability ${q.checks.readability} · Platform ${q.checks.platform_fit}`
    })
    return { average, lines }
  } catch (e) {
    console.warn('[discord] quality panel failed:', e.message)
    return null
  }
}

export async function buildContentPreviewEmbed(job) {
  const fields = []
  if (job.topic) fields.push(field('📌 Topic', job.topic.slice(0, 200), false))
  fields.push(field('📊 Status', statusLabel(job.status), true))
  fields.push(field('📈 Est. Reach', job.estimated_reach ? `${Number(job.estimated_reach).toLocaleString()}` : '—', true))
  if (job.scheduled_for) fields.push(field('📅 Scheduled', new Date(job.scheduled_for).toLocaleString(), true))

  // AI Quality Panel (spec: visible quality panel with progress bars)
  try {
    const panel = await buildQualityPanel(job)
    if (panel) {
      fields.push(field('🎯 AI Quality Panel', `**Average: ${panel.average}/100**\n${panel.lines.join('\n')}`, false))
    }
  } catch {}

  for (const [key, meta] of Object.entries(PLATFORM_META)) {
    const post = job.platform_posts?.[key]
    if (!post?.caption) continue
    const caption = post.caption
    const tags = Array.isArray(post.hashtags) ? post.hashtags.join(' ') : ''
    const over = caption.length > meta.limit
    const confidence = post.ai_confidence ? ` · Confidence: ${Math.round(post.ai_confidence * 100)}%` : ''
    let value = `**${caption.length}/${meta.limit} chars**${over ? ' ⚠️' : ''}${confidence}\n\n${caption.slice(0, 900)}`
    if (post.hook) value = `**Hook:** ${post.hook.slice(0, 150)}\n` + value
    if (tags) value += `\n\n**Hashtags:** ${tags.slice(0, 300)}`
    if (post.cta) value += `\n\n**CTA:** ${post.cta.slice(0, 100)}`
    if (post.seo_keywords) value += `\n\n**SEO:** ${post.seo_keywords.slice(0, 150)}`
    fields.push(field(`${meta.emoji} ${meta.label}`, value, false))
  }

  if (Array.isArray(job.warnings) && job.warnings.length) {
    fields.push(field('⚠️ Warnings', job.warnings.slice(0, 4).join('\n').slice(0, 900), false))
  }

  return embed({
    title: `🎨 Content Preview — ${job.topic?.slice(0, 60) || 'Untitled'}`,
    description: `**Job ID:** \`${job.id}\`\n**Status:** ${statusLabel(job.status)}`,
    color: statusColor(job.status),
    fields,
    footer: 'SocialForge Approval Center',
    timestamp: new Date().toISOString(),
    image: job.image_ref || undefined,
  })
}

export function buildApprovalButtons(jobId, fileId = null) {
  const prefix = fileId ? `${fileId}:` : ''
  return [
    actionRow([
      button({ label: '✅ Approve', customId: `appv:${prefix}${jobId}`, style: 3, emoji: '✅' }),
      button({ label: '🚀 Publish Now', customId: `pubn:${prefix}${jobId}`, style: 1, emoji: '🚀' }),
      button({ label: '📅 Schedule', customId: `schd:${prefix}${jobId}`, style: 2, emoji: '📅' }),
    ]),
    actionRow([
      button({ label: '🖼️ New Image', customId: `nimg:${prefix}${jobId}`, style: 2, emoji: '🖼️' }),
      button({ label: '✏️ Edit', customId: `edit:${prefix}${jobId}`, style: 2, emoji: '✏️' }),
      button({ label: '🔄 Regenerate', customId: `regn:${prefix}${jobId}`, style: 2, emoji: '🔄' }),
    ]),
    actionRow([
      button({ label: '⏭ Skip', customId: `skip:${prefix}${jobId}`, style: 2, emoji: '⏭' }),
      button({ label: '❌ Reject', customId: `rejt:${prefix}${jobId}`, style: 4, emoji: '❌' }),
    ]),
  ]
}

export async function sendDraftToApproval(job, fileId = null) {
  const channelId = await getChannelId('social-approval')
  if (!channelId) return { skipped: 'social-approval channel not configured' }

  // V2 — AI Content Review Center card (12 sections, no placeholders)
  const { buildReviewEmbed, buildReviewButtons, getImageMeta } = await import('./review-center')
  let queueRow = null
  if (fileId) {
    try { queueRow = await storage.driveQueue.getByFileId(fileId) } catch {}
  }
  const imageMeta = await getImageMeta(fileId || (job.image_ref || '').split('/').pop())
  const reviewEmbed = await buildReviewEmbed(job, { fileId, queueRow, imageMeta })
  const buttons = buildReviewButtons(job.id, fileId)

  const msg = await sendMessage({ channelId, embeds: [reviewEmbed], components: buttons })
  await storage.jobs.update(job.id, {
    discord_channel_id: String(channelId),
    discord_message_id: msg.id,
    status: job.status === 'draft' ? 'pending_approval' : job.status,
  })
  return { sent: true, messageId: msg.id }
}

export async function updateApprovalMessage({ channelId, messageId, job, extraFields = [] }) {
  const previewEmbed = await buildContentPreviewEmbed(job)
  if (extraFields.length) previewEmbed.fields = [...previewEmbed.fields, ...extraFields]
  const buttons = buildApprovalButtons(job.id)
  await editMessage({ channelId, messageId, embeds: [previewEmbed], components: buttons })
}

// --- Publishing Center -----------------------------------------------------

export async function sendPublishResult({ job, results }) {
  const channelId = await getChannelId('published-log')
  if (!channelId) return { skipped: 'published-log channel not configured' }

  const fields = results.map(r => {
    const emoji = r.ok ? '✅' : '❌'
    const value = r.ok
      ? `**Published**\n${r.url ? `🔗 ${r.url}` : ''}\n🕐 ${new Date().toLocaleString()}`
      : `**Failed**\n\`\`\`${(r.error || 'Unknown error').slice(0, 300)}\`\`\``
    return field(`${emoji} ${PLATFORM_META[r.platform]?.emoji || ''} ${r.platform}`, value, false)
  })

  const allOk = results.every(r => r.ok)
  const publishEmbed = embed({
    title: allOk ? '🚀 Publishing Complete' : '⚠️ Publishing Partial Failure',
    description: `**Job:** \`${job.id}\`\n**Topic:** ${job.topic?.slice(0, 100) || 'Untitled'}`,
    color: allOk ? 0x2ECC71 : 0xE74C3C,
    fields,
    footer: 'SocialForge Publishing Center',
    timestamp: new Date().toISOString(),
  })

  const components = [
    actionRow([
      button({ label: '📈 Analytics', customId: `pub_analytics:${job.id}`, style: 2, emoji: '📈' }),
      button({ label: '📜 Logs', customId: `pub_logs:${job.id}`, style: 2, emoji: '📜' }),
      ...(allOk ? [] : [button({ label: '🔄 Retry', customId: `pub_retry:${job.id}`, style: 1, emoji: '🔄' })]),
    ]),
  ]

  await sendMessage({ channelId, embeds: [publishEmbed], components })
  return { sent: true }
}

// Success embed — sent to #published-log after a FULL successful publish.
export async function sendPublishSuccess({ job, results, imageName = '', analyticsStarted = false, archived = false }) {
  const channelId = await getChannelId('published-log')
  if (!channelId) return { skipped: 'published-log channel not configured' }

  const okResults = results.filter(r => r.ok)
  const publishedAt = new Date().toLocaleString()
  let qualityScore = '—'
  try {
    const panel = await buildQualityPanel(job)
    if (panel) qualityScore = `${panel.average}/100`
  } catch {}

  const fields = [
    field('🆔 Job ID', `\`${job.id}\``, true),
    field('🎯 Quality Score', qualityScore, true),
    field('🕐 Published Time', publishedAt, true),
    field('🖼 Image', imageName || (job.topic || '—').slice(0, 100), true),
    field('📈 Analytics Started', analyticsStarted ? '✅ Yes' : '⏳ Pending', true),
    field('🗄 Archive Moved', archived ? '✅ Completed' : '⏳ Pending', true),
  ]
  for (const r of okResults) {
    fields.push(field(`${PLATFORM_META[r.platform]?.emoji || ''} ${PLATFORM_META[r.platform]?.label || r.platform}`, r.url ? `🔗 ${r.url}` : 'Published', false))
  }

  const embedCard = embed({
    title: '✅ Publish Success — Job Complete',
    description: `**Topic:** ${job.topic?.slice(0, 150) || 'Untitled'}`,
    color: 0x2ECC71,
    fields,
    footer: 'SocialForge Published Log',
    timestamp: new Date().toISOString(),
    image: job.image_ref || undefined,
  })
  await sendMessage({ channelId, embeds: [embedCard] })
  return { sent: true }
}

// Failure embed — sent to #failed-jobs. Image is NEVER archived on failure.
export async function sendPublishFailure({ job, results, imageName = '' }) {
  const channelId = await getChannelId('failed-jobs')
  if (!channelId) return { skipped: 'failed-jobs channel not configured' }

  const errors = results.filter(r => !r.ok).map(r => `**${PLATFORM_META[r.platform]?.label || r.platform}:** \`\`\`${(r.error || 'Unknown').slice(0, 250)}\`\`\``)
  const okP = results.filter(r => r.ok).map(r => r.platform)

  const embedCard = embed({
    title: '❌ Publish Failed — Job Not Complete',
    description: `**Job:** \`${job.id}\`\n**Topic:** ${job.topic?.slice(0, 150) || 'Untitled'}`,
    color: 0xE74C3C,
    fields: [
      field('🖼 Image', imageName || '—', true),
      field('✅ Published Platforms', okP.length ? okP.join(', ') : 'None', true),
      field('🗄 Archive', '⚠️ NOT archived (failed job)', true),
      field('❌ Errors', errors.join('\n').slice(0, 1000), false),
    ],
    footer: 'SocialForge Failed Jobs',
    timestamp: new Date().toISOString(),
  })
  const components = [
    actionRow([
      button({ label: '🔄 Retry', customId: `pub_retry:${job.id}`, style: 1, emoji: '🔄' }),
      button({ label: '📜 Logs', customId: `pub_logs:${job.id}`, style: 2, emoji: '📜' }),
    ]),
  ]
  await sendMessage({ channelId, embeds: [embedCard], components })
  return { sent: true }
}

// --- LinkedIn Engagement ---------------------------------------------------

export async function buildLinkedInEngagementEmbed(item) {
  const age = item.post_age_minutes
  const ageLabel = age < 60 ? `${age}m` : age < 1440 ? `${Math.round(age / 60)}h` : `${Math.round(age / 1440)}d`
  const vis = { high: '🟢 High', medium: '🟡 Medium', low: '🔴 Low' }[item.visibility] || item.visibility

  return embed({
    title: '💬 LinkedIn Engagement Opportunity',
    description: `**Author:** ${item.author || 'LinkedIn discussion'}\n**Post Age:** ${ageLabel}\n**Topic:** ${item.topic || '—'}`,
    color: 0x0A66C2,
    fields: [
      field('📰 Post', item.title?.slice(0, 200) || 'Untitled', false),
      field('💡 Why This Post', `✓ Matches ${item.topic || 'interests'}\n✓ Engagement: ${item.engagement || 0}/100\n✓ Relevance: ${item.relevance || 0}/100`, false),
      field('💬 Suggested Comment', `"${item.comment || ''}"`, false),
      field('📊 Quality', `${item.quality || 0}/100`, true),
      field('👁️ Visibility', vis, true),
    ],
    footer: 'SocialForge LinkedIn Engagement',
    timestamp: new Date().toISOString(),
    url: item.url || undefined,
  })
}

export function buildLinkedInEngagementButtons(id) {
  return [
    actionRow([
      button({ label: '✅ Approve & Comment', customId: `li_appv:${id}`, style: 3, emoji: '✅' }),
      button({ label: '✏️ Edit', customId: `li_edit:${id}`, style: 2, emoji: '✏️' }),
      button({ label: '🔄 Regenerate', customId: `li_regn:${id}`, style: 2, emoji: '🔄' }),
    ]),
    actionRow([
      button({ label: '❌ Reject', customId: `li_rejt:${id}`, style: 4, emoji: '❌' }),
      button({ label: '🔖 Save', customId: `li_sav:${id}`, style: 3, emoji: '🔖' }),
    ]),
  ]
}

export async function sendLinkedInOpportunity(item) {
  const channelId = await getChannelId('linkedin-engagement')
  if (!channelId) return { skipped: 'linkedin-engagement channel not configured' }

  const liEmbed = await buildLinkedInEngagementEmbed(item)
  const buttons = buildLinkedInEngagementButtons(item.id)
  await sendMessage({ channelId, embeds: [liEmbed], components: buttons })
  return { sent: true }
}

// ---------------------------------------------------------------------------
// Blog Approval Center — identical UX to social approval cards
// ---------------------------------------------------------------------------

export function buildBlogApprovalButtons(fileId) {
  const prefix = fileId ? `${fileId}:` : 'topic:'
  return [
    actionRow([
      button({ label: '✅ Approve', customId: `bappv:${prefix}`, style: 3, emoji: '✅' }),
      button({ label: '🚀 Publish Now', customId: `bpubn:${prefix}`, style: 1, emoji: '🚀' }),
      button({ label: '📅 Schedule', customId: `bschd:${prefix}`, style: 2, emoji: '📅' }),
    ]),
    actionRow([
      button({ label: '🖼️ New Image', customId: `bnimg:${prefix}`, style: 2, emoji: '🖼️' }),
      button({ label: '✏️ Edit', customId: `bedit:${prefix}`, style: 2, emoji: '✏️' }),
      button({ label: '🔄 Regenerate', customId: `bregn:${prefix}`, style: 2, emoji: '🔄' }),
    ]),
    actionRow([
      button({ label: '⏭ Skip', customId: `bskip:${prefix}`, style: 2, emoji: '⏭' }),
      button({ label: '❌ Reject', customId: `brejt:${prefix}`, style: 4, emoji: '❌' }),
    ]),
  ]
}

export function buildBlogPreviewEmbed(article, { fileName = '', imageUrl = '', status = 'pending_approval' } = {}) {
  const fields = []
  const words = String(article?.content || '').split(/\s+/).filter(Boolean).length
  const seo = Number(article?.seoScore) || 0
  const readability = Number(article?.readabilityScore) || 0
  const primaryKw = Array.isArray(article?.keywords)
    ? article.keywords[0]
    : String(article?.keywords || '').split(',')[0]?.trim() || '—'
  fields.push(field('📊 Status', statusLabel(status), true))
  fields.push(field('📏 Word Count', String(words), true))
  if (article?.category) fields.push(field('🗂 Category', article.category, true))
  fields.push(field('🔑 Primary Keyword', primaryKw.slice(0, 100), false))
  if (article?.metaDescription) fields.push(field('📝 Meta Description', article.metaDescription.slice(0, 200), false))
  fields.push(field('🎯 SEO Score', `**${seo}/100** ${progressBar(seo, 10)}`, true))
  fields.push(field('📖 Readability', `**${readability}/100** ${progressBar(readability, 10)}`, true))
  fields.push(field('🤖 AI Summary', String(article?.excerpt || article?.content || '').slice(0, 400), false))
  if (article?.tags?.length) fields.push(field('🏷️ Tags', article.tags.slice(0, 8).join(', ').slice(0, 200), false))

  return embed({
    title: `📝 Blog Preview — ${(article?.title || 'Untitled').slice(0, 60)}`,
    description: `**Source Image:** ${fileName || 'Topic Queue'}\n**Slug:** \`${article?.slug || '—'}\``,
    color: statusColor(status),
    fields,
    footer: 'SocialForge Blog Approval Center',
    timestamp: new Date().toISOString(),
    image: imageUrl || undefined,
  })
}

export async function sendBlogToApproval({ article, fileId = null, status = 'pending_approval', fileName = '', imageUrl = '' }) {
  const channelId = await getChannelId('blog-approval')
  if (!channelId) return { skipped: 'blog-approval channel not configured' }

  const previewEmbed = buildBlogPreviewEmbed(article, { fileName, imageUrl, status })
  const buttons = buildBlogApprovalButtons(fileId)
  const msg = await sendMessage({ channelId, embeds: [previewEmbed], components: buttons })
  if (fileId) {
    try {
      const row = await storage.blogQueue.getByFileId(fileId)
      if (row) await storage.blogQueue.update(row.id, {
        discord_channel_id: String(channelId),
        discord_message_id: msg.id,
      })
    } catch {}
  }
  return { sent: true, messageId: msg.id }
}

// Blog publish success → #published-log
export async function sendBlogPublishSuccess({ article, url, imageName = '', fileId = null }) {
  const channelId = await getChannelId('published-log')
  if (!channelId) return { skipped: 'published-log channel not configured' }
  const words = String(article?.content || '').split(/\s+/).filter(Boolean).length
  const seo = Number(article?.seoScore) || 0
  const embedCard = embed({
    title: '✅ Blog Published — Job Complete',
    description: `**${article?.title || 'Untitled'}**`,
    color: 0x2ECC71,
    fields: [
      field('🔗 URL', url || '—', false),
      field('🖼 Image', imageName || '—', true),
      field('🎯 SEO Score', `${seo}/100`, true),
      field('📏 Words', String(words), true),
      field('🗄 Archive', '✅ Completed', true),
      ...(fileId ? [field('🆔 File ID', `\`${fileId}\``, true)] : []),
    ],
    footer: 'SocialForge Published Log',
    timestamp: new Date().toISOString(),
  })
  await sendMessage({ channelId, embeds: [embedCard] })
  return { sent: true }
}

// Blog publish failure → #failed-jobs (image is never archived)
export async function sendBlogPublishFailure({ article = {}, error = '', imageName = '' }) {
  const channelId = await getChannelId('failed-jobs')
  if (!channelId) return { skipped: 'failed-jobs channel not configured' }
  const embedCard = embed({
    title: '❌ Blog Publish Failed — Job Not Complete',
    description: `**${article?.title || 'Untitled'}**`,
    color: 0xE74C3C,
    fields: [
      field('🖼 Image', imageName || '—', true),
      field('🗄 Archive', '⚠️ NOT archived (failed job)', true),
      field('❌ Error', `\`\`\`${String(error).slice(0, 500)}\`\`\``, false),
    ],
    footer: 'SocialForge Failed Jobs',
    timestamp: new Date().toISOString(),
  })
  await sendMessage({ channelId, embeds: [embedCard] })
  return { sent: true }
}