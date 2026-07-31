'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  LayoutDashboard, Layers, Sliders, Loader2, Sparkles, RefreshCw, Upload,
  FileSpreadsheet, FileText, Plus, Trash2, SkipForward, Archive, CheckCircle2,
  XCircle, Clock, TrendingUp, BrainCircuit, CalendarDays, Search, ChevronDown,
  ChevronUp, Download, Filter, PenLine, Copy, Eye, Zap, KeyRound, Network,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, resizeImageToBase64 } from '@/components/shared'

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
const stagger = { animate: { transition: { staggerChildren: 0.05 } } }
const STATUS_STYLE = {
  pending: 'bg-[#7C3AED]/8 text-[#7C3AED]', queued: 'bg-[#7C3AED]/8 text-[#7C3AED]',
  processing: 'bg-[#D97706]/10 text-[#D97706]', generating: 'bg-[#D97706]/10 text-[#D97706]',
  pending_approval: 'bg-[#EC4899]/10 text-[#EC4899]', approved: 'bg-[#0EA37A]/10 text-[#0EA37A]',
  scheduled: 'bg-[#3B82F6]/10 text-[#3B82F6]', published: 'bg-[#0EA37A]/10 text-[#0EA37A]',
  failed: 'bg-[#EF4444]/10 text-[#EF4444]', archived: 'bg-[#8A8A96]/10 text-[#8A8A96]',
  rejected: 'bg-[#EF4444]/10 text-[#EF4444]', draft: 'bg-[#8A8A96]/10 text-[#8A8A96]',
  skipped: 'bg-[#F59E0B]/10 text-[#F59E0B]',
}
const CATEGORIES = ['ai', 'tech', 'business', 'essays', 'productivity']

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-[#EEEFF4] ${className}`} />
}

function StatusBadge({ status }) {
  return <span className={`text-[0.55rem] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-[#EEEFF4] text-[#8A8A96]'}`}>{status?.replace(/_/g, ' ') || 'pending'}</span>
}

function MetricCard({ label, value, icon, gradient, sub }) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-4 shadow-sm transition-all hover:shadow-[0_8px_24px_rgba(124,58,237,0.08)] hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{label}</div>
          <div className="text-2xl font-bold text-[#16161D] mt-1.5">{value}</div>
          {sub && <div className="text-[0.6rem] text-[#8A8A96] mt-1">{sub}</div>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 ${gradient}`}>{icon}</div>
      </div>
    </motion.div>
  )
}

const genPipeline = [
  { label: 'Topic', icon: '📌' },
  { label: 'SEO Research', icon: '🔍' },
  { label: 'Outline', icon: '📑' },
  { label: 'Writing', icon: '✍️' },
  { label: 'Grammar', icon: '✅' },
  { label: 'SEO Optimize', icon: '🎯' },
  { label: 'Internal Links', icon: '🔗' },
  { label: 'Meta', icon: '🏷️' },
  { label: 'Approval', icon: '⏳' },
  { label: 'Scheduled', icon: '📅' },
  { label: 'Published', icon: '🚀' },
]

export default function BlogAutomationPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#16161D] tracking-tight">AI Editorial Management</h1>
              <p className="text-sm text-[#8A8A96]">Plan · Generate · Review · Schedule · Publish</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1 bg-white border border-[#EBECF2] rounded-2xl p-1 shadow-sm">
          {[
            ['dashboard', 'Dashboard', <LayoutDashboard key="d" className="h-3.5 w-3.5" />],
            ['topics', 'Topics', <Sparkles key="t" className="h-3.5 w-3.5" />],
            ['queue', 'Queue', <Layers key="q" className="h-3.5 w-3.5" />],
            ['library', 'Library', <Archive key="l" className="h-3.5 w-3.5" />],
            ['analytics', 'Analytics', <TrendingUp key="a" className="h-3.5 w-3.5" />],
          ].map(([key, label, icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${tab === key ? 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === 'dashboard' && <BlogDashboard />}
          {tab === 'topics' && <TopicManager />}
          {tab === 'queue' && <BlogQueueTable />}
          {tab === 'library' && <BlogLibrary />}
          {tab === 'analytics' && <BlogAnalytics />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function BlogDashboard() {
  const [stats, setStats] = useState(null)
  const [topics, setTopics] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [st, tp, s] = await Promise.all([
        api('/blog/stats').catch(() => ({})),
        api('/csv-topics').catch(() => []),
        api('/blog/settings').catch(() => ({})),
      ])
      setStats(st || {}); setTopics(tp || []); setSettings(s || {})
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  if (loading) return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    </motion.div>
  )

  const pending = (topics || []).filter(t => t.status === 'pending').length
  const failed = (topics || []).filter(t => t.status === 'failed').length
  const seoScores = (topics || []).filter(t => t.article_data?.quality?.score != null).map(t => t.article_data.quality.score)
  const avgSeo = seoScores.length ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : '—'

  const kpis = [
    { label: 'Topics in queue', value: pending, icon: <Sparkles className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#7C3AED] to-[#A855F7]' },
    { label: 'Generating', value: stats.processing || 0, icon: <BrainCircuit className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#D97706] to-[#F59E0B]' },
    { label: 'Waiting approval', value: stats.pending_approval || 0, icon: <Clock className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#EC4899] to-[#F97316]' },
    { label: 'Published today', value: stats.published || 0, icon: <CheckCircle2 className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#0EA37A] to-[#34D399]' },
    { label: 'Failed', value: failed + (stats.failed || 0), icon: <XCircle className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#EF4444] to-[#F87171]' },
    { label: 'Avg SEO score', value: avgSeo, icon: <TrendingUp className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]' },
    { label: 'Next publish', value: settings.publishing_time || '—', icon: <CalendarDays className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#8B5CF6] to-[#C084FC]' },
    { label: 'Engine status', value: settings.enabled ? 'Live' : 'Off', icon: settings.enabled ? <Zap className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />, gradient: settings.enabled ? 'bg-gradient-to-br from-[#0EA37A] to-[#14B8A6]' : 'bg-gradient-to-br from-[#8A8A96] to-[#A0A1AC]' },
  ]

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      {/* Hero */}
      <motion.div variants={fadeUp} className="rounded-2xl bg-gradient-to-r from-[#3B82F6]/8 via-white to-[#8B5CF6]/8 border border-[#EBECF2] p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 blur-2xl" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-white border border-[#EBECF2] flex items-center justify-center shadow-md">
              {settings.enabled ? <BrainCircuit className="h-7 w-7 text-[#3B82F6]" /> : <KeyRound className="h-7 w-7 text-[#8A8A96]" />}
            </div>
            {settings.enabled && <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#0EA37A] border-2 border-white"><span className="absolute inset-0 rounded-full bg-[#0EA37A] animate-ping opacity-60" /></span>}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#16161D]">Editorial Engine {settings.enabled ? 'Live' : 'Off'}</h2>
              <span className={`text-[0.6rem] font-medium px-2 py-0.5 rounded-full ${settings.enabled ? 'bg-[#0EA37A]/10 text-[#0EA37A]' : 'bg-[#EEEFF4] text-[#8A8A96]'}`}>{settings.enabled ? 'AUTONOMOUS' : 'DISABLED'}</span>
            </div>
            <div className="text-xs text-[#8A8A96] mt-0.5">
              Daily: <b className="text-[#16161D]">{settings.articles_per_day || 1}</b> article(s) at <b className="text-[#16161D]">{settings.publishing_time || '10:00'}</b> {settings.timezone || ''}
              {' · '}Buffer: {settings.buffer_minutes || 5}m
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={refresh} variant="outline" size="sm" className="rounded-xl border-[#EBECF2]"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
          </div>
        </div>
      </motion.div>

      {/* AI Status */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
            <h3 className="text-sm font-semibold text-[#16161D]">AI Status</h3>
          </div>
          <span className="text-[0.6rem] font-medium px-2 py-1 rounded-full bg-[#3B82F6]/8 text-[#3B82F6]">Live</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Current Topic</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D] truncate">
              {(topics || []).find(t => t.status === 'processing')?.topic || (stats.processing > 0 ? 'Generating…' : 'Idle')}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Generation Progress</div>
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-[#EEEFF4] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] transition-all duration-500" style={{ width: stats.processing > 0 ? '45%' : pending > 0 ? '10%' : '0%' }} />
              </div>
              <div className="text-[0.6rem] text-[#8A8A96] mt-1">{stats.processing > 0 ? 'In progress' : pending > 0 ? `${pending} topics queued` : 'No active generation'}</div>
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Next Publish</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">{settings.publishing_time || '—'} {settings.timezone || ''}</div>
          </div>
          <div>
            <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">Avg Generation</div>
            <div className="text-sm font-semibold mt-1 text-[#16161D]">~{settings.articles_per_day || 1} article(s) / day</div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => <MetricCard key={k.label} {...k} />)}
      </motion.div>

      {/* Generation pipeline */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#16161D]">Article Generation Pipeline</h3>
          <span className="text-[0.6rem] text-[#8A8A96]">Topic → Published</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {genPipeline.map((stage, i) => (
            <div key={i} className="flex items-center shrink-0">
              <div className={`rounded-xl border px-3 py-2 text-center ${i === 1 && stats.processing > 0 ? 'border-[#3B82F6]/40 bg-[#3B82F6]/5' : 'border-[#EBECF2] bg-[#FAFAFC]'}`}>
                <div className="text-sm">{stage.icon}</div>
                <div className="text-[0.5rem] font-semibold uppercase tracking-wide mt-0.5 text-[#16161D]">{stage.label}</div>
              </div>
              {i < genPipeline.length - 1 && <span className="text-[#C9CBD4] mx-1">›</span>}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

function TopicManager() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newTopic, setNewTopic] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const fileRef = useRef(null)

  const load = async () => { try { setTopics((await api('/csv-topics')) || []) } catch (e) { toast.error(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const addTopic = async () => {
    if (!newTopic.trim()) return
    await api('/csv-topics', { method: 'POST', body: { topic: newTopic.trim() } })
    setNewTopic(''); toast.success('Topic added'); load()
  }

  const addBulk = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    await api('/csv-topics/bulk', { method: 'POST', body: { rows: lines.map(t => ({ topic: t })) } })
    setBulkText(''); toast.success(`${lines.length} topics imported`); load()
  }

  const aiGenerate = async () => {
    setGenerating(true)
    try {
      const r = await api('/csv-topics/generate', { method: 'POST', body: { count: 10 } })
      toast.success(`${r.generated} topics generated by AI`)
      load()
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const handleFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      const buf = await file.arrayBuffer()
      let rows = []
      if (ext === 'csv') {
        const text = new TextDecoder().decode(buf)
        rows = parseCsv(text)
      } else {
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(ws)
      }
      const mapped = rows.map(r => ({
        topic: String(r.Topic || r.topic || '').trim(),
        keywords: String(r['Primary Keyword'] || r.Primary_Keyword || r.keywords || ''),
        category: String(r.Category || r.category || 'tech').toLowerCase(),
        priority: String(r.Priority || r.priority || 'medium'),
      })).filter(r => r.topic)
      if (!mapped.length) { toast.error('No valid rows found in file'); return }
      setImportPreview(mapped)
    } catch (e) { toast.error('Failed to parse file: ' + e.message) }
  }

  const confirmImport = async () => {
    await api('/csv-topics/bulk', { method: 'POST', body: { rows: importPreview } })
    toast.success(`${importPreview.length} topics imported`)
    setImportPreview(null); load()
  }

  const exportQueue = () => {
    const header = ['Topic', 'Category', 'Keywords', 'Priority', 'Status']
    const lines = topics.map(t => [t.topic, t.category, t.keywords, t.priority || 'medium', t.status].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'blog-topics-queue.csv'
    a.click()
    URL.revokeObjectURL(blob)
  }

  const filtered = topics.filter(t => !search || (t.topic || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Button size="sm" onClick={addTopic} className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white shadow-md"><Plus className="h-3.5 w-3.5 mr-1" /> New Topic</Button>
        <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Import Excel</Button>
        <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={() => fileRef.current?.click()}><FileText className="h-3.5 w-3.5 mr-1" /> Import CSV</Button>
        <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={aiGenerate} disabled={generating}>{generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />} Generate Topics</Button>
        <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={exportQueue}><Download className="h-3.5 w-3.5 mr-1" /> Export Queue</Button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
      </div>

      {/* Import preview */}
      <AnimatePresence>
        {importPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border border-[#3B82F6]/30 bg-[#EFF6FF] p-4 overflow-hidden">
            <div className="text-sm font-semibold text-[#1D4ED8] mb-2">Preview — {importPreview.length} topics ready to import</div>
            <div className="max-h-40 overflow-y-auto rounded-xl bg-white border border-[#BFDBFE]">
              {importPreview.slice(0, 50).map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-[#EFF6FF] last:border-0">
                  <span className="w-5 text-[#8A8A96]">{i + 1}</span>
                  <span className="flex-1 truncate text-[#16161D]">{r.topic}</span>
                  <span className="text-[#3B82F6] capitalize">{r.category}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white" onClick={confirmImport}>Import {importPreview.length} topics</Button>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual + bulk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-[#16161D] mb-3">Add Topic</div>
          <div className="flex gap-2">
            <Input value={newTopic} onChange={e => setNewTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTopic()} placeholder="Enter a blog topic…" className="rounded-xl bg-[#FAFAFC] border-[#EBECF2]" />
            <Button onClick={addTopic} className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-[#16161D] mb-3">Bulk Paste Topics</div>
          <div className="flex gap-2">
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={2} placeholder="One topic per line…" className="rounded-xl bg-[#FAFAFC] border-[#EBECF2] resize-none text-sm" />
            <Button onClick={addBulk} className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white shrink-0 self-end"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="h-4 w-4 text-[#8A8A96] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search topics…" className="pl-10 rounded-xl bg-white border-[#EBECF2]" />
      </div>

      {/* Topics table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D9E3] bg-white p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 flex items-center justify-center mb-3"><Sparkles className="h-6 w-6 text-[#3B82F6]" /></div>
          <div className="text-sm font-semibold text-[#16161D]">No topics yet</div>
          <div className="text-xs text-[#8A8A96] mt-1">Add a topic, import a file, or let AI generate ideas</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#EBECF2] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-wider text-[#8A8A96] border-b border-[#F0F1F5]">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Topic</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Keywords</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F6F9]">
                {filtered.slice(0, 100).map((t, i) => (
                  <tr key={t.id} className="hover:bg-[#F8F9FC] transition-colors">
                    <td className="px-4 py-2.5 text-[#8A8A96]">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[#16161D] max-w-[300px] truncate">{t.topic}</td>
                    <td className="px-4 py-2.5"><span className="text-[0.55rem] font-semibold px-2 py-0.5 rounded-full bg-[#3B82F6]/8 text-[#3B82F6] capitalize">{t.category || 'tech'}</span></td>
                    <td className="px-4 py-2.5 text-xs text-[#8A8A96] max-w-[180px] truncate">{t.keywords || '—'}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-[#8A8A96]">{t.priority || 'medium'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-[#8A8A96]">{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function parseCsv(text) {
  const rows = []
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (!lines.length) return rows
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    rows.push(row)
  }
  return rows
}

function BlogQueueTable() {
  const [queue, setQueue] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sortKey, setSortKey] = useState('queue_position')
  const [sortDir, setSortDir] = useState('asc')

  const load = async () => {
    setLoading(true)
    try {
      const [q, s] = await Promise.all([api('/blog/queue').catch(() => []), api('/blog/stats').catch(() => ({}))])
      setQueue(q || []); setStats(s || {})
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const doBulk = async (action) => {
    if (!selected.size) return
    try {
      const r = await api('/blog/bulk', { method: 'POST', body: { fileIds: [...selected], action } })
      toast.success(`${action}: ${r.filter(x => x.ok).length}/${selected.size}`)
      setSelected(new Set()); load()
    } catch (e) { toast.error(e.message) }
  }

  let filtered = queue.filter(x => (!statusFilter || x.status === statusFilter) && (!categoryFilter || x.article_data?.category === categoryFilter) && (!search || (x.file_name || '').toLowerCase().includes(search.toLowerCase()) || (x.article_data?.title || '').toLowerCase().includes(search.toLowerCase())))
  filtered = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? '', vb = b[sortKey] ?? ''
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key) => { if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') } }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-[#8A8A96] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search queue…" className="pl-10 rounded-xl bg-white border-[#EBECF2]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl bg-white border-[#EBECF2]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {['queued', 'processing', 'pending_approval', 'approved', 'scheduled', 'published', 'failed', 'archived', 'skipped'].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 rounded-xl bg-white border-[#EBECF2]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="rounded-xl border-[#EBECF2]" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Bulk bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#EFF6FF] border border-[#3B82F6]/20">
              <span className="text-sm font-semibold text-[#1D4ED8] mr-2">{selected.size} selected</span>
              {[['archive', 'Archive', <Archive key="a" className="h-3.5 w-3.5" />], ['skip', 'Skip', <SkipForward key="s" className="h-3.5 w-3.5" />], ['retry', 'Retry', <RefreshCw key="r" className="h-3.5 w-3.5" />], ['reset', 'Reset', <XCircle key="x" className="h-3.5 w-3.5" />]].map(([action, label, icon]) => (
                <Button key={action} size="sm" variant="outline" className="rounded-lg border-[#3B82F6]/25 bg-white" onClick={() => doBulk(action)}>{icon}<span className="ml-1">{label}</span></Button>
              ))}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D9E3] bg-white p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 flex items-center justify-center mb-3"><Layers className="h-6 w-6 text-[#3B82F6]" /></div>
          <div className="text-sm font-semibold text-[#16161D]">Queue is empty</div>
          <div className="text-xs text-[#8A8A96] mt-1">Add topics to get started</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#EBECF2] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.6rem] uppercase tracking-wider text-[#8A8A96] border-b border-[#F0F1F5]">
                  <th className="px-3 py-3"><input type="checkbox" className="rounded accent-[#3B82F6]" checked={selected.size === filtered.length && filtered.length > 0} onChange={() => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(x => x.file_id))) }} /></th>
                  <th className="px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('queue_position')}># {sortKey === 'queue_position' && (sortDir === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-3 py-3 font-semibold cursor-pointer" onClick={() => toggleSort('file_name')}>Topic</th>
                  <th className="px-3 py-3 font-semibold">Category</th>
                  <th className="px-3 py-3 font-semibold">SEO</th>
                  <th className="px-3 py-3 font-semibold">Words</th>
                  <th className="px-3 py-3 font-semibold">Read</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F6F9]">
                {filtered.map((row, i) => (
                  <tr key={row.file_id} className="hover:bg-[#F8F9FC] transition-colors">
                    <td className="px-3 py-2.5"><input type="checkbox" className="rounded accent-[#3B82F6]" checked={selected.has(row.file_id)} onChange={() => { const n = new Set(selected); if (n.has(row.file_id)) n.delete(row.file_id); else n.add(row.file_id); setSelected(n) }} /></td>
                    <td className="px-3 py-2.5 text-[#8A8A96]">{row.queue_position}</td>
                    <td className="px-3 py-2.5 font-medium text-[#16161D] max-w-[260px] truncate">{row.article_data?.title || row.file_name}</td>
                    <td className="px-3 py-2.5"><span className="text-[0.55rem] font-semibold px-2 py-0.5 rounded-full bg-[#3B82F6]/8 text-[#3B82F6] capitalize">{row.article_data?.category || '—'}</span></td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-[#0EA37A]">{row.article_data?.quality?.score != null ? `${row.article_data.quality.score}/100` : '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#8A8A96]">{row.article_data?.quality?.wordCount || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-[#8A8A96]">{row.article_data?.readingTime || '—'}m</td>
                    <td className="px-3 py-2.5"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-[#8A8A96]">{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 text-[0.6rem] text-[#8A8A96] border-t border-[#F0F1F5]">{filtered.length} of {queue.length} items</div>
        </div>
      )}
    </div>
  )
}

function BlogLibrary() {
  const [posts, setPosts] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api('/blog/posts').then(p => { setPosts(p || []); setLoading(false) }).catch(() => setLoading(false)) }, [])

  const statuses = ['', 'draft', 'scheduled', 'published', 'archived', 'rejected']
  const filtered = posts.filter(p => !filter || p.status === filter)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${filter === s ? 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white shadow-md' : 'bg-white border border-[#EBECF2] text-[#8A8A96] hover:text-[#16161D]'}`}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'} <span className="opacity-60">({posts.filter(p => !s || p.status === s).length})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D9E3] bg-white p-12 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 flex items-center justify-center mb-3"><Archive className="h-6 w-6 text-[#3B82F6]" /></div>
          <div className="text-sm font-semibold text-[#16161D]">No articles in this view</div>
          <div className="text-xs text-[#8A8A96] mt-1">Generated articles will appear here</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <motion.div key={p.id} variants={fadeUp} initial="initial" animate="animate" transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#3B82F6]/10 to-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                  {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <FileText className="h-5 w-5 text-[#3B82F6]" />}
                </div>
                <StatusBadge status={p.status || 'draft'} />
              </div>
              <div className="text-sm font-semibold text-[#16161D] mt-3 line-clamp-2">{p.title || 'Untitled'}</div>
              <div className="flex items-center gap-3 mt-2 text-[0.6rem] text-[#8A8A96]">
                <span>SEO: <b className="text-[#0EA37A]">{p.article_data?.quality?.score ?? '—'}</b></span>
                <span>· {p.article_data?.readingTime || '—'}m read</span>
                <span>· {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}</span>
              </div>
              <div className="flex gap-1.5 mt-4 pt-3 border-t border-[#F0F1F5]">
                <Button size="sm" variant="ghost" className="rounded-lg h-7 px-2" title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="rounded-lg h-7 px-2" title="Edit"><PenLine className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="rounded-lg h-7 px-2" title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="rounded-lg h-7 px-2 ml-auto text-[#EF4444]" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function BlogAnalytics() {
  const [topics, setTopics] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    Promise.all([api('/csv-topics').catch(() => []), api('/blog/stats').catch(() => ({}))])
      .then(([t, s]) => { setTopics(t || []); setStats(s || {}); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>

  const generated = (topics || []).filter(t => t.status === 'used' || t.status === 'approved' || t.status === 'published').length
  const failed = (topics || []).filter(t => t.status === 'failed').length
  const successRate = generated + failed > 0 ? Math.round((generated / (generated + failed)) * 100) : 0
  const seoScores = (topics || []).filter(t => t.article_data?.quality?.score != null).map(t => t.article_data.quality.score)
  const avgSeo = seoScores.length ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : 0
  const byCategory = {}
  ;(topics || []).forEach(t => { const c = t.category || 'tech'; byCategory[c] = (byCategory[c] || 0) + 1 })
  const maxCat = Math.max(...Object.values(byCategory), 1)

  const kpis = [
    { label: 'Total topics', value: (topics || []).length, icon: <Sparkles className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#7C3AED] to-[#A855F7]' },
    { label: 'Avg SEO score', value: avgSeo, icon: <TrendingUp className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]' },
    { label: 'Generated', value: generated, icon: <BrainCircuit className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#0EA37A] to-[#34D399]' },
    { label: 'Success rate', value: `${successRate}%`, icon: <CheckCircle2 className="h-4 w-4" />, gradient: 'bg-gradient-to-br from-[#0EA37A] to-[#14B8A6]' },
  ]

  return (
    <div className="space-y-6">
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => <MetricCard key={k.label} {...k} />)}
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#16161D] mb-4">Topics by Category</h3>
          <div className="space-y-3">
            {Object.entries(byCategory).map(([cat, count]) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1"><span className="capitalize font-medium text-[#16161D]">{cat}</span><span className="text-[#8A8A96]">{count}</span></div>
                <div className="h-2 rounded-full bg-[#EEEFF4] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]" style={{ width: `${(count / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(byCategory).length === 0 && <div className="text-sm text-[#8A8A96] py-6 text-center">No data yet</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-[#EBECF2] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#16161D] mb-4">Publishing Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['In queue', (topics || []).filter(t => t.status === 'pending').length], ['Published', (topics || []).filter(t => t.status === 'published').length], ['Failed', failed], ['Total', (topics || []).length]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-[#FAFAFC] border border-[#EBECF2] p-3.5">
                <div className="text-[0.6rem] uppercase tracking-wider text-[#8A8A96]">{l}</div>
                <div className="text-xl font-bold text-[#16161D] mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}