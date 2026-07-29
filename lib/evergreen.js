import { storage } from './storage'

export async function findEvergreenCandidates() {
  const jobs = await storage.jobs.list({ status: 'published' })
  const now = Date.now()
  const candidates = jobs.filter(j => {
    if (!j.published_at) return false
    const age = (now - new Date(j.published_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    return age >= 2
  })
  return candidates.slice(0, 10)
}
