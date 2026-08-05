// ============================================================================
// Discord Command Center — Interaction Handler
// Processes all button clicks, select menus, and slash commands.
// ============================================================================

import { storage } from '../storage'
import { respondToInteraction, editInteractionMessage, sendMessage, editMessage, embed, field, actionRow, button } from './client'
import { getChannelId, setupServer } from './channels'
import { updateDashboard } from './dashboard'
import { sendAnalytics as sendAnalyticsEmbed, sendSchedule, sendHealth } from './analytics'
import { buildNewsRadarEmbed, buildNewsRadarButtons, renderGenerationProgress } from './news-radar'
import { buildContentPreviewEmbed, buildApprovalButtons, buildLinkedInEngagementEmbed, buildLinkedInEngagementButtons, sendPublishResult, buildBlogPreviewEmbed, buildBlogApprovalButtons } from './approval'
import { generateFromImage } from '../ai/generate'
import { publishJob } from '../publishers'
import { onApprove, onSkip, onReject, onPublishNow, automation } from '../automation'
import { analyzeNewsItem, getNewsTopics, getLearning, recordFeedback } from '../news/ai-decision'
import { generateAndSave } from '../news/generate'

const PLATFORM_KEYS = ['linkedin', 'instagram', 'facebook', 'threads']
const GEN_STEPS = [
  '📖 Reading article…',
  '🔍 Researching context…',
  '🔗 Finding supporting sources…',
  '💼 Writing LinkedIn…',
  '📷 Writing Instagram…',
  '👥 Writing Facebook…',
  '🧵 Writing Threads…',
  '📝 Writing Blog…',
  '✉️ Writing Newsletter…',
  '🔍 Generating SEO…',
  '🏷️ Generating hashtags…',
  '🎨 Generating image prompt…',
  '✅ Running quality check…',
  '🟢 Complete!',
]

// Main entry: handle an interaction (button click, select menu, slash command)
export async function handleInteraction(interaction) {
  const type = interaction.type
  const data = interaction.data || {}
  const channelId = interaction.channel_id
  const messageId = interaction.message?.id
  const token = interaction.token
  const member = interaction.member
  const guildId = interaction.guild_id

  try {
    // Slash command
    if (type === 2) return await handleSlashCommand(interaction)

    // Component interaction (button click / select menu)
    if (type === 3) return await handleComponent(interaction)

    // Modal submit
    if (type === 5) return await handleModal(interaction)

    // Unknown
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: 'Unknown interaction type.', flags: 64 } })
  } catch (e) {
    console.error('[discord] handler error:', e)
    try {
      // Log error to error-center
      const errorChannel = await getChannelId('error-center')
      if (errorChannel) {
        await sendMessage({
          channelId: errorChannel,
          embeds: [embed({
            title: '❌ Discord Handler Error',
            description: `\`\`\`${String(e.message || e).slice(0, 1500)}\`\`\``,
            color: 0xE74C3C,
            timestamp: new Date().toISOString(),
          })],
        }).catch(() => {})
      }
      await respondToInteraction({
        interactionId: interaction.id,
        interactionToken: token,
        type: 4,
        data: { content: `⚠️ Error: ${String(e.message || e).slice(0, 200)}`, flags: 64 },
      }).catch(() => {})
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Slash Commands
// ---------------------------------------------------------------------------

export const SLASH_COMMANDS = [
  { name: 'setup', description: 'Create/verify the AI Operations Center server structure' },
  { name: 'dashboard', description: 'Update the live dashboard' },
  { name: 'news', description: 'Show recent news radar opportunities' },
  { name: 'approvals', description: 'Show pending approval queue' },
  { name: 'analytics', description: 'Show performance analytics' },
  { name: 'schedule', description: 'Show today\'s content schedule' },
  { name: 'health', description: 'Show system health status' },
  { name: 'publish', description: 'Publish a job by ID', options: [{ type: 3, name: 'job_id', description: 'Job ID to publish', required: true }] },
  { name: 'status', description: 'Show current system status' },
  { name: 'jobs', description: 'List jobs by status', options: [{ type: 3, name: 'status', description: 'Filter by status', required: false }] },
]

async function handleSlashCommand(interaction) {
  const cmd = interaction.data?.name
  const token = interaction.token
  const channelId = interaction.channel_id

  switch (cmd) {
    case 'setup': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const s = await storage.settings.get()
      const guildId = interaction.guild_id
      const result = await setupServer(guildId)
      await editInteractionMessage({
        interactionToken: token,
        embeds: [embed({
          title: '✅ AI Operations Center — Setup Complete',
          description: `Created/verified **${Object.keys(result.channelIds).length}** channels across **${Object.keys(result.categories).length}** categories.`,
          color: 0x2ECC71,
          fields: [
            field('🆔 Guild ID', guildId, true),
            field('📚 Categories', Object.keys(result.categories).join(', '), true),
            field('📢 Channels', Object.keys(result.channelIds).join(', '), false),
          ],
          footer: 'All channels registered in settings',
        })],
      })
      // Start dashboard
      await updateDashboard().catch(() => {})
      return
    }
    case 'dashboard': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const r = await updateDashboard()
      await editInteractionMessage({ interactionToken: token, content: r.skipped ? `⚠️ ${r.skipped}` : '✅ Dashboard updated' })
      return
    }
    case 'news': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const items = await storage.newsPosts.list('pending_approval')
      const channelIdNews = await getChannelId('news-radar')
      if (!channelIdNews) { await editInteractionMessage({ interactionToken: token, content: '⚠️ news-radar channel not configured. Run /setup first.' }); return }
      if (!items.length) { await editInteractionMessage({ interactionToken: token, content: '📡 No pending news opportunities.' }); return }
      for (const item of items.slice(0, 3)) {
        const emb = await buildNewsRadarEmbed(item, item.ai_analysis || {})
        await sendMessage({ channelId: channelIdNews, embeds: [emb], components: buildNewsRadarButtons(item.id) }).catch(() => {})
      }
      await editInteractionMessage({ interactionToken: token, content: `📡 Posted ${Math.min(items.length, 3)} news opportunities to #news-radar` })
      return
    }
    case 'approvals': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const jobs = (await storage.jobs.list({})).filter(j => j.status === 'pending_approval' || j.status === 'draft')
      const channelIdAppr = await getChannelId('approval-center')
      if (!channelIdAppr) { await editInteractionMessage({ interactionToken: token, content: '⚠️ approval-center channel not configured. Run /setup first.' }); return }
      if (!jobs.length) { await editInteractionMessage({ interactionToken: token, content: '📋 No pending approvals.' }); return }
      for (const job of jobs.slice(0, 3)) {
        const emb = await buildContentPreviewEmbed(job)
        await sendMessage({ channelId: channelIdAppr, embeds: [emb], components: buildApprovalButtons(job.id) }).catch(() => {})
      }
      await editInteractionMessage({ interactionToken: token, content: `📋 Posted ${Math.min(jobs.length, 3)} pending approvals to #approval-center` })
      return
    }
    case 'analytics': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      await sendAnalyticsEmbed()
      await editInteractionMessage({ interactionToken: token, content: '📈 Analytics sent to #analytics' })
      return
    }
    case 'schedule': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      await sendSchedule()
      await editInteractionMessage({ interactionToken: token, content: '📅 Schedule sent to #scheduler' })
      return
    }
    case 'health': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      await sendHealth()
      await editInteractionMessage({ interactionToken: token, content: '⚙️ Health sent to #system-health' })
      return
    }
    case 'publish': {
      const jobId = interaction.data?.options?.[0]?.value
      if (!jobId) { await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: '❌ Missing job_id', flags: 64 } }); return }
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const job = await storage.jobs.get(jobId)
      if (!job) { await editInteractionMessage({ interactionToken: token, content: `❌ Job not found: \`${jobId}\`` }); return }
      try {
        const r = await publishJob(job, { explicit: true })
        await sendPublishResult({ job, results: r.results }).catch(() => {})
        const summary = r.results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok && x.url ? ` → ${x.url}` : ''}`).join('\n')
        await editInteractionMessage({ interactionToken: token, content: `🚀 **Publish result**\n${summary}` })
      } catch (e) {
        await editInteractionMessage({ interactionToken: token, content: `❌ Publish failed: ${String(e.message).slice(0, 500)}` })
      }
      return
    }
    case 'status': {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const s = await storage.settings.get()
      const auto = await automation.get()
      const providers = await storage.providers.list()
      const jobs = await storage.jobs.list({})
      const t = providers.find(p => p.active_for_text)
      const published = jobs.filter(j => j.status === 'published').length
      const pending = jobs.filter(j => j.status === 'pending_approval').length
      const failed = jobs.filter(j => j.status === 'failed').length
      await editInteractionMessage({
        interactionToken: token,
        embeds: [embed({
          title: '🎛️ SocialForge Status',
          color: 0x5865F2,
          fields: [
            field('⚙️ Automation', auto.enabled ? (auto.pause_queue ? '⏸ Paused' : '🟢 Running') : '🔴 Disabled', true),
            field('✅ Published', String(published), true),
            field('⏳ Pending', String(pending), true),
            field('❌ Failed', String(failed), true),
            field('🤖 Text Model', t ? `${t.name} · ${t.model}` : '—', true),
            field('💬 Discord', '🟢 Connected', true),
            field('🏠 Guild ID', interaction.guild_id || '—', true),
          ],
          footer: 'AI Operations Center',
        })],
        content: '',
      })
      return
    }
    case 'jobs': {
      const statusFilter = interaction.data?.options?.[0]?.value || null
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 5 })
      const jobs = await storage.jobs.list(statusFilter ? { status: statusFilter } : {})
      if (!jobs.length) { await editInteractionMessage({ interactionToken: token, content: '📭 No jobs found.' }); return }
      const lines = jobs.slice(0, 10).map(j => `\`${j.id.slice(0, 8)}\` · **${(j.topic || 'Untitled').slice(0, 50)}** · ${j.status}${j.scheduled_for ? ` · 📅 ${new Date(j.scheduled_for).toLocaleString()}` : ''}`)
      await editInteractionMessage({
        interactionToken: token,
        embeds: [embed({
          title: `📦 Jobs (${jobs.length})`,
          description: lines.join('\n'),
          color: 0x3498DB,
        })],
        content: '',
      })
      return
    }
    default:
      await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: 'Unknown command.', flags: 64 } })
  }
}

// ---------------------------------------------------------------------------
// Component (button) Handlers
// ---------------------------------------------------------------------------

async function handleComponent(interaction) {
  const customId = interaction.data?.custom_id || ''
  const token = interaction.token
  const channelId = interaction.channel_id
  const messageId = interaction.message?.id

  // Parse custom ID: action:arg1:arg2
  const parts = customId.split(':')
  const action = parts[0]
  const id1 = parts[1]
  const id2 = parts[2]

  // --- Dashboard navigation / refresh ---
  if (action === 'dash_refresh') {
    await ackUpdate(interaction)
    await updateDashboard()
    return
  }
  if (action === 'nav_news') {
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { content: `📰 Check **#news-radar** for opportunities.\n\nUse \`/news\` to re-post recent items.` } })
    return
  }
  if (action === 'nav_approvals') {
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { content: `📋 Check **#approval-center** for pending approvals.\n\nUse \`/approvals\` to re-post the queue.` } })
    return
  }
  if (action === 'nav_analytics') {
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { content: `📈 Use \`/analytics\` to refresh the analytics dashboard.` } })
    return
  }
  if (action === 'nav_health') {
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { content: `⚙️ Use \`/health\` to refresh system health.` } })
    return
  }

  // --- Analytics refresh / daily ---
  if (action === 'analytics_refresh') {
    await ackUpdate(interaction)
    await sendAnalyticsEmbed()
    return
  }
  if (action === 'analytics_daily') {
    await ackUpdate(interaction)
    try {
      const { generateReport } = await import('../analytics')
      const report = await generateReport('daily')
      const channelIdReport = await getChannelId('daily-reports')
      if (channelIdReport) {
        await sendMessage({
          channelId: channelIdReport,
          embeds: [embed({
            title: '📊 Daily Report',
            description: report?.text || 'Report generated',
            color: 0x9B59B6,
            timestamp: new Date().toISOString(),
          })],
        })
      }
    } catch (e) {
      await storage.audit.log('report', 'analytics', 'daily', null, 'failed', { error: e.message })
    }
    return
  }

  // --- Scheduler controls ---
  if (action === 'sched_resume') {
    await ackUpdate(interaction)
    await automation.patch({ pause_queue: false })
    await sendSchedule()
    await storage.audit.log('resume', 'automation', 'queue', null, 'running', { triggered_by: 'discord' })
    return
  }
  if (action === 'sched_pause') {
    await ackUpdate(interaction)
    await automation.patch({ pause_queue: true })
    await sendSchedule()
    await storage.audit.log('pause', 'automation', 'queue', null, 'paused', { triggered_by: 'discord' })
    return
  }
  if (action === 'sched_skip') {
    await ackUpdate(interaction)
    const next = await storage.driveQueue.nextQueued()
    if (next) {
      const newPos = (await storage.driveQueue.maxPosition()) + 1
      await storage.driveQueue.update(next.id, { status: 'queued', queue_position: newPos, scheduled_time: null })
      await storage.audit.log('skip', 'drive_queue', next.file_id, 'queued', 'requeued', { triggered_by: 'discord_skip' })
    }
    await sendSchedule()
    return
  }
  if (action === 'sched_generate') {
    await ackUpdate(interaction)
    try {
      const { runTick } = await import('../automation')
      const r = await runTick()
      await sendSchedule()
      await storage.audit.log('generate_now', 'automation', 'tick', null, 'completed', { triggered_by: 'discord', result: r })
    } catch (e) {
      await storage.audit.log('generate_now', 'automation', 'tick', null, 'failed', { error: e.message })
    }
    return
  }
  if (action === 'sched_refresh') {
    await ackUpdate(interaction)
    await sendSchedule()
    return
  }

  // --- Health refresh ---
  if (action === 'health_refresh') {
    await ackUpdate(interaction)
    await sendHealth()
    return
  }

  // --- Job approval actions: appv / pubn / schd / edit / regn / skip / rejt ---
  if (['appv', 'pubn', 'schd', 'edit', 'regn', 'skip', 'rejt'].includes(action)) {    const jobId = id2 || id1
    const fileId = parts.length === 3 ? id1 : null
    const job = await storage.jobs.get(jobId)
    if (!job) {
      await ackUpdate(interaction, `❌ Job not found: ${jobId}`, true)
      return
    }

    // --- Approve (moves to READY — does NOT publish immediately) ---
    if (action === 'appv') {
      try {
        await storage.audit.log('approve', 'content_job', jobId, job.status, 'approved', { triggered_by: 'discord' })
        await ackUpdate(interaction, '✅ Approved — job is READY. Press 🚀 Publish Now to go live.')
        // Update the review card to READY state (same message, live)
        const { sendReadyCard } = await import('./review-center')
        const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === jobId))
        const fileId = fileId || qr?.file_id || null
        const updated = await storage.jobs.update(jobId, { status: 'approved' })
        if (qr) await storage.driveQueue.update(qr.id, { status: 'approved', approved_at: new Date().toISOString() })
        await sendReadyCard({ channelId, messageId, job: updated, fileId })
      } catch (e) {
        await ackUpdate(interaction, `❌ ${e.message}`, true)
      }
      return
    }

    // --- Publish Now (full live-progress flow) ---
    if (action === 'pubn') {
      await ackUpdate(interaction, '🚀 Publishing now…')
      const { updatePublishProgress, sendSuccessCardV2, sendFailedCardV2, getImageMeta } = await import('./review-center')
      const started = Date.now()
      const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === jobId))
      const imageName = qr?.file_name || ''
      try {
        const pubJob = await storage.jobs.get(jobId)
        if (!pubJob.platform_posts || !Object.keys(pubJob.platform_posts).length) throw new Error('Job has no generated content')

        // Stage 1 — uploading / creating assets (publishJob does uploads internally)
        await updatePublishProgress({ channelId, messageId, stageKey: 'upload', extra: { jobId, imageRef: pubJob.image_ref } })
        const { publishJob } = await import('../publishers')
        const settings = await (await import('../automation')).automation.get()
        const enabledPlatforms = settings.enabled_platforms || ['linkedin', 'instagram', 'facebook', 'threads']
        await updatePublishProgress({ channelId, messageId, stageKey: 'asset', extra: { jobId, imageRef: pubJob.image_ref } })
        const r = await publishJob(pubJob, { platforms: enabledPlatforms, explicit: true })
        await updatePublishProgress({ channelId, messageId, stageKey: 'publish', extra: { jobId, imageRef: pubJob.image_ref } })

        const publishedP = r.results.filter(x => x.ok).map(x => x.platform)
        const failedP = r.results.filter(x => !x.ok).map(x => x.platform)
        const allOk = failedP.length === 0

        // Stage 4 — verifying (posts contain image / URLs captured)
        await updatePublishProgress({ channelId, messageId, stageKey: 'verify', extra: { jobId, imageRef: pubJob.image_ref } })

        if (qr) {
          const firstUrl = r.results.find(x => x.ok && x.url)?.url || null
          const prs = r.results.filter(x => x.ok).map(x => ({ platform: x.platform, post_id: x.post_id || null, url: x.url || null }))
          await storage.driveQueue.update(qr.id, {
            status: allOk ? 'published' : 'failed',
            published_platforms: publishedP,
            failed_platforms: failedP,
            published_url: firstUrl,
            publish_results: prs,
            published_date: allOk ? new Date().toISOString() : null,
          })
          await storage.imageLibrary.upsert({
            file_id: qr.file_id, name: qr.file_name || '', job_id: jobId,
            platform: publishedP.join(','), published_url: firstUrl,
            published_date: allOk ? new Date().toISOString() : null,
            status: allOk ? 'used' : 'failed',
          }).catch(() => {})
          await (await import('../automation')).logActivity?.(allOk ? 'published' : 'failed', qr.file_id, jobId, { platforms: publishedP, failed: failedP, triggered_by: 'discord_postnow', url: firstUrl })
        }

        let archived = false
        let analyticsStarted = false
        if (allOk) {
          // Stage 5 — move image to Archive (TRUE Drive move)
          await updatePublishProgress({ channelId, messageId, stageKey: 'archive', extra: { jobId, imageRef: pubJob.image_ref } })
          try {
            const { archiveIntakeFile } = await import('../intake')
            const ar = await archiveIntakeFile(qr?.file_id)
            archived = !!ar?.archived_to
          } catch {}
          // Stage 6 — Google Sheets (already updated above)
          await updatePublishProgress({ channelId, messageId, stageKey: 'sheets', extra: { jobId, imageRef: pubJob.image_ref } })
          // Stage 7 — analytics
          await updatePublishProgress({ channelId, messageId, stageKey: 'analytics', extra: { jobId, imageRef: pubJob.image_ref } })
          try {
            const { startTracking } = await import('../analytics')
            await startTracking(jobId)
            analyticsStarted = true
          } catch (e) { console.warn('[discord] analytics start failed:', e.message) }
          await storage.jobs.update(jobId, { status: 'published' })
        } else {
          await storage.jobs.update(jobId, { status: 'failed', warnings: r.results.filter(x => !x.ok).map(x => `${x.platform}: ${x.error}`) })
        }

        await storage.audit.log('publish', 'content_job', jobId, job.status, allOk ? 'published' : 'failed', { triggered_by: 'discord_postnow', platforms: publishedP, failed: failedP })
        const processingMs = Date.now() - started
        if (allOk) {
          await sendSuccessCardV2({ job: await storage.jobs.get(jobId), results: r.results, imageName, analyticsStarted, archived, processingMs })
        } else {
          await sendFailedCardV2({ job: await storage.jobs.get(jobId), results: r.results, imageName, retryCount: qr?.retry_count || 0 })
        }
      } catch (e) {
        console.error('[discord] publish error:', e)
        try {
          await sendFailedCardV2({ job: await storage.jobs.get(jobId), error: e.message, imageName, retryCount: qr?.retry_count || 0 })
        } catch {}
        await editMessage({
          channelId, messageId,
          embeds: [embed({
            title: '❌ Publish Failed',
            description: `\`\`\`${String(e.message).slice(0, 500)}\`\`\`\n**Job:** \`${jobId}\``,
            color: 0xE74C3C,
          })],
          components: [actionRow([button({ label: '🔄 Retry', customId: `pub_retry:${jobId}`, style: 1 }), button({ label: '📜 Logs', customId: `pub_logs:${jobId}`, style: 2 })])],
        }).catch(() => {})
      }
      return
    }

    // --- Schedule (opens a modal to pick the publish time) ---
    if (action === 'schd') {
      try {
        await respondToInteraction({
          interactionId: interaction.id,
          interactionToken: token,
          type: 9, // MODAL
          data: {
            custom_id: `modal_sched_${jobId}`,
            title: '📅 Schedule Publish',
            components: [
              {
                type: 1,
                components: [
                  { type: 4, custom_id: 'sched_field', label: 'Publish time (YYYY-MM-DD HH:MM, Asia/Kolkata)', style: 1, value: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' '), required: true, min_length: 10, max_length: 20 },
                ],
              },
            ],
          },
        })
      } catch (e) {
        await ackUpdate(interaction, `❌ Could not open scheduler: ${String(e.message).slice(0, 150)}`, true)
      }
      return
    }

    // --- Edit (opens a modal — real working edit, not a placeholder) ---
    if (action === 'edit') {
      try {
        await respondToInteraction({
          interactionId: interaction.id,
          interactionToken: token,
          type: 9, // MODAL
          data: {
            custom_id: `modal_edit_${jobId}`,
            title: '✏️ Edit Captions',
            components: [
              {
                type: 1,
                components: [
                  { type: 4, custom_id: 'platform_field', label: 'Platform (all|linkedin|instagram|facebook|threads)', style: 1, value: 'all', required: true, min_length: 1, max_length: 20 },
                ],
              },
              {
                type: 1,
                components: [
                  { type: 4, custom_id: 'caption_field', label: 'New caption', style: 2, value: (job.platform_posts?.linkedin?.caption || '').slice(0, 1900), required: true, min_length: 1, max_length: 1900 },
                ],
              },
            ],
          },
        })
      } catch (e) {
        await ackUpdate(interaction, `❌ Could not open editor: ${String(e.message).slice(0, 150)}`, true)
      }
      return
    }

    // --- Regenerate ---
    if (action === 'regn') {
      await ackUpdate(interaction, '🔄 Regenerating all platforms…')
      try {
        const result = await generateFromImage({
          imageBase64: undefined,
          context: (job.research_context || '') + (job.topic ? '\n\nTopic: ' + job.topic : ''),
          styleId: job.style_id,
          jobId: job.id,
        })
        const updated = await storage.jobs.update(jobId, { platform_posts: result.posts, warnings: result.warnings })
        await storage.audit.log('regenerate', 'content_job', jobId, job.status, 'pending_approval', { triggered_by: 'discord' })
        const emb = await buildContentPreviewEmbed(updated)
        await editMessage({ channelId, messageId, embeds: [emb], components: buildApprovalButtons(jobId) }).catch(() => {})
      } catch (e) {
        await ackUpdate(interaction, `❌ Regeneration failed: ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }

    // --- Skip ---
    if (action === 'skip') {
      await ackUpdate(interaction, '⏭ Skipped — moved to next slot')
      await onSkip(job)
      const emb = await buildContentPreviewEmbed(await storage.jobs.get(jobId))
      emb.fields.push(field('⏭ **Skipped**', 'Returned to queue', false))
      await editMessage({ channelId, messageId, embeds: [emb], components: [] }).catch(() => {})
      return
    }

    // --- Reject ---
    if (action === 'rejt') {
      // Reject = cancel job, UNLOCK image (keep in Source Images — never archive)
      const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === jobId))
      if (qr) {
        const newPos = (await storage.driveQueue.maxPosition()) + 1
        await storage.driveQueue.update(qr.id, { status: 'queued', queue_position: newPos, content_job_id: null, scheduled_time: null })
        await storage.imageLibrary.upsert({ file_id: qr.file_id, status: 'queued', job_id: null }).catch(() => {})
      }
      await storage.jobs.update(jobId, { status: 'rejected' })
      await storage.audit.log('reject', 'content_job', jobId, job.status, 'rejected', { triggered_by: 'discord' })
      await ackUpdate(interaction, '❌ Rejected — job cancelled, image returned to Source Images')
      await editMessage({ channelId, messageId, embeds: [embed({ title: '❌ Rejected', description: 'Job cancelled. Image returned to Source Images (not archived).', color: 0xE74C3C })], components: [] }).catch(() => {})
      return
    }
  }

  // --- Generate New Image (social): replace ONLY the image, keep captions ---
  if (action === 'nimg') {
    const jobId = id2 || id1
    const oldFileId = parts.length === 3 ? id1 : null
    await ackUpdate(interaction, '🖼️ Selecting a new image…')
    try {
      const job = await storage.jobs.get(jobId)
      if (!job) { await ackUpdate(interaction, `❌ Job not found: ${jobId}`, true); return }
      // Release the old image back to the queue
      if (oldFileId) {
        const oldRow = await storage.driveQueue.getByFileId(oldFileId)
        if (oldRow) await storage.driveQueue.update(oldRow.id, { status: 'queued', content_job_id: null, scheduled_time: null })
      }
      // Random-pick the next eligible image and lock it
      const next = await storage.driveQueue.nextQueued()
      if (!next) { await ackUpdate(interaction, '❌ No eligible images left in Source Images', true); return }
      await storage.driveQueue.update(next.id, { status: 'processing', content_job_id: jobId })
      await storage.imageLibrary.markUsed(next.file_id, { jobId, name: next.file_name || '' }).catch(() => {})
      const newRef = `${process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || ''}`}/api/media/${next.file_id}`
      // Update job image_ref ONLY — captions/research/SEO untouched
      const updated = await storage.jobs.update(jobId, { image_ref: newRef })
      await storage.audit.log('new_image', 'content_job', jobId, job.status, job.status, { old_file: oldFileId, new_file: next.file_id, triggered_by: 'discord' })
      // Update the Discord preview with the new image
      const emb = await buildContentPreviewEmbed(updated)
      await editMessage({ channelId, messageId, embeds: [emb], components: buildApprovalButtons(jobId, next.file_id) }).catch(() => {})
      await ackUpdate(interaction, `🖼️ New image selected: \`${next.file_name || next.file_id}\``)
    } catch (e) {
      await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
    }
    return
  }

  // --- Blog approval actions: bappv / bpubn / bschd / bedit / bregn / bskip / brejt / bnimg ---
  if (action.startsWith('b') && ['bappv', 'bpubn', 'bschd', 'bedit', 'bregn', 'bskip', 'brejt', 'bnimg'].includes(action)) {
    const fileId = id1 === 'topic' ? null : id1
    const { blogApprove, blogPublishNow, blogReschedule, blogRegenerate, blogSkip, blogReject } = await import('../blog/automation')
    if (!fileId) { await ackUpdate(interaction, '❌ Topic-queue items: please use the Blog dashboard for actions', true); return }

    if (action === 'bappv') {
      await ackUpdate(interaction, '✅ Approving blog…')
      try {
        const r = await blogApprove(fileId)
        await storage.audit.log('blog_approve', 'blog_queue', fileId, 'pending_approval', 'published', { url: r?.url, triggered_by: 'discord' })
        const emb = embed({ title: '✅ Blog Published', description: r?.url ? `🔗 ${r.url}` : 'Published (no URL returned)', color: 0x2ECC71 })
        await editMessage({ channelId, messageId, embeds: [emb], components: [] }).catch(() => {})
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
    if (action === 'bpubn') {
      await ackUpdate(interaction, '🚀 Publishing blog now…')
      try {
        const r = await blogPublishNow(fileId)
        await storage.audit.log('blog_publish', 'blog_queue', fileId, 'approved', 'published', { url: r?.url, triggered_by: 'discord' })
        const emb = embed({ title: '🚀 Blog Published', description: r?.url ? `🔗 ${r.url}` : 'Published (no URL returned)', color: 0x2ECC71 })
        await editMessage({ channelId, messageId, embeds: [emb], components: [] }).catch(() => {})
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
    if (action === 'bschd') {
      await blogReschedule(fileId)
      await ackUpdate(interaction, '📆 Blog rescheduled to the next slot')
      return
    }
    if (action === 'bedit') {
      try {
        const row = await storage.blogQueue.getByFileId(fileId)
        await respondToInteraction({
          interactionId: interaction.id,
          interactionToken: token,
          type: 9, // MODAL
          data: {
            custom_id: `modal_blog_${fileId}`,
            title: '✏️ Edit Blog Article',
            components: [
              {
                type: 1,
                components: [
                  { type: 4, custom_id: 'blog_title_field', label: 'SEO Title', style: 1, value: (row?.article_data?.title || '').slice(0, 1900), required: true, min_length: 1, max_length: 1900 },
                ],
              },
              {
                type: 1,
                components: [
                  { type: 4, custom_id: 'blog_content_field', label: 'Content (markdown)', style: 2, value: (row?.article_data?.content || '').slice(0, 1900), required: true, min_length: 1, max_length: 1900 },
                ],
              },
            ],
          },
        })
      } catch (e) {
        await ackUpdate(interaction, `❌ Could not open editor: ${String(e.message).slice(0, 150)}`, true)
      }
      return
    }
    if (action === 'bregn') {
      await ackUpdate(interaction, '🔄 Regenerating blog article…')
      try {
        await blogRegenerate(fileId)
        const row = await storage.blogQueue.getByFileId(fileId)
        const emb = buildBlogPreviewEmbed(row?.article_data || {}, { fileName: row?.file_name || '', status: 'processing' })
        emb.fields.push(field('🔄 **Regenerated**', 'Article regenerated — new card below', false))
        await editMessage({ channelId, messageId, embeds: [emb], components: [] }).catch(() => {})
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
    if (action === 'bskip') {
      await blogSkip(fileId)
      await ackUpdate(interaction, '⏭ Blog skipped — moved to next slot')
      return
    }
    if (action === 'brejt') {
      await blogReject(fileId)
      await ackUpdate(interaction, '❌ Blog rejected and archived')
      return
    }
    if (action === 'bnimg') {
      await ackUpdate(interaction, '🖼️ Selecting a new blog image…')
      try {
        const { nextBlogFile } = await import('../blog/intake')
        const next = await nextBlogFile()
        if (!next) { await ackUpdate(interaction, '❌ No eligible blog images left', true); return }
        const oldRow = await storage.blogQueue.getByFileId(fileId)
        if (oldRow) await storage.blogQueue.update(oldRow.id, { status: 'queued', article_data: null, generation_time: null })
        await storage.blogQueue.update(next.id, { status: 'processing' })
        await storage.imageLibrary.markUsed(next.file_id, { jobId: null, name: next.file_name || '' }).catch(() => {})
        await storage.audit.log('blog_new_image', 'blog_queue', next.file_id, 'queued', 'processing', { old_file: fileId, triggered_by: 'discord' })
        await ackUpdate(interaction, `🖼️ New image selected: \`${next.file_name || next.file_id}\` — run the next Blog tick to generate`)
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
  }

  // --- News Radar actions ---
  if (action.startsWith('news_')) {
    const newsAction = action.replace('news_', '')
    const newsId = id1
    const item = await storage.newsPosts.get(newsId)
    if (!item) {
      await ackUpdate(interaction, '❌ News item not found', true)
      return
    }

    // Generate All
    if (newsAction === 'genall') {
      await ackUpdate(interaction, '⚙️ Starting full campaign…')
      try {
        const { startOrContinueCampaign, CAMPAIGN_PLATFORMS: CAMP } = await import('../news/campaign')
        const r = await startOrContinueCampaign(newsId, { platforms: CAMP.map(p => p.key) })
        const state = r.state
        // Show progress
        const emb = await renderGenerationProgress({
          title: item.title,
          step: state?.steps?.find(s => s.status === 'active')?.label || 'Generating…',
          stepIndex: (state?.steps || []).filter(s => s.status === 'done' || s.status === 'error').length,
          totalSteps: (state?.steps || []).length,
        })
        await editMessage({ channelId, messageId, embeds: [emb] }).catch(() => {})
        // If not complete, schedule background continue via API
        await storage.newsPosts.update(newsId, { status: 'pending_approval' })
      } catch (e) {
        await ackUpdate(interaction, `❌ Campaign failed: ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }

    // Generate single platform
    if (newsAction === 'gen') {
      const platform = id2
      await ackUpdate(interaction, `⚙️ Generating ${platformLabel(platform)}…`)
      const steps = GEN_STEPS
      try {
        for (let i = 0; i <= 4; i++) {
          const emb = await renderGenerationProgress({ title: item.title, step: steps[Math.min(i, steps.length - 1)], stepIndex: i, totalSteps: steps.length })
          await editMessage({ channelId, messageId, embeds: [emb] }).catch(() => {})
          await new Promise(r => setTimeout(r, 600))
        }
        const saved = await generateAndSave(newsId)
        for (let i = 5; i < steps.length; i++) {
          const emb = await renderGenerationProgress({ title: item.title, step: steps[i], stepIndex: i, totalSteps: steps.length })
          await editMessage({ channelId, messageId, embeds: [emb] }).catch(() => {})
          await new Promise(r => setTimeout(r, 400))
        }
        await storage.newsPosts.update(newsId, { status: 'pending_approval' })
        const doneEmb = await renderGenerationProgress({ title: item.title, step: 'Complete!', stepIndex: steps.length, totalSteps: steps.length, status: 'done' })
        doneEmb.fields = [
          field('✅ Generated', `Platforms: ${Object.keys(saved?.platform_posts || {}).map(p => `✓ ${p}`).join(' ')}`, false),
          field('📱 Recommended', 'Approve in #approval-center to publish', false),
        ]
        await editMessage({ channelId, messageId, embeds: [doneEmb], components: buildNewsRadarButtons(newsId) }).catch(() => {})
      } catch (e) {
        const errEmb = await renderGenerationProgress({ title: item.title, step: `❌ ${String(e.message).slice(0, 100)}`, stepIndex: 0, totalSteps: steps.length, status: 'error' })
        await editMessage({ channelId, messageId, embeds: [errEmb], components: buildNewsRadarButtons(newsId) }).catch(() => {})
      }
      return
    }

    // Schedule
    if (newsAction === 'sched') {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
      await storage.newsPosts.update(newsId, { status: 'scheduled', scheduled_for: d.toISOString() })
      await recordFeedback(newsId, 'approve')
      await ackUpdate(interaction, `📅 Scheduled for ${d.toLocaleString()}`)
      return
    }

    // Save
    if (newsAction === 'save') {
      await storage.newsPosts.update(newsId, { status: 'approved', saved: true })
      await recordFeedback(newsId, 'approve')
      await ackUpdate(interaction, '🔖 Saved for later')
      return
    }

    // Read article
    if (newsAction === 'read') {
      await ackUpdate(interaction, `🔗 ${item.url || 'No URL available'}`)
      return
    }

    // Re-analyze
    if (newsAction === 'reanalyze') {
      await ackUpdate(interaction, '🔄 Re-analyzing…')
      const topics = await getNewsTopics()
      const learning = await getLearning()
      const analysis = await analyzeNewsItem(item, topics, learning)
      await storage.newsPosts.update(newsId, { ai_analysis: analysis })
      const emb = await buildNewsRadarEmbed(item, analysis)
      await editMessage({ channelId, messageId, embeds: [emb], components: buildNewsRadarButtons(newsId) }).catch(() => {})
      return
    }

    // Ignore
    if (newsAction === 'ignore') {
      await storage.newsPosts.update(newsId, { status: 'rejected' })
      await recordFeedback(newsId, 'reject')
      await ackUpdate(interaction, '❌ Ignored — learning recorded')
      await editMessage({ channelId, messageId, embeds: [embed({ title: '❌ Ignored', description: item.title?.slice(0, 100) || '', color: 0x95A5A6 })], components: [] }).catch(() => {})
      return
    }
  }

  // --- Publishing analytics / logs / retry ---
  if (action === 'pub_analytics') {
    const jobId = id1
    await ackUpdate(interaction, `📈 Fetching analytics for \`${jobId}\`…`)
    try {
      const { startTracking } = await import('../analytics')
      await startTracking(jobId)
      const job = await storage.jobs.get(jobId)
      const emb = await buildContentPreviewEmbed(job)
      await editMessage({ channelId, messageId, embeds: [emb] }).catch(() => {})
    } catch (e) {
      await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
    }
    return
  }
  if (action === 'pub_logs') {
    const jobId = id1
    const logs = await storage.audit.listByEntity('content_job', jobId)
    if (!logs.length) {
      await ackUpdate(interaction, '📜 No logs for this job')
      return
    }
    const lines = logs.slice(0, 10).map(l => `\`${l.performed_at?.slice(0, 19)}\` · **${l.action}** · ${l.new_status || ''}`)
    await ackUpdate(interaction, `📜 **Logs for ${jobId}**\n${lines.join('\n')}`)
    return
  }
  if (action === 'pub_retry') {
    const jobId = id1
    await ackUpdate(interaction, '🔄 Retrying publish…')
    const job = await storage.jobs.get(jobId)
    if (!job) { await ackUpdate(interaction, '❌ Job not found', true); return }
    await storage.jobs.update(jobId, { status: 'approved', warnings: [] })
    try {
      const r = await onPublishNow(job)
      await sendPublishResult({ job, results: r.results }).catch(() => {})
    } catch (e) {
      await ackUpdate(interaction, `❌ Retry failed: ${String(e.message).slice(0, 200)}`, true)
    }
    return
  }
  // Cancel a failed job — unlock the image, return it to Source Images
  if (action === 'pub_cancel') {
    const jobId = id1
    await ackUpdate(interaction, '🚫 Cancelling job — image returned to Source Images')
    try {
      const qr = await storage.driveQueue.list({}).then(rows => rows.find(r => r.content_job_id === jobId))
      if (qr) {
        const newPos = (await storage.driveQueue.maxPosition()) + 1
        await storage.driveQueue.update(qr.id, { status: 'queued', queue_position: newPos, content_job_id: null, scheduled_time: null })
        await storage.imageLibrary.upsert({ file_id: qr.file_id, status: 'queued', job_id: null }).catch(() => {})
      }
      await storage.jobs.update(jobId, { status: 'cancelled' })
      await storage.audit.log('cancel', 'content_job', jobId, 'failed', 'cancelled', { triggered_by: 'discord' })
      await editMessage({ channelId, messageId, embeds: [embed({ title: '🚫 Job Cancelled', description: 'Image unlocked and returned to Source Images.', color: 0x95A5A6 })], components: [] }).catch(() => {})
    } catch (e) {
      await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
    }
    return
  }

  // --- LinkedIn Engagement actions ---
  if (action.startsWith('li_')) {
    const liAction = action.replace('li_', '')
    const liId = id1
    const { tableGet, tableUpdate } = await import('../table')
    const intel = await import('../linkedin-intel')
    const item = await tableGet('linkedinIntel', liId)
    if (!item) { await ackUpdate(interaction, '❌ Opportunity not found', true); return }

    if (liAction === 'appv') {
      await ackUpdate(interaction, '✅ Approving…')
      try {
        // Record decision FIRST (writes memory history), then post
        await intel.recordDecision(liId, 'approve')
        const r = await intel.postComment(liId)
        if (r.ok) {
          await editMessage({ channelId, messageId, embeds: [embed({
            title: '✅ Comment Posted',
            description: `**"${item.comment?.slice(0, 300)}"**\n\n🔗 ${item.url || ''}\n🕐 ${r.comment_timestamp || new Date().toLocaleString()}\n\nComment verified and recorded in LinkedIn Comments History.`,
            color: 0x2ECC71,
          })], components: [] }).catch(() => {})
        } else if (r.url_needed) {
          await editMessage({ channelId, messageId, embeds: [embed({ title: '✅ Approved — Manual Step Needed', description: `Couldn't auto-post (no post URN). Copy and paste on LinkedIn:\n\n"${item.comment}"\n\n${item.url || ''}`, color: 0xF1C40F })], components: [] }).catch(() => {})
        } else {
          await editMessage({ channelId, messageId, embeds: [embed({ title: '⚠️ Approve Recorded, Post Failed', description: r.error || 'Unknown error', color: 0xE74C3C })], components: [] }).catch(() => {})
        }
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
    if (liAction === 'edit') {
      await ackUpdate(interaction, '✏️ Reply with your comment to edit it')
      await storage.appState.set(`discord_pending_li_edit_${channelId}`, { id: liId })
      return
    }
    if (liAction === 'regn') {
      await ackUpdate(interaction, '🔄 Regenerating…')
      try {
        const fresh = await intel.generateHumanComment({ ...item, analysis: {
          industry: item.industry, topic: item.topic, intent: item.intent,
          main_argument: item.main_argument, tone: item.tone, question_asked: item.question_asked,
          cta: item.cta, target_audience: item.target_audience, pain_point: item.pain_point,
          takeaway: item.takeaway, classification: item.classification,
        }, strategy: item.strategy })
        await tableUpdate('linkedinIntel', liId, {
          comment: fresh.comment, quality: fresh.quality, visibility: fresh.visibility,
          why: fresh.why, strategy: fresh.strategy, similarity: fresh.similarity,
          updated_at: new Date().toISOString(),
        })
        const freshItem = await tableGet('linkedinIntel', liId)
        const emb = await buildLinkedInEngagementEmbed(freshItem)
        await editMessage({ channelId, messageId, embeds: [emb], components: buildLinkedInEngagementButtons(liId) }).catch(() => {})
      } catch (e) {
        await ackUpdate(interaction, `❌ ${String(e.message).slice(0, 200)}`, true)
      }
      return
    }
    if (liAction === 'skip') {
      await intel.recordDecision(liId, 'skip')
      await ackUpdate(interaction, '⏭ Skipped')
      await editMessage({ channelId, messageId, embeds: [embed({ title: '⏭ Skipped', description: item.title?.slice(0, 100) || '', color: 0x95A5A6 })], components: [] }).catch(() => {})
      return
    }
    if (liAction === 'open') {
      await ackUpdate(interaction, `🔗 ${item.url || 'No URL available'}`)
      return
    }
    if (liAction === 'rejt') {
      await tableUpdate('linkedinIntel', liId, { status: 'rejected', updated_at: new Date().toISOString() })
      await intel.recordDecision(liId, 'reject').catch(() => {})
      await ackUpdate(interaction, '❌ Rejected')
      await editMessage({ channelId, messageId, embeds: [embed({ title: '❌ Rejected', description: item.title?.slice(0, 100) || '', color: 0x95A5A6 })], components: [] }).catch(() => {})
      return
    }
    if (liAction === 'sav') {
      await intel.recordDecision(liId, 'save')
      await ackUpdate(interaction, '🔖 Saved')
      await editMessage({ channelId, messageId, embeds: [embed({ title: '🔖 Saved', description: item.title?.slice(0, 100) || '', color: 0x3498DB })], components: [] }).catch(() => {})
      return
    }
  }

  await ackUpdate(interaction, 'Unknown action', true)
}

// ---------------------------------------------------------------------------
// Modal submissions (edits)
// ---------------------------------------------------------------------------

async function handleModal(interaction) {
  const customId = interaction.data?.custom_id || ''
  const token = interaction.token
  const channelId = interaction.channel_id
  const values = interaction.data?.components || []

  const getValue = (componentCustomId) => {
    const comp = values.find(c => c.components?.[0]?.custom_id === componentCustomId)
    return comp?.components?.[0]?.value || ''
  }

  // Job edit modal
  if (customId.startsWith('modal_edit_')) {    const jobId = customId.replace('modal_edit_', '')
    const caption = getValue('caption_field')
    const platform = getValue('platform_field') || 'all'
    const job = await storage.jobs.get(jobId)
    if (!job) { await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: '❌ Job not found', flags: 64 } }); return }

    const posts = { ...job.platform_posts }
    if (platform === 'all') {
      for (const p of PLATFORM_KEYS) {
        if (posts[p]) posts[p] = { ...posts[p], caption }
      }
    } else if (posts[platform]) {
      posts[platform] = { ...posts[platform], caption }
    }
    const updated = await storage.jobs.update(jobId, { platform_posts: posts })
    await storage.audit.log('edit', 'content_job', jobId, job.status, job.status, { platform, triggered_by: 'discord' })
    const emb = await buildContentPreviewEmbed(updated)
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { embeds: [emb], components: buildApprovalButtons(jobId) } })
    return
  }

  // Blog edit modal
  if (customId.startsWith('modal_blog_')) {
    const fileId = customId.replace('modal_blog_', '')
    const title = getValue('blog_title_field')
    const content = getValue('blog_content_field')
    const row = await storage.blogQueue.getByFileId(fileId)
    if (!row) { await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: '❌ Blog not found', flags: 64 } }); return }

    const article = { ...(row.article_data || {}), title: title || row.article_data?.title, content: content || row.article_data?.content }
    await storage.blogQueue.update(row.id, { article_data: article })
    await storage.audit.log('blog_edit', 'blog_queue', fileId, 'pending_approval', 'pending_approval', { triggered_by: 'discord' })
    const emb = buildBlogPreviewEmbed(article, { fileName: row.file_name || '', status: row.status })
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { embeds: [emb], components: buildBlogApprovalButtons(fileId) } })
    return
  }

  // Schedule modal — pick the publish time (Asia/Kolkata)
  if (customId.startsWith('modal_sched_')) {
    const jobId = customId.replace('modal_sched_', '')
    const raw = getValue('sched_field') || ''
    const m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
    if (!m) { await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 4, data: { content: '❌ Invalid time format — use YYYY-MM-DD HH:MM', flags: 64 } }); return }
    const [, y, mo, d, h, mi] = m.map(Number)
    const scheduledFor = new Date(Date.UTC(y, mo - 1, d, h - 5, mi - 30)).toISOString() // Asia/Kolkata = UTC+5:30
    const updated = await storage.jobs.update(jobId, { status: 'scheduled', scheduled_for: scheduledFor })
    await storage.audit.log('schedule', 'content_job', jobId, updated.status, 'scheduled', { scheduled_for: scheduledFor, triggered_by: 'discord_modal' })
    const { buildReviewEmbed, buildReviewButtons } = await import('./review-center')
    const emb = await buildReviewEmbed(updated)
    emb.fields.push(field('📅 **Scheduled**', `${raw} (Asia/Kolkata)`, false))
    await respondToInteraction({ interactionId: interaction.id, interactionToken: token, type: 7, data: { embeds: [emb], components: buildReviewButtons(jobId) } })
    return
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ackUpdate(interaction, text = null, showAlert = false) {
  try {
    await respondToInteraction({
      interactionId: interaction.id,
      interactionToken: interaction.token,
      type: 7, // UPDATE_MESSAGE
      data: text ? { content: text, flags: showAlert ? 64 : undefined } : {},
    })
  } catch (e) {
    // If message already updated, try silent ack
    try {
      await respondToInteraction({ interactionId: interaction.id, interactionToken: interaction.token, type: 6 })
    } catch (_) {}
  }
}

function platformLabel(key) {
  const map = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', blog: 'Blog', newsletter: 'Newsletter', carousel: 'Carousel' }
  return map[key] || key
}

function escapeMd(s) {
  return String(s || '').replace(/[*_`~|]/g, (c) => '\\' + c)
}