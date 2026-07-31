'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, MessageSquare, CheckCircle, XCircle, Clock, Loader2, TrendingUp, Sparkles, Target, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { api, StatusStamp } from '@/components/shared'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { DEFAULT_PILLARS } from '@/lib/content-pillars'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ postsToday: 0, pending: 0, failed: 0, totalPosts: 0, totalEngagement: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [ideas, setIdeas] = useState([])
  const [newIdea, setNewIdea] = useState('')
  const [pillarDistribution, setPillarDistribution] = useState([])
  const [benchmarking, setBenchmarking] = useState(null)
  const [mentions, setMentions] = useState([])
  const [mentionsLoading, setMentionsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        const [jobs, audit, analytics] = await Promise.all([
          api('/jobs').catch(() => []),
          api('/audit?limit=15').catch(() => []),
          api('/analytics/stats').catch(() => ({})),
        ]).then(([j, a, s]) => [(j || []), (a || []), (s || {})])
        const published = jobs.filter(j => j.status === 'published')
        const today = new Date().toDateString()
        const postsToday = published.filter(j => j.published_at && new Date(j.published_at).toDateString() === today).length
        setStats({
          postsToday, pending: jobs.filter(j => j.status === 'pending_approval').length,
          failed: jobs.filter(j => j.status === 'failed').length,
          totalPosts: jobs.length,
          totalEngagement: (analytics.totalEngagement || 0) + (analytics.totalLikes || 0) + (analytics.totalComments || 0),
        })
        setRecentActivity(audit.slice(0, 10))
        setRecentJobs(jobs.filter(j => j.created_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5))

        // Compute pillar distribution
        const counts = {}
        for (const j of jobs) {
          const p = j.pillar || 'general'
          counts[p] = (counts[p] || 0) + 1
        }
        setPillarDistribution(
          DEFAULT_PILLARS.filter(p => counts[p.key]).map(p => ({ pillar: p.label, count: counts[p.key] || 0 }))
        )

        // Load ideas from localStorage
        let saved = []
        try { saved = JSON.parse(localStorage.getItem('sf_ideas')) || [] } catch { saved = [] }
        setIdeas(saved)

        // Load benchmarking data
        api('/benchmarking/gap').then(setBenchmarking).catch(() => {})
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    })()
  }, [])

  const addIdea = () => {
    if (!newIdea.trim()) return
    const updated = [...ideas, { id: Date.now(), text: newIdea.trim(), created_at: new Date().toISOString() }]
    setIdeas(updated)
    localStorage.setItem('sf_ideas', JSON.stringify(updated))
    setNewIdea('')
  }

  const removeIdea = (id) => {
    const updated = ideas.filter(i => i.id !== id)
    setIdeas(updated)
    localStorage.setItem('sf_ideas', JSON.stringify(updated))
  }

  const checkMentions = async () => {
    setMentionsLoading(true)
    try {
      await api('/mentions/check', { method: 'POST' })
      const recent = await api('/mentions')
      setMentions(recent)
    } catch (e) { console.error(e) }
    finally { setMentionsLoading(false) }
  }

  const loadMentions = async () => {
    try {
      const recent = await api('/mentions')
      setMentions(recent)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { loadMentions() }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-8">
      <div className="border-b border-border pb-6 mb-8">
        <h1 className="editorial-title text-2xl sm:text-3xl">The Desk</h1>
        <p className="text-sm text-muted-foreground mt-1">Your editorial command center — today at a glance.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><CheckCircle className="h-3.5 w-3.5" /> Published Today</div>
            <div className="text-2xl font-bold text-accent">{stats.postsToday}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /> Pending Approval</div>
            <div className="text-2xl font-bold text-flag">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><XCircle className="h-3.5 w-3.5" /> Failed</div>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" /> Total Engagement</div>
            <div className="text-2xl font-bold">{stats.totalEngagement.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pillar distribution */}
      {pillarDistribution.length > 0 && (
        <Card className="bg-card mb-8">
          <CardHeader className="pb-3"><CardTitle className="text-base">Content by Pillar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pillarDistribution} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="pillar" type="category" width={110} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Two-column: Activity + Ideas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Activity feed */}
        <Card className="bg-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">Activity Feed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on the desk yet — drop in a photo to start.</p>
            ) : recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                <StatusStamp status={a.new_status || a.action} className="text-[0.5rem]" />
                <span className="text-muted-foreground truncate">{a.action.replace(/_/g, ' ')}</span>
                <span className="editorial-mono text-[0.5rem] text-muted-foreground ml-auto shrink-0">
                  {new Date(a.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Idea backlog */}
        <Card className="bg-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">Idea Backlog</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <input
                value={newIdea}
                onChange={e => setNewIdea(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addIdea() }}
                placeholder="New idea…"
                className="flex-1 px-3 py-1.5 text-sm rounded-sm border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button onClick={addIdea} className="px-3 py-1.5 text-sm rounded-sm bg-accent text-accent-foreground hover:bg-accent/80 transition-colors">
                Add
              </button>
            </div>
            {ideas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ideas yet. Jot one down above.</p>
            ) : ideas.map(idea => (
              <div key={idea.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0 group">
                <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1">{idea.text}</span>
                <button onClick={() => removeIdea(idea.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Competitor Benchmarking */}
      {benchmarking && (
        <Card className="bg-card mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Competitor Benchmarking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="border border-border rounded-sm p-3">
                <div className="editorial-mono text-[0.625rem] text-muted-foreground uppercase mb-1">Your Posts (30d)</div>
                <div className="text-xl font-bold">{benchmarking.my_posts_last_30_days}</div>
              </div>
              <div className="border border-border rounded-sm p-3">
                <div className="editorial-mono text-[0.625rem] text-muted-foreground uppercase mb-1">Peer Avg (30d)</div>
                <div className="text-xl font-bold">{benchmarking.avg_peer_posts_last_30_days}</div>
              </div>
              <div className="border border-border rounded-sm p-3">
                <div className="editorial-mono text-[0.625rem] text-muted-foreground uppercase mb-1">Gap</div>
                <div className={`text-xl font-bold ${benchmarking.gap > 0 ? 'text-flag' : 'text-accent'}`}>
                  {benchmarking.gap > 0 ? `+${benchmarking.gap}` : benchmarking.gap}
                </div>
              </div>
              <div className="border border-border rounded-sm p-3 flex items-center">
                <div className="text-sm text-muted-foreground">{benchmarking.recommendation}</div>
              </div>
            </div>
            <div className="space-y-2">
              {benchmarking.peers?.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium w-24">{p.peer}</span>
                  {p.error ? (
                    <span className="text-xs text-muted-foreground">{p.error}</span>
                  ) : (
                    <>
                      <Badge variant="outline" className="text-[0.5rem]">{p.post_count} posts</Badge>
                      {p.recent?.slice(0, 2).map((r, j) => (
                        <span key={j} className="text-xs text-muted-foreground truncate flex-1">{r.title}</span>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent posts */}
      <Card className="bg-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Posts</CardTitle></CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet. Head to <button onClick={() => router.push('/compose')} className="underline hover:text-accent">Compose</button> to create your first.</p>
          ) : (
            <div className="space-y-1">
              {recentJobs.map((j, i) => (
                <div key={j.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className="editorial-mono text-[0.5rem] text-muted-foreground w-6">{String(i + 1).padStart(2, '0')}</span>
                  <StatusStamp status={j.status} className="text-[0.5rem]" />
                  <span className="text-sm truncate flex-1">{j.topic || 'Untitled'}</span>
                  <span className="editorial-mono text-[0.5rem] text-muted-foreground shrink-0">
                    {j.created_at ? new Date(j.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Social Listening */}
      <Card className="bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4" /> Brand Mentions</CardTitle>
          <button onClick={checkMentions} disabled={mentionsLoading} className="editorial-mono text-[0.625rem] text-primary hover:underline disabled:opacity-50">
            {mentionsLoading ? 'Scanning…' : 'Scan now'}
          </button>
        </CardHeader>
        <CardContent>
          {mentions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mentions found yet. Click "Scan now" to check for brand mentions across news sources.</p>
          ) : (
            <div className="space-y-2">
              {mentions.slice(0, 8).map((m, i) => (
                <div key={m.id || i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <Radio className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.title || 'Untitled'}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.snippet?.slice(0, 120) || m.url}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="editorial-mono text-[0.5rem] text-muted-foreground">{m.source}</span>
                      <span className="editorial-mono text-[0.5rem] text-primary">{m.matched_keyword}</span>
                      <span className="editorial-mono text-[0.5rem] text-muted-foreground">{m.discovered_at ? new Date(m.discovered_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
