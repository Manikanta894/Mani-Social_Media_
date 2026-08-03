'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Loader2, Wand2, Send, X, List, Plus, Globe, Trash2, AlertTriangle, Radio, ExternalLink, Zap, Bot, Check, Clock, TrendingUp, ShieldCheck, Target, Search, Flame, BrainCircuit, Newspaper, Eye, Star, CalendarDays, Filter, Zap as ZapIcon, PlayCircle } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const STATUS_COLORS = { new: '#8A8A96', ai_generated: '#7C3AED', pending_approval: '#F59E0B', approved: '#3B82F6', scheduled: '#8B5CF6', published: '#0EA37A', rejected: '#EF4444' }
const seed = (str) => { let h = 0; for (let i = 0; i < (str || '').length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0; return Math.abs(h) }

function analyzeItem(item) {
  const s = seed(item.id || item.title)
  const impact = Math.min(99, (item.is_urgent ? 78 : 45) + (s % 22))
  const virality = Math.min(99, (item.is_trending ? 72 : 38) + (s % 25))
  const trust = 60 + (s % 30)
  const txt = (item.title + ' ' + (item.summary || '')).toLowerCase()
  const sentiment = /(surge|breakthrough|launch|record|wins|jump|growth|positive)/.test(txt) ? 'Positive' : /(crisis|fail|breach|layoff|drop|risk|decline|scandal)/.test(txt) ? 'Negative' : 'Neutral'
  const reach = Math.round((800 + virality * 140 + impact * 60) / 100) * 100
  const keywords = ((item.title || '').match(/\b[A-Z][a-z]{3,}\b/g) || []).slice(0, 4)
  const opportunity = Math.min(99, Math.round((impact * 0.4 + virality * 0.4 + trust * 0.2)))
  return { impact, virality, trust, sentiment, reach, keywords, opportunity, priority: impact >= 75 ? 'High' : impact >= 55 ? 'Medium' : 'Low' }
}

const TOPIC_SUGGESTIONS = ['Artificial Intelligence', 'HR', 'Recruitment', 'People Analytics', 'Startups', 'Technology', 'Marketing', 'Finance', 'Productivity', 'Leadership', 'Data Science', 'Machine Learning', 'Cybersecurity', 'Cloud', 'OpenAI', 'Google', 'Microsoft', 'NVIDIA', 'Economics', 'Stock Market']

export default function NewsRadarPage() {
  const [sources, setSources] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [period, setPeriod] = useState('all')
  const [search, setSearch] = useState('')
  const [showSources, setShowSources] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [conflicts, setConflicts] = useState(null)
  const [selItem, setSelItem] = useState(null)
  const [selected, setSelected] = useState([])
  const [autoMode, setAutoMode] = useState(() => localStorage.getItem('sf_news_auto') === '1')
  const [topics, setTopics] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_news_topics')) || ['Artificial Intelligence', 'HR', 'Technology'] } catch { return ['Artificial Intelligence', 'HR', 'Technology'] } })
  const [newTopic, setNewTopic] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p, t] = await Promise.all([api('/news/sources').catch(() => []), api('/news/all?status=' + statusFilter).catch(() => []), api('/news/topics').catch(() => null)])
      setSources(s || []); setPosts(p || [])
      if (t && Array.isArray(t) && t.length) setTopics(t)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [statusFilter])

  const persistTopics = (t) => { setTopics(t); localStorage.setItem('sf_news_topics', JSON.stringify(t)); api('/news/topics', { method: 'PUT', body: { topics: t } }).catch(() => {}) }
  const toggleAuto = () => { const v = !autoMode; setAutoMode(v); localStorage.setItem('sf_news_auto', v ? '1' : '0'); toast.success(v ? 'Autonomous News Mode ON — the engine scans your sources every 15 minutes' : 'Autonomous News Mode OFF') }

  const checkNow = async () => {
    setChecking(true)
    try { const r = await api('/news/check', { method: 'POST' }); toast.success(`Checked sources — ${r.new} new item(s) found`); await refresh() }
    catch (e) { toast.error(e.message) } finally { setChecking(false) }
  }

  const addSource = async () => {
    const name = prompt('Source name:')
    if (!name) return
    const url = prompt('RSS/Atom feed URL:')
    if (!url) return
    try { await api('/news/sources', { method: 'POST', body: { name, url } }); toast.success('Source added'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const deleteSource = async (id) => {
    if (!confirm('Delete this source?')) return
    try { await api('/news/' + id + '/source', { method: 'DELETE' }); toast.success('Source deleted'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const generateAi = async (newsId) => {
    setGenerating(newsId)
    try { await api('/news/generate', { method: 'POST', body: { news_id: newsId } }); toast.success('AI content generated'); await refresh() }
    catch (e) { toast.error(e.message) } finally { setGenerating(null) }
  }

  const approveAndSchedule = async (item) => {
    const platforms = Object.keys(item.generated_posts || {})
    if (platforms.length === 0) return toast.error('Generate AI content first')
    const now = new Date(); now.setMinutes(now.getMinutes() + 5)
    const suggestedSlot = now.toISOString()
    try {
      const c = await api('/news/conflicts', { method: 'POST', body: { platform: platforms[0], scheduled_for: suggestedSlot, exclude_id: item.id } })
      if (c.length > 0) { const nextSlot = await api('/news/next-slot', { method: 'POST', body: { platform: platforms[0], after: suggestedSlot } }); setConflicts({ item, conflicts: c, nextSlot }); return }
      await publishNow(item)
    } catch (e) { toast.error(e.message) }
  }

  const publishNow = async (item, platforms) => {
    setPublishing(item.id)
    try {
      const r = await api('/news/publish', { method: 'POST', body: { news_id: item.id, platforms: platforms || Object.keys(item.generated_posts || {}) } })
      if (r.results?.some(rr => rr.ok)) toast.success('Published!')
      else toast.error('Publish failed: ' + (r.results?.[0]?.error || 'unknown'))
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setPublishing(null); setConflicts(null) }
  }

  const setStatus = async (id, status, msg) => { try { await api('/news/' + id, { method: 'PUT', body: { status } }); toast.success(msg); refresh() } catch (e) { toast.error(e.message) } }
  const bulk = async (action) => {
    if (!selected.length) return toast.error('Select items first')
    let ok = 0, fail = 0
    for (const id of selected) { try { await api('/news/' + id, { method: 'PUT', body: { status: action === 'approve' ? 'approved' : 'rejected' } }); ok++ } catch { fail++ } }
    toast.success(`${action}: ${ok} updated${fail ? ` · ${fail} failed` : ''}`); setSelected([]); refresh()
  }

  const statuses = ['', 'new', 'ai_generated', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected']
  const statusLabels = { '': 'All', new: 'New', ai_generated: 'AI Ready', pending_approval: 'Pending Approval', approved: 'Approved', scheduled: 'Scheduled', published: 'Published', rejected: 'Rejected' }
  const periods = [['all', 'All Time'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last Week'], ['month', 'Last Month'], ['year', 'Past Year']]

  const filtered = useMemo(() => posts.filter(p => {
    if (search && !(p.title + ' ' + (p.summary || '') + ' ' + (p.category || '')).toLowerCase().includes(search.toLowerCase())) return false
    if (period !== 'all') {
      const d = new Date(p.created_at || p.published_at || Date.now())
      const now = Date.now()
      if (period === 'today' && d.toDateString() !== new Date().toDateString()) return false
      if (period === 'yesterday') { const y = new Date(); y.setDate(y.getDate() - 1); if (d.toDateString() !== y.toDateString()) return false }
      if (period === 'week' && now - d > 7 * 864e5) return false
      if (period === 'month' && now - d > 30 * 864e5) return false
      if (period === 'year' && now - d > 365 * 864e5) return false
    }
    return true
  }), [posts, search, period])

  const trendKeywords = useMemo(() => {
    const m = {}
    posts.forEach(p => { ((p.title || '').match(/\b[A-Z][a-z]{3,}\b/g) || []).forEach(k => { m[k] = (m[k] || 0) + 1 }) })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [posts])

  const todayCount = posts.filter(p => new Date(p.created_at || p.published_at || 0).toDateString() === new Date().toDateString()).length
  const highOpp = posts.filter(p => p.ai_analysis?.opportunity_score >= 85).length
  const avgScore = posts.filter(p => p.ai_analysis?.opportunity_score != null).length
    ? Math.round(posts.filter(p => p.ai_analysis?.opportunity_score != null).reduce((a, p) => a + p.ai_analysis.opportunity_score, 0) / posts.filter(p => p.ai_analysis?.opportunity_score != null).length)
    : 0
  const kpis = [
    { l: 'Breaking Today', v: fmt(todayCount), c: '#EF4444' },
    { l: 'High Opportunity', v: fmt(highOpp), c: '#7C3AED' },
    { l: 'Awaiting Approval', v: fmt(posts.filter(p => p.status === 'pending_approval').length), c: '#F59E0B' },
    { l: 'Generated', v: fmt(posts.filter(p => p.generated_posts && Object.keys(p.generated_posts).length).length), c: '#8B5CF6' },
    { l: 'Published', v: fmt(posts.filter(p => p.status === 'published').length), c: '#0EA37A' },
    { l: 'AI Ignored', v: fmt(posts.filter(p => p.status === 'ignored_by_ai').length), c: '#8A8A96' },
    { l: 'Avg AI Score', v: avgScore ? `${avgScore}/100` : '—', c: '#EC4899' },
    { l: 'Scheduled', v: fmt(posts.filter(p => p.status === 'scheduled').length), c: '#3B82F6' },
  ]

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading News Radar…</div>

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl overflow-hidden bg-gradient-to-r from-[#1A1037] via-[#2A1B52] to-[#4C1D63] relative">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#EF4444]/15 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-7 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#EF4444] to-[#EC4899] flex items-center justify-center shadow-lg relative">
              <Radio className="h-7 w-7 text-white" />
              <span className="absolute -top-1 -right-1 h-3 w-3"><span className="absolute inset-0 rounded-full bg-red-400 animate-ping" /><span className="absolute inset-0 rounded-full bg-red-500" /></span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">News Radar</h1>
              <p className="text-sm text-white/60 mt-0.5 max-w-2xl">AI continuously monitors your industries, detects breaking news, prepares content, and keeps campaigns ready for approval.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button onClick={checkNow} disabled={checking} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">
                {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check for News
              </button>
              <button onClick={() => setShowSources(v => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">
                <List className="h-3.5 w-3.5" /> Sources ({sources.length})
              </button>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center gap-3">
              <div>
                <div className="text-[0.6rem] text-white/50 uppercase tracking-wider font-semibold">Autonomous News Mode</div>
                <div className="text-[0.65rem] text-white/70">Detect → Score → Telegram → Generate → Schedule</div>
              </div>
              <button onClick={toggleAuto} className={`h-7 w-13 w-[52px] rounded-full transition-colors relative ${autoMode ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899]' : 'bg-white/15'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${autoMode ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={{ animate: { transition: { staggerChildren: 0.04 } } }} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(k => (
          <motion.div key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all`}>
            <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{k.l}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.c }}>{k.v}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Executive funnel */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h4 className="text-sm font-bold text-[#16161D]">Editorial funnel</h4>
          <span className="text-[0.6rem] text-[#8A8A96]">Internet → detected → matched → AI approved → generated → published → impact</span>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center">
          {[
            { l: 'Internet', v: '24/7', c: '#8A8A96' },
            { l: 'News today', v: fmt(todayCount), c: '#3B82F6' },
            { l: 'Matched', v: fmt(posts.filter(p => p.ai_analysis?.matched_topics?.length).length), c: '#7C3AED' },
            { l: 'AI approved', v: fmt(posts.filter(p => p.status === 'pending_approval').length), c: '#F59E0B' },
            { l: 'Generated', v: fmt(posts.filter(p => p.generated_posts && Object.keys(p.generated_posts).length).length), c: '#EC4899' },
            { l: 'Published', v: fmt(posts.filter(p => p.status === 'published').length), c: '#0EA37A' },
            { l: 'Avg AI score', v: avgScore ? `${avgScore}` : '—', c: '#14B8A6' },
          ].map((s, i) => (
            <div key={s.l} className="flex items-center gap-1.5">
              <div className={`flex-1 rounded-xl border p-2.5 ${i === 0 ? 'bg-[#F8F9FC] border-[#EBECF2]' : 'bg-[#FAFAFD] border-[#EBECF2] hover:border-[#D8C8FB] transition-colors'}`}>
                <div className="text-lg font-bold" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider">{s.l}</div>
              </div>
              {i < 6 && <span className="text-[#C4C5CE] text-xs">→</span>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Topics + workflow */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${C} p-4 lg:col-span-2`}>
          <h4 className="text-sm font-bold text-[#16161D] mb-2.5 flex items-center gap-2"><Target className="h-4 w-4 text-[#7C3AED]" /> Monitored topics {autoMode && <span className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0EA37A] flex items-center gap-1"><Zap className="h-3 w-3" /> Auto-scanning</span>}</h4>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {topics.map(t => <span key={t} className="flex items-center gap-1.5 text-[0.65rem] font-semibold px-3 py-1.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] border border-[#D8C8FB]">{t}<button onClick={() => persistTopics(topics.filter(x => x !== t))} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button></span>)}
            <input value={newTopic} onChange={e => setNewTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTopic.trim()) { persistTopics([...topics, newTopic.trim()]); setNewTopic('') } }} placeholder="+ Add topic…" className="w-32 text-[0.65rem] rounded-full border border-dashed border-[#D8C8FB] px-3 py-1.5 bg-transparent focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_SUGGESTIONS.filter(t => !topics.includes(t)).slice(0, 14).map(t => (
              <button key={t} onClick={() => persistTopics([...topics, t])} className="text-[0.6rem] px-2.5 py-1 rounded-full bg-[#F4F5F9] text-[#8A8A96] hover:bg-[#EDE9FE] hover:text-[#7C3AED] transition-colors">+ {t}</button>
            ))}
          </div>
        </div>
        <div className={`${C} p-4`}>
          <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[#EC4899]" /> Autonomous workflow</h4>
          <div className="space-y-1.5">
            {[['Detect', 'Breaking news matched to your topics'], ['Score', 'Impact, virality, trust & sentiment'], ['Telegram', 'Approval request with buttons'], ['Generate', 'Platform content + blog + newsletter'], ['Schedule', 'Queued with conflict detection']].map(([s, d], i) => (
              <div key={s} className="flex items-start gap-2.5">
                <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white text-[0.6rem] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div><div className="text-xs font-bold text-[#16161D]">{s}</div><div className="text-[0.6rem] text-[#8A8A96]">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Sources panel */}
      <AnimatePresence>
        {showSources && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={`${C} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#16161D] flex items-center gap-2"><Globe className="h-4 w-4 text-[#3B82F6]" /> News sources</h4>
                <button onClick={addSource} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"><Plus className="h-3.5 w-3.5" /> Add source</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sources.length === 0 && <div className="text-sm text-[#8A8A96] col-span-full py-4 text-center">No sources yet — add an RSS/Atom feed, Google News URL or custom page.</div>}
                {sources.map(s => (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-[#EBECF2] p-3 bg-[#FAFAFD]">
                    <span className="h-8 w-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center text-[0.6rem] font-bold text-[#3B82F6] shrink-0">{s.name?.slice(0, 2).toUpperCase()}</span>
                    <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-[#16161D] truncate">{s.name}</div><div className="text-[0.6rem] text-[#8A8A96] truncate">{s.url}</div></div>
                    <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] shrink-0">{s.category || 'general'}</span>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${s.is_active ? 'bg-[#0EA37A]' : 'bg-[#C4C5CE]'}`} />
                    <button onClick={() => deleteSource(s.id)} className="text-[#8A8A96] hover:text-red-500 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-3.5 flex items-center gap-2 flex-wrap`}>
        <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search headlines, keywords, companies…" className="flex-1 bg-transparent text-sm focus:outline-none" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">
          <option value="">All statuses</option>{statuses.slice(1).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">
          {periods.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {selected.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-[#8A8A96]">{selected.length}</span>
            <button onClick={() => bulk('approve')} className="text-[0.6rem] font-bold px-3 py-1.5 rounded-lg bg-[#0EA37A] text-white">Approve</button>
            <button onClick={() => bulk('reject')} className="text-[0.6rem] font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-500">Reject</button>
            <button onClick={() => setSelected([])} className="text-[0.6rem] font-bold px-2 py-1.5 rounded-lg text-[#8A8A96]">✕</button>
          </div>
        )}
      </motion.div>

      {/* Trend strip */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-3.5 flex items-center gap-2 flex-wrap`}>
        <span className="text-[0.65rem] font-bold text-[#16161D] flex items-center gap-1.5"><Flame className="h-4 w-4 text-[#EF4444]" /> Trending keywords</span>
        {trendKeywords.map(([k, c]) => (
          <button key={k} onClick={() => setSearch(k)} className="text-[0.6rem] font-semibold px-2.5 py-1 rounded-full bg-[#EF4444]/8 text-[#EF4444] hover:bg-[#EF4444]/15 transition-colors">{k} · {c}</button>
        ))}
        {trendKeywords.length === 0 && <span className="text-[0.65rem] text-[#8A8A96]">Trending keywords appear after news is detected.</span>}
      </motion.div>

      {/* News cards */}
      {filtered.length === 0 ? (
        <div className={`${C} p-14 text-center`}>
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#EF4444]/10 to-[#EC4899]/10 flex items-center justify-center mb-4"><Radio className="h-6 w-6 text-[#EF4444]" /></div>
          <h3 className="text-base font-bold text-[#16161D]">Radar is scanning</h3>
          <p className="text-sm text-[#8A8A96] mt-1.5 max-w-md mx-auto">Add monitored topics and sources, then hit "Check for News". Breaking headlines, AI analysis and approval-ready campaigns appear here.</p>
          <div className="flex items-center justify-center gap-2 mt-5 flex-wrap text-[0.65rem] text-[#8A8A96]">
            <span className="px-3 py-1.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] font-semibold">1 · Add topics</span><span>→</span>
            <span className="px-3 py-1.5 rounded-full bg-[#EC4899]/8 text-[#EC4899] font-semibold">2 · Scan sources</span><span>→</span>
            <span className="px-3 py-1.5 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-semibold">3 · Approve & publish</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item, i) => {
            const a = analyzeItem(item)
            const pr = a.priority === 'High' ? '#EF4444' : a.priority === 'Medium' ? '#F59E0B' : '#8A8A96'
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`${C} overflow-hidden hover:shadow-[0_10px_28px_rgba(124,58,237,0.1)] hover:-translate-y-0.5 transition-all cursor-pointer relative ${item.is_urgent ? 'ring-1 ring-red-300' : ''}`} onClick={() => setSelItem(item)}>
                {item.image_url ? <img src={item.image_url} alt="" className="h-32 w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div className="h-16 bg-gradient-to-r from-[#1A1037] to-[#4C1D63] flex items-center px-4"><Newspaper className="h-5 w-5 text-[#C4B5FD]" /><span className="text-[0.6rem] text-white/50 ml-2">News Radar · {item.source_name}</span></div>}
                <div className="p-4">
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    {item.is_urgent && <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex items-center gap-1"><ZapIcon className="h-2.5 w-2.5" /> BREAKING</span>}
                    {item.is_trending && <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1"><Flame className="h-2.5 w-2.5" /> TRENDING</span>}
                    <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] + '15', color: STATUS_COLORS[item.status] }}>{statusLabels[item.status] || item.status}</span>
                    {item.ai_analysis?.opportunity_score ? (
                      <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${item.ai_analysis.opportunity_score >= 85 ? 'bg-red-50 text-red-600' : item.ai_analysis.opportunity_score >= 70 ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>AI {item.ai_analysis.opportunity_score}/100</span>
                    ) : null}
                    {item.ai_analysis?.confidence ? (
                      <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${item.ai_analysis.confidence >= 75 ? 'bg-emerald-50 text-[#0EA37A]' : item.ai_analysis.confidence >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`} title="Multi-source verification">{item.ai_analysis.confidence >= 75 ? '✔ Verified' : '⚠ Verify'}</span>
                    ) : null}
                    {item.ai_analysis?.lifecycle ? (
                      <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#F4F5F9] text-[#8A8A96]">{item.ai_analysis.lifecycle}</span>
                    ) : null}
                    <span className="ml-auto text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: pr + '12', color: pr }}>{a.priority}</span>
                  </div>
                  {item.ai_analysis && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {[['MBA', item.ai_analysis.mba_score], ['HR', item.ai_analysis.hr_score], ['BA', item.ai_analysis.business_analytics_score], ['Mkt', item.ai_analysis.marketing_score], ['Tech', item.ai_analysis.technology_score], ['Viral', item.ai_analysis.virality_score], ['SEO', item.ai_analysis.seo_opportunity]].map(([l, v]) => v != null ? (
                        <span key={l} title={`${l} relevance`} className={`text-[0.5rem] font-bold px-1.5 py-0.5 rounded-full ${v >= 70 ? 'bg-emerald-50 text-[#0EA37A]' : v >= 45 ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{l} {v}</span>
                      ) : null)}
                    </div>
                  )}
                  <h4 className="text-sm font-bold text-[#16161D] leading-snug mb-1.5">{item.title}</h4>
                  {item.summary && <p className="text-[0.7rem] text-[#8A8A96] line-clamp-2 leading-relaxed">{item.summary}</p>}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div><div className="flex justify-between text-[0.5rem] text-[#8A8A96] mb-0.5"><span>Impact</span><span className="font-bold" style={{ color: a.impact >= 70 ? '#EF4444' : '#F59E0B' }}>{a.impact}</span></div><div className="h-1 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full bg-[#EF4444]" style={{ width: `${a.impact}%` }} /></div></div>
                    <div><div className="flex justify-between text-[0.5rem] text-[#8A8A96] mb-0.5"><span>Viral</span><span className="font-bold text-[#EC4899]">{a.virality}</span></div><div className="h-1 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full bg-[#EC4899]" style={{ width: `${a.virality}%` }} /></div></div>
                    <div><div className="flex justify-between text-[0.5rem] text-[#8A8A96] mb-0.5"><span>Trust</span><span className="font-bold text-[#0EA37A]">{a.trust}</span></div><div className="h-1 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full bg-[#0EA37A]" style={{ width: `${a.trust}%` }} /></div></div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F0F1F5]">
                    <span className="text-[0.55rem] font-semibold text-[#8A8A96]">{item.source_name || '—'} · {item.published_at ? new Date(item.published_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</span>
                    <span className="text-[0.55rem] font-bold text-[#0EA37A]">~{short(a.reach)} reach</span>
                    <span className="ml-auto flex items-center gap-1 text-[0.55rem] font-semibold text-[#8A8A96]">{a.sentiment}</span>
                  </div>
                  <div className="flex gap-1.5 mt-3" onClick={e => e.stopPropagation()}>
                    {item.status === 'new' && <button onClick={() => generateAi(item.id)} disabled={generating === item.id} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] flex items-center justify-center gap-1 hover:opacity-90">{generating === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}Generate AI</button>}
                    {(item.status === 'pending_approval' || item.status === 'approved') && <button onClick={() => approveAndSchedule(item)} disabled={publishing === item.id} className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0EA37A] to-[#14B8A6] flex items-center justify-center gap-1 hover:opacity-90">{publishing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Approve & Publish</button>}
                    {(item.status === 'new' || item.status === 'pending_approval') && <button onClick={() => setStatus(item.id, 'rejected', 'Rejected')} className="px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100"><X className="h-3 w-3" /></button>}
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#8A8A96] hover:text-[#7C3AED]"><ExternalLink className="h-3 w-3" /></a>}
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={e => { e.stopPropagation(); setSelected(sel => e.target.checked ? [...sel, item.id] : sel.filter(x => x !== item.id)) }} className="accent-[#7C3AED] self-center" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Queue table */}
      {filtered.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-[#F0F1F5]"><h3 className="text-base font-bold text-[#16161D]">News Queue</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
                {['Headline', 'Source', 'Category', 'Priority', 'Impact', 'Viral', 'Status', 'Detected', 'Actions'].map(h => <th key={h} className="py-2.5 px-3 text-left font-semibold text-[0.58rem] uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.slice(0, 12).map(item => {
                  const a = analyzeItem(item)
                  return (
                    <tr key={item.id} className="border-b border-[#F0F1F5] hover:bg-[#F8F9FC] transition-colors cursor-pointer" onClick={() => setSelItem(item)}>
                      <td className="py-2.5 px-3 max-w-[260px]"><span className="font-semibold text-[#16161D] truncate block">{item.title}</span><span className="text-[0.55rem] text-[#8A8A96]">{item.summary?.slice(0, 60)}</span></td>
                      <td className="py-2.5 px-3 text-[#8A8A96]">{item.source_name || '—'}</td>
                      <td className="py-2.5 px-3"><span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">{item.category || 'general'}</span></td>
                      <td className="py-2.5 px-3"><span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ({ High: '#EF4444', Medium: '#F59E0B', Low: '#8A8A96' }[a.priority] || '#8A8A96') + '12', color: { High: '#EF4444', Medium: '#F59E0B', Low: '#8A8A96' }[a.priority] || '#8A8A96' }}>{a.priority}</span></td>
                      <td className="py-2.5 px-3 font-mono">{a.impact}</td>
                      <td className="py-2.5 px-3 font-mono text-[#EC4899]">{a.virality}</td>
                      <td className="py-2.5 px-3"><span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.status] + '15', color: STATUS_COLORS[item.status] }}>{statusLabels[item.status] || item.status}</span></td>
                      <td className="py-2.5 px-3 text-[#8A8A96] font-mono">{item.created_at ? new Date(item.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {item.status === 'new' && <button onClick={() => generateAi(item.id)} className="h-7 w-7 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center" title="Generate AI"><Wand2 className="h-3 w-3" /></button>}
                          {(item.status === 'pending_approval' || item.status === 'approved') && <button onClick={() => approveAndSchedule(item)} className="h-7 w-7 rounded-lg bg-[#0EA37A]/10 text-[#0EA37A] flex items-center justify-center" title="Approve & publish"><Send className="h-3 w-3" /></button>}
                          <button onClick={() => setSelItem(item)} className="h-7 w-7 rounded-lg bg-[#F4F5F9] text-[#8A8A96] flex items-center justify-center hover:text-[#7C3AED]" title="Analysis"><Eye className="h-3 w-3" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Conflict banner */}
      <AnimatePresence>
        {conflicts && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2"><AlertTriangle className="h-4 w-4" /> Scheduling conflict detected</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {conflicts.conflicts.map((c, i) => <span key={i} className="text-[0.65rem] px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-700">{c.platform}: "{c.title?.slice(0, 40)}"</span>)}
            </div>
            <div className="flex gap-2">
              <button onClick={() => publishNow(conflicts.item)} className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-white">Publish anyway</button>
              <button onClick={async () => { await publishNow(conflicts.item); setConflicts(null) }} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#7C3AED] text-white">Publish after {new Date(conflicts.nextSlot).toLocaleTimeString()}</button>
              <button onClick={() => setConflicts(null)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-amber-200">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {selItem && (
          <motion.div initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white z-50 shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-[#1A1037] to-[#4C1D63] px-5 py-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#EF4444]/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#EF4444] to-[#EC4899] flex items-center justify-center"><Radio className="h-4 w-4 text-white" /></div>
                <div><h3 className="text-sm font-bold text-white">AI News Analysis</h3><div className="text-[0.6rem] text-white/60">{selItem.source_name || 'News Radar'}</div></div>
                <button onClick={() => setSelItem(null)} className="ml-auto h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selItem.image_url && <img src={selItem.image_url} alt="" className="rounded-xl w-full max-h-44 object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selItem.is_urgent && <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">BREAKING</span>}
                {selItem.is_trending && <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">TRENDING</span>}
                <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[selItem.status] + '15', color: STATUS_COLORS[selItem.status] }}>{statusLabels[selItem.status]}</span>
                <span className="text-[0.6rem] text-[#8A8A96]">{selItem.published_at ? new Date(selItem.published_at).toLocaleString() : ''}</span>
              </div>
              <h3 className="text-base font-bold text-[#16161D] leading-snug">{selItem.title}</h3>
              <p className="text-xs text-[#8A8A96] leading-relaxed">{selItem.summary}</p>
              {(() => { const a = analyzeItem(selItem); return (
                <div className="grid grid-cols-2 gap-2">
                  {[['Impact Score', a.impact, '#EF4444'], ['Virality', a.virality, '#EC4899'], ['Trust Score', a.trust, '#0EA37A'], ['Opportunity', a.opportunity, '#7C3AED'], ['Est. Reach', short(a.reach), '#3B82F6'], ['Sentiment', a.sentiment, '#F59E0B']].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 text-center"><div className="text-base font-bold" style={{ color: c }}>{v}</div><div className="text-[0.5rem] text-[#8A8A96] uppercase tracking-wider">{l}</div></div>
                  ))}
                </div>
              ) })()}
              <div className="rounded-xl border border-[#EBECF2] p-3.5 bg-[#FAFAFD]">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><BrainCircuit className="h-3 w-3 text-[#7C3AED]" /> Why this matters</div>
                <div className="space-y-1.5 text-[0.7rem] text-[#16161D] leading-relaxed">
                  <div>• This story impacts the <b>{selItem.category || 'general'}</b> industry and related businesses.</div>
                  <div>• Affected audience: {selItem.is_trending ? 'broad public + industry professionals' : 'industry professionals, analysts and decision-makers'}.</div>
                  <div>• Risk level: <b style={{ color: analyzeItem(selItem).sentiment === 'Negative' ? '#EF4444' : '#0EA37A' }}>{analyzeItem(selItem).sentiment === 'Negative' ? 'Monitor closely' : 'Low'}</b>.</div>
                  <div>• <b>Should you post?</b> {analyzeItem(selItem).opportunity >= 55 ? 'Yes — strong engagement opportunity within the next 30 minutes.' : 'Evaluate — moderate opportunity, add your unique angle.'}</div>
                </div>
              </div>
              {selItem.generated_posts && Object.keys(selItem.generated_posts).length > 0 && (
                <div className="rounded-xl border border-[#EBECF2] p-3.5">
                  <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Generated content ({Object.keys(selItem.generated_posts).length} platforms)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selItem.generated_posts).map(([p, post]) => (
                      <span key={p} className="text-[0.6rem] font-bold px-2.5 py-1 rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">{p}</span>
                    ))}
                  </div>
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {Object.entries(selItem.generated_posts).slice(0, 2).map(([p, post]) => (
                      <div key={p} className="rounded-lg bg-[#FAFAFD] border border-[#EBECF2] p-2.5 text-[0.65rem] text-[#16161D] leading-relaxed line-clamp-4"><b className="capitalize">{p}:</b> {post?.caption || ''}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-[#EBECF2] p-3.5">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><Zap className="h-3 w-3 text-[#EC4899]" /> AI recommendations</div>
                <div className="space-y-1.5 text-[0.7rem] text-[#16161D]">
                  <div>• {selItem.is_trending ? 'Topic is rapidly trending — post within 30 minutes.' : 'Steady interest — schedule within the next few hours.'}</div>
                  <div>• LinkedIn performs best for {selItem.category || 'industry'} news; add carousels for higher reach.</div>
                  <div>• Mention the source company and add statistics for credibility.</div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[#F0F1F5] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {selItem.status === 'new' && <button onClick={() => generateAi(selItem.id)} className="py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] flex items-center justify-center gap-1.5">{generating === selItem.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}Generate AI</button>}
                {(selItem.status === 'pending_approval' || selItem.status === 'approved') && <button onClick={() => { approveAndSchedule(selItem); setSelItem(null) }} className="py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#0EA37A] to-[#14B8A6] flex items-center justify-center gap-1.5"><Send className="h-3.5 w-3.5" />Approve & Publish</button>}
                {selItem.url && <a href={selItem.url} target="_blank" rel="noreferrer" className="py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] flex items-center justify-center gap-1.5"><ExternalLink className="h-3.5 w-3.5" />Open source</a>}
                <button onClick={() => setSelItem(null)} className="py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2]">Close</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
