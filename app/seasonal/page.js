'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, Sparkles, CalendarDays, List, Sliders, X, Clock, Check, TrendingUp, Star, Eye, Zap, Bot, Send, Copy, Trash2, Sun, AlertTriangle, Search, Download, LayoutGrid, ChevronLeft, ChevronRight, Target, BrainCircuit, ShieldCheck, Zap as ZapIcon, FileText, Mail, Image as ImageIcon, MessageSquare, Radar } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' },
  facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' },
  twitter: { label: 'X', color: '#000000' }, blog: { label: 'Blog', color: '#7C3AED' }, newsletter: { label: 'Newsletter', color: '#F97316' },
}
const STATUS_COLORS = { draft: '#8A8A96', pending_approval: '#F59E0B', approved: '#3B82F6', scheduled: '#7C3AED', published: '#0EA37A', rejected: '#EF4444', skipped: '#8A8A96', archived: '#C4C5CE' }
const CONTENT_TYPES = ['Thought Leadership', 'Educational', 'Storytelling', 'Inspirational', 'Corporate', 'Marketing', 'Sales', 'Community', 'Question Post', 'Poll', 'Announcement', 'Research Style', 'Executive Style']
const INDUSTRIES = ['tech', 'health', 'education', 'finance', 'marketing', 'general', 'environment', 'food', 'culture', 'sports', 'travel', 'social', 'lifestyle', 'fun', 'regional', 'hr', 'cybersecurity', 'data']

function eventTrend(e) { return Math.min(99, (e.relevanceScore || 5) * 8 + (e.engagementPotential || 5) * 4) }
function eventReach(e) { const base = { festival: 12000, national: 10000, global: 8000, industry: 6000 }[e.type] || 4000; return base + (e.daysUntil > 0 ? Math.round(base * 0.3) : 0) }
function eventPriority(e) { if (e.daysUntil <= 3) return { l: 'Critical', c: '#EF4444' }; if (e.daysUntil <= 7) return { l: 'High', c: '#F59E0B' }; if (e.daysUntil <= 14) return { l: 'Medium', c: '#3B82F6' }; return { l: 'Planned', c: '#8A8A96' } }
function eventPlatforms(e) { if (e.type === 'festival') return ['instagram', 'facebook', 'threads']; if (e.type === 'national') return ['linkedin', 'instagram', 'facebook']; if (e.type === 'industry') return ['linkedin', 'blog', 'newsletter']; return ['linkedin', 'instagram', 'facebook', 'threads'] }
function predReach(item) { return (item.analysis?.engagementPotential || 5) * 1800 + 2000 }
function predEng(item) { return Math.round(((item.analysis?.engagementPotential || 5) / 10) * 7.2 * 100) / 10 }

export default function SeasonalDashboard() {
  const [tab, setTab] = useState('campaigns')
  const [events, setEvents] = useState([])
  const [queue, setQueue] = useState([])
  const [settings, setSettings] = useState({ countries: ['India'], industries: [], detectionWindow: 14, autoDraft: false, telegramNotify: false, approvalRequired: true, autoPublish: false, autoCampaign: false, autoImages: false, autoBlog: false, autoCarousel: false, autoSchedule: false, autoHashtags: false, autoSEO: false, autoReview: false })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [selEvent, setSelEvent] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [selected, setSelected] = useState([])
  const [copied, setCopied] = useState(null)
  const [discovery, setDiscovery] = useState(null)
  const [discWindow, setDiscWindow] = useState('week')
  const [discCat, setDiscCat] = useState('all')

  const refreshAll = async () => {
    setLoading(true)
    try {
      const [ev, q, s] = await Promise.all([
        api('/seasonal/detect', { method: 'POST', body: { daysAhead: 60 } }).catch(() => []),
        api('/seasonal').catch(() => []),
        api('/seasonal/settings').catch(() => ({})),
      ])
      setEvents(ev || []); setQueue(q || []); setSettings(prev => ({ ...prev, ...(s || {}) }))
      api('/seasonal/discovery').then(setDiscovery).catch(() => {})
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refreshAll() }, [])

  const assetCount = (eventName) => queue.filter(q => q.event_name === eventName && !['rejected', 'skipped', 'archived'].includes(q.status)).length
  const eventStatus = (eventName) => {
    const items = queue.filter(q => q.event_name === eventName)
    if (items.some(q => q.status === 'published')) return { l: 'Published', c: '#0EA37A' }
    if (items.some(q => q.status === 'scheduled')) return { l: 'Scheduled', c: '#7C3AED' }
    if (items.some(q => q.status === 'pending_approval')) return { l: 'Awaiting approval', c: '#F59E0B' }
    if (items.some(q => q.status === 'approved')) return { l: 'Approved', c: '#3B82F6' }
    if (items.length > 0) return { l: 'Draft ready', c: '#8A8A96' }
    return { l: 'Not started', c: '#C4C5CE' }
  }

  const generate = async (ev) => {
    setGenerating(ev.name)
    try { await api('/seasonal/generate', { method: 'POST', body: { event: ev } }); toast.success(`Campaign content generated for ${ev.name}`); refreshAll() }
    catch (e) { toast.error(e.message) } finally { setGenerating(null) }
  }
  const updateItem = async (id, patch, msg) => { try { await api(`/seasonal/${id}`, { method: 'PUT', body: patch }); toast.success(msg); refreshAll() } catch (e) { toast.error(e.message) } }
  const deleteItem = async (id) => { if (!confirm('Delete this draft?')) return; try { await api(`/seasonal/${id}`, { method: 'DELETE' }); toast.success('Deleted'); refreshAll() } catch (e) { toast.error(e.message) } }
  const saveSettings = async () => { try { await api('/seasonal/settings', { method: 'POST', body: settings }); toast.success('Auto Campaign Mode saved') } catch (e) { toast.error(e.message) } }
  const copyItem = async (q) => { const text = Object.values(q.platform_posts || {}).map(p => p?.caption).filter(Boolean).join('\n\n---\n\n'); await navigator.clipboard.writeText(text); toast.success('Copied') }
  const scheduleItem = (q) => { const d = new Date(); d.setDate(d.getDate() + 1); updateItem(q.id, { status: 'scheduled', scheduled_for: d.toISOString() }, 'Scheduled for tomorrow') }
  const bulkApprove = async () => { for (const id of selected) { try { await api(`/seasonal/${id}`, { method: 'PUT', body: { status: 'approved' } }) } catch {} } toast.success(`${selected.length} approved`); setSelected([]); refreshAll() }

  const kpis = [
    { l: 'Upcoming Events', v: fmt(events.length), c: '#7C3AED' },
    { l: 'Drafts Generated', v: fmt(queue.length), c: '#8B5CF6' },
    { l: 'Pending Approval', v: fmt(queue.filter(q => q.status === 'pending_approval').length), c: '#F59E0B' },
    { l: 'Scheduled', v: fmt(queue.filter(q => q.status === 'scheduled').length), c: '#3B82F6' },
    { l: 'Published', v: fmt(queue.filter(q => q.status === 'published').length), c: '#0EA37A' },
    { l: 'Est. Total Reach', v: short(queue.reduce((a, q) => a + predReach(q), 0)), c: '#EC4899' },
    { l: 'Campaigns Ready', v: fmt(queue.filter(q => ['approved', 'scheduled', 'published'].includes(q.status)).length), c: '#14B8A6' },
    { l: 'Success Rate', v: `${queue.length ? Math.round((queue.filter(q => q.status === 'published').length / queue.length) * 100) : 0}%`, c: '#0EA37A' },
  ]

  const filteredQueue = queue.filter(q => {
    if (search && !(q.event_name + ' ' + Object.keys(q.platform_posts || {}).join(' ')).toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && q.status !== statusFilter) return false
    return true
  })

  const calDays = useMemo(() => {
    const y = new Date().getFullYear()
    const first = new Date(y, calMonth, 1); const start = new Date(first); start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  }, [calMonth])
  const eventForDay = (d) => events.filter(e => e.month === d.getMonth() + 1 && e.day === d.getDate())

  const filteredEvents = events.filter(e => {
    if (search) {
      const qText = [e.name, e.country, e.type, e.industry].join(' ').toLowerCase()
      if (!qText.includes(search.toLowerCase())) return false
    }
    return true
  })

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading Seasonal Campaign Center…</div>

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl overflow-hidden bg-gradient-to-r from-[#1A1037] via-[#3B1D5E] to-[#6B21A8] relative">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#EC4899]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#F59E0B]/15 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-7 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#EC4899] flex items-center justify-center shadow-lg"><Sun className="h-7 w-7 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Seasonal Campaign Center</h1>
              <p className="text-sm text-white/60 mt-0.5 max-w-2xl">AI continuously monitors festivals, holidays, awareness days and global trends — automatically preparing campaigns before they happen.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={refreshAll} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors"><RefreshCw className="h-3.5 w-3.5" /> Rescan Events</button>
            <div className="flex items-center gap-2 text-[0.95rem] text-white/60 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-[#FBBF24]" /> Auto Campaign Mode: <b className={settings.autoCampaign ? 'text-emerald-400' : 'text-white/80'}>{settings.autoCampaign ? 'ON' : 'OFF'}</b>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={{ animate: { transition: { staggerChildren: 0.04 } } }} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(k => (
          <motion.div key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all`}>
            <div className="text-[0.78rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{k.l}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.c }}>{k.v}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex bg-white border border-[#EBECF2] rounded-xl p-1 shadow-sm w-fit flex-wrap">
        {[['discovery', 'Event Discovery', Radar], ['campaigns', 'Campaigns', CalendarDays], ['queue', 'Content Queue', List], ['calendar', 'Calendar', LayoutGrid], ['settings', 'Auto Mode', Sliders]].map(([k, l, Ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>
            <Ic className="h-4 w-4" />{l}
            {k === 'queue' && <span className="text-[0.95rem] px-1.5 py-0.5 rounded-full bg-white/20">{queue.length}</span>}
          </button>
        ))}
      </motion.div>

      {/* ============ EVENT DISCOVERY ENGINE ============ */}
      {tab === 'discovery' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Notifications */}
          {discovery?.notifications?.length > 0 && (
            <div className={`${C} p-4`}>
              <div className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-[#7C3AED]" /> Smart notifications · auto-generated daily</div>
              <div className="space-y-1.5">
                {discovery.notifications.slice(0, 6).map((n, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
                    <span className="text-lg shrink-0">{n.emoji}</span>
                    <span className="text-[0.875rem] text-[#16161D] flex-1">{n.label}</span>
                    <span className={`text-[0.9rem] px-2 py-0.5 rounded-full font-bold ${n.priority === 'high' ? 'bg-red-50 text-red-500' : n.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>{n.daysUntil === 0 ? 'Today' : `T-${n.daysUntil}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Window switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white border border-[#EBECF2] rounded-xl p-1 shadow-sm">
              {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'This Week'], ['month', 'This Month'], ['ninetyDays', 'Next 90 Days'], ['recent', 'Recently Finished']].map(([k, l]) => (
                <button key={k} onClick={() => setDiscWindow(k)} className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${discWindow === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{l} <span className="opacity-70">({discovery?.windows?.[k]?.length || 0})</span></button>
              ))}
            </div>
            <div className="flex-1 min-w-[220px] flex items-center gap-2 rounded-xl bg-white border border-[#EBECF2] px-3.5 py-2.5">
              <Search className="h-4 w-4 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setDiscCat('all')} className={`text-[0.85rem] font-semibold px-3 py-1.5 rounded-full transition-all ${discCat === 'all' ? 'bg-[#7C3AED] text-white' : 'bg-white border border-[#EBECF2] text-[#8A8A96]'}`}>All categories</button>
            {Object.entries(discovery?.categories || {}).map(([k, l]) => (
              <button key={k} onClick={() => setDiscCat(discCat === k ? 'all' : k)} className={`text-[0.85rem] font-semibold px-3 py-1.5 rounded-full transition-all ${discCat === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white' : 'bg-white border border-[#EBECF2] text-[#8A8A96] hover:border-[#D8C8FB]'}`}>{l}</button>
            ))}
          </div>

          {/* Events grid — NEVER empty */}
          {!discovery ? (
            <div className={`${C} p-10 text-center text-sm text-[#8A8A96] flex items-center justify-center gap-2`}><Loader2 className="h-4 w-4 animate-spin" /> Scanning the global event database…</div>
          ) : (
            (() => {
              const windowEvents = (discovery.windows?.[discWindow] || []).filter(e => discCat === 'all' || e.type === discCat).filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
              const fallbackSections = [
                { title: 'Today\u2019s events', icon: <Sun className="h-4 w-4 text-[#F59E0B]" />, list: discovery.windows?.today || [] },
                { title: 'Upcoming festivals', icon: <Sparkles className="h-4 w-4 text-[#EC4899]" />, list: (discovery.windows?.month || []).filter(e => e.type === 'festival' || e.type === 'religion' || e.type === 'regional') },
                { title: 'Awareness days', icon: <ShieldCheck className="h-4 w-4 text-[#0EA37A]" />, list: (discovery.windows?.month || []).filter(e => ['observance', 'health', 'global'].includes(e.type)) },
                { title: 'Industry & tech events', icon: <Zap className="h-4 w-4 text-[#7C3AED]" />, list: (discovery.windows?.ninetyDays || []).filter(e => ['tech', 'industry', 'startup', 'business', 'finance'].includes(e.type)) },
                { title: 'Recently finished', icon: <Clock className="h-4 w-4 text-[#8A8A96]" />, list: discovery.windows?.recent || [] },
              ]
              if (windowEvents.length > 0) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {windowEvents.map((e, i) => {
                      const pr = eventPriority(e)
                      return (
                        <motion.div key={`${e.name}-${e.month}-${e.day}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`${C} overflow-hidden hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)] hover:-translate-y-0.5 transition-all cursor-pointer ${e.isDrafted ? 'ring-1 ring-[#7C3AED]/30' : ''}`} onClick={() => setSelEvent(e)}>
                          <div className="h-16 bg-gradient-to-r from-[#1A1037] to-[#6B21A8] relative overflow-hidden">
                            <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[#EC4899]/25 blur-2xl" />
                            <div className="absolute bottom-2 left-4 flex items-center gap-2">
                              <span className="text-2xl">{e.emoji}</span>
                              <div><div className="text-sm font-bold text-white leading-tight">{e.name}</div><div className="text-[0.9rem] text-white/60">{e.country || 'Global'}{e.region && e.region !== 'Global' ? ` · ${e.region}` : ''} · {e.type}</div></div>
                            </div>
                            <div className="absolute top-2 right-2.5">
                              <span className="text-[0.95rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: e.isDrafted ? '#0EA37A22' : '#FFFFFF15', color: e.isDrafted ? '#6EE7B7' : '#C4B5FD' }}>{e.isDrafted ? '✓ Draft ready' : 'Not started'}</span>
                            </div>
                          </div>
                          <div className="p-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                              <span className={`text-[0.95rem] font-bold px-2.5 py-1 rounded-full ${e.daysUntil === 0 ? 'bg-red-50 text-red-600' : e.daysUntil <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>{e.daysUntil === 0 ? 'TODAY' : `${e.daysUntil}d left`}</span>
                              <span className="text-[0.95rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: pr.c + '15', color: pr.c }}>{pr.l}</span>
                              <span className="text-[0.95rem] font-bold px-2.5 py-1 rounded-full bg-[#0EA37A]/10 text-[#0EA37A]">~{short(eventReach(e))} reach</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-2.5">
                              {[['Popularity', e.popularity, '#EC4899'], ['Trend', e.trend, '#7C3AED'], ['Difficulty', Math.min(10, e.difficulty || 3), '#F59E0B']].map(([l, v, c]) => (
                                <div key={l}><div className="flex justify-between text-[0.875rem] text-[#8A8A96] mb-0.5"><span>{l}</span><span className="font-mono">{v}{l === 'Difficulty' ? '/10' : '%'}</span></div><div className="h-1 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, v * (l === 'Difficulty' ? 10 : 1))}%`, backgroundColor: c }} /></div></div>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              {eventPlatforms(e).slice(0, 4).map(p => M[p] ? <span key={p} className="text-[0.9rem] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: M[p].color + '12', color: M[p].color }}>{M[p].label}</span> : null)}
                              <span className="ml-auto text-[0.9rem] text-[#8A8A96]">{e.month}/{e.day}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(e.contentTypes || []).slice(0, 3).map(ct => <span key={ct} className="text-[0.875rem] px-1.5 py-0.5 rounded-full bg-[#F4F5F9] text-[#8A8A96]">{ct}</span>)}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )
              }
              // Fallback — always show useful opportunities, never an empty message
              return (
                <div className="space-y-5">
                  <div className="rounded-xl bg-gradient-to-r from-[#7C3AED]/8 to-[#EC4899]/8 border border-[#EBECF2] p-4">
                    <div className="text-sm font-bold text-[#16161D] mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#7C3AED]" /> More opportunities are always ready</div>
                    <p className="text-[0.875rem] text-[#8A8A96]">No events in this exact window/filter — here's what the global event intelligence engine found everywhere else:</p>
                  </div>
                  {fallbackSections.map(sec => sec.list.length > 0 ? (
                    <div key={sec.title}>
                      <div className="flex items-center gap-2 mb-2.5"><span className="h-7 w-7 rounded-lg bg-[#F4F5F9] flex items-center justify-center shrink-0">{sec.icon}</span><h4 className="text-sm font-bold text-[#16161D]">{sec.title} <span className="text-[0.95rem] font-semibold text-[#8A8A96]">({sec.list.length})</span></h4></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {sec.list.slice(0, 6).map(e => (
                          <div key={`${sec.title}-${e.name}`} className="rounded-xl border border-[#EBECF2] p-3 hover:border-[#D8C8FB] hover:shadow-md transition-all cursor-pointer bg-[#FAFAFD]" onClick={() => setSelEvent(e)}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xl">{e.emoji}</span>
                              <span className="text-xs font-bold text-[#16161D] truncate flex-1">{e.name}</span>
                              {e.daysAgo ? <span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-[#F4F5F9] text-[#8A8A96]">{e.daysAgo}d ago</span> : <span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">{e.daysUntil}d</span>}
                            </div>
                            <div className="text-[0.95rem] text-[#8A8A96] mb-2">{e.country || 'Global'} · {e.type} · trend {e.trend}%</div>
                            <div className="flex items-center gap-1.5">
                              {eventPlatforms(e).slice(0, 3).map(p => M[p] ? <span key={p} className="text-[0.875rem] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: M[p].color + '12', color: M[p].color }}>{M[p].label}</span> : null)}
                              {!e.isDrafted && <button onClick={ev => { ev.stopPropagation(); generate(e) }} className="ml-auto text-[0.9rem] font-bold px-2 py-1 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">{generating === e.name ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : '⚡ Generate'}</button>}
                              {e.isDrafted && <span className="ml-auto text-[0.9rem] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-[#0EA37A]">✓ Ready</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null)}
                  {!fallbackSections.some(s => s.list.length > 0) && (
                    <div className={`${C} p-8 text-center`}>
                      <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-3"><Sun className="h-5 w-5 text-[#7C3AED]" /></div>
                      <h4 className="text-sm font-bold text-[#16161D]">The engine found {discovery.total_events} recurring events globally</h4>
                      <p className="text-[0.875rem] text-[#8A8A96] mt-1 max-w-md mx-auto">All events reappear yearly — every festival, awareness day, conference and holiday is tracked in the permanent database.</p>
                      <button onClick={() => { setDiscWindow('ninetyDays'); setDiscCat('all') }} className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Show next 90 days</button>
                    </div>
                  )}
                </div>
              )
            })()
          )}
        </motion.div>
      )}

      {/* ============ CAMPAIGNS ============ */}
      {tab === 'campaigns' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-xl bg-white border border-[#EBECF2] px-3.5 py-2.5">
              <Search className="h-4 w-4 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events, countries, categories…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <div className="flex items-center gap-1.5 text-[0.95rem] text-[#8A8A96] bg-white border border-[#EBECF2] rounded-xl px-3 py-2.5">
              <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" /> <b className="text-[#16161D]">{events.length}</b> events in next 60 days · {queue.length} drafts auto-ready
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className={`${C} p-10 text-center`}>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#F59E0B]/15 to-[#EC4899]/15 flex items-center justify-center mb-4"><Sun className="h-6 w-6 text-[#F59E0B]" /></div>
              <h3 className="text-base font-bold text-[#16161D]">No campaigns matching this filter</h3>
              <p className="text-sm text-[#8A8A96] mt-1.5 max-w-md mx-auto">But {discovery?.total_events || 'many'} events are always in the radar. Here's what the engine recommends right now:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 text-left max-w-3xl mx-auto">
                {[
                  { e: 'Friendship Day', em: '🤝', d: 'Universal bonding moment — high shareability', t: 'lifestyle' },
                  { e: 'World Photography Day', em: '📸', d: 'Visual-first content wins across platforms', t: 'marketing' },
                  { e: 'International Hashtag Day', em: '#️⃣', d: 'Perfect for a hashtag strategy post', t: 'social' },
                  { e: 'World Emoji Day', em: '😀', d: 'Fun, low-effort, high-engagement content', t: 'social' },
                  { e: 'National Technology Day', em: '🖥️', d: 'Authority content for tech audiences', t: 'tech' },
                  { e: 'World HR Day', em: '🤝', d: 'Core audience event — thought leadership', t: 'hr' },
                ].map(rec => (
                  <div key={rec.e} className="rounded-xl border border-[#EBECF2] p-3.5 bg-[#FAFAFD]">
                    <div className="flex items-center gap-2 mb-1.5"><span className="text-xl">{rec.em}</span><span className="text-sm font-bold text-[#16161D]">{rec.e}</span><span className="ml-auto text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">{rec.t}</span></div>
                    <p className="text-[0.85rem] text-[#8A8A96] mb-2.5">{rec.d}</p>
                    <button onClick={() => { setDiscWindow('ninetyDays'); setDiscCat('all'); setTab('discovery') }} className="text-[0.95rem] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">Find in radar →</button>
                  </div>
                ))}
              </div>
              <button onClick={refreshAll} className="mt-6 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Rescan events</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEvents.map((ev, i) => {
                const pr = eventPriority(ev); const st = eventStatus(ev.name); const assets = assetCount(ev.name); const plats = eventPlatforms(ev)
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`${C} overflow-hidden hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)] hover:-translate-y-0.5 transition-all cursor-pointer ${ev.isDrafted ? 'ring-1 ring-[#7C3AED]/30' : ''}`} onClick={() => setSelEvent(ev)}>
                    <div className="h-20 bg-gradient-to-r from-[#1A1037] to-[#6B21A8] relative overflow-hidden">
                      <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-[#EC4899]/25 blur-2xl" />
                      <div className="absolute bottom-2 left-4 flex items-center gap-2">
                        <span className="text-3xl drop-shadow">{ev.emoji}</span>
                        <div><div className="text-base font-bold text-white leading-tight">{ev.name}</div><div className="text-[0.95rem] text-white/60">{ev.country || 'Global'} · {ev.type} · {ev.industry || 'general'}</div></div>
                      </div>
                      <div className="absolute top-2.5 right-2.5">
                        <span className="text-[0.95rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: st.c + '22', color: st.c === '#0EA37A' ? '#6EE7B7' : st.c }}>{st.l}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className={`text-[0.95rem] font-bold px-2.5 py-1 rounded-full ${ev.daysUntil === 0 ? 'bg-red-50 text-red-600' : ev.daysUntil <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>{ev.daysUntil === 0 ? 'TODAY' : `${ev.daysUntil}d remaining`}</span>
                        <span className="text-[0.95rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: pr.c + '15', color: pr.c }}>{pr.l} priority</span>
                        <span className="text-[0.95rem] font-bold px-2.5 py-1 rounded-full bg-[#0EA37A]/10 text-[#0EA37A]">~{short(eventReach(ev))} reach</span>
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-[0.95rem] text-[#8A8A96] mb-1"><span className="font-semibold">Trend score</span><span className="font-bold text-[#EC4899]">{eventTrend(ev)}%</span></div>
                        <div className="h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${eventTrend(ev)}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" /></div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          {plats.map(p => M[p] ? <span key={p} className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: M[p].color + '12', color: M[p].color }}>{M[p].label}</span> : null)}
                        </div>
                        <span className="text-[0.95rem] font-semibold text-[#8A8A96]">{assets}/12 assets</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden mb-4"><div className="h-full rounded-full bg-gradient-to-r from-[#0EA37A] to-[#14B8A6]" style={{ width: `${Math.min(100, assets * 9)}%` }} /></div>
                      <div className="flex gap-2">
                        <button onClick={(evt) => { evt.stopPropagation(); generate(ev) }} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] flex items-center justify-center gap-1.5 hover:opacity-90">
                          {generating === ev.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{ev.isDrafted ? 'Regenerate' : 'Generate Campaign'}
                        </button>
                        <button onClick={(evt) => { evt.stopPropagation(); setSelEvent(ev) }} className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]">Details</button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Smart insights */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { i: <TrendingUp className="h-4 w-4" />, t: 'Posting 3 days before an event historically generates 38% higher engagement than the day itself.', c: '#7C3AED' },
              { i: <Eye className="h-4 w-4" />, t: 'Instagram performs best with carousel posts for festivals; LinkedIn wins with storytelling for industry days.', c: '#EC4899' },
              { i: <MessageSquare className="h-4 w-4" />, t: 'Threads performs better with conversational, trending takes — schedule 1-2 days before the peak.', c: '#0EA37A' },
            ].map((s, i) => (
              <div key={i} className={`${C} p-4 flex items-start gap-3`}>
                <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: s.c }}>{s.i}</span>
                <p className="text-[0.875rem] text-[#16161D] leading-relaxed">{s.t}</p>
              </div>
            ))}
          </motion.div>
        </>
      )}

      {/* ============ QUEUE ============ */}
      {tab === 'queue' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} overflow-hidden`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F5] flex-wrap gap-2">
            <div className="flex items-center gap-2"><h3 className="text-base font-bold text-[#16161D]">Generated Campaign Content</h3><span className="text-[0.85rem] px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-semibold">{filteredQueue.length}</span></div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-1.5"><Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="bg-transparent text-xs w-28 focus:outline-none" /></div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-1.5 text-xs bg-white"><option value="">All statuses</option>{Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}</select>
              {selected.length > 0 && <button onClick={bulkApprove} className="text-[0.95rem] font-bold px-3 py-1.5 rounded-lg bg-[#0EA37A] text-white">Approve {selected.length}</button>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
                {['', 'Event', 'Platform', 'Status', 'Generated', 'Scheduled', 'Approval', 'Reach Prediction', 'Actions'].map(h => <th key={h} className={`py-2.5 px-3 text-left font-semibold text-[0.78rem] uppercase tracking-wider ${h !== 'Event' && h !== 'Platform' && h !== '' ? '' : ''}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredQueue.map(q => {
                  const plats = Object.keys(q.platform_posts || {})
                  const first = plats[0] || 'linkedin'
                  return (
                    <tr key={q.id} className={`border-b border-[#F0F1F5] hover:bg-[#F8F9FC] transition-colors ${selected.includes(q.id) ? 'bg-[#7C3AED]/5' : ''}`}>
                      <td className="py-2.5 px-3"><input type="checkbox" checked={selected.includes(q.id)} onChange={e => setSelected(sel => e.target.checked ? [...sel, q.id] : sel.filter(x => x !== q.id))} className="accent-[#7C3AED]" /></td>
                      <td className="py-2.5 px-3"><div className="flex items-center gap-2"><span className="text-xl">{q.emoji || '📅'}</span><div><div className="font-semibold text-[#16161D]">{q.event_name}</div><div className="text-[0.9rem] text-[#8A8A96]">{q.event_month}/{q.event_day} · {q.event_type}</div></div></div></td>
                      <td className="py-2.5 px-3"><div className="flex gap-1 flex-wrap max-w-[140px]">{plats.slice(0, 3).map(p => M[p] ? <span key={p} className="text-[0.9rem] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: M[p].color + '12', color: M[p].color }}>{M[p].label}</span> : null)}{plats.length > 3 && <span className="text-[0.9rem] text-[#8A8A96]">+{plats.length - 3}</span>}</div></td>
                      <td className="py-2.5 px-3"><span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[q.status] + '15', color: STATUS_COLORS[q.status] }}>{q.status.replace(/_/g, ' ')}</span></td>
                      <td className="py-2.5 px-3 text-[#8A8A96] font-mono">{q.created_at ? new Date(q.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className="py-2.5 px-3 text-[#8A8A96] font-mono">{q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className="py-2.5 px-3"><span className={`text-[0.9rem] px-2 py-0.5 rounded-full font-semibold ${q.status === 'approved' ? 'bg-emerald-50 text-[#0EA37A]' : q.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{q.status === 'pending_approval' ? 'Pending' : q.status === 'approved' ? 'Approved' : '—'}</span></td>
                      <td className="py-2.5 px-3"><span className="font-mono font-semibold text-[#16161D]">~{short(predReach(q))}</span><span className="text-[0.9rem] text-[#0EA37A]"> · {predEng(q)}% eng</span></td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          {q.status === 'draft' && <button onClick={() => updateItem(q.id, { status: 'pending_approval' }, 'Sent for approval')} className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-100" title="Send for approval"><Send className="h-3 w-3" /></button>}
                          {q.status === 'pending_approval' && <button onClick={() => updateItem(q.id, { status: 'approved' }, 'Approved')} className="h-7 w-7 rounded-lg bg-emerald-50 text-[#0EA37A] flex items-center justify-center hover:bg-emerald-100" title="Approve"><Check className="h-3 w-3" /></button>}
                          {q.status === 'approved' && <button onClick={() => scheduleItem(q)} className="h-7 w-7 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center hover:bg-[#7C3AED]/20" title="Schedule tomorrow"><Clock className="h-3 w-3" /></button>}
                          {q.status === 'scheduled' && <button onClick={() => updateItem(q.id, { status: 'published' }, 'Published')} className="h-7 w-7 rounded-lg bg-[#0EA37A]/10 text-[#0EA37A] flex items-center justify-center hover:bg-[#0EA37A]/20" title="Mark published"><Check className="h-3 w-3" /></button>}
                          <button onClick={() => copyItem(q)} className="h-7 w-7 rounded-lg bg-[#F4F5F9] text-[#8A8A96] flex items-center justify-center hover:text-[#7C3AED]" title="Copy"><Copy className="h-3 w-3" /></button>
                          {['draft', 'pending_approval', 'rejected'].includes(q.status) && <button onClick={() => deleteItem(q.id)} className="h-7 w-7 rounded-lg bg-[#F4F5F9] text-[#8A8A96] flex items-center justify-center hover:text-red-500" title="Delete"><Trash2 className="h-3 w-3" /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredQueue.length === 0 && <div className="py-12 text-center text-sm text-[#8A8A96]">No content yet — generate campaigns from the Campaigns tab, or enable Auto Campaign Mode.</div>}
          </div>
        </motion.div>
      )}

      {/* ============ CALENDAR ============ */}
      {tab === 'calendar' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#16161D]">{new Date(new Date().getFullYear(), calMonth).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCalMonth(m => (m + 11) % 12)} className="h-8 w-8 rounded-lg border border-[#EBECF2] flex items-center justify-center"><ChevronLeft className="h-4 w-4 text-[#8A8A96]" /></button>
              <button onClick={() => setCalMonth(new Date().getMonth())} className="px-3 h-8 rounded-lg border border-[#EBECF2] text-xs font-semibold">Today</button>
              <button onClick={() => setCalMonth(m => (m + 1) % 12)} className="h-8 w-8 rounded-lg border border-[#EBECF2] flex items-center justify-center"><ChevronRight className="h-4 w-4 text-[#8A8A96]" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-center text-[0.95rem] font-bold text-[#8A8A96] py-1.5">{d}</div>)}
            {calDays.map((d, i) => {
              const evs = eventForDay(d)
              const hasCampaign = evs.some(e => assetCount(e.name) > 0)
              const isToday = d.toDateString() === new Date().toDateString()
              return (
                <div key={i} className={`rounded-xl border min-h-[88px] p-1.5 ${isToday ? 'border-[#7C3AED] bg-[#7C3AED]/4' : 'border-[#F0F1F5]'} ${d.getMonth() !== calMonth ? 'opacity-40' : ''}`}>
                  <div className={`text-[0.95rem] font-semibold mb-1 ${isToday ? 'text-[#7C3AED]' : 'text-[#8A8A96]'}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {evs.slice(0, 2).map(e => (
                      <div key={e.name} className={`rounded-lg px-1.5 py-1 text-[0.9rem] font-semibold truncate cursor-pointer ${hasCampaign ? 'bg-gradient-to-r from-[#7C3AED]/15 to-[#EC4899]/15 text-[#7C3AED] border border-[#D8C8FB]' : 'bg-[#F8F9FC] text-[#8A8A96] border border-[#F0F1F5]'}`} title={`${e.name}${hasCampaign ? ' · campaign ready' : ''}`} onClick={() => setSelEvent(e)}>
                        {e.emoji} {e.name}
                      </div>
                    ))}
                    {evs.length > 2 && <div className="text-[0.9rem] text-[#7C3AED] font-semibold text-center">+{evs.length - 2}</div>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 text-[0.95rem] text-[#8A8A96] flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" /> Campaign ready</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#EEEFF4]" /> Event detected</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-[#D8D9E3]" /> No events</span>
          </div>
        </motion.div>
      )}

      {/* ============ AUTO MODE SETTINGS ============ */}
      {tab === 'settings' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={`${C} p-5`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#EC4899] flex items-center justify-center"><ZapIcon className="h-5 w-5 text-white" /></div>
              <div><h3 className="text-base font-bold text-[#16161D]">Seasonal Auto Campaign Mode</h3><p className="text-xs text-[#8A8A96]">Your full-time AI marketing team — review, approve, publish.</p></div>
            </div>
            <div className="rounded-2xl bg-gradient-to-r from-[#1A1037] to-[#6B21A8] p-4 mb-4 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-[#EC4899]/25 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Auto Campaign Mode</div>
                  <div className="text-[0.85rem] text-white/60">Detect → Generate → Schedule → Notify. You only approve.</div>
                </div>
                <button onClick={() => { const v = !settings.autoCampaign; setSettings(s => ({ ...s, autoCampaign: v })); api('/seasonal/settings', { method: 'POST', body: { ...settings, autoCampaign: v } }).then(() => toast.success(v ? 'Auto Campaign Mode ON — saved' : 'Auto Campaign Mode OFF — saved')).catch(e => toast.error(e.message)) }} className={`h-7 w-13 w-[52px] rounded-full transition-colors relative ${settings.autoCampaign ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899]' : 'bg-[#3A2A5C]'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${settings.autoCampaign ? 'left-[26px]' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {[
                ['autoDraft', 'Auto Generate Drafts'], ['autoImages', 'Auto Generate Images'], ['autoBlog', 'Auto Generate Blog'], ['autoCarousel', 'Auto Generate Carousel'], ['autoSchedule', 'Auto Schedule Drafts'], ['autoPublish', 'Auto Publish (with approval)'], ['autoHashtags', 'Auto Optimize Hashtags'], ['autoSEO', 'Auto SEO Optimization'], ['autoReview', 'Auto AI Review & Grammar'], ['telegramNotify', 'Telegram Approval Notifications']].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3.5 py-2.5">
                  <div className="text-sm font-medium text-[#16161D]">{label}</div>
                  <button onClick={() => { const v = !settings[key]; setSettings(s => ({ ...s, [key]: v })); api('/seasonal/settings', { method: 'POST', body: { ...settings, [key]: v } }).catch(e => toast.error(e.message)) }} className={`h-6 w-11 rounded-full transition-colors relative ${settings[key] ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899]' : 'bg-[#E5E6EF]'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${settings[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} className="mt-4 w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-md">Save Auto Campaign Settings</button>
          </div>
          <div className="space-y-5">
            <div className={`${C} p-5`}>
              <h3 className="text-base font-bold text-[#16161D] mb-3 flex items-center gap-2"><Target className="h-4 w-4 text-[#7C3AED]" /> Detection settings</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Target countries</div>
                  <div className="flex flex-wrap gap-1.5">
                    {['India', 'Global'].map(c => <button key={c} onClick={() => setSettings(s => ({ ...s, countries: s.countries.includes(c) ? s.countries.filter(x => x !== c) : [...s.countries, c] }))} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${settings.countries.includes(c) ? 'bg-[#7C3AED] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{c}</button>)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Target industries</div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {INDUSTRIES.map(ind => <button key={ind} onClick={() => setSettings(s => ({ ...s, industries: s.industries.includes(ind) ? s.industries.filter(x => x !== ind) : [...s.industries, ind] }))} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${settings.industries.includes(ind) ? 'bg-[#EC4899] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{ind}</button>)}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm font-medium mb-1"><span>Detection window</span><span className="font-mono text-[#7C3AED]">{settings.detectionWindow} days</span></div>
                  <input type="range" min="7" max="60" value={settings.detectionWindow} onChange={e => setSettings(s => ({ ...s, detectionWindow: parseInt(e.target.value) }))} className="w-full accent-[#7C3AED] h-1.5" />
                </div>
              </div>
            </div>
            <div className={`${C} p-5`}>
              <h3 className="text-base font-bold text-[#16161D] mb-3 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#0EA37A]" /> How Auto Mode works</h3>
              <div className="space-y-2.5">
                {[
                  { s: '1', t: 'Detect', d: 'AI scans Indian festivals, global holidays, awareness days & industry events' },
                  { s: '2', t: 'Generate', d: 'Platform-specific content, blog, newsletter, hashtags & SEO are created automatically' },
                  { s: '3', t: 'Schedule', d: 'Drafts are queued with optimal posting windows before the event' },
                  { s: '4', t: 'Notify', d: 'Telegram alerts you for review — approve or edit, then publish' },
                ].map((x, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white text-xs font-bold flex items-center justify-center shrink-0">{x.s}</span>
                    <div><div className="text-sm font-semibold text-[#16161D]">{x.t}</div><div className="text-[0.875rem] text-[#8A8A96]">{x.d}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============ EVENT DRAWER ============ */}
      <AnimatePresence>
        {selEvent && (
          <motion.div initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white z-50 shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-[#1A1037] to-[#6B21A8] px-5 py-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#EC4899]/25 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <span className="text-3xl">{selEvent.emoji}</span>
                <div><h3 className="text-base font-bold text-white">{selEvent.name}</h3><div className="text-[0.85rem] text-white/60">{selEvent.country || 'Global'} · {selEvent.type} · {selEvent.industry || 'general'}</div></div>
                <button onClick={() => setSelEvent(null)} className="ml-auto h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[0.85rem] font-bold px-2.5 py-1 rounded-full ${selEvent.daysUntil === 0 ? 'bg-red-50 text-red-600' : selEvent.daysUntil <= 7 ? 'bg-amber-50 text-amber-600' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>{selEvent.daysUntil === 0 ? 'Happening TODAY' : `${selEvent.daysUntil} days remaining`}</span>
                <span className="text-[0.85rem] font-bold px-2.5 py-1 rounded-full bg-[#EC4899]/10 text-[#EC4899]">Trend {eventTrend(selEvent)}%</span>
                <span className="text-[0.85rem] font-bold px-2.5 py-1 rounded-full bg-[#0EA37A]/10 text-[#0EA37A]">~{short(eventReach(selEvent))} reach</span>
              </div>

              <div className="rounded-xl border border-[#EBECF2] p-3.5 bg-[#FAFAFD]">
                <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5"><Target className="h-3 w-3" /> AI Strategy</div>
                <p className="text-xs text-[#16161D] leading-relaxed">Post 2-3 days before {selEvent.name} for peak visibility. Lead with the occasion's emotional hook, tie it to your industry ({selEvent.industry || 'general'}), and close with a CTA.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider">Recommended tone</div><div className="text-sm font-bold text-[#16161D]">{selEvent.type === 'industry' ? 'Professional' : selEvent.type === 'festival' ? 'Festive & warm' : 'Inspirational'}</div></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider">Best window</div><div className="text-sm font-bold text-[#16161D]">10:00 AM · {selEvent.daysUntil > 3 ? `${selEvent.daysUntil - 2}d before` : 'today'}</div></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider">Expected engagement</div><div className="text-sm font-bold text-[#0EA37A]">{Math.round((selEvent.engagementPotential || 5) * 7.2)}%</div></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider">Suggested CTA</div><div className="text-sm font-bold text-[#7C3AED]">{selEvent.type === 'national' ? 'Share your celebration' : selEvent.type === 'industry' ? 'Join the conversation' : 'Tag someone'}</div></div>
              </div>

              <div>
                <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Recommended platforms</div>
                <div className="flex flex-wrap gap-1.5">
                  {eventPlatforms(selEvent).map(p => M[p] ? <span key={p} className="text-[0.85rem] font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: M[p].color + '12', color: M[p].color }}>{M[p].label}</span> : null)}
                </div>
              </div>

              <div>
                <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Trending keywords & hashtags</div>
                <div className="flex flex-wrap gap-1.5">
                  {[selEvent.industry, selEvent.type, 'festival', 'celebration', 'moment'].filter(Boolean).map(k => <span key={k} className="text-[0.85rem] text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2.5 py-1 rounded-full">#{k}</span>)}
                  <span className="text-[0.85rem] text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2.5 py-1 rounded-full">#{selEvent.name.toLowerCase().replace(/\s+/g, '')}</span>
                </div>
              </div>

              <div>
                <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Campaign pipeline · {assetCount(selEvent.name)} assets</div>
                <div className="space-y-2">
                  {[['Idea', true], ['AI Generation', assetCount(selEvent.name) > 0], ['SEO Optimization', true], ['Approval', selEvent.isDrafted], ['Scheduled', eventStatus(selEvent.name).l === 'Scheduled'], ['Published', eventStatus(selEvent.name).l === 'Published']].map(([label, done]) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-gradient-to-br from-[#0EA37A] to-[#14B8A6] text-white' : 'bg-[#F0F1F5] text-[#C4C5CE]'}`}>{done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
                      <span className={`text-xs font-medium ${done ? 'text-[#16161D]' : 'text-[#8A8A96]'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#EBECF2] p-3.5">
                <div className="text-[0.95rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-[#0EA37A]" /> Campaign analytics</div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Predicted Reach', short(eventReach(selEvent))], ['Predicted Engagement', `${Math.round((selEvent.engagementPotential || 5) * 7.2)}%`], ['Predicted Saves', short(Math.round(eventReach(selEvent) * 0.08))], ['Predicted Comments', short(Math.round(eventReach(selEvent) * 0.04))], ['Predicted Shares', short(Math.round(eventReach(selEvent) * 0.06))], ['Campaign Readiness', `${Math.min(100, assetCount(selEvent.name) * 9)}%`]].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-[#FAFAFD] border border-[#EBECF2] p-2 text-center"><div className="text-sm font-bold text-[#16161D]">{v}</div><div className="text-[0.875rem] text-[#8A8A96] uppercase tracking-wider">{l}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[#F0F1F5] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { generate(selEvent); }} className="py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] flex items-center justify-center gap-1.5">{generating === selEvent.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate Campaign</button>
                <button onClick={() => { const items = queue.filter(q => q.event_name === selEvent.name && q.status === 'pending_approval'); items.forEach(q => updateItem(q.id, { status: 'approved' }, '')); toast.success(`Approved ${items.length} asset(s)`); setSelEvent(null) }} className="py-2.5 rounded-xl text-sm font-bold bg-[#0EA37A] text-white flex items-center justify-center gap-1.5"><Check className="h-3.5 w-3.5" />Approve All</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { const items = queue.filter(q => q.event_name === selEvent.name && q.status === 'approved'); items.forEach(q => scheduleItem(q)); toast.success('Scheduled'); setSelEvent(null) }} className="py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] flex items-center justify-center gap-1"><Clock className="h-3 w-3 text-[#7C3AED]" />Schedule</button>
                <button onClick={() => { const items = queue.filter(q => q.event_name === selEvent.name); const text = items.map(q => Object.values(q.platform_posts || {}).map(p => p?.caption).filter(Boolean).join('\n\n')).join('\n\n=== === ===\n\n'); navigator.clipboard.writeText(text || 'No content yet'); toast.success('Exported to clipboard') }} className="py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] flex items-center justify-center gap-1"><Download className="h-3 w-3 text-[#0EA37A]" />Export</button>
                <button onClick={() => setSelEvent(null)} className="py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] flex items-center justify-center gap-1"><X className="h-3 w-3 text-[#8A8A96]" />Close</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
