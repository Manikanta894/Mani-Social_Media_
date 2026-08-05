import { storage } from '../storage'

export async function detectConflicts({ platform, scheduledFor, excludeNewsId }) {
  const time = new Date(scheduledFor)
  const conflicts = []

  // Check content_jobs (manual + scheduled + ai automation)
  const jobs = await storage.jobs.list()
  for (const job of jobs) {
    if (job.status !== 'scheduled' || !job.scheduled_for) continue
    if (!job.platform_posts || !job.platform_posts[platform]) continue
    const jobTime = new Date(job.scheduled_for)
    const diffMs = Math.abs(jobTime - time)
    if (diffMs < 600000) {  // within 10 min
      conflicts.push({
        type: 'content_job',
        id: job.id,
        title: job.topic || 'Untitled post',
        scheduled_for: job.scheduled_for,
        platform,
        source: job.source || 'scheduled',
      })
    }
  }

  // Check news_posts
  const news = await storage.newsPosts.list()
  for (const n of news) {
    if (n.id === excludeNewsId) continue
    if (n.status !== 'scheduled' || !n.scheduled_for) continue
    const generated = n.generated_posts || {}
    if (!generated[platform] && !Object.keys(generated).length) continue
    const nTime = new Date(n.scheduled_for)
    const diffMs = Math.abs(nTime - time)
    if (diffMs < 600000) {
      conflicts.push({
        type: 'news_post',
        id: n.id,
        title: n.title,
        scheduled_for: n.scheduled_for,
        platform,
        source: 'breaking_news',
      })
    }
  }

  return conflicts
}

export async function findNextSlot({ platform, after }) {
  const afterTime = new Date(after || Date.now())
  const existing = []

  const jobs = await storage.jobs.list()
  for (const job of jobs) {
    if (job.status !== 'scheduled' || !job.scheduled_for) continue
    if (!job.platform_posts || !job.platform_posts[platform]) continue
    existing.push(new Date(job.scheduled_for).getTime())
  }

  const news = await storage.newsPosts.list()
  for (const n of news) {
    if (n.status !== 'scheduled' || !n.scheduled_for) continue
    existing.push(new Date(n.scheduled_for).getTime())
  }

  existing.sort((a, b) => a - b)
  let candidate = afterTime.getTime()
  for (const ex of existing) {
    if (Math.abs(ex - candidate) < 600000) {
      candidate = ex + 600000
    }
  }

  return new Date(candidate).toISOString()
}
