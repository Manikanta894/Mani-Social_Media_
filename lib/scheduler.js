// Scheduler helpers — publish-sweep function.
// Called by a cron endpoint or manually.

import { storage } from './storage'
import { publishJob, isPlatformRateLimited } from './publishers'
import { sendMessage } from './telegram/client'

export async function publishSweep() {
  const now = new Date().toISOString()
  const all = await storage.jobs.list()
  const due = all.filter(j =>
    j.status === 'scheduled' && j.scheduled_for && j.scheduled_for <= now
  )

  const results = []
  for (const job of due) {
    // Check rate limits per platform before attempting
    const platforms = Object.keys(job.platform_posts || {})
    const throttled = []
    for (const p of platforms) {
      if (await isPlatformRateLimited(p)) throttled.push(p)
    }
    if (throttled.length > 0) {
      const msg = `Skipping — rate-limited platforms: ${throttled.join(', ')}`
      await storage.jobs.update(job.id, { warnings: [...(job.warnings || []), msg] })
      results.push({ job_id: job.id, status: 'skipped_rate_limited', throttled })
      continue
    }

    try {
      const r = await publishJob(job)
      results.push({ job_id: job.id, ...r })
      // Notify admin via Telegram
      try {
        const s = await storage.settings.get()
        if (s.telegram_admin_chat_id) {
          const summary = r.results.map(x => `${x.ok ? '✅' : '❌'} ${x.platform}${x.ok ? ` → ${x.url || ''}` : `: ${x.error}`}`).join('\n')
          await sendMessage({
            chatId: s.telegram_admin_chat_id,
            text: `<b>🚀 Auto-publish complete</b>\nJob: <code>${job.id.slice(0, 8)}</code>\n${summary}`,
          })
        }
      } catch (_) {}
    } catch (e) {
      await storage.jobs.update(job.id, { status: 'failed', warnings: [...(job.warnings || []), 'publish-sweep: ' + e.message] })
      results.push({ job_id: job.id, status: 'failed', error: e.message })
    }
  }

  return { swept: due.length, results }
}
