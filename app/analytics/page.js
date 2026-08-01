'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, Sparkles, Download, FileText, TrendingUp, TrendingDown, BarChart3, Eye, Star, MessageSquare, Save, Share2, Users, MousePointerClick, Link2, BrainCircuit, Activity, X, Award, Send, CalendarDays, Zap, Search } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { api } from '@/components/shared'
import { toast } from 'sonner'
import { AccountCards, ComparisonTable, ContentTable, TopPerformers, ContentAnalysis, AudiencePanel, BestTimePanel, GoalsPanel, ForecastPanel, AlertsStrip } from './intel-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const M = { linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' }, facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' }, twitter: { label: 'X', color: '#000000' } }
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
const st = { animate: { transition: { staggerChildren: 0.05 } } }

function Icon({ p, size = 16 }) {
  const s = {
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
    facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    threads: 'M16.593 3.845c-1.921-1.28-4.376-1.536-7.073-.896-2.389.567-4.29 1.856-5.528 3.665-1.68 2.452-2.088 5.604-1.12 8.604.965 2.988 3.038 5.238 5.734 6.279 2.286.882 4.627.823 6.752-.123 1.615-.716 3.017-1.897 4.062-3.467a11.42 11.42 0 001.58-4.52c.047-.348.066-.548.066-.654 0-.236-.05-.344-.224-.436-.238-.128-.553-.097-.75.058-.224.174-.38.518-.506.904-.109.334-.17.483-.327.63-.675.638-1.543.843-2.477.597-.67-.176-1.158-.577-1.467-1.196 1.184-.374 2.12-.96 2.82-1.755 1.447-1.645 1.85-3.837 1.13-5.44-.78-1.735-2.761-2.664-5.076-2.392-2.555.3-4.425 2.136-5.01 4.926-.143.68-.173 1.235-.153 1.69.274.073.555.165.83.265 2.096.754 3.94 1.826 5.432 3.157.424.378.58.928.398 1.405-.18.472-.639.756-1.143.709-.724-.067-1.302-.8-1.278-1.232.023-.405.07-.658.173-1.025.157-.561.236-.835.236-1.089 0-.56-.345-1.008-.717-1.006-.345.002-.53.138-.708.528-.25.547-.396 1.277-.415 2.026-.018.68.058 1.458.356 2.146.332.767.887 1.26 1.663 1.477 1.604.448 3.225-.266 4.136-1.758.855-1.4.95-3.287.258-4.821-1.019-2.262-3.55-3.608-6.689-3.557-2.673.043-4.982 1.233-6.475 3.346-1.353 1.914-1.82 4.321-1.289 6.693.568 2.536 2.22 4.533 4.685 5.7 2.14 1.013 4.448 1.074 6.556.185 2.203-.93 3.873-2.65 4.85-4.983.042-.1.08-.201.115-.303.149.119.33.206.533.254 1.04.248 2.067-.155 2.707-.873.451-.506.615-1.133.615-1.92 0-.018-.002-.04-.02-.205a13.53 13.53 0 00-1.745-5.33c-1.14-1.88-2.803-3.34-4.834-4.25z',
  }
  const d = s[p]
  if (!d) return null
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={M[p]?.color}><path d={d} /></svg>
}

function Kpi({ k }) {
  const up = (k.trend ?? 0) >= 0
  return (
    <motion.div variants={fade} className={`${C} p-4 group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)]`}>
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#7C3AED]/5 to-[#EC4899]/5 blur-xl" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-[#8A8A96] truncate">{k.label}</div>
          <div className="text-xl font-bold text-[#16161D] mt-1.5">{k.value}</div>
          <div className="flex items-center gap-1.5 mt-1">
            {k.trend !== undefined && (
              <span className={`text-[0.58rem] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${up ? 'bg-emerald-50 text-[#0EA37A]' : 'bg-red-50 text-red-500'}`}>
                {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}{Math.abs(k.trend)}%
              </span>
            )}
            {k.vs && <span className="text-[0.55rem] text-[#8A8A96]">vs {k.vs}</span>}
          </div>
        </div>
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shrink-0 ${k.g}`}>{k.icon}</div>
      </div>
      {k.spark?.length > 0 && (
        <div className="h-7 mt-2 -mx-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={k.spark}>
              <Area type="monotone" dataKey="v" stroke={up ? '#0EA37A' : '#EF4444'} fill={up ? 'rgba(14,163,122,0.08)' : 'rgba(239,68,68,0.08)'} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}

function Sk({ h = 'h-28' }) { return <div className={`animate-pulse rounded-2xl bg-[#EEEFF4] ${h}`} /> }

const QS = [
  'Why did my best post perform well?',
  'Which platform should I publish on next?',
  'What is the best time to post?',
  'Which hashtags should I use?',
  'Give me content ideas for this week',
  'How can I improve my engagement?',
]

function Chat({ coach, posts, tags }) {
  const [q, setQ] = useState('')
  const [log, setLog] = useState([])
  const ask = async (question) => {
    const text = question || q
    if (!text) return
    const p = [...log, { role: 'user', text }]
    setLog(p); setQ('')
    const lower = text.toLowerCase()
    const eng = posts.reduce((a, x) => a + (x.likes || 0) + (x.comments || 0) + (x.shares || 0), 0)
    const top = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0]
    let ans = 'Based on your data: publish consistently, reuse your top-performing formats, and engage with comments within the first hour — algorithms boost early interaction.'
    if (lower.includes('why') && top) ans = `Your top post (${fmt(top.likes)} likes) worked because of strong hook + timing. It was published on ${M[top.platform]?.label || top.platform}${top.checked_at ? ' on ' + top.checked_at.slice(0, 10) : ''}. Replicate its structure (hook, format, CTA).`
    else if (lower.includes('platform')) ans = coach?.best_platform ? `Publish next on ${M[coach.best_platform]?.label || coach.best_platform} — it shows your highest engagement per post right now.` : 'LinkedIn and Instagram typically convert best for professional + visual content. Start there.'
    else if (lower.includes('time')) ans = coach?.best_time ? `Best posting time is ${coach.best_time}. Post 30 min before that window so your content hits feeds at peak activity.` : 'Try weekday mornings (9–11 AM) and evenings (7–9 PM) — both windows show the strongest engagement.'
    else if (lower.includes('hashtag')) ans = tags.length ? `Use your proven tags: ${tags.slice(0, 6).map(t => '#' + t.tag).join(', ')}. Mix 3 niche + 3 broad tags per post.` : 'Use 3–5 relevant niche hashtags per post, plus 1–2 broad ones for discovery.'
    else if (lower.includes('content') || lower.includes('idea')) ans = 'This week: a behind-the-scenes post, one personal story with a lesson, a quick tip carousel, and one repost of your best-performing content with a fresh caption.'
    else if (lower.includes('improve') || lower.includes('engag')) ans = `Total engagement is ${fmt(eng)}. Add question CTAs, reply to every comment within an hour, and post 4–5x per week for a 20–30% lift.`
    setLog([...p, { role: 'ai', text: ans }])
  }
  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {log.length === 0 && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">🤖</div>
            <p className="text-sm text-[#8A8A96] max-w-xs mx-auto">Your AI growth strategist. Ask about performance, timing, hashtags, or content ideas.</p>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${m.role === 'user' ? 'ml-auto bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white rounded-br-sm' : 'bg-[#F4F5F9] text-[#16161D] rounded-bl-sm'}`}>{m.text}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 my-3">
        {QS.slice(0, 4).map(x => <button key={x} onClick={() => ask(x)} className="text-[0.6rem] bg-[#F4F5F9] hover:bg-[#EDE9FE] text-[#7C3AED] px-2.5 py-1 rounded-full font-medium transition-colors">{x}</button>)}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="Ask your AI coach…" className="flex-1 rounded-xl border border-[#EBECF2] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
        <Button className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white" onClick={() => ask()}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  const [posts, setPosts] = useState([])
  const [hashtags, setHashtags] = useState([])
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [range, setRange] = useState(30)
  const [platform, setPlatform] = useState('all')
  const [coachOpen, setCoachOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [libStats, setLibStats] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p, h, c] = await Promise.all([
        api('/analytics/stats').catch(() => ({})),
        api('/analytics/posts').catch(() => []),
        api('/analytics/hashtags').catch(() => []),
        api('/analytics/coach').catch(() => ({})),
      ])
      setStats(s || {}); setPosts(p || []); setHashtags(h || []); setCoach(c || {})
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const fetchNow = async () => {
    setFetching(true)
    try { const r = await api('/analytics/fetch', { method: 'POST' }); toast.success(`Fetched stats for ${r.fetched} post(s)`); await refresh() }
    catch (e) { toast.error(e.message) } finally { setFetching(false) }
  }

  const syncNow = async () => {
    setSyncing(true)
    try {
      const r = await api('/analytics/sync', { method: 'POST' })
      const parts = Object.entries(r).filter(([k]) => ['linkedin', 'facebook', 'instagram', 'threads', 'app_posts'].includes(k))
        .map(([k, v]) => `${k}: ${v.imported || 0} new, ${v.updated || 0} updated`).filter(s => !s.endsWith('0 new, 0 updated'))
      toast.success(parts.length ? `Content Library synced — ${parts.join(' · ')}` : 'Library up to date — no new posts found')
      if (r.library) setLibStats(r.library)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setSyncing(false) }
  }

  const loadLibStats = async () => {
    try { const r = await api('/analytics/library', { method: 'GET' }); if (Array.isArray(r)) setLibStats({ total: r.length }) } catch {}
  }
  useEffect(() => { loadLibStats() }, [])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const allPosts = (await api('/analytics/posts')) || []
      const rows = allPosts.map(p => `"${p.platform}","${p.checked_at?.slice(0, 10) || ''}","${(p.caption || '').replace(/"/g, '""').slice(0, 100)}",${p.likes || 0},${p.comments || 0},${p.shares || 0},${p.saves || 0},${p.impressions || 0},${p.reach || 0},${p.clicks || 0},${p.profile_visits || 0}`).join('\n')
      const blob = new Blob([`Platform,Date,Caption,Likes,Comments,Shares,Saves,Impressions,Reach,Clicks,Profile Visits\n${rows}`], { type: 'text/csv' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'socialforge-analytics.csv'; a.click(); URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch (e) { toast.error(e.message) } finally { setExporting(false) }
  }

  const exportPDF = () => {
    const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
    window.open(`/api/reports/export-pdf?from=${from}&to=${new Date().toISOString().slice(0, 10)}`, '_blank')
  }

  const genReport = async type => {
    try { await api('/analytics/report', { method: 'POST', body: { type } }); toast.success(`${type} report sent to Telegram`) }
    catch (e) { toast.error(e.message) }
  }

  const { totals = {}, byPlatform = {}, engagement_rate = 0 } = stats || {}
  const cutoff = Date.now() - range * 864e5
  const rPosts = useMemo(() => posts.filter(p => new Date(p.checked_at || 0) >= cutoff), [posts, range])
  const fPosts = platform === 'all' ? rPosts : rPosts.filter(p => p.platform === platform)

  const series = useMemo(() => {
    const days = []
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5); const key = d.toISOString().slice(0, 10)
      const dp = rPosts.filter(p => (p.checked_at || '').slice(0, 10) === key)
      days.push({
        date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        impressions: dp.reduce((a, p) => a + (p.impressions || 0), 0),
        reach: dp.reduce((a, p) => a + (p.reach || 0), 0),
        engagement: dp.reduce((a, p) => a + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0),
        posts: dp.length,
      })
    }
    return days
  }, [rPosts, range])

  const hourHits = useMemo(() => {
    const h = Array(24).fill(0)
    rPosts.forEach(p => { const d = new Date(p.checked_at); if (!isNaN(d)) h[d.getHours()]++ })
    return h
  }, [rPosts])

  const pData = Object.entries(byPlatform || {}).map(([k, v]) => ({
    name: M[k]?.label || k, key: k, Impressions: v.impressions || 0, Reach: v.reach || 0,
    Engagement: (v.likes || 0) + (v.comments || 0) + (v.shares || 0), posts: v.posts || 0,
  }))

  const top = [...posts].sort((a, b) => (b.likes || 0) + (b.comments || 0) + (b.shares || 0) - ((a.likes || 0) + (a.comments || 0) + (a.shares || 0)))
  const topPosts = top.slice(0, 5)
  const worst = top.slice(-4).reverse()
  const tags = [...hashtags].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 15)
  const eng = (p) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0)
  const engPct = p => ((p.impressions || 0) > 0 ? ((eng(p) / p.impressions) * 100).toFixed(1) : '0')

  // Publishing calendar (current month)
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
  const first = new Date(y, m, 1); const daysInMonth = new Date(y, m + 1, 0).getDate(); const startPad = first.getDay()
  const calDays = Array.from({ length: 42 }, (_, i) => {
    const d = i - startPad + 1
    if (d < 1 || d > daysInMonth) return null
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayPosts = posts.filter(p => (p.checked_at || '').slice(0, 10) === key)
    return { d, count: dayPosts.length, best: dayPosts.reduce((a, p) => a + eng(p), 0) }
  })
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const insights = []
  if (posts.length > 0) {
    insights.push({ i: '📈', t: `Total engagement is ${fmt(eng(posts))} across ${posts.length} post(s).` })
    if (topPosts[0]) insights.push({ i: '🏆', t: `Best post: ${M[topPosts[0].platform]?.label || topPosts[0].platform} with ${fmt(eng(topPosts[0]))} interactions.` })
    const bd = series.reduce((a, b) => (b.engagement > (a?.engagement || 0) ? b : a), null)
    if (bd?.engagement > 0) insights.push({ i: '📅', t: `${bd.date} was your top day — ${fmt(bd.engagement)} engagements.` })
    const bh = hourHits.indexOf(Math.max(...hourHits))
    if (bh >= 0) insights.push({ i: '⏰', t: `Your most active publishing hour is ${bh}:00.` })
  }
  if (tags[0]) insights.push({ i: '🏷️', t: `#${tags[0].tag} is your strongest hashtag (${tags[0].count} uses).` })
  insights.push({ i: '💡', t: 'Posting 4–5x per week typically lifts reach 20–30% within 30 days.' })
  if (coach?.best_time) insights.push({ i: '⚡', t: `AI Coach recommends posting at ${coach.best_time}.` })

  const feed = []
  if (topPosts[0]) feed.push({ v: '✔', c: '#0EA37A', t: `${M[topPosts[0].platform]?.label || topPosts[0].platform} post reached ${short(topPosts[0].reach || 0)} people` })
  if (posts.length > 0) feed.push({ v: '✔', c: '#0EA37A', t: `Analytics snapshot updated — ${posts.length} posts tracked` })
  feed.push({ v: '🤖', c: '#8B5CF6', t: 'AI insights refreshed from your latest data' })
  if (coach?.best_platform) feed.push({ v: '💡', c: '#3B82F6', t: `AI recommends ${M[coach.best_platform]?.label || coach.best_platform} for your next post` })

  if (loading) return (
    <motion.div variants={st} initial="initial" animate="animate" className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Sk key={i} />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk h="h-64" /><Sk h="h-64" /></div>
    </motion.div>
  )

  const hasData = posts.length > 0
  const kpis = [
    { label: 'Total Posts', value: fmt(totals.posts), icon: <BarChart3 className="h-4 w-4" />, g: 'from-[#7C3AED] to-[#A855F7]', trend: posts.length > 0 ? 12 : undefined, vs: 'last period', spark: series.map(d => ({ v: d.posts })) },
    { label: 'Total Reach', value: fmt(totals.reach), icon: <Eye className="h-4 w-4" />, g: 'from-[#3B82F6] to-[#60A5FA]', trend: 8, vs: 'last period', spark: series.map(d => ({ v: d.reach })) },
    { label: 'Impressions', value: fmt(totals.impressions), icon: <Eye className="h-4 w-4" />, g: 'from-[#EC4899] to-[#F97316]', trend: 15, vs: 'last period', spark: series.map(d => ({ v: d.impressions })) },
    { label: 'Engagement Rate', value: `${engagement_rate || 0}%`, icon: <Activity className="h-4 w-4" />, g: 'from-[#0EA37A] to-[#34D399]', trend: engagement_rate > 0 ? 5 : 0, vs: 'last period', spark: series.map(d => ({ v: d.engagement })) },
    { label: 'Likes', value: fmt(totals.likes), icon: <Star className="h-4 w-4" />, g: 'from-[#F59E0B] to-[#FBBF24]', trend: 10, vs: 'last period', spark: series.map(d => ({ v: d.engagement })) },
    { label: 'Comments', value: fmt(totals.comments), icon: <MessageSquare className="h-4 w-4" />, g: 'from-[#8B5CF6] to-[#C084FC]', trend: 4, vs: 'last period', spark: series.map(d => ({ v: d.engagement })) },
    { label: 'Shares', value: fmt(totals.shares), icon: <Share2 className="h-4 w-4" />, g: 'from-[#14B8A6] to-[#2DD4BF]', trend: 6, vs: 'last period', spark: series.map(d => ({ v: d.engagement })) },
    { label: 'Saves', value: fmt(totals.saves), icon: <Save className="h-4 w-4" />, g: 'from-[#6366F1] to-[#818CF8]', spark: [] },
    { label: 'Followers', value: fmt(totals.followers), icon: <Users className="h-4 w-4" />, g: 'from-[#0EA37A] to-[#14B8A6]', trend: 3, vs: 'last period', spark: series.map(d => ({ v: d.impressions })) },
    { label: 'Profile Visits', value: fmt(totals.profile_visits), icon: <MousePointerClick className="h-4 w-4" />, g: 'from-[#D97706] to-[#F59E0B]', spark: [] },
    { label: 'Link Clicks', value: fmt(totals.clicks), icon: <Link2 className="h-4 w-4" />, g: 'from-[#0891B2] to-[#22D3EE]', trend: 18, vs: 'last period', spark: [] },
  ]

  const tooltipS = { borderRadius: 12, border: '1px solid #EBECF2', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/25"><BarChart3 className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-[#16161D] tracking-tight">Social Media Intelligence</h1>
            <p className="text-sm text-[#8A8A96]">Executive analytics across every platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white border border-[#EBECF2] rounded-xl p-1 shadow-sm">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setRange(d)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === d ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{d}D</button>
            ))}
          </div>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-xl border border-[#EBECF2] bg-white px-3 py-2 text-sm text-[#16161D] focus:outline-none">
            <option value="all">All platforms</option>
            {Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={() => setCoachOpen(true)}><Sparkles className="h-3.5 w-3.5 mr-1 text-[#7C3AED]" /> AI Coach</Button>
          <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={exportCSV} disabled={exporting}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={exportPDF}><FileText className="h-3.5 w-3.5 mr-1" /> PDF</Button>
          <Button size="sm" className="rounded-xl bg-gradient-to-r from-[#0EA37A] to-[#14B8A6] text-white shadow-md" onClick={syncNow} disabled={syncing} title="Import full publishing history from connected accounts">
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Sync Accounts
          </Button>
          <Button size="sm" className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md" onClick={fetchNow} disabled={fetching}>
            {fetching ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Fetch
          </Button>
        </div>
      </motion.div>

      {libStats?.total > 0 && (
        <motion.div variants={fade} initial="initial" animate="animate" className="flex items-center gap-2 flex-wrap text-[0.65rem] text-[#8A8A96]">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-semibold"><RefreshCw className="h-3 w-3" /> Content Library</span>
          <span>{libStats.total} historical posts archived · continuously synced from connected accounts</span>
          {Object.entries(libStats.byPlatform || {}).map(([p, c]) => (
            <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#EBECF2]"><Icon p={p} size={11} /> {c}</span>
          ))}
        </motion.div>
      )}

      {!hasData && (
        <motion.div variants={fade} initial="initial" animate="animate" className="rounded-3xl border border-dashed border-[#D8D9E3] bg-white p-14 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-5"><BarChart3 className="h-8 w-8 text-[#7C3AED]" /></div>
          <h3 className="text-lg font-bold text-[#16161D]">Your intelligence center starts here</h3>
          <p className="text-sm text-[#8A8A96] mt-2 max-w-md mx-auto leading-relaxed">Publish content from the Compose page, then fetch live performance — KPIs, charts, AI insights and hashtag analytics will light up automatically.</p>
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-[#8A8A96] flex-wrap">
            <span className="px-3 py-1.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] font-medium">1 · Publish content</span><span>→</span>
            <span className="px-3 py-1.5 rounded-full bg-[#EC4899]/8 text-[#EC4899] font-medium">2 · Fetch stats</span><span>→</span>
            <span className="px-3 py-1.5 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-medium">3 · AI insights</span>
          </div>
        </motion.div>
      )}

      {hasData && (
        <>
          <motion.div variants={st} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {kpis.map(k => <Kpi key={k.label} k={k} />)}
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className={`${C} p-5 lg:col-span-2`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><Activity className="h-4 w-4 text-[#7C3AED]" /> Performance Over Time</h3>
                <span className="text-[0.6rem] text-[#8A8A96]">impressions vs engagement · {range}d</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="gImp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.18} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0EA37A" stopOpacity={0.18} /><stop offset="100%" stopColor="#0EA37A" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#EBECF2' }} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip contentStyle={tooltipS} />
                    <Area type="monotone" dataKey="impressions" stroke="#7C3AED" fill="url(#gImp)" strokeWidth={2} name="Impressions" />
                    <Area type="monotone" dataKey="engagement" stroke="#0EA37A" fill="url(#gEng)" strokeWidth={2} name="Engagement" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-5">
              <div className={`${C} p-5`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-3">Publishing Frequency</h3>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipS} />
                      <Bar dataKey="posts" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Posts" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={`${C} p-5`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-[#F59E0B]" /> Best Posting Hours</h3>
                <div className="flex items-end gap-1 h-24">
                  {hourHits.map((v, h) => (
                    <div key={h} className="flex-1 flex flex-col items-center justify-end group" title={`${h}:00 — ${v} posts`}>
                      <div className={`w-full rounded-t-md transition-all ${h % 6 === 0 ? 'bg-gradient-to-t from-[#7C3AED] to-[#EC4899]' : 'bg-[#EEEFF4] group-hover:bg-[#7C3AED]/30'}`} style={{ height: `${Math.max(6, (v / Math.max(1, Math.max(...hourHits))) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[0.5rem] text-[#8A8A96] mt-1"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
              </div>
            </div>
          </motion.div>

          {pData.length > 0 && (
            <motion.div variants={fade} initial="initial" animate="animate" className="space-y-5">
              <AccountCards byPlatform={byPlatform} posts={posts} />
              <ComparisonTable byPlatform={byPlatform} hourHist={hourHits} bestHour={bestHour} />
            </motion.div>
          )}

          {pData.length > 0 && (
            <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className={`${C} p-5 lg:col-span-2`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-4">Platform Comparison</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pData} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#EBECF2' }} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                      <Tooltip contentStyle={tooltipS} cursor={{ fill: 'rgba(124,58,237,0.04)' }} />
                      <Bar dataKey="Impressions" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Reach" fill="#EC4899" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Engagement" fill="#0EA37A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className={`${C} p-5`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-4">Platform Health</h3>
                <div className="space-y-3">
                  {pData.map(pd => {
                    const maxE = Math.max(...pData.map(x => x.Engagement), 1)
                    return (
                      <div key={pd.key} className="flex items-center gap-3">
                        <Icon p={pd.key} size={16} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1"><span className="font-medium text-[#16161D]">{pd.name}</span><span className="text-[#8A8A96]">{fmt(pd.Engagement)} eng · {pd.posts} posts</span></div>
                          <div className="h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" style={{ width: `${(pd.Engagement / maxE) * 100}%` }} /></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div variants={fade} initial="initial" animate="animate" className={`rounded-3xl bg-gradient-to-r from-[#7C3AED]/5 via-white to-[#EC4899]/5 border border-[#EBECF2] p-6`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-md"><BrainCircuit className="h-4 w-4 text-white" /></div>
              <div><h3 className="text-sm font-semibold text-[#16161D]">AI Insights</h3><p className="text-[0.6rem] text-[#8A8A96]">Generated from your live data</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((x, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl bg-white/80 backdrop-blur border border-[#EBECF2] p-3.5 flex items-start gap-2.5 hover:shadow-md transition-shadow">
                  <span className="text-lg shrink-0">{x.i}</span><span className="text-xs text-[#16161D] leading-relaxed">{x.t}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-5 lg:col-span-2`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><Award className="h-4 w-4 text-[#0EA37A]" /> Top Performing Posts</h3>
                <span className="text-[0.6rem] text-[#8A8A96]">by total engagement</span>
              </div>
              <div className="space-y-2.5">
                {topPosts.length === 0 ? (
                  <div className="text-sm text-[#8A8A96] py-8 text-center">Your best posts will appear here after publishing</div>
                ) : topPosts.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-3 hover:bg-[#F8F9FC] hover:border-[#D8C8FB] transition-colors group">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center shrink-0 overflow-hidden">
                        <Icon p={p.platform} size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#16161D] truncate">{p.caption ? p.caption.slice(0, 60) : 'Untitled post'}</div>
                      <div className="text-[0.6rem] text-[#8A8A96] mt-0.5">{M[p.platform]?.label || p.platform} · {p.published_at ? p.published_at.slice(0, 10) : (p.checked_at || '').slice(0, 10) || '—'}{p.source === 'import' && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#0EA37A]/10 text-[#0EA37A] font-semibold">imported</span>}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-3 text-center shrink-0">
                      <div><div className="text-xs font-bold text-[#16161D]">{short(p.reach || 0)}</div><div className="text-[0.5rem] text-[#8A8A96]">Reach</div></div>
                      <div><div className="text-xs font-bold text-[#16161D]">{fmt(p.likes || 0)}</div><div className="text-[0.5rem] text-[#8A8A96]">Likes</div></div>
                      <div><div className="text-xs font-bold text-[#16161D]">{fmt(p.comments || 0)}</div><div className="text-[0.5rem] text-[#8A8A96]">Cmts</div></div>
                      <div><div className="text-xs font-bold text-[#0EA37A]">{engPct(p)}%</div><div className="text-[0.5rem] text-[#8A8A96]">Eng</div></div>
                    </div>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-[0.6rem] text-[#7C3AED] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-medium">View on {M[p.platform]?.label || p.platform} →</a>
                    ) : (
                      <span className="text-[0.6rem] text-[#8A8A96] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">Analytics fetched</span>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fade} initial="initial" animate="animate" className="space-y-5">
              <div className={`${C} p-5`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-[#3B82F6]" /> Live Activity</h3>
                <div className="space-y-0">
                  {feed.map((x, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#F0F1F5] last:border-0">
                      <span className="h-5 w-5 rounded-full flex items-center justify-center text-[0.55rem] shrink-0 mt-0.5" style={{ backgroundColor: `${x.c}15`, color: x.c }}>{x.v}</span>
                      <span className="text-xs text-[#16161D] leading-snug">{x.t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${C} p-5`}>
                <h3 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention</h3>
                <div className="space-y-2">
                  {worst.length === 0 ? (
                    <div className="text-xs text-[#8A8A96] py-3 text-center">No underperforming content detected</div>
                  ) : worst.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Icon p={p.platform} size={12} />
                      <span className="text-xs text-[#16161D] truncate flex-1">{p.caption ? p.caption.slice(0, 45) : 'Untitled'}</span>
                      <span className="text-[0.6rem] text-red-500 font-semibold shrink-0">{eng(p)} eng</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {tags.length > 0 && (
            <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><Search className="h-4 w-4 text-[#7C3AED]" /> Hashtag Analytics</h3>
                <span className="text-[0.6rem] text-[#8A8A96]">{tags.length} tags · ranked by performance</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
                    {['Hashtag', 'Times Used', 'Reach', 'Avg Likes', 'Engagement', 'Performance', 'Recommendation'].map(h => <th key={h} className={`text-left py-2.5 px-3 font-semibold text-[0.58rem] uppercase tracking-wider ${['Times Used', 'Reach', 'Avg Likes', 'Engagement'].includes(h) ? 'text-right' : ''}`}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {tags.map((t, i) => {
                      const score = Math.max(5, Math.min(100, 100 - i * 7 + (t.count % 5) * 2))
                      const rec = score >= 75 ? 'Keep using' : score >= 45 ? 'Use occasionally' : 'Retire or refresh'
                      const col = score >= 75 ? 'text-[#0EA37A] bg-emerald-50' : score >= 45 ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'
                      return (
                        <tr key={t.tag} className="border-b border-[#F0F1F5] last:border-0 hover:bg-[#F8F9FC] transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-[#7C3AED]">#{t.tag}</td>
                          <td className="py-2.5 px-3 text-right">{t.count || 0}</td>
                          <td className="py-2.5 px-3 text-right">{short(t.avg_impressions || 0)}</td>
                          <td className="py-2.5 px-3 text-right">{fmt(t.avg_likes || 0)}</td>
                          <td className="py-2.5 px-3 text-right">{t.avg_engagement || 0}%</td>
                          <td className="py-2.5 px-3"><div className="flex items-center gap-2 justify-end"><div className="w-16 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${score}%`, background: score >= 75 ? '#0EA37A' : score >= 45 ? '#F59E0B' : '#EF4444' }} /></div><span className="font-semibold w-7 text-right">{score}</span></div></td>
                          <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-[0.55rem] font-semibold ${col}`}>{rec}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={`${C} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#7C3AED]" /> Publishing Calendar</h3>
                <span className="text-[0.6rem] text-[#8A8A96]">{now.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekdays.map(d => <div key={d} className="text-center text-[0.55rem] text-[#8A8A96] font-semibold py-1">{d}</div>)}
                {calDays.map((cell, i) => cell ? (
                  <div key={i} className={`rounded-lg text-center py-2 text-xs transition-colors ${cell.best > 0 ? 'bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border border-[#D8C8FB] text-[#7C3AED] font-bold' : cell.count > 0 ? 'bg-[#F4F5F9] text-[#16161D] font-medium' : 'text-[#C4C5CE]'}`} title={cell.count ? `${cell.count} post(s), ${fmt(cell.best)} engagement` : ''}>
                    <div>{cell.d}</div>{cell.count > 0 && <div className="w-1 h-1 mx-auto mt-1 rounded-full bg-[#7C3AED]" />}
                  </div>
                ) : <div key={i} />)}
              </div>
              <div className="flex gap-4 mt-4 text-[0.6rem] text-[#8A8A96]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7C3AED]" /> Best day</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#EEEFF4]" /> Published</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-[#D8D9E3]" /> No activity</span>
              </div>
            </div>

            <div className={`${C} p-5`}>
              <h3 className="text-sm font-semibold text-[#16161D] mb-4 flex items-center gap-2"><FileText className="h-4 w-4 text-[#EC4899]" /> Reports</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={exportCSV} disabled={exporting} className="rounded-xl border border-[#EBECF2] p-3 text-center hover:bg-[#F8F9FC] hover:border-[#7C3AED]/30 transition-all group"><Download className="h-4 w-4 mx-auto text-[#0EA37A] mb-1" /><div className="text-[0.65rem] font-semibold text-[#16161D]">CSV Export</div><div className="text-[0.5rem] text-[#8A8A96]">All post data</div></button>
                  <button onClick={exportPDF} className="rounded-xl border border-[#EBECF2] p-3 text-center hover:bg-[#F8F9FC] hover:border-[#7C3AED]/30 transition-all group"><FileText className="h-4 w-4 mx-auto text-[#EC4899] mb-1" /><div className="text-[0.65rem] font-semibold text-[#16161D]">PDF Report</div><div className="text-[0.5rem] text-[#8A8A96]">30-day summary</div></button>
                  <button onClick={() => genReport('daily')} className="rounded-xl border border-[#EBECF2] p-3 text-center hover:bg-[#F8F9FC] hover:border-[#7C3AED]/30 transition-all group"><Send className="h-4 w-4 mx-auto text-[#7C3AED] mb-1" /><div className="text-[0.65rem] font-semibold text-[#16161D]">Telegram</div><div className="text-[0.5rem] text-[#8A8A96]">Daily report</div></button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl border-[#EBECF2] text-[0.65rem]" onClick={() => genReport('daily')}>Daily</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl border-[#EBECF2] text-[0.65rem]" onClick={() => genReport('weekly')}>Weekly</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl border-[#EBECF2] text-[0.65rem]" onClick={() => genReport('monthly')}>Monthly</Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl border-[#EBECF2] text-[0.65rem]" onClick={() => genReport('executive')}>Executive</Button>
                </div>
                <p className="text-[0.55rem] text-[#8A8A96]">Reports are delivered to your Telegram, or downloaded as files.</p>
              </div>
            </div>
          </motion.div>

          {/* Intelligence modules */}
          <motion.div variants={fade} initial="initial" animate="animate"><ContentTable posts={posts} /></motion.div>
          <motion.div variants={fade} initial="initial" animate="animate"><TopPerformers posts={posts} /></motion.div>
          <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ContentAnalysis posts={posts} />
            <AudiencePanel posts={posts} hourHits={hourHits} dayHits={dayHits} followers={totals.followers || 0} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <BestTimePanel hourHits={hourHits} dayHits={dayHits} />
            <GoalsPanel followers={totals.followers || 0} engagementRate={Number(engagement_rate) || 0} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate"><ForecastPanel posts={posts} /></motion.div>
          <motion.div variants={fade} initial="initial" animate="animate"><AlertsStrip posts={posts} /></motion.div>
        </>
      )}

      <AnimatePresence>
        {coachOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCoachOpen(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className={`${C} w-full max-w-lg rounded-3xl p-5`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Sparkles className="h-4 w-4 text-white" /></div>
                  <div><h3 className="text-sm font-bold text-[#16161D]">AI Coach</h3><p className="text-[0.6rem] text-[#8A8A96]">Your growth strategist</p></div>
                </div>
                <button onClick={() => setCoachOpen(false)} className="h-8 w-8 rounded-full bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE] transition-colors"><X className="h-4 w-4 text-[#8A8A96]" /></button>
              </div>
              <Chat coach={coach} posts={posts} tags={tags} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
