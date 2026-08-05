import { storage } from './storage'

export async function exportAllData() {
  const [jobs, blogs, audit, hashtags, mentions] = await Promise.all([
    storage.jobs.list({}),
    storage.blogPosts.list(),
    storage.audit.list(500),
    storage.hashtagStats.list(),
    storage.mentions.list(),
  ])
  return {
    exported_at: new Date().toISOString(),
    content_jobs: jobs,
    blog_posts: blogs,
    audit_log: audit,
    hashtag_stats: hashtags,
    mentions,
  }
}
