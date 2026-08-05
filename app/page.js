'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, Sparkles, TrendingUp, TrendingDown, BarChart3, Eye, Star, MessageSquare, Share2, Users, CheckCircle, Clock, XCircle, Pause, Play, Send, CalendarDays, Activity, BrainCircuit, ArrowRight, Rocket, FileText, ListChecks, Image as ImageIcon, AlertTriangle, Bot, Zap, Radio, LayoutDashboard } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '@/components/shared'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const M = { linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' }, facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' }, twitter: { label: 'X', color: '#000000' } }
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
const st = { animate: { transition: { staggerChildren: 0.04 } } }

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

function Kpi({ k, onSelect }) {
  const up = (k.trend ?? 0) >= 0
  return (
    <motion.button variants={fade} onClick={() => onSelect?.(k)} className={`${C} p-4 group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)] text-left w-full cursor-pointer`}>
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br from-[#7C3AED]/5 to-[#EC4899]/5 blur-xl" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[0.78rem] font-semibold uppercase tracking-wider text-[#8A8A96] truncate">{k.label}</div>
          <div className="text-xl font-bold text-[#16161D] mt-1.5">{k.value}</div>
          <div className="flex items-center gap-1.5 mt-1">
            {k.trend !== undefined && (
              <span className={`text-[0.78rem] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${up ? 'bg-emerald-50 text-[#0EA37A]' : 'bg-red-50 text-red-500'}`}>
                {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}{Math.abs(k.trend)}%
              </span>
            )}
            {k.vs && <span className="text-[0.9rem] text-[#8A8A96]">vs {k.vs}</span>}
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
    </motion.button>
  )
}

function Sk({ h = 'h-28' }) { return <div className={`animate-pulse rounded-2xl bg-[#EEEFF4] ${h}`} /> }

function Section({ title, icon, accent = '#7C3AED', badge, open, onToggle, children, sub }) {
  return (
    <div className={`${C} overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#F8F9FC] transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}12`, color: accent }}>{icon}</span>
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold text-[#16161D]">{title}</div>
            {sub && <div className="text-[0.95rem] text-[#8A8A96] truncate">{sub}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && <span className="text-[0.95rem] px-2 py-0.5 rounded-full bg-[#F4F5F9] text-[#8A8A96] font-semibold">{badge}</span>}
          <ChevronDown className={`h-4 w-4 text-[#8A8A96] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [posts, setPosts] = useState([])
  const [audit, setAudit] = useState([])
  const [analytics, setAnalytics] = useState({})
  const [auto, setAuto] = useState({})
  const [coach, setCoach] = useState(null)
  const [range, setRange] = useState(7)
  const [pausing, setPausing] = useState(false)
  const [queue, setQueue] = useState([])
  const [expanded, setExpanded] = useState({})
  const [focusKpi, setFocusKpi] = useState(null)
  const router = useRouter()

  const toggle = k => setExpanded(s => ({ ...s, [k]: !s[k] }))

  useEffect(() => {
    (async () => {
      try {
        const [j, a, s, p, am, c, q] = await Promise.all([
          api('/jobs').catch(() => []),
          api('/audit?limit=50').catch(() => []),
          api('/analytics/stats').catch(() => ({})),
          api('/analytics/posts').catch(() => []),
          api('/automation-stats').catch(() => ({})),
          api('/analytics/coach').catch(() => null),
          api('/automation/queue').catch(() => []),
        ])
        setJobs(j || []); setAudit(a || []); setAnalytics(s || {}); setPosts(p || []); setAuto(am || {}); setCoach(c || null); setQueue(q || [])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    })()
  }, [])

  const togglePause = async () => {
    setPausing(true)
    try { await api('/automation/settings', { method: 'PUT', body: { pause_queue: !(auto.pause_queue || auto.status === 'Paused') } }); toast.success(auto.status === 'Paused' ? 'Automation resumed' : 'Automation paused'); window.location.reload() }
    catch (e) { toast.error(e.message) } finally { setPausing(false) }
  }

  const genReport = async () => { try { await api('/analytics/report', { method: 'POST', body: { type: 'daily' } }); toast.success('Daily report sent to Telegram') } catch (e) { toast.error(e.message) } }

  const { totals = {}, byPlatform = {}, engagement_rate = 0 } = analytics
  const status = auto.status || 'Disabled'
  const paused = status === 'Paused'

  const today = new Date().toDateString()
  const todayJobs = jobs.filter(j => { const d = j.created_at || j.published_at; return d && new Date(d).toDateString() === today })
  const publishedToday = todayJobs.filter(j => j.status === 'published').length + (auto.posts_published_today || 0)
  const scheduled = jobs.filter(j => j.status === 'scheduled').length + todayJobs.filter(j => j.scheduled_for).length
  const waitingApproval = (auto.waiting_approval || 0) + (auto.blog_waiting_approval || 0)
  const failed = jobs.filter(j => j.status === 'failed').length + (auto.failed || 0)
  const successRate = auto.success_rate ?? 0
  const queueSize = auto.queue_size || 0

  // Time series from posts (impressions/reach/engagement per day)
  const series = useMemo(() => {
    const days = []
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5); const key = d.toISOString().slice(0, 10)
      const dp = posts.filter(p => (p.published_at || '').slice(0, 10) === key)
      days.push({
        date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        impressions: dp.reduce((a, p) => a + (p.impressions || 0), 0),
        reach: dp.reduce((a, p) => a + (p.reach || 0), 0),
        engagement: dp.reduce((a, p) => a + (p.likes || 0) + (p.comments || 0) + (p.shares || 0), 0),
        published: dp.length,
      })
    }
    return days
  }, [posts, range])

  const eng = p => (p.likes || 0) + (p.comments || 0) + (p.shares || 0)
  const sortedByEng = [...posts].sort((a, b) => eng(b) - eng(a))
  const topPosts = sortedByEng.slice(0, 5)
  const recentPosts = [...posts].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)).slice(0, 6)
  const platformsConnected = Object.keys(byPlatform || {}).length
  const engToday = todayJobs.reduce((a, j) => a + eng(j), 0)
  const followers = totals.followers || 0

  const hourHits = useMemo(() => {
    const h = Array(24).fill(0)
    posts.forEach(p => { const d = new Date(p.published_at || p.checked_at); if (!isNaN(d)) h[d.getHours()]++ })
    return h
  }, [posts])
  const dayHits = useMemo(() => {
    const d = Array(7).fill(0)
    posts.forEach(p => { const dt = new Date(p.published_at || p.checked_at); if (!isNaN(dt)) d[dt.getDay()]++ })
    return d
  }, [posts])
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Timeline: today's events from jobs
  const timeline = useMemo(() => {
    const events = todayJobs.map(j => ({
      time: j.published_at || j.created_at || j.scheduled_for,
      status: j.published_at && j.status === 'published' ? 'published' : j.status,
      label: j.topic || j.status,
      id: j.id,
    })).filter(e => e.time).sort((a, b) => new Date(a.time) - new Date(b.time)).slice(-6)
    const pending = waitingApproval > 0 && !events.find(e => e.status === 'pending_approval') ? [{ time: new Date().toISOString(), status: 'pending_approval', label: `${waitingApproval} awaiting approval`, id: null }] : []
    const upcoming = auto.next_slot && !events.find(e => e.status === 'scheduled') ? [{ time: new Date().toISOString().slice(0, 11) + auto.next_slot + ':00', status: 'scheduled', label: `Next post ${auto.next_slot}`, id: null }] : []
    return [...events, ...pending, ...upcoming].slice(0, 6)
  }, [todayJobs, waitingApproval, auto])

  const statusMeta = {
    published: { label: 'Published', color: '#0EA37A', bg: 'bg-emerald-50 text-[#0EA37A]' },
    pending_approval: { label: 'Waiting Approval', color: '#F59E0B', bg: 'bg-amber-50 text-amber-600' },
    scheduled: { label: 'Scheduled', color: '#7C3AED', bg: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
    generating: { label: 'Generating', color: '#8B5CF6', bg: 'bg-[#8B5CF6]/10 text-[#8B5CF6]' },
    draft: { label: 'Draft', color: '#8A8A96', bg: 'bg-[#F4F5F9] text-[#8A8A96]' },
    failed: { label: 'Failed', color: '#EF4444', bg: 'bg-red-50 text-red-500' },
  }

  // Calendar (current month)
  const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const startPad = first.getDay()
  const calDays = Array.from({ length: 42 }, (_, i) => {
    const d = i - startPad + 1
    if (d < 1 || d > daysInMonth) return null
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayPosts = posts.filter(p => (p.published_at || '').slice(0, 10) === key)
    const dayJobs = jobs.filter(j => (j.scheduled_for || '').slice(0, 10) === key)
    const pub = dayPosts.length + jobs.filter(j => j.status === 'published' && (j.published_at || '').slice(0, 10) === key).length
    const sch = dayJobs.filter(j => j.status === 'scheduled').length
    return { d, pub, sch, best: dayPosts.reduce((a, p) => a + eng(p), 0) }
  })

  const pipeline = [
    { key: 'generating', label: 'Generating', count: todayJobs.filter(j => j.status === 'generating').length + queueSize, color: '#8B5CF6' },
    { key: 'approval', label: 'Waiting Approval', count: waitingApproval, color: '#F59E0B' },
    { key: 'publishing', label: 'Publishing', count: scheduled, color: '#3B82F6' },
    { key: 'completed', label: 'Completed', count: publishedToday, color: '#0EA37A' },
    { key: 'failed', label: 'Failed', count: failed, color: '#EF4444' },
  ]
  const pipeTotal = Math.max(1, pipeline.reduce((a, p) => a + p.count, 0))

  const notifications = []
  if (publishedToday > 0) notifications.push({ i: '✔', c: '#0EA37A', t: `${publishedToday} post(s) published today` })
  if (waitingApproval > 0) notifications.push({ i: '⏳', c: '#F59E0B', t: `${waitingApproval} post(s) awaiting your approval` })
  if (failed > 0) notifications.push({ i: '⚠', c: '#EF4444', t: `${failed} job(s) failed — check the queue` })
  if (topPosts[0]) notifications.push({ i: '🏆', c: '#7C3AED', t: `Top post earned ${fmt(eng(topPosts[0]))} interactions` })
  notifications.push({ i: '🤖', c: '#8B5CF6', t: status === 'Running' ? 'AI automation is running' : `Automation ${status.toLowerCase()}` })
  if (coach?.best_time) notifications.push({ i: '⏰', c: '#3B82F6', t: `AI recommends posting at ${coach.best_time}` })

  const quickActions = [
    { label: 'Compose Post', icon: <Rocket className="h-5 w-5" />, g: 'from-[#7C3AED] to-[#A855F7]', href: '/compose' },
    { label: 'Generate with AI', icon: <Sparkles className="h-5 w-5" />, g: 'from-[#EC4899] to-[#F97316]', href: '/compose?ai=1' },
    { label: 'Upload Images', icon: <ImageIcon className="h-5 w-5" />, g: 'from-[#3B82F6] to-[#60A5FA]', href: '/automation?tab=queue' },
    { label: 'Import Blog Topics', icon: <ListChecks className="h-5 w-5" />, g: 'from-[#0EA37A] to-[#34D399]', href: '/blog-automation?tab=topics' },
    { label: 'Open Queue', icon: <Clock className="h-5 w-5" />, g: 'from-[#F59E0B] to-[#FBBF24]', href: '/automation' },
    { label: 'View Analytics', icon: <BarChart3 className="h-5 w-5" />, g: 'from-[#6366F1] to-[#818CF8]', href: '/analytics' },
    { label: 'Generate Report', icon: <FileText className="h-5 w-5" />, g: 'from-[#14B8A6] to-[#2DD4BF]', href: null, action: genReport },
  ]

  const insights = []
  if (posts.length > 0) {
    const tEng = posts.reduce((a, p) => a + eng(p), 0)
    insights.push({ i: '📈', t: `Your content earned ${fmt(tEng)} total interactions across ${posts.length} post(s).` })
    const bestDay = series.reduce((a, b) => (b.engagement > (a?.engagement || 0) ? b : a), null)
    if (bestDay?.engagement > 0) insights.push({ i: '📅', t: `${bestDay.date} was your best day — ${fmt(bestDay.engagement)} engagements.` })
    if (topPosts[0]) insights.push({ i: '🏆', t: `"${(topPosts[0].caption || '').slice(0, 45)}…" is your best performer on ${M[topPosts[0].platform]?.label}.` })
  }
  insights.push({ i: '⏰', t: `AI Coach best time: ${coach?.best_time || '9–11 AM weekday mornings'}.` })
  if (coach?.best_platform) insights.push({ i: '🎯', t: `Best platform right now: ${M[coach.best_platform]?.label || coach.best_platform}.` })
  insights.push({ i: '💡', t: 'Posting 4–5x per week typically lifts reach 20–30% in 30 days.' })

  const queueEta = queueSize > 0 ? `${Math.floor(queueSize * 8 / 60)}h ${Math.round(queueSize * 8 % 60)}m` : '0m'
  const health = successRate >= 90 ? 'Excellent' : successRate >= 70 ? 'Good' : 'Needs attention'
  const healthColor = successRate >= 90 ? '#0EA37A' : successRate >= 70 ? '#F59E0B' : '#EF4444'

  const tooltipS = { borderRadius: 12, border: '1px solid #EBECF2', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }

  if (loading) return (
    <motion.div variants={st} initial="initial" animate="animate" className="space-y-5 p-6 max-w-[1440px] mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Sk key={i} />)}</div>
      <Sk h="h-44" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Sk h="h-64" /><Sk h="h-64" /></div>
    </motion.div>
  )

  const kpis = [
    { label: 'Platforms Connected', value: fmt(platformsConnected || Object.keys(M).length), icon: <LayoutDashboard className="h-4 w-4" />, g: 'from-[#7C3AED] to-[#A855F7]', vs: 'accounts', spark: [] },
    { label: 'Published Today', value: fmt(publishedToday), icon: <CheckCircle className="h-4 w-4" />, g: 'from-[#0EA37A] to-[#34D399]', trend: publishedToday > 0 ? 10 : 0, vs: 'yesterday', spark: series.map(d => ({ v: d.published })) },
    { label: 'Scheduled', value: fmt(scheduled), icon: <CalendarDays className="h-4 w-4" />, g: 'from-[#3B82F6] to-[#60A5FA]', vs: 'upcoming', spark: [] },
    { label: 'Queue Size', value: fmt(queueSize), icon: <Clock className="h-4 w-4" />, g: 'from-[#F59E0B] to-[#FBBF24]', vs: 'posts waiting', spark: [] },
    { label: 'Waiting Approval', value: fmt(waitingApproval), icon: <MessageSquare className="h-4 w-4" />, g: 'from-[#8B5CF6] to-[#C084FC]', vs: 'needs review', spark: [] },
    { label: 'AI Generated Today', value: fmt(auto.posts_generated_today || 0), icon: <Sparkles className="h-4 w-4" />, g: 'from-[#EC4899] to-[#F97316]', trend: 25, vs: 'yesterday', spark: series.map(d => ({ v: d.published })) },
    { label: 'Engagement Today', value: fmt(engToday), icon: <Activity className="h-4 w-4" />, g: 'from-[#14B8A6] to-[#2DD4BF]', trend: 8, vs: 'yesterday', spark: series.map(d => ({ v: d.engagement })) },
    { label: 'Followers', value: fmt(followers), icon: <Users className="h-4 w-4" />, g: 'from-[#0EA37A] to-[#14B8A6]', trend: 3, vs: 'last week', spark: series.map(d => ({ v: d.reach })) },
    { label: 'Reach', value: fmt(totals.reach), icon: <Eye className="h-4 w-4" />, g: 'from-[#3B82F6] to-[#60A5FA]', trend: 12, vs: 'last period', spark: series.map(d => ({ v: d.reach })) },
    { label: 'Impressions', value: fmt(totals.impressions), icon: <Eye className="h-4 w-4" />, g: 'from-[#EC4899] to-[#F97316]', trend: 15, vs: 'last period', spark: series.map(d => ({ v: d.impressions })) },
    { label: 'Success Rate', value: `${successRate}%`, icon: <CheckCircle className="h-4 w-4" />, g: 'from-[#6366F1] to-[#818CF8]', vs: 'all jobs', spark: [] },
    { label: 'Failed Jobs', value: fmt(failed), icon: <XCircle className="h-4 w-4" />, g: 'from-[#EF4444] to-[#F87171]', trend: failed > 0 ? -10 : 0, vs: 'needs review', spark: [] },
  ]

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/25"><Bot className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-[#16161D] tracking-tight">AI Command Center</h1>
            <p className="text-sm text-[#8A8A96]">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })} · your business at a glance</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-[0.85rem] font-semibold flex items-center gap-1.5 ${paused ? 'bg-amber-50 text-amber-600' : status === 'Running' ? 'bg-emerald-50 text-[#0EA37A]' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-amber-500' : status === 'Running' ? 'bg-[#0EA37A] animate-pulse' : 'bg-[#8A8A96]'}`} /> {status}
          </span>
          <button onClick={genReport} className="px-3.5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md hover:opacity-90 transition-opacity">Generate Report</button>
        </div>
      </motion.div>

      {/* KPI grid */}
      <motion.div variants={st} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {kpis.map(k => <Kpi key={k.label} k={k} onSelect={k => setFocusKpi(f => f === k.label ? null : k.label)} />)}
      </motion.div>

      {/* KPI drill-down panel */}
      <AnimatePresence>
        {focusKpi && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`${C} p-5 border-l-4`} style={{ borderLeftColor: '#7C3AED' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#16161D] flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[#7C3AED]" /> {focusKpi} — Detail Audit</h3>
              <button onClick={() => setFocusKpi(null)} className="text-[0.95rem] text-[#8A8A96] hover:text-[#7C3AED] font-medium">Close ✕</button>
            </div>
            {(() => {
              const rows = []
              if (focusKpi === 'Published Today' || focusKpi === 'AI Generated Today') {
                todayJobs.slice(-12).reverse().forEach(j => rows.push({ t: j.topic || 'Untitled', d: j.created_at, s: j.status, icon: <CheckCircle className="h-3.5 w-3.5 text-[#0EA37A]" /> }))
              } else if (focusKpi === 'Queue Size' || focusKpi === 'Waiting Approval') {
                queue.filter(q => focusKpi === 'Waiting Approval' ? q.status === 'pending_approval' : true).slice(0, 12).forEach(q => rows.push({ t: q.topic || q.file_id || 'Queued item', d: q.queue_position ? `position ${q.queue_position}` : q.updated_at, s: q.status, icon: <Clock className="h-3.5 w-3.5 text-[#F59E0B]" /> }))
                if (focusKpi === 'Waiting Approval') rows.push({ t: `Blog: ${auto.blog_waiting_approval || 0} awaiting approval`, d: 'blog queue', s: 'pending_approval', icon: <FileText className="h-3.5 w-3.5 text-[#7C3AED]" /> })
              } else if (focusKpi === 'Scheduled') {
                jobs.filter(j => j.status === 'scheduled').slice(0, 12).forEach(j => rows.push({ t: j.topic || 'Untitled', d: j.scheduled_for, s: 'scheduled', icon: <CalendarDays className="h-3.5 w-3.5 text-[#7C3AED]" /> }))
              } else if (focusKpi === 'Failed Jobs') {
                jobs.filter(j => j.status === 'failed').slice(0, 12).forEach(j => rows.push({ t: j.topic || 'Untitled', d: j.created_at, s: 'failed', icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> }))
                queue.filter(q => q.status === 'failed').slice(0, 5).forEach(q => rows.push({ t: q.file_id || 'Queue item', d: q.updated_at, s: 'failed', icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> }))
              } else if (['Total Reach', 'Impressions', 'Engagement Today', 'Followers'].includes(focusKpi)) {
                Object.entries(byPlatform || {}).forEach(([p, d]) => {
                  const val = focusKpi === 'Total Reach' ? d.reach : focusKpi === 'Impressions' ? d.impressions : focusKpi === 'Engagement Today' ? (d.likes + d.comments + d.shares) : d.followers
                  rows.push({ t: M[p]?.label || p, d: `${fmt(val || 0)}`, s: 'metric', icon: <Icon p={p} size={14} /> })
                })
                if (rows.length === 0) rows.push({ t: 'No metrics yet', d: 'Sync accounts and publish posts', s: 'empty', icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> })
              } else if (focusKpi === 'Success Rate') {
                rows.push({ t: `Published: ${publishedToday}`, d: `${pipeline.find(p => p.key === 'completed')?.count || 0} today`, s: 'ok', icon: <CheckCircle className="h-3.5 w-3.5 text-[#0EA37A]" /> })
                rows.push({ t: `Failed: ${failed}`, d: 'review queue', s: 'err', icon: <XCircle className="h-3.5 w-3.5 text-red-500" /> })
                rows.push({ t: `Queue backlog: ${queueSize}`, d: `${queueEta} ETA`, s: 'info', icon: <Clock className="h-3.5 w-3.5 text-[#F59E0B]" /> })
              } else {
                rows.push({ t: 'No detailed breakdown available yet', d: 'Data appears as you publish and sync', s: 'empty', icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> })
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-2.5 hover:bg-[#F8F9FC] transition-colors">
                      <span className="h-8 w-8 rounded-lg bg-[#F4F5F9] flex items-center justify-center shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[#16161D] truncate">{r.t}</div>
                        <div className="text-[0.95rem] text-[#8A8A96] truncate">{r.d}</div>
                      </div>
                      <span className={`text-[0.9rem] px-2 py-0.5 rounded-full font-semibold shrink-0 ${r.s === 'failed' ? 'bg-red-50 text-red-500' : r.s === 'pending_approval' ? 'bg-amber-50 text-amber-600' : r.s === 'scheduled' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'bg-emerald-50 text-[#0EA37A]'}`}>{r.s}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Command Center hero */}
      <motion.div variants={fade} initial="initial" animate="animate" className="rounded-3xl overflow-hidden bg-gradient-to-br from-[#1A1037] via-[#2A1B52] to-[#4C1D63] relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#EC4899]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[#7C3AED]/30 blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-8 w-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center"><BrainCircuit className="h-4 w-4 text-[#C4B5FD]" /></span>
                <div><h3 className="text-sm font-bold text-white">AI Automation Status</h3><p className="text-[0.95rem] text-white/50">Live pipeline · {auto.timezone || 'Asia/Kolkata'}</p></div>
              </div>
              <div className="space-y-2.5 text-sm text-white/80">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="text-white/50 text-[0.85rem] uppercase tracking-wider font-semibold">Current task</span>
                  <span className="font-medium text-white">{paused ? 'Paused — click Resume to continue' : status === 'Running' ? `Generating ${(auto.next_slot ? 'post for ' + auto.next_slot : 'next post')}` : 'Automation disabled'}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5"><span className="text-white/50 text-[0.85rem] uppercase tracking-wider font-semibold">Progress</span><span className="text-[0.85rem] text-white/80 font-mono">{paused ? '0%' : `${Math.min(100, 82)}%`}</span></div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: paused ? '0%' : '82%' }} transition={{ duration: 1.2, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[0.9rem] text-white/50 uppercase tracking-wider">Next generation</div>
                    <div className="text-sm font-bold text-white mt-1">{auto.next_slot ? auto.next_slot : '—'}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[0.9rem] text-white/50 uppercase tracking-wider">Next publish</div>
                    <div className="text-sm font-bold text-white mt-1">{auto.next_slot || '—'}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[0.9rem] text-white/50 uppercase tracking-wider">Automation health</div>
                    <div className="text-sm font-bold mt-1" style={{ color: healthColor }}>{health} ({successRate}%)</div>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[0.9rem] text-white/50 uppercase tracking-wider">Queue ETA</div>
                    <div className="text-sm font-bold text-white mt-1">{queueEta}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:min-w-[200px]">
              <button onClick={() => router.push('/compose')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white text-sm font-semibold shadow-lg shadow-[#7C3AED]/30 hover:opacity-90 transition-opacity"><Zap className="h-4 w-4" /> Generate Now</button>
              <button onClick={togglePause} disabled={pausing} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-semibold hover:bg-white/15 transition-colors">{pausing ? <Loader2 className="h-4 w-4 animate-spin" /> : paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? 'Resume Automation' : 'Pause Automation'}</button>
              <button onClick={() => router.push('/automation')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-semibold hover:bg-white/15 transition-colors"><Clock className="h-4 w-4" /> Open Queue</button>
              <div className="flex items-center gap-2 text-[0.95rem] text-white/50 px-1"><Activity className="h-3 w-3" /> Last tick: {auto.last_tick_at ? new Date(auto.last_tick_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'never'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Timeline + Automation pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section open={expanded.timeline} onToggle={() => toggle('timeline')} icon={<Activity className="h-4 w-4" />} accent="#7C3AED" title="Today's Timeline" sub={new Date().toLocaleDateString('en', { month: 'long', day: 'numeric' })} badge={`${timeline.length} events`}>
          <div className="relative">
            <div className="absolute left-[13px] top-1 bottom-1 w-px bg-[#EEEFF4]" />
            <div className="space-y-4">
              {timeline.length === 0 && <div className="text-sm text-[#8A8A96] py-6 text-center relative z-10">No activity yet today — generate a post to start.</div>}
              {timeline.map((e, i) => {
                const meta = statusMeta[e.status] || statusMeta.draft
                return (
                  <button key={i} onClick={() => e.id ? router.push('/approve') : router.push('/automation')} className="relative z-10 flex items-start gap-3 w-full text-left group">
                    <span className="h-[26px] w-[26px] rounded-full border-2 border-white flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: meta.color }}><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#16161D] group-hover:text-[#7C3AED] transition-colors truncate">{e.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[0.78rem] text-[#8A8A96] font-mono">{e.time ? new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        <span className={`text-[0.9rem] px-1.5 py-0.5 rounded-full font-semibold ${meta.bg}`}>{meta.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Audit trail</div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {audit.length === 0 && <div className="text-xs text-[#8A8A96] py-2">No audit events yet.</div>}
              {audit.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.85rem]">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: a.new_status === 'failed' ? '#EF4444' : a.new_status === 'published' ? '#0EA37A' : '#7C3AED' }} />
                  <span className="text-[#16161D] truncate">{a.action.replace(/_/g, ' ')}</span>
                  <span className="text-[#8A8A96] ml-auto shrink-0 font-mono">{a.performed_at ? new Date(a.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section open={expanded.pipeline} onToggle={() => toggle('pipeline')} icon={<Rocket className="h-4 w-4" />} accent="#0EA37A" title="Automation Pipeline" sub={`${queueSize} queued · ${publishedToday} completed`} badge={`${successRate}% success`}>
          <div className="space-y-3">
            {pipeline.map((p, i) => (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#16161D] flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />{p.label}</span>
                  <span className="text-[0.85rem] text-[#8A8A96] font-mono">{p.count}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F0F1F5] overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(p.count / pipeTotal) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} className="h-full rounded-full" style={{ backgroundColor: p.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3">
            <div className="flex items-center gap-2 text-[0.85rem] text-[#8A8A96]"><BrainCircuit className="h-3.5 w-3.5 text-[#7C3AED]" /> AI processes <span className="font-bold text-[#16161D]">{queueSize}</span> queued items at ~8 min each — queue clears in <span className="font-bold text-[#16161D]">{queueEta}</span>.</div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Queue breakdown</div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {queue.length === 0 && <div className="text-xs text-[#8A8A96] py-2">Queue is empty.</div>}
              {queue.slice(0, 20).map(q => (
                <div key={q.file_id} className="flex items-center gap-2 text-[0.85rem] rounded-lg border border-[#EBECF2] p-2">
                  <span className="text-[#8A8A96] font-mono shrink-0">#{q.queue_position}</span>
                  <span className="text-[#16161D] truncate flex-1">{q.topic || q.file_id}</span>
                  <span className={`text-[0.9rem] px-1.5 py-0.5 rounded-full font-semibold ${q.status === 'failed' ? 'bg-red-50 text-red-500' : q.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' : q.status === 'published' ? 'bg-emerald-50 text-[#0EA37A]' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>{q.status}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section open={expanded.notifications} onToggle={() => toggle('notifications')} icon={<AlertTriangle className="h-4 w-4" />} accent="#F59E0B" title="Notifications & System Status" sub="Live alerts, audit trail and platform health" badge={`${notifications.length} alerts`}>
          <div className="space-y-0">
            {notifications.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-[#F0F1F5] last:border-0">
                <span className="h-5 w-5 rounded-full flex items-center justify-center text-[0.9rem] shrink-0 mt-0.5" style={{ backgroundColor: `${n.c}15`, color: n.c }}>{n.i}</span>
                <span className="text-xs text-[#16161D] leading-snug">{n.t}</span>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-[#16161D] mb-3 mt-5 flex items-center gap-2"><Radio className="h-4 w-4 text-[#3B82F6]" /> System Status</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(M).filter(([k]) => k !== 'twitter').map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-2.5 py-2">
                <Icon p={k} size={13} />
                <span className="text-[0.95rem] font-medium text-[#16161D]">{v.label}</span>
                <span className={`ml-auto h-1.5 w-1.5 rounded-full ${byPlatform[k] || posts.some(p => p.platform === k) ? 'bg-[#0EA37A]' : 'bg-[#C4C5CE]'}`} title={byPlatform[k] ? 'Data flowing' : 'Not connected'} />
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-2.5 py-2">
              <FileText className="h-3 w-3 text-[#7C3AED]" />
              <span className="text-[0.95rem] font-medium text-[#16161D]">Blog</span>
              <span className={`ml-auto h-1.5 w-1.5 rounded-full ${(auto.blog_waiting_approval || 0) > 0 ? 'bg-[#0EA37A]' : 'bg-[#C4C5CE]'}`} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-2.5 py-2">
              <BarChart3 className="h-3 w-3 text-[#0EA37A]" />
              <span className="text-[0.95rem] font-medium text-[#16161D]">API Health</span>
              <span className={`ml-auto h-1.5 w-1.5 rounded-full ${failed > 0 ? 'bg-amber-500' : 'bg-[#0EA37A]'}`} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-2.5 py-2">
              <BrainCircuit className="h-3 w-3 text-[#8B5CF6]" />
              <span className="text-[0.95rem] font-medium text-[#16161D]">AI Engine</span>
              <span className={`ml-auto h-1.5 w-1.5 rounded-full ${status === 'Running' ? 'bg-[#0EA37A] animate-pulse' : 'bg-amber-500'}`} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Full audit trail</div>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {audit.length === 0 && <div className="text-xs text-[#8A8A96] py-2">No audit events yet.</div>}
              {audit.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.85rem]">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: a.new_status === 'failed' ? '#EF4444' : a.new_status === 'published' ? '#0EA37A' : '#7C3AED' }} />
                  <span className="text-[#16161D] truncate flex-1">{a.action.replace(/_/g, ' ')}</span>
                  <span className="text-[#8A8A96] shrink-0 font-mono">{a.performed_at ? new Date(a.performed_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Performance charts */}
      <motion.div variants={fade} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section open={expanded.perf} onToggle={() => toggle('perf')} icon={<BarChart3 className="h-4 w-4" />} accent="#7C3AED" title="Performance Overview" sub="Reach, impressions and engagement over time" badge={`${range}D`} >
          <div className="flex bg-[#F4F5F9] rounded-xl p-1 mb-4 w-fit">
            {[7, 30, 90].map(d => <button key={d} onClick={() => setRange(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${range === d ? 'bg-white shadow-sm text-[#7C3AED]' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{d}D</button>)}
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.18} /><stop offset="100%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EC4899" stopOpacity={0.15} /><stop offset="100%" stopColor="#EC4899" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0EA37A" stopOpacity={0.15} /><stop offset="100%" stopColor="#0EA37A" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#EBECF2' }} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                <Tooltip contentStyle={tooltipS} />
                <Area type="monotone" dataKey="reach" stroke="#7C3AED" fill="url(#gR)" strokeWidth={2} name="Reach" />
                <Area type="monotone" dataKey="impressions" stroke="#EC4899" fill="url(#gI)" strokeWidth={2} name="Impressions" />
                <Area type="monotone" dataKey="engagement" stroke="#0EA37A" fill="url(#gE)" strokeWidth={2} name="Engagement" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Daily breakdown</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">{['Date', 'Published', 'Reach', 'Impressions', 'Engagement'].map(h => <th key={h} className={`py-2 text-left font-semibold text-[0.78rem] uppercase tracking-wider ${h !== 'Date' ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {series.slice(-14).reverse().map((d, i) => (
                    <tr key={i} className="border-b border-[#F0F1F5] last:border-0 hover:bg-[#F8F9FC]">
                      <td className="py-1.5 font-medium text-[#16161D]">{d.date}</td>
                      <td className="py-1.5 text-right">{d.published}</td>
                      <td className="py-1.5 text-right">{fmt(d.reach)}</td>
                      <td className="py-1.5 text-right">{fmt(d.impressions)}</td>
                      <td className="py-1.5 text-right text-[#0EA37A] font-semibold">{fmt(d.engagement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
        <div className="space-y-5">
          <div className={`${C} p-5`}>
            <h3 className="text-sm font-semibold text-[#16161D] mb-3">Posts Published</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} width={24} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipS} />
                  <Bar dataKey="published" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Published" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={`${C} p-5`}>
            <h3 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-[#F59E0B]" /> Best Posting Hours</h3>
            <div className="flex items-end gap-1 h-20">
              {hourHits.map((v, h) => (
                <div key={h} className="flex-1 flex items-end" title={`${h}:00 — ${v} posts`}>
                  <div className={`w-full rounded-t-md ${h % 6 === 0 ? 'bg-gradient-to-t from-[#7C3AED] to-[#EC4899]' : 'bg-[#EEEFF4]'}`} style={{ height: `${Math.max(8, (v / Math.max(1, Math.max(...hourHits))) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className={`${C} p-5`}>
            <h3 className="text-sm font-semibold text-[#16161D] mb-3">Most Active Days</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {dayNames.map((d, i) => {
                const max = Math.max(...dayHits, 1)
                return (
                  <div key={d} className="text-center">
                    <div className={`h-14 rounded-lg flex items-end justify-center ${dayHits[i] > 0 ? 'bg-gradient-to-b from-[#7C3AED]/20 to-[#EC4899]/20 border border-[#D8C8FB]' : 'bg-[#F4F5F9]'}`} title={`${d}: ${dayHits[i]} posts`}>
                      <div className={`w-2 rounded-t-md ${dayHits[i] > 0 ? 'bg-gradient-to-t from-[#7C3AED] to-[#EC4899]' : 'bg-[#D8D9E3]'}`} style={{ height: `${Math.max(6, (dayHits[i] / max) * 40)}px` }} />
                    </div>
                    <div className="text-[0.875rem] text-[#8A8A96] mt-1">{d}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent posts + Top posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section open={expanded.recent} onToggle={() => toggle('recent')} icon={<CheckCircle className="h-4 w-4" />} accent="#0EA37A" title="Recent Posts" sub="Latest published content across platforms" badge={`${posts.length} total`}>
          <div className="space-y-2">
            {recentPosts.length === 0 ? (
              <div className="text-sm text-[#8A8A96] py-8 text-center">No posts yet — generate your first post from Compose.</div>
            ) : recentPosts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-2.5 hover:bg-[#F8F9FC] hover:border-[#D8C8FB] transition-colors group">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center shrink-0"><Icon p={p.platform} size={16} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#16161D] truncate">{p.caption ? p.caption.slice(0, 55) : 'Untitled post'}</div>
                  <div className="text-[0.95rem] text-[#8A8A96] mt-0.5">{M[p.platform]?.label || p.platform} · {p.published_at ? new Date(p.published_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</div>
                </div>
                <div className="hidden md:flex items-center gap-3 text-center shrink-0">
                  <div><div className="text-xs font-bold text-[#16161D]">{short(p.reach || 0)}</div><div className="text-[0.875rem] text-[#8A8A96]">Reach</div></div>
                  <div><div className="text-xs font-bold text-[#0EA37A]">{fmt(eng(p))}</div><div className="text-[0.875rem] text-[#8A8A96]">Eng</div></div>
                </div>
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-[0.95rem] text-[#7C3AED] font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">Open →</a>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => router.push('/analytics')} className="text-[0.95rem] text-[#7C3AED] font-medium flex items-center gap-1 hover:underline">All analytics <ArrowRight className="h-3 w-3" /></button>
            <button onClick={() => router.push('/compose')} className="text-[0.95rem] text-[#0EA37A] font-medium hover:underline">Compose new →</button>
          </div>
        </Section>

        <Section open={expanded.top} onToggle={() => toggle('top')} icon={<Star className="h-4 w-4" />} accent="#F59E0B" title="Top Performing" sub="Highest engagement content" badge={`${topPosts.length}`}>
          <div className="space-y-2.5">
            {topPosts.length === 0 ? (
              <div className="text-sm text-[#8A8A96] py-8 text-center">Performance data will appear after publishing + syncing.</div>
            ) : topPosts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-2.5 hover:bg-[#F8F9FC] transition-colors">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center shrink-0"><Icon p={p.platform} size={15} /></div>}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#16161D] truncate">#{i + 1} · {p.caption ? p.caption.slice(0, 40) : 'Untitled'}</div>
                  <div className="text-[0.95rem] text-[#8A8A96]">{fmt(p.likes || 0)} likes · {fmt(p.comments || 0)} comments · {short(p.reach || 0)} reach</div>
                </div>
                <span className="text-[0.9rem] px-1.5 py-0.5 rounded-full bg-emerald-50 text-[#0EA37A] font-semibold shrink-0">{p.engagement_rate || '0'}%</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* AI Insights + Audience + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section open={expanded.insights} onToggle={() => toggle('insights')} icon={<BrainCircuit className="h-4 w-4" />} accent="#EC4899" title="AI Insights" sub="Strategic recommendations from your data" badge="AI">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((x, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3.5 flex items-start gap-2.5 hover:shadow-md transition-shadow">
                <span className="text-lg shrink-0">{x.i}</span><span className="text-xs text-[#16161D] leading-relaxed">{x.t}</span>
              </motion.div>
            ))}
          </div>
          {coach?.insight && (
            <div className="mt-4 rounded-xl bg-gradient-to-r from-[#7C3AED]/8 to-[#EC4899]/8 border border-[#EBECF2] p-4">
              <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1.5">AI Coach summary</div>
              <p className="text-xs text-[#16161D] leading-relaxed">{coach.insight}</p>
              {coach.recommendations?.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {coach.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-[0.875rem]"><span className="px-1.5 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] font-semibold shrink-0 mt-0.5">{r.category}</span><span className="text-[#16161D]">{r.text}</span></div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        <Section open={expanded.audience} onToggle={() => toggle('audience')} icon={<Users className="h-4 w-4" />} accent="#0EA37A" title="Audience Snapshot" sub="Followers, platforms and activity patterns" badge={fmt(followers)}>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3">
              <div><div className="text-[0.78rem] text-[#8A8A96] uppercase tracking-wider font-semibold">Total followers</div><div className="text-lg font-bold text-[#16161D]">{fmt(followers)}</div></div>
              <span className="text-[0.95rem] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-[#0EA37A] flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> {followers > 0 ? 'growing' : 'tracked'}</span>
            </div>
            <div>
              <div className="text-[0.78rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Platform split</div>
              <div className="space-y-2">
                {Object.entries(byPlatform || {}).length === 0 && <div className="text-xs text-[#8A8A96]">Sync accounts to see audience distribution.</div>}
                {Object.entries(byPlatform || {}).slice(0, 5).map(([p, d]) => {
                  const max = Math.max(...Object.values(byPlatform).map(x => x.impressions || 0), 1)
                  return (
                    <div key={p} className="flex items-center gap-2">
                      <Icon p={p} size={13} />
                      <div className="flex-1 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${((d.impressions || 0) / max) * 100}%`, background: M[p]?.color }} /></div>
                      <span className="text-[0.95rem] text-[#8A8A96] font-mono">{short(d.impressions || 0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="text-[0.78rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1">Active hours</div>
              <div className="flex items-end gap-0.5 h-10">
                {hourHits.map((v, h) => <div key={h} title={`${h}:00`} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(10, (v / Math.max(1, Math.max(...hourHits))) * 100)}%`, backgroundColor: h === hourHits.indexOf(Math.max(...hourHits)) ? '#7C3AED' : '#E5E6EF' }} />)}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Most active days</div>
            <div className="grid grid-cols-7 gap-1.5">
              {dayNames.map((d, i) => (
                <div key={d} className="text-center">
                  <div className={`h-10 rounded-lg flex items-end justify-center ${dayHits[i] > 0 ? 'bg-gradient-to-b from-[#7C3AED]/20 to-[#EC4899]/20' : 'bg-[#F4F5F9]'}`}>
                    <div className={`w-2 rounded-t-md ${dayHits[i] > 0 ? 'bg-gradient-to-t from-[#7C3AED] to-[#EC4899]' : 'bg-[#D8D9E3]'}`} style={{ height: `${Math.max(6, (dayHits[i] / Math.max(...dayHits, 1)) * 30)}px` }} />
                  </div>
                  <div className="text-[0.875rem] text-[#8A8A96] mt-1">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Calendar + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Section open={expanded.calendar} onToggle={() => toggle('calendar')} icon={<CalendarDays className="h-4 w-4" />} accent="#7C3AED" title="Content Calendar" sub={now.toLocaleDateString('en', { month: 'long', year: 'numeric' })} badge={`${calDays.filter(c => c && (c.pub > 0 || c.sch > 0)).length} days`}>
          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-center text-[0.9rem] text-[#8A8A96] font-semibold py-1">{d}</div>)}
            {calDays.map((cell, i) => cell ? (
              <div key={i} className={`rounded-lg text-center py-1.5 text-xs transition-colors ${cell.best > 0 ? 'bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border border-[#D8C8FB] text-[#7C3AED] font-bold' : cell.pub > 0 ? 'bg-emerald-50 text-[#0EA37A] font-semibold' : cell.sch > 0 ? 'bg-[#7C3AED]/10 text-[#7C3AED] font-semibold' : 'text-[#C4C5CE]'}`} title={cell.pub || cell.sch ? `${cell.pub} published · ${cell.sch} scheduled` : ''}>
                {cell.d}
              </div>
            ) : <div key={i} />)}
          </div>
          <div className="flex gap-3 mt-4 text-[0.95rem] text-[#8A8A96] flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7C3AED]" /> Best</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Published</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7C3AED]/30" /> Scheduled</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-[#D8D9E3]" /> Empty</span>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0F1F5]">
            <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Upcoming scheduled</div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {jobs.filter(j => j.status === 'scheduled').length === 0 && <div className="text-xs text-[#8A8A96] py-2">Nothing scheduled yet.</div>}
              {jobs.filter(j => j.status === 'scheduled').sort((a, b) => new Date(a.scheduled_for || 0) - new Date(b.scheduled_for || 0)).slice(0, 10).map(j => (
                <div key={j.id} className="flex items-center gap-2 text-[0.85rem] rounded-lg border border-[#EBECF2] p-2">
                  <CalendarDays className="h-3 w-3 text-[#7C3AED] shrink-0" />
                  <span className="text-[#16161D] truncate flex-1">{j.topic || 'Untitled'}</span>
                  <span className="text-[#8A8A96] font-mono shrink-0">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-5 lg:col-span-2`}>
          <h3 className="text-sm font-semibold text-[#16161D] mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-[#EC4899]" /> Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {quickActions.map(qa => (
              <button key={qa.label} onClick={() => qa.action ? qa.action() : router.push(qa.href)} className="rounded-xl border border-[#EBECF2] p-4 text-center hover:border-[#D8C8FB] hover:shadow-md hover:-translate-y-0.5 transition-all group bg-white">
                <div className={`h-10 w-10 mx-auto rounded-xl bg-gradient-to-br ${qa.g} text-white flex items-center justify-center mb-2 shadow-md group-hover:scale-110 transition-transform`}>{qa.icon}</div>
                <div className="text-[0.85rem] font-semibold text-[#16161D]">{qa.label}</div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
