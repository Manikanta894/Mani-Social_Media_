// Vercel Cron entrypoint — Vercel's scheduler hits /api/cron directly.
// Vercel Cron is protected by the platform, so no shared secret needed here.
// Runs ONE step of the resumable pipeline per invocation, well under the
// Hobby 60s function limit; the next cron run resumes automatically.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  return NextResponse.json({ ok: true, cron: 'health' })
}

export async function POST() {
  const out = {}
  try {
    const { runTick } = await import('@/lib/automation')
    out.tick = await runTick()
  } catch (e) { out.tick = { error: e.message } }

  try {
    const { runBlogTick } = await import('@/lib/blog/automation')
    out.blog = await runBlogTick()
  } catch (e) { out.blog = { error: e.message } }

  try {
    const { runNewsCheck } = await import('@/lib/news')
    const { runNewsDecisionPipeline } = await import('@/lib/news/ai-decision')
    const r = await runNewsCheck(15000)
    const decision = await runNewsDecisionPipeline(6).catch(() => ({}))
    out.news = { ...r, decision }
  } catch (e) { out.news = { error: e.message } }

  try {
    const { checkOpportunities } = await import('@/lib/linkedin-intel')
    out.linkedin = await checkOpportunities({ limit: 3 })
  } catch (e) { out.linkedin = { error: e.message } }

  return NextResponse.json({ ok: true, data: out })
}
