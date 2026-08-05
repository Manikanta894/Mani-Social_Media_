// Scheduler helpers — publish-sweep function.
// Called by a cron endpoint or manually.

import { storage } from './storage'
import { publishJob, isPlatformRateLimited } from './publishers'

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
      // Notify via Discord (primary) — publishJob already sends to #social-publishing
    } catch (e) {
      await storage.jobs.update(job.id, { status: 'failed', warnings: [...(job.warnings || []), 'publish-sweep: ' + e.message] })
      results.push({ job_id: job.id, status: 'failed', error: e.message })
      // Log to Discord error-center
      try {
        const { notifyError } = await import('./discord/notify')
        await notifyError({ module: 'publish-sweep', error: e.message, fix: 'Check the job in #approval-center' })
      } catch {}
    }
  }

  return { swept: due.length, results }
}
