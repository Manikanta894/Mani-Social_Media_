'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sliders, Layers, Loader2, Wand2, Zap, KeyRound, Copy, Upload, ImageIcon,
  RefreshCw, Check, X, Save, LayoutDashboard, Clock, Activity, Trash2,
  SkipForward, Play, Pause, ChevronDown, ChevronUp, Sparkles, ShieldAlert,
  Network, CalendarDays, TrendingUp, CircleDot, GripVertical, Eye, Pencil, Rocket,
  FileCheck2, Archive, BrainCircuit, CheckCircle2, XCircle,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, resizeImageToBase64, StatusPill } from '@/components/shared'

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
}
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-[#EEEFF4] ${className}`} />
}

function MetricCard({ label, value, icon, gradient, sub }) {
  return (
    <motion.div variants={fadeUp} className="group rounded-2xl border border-[#EBECF2] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_24px_rgba(124,58,237,0.08)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{label}</div>
          <div className="text-2xl font-bold text-[#16161D] mt-1.5">{value}</div>
          {sub && <div className="text-[0.625rem] text-[#8A8A96] mt-1">{sub}</div>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 ${gradient}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}

const PLATFORM_ICONS = {
  linkedin: '💼', instagram: '📷', facebook: '👥', threads: '🧵', twitter: '🐦',
}

export default function AutomationPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#16161D] tracking-tight">AI Content Operations Center</h1>
              <p className="text-sm text-[#8A8A96]">Automated social media content engine</p>
            </div>
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-white border border-[#EBECF2] rounded-2xl p-1 shadow-sm">
            <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7C3AED] data-[state=active]:to-[#EC4899] data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><LayoutDashboard className="h-3.5 w-3.5 mr-1.5" /> Control Center</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7C3AED] data-[state=active]:to-[#EC4899] data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><Layers className="h-3.5 w-3.5 mr-1.5" /> Queue</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7C3AED] data-[state=active]:to-[#EC4899] data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><Sliders className="h-3.5 w-3.5 mr-1.5" /> Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'queue' && <QueueManager />}
          {tab === 'settings' && <AutomationSettings />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const COMMON_TZ = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Australia/Sydney','UTC']

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [settings, setSettings] = useState(null)
  const [liveStats, setLiveStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [st, act, s, ls] = await Promise.all([
        api('/intake/stats').catch(() => ({})),
        api('/automation/activity?limit=30').catch(() => []),
        api('/automation/settings').catch(() => ({})),
        api('/automation-stats').catch(() => ({})),
      ])
      setStats(st); setActivity(act); setSettings(s); setLiveStats(ls)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const runTickNow = async () => {
    setRunning(true)
    try {
      const s = await api('/automation/settings')
      const r = await fetch('/api/automation/tick', { method: 'POST', headers: { 'X-Automation-Secret': s.tick_secret, 'Content-Type': 'application/json' } })
      const j = await r.json()
      if (j.ok) toast.success('Tick: ' + JSON.stringify(j.data).slice(0, 120))
      else toast.error(j.error || 'Tick failed')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setRunning(false) }
  }

  if (loading) {
    return (
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </motion.div>
    )
  }

  const statusColor = liveStats.status === 'Running' ? '#0EA37A' : liveStats.status === 'Paused' ? '#D97706' : '#8A8A96'

  const todaySchedule = (settings?.posting_times || []).map((t, i) => {
    const now = new Date()
    const [h, m] = t.split(':').map(Number)
    const slotTime = new Date(now); slotTime.setHours(h, m, 0, 0)
    return { index: i, time: t, isPast: slotTime < now }
  })

  const actionMeta = {
    ai_generated: { label: 'AI Generated', color: 'bg-[#7C3AED]', text: 'text-[#7C3AED]' },
    approved: { label: 'Approved', color: 'bg-[#D97706]', text: 'text-[#D97706]' },
    published: { label: 'Published', color: 'bg-[#0EA37A]', text: 'text-[#0EA37A]' },
    failed: { label: 'Failed', color: 'bg-[#EF4444]', text: 'text-[#EF4444]' },
    skipped: { label: 'Skipped', color: 'bg-[#F59E0B]', text: 'text-[#F59E0B]' },
    archived: { label: 'Archived', color: 'bg-[#8A8A96]', text: 'text-[#8A8A96]' },
  }

  const pipelineStages = [
    { key: 'fetch', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
    { key: 'queue', label: 'Queue', icon: <Layers className="h-4 w-4" /> },
    { key: 'generate', label: 'AI Generation', icon: <BrainCircuit className="h-4 w-4" /> },
    { key: 'validate', label: 'Validation', icon: <FileCheck2 className="h-4 w-4" /> },
    { key: 'approve', label: 'Approval', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'schedule', label: 'Scheduling', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'publish', label: 'Publishing', icon: <Rocket className="h-4 w-4" /> },
    { key: 'archive', label: 'Archive', icon: <Archive className="h-4 w-4" /> },
  ]
  const stageValues = {
    fetch: stats?.total || 0, queue: stats?.queued || 0, generate: stats?.processing || 0,
    validate: stats?.approved || 0, approve: stats?.pending_approval || 0,
    schedule: stats?.scheduled || 0, publish: stats?.published || 0, archive: stats?.archived || 0,
  }
  const maxStage = Math.max(...Object.values(stageValues), 1)

  const kpis = [
    { label: 'Queue size', value: liveStats.queue_size ?? '—', icon: <Layers className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#7C3AED] to-[#A855F7]' },
    { label: 'Generated today', value: liveStats.posts_generated_today ?? '—', icon: <BrainCircuit className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#EC4899] to-[#F97316]' },
    { label: 'Published today', value: liveStats.posts_published_today ?? '—', icon: <Rocket className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#0EA37A] to-[#34D399]' },
    { label: 'Waiting approval', value: liveStats.waiting_approval ?? '—', icon: <Clock className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#D97706] to-[#F59E0B]' },
    { label: 'Failed', value: liveStats.failed ?? '—', icon: <XCircle className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#EF4444] to-[#F87171]' },
    { label: 'Success rate', value: `${liveStats.success_rate ?? '—'}%`, icon: <TrendingUp className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#0EA37A] to-[#14B8A6]' },
    { label: 'Blogs published', value: liveStats.blogs_published_today ?? '—', icon: <Network className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]' },
    { label: 'Blogs awaiting', value: liveStats.blog_waiting_approval ?? '—', icon: <Sparkles className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#8B5CF6] to-[#C084FC]' },
  ]

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Hero status */}
      <motion.div variants={fadeUp} className="rounded-2xl bg-gradient-to-r from-[#7C3AED]/8 via-white to-[#EC4899]/8 border border-[#EBECF2] p-6 shadow-sm flex flex-wrap items-center gap-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 blur-2xl" />
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`h-14 w-14 rounded-2xl bg-white border border-[#EBECF2] flex items-center justify-center shadow-md`}>
              {liveStats.status === 'Running' ? <CircleDot className="h-7 w-7 text-[#0EA37A]" /> : <ShieldAlert className="h-7 w-7 text-[#8A8A96]" />}
            </div>
            {liveStats.status === 'Running' && (
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#0EA37A] border-2 border-white">
                <span className="absolute inset-0 rounded-full bg-[#0EA37A] animate-ping opacity-60" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#16161D]">Engine {liveStats.status || '—'}</h2>
              <span className="text-[0.6rem] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColor + '1A', color: statusColor }}>
                {liveStats.status || 'OFFLINE'}
              </span>
            </div>
            <div className="text-xs text-[#8A8A96] mt-0.5">
              Next slot: <b className="text-[#16161D]">{liveStats.next_slot || '—'}</b>
              {' · '}Last tick: {liveStats.last_tick_at ? new Date(liveStats.last_tick_at).toLocaleTimeString() : 'never'}
              {' · '}<span className="text-[#8A8A96]">{liveStats.timezone || ''}</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={refresh} variant="outline" size="sm" className="rounded-xl border-[#EBECF2] hover:bg-[#F8F9FC]"><RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          <Button onClick={runTickNow} disabled={running} size="sm" className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-lg shadow-[#7C3AED]/25 hover:opacity-90 transition-opacity">
            {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
            Run tick now
          </Button>
        </div>
      </motion.div>

      {/* AI activity panel */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-[#16161D]">AI Activity</h3>
          </div>
          <span className="text-[0.6rem] font-medium px-2 py-1 rounded-full bg-[#7C3AED]/8 text-[#7C3AED]">Live</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Current Task</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">
              {stats?.processing > 0 ? 'Generating content…' : stats?.queued > 0 ? 'Awaiting next slot' : liveStats.status === 'Running' ? 'Idle — waiting for slot' : 'Engine stopped'}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Queue Progress</div>
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-[#EEEFF4] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] transition-all duration-500" style={{ width: `${stats?.total ? Math.min(100, ((stats.total - stats.queued) / stats.total) * 100) : 0}%` }} />
              </div>
              <div className="text-[0.6rem] text-[#8A8A96] mt-1">{stats?.total ? `${stats.total - stats.queued}/${stats.total} processed` : '0/0'}</div>
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Next Action</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">{stats?.queued > 0 ? 'Generate at next slot' : 'Awaiting uploads'}</div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Active Platform</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">{(settings?.enabled_platforms || []).slice(0, 2).map(p => PLATFORM_ICONS[p]).join(' ')} {settings?.enabled_platforms?.length || 0} platforms</div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Est. Queue Time</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">{stats?.queued ? `~${Math.ceil(stats.queued / (settings?.posts_per_day || 1))} day(s)` : '—'}</div>
          </div>
        </div>
      </motion.div>

      {/* KPI grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => <MetricCard key={k.label} {...k} />)}
      </motion.div>

      {/* Pipeline */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#16161D]">Content Pipeline</h3>
          <span className="text-[0.6rem] text-[#8A8A96]">{stats?.total || 0} total items</span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {pipelineStages.map((stage, i) => {
            const val = stageValues[stage.key] || 0
            const active = stage.key === 'generate' && stats?.processing > 0
            const done = stage.key === 'publish' && stats?.published > 0
            return (
              <div key={stage.key} className="relative">
                <motion.div
                  whileHover={{ y: -2 }}
                  className={`rounded-xl border p-2.5 text-center transition-all ${active ? 'border-[#7C3AED]/40 bg-[#7C3AED]/5 shadow-[0_4px_12px_rgba(124,58,237,0.12)]' : done ? 'border-[#0EA37A]/30 bg-[#0EA37A]/5' : 'border-[#EBECF2] bg-[#FAFAFC]'}`}
                >
                  <div className={`mx-auto w-fit ${active ? 'text-[#7C3AED]' : done ? 'text-[#0EA37A]' : 'text-[#8A8A96]'}`}>{stage.icon}</div>
                  <div className="text-[0.5rem] font-semibold uppercase tracking-wide mt-1.5 text-[#16161D]">{stage.label}</div>
                  <div className="text-[0.6rem] font-bold mt-0.5 text-[#8A8A96]">{val}</div>
                  <div className="mt-1.5 h-0.5 rounded-full bg-[#EEEFF4] overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${active ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899]' : done ? 'bg-[#0EA37A]' : 'bg-[#E2E4EA]'}`} style={{ width: `${(val / maxStage) * 100}%` }} />
                  </div>
                </motion.div>
                {i < pipelineStages.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-1.5 text-[#C9CBD4] text-[0.5rem] -translate-y-1/2 z-10">›</div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#7C3AED]" /> Today's Schedule</h3>
            <span className="text-[0.6rem] px-2 py-1 rounded-full bg-[#7C3AED]/8 text-[#7C3AED]">{todaySchedule.filter(s => !s.isPast).length} upcoming</span>
          </div>
          <div className="space-y-2">
            {todaySchedule.length === 0 && <div className="text-sm text-[#8A8A96] py-4 text-center">No posting times configured.</div>}
            {todaySchedule.map(slot => (
              <div key={slot.index} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm ${slot.isPast ? 'bg-[#F8F9FC] text-[#A0A1AC]' : 'bg-[#F5F3FF] text-[#16161D]'}`}>
                <div className={`h-2 w-2 rounded-full ${slot.isPast ? 'bg-[#D4D5DD]' : 'bg-[#7C3AED]'}`} />
                <span className="font-medium">{slot.time}</span>
                <span className="text-[0.55rem] ml-auto px-1.5 py-0.5 rounded-full font-medium ${slot.isPast ? 'bg-[#EEEFF4] text-[#8A8A96]' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}">{slot.isPast ? 'Completed' : 'Upcoming'}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><Activity className="h-4 w-4 text-[#7C3AED]" /> Activity Timeline</h3>
            <span className="text-[0.6rem] text-[#8A8A96]">{activity.length} events</span>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {activity.length === 0 && (
              <div className="text-sm text-[#8A8A96] py-8 text-center">No activity yet. Upload photos to begin.</div>
            )}
            {activity.slice(0, 25).map((a, i) => {
              const meta = actionMeta[a.action] || { label: a.action, color: 'bg-[#8A8A96]', text: 'text-[#8A8A96]' }
              return (
                <div key={a.id || i} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-[#F8F9FC] transition-colors">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#16161D]">{meta.label}</span>
                    {a.file_id && <span className="text-[0.6rem] text-[#8A8A96] ml-1.5 truncate">{a.file_id.split('/').pop()}</span>}
                    {a.details?.slot && <span className="text-[0.6rem] text-[#8A8A96] ml-1">slot #{a.details.slot}</span>}
                  </div>
                  <span className="text-[0.6rem] text-[#8A8A96] shrink-0">{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function QueueManager() {
  const [queueType, setQueueType] = useState('social')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [socialQueue, setSocialQueue] = useState([])
  const [socialStats, setSocialStats] = useState(null)
  const [blogStats, setBlogStats] = useState(null)
  const [blogQueue, setBlogQueue] = useState([])
  const [manualJobs, setManualJobs] = useState([])
  const [newsItems, setNewsItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [statusFilter, setStatusFilter] = useState('')
  const [dragIndex, setDragIndex] = useState(null)
  const fileRef = useRef(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [sq, ss, bq, bs, mj, ni] = await Promise.all([
        api('/intake/queue').catch(() => []),
        api('/intake/stats').catch(() => ({})),
        api('/blog/queue').catch(() => []),
        api('/blog/stats').catch(() => ({})),
        api('/jobs').catch(() => []),
        api('/news/posts').catch(() => []),
      ])
      setSocialQueue(sq); setSocialStats(ss); setBlogQueue(bq); setBlogStats(bs)
      setManualJobs(mj.filter(j => j.source === 'ai_manual' || j.source === 'compose'))
      setNewsItems(ni.filter(n => n.status === 'pending_approval'))
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      if (queueType === 'social') { const r = await api('/intake/sync', { method: 'POST' }); toast.success(`Indexed ${r.indexed} new`) }
      if (queueType === 'blog') { const r = await api('/blog/sync', { method: 'POST' }); toast.success(`Indexed ${r.indexed} new`) }
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setSyncing(false) }
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let done = 0, failed = 0
    const endpoint = queueType === 'blog' ? '/blog/upload' : '/intake/upload'
    for (const file of files) {
      if (!file.type.startsWith('image/')) { failed++; continue }
      try {
        const resized = await resizeImageToBase64(file, 2000, 0.9)
        await api(endpoint, { method: 'POST', body: { base64: resized.base64, mime_type: resized.mimeType, file_name: file.name } })
        done++
      } catch (e) { failed++ }
    }
    toast.success(`Uploaded ${done}${failed ? ` · ${failed} failed` : ''}`)
    setUploading(false)
    await sync()
  }

  const doBulk = async (action) => {
    if (selected.size === 0) return
    const endpoint = queueType === 'blog' ? '/blog/bulk' : '/automation/bulk'
    try {
      const r = await api(endpoint, { method: 'POST', body: { fileIds: [...selected], action } })
      toast.success(`${action}: ${r.filter(x => x.ok).length}/${selected.size}`)
      setSelected(new Set()); await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const currentQueue = queueType === 'blog' ? blogQueue : socialQueue
  const currentStats = queueType === 'blog' ? blogStats : socialStats

  const queues = [
    { key: 'social', label: 'Social Auto', icon: '📸' },
    { key: 'blog', label: 'Blog Engine', icon: '📝' },
    { key: 'manual', label: 'Manual Posts', icon: '✍️' },
    { key: 'news', label: 'News Radar', icon: '📡' },
  ]

  const handleDrop = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const arr = [...currentQueue]
    const [moved] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, moved)
    const fileIds = arr.map(x => x.file_id || x.id)
    api(queueType === 'blog' ? '/blog/reorder' : '/automation/reorder', { method: 'POST', body: { fileIds } }).catch(() => {})
    setDragIndex(null)
    if (queueType === 'social') setSocialQueue(arr)
    if (queueType === 'blog') setBlogQueue(arr)
  }

  const statusPills = [
    ['queued', 'Queued'], ['processing', 'Processing'], ['pending_approval', 'Pending'], ['published', 'Published'],
    ['failed', 'Failed'], ['archived', 'Archived'], ['skipped', 'Skipped'],
  ]

  return (
    <div className="space-y-5">
      {/* Queue type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {queues.map(q => (
          <button key={q.key} onClick={() => { setQueueType(q.key); setSelected(new Set()) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${queueType === q.key ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-lg shadow-[#7C3AED]/20' : 'bg-white border border-[#EBECF2] text-[#8A8A96] hover:text-[#16161D]'}`}>
            <span>{q.icon}</span> {q.label}
          </button>
        ))}
      </div>

      {/* Upload dropzone */}
      <motion.div
        variants={fadeUp} initial="initial" animate="animate"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="rounded-2xl border-2 border-dashed border-[#D8D9E3] hover:border-[#7C3AED]/50 bg-gradient-to-b from-white to-[#FAFAFC] p-8 text-center cursor-pointer transition-all group"
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-[#7C3AED]">
            <Loader2 className="h-5 w-5 animate-spin" /> Uploading…
          </div>
        ) : (
          <>
            <motion.div whileHover={{ scale: 1.05 }} className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border border-[#7C3AED]/15 flex items-center justify-center mb-3">
              <Upload className="h-6 w-6 text-[#7C3AED]" />
            </motion.div>
            <div className="text-sm font-semibold text-[#16161D]">Drop {queueType === 'blog' ? 'blog images' : 'social photos'} here</div>
            <div className="text-xs text-[#8A8A96] mt-1">JPG · PNG · WEBP — or click to browse</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </motion.div>

      {/* Stats row */}
      {currentStats && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {statusPills.map(([k, label]) => (
            <button key={k} onClick={() => setStatusFilter(k === statusFilter ? '' : k)}
              className={`rounded-xl border p-2.5 text-center transition-all ${statusFilter === k ? 'border-[#7C3AED]/40 bg-[#7C3AED]/5' : 'border-[#EBECF2] bg-white hover:shadow-sm'}`}>
              <div className="text-lg font-bold text-[#16161D]">{currentStats[k] || 0}</div>
              <div className="text-[0.55rem] uppercase tracking-wider text-[#8A8A96]">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 rounded-2xl bg-[#F5F3FF] border border-[#7C3AED]/20 overflow-hidden">
            <span className="text-sm font-semibold text-[#7C3AED] mr-2">{selected.size} selected</span>
            {[['archive', 'Archive', <Archive key="a" className="h-3.5 w-3.5" />], ['skip', 'Skip', <SkipForward key="s" className="h-3.5 w-3.5" />], ['retry', 'Retry', <RefreshCw key="r" className="h-3.5 w-3.5" />], ['reset', 'Reset', <X key="x" className="h-3.5 w-3.5" />]].map(([action, label, icon]) => (
              <Button key={action} size="sm" variant="outline" className="rounded-lg border-[#7C3AED]/25 bg-white" onClick={() => doBulk(action)}>{icon}<span className="ml-1">{label}</span></Button>
            ))}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : queueType === 'social' || queueType === 'blog' ? (
        currentQueue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8D9E3] bg-white p-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-3">
              <ImageIcon className="h-6 w-6 text-[#7C3AED]" />
            </div>
            <div className="text-sm font-semibold text-[#16161D]">No items in queue</div>
            <div className="text-xs text-[#8A8A96] mt-1">Drop {queueType === 'blog' ? 'blog images' : 'photos'} above to get started</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(statusFilter ? currentQueue.filter(x => x.status === statusFilter) : currentQueue).map((row, i) => (
              <QueueCard key={row.file_id || row.id} row={row} index={i}
                selected={selected.has(row.file_id || row.id)}
                onToggle={() => { const n = new Set(selected); const id = row.file_id || row.id; if (n.has(id)) n.delete(id); else n.add(id); setSelected(n) }}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(dragIndex, i)}
                isDragTarget={dragIndex === i}
              />
            ))}
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-[#EBECF2] bg-white shadow-sm overflow-hidden">
          <div className="divide-y divide-[#F0F1F5]">
            {(queueType === 'manual' ? manualJobs : newsItems).slice(0, 50).map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8F9FC] transition-colors">
                <span className="text-[0.6rem] text-[#8A8A96] w-6">#{i + 1}</span>
                <StatusPill status={item.status || 'pending'} />
                <span className="flex-1 truncate text-sm text-[#16161D]">{item.topic || item.title || 'Untitled'}</span>
                <span className="text-[0.6rem] text-[#8A8A96]">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
              </div>
            ))}
            {(queueType === 'manual' ? manualJobs : newsItems).length === 0 && (
              <div className="text-sm text-[#8A8A96] py-8 text-center">Nothing here yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function QueueCard({ row, index, selected, onToggle, draggable, onDragStart, onDragOver, onDrop, isDragTarget }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  useEffect(() => {
    if (row.status === 'archived') return
    const path = row.file_id?.startsWith('blogs/') ? '/blog/signed-url' : '/intake/signed-url'
    api(`${path}?path=${encodeURIComponent(row.file_id)}`).then(r => setThumbUrl(r.url)).catch(() => {})
  }, [row.file_id])

  const statusStyle = {
    queued: 'bg-[#7C3AED]/8 text-[#7C3AED]', processing: 'bg-[#D97706]/10 text-[#D97706]',
    pending_approval: 'bg-[#EC4899]/10 text-[#EC4899]', approved: 'bg-[#0EA37A]/10 text-[#0EA37A]',
    published: 'bg-[#0EA37A]/10 text-[#0EA37A]', failed: 'bg-[#EF4444]/10 text-[#EF4444]',
    archived: 'bg-[#8A8A96]/10 text-[#8A8A96]', skipped: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  }[row.status] || 'bg-[#EEEFF4] text-[#8A8A96]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${selected ? 'border-[#7C3AED]/40 ring-1 ring-[#7C3AED]/20' : 'border-[#EBECF2]'} ${isDragTarget ? 'opacity-50' : ''} hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]`}
    >
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 rounded border-[#D8D9E3] accent-[#7C3AED]" />
        <GripVertical className="h-4 w-4 text-[#C9CBD4] mt-1 cursor-grab shrink-0" />
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0 border border-[#EBECF2]" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-[#F5F3FF] flex items-center justify-center shrink-0">
            <ImageIcon className="h-5 w-5 text-[#7C3AED]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#16161D] truncate">{row.file_name}</span>
            <span className={`text-[0.55rem] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>{row.status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[0.6rem] text-[#8A8A96]">#{row.queue_position}</span>
            {row.scheduled_time && <span className="text-[0.6rem] text-[#8A8A96]">· {row.scheduled_time}</span>}
            {row.ai_confidence && <span className="text-[0.6rem] text-[#0EA37A]">· {(row.ai_confidence * 100).toFixed(0)}% conf</span>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function AutomationSettings() {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [ticking, setTicking] = useState(false)
  const [openSection, setOpenSection] = useState('schedule')

  const refresh = async () => { try { setS(await api('/automation/settings')) } catch (e) { toast.error(e.message) } }
  useEffect(() => { refresh() }, [])

  if (!s) return (
    <div className="space-y-4">
      <Skeleton className="h-16" />
      <Skeleton className="h-64" />
    </div>
  )

  const save = async (patch) => {
    setSaving(true)
    try {
      const updated = await api('/automation/settings', { method: 'PUT', body: { ...s, ...patch } })
      setS(updated); toast.success('Saved')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const setTime = (i, v) => { const times = [...(s.posting_times || [])]; times[i] = v; save({ posting_times: times }) }
  const toggleWorkingDay = (d) => { const cur = new Set(s.working_days || []); if (cur.has(d)) cur.delete(d); else cur.add(d); save({ working_days: [...cur].sort() }) }
  const togglePlatform = (p) => { const cur = new Set(s.enabled_platforms || []); if (cur.has(p)) cur.delete(p); else cur.add(p); save({ enabled_platforms: [...cur] }) }

  const runTickNow = async () => {
    setTicking(true)
    try {
      const r = await fetch('/api/automation/tick', { method: 'POST', headers: { 'X-Automation-Secret': s.tick_secret, 'Content-Type': 'application/json' } })
      const j = await r.json()
      if (j.ok) toast.success('Tick: ' + JSON.stringify(j.data).slice(0, 120))
      else toast.error(j.error || 'Tick failed')
    } catch (e) { toast.error(e.message) } finally { setTicking(false) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const cronSql = `-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'socialforge-tick') THEN
    PERFORM cron.unschedule('socialforge-tick');
  END IF;
END $$;
SELECT cron.schedule('socialforge-tick','* * * * *', $sql$
  SELECT net.http_post(
    url := '${baseUrl}/api/automation/tick',
    headers := '{"X-Automation-Secret": "${s.tick_secret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$sql$);`

  const PLATFORMS = [
    { key: 'linkedin', emoji: '💼', label: 'LinkedIn' },
    { key: 'instagram', emoji: '📷', label: 'Instagram' },
    { key: 'facebook', emoji: '👥', label: 'Facebook' },
    { key: 'threads', emoji: '🧵', label: 'Threads' },
  ]

  const sections = [
    {
      id: 'schedule', title: 'Schedule', icon: <CalendarDays className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Posts per day</Label>
              <Input type="number" min="1" max="24" value={s.posts_per_day || 5} onChange={e => setS({ ...s, posts_per_day: Number(e.target.value) })} onBlur={e => save({ posts_per_day: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
            </div>
            <div>
              <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Buffer minutes</Label>
              <Input type="number" min="1" max="30" value={s.buffer_minutes || 5} onBlur={e => save({ buffer_minutes: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
            </div>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Posting times</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1.5">
              {(s.posting_times || []).map((t, i) => (
                <Input key={i} type="time" value={t} onChange={e => setTime(i, e.target.value)} className="rounded-xl bg-[#FAFAFC] border-[#EBECF2] text-sm" />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Timezone</Label>
            <Select value={s.timezone} onValueChange={v => save({ timezone: v })}>
              <SelectTrigger className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]"><SelectValue /></SelectTrigger>
              <SelectContent>{COMMON_TZ.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Working days</Label>
            <div className="flex gap-1.5 mt-2">
              {WEEKDAYS.map((wd, i) => (
                <button key={i} onClick={() => toggleWorkingDay(i)}
                  className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all ${(s.working_days || []).includes(i) ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md shadow-[#7C3AED]/20' : 'bg-[#FAFAFC] border border-[#EBECF2] text-[#8A8A96]'}`}>{wd}</button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'queue', title: 'Queue Management', icon: <Layers className="h-4 w-4" />,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Queue order</Label>
            <Select value={s.queue_order || 'fifo'} onValueChange={v => save({ queue_order: v })}>
              <SelectTrigger className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="fifo">FIFO (First In)</SelectItem><SelectItem value="lifo">LIFO (Last In)</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Max retries</Label>
            <Input type="number" min="0" max="10" value={s.max_retries || 3} onBlur={e => save({ max_retries: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Regeneration limit</Label>
            <Input type="number" min="1" max="10" value={s.regeneration_limit || 3} onBlur={e => save({ regeneration_limit: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">AI temperature</Label>
            <Input type="number" min="0" max="2" step="0.1" value={s.ai_temperature || 0.7} onBlur={e => save({ ai_temperature: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
          </div>
        </div>
      ),
    },
    {
      id: 'ai', title: 'AI Generation', icon: <BrainCircuit className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Writing tone</Label>
              <Select value={s.writing_tone || 'professional'} onValueChange={v => save({ writing_tone: v })}>
                <SelectTrigger className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['professional', 'casual', 'inspirational', 'humorous', 'educational', 'storytelling'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">CTA style</Label>
              <Select value={s.cta_style || 'conversational'} onValueChange={v => save({ cta_style: v })}>
                <SelectTrigger className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="conversational">Conversational</SelectItem><SelectItem value="direct">Direct</SelectItem><SelectItem value="soft">Soft</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Hashtag count</Label>
              <Input type="number" min="0" max="30" value={s.hashtag_count || 5} onBlur={e => save({ hashtag_count: Number(e.target.value) })} className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center justify-between w-full bg-[#FAFAFC] border border-[#EBECF2] rounded-xl px-4 py-2.5">
                <Label className="text-sm text-[#16161D]">Emojis in captions</Label>
                <Switch checked={s.emoji_enabled !== false} onCheckedChange={v => save({ emoji_enabled: v })} />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96] mb-2 block">Enabled platforms</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLATFORMS.map(p => (
                <button key={p.key} onClick={() => togglePlatform(p.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${(s.enabled_platforms || []).includes(p.key) ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md shadow-[#7C3AED]/20' : 'bg-[#FAFAFC] border border-[#EBECF2] text-[#8A8A96]'}`}>
                  <span>{p.emoji}</span> {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'approval', title: 'Approval Workflow', icon: <CheckCircle2 className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#FAFAFC] border border-[#EBECF2] rounded-xl px-4 py-3">
            <div><Label className="text-sm text-[#16161D]">Require Telegram approval</Label><div className="text-[0.6rem] text-[#8A8A96]">Wait for your tap before publishing</div></div>
            <Switch checked={s.approval_required !== false} onCheckedChange={v => save({ approval_required: v })} />
          </div>
          <div className="flex items-center justify-between bg-[#FAFAFC] border border-[#EBECF2] rounded-xl px-4 py-3">
            <div><Label className="text-sm text-[#16161D]">Auto-publish after approve</Label><div className="text-[0.6rem] text-[#8A8A96]">Single tap publishes immediately</div></div>
            <Switch checked={s.auto_publish_after_approve !== false} onCheckedChange={v => save({ auto_publish_after_approve: v })} />
          </div>
          <div className="flex items-center justify-between bg-[#FAFAFC] border border-[#EBECF2] rounded-xl px-4 py-3">
            <div><Label className="text-sm text-[#16161D]">Approval reminders</Label><div className="text-[0.6rem] text-[#8A8A96]">Telegram nudge 3 min before slot</div></div>
            <Switch checked={s.approval_reminders !== false} onCheckedChange={v => save({ approval_reminders: v })} />
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">If not approved by publish time</Label>
            <Select value={s.approval_timeout_action || 'move_next'} onValueChange={v => save({ approval_timeout_action: v })}>
              <SelectTrigger className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="move_next">Move to next slot</SelectItem><SelectItem value="skip">Skip this post</SelectItem><SelectItem value="auto_publish">Auto-publish anyway</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">Confidence auto-publish threshold</Label>
            <Input type="number" min="0" max="1" step="0.05" placeholder="empty = always manual" value={s.auto_publish_confidence_threshold ?? ''}
              onChange={e => setS({ ...s, auto_publish_confidence_threshold: e.target.value === '' ? null : Number(e.target.value) })}
              onBlur={e => save({ auto_publish_confidence_threshold: e.target.value === '' ? null : Number(e.target.value) })}
              className="mt-1.5 rounded-xl bg-[#FAFAFC] border-[#EBECF2] w-40" />
          </div>
        </div>
      ),
    },
    {
      id: 'safety', title: 'Safety Controls', icon: <ShieldAlert className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#FEF2F2] border border-[#FCA5A5]/30 rounded-xl px-4 py-3">
            <div><Label className="text-sm font-semibold text-[#EF4444]">Kill switch</Label><div className="text-[0.6rem] text-[#8A8A96]">Stops ALL automation immediately</div></div>
            <Switch checked={s.kill_switch || false} onCheckedChange={v => save({ kill_switch: v })} />
          </div>
          <div className="flex items-center justify-between bg-[#FAFAFC] border border-[#EBECF2] rounded-xl px-4 py-3">
            <div><Label className="text-sm text-[#16161D]">Pause queue</Label><div className="text-[0.6rem] text-[#8A8A96]">Hold processing without disabling</div></div>
            <Switch checked={s.pause_queue || false} onCheckedChange={v => save({ pause_queue: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={runTickNow} disabled={ticking} variant="outline" className="rounded-xl border-[#EBECF2]">
              {ticking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />} Run tick now
            </Button>
            <Button onClick={refresh} variant="ghost"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          </div>
          <div className="rounded-xl bg-[#FAFAFC] border border-[#EBECF2] p-3.5 text-[0.6rem] text-[#8A8A96] space-y-1">
            <div>Last tick: <span className="text-[#16161D]">{s.last_tick_at ? new Date(s.last_tick_at).toLocaleString() : 'never'}</span></div>
            <div>Secret: <code className="text-[#7C3AED]">{s.tick_secret}</code></div>
          </div>
        </div>
      ),
    },
    {
      id: 'cron', title: 'Scheduled Ticks (pg_cron)', icon: <Clock className="h-4 w-4" />,
      content: (
        <div className="space-y-3">
          <div className="text-[0.6rem] text-[#8A8A96]">Run this once in Supabase SQL Editor to tick every minute automatically.</div>
          <Textarea readOnly value={cronSql} rows={10} className="rounded-xl bg-[#FAFAFC] border-[#EBECF2] text-[0.6rem] font-mono leading-relaxed" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={() => { navigator.clipboard.writeText(cronSql); toast.success('SQL copied') }}><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy SQL</Button>
            <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={() => window.open('https://supabase.com/dashboard/project/ghqakcbyqqxolavwfepe/sql/new', '_blank')}>Open Supabase SQL Editor</Button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
            <Sliders className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#16161D]">Automation Settings</h2>
            <p className="text-xs text-[#8A8A96]">{s.enabled ? 'Engine is live' : 'Engine is disabled'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={s.enabled} onCheckedChange={v => save({ enabled: v })} />
          <span className="text-sm font-medium text-[#16161D]">Enabled</span>
        </div>
      </div>

      {sections.map(section => (
        <motion.div key={section.id} className="rounded-2xl border border-[#EBECF2] bg-white shadow-sm overflow-hidden">
          <button onClick={() => setOpenSection(openSection === section.id ? '' : section.id)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#F8F9FC] transition-colors">
            <span className="h-8 w-8 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED]">{section.icon}</span>
            <span className="text-sm font-semibold text-[#16161D] flex-1 text-left">{section.title}</span>
            <motion.span animate={{ rotate: openSection === section.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-[#8A8A96]" />
            </motion.span>
          </button>
          <AnimatePresence>
            {openSection === section.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <div className="px-5 pb-5 border-t border-[#F0F1F5] pt-4">{section.content}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}