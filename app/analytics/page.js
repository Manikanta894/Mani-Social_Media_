'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3, Eye, Star, MessageSquare, RefreshCw, Save, Loader2, Sparkles, Send, FileText,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { api } from '@/components/shared'
import { toast } from 'sonner'

function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  const [posts, setPosts] = useState([])
  const [hashtags, setHashtags] = useState([])
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [platformTab, setPlatformTab] = useState('all')
  const [postSort, setPostSort] = useState('date')
  const [showCoach, setShowCoach] = useState(false)
  const [exporting, setExporting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p, h, c] = await Promise.all([
        api('/analytics/stats'), api('/analytics/posts'), api('/analytics/hashtags'), api('/analytics/coach'),
      ])
      setStats(s); setPosts(p); setHashtags(h); setCoach(c)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const fetchNow = async () => {
    setFetching(true)
    try { const r = await api('/analytics/fetch', { method: 'POST' }); toast.success(`Fetched stats for ${r.fetched} post(s)`); await refresh() }
    catch (e) { toast.error(e.message) } finally { setFetching(false) }
  }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const allPosts = await api('/analytics/posts')
      const headers = 'Platform,Date,Caption,Likes,Comments,Shares,Saves,Impressions,Reach,Clicks,Profile Visits\n'
      const rows = allPosts.map(p => `"${p.platform}","${p.checked_at?.slice(0, 10) || ''}","${(p.caption || '').replace(/"/g, '""').slice(0, 100)}",${p.likes || 0},${p.comments || 0},${p.shares || 0},${p.saves || 0},${p.impressions || 0},${p.reach || 0},${p.clicks || 0},${p.profile_visits || 0}`).join('\n')
      const blob = new Blob([headers + rows], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'the-desk-analytics.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (e) { toast.error(e.message) } finally { setExporting(false) }
  }

  const exportPDF = () => {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const to = new Date().toISOString().slice(0, 10)
    window.open(`/api/reports/export-pdf?from=${from}&to=${to}`, '_blank')
  }

  const generateReport = async (type) => {
    try { const r = await api('/analytics/report', { method: 'POST', body: { type } }); toast.success(`${type} report sent to Telegram`) }
    catch (e) { toast.error(e.message) }
  }

  const platforms = ['all', 'linkedin', 'instagram', 'facebook', 'threads']
  const platformMeta = {
    linkedin: { label: 'LinkedIn', color: '#0A66C2', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', light: '#E8F0FE' },
    instagram: { label: 'Instagram', color: '#E4405F', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', light: '#FDE8EF' },
    facebook: { label: 'Facebook', color: '#1877F2', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', light: '#E7F0FE' },
    threads: { label: 'Threads', color: '#000000', bg: 'bg-neutral-50', text: 'text-neutral-700', border: 'border-neutral-300', light: '#F0F0F0' },
  }

  const PlatformIcon = ({ p, size = 16 }) => {
    if (p === 'linkedin') return <svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    if (p === 'instagram') return <svg width={size} height={size} viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
    if (p === 'facebook') return <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    if (p === 'threads') return <svg width={size} height={size} viewBox="0 0 24 24" fill="#000000"><path d="M16.593 3.845c-1.921-1.28-4.376-1.536-7.073-.896-2.389.567-4.29 1.856-5.528 3.665-1.68 2.452-2.088 5.604-1.12 8.604.965 2.988 3.038 5.238 5.734 6.279 2.286.882 4.627.823 6.752-.123 1.615-.716 3.017-1.897 4.062-3.467a11.42 11.42 0 001.58-4.52c.047-.348.066-.548.066-.654 0-.236-.05-.344-.224-.436-.238-.128-.553-.097-.75.058-.224.174-.38.518-.506.904-.109.334-.17.483-.327.63-.675.638-1.543.843-2.477.597-.67-.176-1.158-.577-1.467-1.196 1.184-.374 2.12-.96 2.82-1.755 1.447-1.645 1.85-3.837 1.13-5.44-.78-1.735-2.761-2.664-5.076-2.392-2.555.3-4.425 2.136-5.01 4.926-.143.68-.173 1.235-.153 1.69.274.073.555.165.83.265 2.096.754 3.94 1.826 5.432 3.157.424.378.58.928.398 1.405-.18.472-.639.756-1.143.709-.724-.067-1.302-.8-1.278-1.232.023-.405.07-.658.173-1.025.157-.561.236-.835.236-1.089 0-.56-.345-1.008-.717-1.006-.345.002-.53.138-.708.528-.25.547-.396 1.277-.415 2.026-.018.68.058 1.458.356 2.146.332.767.887 1.26 1.663 1.477 1.604.448 3.225-.266 4.136-1.758.855-1.4.95-3.287.258-4.821-1.019-2.262-3.55-3.608-6.689-3.557-2.673.043-4.982 1.233-6.475 3.346-1.353 1.914-1.82 4.321-1.289 6.693.568 2.536 2.22 4.533 4.685 5.7 2.14 1.013 4.448 1.074 6.556.185 2.203-.93 3.873-2.65 4.85-4.983.042-.1.08-.201.115-.303.149.119.33.206.533.254 1.04.248 2.067-.155 2.707-.873.451-.506.615-1.133.615-1.92 0-.018-.002-.04-.02-.205a13.53 13.53 0 00-1.745-5.33c-1.14-1.88-2.803-3.34-4.834-4.25z"/></svg>
    return null
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  const { totals = {}, byPlatform = {}, engagement = 0, engagement_rate = 0 } = stats || {}
  const filteredPosts = platformTab === 'all' ? posts : posts.filter(p => p.platform === platformTab)
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (postSort === 'likes') return (b.likes || 0) - (a.likes || 0)
    if (postSort === 'engagement') return ((b.likes || 0) + (b.comments || 0) + (b.shares || 0)) - ((a.likes || 0) + (a.comments || 0) + (a.shares || 0))
    return new Date(b.checked_at || 0) - new Date(a.checked_at || 0)
  })

  const topPosts = [...posts].sort((a, b) => ((b.likes || 0) + (b.comments || 0)) - ((a.likes || 0) + (a.comments || 0))).slice(0, 5)
  const worstPosts = [...posts].sort((a, b) => ((a.likes || 0) + (a.comments || 0)) - ((b.likes || 0) + (b.comments || 0))).slice(0, 5)

  const mainMetrics = [
    { label: 'Posts', value: totals.posts || 0, icon: BarChart3 },
    { label: 'Impressions', value: (totals.impressions || 0).toLocaleString(), icon: Eye },
    { label: 'Reach', value: (totals.reach || 0).toLocaleString(), icon: Eye },
    { label: 'Likes', value: (totals.likes || 0).toLocaleString(), icon: Star },
    { label: 'Comments', value: (totals.comments || 0).toLocaleString(), icon: MessageSquare },
    { label: 'Shares', value: (totals.shares || 0).toLocaleString(), icon: RefreshCw },
    { label: 'Saves', value: (totals.saves || 0).toLocaleString(), icon: Save },
  ]

  const maxImpression = Math.max(...Object.values(byPlatform).map(p => p.impressions || 0), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-serif font-semibold text-lg">Audience Book</h3>
          <p className="text-sm text-muted-foreground">Real-time engagement, reach, and impressions across all platforms.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border" onClick={() => setShowCoach(v => !v)}>
            <Sparkles className="h-4 w-4 mr-2" /> AI Coach
          </Button>
          <Button variant="outline" className="border-border" onClick={exportCSV} disabled={exporting}>
            <Save className="h-4 w-4 mr-2" /> {exporting ? 'Exporting...' : 'CSV'}
          </Button>
          <Button variant="outline" className="border-border" onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Button onClick={fetchNow} disabled={fetching} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Fetch
          </Button>
        </div>
      </div>

      {showCoach && coach && (
        <div className="border border-primary/20 rounded-sm p-5 bg-card space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-primary font-serif font-semibold">
            <Sparkles className="h-4 w-4" /> AI Coach Insights
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{coach.insight}</p>
          {coach.recommendations?.length > 0 && (
            <div className="space-y-1.5">
              {coach.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="editorial-mono text-[0.5rem] text-primary border border-primary/30 px-1 py-0.5 rounded-sm">{r.category}</span>
                  <span className="text-foreground/80">{r.text}</span>
                </div>
              ))}
            </div>
          )}
          {coach.best_time && <div className="editorial-mono text-[0.625rem] text-primary">Best time: {coach.best_time} · Best platform: {coach.best_platform}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {mainMetrics.map(m => (
          <div key={m.label} className="border border-border rounded-sm p-4 bg-card shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="editorial-mono text-[0.625rem] text-muted-foreground uppercase">{m.label}</span>
              <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="editorial-title text-xl">{m.value}</div>
          </div>
        ))}
        <div className="border border-border rounded-sm p-4 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="editorial-mono text-[0.625rem] text-muted-foreground uppercase">Eng. Rate</span>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="editorial-title text-xl text-primary">{engagement_rate}%</div>
        </div>
      </div>

      {Object.keys(byPlatform).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(byPlatform).map(([p, d]) => {
            const meta = platformMeta[p] || { label: p, color: '#78716c', bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-300', light: '#f5f5f4' }
            const pct = maxImpression > 0 ? Math.round((d.impressions / maxImpression) * 100) : 0
            return (
              <div key={p} className={`border ${meta.border} rounded-sm p-4 ${meta.bg} shadow-sm`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon p={p} size={20} />
                    <span className={`font-serif font-semibold text-sm ${meta.text}`}>{meta.label}</span>
                  </div>
                  <span className="editorial-mono text-[0.5rem] text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-sm">{d.posts} posts</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                  <div><span className="text-muted-foreground">Likes</span><div className={`font-semibold ${meta.text}`}>{d.likes.toLocaleString()}</div></div>
                  <div><span className="text-muted-foreground">Comments</span><div className={`font-semibold ${meta.text}`}>{d.comments.toLocaleString()}</div></div>
                  <div><span className="text-muted-foreground">Shares</span><div className={`font-semibold ${meta.text}`}>{d.shares.toLocaleString()}</div></div>
                  <div><span className="text-muted-foreground">Saves</span><div className={`font-semibold ${meta.text}`}>{d.saves.toLocaleString()}</div></div>
                  <div><span className="text-muted-foreground">Impressions</span><div className={`font-semibold ${meta.text}`}>{d.impressions.toLocaleString()}</div></div>
                  <div><span className="text-muted-foreground">Reach</span><div className={`font-semibold ${meta.text}`}>{d.reach.toLocaleString()}</div></div>
                </div>
                <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                </div>
                <div className="flex justify-between editorial-mono text-[0.5rem] text-muted-foreground mt-1">
                  <span>Impressions share</span><span>{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-border rounded-sm p-5 bg-card shadow-sm">
          <h4 className="font-serif font-semibold text-sm mb-3">Per-platform comparison</h4>
          {Object.keys(byPlatform).length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Object.entries(byPlatform).map(([k, v]) => ({ name: (platformMeta[k]?.label || k), Impressions: v.impressions, Reach: v.reach, Likes: v.likes }))} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Impressions" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Reach" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Likes" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-xs text-muted-foreground text-center py-10">No platform data yet</div>}
        </div>

        <div className="space-y-4">
          <div className="border border-border rounded-sm p-4 bg-card shadow-sm">
            <h4 className="font-serif font-semibold text-sm mb-3 flex items-center gap-2"><Star className="h-3.5 w-3.5 text-primary" /> Top Posts</h4>
            {topPosts.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No data</div> : topPosts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                <span className="editorial-mono text-[0.625rem] text-muted-foreground w-3">{i + 1}</span>
                <PlatformIcon p={p.platform} size={12} />
                <span className="text-xs text-foreground/70 truncate flex-1">{(p.caption || '').slice(0, 50)}</span>
                <span className="editorial-mono text-xs text-primary shrink-0">{p.likes || 0}</span>
              </div>
            ))}
          </div>
          <div className="border border-border rounded-sm p-4 bg-card shadow-sm">
            <h4 className="font-serif font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-flag" /> Needs Attention</h4>
            {worstPosts.length === 0 ? <div className="text-xs text-muted-foreground py-4 text-center">No data</div> : worstPosts.map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                <span className="editorial-mono text-[0.625rem] text-muted-foreground w-3">{i + 1}</span>
                <PlatformIcon p={p.platform} size={12} />
                <span className="text-xs text-foreground/70 truncate flex-1">{(p.caption || '').slice(0, 50)}</span>
                <span className="editorial-mono text-xs text-flag shrink-0">{p.likes || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hashtags.length > 0 && (
        <div className="border border-border rounded-sm p-5 bg-card shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-serif font-semibold text-sm">Hashtag Performance</h4>
            <span className="editorial-mono text-[0.625rem] text-muted-foreground">{hashtags.length} tags tracked</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {hashtags.sort((a, b) => b.count - a.count).slice(0, 12).map(h => (
              <div key={h.tag} className="border border-border/50 rounded-sm p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="editorial-mono text-xs text-primary truncate font-medium">{h.tag}</div>
                <div className="flex items-center gap-3 editorial-mono text-[0.5rem] text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1"><span className="font-medium text-foreground/70">{h.count}</span> uses</span>
                  <span className="flex items-center gap-1"><span className="font-medium text-foreground/70">{h.avg_impressions}</span> avg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-border rounded-sm bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <h4 className="font-serif font-semibold text-sm">Published Posts ({sortedPosts.length})</h4>
          <select value={postSort} onChange={e => setPostSort(e.target.value)} className="editorial-mono text-[0.625rem] border border-border rounded-sm px-3 py-1.5 bg-card">
            <option value="date">Newest</option>
            <option value="likes">Most Likes</option>
            <option value="engagement">Highest Engagement</option>
          </select>
        </div>
        {sortedPosts.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No posts yet. Publish and fetch stats.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border/50 bg-secondary/20 text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Platform</th>
                <th className="text-left px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Caption</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Likes</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Comments</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Shares</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Saves</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Impressions</th>
                <th className="text-right px-4 py-2.5 font-medium editorial-mono text-[0.5rem] uppercase">Reach</th>
              </tr></thead>
              <tbody>
                {sortedPosts.slice(0, 50).map((p, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5"><PlatformIcon p={p.platform} size={14} /></td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-foreground/70">{(p.caption || '').slice(0, 80)}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-primary">{p.likes || 0}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-flag">{p.comments || 0}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-muted-foreground">{p.shares || 0}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-muted-foreground">{p.saves || 0}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-muted-foreground">{p.impressions || 0}</td>
                    <td className="px-4 py-2.5 text-right editorial-mono text-muted-foreground">{p.reach || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedPosts.length > 50 && <div className="text-center editorial-mono text-[0.5rem] text-muted-foreground py-3 bg-secondary/20">Showing 50 of {sortedPosts.length} posts</div>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="border-border" onClick={() => generateReport('daily')}><Send className="h-3.5 w-3.5 mr-1.5" /> Send Daily Report</Button>
        <Button variant="outline" size="sm" className="border-border" onClick={() => generateReport('weekly')}><Send className="h-3.5 w-3.5 mr-1.5" /> Send Weekly Report</Button>
      </div>
    </div>
  )
}

export default AnalyticsPage
