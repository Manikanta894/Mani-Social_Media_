// Vercel Cron entrypoint — hit every 5 min by Vercel's scheduler.
// Runs ONE job per invocation (round-robin via a counter in app state) so the
// Google Sheets 60-reads/min quota is never exhausted: each job needs ~15-25
// reads, so spreading jobs across invocations keeps us under the limit.
// The social pipeline itself is step-based (vision->content->card) and
// resumes automatically on the next invocation.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOBS = ['tick', 'blog', 'news', 'linkedin']
const LAST_KEY = 'cron_last_job'

export async function GET() {
  return NextResponse.json({ ok: true, cron: 'health', jobs: JOBS })
}

export async function POST() {
  let { storage } = await import('@/lib/storage')
  let idx = 0
  try {
    const last = await storage.appState.get(LAST_KEY, null)
    idx = ((last?.idx ?? -1) + 1) % JOBS.length
    await storage.appState.set(LAST_KEY, { idx, at: new Date().toISOString() })
  } catch {}

  const job = JOBS[idx]
  const out = { job, rotated: true }
  try {
    if (job === 'tick') {
      const { runTick } = await import('@/lib/automation')
      out.result = await runTick()
    } else if (job === 'blog') {
      const { runBlogTick } = await import('@/lib/blog/automation')
      out.result = await runBlogTick()
    } else if (job === 'news') {
      const { runNewsCheck } = await import('@/lib/news')
      const { runNewsDecisionPipeline } = await import('@/lib/news/ai-decision')
      const r = await runNewsCheck(15000)
      const decision = await runNewsDecisionPipeline(6).catch(() => ({}))
      out.result = { ...r, decision }
    } else if (job === 'linkedin') {
      const { checkOpportunities } = await import('@/lib/linkedin-intel')
      out.result = await checkOpportunities({ limit: 3 })
    }
  } catch (e) {
    out.error = e.message || 'job failed'
  }
  return NextResponse.json({ ok: true, data: out })
}
