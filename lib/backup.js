import { supabase } from './supabase'

export async function exportAllData() {
  const [jobs, blogs, audit, hashtags, mentions] = await Promise.all([
    supabase().from('content_jobs').select('*').order('created_at', { ascending: false }),
    supabase().from('blog_posts').select('*').order('created_at', { ascending: false }),
    supabase().from('audit_log').select('*').order('performed_at', { ascending: false }).limit(500),
    supabase().from('hashtag_stats').select('*'),
    supabase().from('mentions').select('*'),
  ])
  return {
    exported_at: new Date().toISOString(),
    content_jobs: jobs.data || [],
    blog_posts: blogs.data || [],
    audit_log: audit.data || [],
    hashtag_stats: hashtags.data || [],
    mentions: mentions.data || [],
  }
}
