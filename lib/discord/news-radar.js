// ============================================================================
// Discord Command Center — News Radar
// Every detected opportunity appears as a rich Discord embed with full
// AI analysis and action buttons for generation, scheduling, and publishing.
// ============================================================================

import { storage } from '../storage'
import { getChannelId } from './channels'
import { sendMessage, editMessage, embed, field, actionRow, button, progressBar } from './client'

const PLATFORM_EMOJI = { linkedin: '💼', instagram: '📷', facebook: '👥', threads: '🧵', blog: '📝', newsletter: '✉️', carousel: '🎠' }

export function priorityColor(priority) {
  return { critical: 0xE74C3C, immediate: 0xE67E22, today: 0xF1C40F, tomorrow: 0x3498DB, weekly: 0x2ECC71, evergreen: 0x27AE60 }[priority] || 0x5865F2
}

export function priorityLabel(p) {
  return { critical: '🔴 Critical', immediate: '🚨 Immediate', today: '🟠 Today', tomorrow: '🟡 Tomorrow', weekly: '🟢 Weekly', evergreen: '🌲 Evergreen' }[p] || p
}

export async function buildNewsRadarEmbed(item, analysis) {
  const a = analysis || item.ai_analysis || {}
  const stars = Math.round((a.opportunity_score || 0) / 100 * 5)
  const recs = Object.entries(a.recommendations || {}).filter(([, v]) => v != null).sort((x, y) => y[1] - x[1]).slice(0, 5)

  const fields = [
    field('📰 Headline', item.title?.slice(0, 200) || 'Untitled', false),
    field('🏢 Source', item.source_name || '—', true),
    field('🕐 Published', item.published_at ? new Date(item.published_at).toLocaleString() : '—', true),
    field('📝 AI Summary', (a.why_matters || item.summary || '').slice(0, 300), false),
    field('💡 Why This Matters', (a.why_now || a.why_audience_cares || 'Relevant industry update.').slice(0, 200), false),
    field('🎓 MBA', `${a.mba_score || 0}/100`, true),
    field('📊 Business Analytics', `${a.business_analytics_score || 0}/100`, true),
    field('👥 HR', `${a.hr_score || 0}/100`, true),
    field('🔍 SEO Opportunity', `${a.seo_opportunity || 0}/100`, true),
    field('🔥 Virality', `${a.virality_score || 0}/100`, true),
    field('🎯 Audience Match', `${a.audience_match || 0}/100`, true),
    field('📈 Trend Score', `${a.trend_score || 0}/100`, true),
    field('⭐ Opportunity', `${a.opportunity_score || 0}/100 ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`, true),
    field('📏 Estimated Reach', `${((a.estimated_reach || 0) / 1000).toFixed(1)}K`, true),
    field('🔄 Lifecycle', `${a.lifecycle || '—'} · Peak in ~${a.peak_in_hours || 0}h`, true),
  ]

  if (recs.length) {
    fields.push(field('📱 Recommended Platforms', recs.map(([p, v]) => `${PLATFORM_EMOJI[p] || '•'} ${p.charAt(0).toUpperCase() + p.slice(1)}: **${v}%**`).join('\n'), false))
  }
  if (a.content_gap) fields.push(field('🧩 Content Gap', a.content_gap.slice(0, 200), false))
  if (a.competition_note) fields.push(field('⚔️ Competition', `${a.competition || '—'} — ${a.competition_note.slice(0, 150)}`, false))

  return embed({
    title: `🚨 AI Content Opportunity — ${priorityLabel(a.priority)}`,
    description: item.title?.slice(0, 200) || 'Untitled',
    color: priorityColor(a.priority),
    fields,
    footer: `Confidence: ${a.confidence || 0}% · ${item.source_name || ''}`,
    timestamp: new Date().toISOString(),
    url: item.url || undefined,
  })
}

export function buildNewsRadarButtons(newsId) {
  return [
    actionRow([
      button({ label: '⚙️ Generate All', customId: `news_genall:${newsId}`, style: 1, emoji: '⚙️' }),
      button({ label: '💼 LinkedIn', customId: `news_gen:${newsId}:linkedin`, style: 2, emoji: '💼' }),
      button({ label: '📷 Instagram', customId: `news_gen:${newsId}:instagram`, style: 2, emoji: '📷' }),
      button({ label: '👥 Facebook', customId: `news_gen:${newsId}:facebook`, style: 2, emoji: '👥' }),
      button({ label: '🧵 Threads', customId: `news_gen:${newsId}:threads`, style: 2, emoji: '🧵' }),
    ]),
    actionRow([
      button({ label: '📝 Blog', customId: `news_gen:${newsId}:blog`, style: 2, emoji: '📝' }),
      button({ label: '✉️ Newsletter', customId: `news_gen:${newsId}:newsletter`, style: 2, emoji: '✉️' }),
      button({ label: '📅 Schedule', customId: `news_sched:${newsId}`, style: 3, emoji: '📅' }),
      button({ label: '🔖 Save', customId: `news_save:${newsId}`, style: 3, emoji: '🔖' }),
      button({ label: '🔗 Read', customId: `news_read:${newsId}`, style: 5, url: undefined, emoji: '🔗' }),
    ]),
    actionRow([
      button({ label: '🔄 Re-analyze', customId: `news_reanalyze:${newsId}`, style: 2, emoji: '🔄' }),
      button({ label: '❌ Ignore', customId: `news_ignore:${newsId}`, style: 4, emoji: '❌' }),
    ]),
  ]
}

export async function sendNewsOpportunity(item, analysis) {
  const channelId = await getChannelId('news-radar')
  if (!channelId) return { skipped: 'news-radar channel not configured' }

  const newsEmbed = await buildNewsRadarEmbed(item, analysis)
  const buttons = buildNewsRadarButtons(item.id)

  const msg = await sendMessage({ channelId, embeds: [newsEmbed], components: buttons })
  return { sent: true, messageId: msg.id }
}

export async function updateNewsMessage({ channelId, messageId, item, analysis, extraFields = [] }) {
  const newsEmbed = await buildNewsRadarEmbed(item, analysis)
  if (extraFields.length) newsEmbed.fields = [...newsEmbed.fields, ...extraFields]
  const buttons = buildNewsRadarButtons(item.id)
  await editMessage({ channelId, messageId, embeds: [newsEmbed], components: buttons })
}

// Live generation progress — updates the same message as steps complete
export async function renderGenerationProgress({ title, step, stepIndex, totalSteps, status = 'running' }) {
  const pct = Math.round((stepIndex / totalSteps) * 100)
  const bar = progressBar(pct)
  const color = status === 'error' ? 0xE74C3C : status === 'done' ? 0x2ECC71 : 0x3498DB
  return embed({
    title: `🤖 AI Generation — ${title?.slice(0, 80) || 'Content'}`,
    description: `${bar} **${pct}%**\n\n**Current step:** ${step}\n\n${status === 'error' ? '❌ **Generation failed**' : status === 'done' ? '✅ **Complete**' : '⚙️ **Working…**'}`,
    color,
    footer: 'SocialForge AI Generation Engine',
    timestamp: new Date().toISOString(),
  })
}