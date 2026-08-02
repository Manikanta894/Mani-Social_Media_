'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, ChevronLeft, ChevronRight, Send, MessageSquare, Link as LinkIcon, Calendar as CalIcon, Search, Download, Zap, Bot, GripVertical, X, Clock, CheckCircle, AlertTriangle, Star, TrendingUp, LayoutGrid, List, KanbanSquare, Rows3, CalendarRange, Copy, Trash2, Pause, Play, Check, Eye, Sparkles, Filter, History } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'
import { analyze } from '@/app/compose/studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2', bg: 'rgba(10,102,194,0.1)' },
  instagram: { label: 'Instagram', color: '#E4405F', bg: 'rgba(228,64,95,0.1)' },
  facebook: { label: 'Facebook', color: '#1877F2', bg: 'rgba(24,119,242,0.1)' },
  threads: { label: 'Threads', color: '#111827', bg: 'rgba(17,24,39,0.08)' },
  blog: { label: 'Blog', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  newsletter: { label: 'Newsletter', color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
}
const STATUSES = ['published', 'scheduled', 'pending_approval', 'approved', 'draft', 'failed', 'rejected']
const STATUS_COLORS = { published: '#0EA37A', scheduled: '#7C3AED', pending_approval: '#F59E0B', approved: '#3B82F6', draft: '#8A8A96', failed: '#EF4444', rejected: '#EF4444' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmt = n => (n || 0).toLocaleString()

function Icon({ p, size = 14 }) {
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

function jobPlatforms(j) {
  return Object.keys(j.platform_posts || {}).filter(p => j.platform_posts[p]?.post_id || j.platform_posts[p]?.caption)
}
function firstPlatform(j) { return jobPlatforms(j)[0] || 'linkedin' }
function jobCaption(j) { return j.platform_posts?.[firstPlatform(j)]?.caption || j.topic || 'Untitled' }
function reachPred(j) { const l = (jobCaption(j) || '').length; const p = firstPlatform(j); const base = { linkedin: 900, instagram: 1200, facebook: 700, threads: 400 }[p] || 600; return base + l * 2 }
function priority(j) {
  const d = j.scheduled_for ? new Date(j.scheduled_for) - Date.now() : 0
  if (d < 0) return { label: 'Due', color: '#EF4444' }
  if (d < 864e5) return { label: 'High', color: '#F59E0B' }
  if (d < 7 * 864e5) return { label: 'Medium', color: '#3B82F6' }
  return { label: 'Low', color: '#8A8A96' }
}
function dateKey(d) { return d.toISOString().slice(0, 10) }

export default function CalendarPage() {
  const [jobs, setJobs] = useState([])
  const [view, setView] = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [busy, setBusy] = useState(null)
  const [selected, setSelected] = useState([])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [dragJob, setDragJob] = useState(null)
  const [hoverJob, setHoverJob] = useState(null)

  const refresh = async () => { setLoading(true); try { setJobs(await api('/jobs')) } catch (e) { toast.error(e.message) } finally { setLoading(false) } }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => jobs.filter(j => {
    if (filterPlatform) { const p = j.platform_posts?.[filterPlatform]; if (!p) return false }
    if (filterStatus && j.status !== filterStatus) return false
    if (search && !(j.topic || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [jobs, filterPlatform, filterStatus, search])

  const dayJobs = (d) => filtered.filter(j => {
    const src = j.scheduled_for || j.created_at || ''
    return src.startsWith(dateKey(d))
  })

  const update = async (id, body, msg) => { setBusy(id); try { await api(`/jobs/${id}`, { method: 'PUT', body }); toast.success(msg); refresh() } catch (e) { toast.error(e.message) } finally { setBusy(null) } }
  const publish = async (j) => { setPublishing(j.id); try { const r = await api(`/publish/${j.id}`, { method: 'POST', body: {} }); const ok = (r.results || []).filter(x => x.ok).length; toast.success(ok ? `Published to ${ok} platform(s)` : 'Publish failed'); refresh() } catch (e) { toast.error(e.message) } finally { setPublishing(null) } }
  const approve = (j) => update(j.id, { status: 'approved' }, 'Approved')
  const reject = (j) => update(j.id, { status: 'rejected' }, 'Rejected')
  const sendTG = async (j) => { try { await api('/telegram/send-draft', { method: 'POST', body: { jobId: j.id } }); toast.success('Sent to Telegram') } catch (e) { toast.error(e.message) } }
  const copyLink = async (j) => { await navigator.clipboard.writeText(`${window.location.origin}/approve?job=${j.id}`); toast.success('Approval link copied') }
  const duplicate = async (j) => { try { const body = { ...j }; delete body.id; delete body.created_at; delete body.updated_at; body.status = 'draft'; body.scheduled_for = null; await api('/jobs', { method: 'POST', body }); toast.success('Duplicated as draft'); refresh() } catch (e) { toast.error(e.message) } }
  const del = async (j) => { if (!confirm(`Delete "${(j.topic || 'post').slice(0, 40)}"?`)) return; try { await api(`/jobs/${j.id}`, { method: 'PUT', body: { status: 'rejected' } }); toast.success('Moved to rejected'); refresh() } catch (e) { toast.error(e.message) } }
  const pin = async (j) => { await update(j.id, { pinned: !j.pinned }, j.pinned ? 'Unpinned' : 'Pinned') }

  const onDrop = async (e, target) => {
    e.preventDefault(); if (!dragJob) return
    const old = dragJob.scheduled_for ? new Date(dragJob.scheduled_for) : new Date()
    const nd = new Date(target); nd.setHours(old.getHours(), old.getMinutes(), 0, 0)
    try { await api(`/jobs/${dragJob.id}`, { method: 'PUT', body: { scheduled_for: nd.toISOString() } }); toast.success(`Rescheduled to ${nd.toLocaleDateString()}`); refresh() } catch (err) { toast.error(err.message) }
    setDragJob(null)
  }

  // ---- KPIs ----
  const todayKey = dateKey(new Date())
  const scheduledToday = jobs.filter(j => j.scheduled_for?.startsWith(todayKey) && j.status === 'scheduled').length
  const publishedToday = jobs.filter(j => j.published_at?.startsWith(todayKey) || (j.scheduled_for?.startsWith(todayKey) && j.status === 'published')).length
  const pending = jobs.filter(j => j.status === 'pending_approval').length
  const failed = jobs.filter(j => j.status === 'failed').length
  const wk = jobs.filter(j => { const d = j.scheduled_for || j.published_at || j.created_at; return d && new Date(d) > new Date(Date.now() - 7 * 864e5) }).length
  const mo = jobs.filter(j => { const d = j.scheduled_for || j.published_at || j.created_at; return d && new Date(d) > new Date(Date.now() - 30 * 864e5) }).length
  const success = jobs.length ? Math.round(((jobs.length - failed) / jobs.length) * 100) : 0
  const nextPublish = jobs.filter(j => j.status === 'scheduled' && j.scheduled_for).sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))[0]
  const countdown = nextPublish ? Math.max(0, Math.floor((new Date(nextPublish.scheduled_for) - Date.now()) / 60000)) : null

  // ---- Conflicts ----
  const conflicts = useMemo(() => {
    const out = []
    const scheduled = jobs.filter(j => j.status === 'scheduled' && j.scheduled_for)
    for (let i = 0; i < scheduled.length; i++) {
      for (let k = i + 1; k < scheduled.length; k++) {
        const a = scheduled[i], b = scheduled[k]
        if (a.id === b.id) continue
        const pa = firstPlatform(a), pb = firstPlatform(b)
        if (pa !== pb) continue
        const diff = Math.abs(new Date(a.scheduled_for) - new Date(b.scheduled_for))
        if (diff < 20 * 60000) out.push({ t: 'same platform within 20 min', color: '#EF4444', a: a.topic, b: b.topic, p: M[pa]?.label })
      }
    }
    const caps = new Set()
    jobs.filter(j => j.status !== 'published').forEach(j => { const c = (jobCaption(j) || '').toLowerCase().slice(0, 80); if (c && caps.has(c)) out.push({ t: 'duplicate caption', color: '#F59E0B', a: j.topic }); caps.add(c) })
    jobs.filter(j => (j.status === 'scheduled' || j.status === 'pending_approval')).forEach(j => { if (!j.image_ref && !Object.values(j.platform_posts || {}).some(p => p?.image_url)) out.push({ t: 'missing image', color: '#F59E0B', a: j.topic }) })
    return out.slice(0, 5)
  }, [jobs])

  // ---- Insights ----
  const hourHist = useMemo(() => { const h = Array(24).fill(0); jobs.filter(j => j.status === 'published' && j.published_at).forEach(j => { const d = new Date(j.published_at); if (!isNaN(d)) h[d.getHours()]++ }); return h }, [jobs])
  const bestHour = hourHist.indexOf(Math.max(...hourHist))
  const dayHist = useMemo(() => { const d = Array(7).fill(0); jobs.filter(j => j.status === 'published' && j.published_at).forEach(j => { const dt = new Date(j.published_at); if (!isNaN(dt)) d[dt.getDay()]++ }); return d }, [jobs])
  const bestDay = dayHist.indexOf(Math.max(...dayHist))
  const platCounts = useMemo(() => { const c = {}; jobs.forEach(j => { jobPlatforms(j).forEach(p => { c[p] = (c[p] || 0) + 1 }) }); return c }, [jobs])
  const maxPlat = Math.max(...Object.values(platCounts), 1)

  // ---- Auto schedule ----
  const autoSchedule = async (days) => {
    const t = [9, 11, 13, 16, 18, 20][bestHour >= 0 ? Math.min(5, Math.floor(bestHour / 4)) : 2]
    const cands = jobs.filter(j => j.status === 'scheduled' && j.scheduled_for && new Date(j.scheduled_for) < new Date(Date.now() + days * 864e5))
    let n = 0
    for (const j of cands) {
      const d = new Date(j.scheduled_for); d.setHours(t + (n % 3), (n % 2) * 30, 0, 0)
      try { await api(`/jobs/${j.id}`, { method: 'PUT', body: { scheduled_for: d.toISOString() } }); n++ } catch {}
    }
    toast.success(`Optimized ${n} post(s) — best hour ~${t}:00 based on ${fmt(hourHist[bestHour] || 0)} past engagements`)
    refresh()
  }

  // ---- Calendar geometry ----
  const monthDays = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth()
    const start = new Date(y, m, 1); start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d })
  }, [currentDate])
  const weekDays = useMemo(() => {
    const s = new Date(currentDate); s.setDate(s.getDate() - s.getDay())
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d })
  }, [currentDate])
  const nav = (dir) => { const d = new Date(currentDate); if (view === 'month') d.setMonth(d.getMonth() + dir); else if (view === 'week' || view === 'timeline' || view === 'kanban') d.setDate(d.getDate() + dir * 7); else d.setDate(d.getDate() + dir); setCurrentDate(d) }
  const isToday = (d) => d.toDateString() === new Date().toDateString()

  // ---- Bulk ----
  const bulk = async (action) => {
    if (!selected.length) return toast.error('Select posts first')
    let n = 0
    for (const id of selected) {
      try {
        if (action === 'approve') await api(`/jobs/${id}`, { method: 'PUT', body: { status: 'approved' } })
        if (action === 'reject') await api(`/jobs/${id}`, { method: 'PUT', body: { status: 'rejected' } })
        if (action === 'publish') await api(`/publish/${id}`, { method: 'POST', body: {} })
        if (action === 'tomorrow') { const j = jobs.find(x => x.id === id); if (j?.scheduled_for) { const d = new Date(j.scheduled_for); d.setDate(d.getDate() + 1); await api(`/jobs/${id}`, { method: 'PUT', body: { scheduled_for: d.toISOString() } }) } }
        n++
      } catch {}
    }
    toast.success(`${action}: ${n} updated`); setSelected([]); refresh()
  }
  const exportCSV = () => {
    const rows = [['Title', 'Platform', 'Status', 'Scheduled', 'Reach Prediction']]
    filtered.forEach(j => rows.push([j.topic, firstPlatform(j), j.status, j.scheduled_for || '', reachPred(j)]))
    const blob = new Blob([rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'content-calendar.csv'; a.click()
    toast.success('Calendar exported')
  }

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading calendar…</div>

  const kpis = [
    { l: 'Scheduled Today', v: fmt(scheduledToday), c: '#7C3AED' },
    { l: 'Published Today', v: fmt(publishedToday), c: '#0EA37A' },
    { l: 'Pending Approval', v: fmt(pending), c: '#F59E0B' },
    { l: 'Missed / Failed', v: fmt(failed), c: '#EF4444' },
    { l: 'Success Rate', v: `${success}%`, c: '#0EA37A' },
    { l: 'Weekly Posts', v: fmt(wk), c: '#3B82F6' },
    { l: 'Monthly Posts', v: fmt(mo), c: '#EC4899' },
    { l: 'Next Publish', v: countdown === null ? '—' : `${Math.floor(countdown / 60)}h ${countdown % 60}m`, c: '#8B5CF6' },
  ]

  const PostCard = ({ j, compact }) => {
    const p = firstPlatform(j); const pr = priority(j)
    return (
      <motion.div
        key={j.id} draggable onDragStart={e => { setDragJob(j); e.dataTransfer.setData('text/plain', j.id) }}
        onClick={() => setSelectedJob(j)} onMouseEnter={() => setHoverJob(j)} onMouseLeave={() => setHoverJob(null)}
        className={`rounded-xl border cursor-pointer transition-all hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] group ${j.pinned ? 'ring-1 ring-amber-300' : ''}`}
        style={{ backgroundColor: M[p]?.bg, borderColor: M[p]?.color + '40', borderLeft: `3px solid ${M[p]?.color}` }}
      >
        <div className="p-2">
          <div className="flex items-center gap-1.5">
            <Icon p={p} size={12} />
            <span className="text-[0.6rem] font-bold" style={{ color: M[p]?.color }}>{M[p]?.label}</span>
            <span className="h-1.5 w-1.5 rounded-full ml-auto" style={{ backgroundColor: STATUS_COLORS[j.status] || '#8A8A96' }} />
            {j.pinned && <Star className="h-3 w-3 text-amber-400 fill-current" />}
          </div>
          {!compact && <div className="text-[0.68rem] font-semibold text-[#16161D] mt-1 line-clamp-2">{j.topic || 'Untitled'}</div>}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[0.55rem] font-mono text-[#8A8A96]">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: pr.color + '18', color: pr.color }}>{pr.label}</span>
          </div>
        </div>
        {hoverJob?.id === j.id && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="absolute z-30 w-64 rounded-2xl bg-white border border-[#EBECF2] shadow-2xl p-3.5 -bottom-2 left-1/2 -translate-x-1/2 translate-y-full">
            <div className="flex items-center gap-2 mb-2">
              <Icon p={p} size={14} /><span className="text-xs font-bold text-[#16161D]">{M[p]?.label}</span>
              <span className="text-[0.55rem] font-mono text-[#8A8A96] ml-auto">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleString() : ''}</span>
            </div>
            <p className="text-[0.68rem] text-[#16161D] leading-snug line-clamp-3">{jobCaption(j)}</p>
            <div className="flex gap-1.5 mt-2">
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-semibold">AI {analyze(jobCaption(j)).quality}/100</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-semibold">SEO {analyze(jobCaption(j)).seo}/100</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-[#0EA37A]/10 text-[#0EA37A] font-semibold">~{fmt(reachPred(j))} reach</span>
            </div>
            <div className="flex gap-1.5 mt-2.5">
              {j.status !== 'published' && <button onClick={e => { e.stopPropagation(); publish(j) }} className="flex-1 text-[0.6rem] font-bold py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">{publishing === j.id ? '...' : 'Publish'}</button>}
              {j.status === 'pending_approval' && <button onClick={e => { e.stopPropagation(); approve(j) }} className="flex-1 text-[0.6rem] font-bold py-1.5 rounded-lg bg-[#0EA37A] text-white">Approve</button>}
              <button onClick={e => { e.stopPropagation(); copyLink(j) }} className="flex-1 text-[0.6rem] font-bold py-1.5 rounded-lg bg-[#F4F5F9] text-[#16161D]">Link</button>
            </div>
          </motion.div>
        )}
      </motion.div>
    )
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/25"><CalIcon className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-[#16161D] tracking-tight">Content Calendar</h1><p className="text-sm text-[#8A8A96]">Manage, schedule, reschedule and publish content across every connected platform.</p></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white border border-[#EBECF2] rounded-xl p-1 shadow-sm">
            {[['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda'], ['timeline', 'Timeline'], ['kanban', 'Kanban']].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => nav(-1)} className="h-8 w-8 rounded-lg border border-[#EBECF2] bg-white flex items-center justify-center hover:border-[#D8C8FB]"><ChevronLeft className="h-4 w-4 text-[#8A8A96]" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 h-8 rounded-lg border border-[#EBECF2] bg-white text-xs font-semibold text-[#16161D] hover:border-[#D8C8FB]">Today</button>
            <button onClick={() => nav(1)} className="h-8 w-8 rounded-lg border border-[#EBECF2] bg-white flex items-center justify-center hover:border-[#D8C8FB]"><ChevronRight className="h-4 w-4 text-[#8A8A96]" /></button>
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

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-red-600">Schedule conflicts detected</div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {conflicts.map((c, i) => <span key={i} className="text-[0.65rem] px-2.5 py-1 rounded-full bg-white border border-red-200 text-red-600 font-medium">{c.t}{c.a ? ` · "${c.a.slice(0, 30)}"` : ''}</span>)}
            </div>
          </div>
        </motion.div>
      )}

      {/* Toolbar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-3.5 flex items-center gap-2 flex-wrap`}>
        <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…" className="flex-1 bg-transparent text-sm focus:outline-none" />
        </div>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">All platforms</option>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
        <button onClick={() => autoSchedule(7)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md"><Zap className="h-3.5 w-3.5" /> Auto-Schedule Week</button>
        <button onClick={() => autoSchedule(30)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Zap className="h-3.5 w-3.5 text-[#F59E0B]" /> Month</button>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Download className="h-3.5 w-3.5 text-[#0EA37A]" /> Export</button>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><LayoutGrid className="h-3.5 w-3.5 text-[#3B82F6]" /> Sync</button>
      </motion.div>

      {/* Insights strip */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${C} p-4`}>
          <div className="text-xs font-bold text-[#16161D] mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#0EA37A]" /> Platform distribution</div>
          <div className="space-y-2">
            {Object.entries(platCounts).length === 0 && <div className="text-[0.7rem] text-[#8A8A96]">No posts yet — platform bars appear after publishing.</div>}
            {Object.entries(platCounts).map(([p, c]) => (
              <div key={p} className="flex items-center gap-2">
                <Icon p={p} size={13} /><span className="text-[0.6rem] font-semibold text-[#16161D] w-16">{M[p]?.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(c / maxPlat) * 100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: M[p]?.color }} /></div>
                <span className="text-[0.6rem] font-mono text-[#8A8A96] w-6 text-right">{c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`${C} p-4`}>
          <div className="text-xs font-bold text-[#16161D] mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-[#7C3AED]" /> Best publishing time</div>
          {bestHour >= 0 ? (
            <div>
              <div className="flex items-end gap-0.5 h-16">
                {hourHist.map((v, h) => <div key={h} title={`${h}:00 — ${v}`} className="flex-1 rounded-t-sm transition-all" style={{ height: `${Math.max(8, (v / Math.max(1, Math.max(...hourHist))) * 100)}%`, backgroundColor: h === bestHour ? '#7C3AED' : '#E5E6EF' }} />)}
              </div>
              <div className="text-[0.65rem] text-[#8A8A96] mt-2">Peak: <b className="text-[#7C3AED]">{bestHour}:00</b> · {fmt(hourHist[bestHour])} posts</div>
            </div>
          ) : <div className="text-[0.7rem] text-[#8A8A96] py-6 text-center">Publish posts to discover your peak hours.</div>}
        </div>
        <div className={`${C} p-4`}>
          <div className="text-xs font-bold text-[#16161D] mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#EC4899]" /> Calendar insights</div>
          <div className="space-y-2 text-[0.7rem]">
            <div className="flex justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><span className="text-[#8A8A96]">Most active day</span><b className="text-[#16161D]">{bestDay >= 0 ? DAYS[bestDay] : '—'}</b></div>
            <div className="flex justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><span className="text-[#8A8A96]">Posts this week</span><b className="text-[#16161D]">{wk}</b></div>
            <div className="flex justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><span className="text-[#8A8A96]">Pending approvals</span><b className="text-[#F59E0B]">{pending}</b></div>
            <div className="flex justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><span className="text-[#8A8A96]">Consistency</span><b className="text-[#16161D]">{jobs.length > 0 ? `${Math.round((publishedToday > 0 ? 1 : 0) * 40 + Math.min(60, wk / 7 * 60))}%` : '0%'}</b></div>
          </div>
        </div>
      </motion.div>

      {/* Calendar body */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#16161D]">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
          <span className="text-[0.65rem] text-[#8A8A96]">{filtered.length} post(s) · drag to reschedule · click for details</span>
        </div>

        {view === 'month' && (
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map(d => <div key={d} className="text-center text-[0.6rem] font-bold text-[#8A8A96] uppercase tracking-wider py-1.5">{d}</div>)}
            {monthDays.map((d, i) => {
              const jd = dayJobs(d)
              const inMonth = d.getMonth() === currentDate.getMonth()
              return (
                <div key={i} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, d)} className={`rounded-xl border min-h-[92px] p-1.5 transition-colors ${isToday(d) ? 'border-[#7C3AED] bg-[#7C3AED]/4' : 'border-[#F0F1F5] bg-white'} ${inMonth ? '' : 'opacity-40'}`}>
                  <div className={`text-[0.6rem] font-semibold mb-1 ${isToday(d) ? 'text-[#7C3AED]' : 'text-[#8A8A96]'}`}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {jd.slice(0, 3).map(j => <PostCard key={j.id} j={j} compact />)}
                    {jd.length > 3 && <div className="text-[0.55rem] text-[#7C3AED] font-semibold text-center">+{jd.length - 3} more</div>}
                    {jd.length === 0 && (
                      <div className="text-[0.55rem] text-[#C4C5CE] text-center py-2 rounded-lg border border-dashed border-[#F0F1F5]">Best slot ~{bestHour >= 0 ? `${bestHour}:00` : '9:00'}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'week' && (
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d, i) => {
              const jd = dayJobs(d)
              return (
                <div key={i} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, d)} className={`rounded-xl border min-h-[140px] p-1.5 ${isToday(d) ? 'border-[#7C3AED] bg-[#7C3AED]/4' : 'border-[#F0F1F5]'}`}>
                  <div className={`text-[0.65rem] font-bold mb-1.5 ${isToday(d) ? 'text-[#7C3AED]' : 'text-[#16161D]'}`}>{DAYS[d.getDay()]} {d.getDate()}</div>
                  <div className="space-y-1.5">
                    {jd.map(j => <PostCard key={j.id} j={j} />)}
                    {jd.length === 0 && <div className="text-[0.55rem] text-[#C4C5CE] text-center py-3 rounded-lg border border-dashed border-[#F0F1F5]">Empty — drag a post here</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'day' && (
          <div onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, currentDate)} className="space-y-1.5">
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(h => {
              const jd = dayJobs(currentDate).filter(j => j.scheduled_for && new Date(j.scheduled_for).getHours() === h)
              return (
                <div key={h} className={`flex gap-3 rounded-xl border border-[#F0F1F5] p-2 ${isToday(currentDate) && h === new Date().getHours() ? 'bg-[#7C3AED]/4' : ''}`}>
                  <span className="text-[0.65rem] font-mono text-[#8A8A96] w-12 pt-1 shrink-0">{h}:00</span>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {jd.map(j => <div key={j.id} className="w-72"><PostCard j={j} /></div>)}
                    {jd.length === 0 && <div className="text-[0.55rem] text-[#C4C5CE] py-2">Open slot</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'timeline' && (
          <div className="relative">
            <div className="absolute left-[70px] top-0 bottom-0 w-px bg-[#F0F1F5]" />
            {[...filtered].sort((a, b) => new Date(a.scheduled_for || a.created_at) - new Date(b.scheduled_for || b.created_at)).slice(0, 14).map(j => {
              const d = j.scheduled_for || j.created_at; const p = firstPlatform(j)
              return (
                <div key={j.id} className="relative flex items-center gap-4 py-2.5 group" onClick={() => setSelectedJob(j)}>
                  <span className="text-xs font-mono text-[#8A8A96] w-16 text-right shrink-0">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  <span className="relative z-10 h-3 w-3 rounded-full border-2 border-white shadow-sm shrink-0" style={{ backgroundColor: M[p]?.color }} />
                  <div className="flex items-center gap-2.5 rounded-xl border border-[#EBECF2] px-3 py-2 flex-1 hover:bg-[#F8F9FC] transition-colors cursor-pointer min-w-0">
                    <Icon p={p} size={14} /><span className="text-sm font-semibold" style={{ color: M[p]?.color }}>{M[p]?.label}</span>
                    <span className="text-sm text-[#16161D] truncate flex-1">{j.topic || 'Untitled'}</span>
                    <span className="text-[0.55rem] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: STATUS_COLORS[j.status] + '15', color: STATUS_COLORS[j.status] }}>{j.status}</span>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <div className="text-sm text-[#8A8A96] text-center py-10">Nothing scheduled — create a post in Compose and schedule it.</div>}
          </div>
        )}

        {view === 'agenda' && (
          <div className="space-y-3">
            {[...filtered].sort((a, b) => new Date(a.scheduled_for || a.created_at) - new Date(b.scheduled_for || b.created_at)).slice(0, 20).map(j => (
              <div key={j.id} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-3 hover:bg-[#F8F9FC] transition-colors cursor-pointer" onClick={() => setSelectedJob(j)}>
                <div className="w-24 shrink-0"><div className="text-sm font-bold text-[#16161D]">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}</div><div className="text-[0.6rem] text-[#8A8A96] font-mono">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div></div>
                <Icon p={firstPlatform(j)} size={16} />
                <span className="text-sm font-medium text-[#16161D] truncate flex-1">{j.topic || 'Untitled'}</span>
                <span className="text-[0.55rem] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: STATUS_COLORS[j.status] + '15', color: STATUS_COLORS[j.status] }}>{j.status}</span>
              </div>
            ))}
          </div>
        )}

        {view === 'kanban' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            {['scheduled', 'pending_approval', 'approved', 'draft', 'published', 'failed', 'rejected'].map(s => (
              <div key={s} className="rounded-xl bg-[#FAFAFD] border border-[#F0F1F5] p-2 min-h-[140px]">
                <div className="flex items-center gap-1.5 mb-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                  <span className="text-[0.6rem] font-bold text-[#16161D] uppercase tracking-wider">{s}</span>
                  <span className="text-[0.55rem] text-[#8A8A96] ml-auto">{filtered.filter(j => j.status === s).length}</span>
                </div>
                <div className="space-y-1.5">
                  {filtered.filter(j => j.status === s).slice(0, 5).map(j => <PostCard key={j.id} j={j} compact />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Publishing queue */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F5] flex-wrap gap-2">
          <div className="flex items-center gap-2"><h3 className="text-base font-bold text-[#16161D]">Publishing Queue</h3><span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] font-semibold">{filtered.length}</span></div>
          {selected.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[0.65rem] text-[#8A8A96]">{selected.length} selected</span>
              {[['approve', 'Approve'], ['reject', 'Reject'], ['publish', 'Publish'], ['tomorrow', '+1 Day']].map(([a, l]) => (
                <button key={a} onClick={() => bulk(a)} className="text-[0.6rem] font-bold px-2.5 py-1.5 rounded-lg bg-[#F4F5F9] border border-[#EBECF2] hover:border-[#7C3AED]/40 transition-colors">{l}</button>
              ))}
              <button onClick={() => setSelected([])} className="text-[0.6rem] font-bold px-2.5 py-1.5 rounded-lg text-red-500"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[860px]">
            <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
              <th className="py-2.5 px-4 text-left w-8"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={e => setSelected(e.target.checked ? filtered.map(j => j.id) : [])} className="accent-[#7C3AED]" /></th>
              {['Platform', 'Title', 'Status', 'Scheduled Time', 'Approval', 'Reach Prediction', 'Actions'].map(h => <th key={h} className={`py-2.5 px-3 text-left font-semibold text-[0.58rem] uppercase tracking-wider ${['Scheduled Time', 'Reach Prediction', 'Actions'].includes(h) ? '' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.slice(0, 25).map(j => {
                const p = firstPlatform(j); const pr = priority(j); const a = analyze(jobCaption(j))
                return (
                  <tr key={j.id} className={`border-b border-[#F0F1F5] hover:bg-[#F8F9FC] transition-colors cursor-pointer ${selected.includes(j.id) ? 'bg-[#7C3AED]/5' : ''}`} onClick={() => { const s = j.id; setSelected(sel => sel.includes(s) ? sel.filter(x => x !== s) : [...sel, s]) }}>
                    <td className="py-2.5 px-4"><input type="checkbox" checked={selected.includes(j.id)} onChange={e => { e.stopPropagation(); const s = j.id; setSelected(sel => e.target.checked ? [...sel, s] : sel.filter(x => x !== s)) }} onClick={e => e.stopPropagation()} className="accent-[#7C3AED]" /></td>
                    <td className="py-2.5 px-3"><div className="flex items-center gap-2"><Icon p={p} size={15} /><span className="font-semibold" style={{ color: M[p]?.color }}>{M[p]?.label}</span></div></td>
                    <td className="py-2.5 px-3 max-w-[200px]"><span className="font-medium text-[#16161D] truncate block">{j.topic || 'Untitled'}</span><span className="text-[0.55rem] text-[#8A8A96]">{jobCaption(j).slice(0, 50)}</span></td>
                    <td className="py-2.5 px-3"><span className="font-semibold text-[#7C3AED] px-2 py-0.5 rounded-full text-[0.55rem]" style={{ backgroundColor: STATUS_COLORS[j.status] + '15', color: STATUS_COLORS[j.status] }}>{j.status}</span></td>
                    <td className="py-2.5 px-3 font-mono text-[#8A8A96]">{j.scheduled_for ? new Date(j.scheduled_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td className="py-2.5 px-3"><span className={`text-[0.55rem] px-2 py-0.5 rounded-full font-semibold ${j.status === 'approved' ? 'bg-emerald-50 text-[#0EA37A]' : j.status === 'pending_approval' ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{j.status === 'pending_approval' ? 'Pending' : j.status === 'approved' ? 'Approved' : '—'}</span></td>
                    <td className="py-2.5 px-3"><span className="font-mono font-semibold text-[#16161D]">~{fmt(reachPred(j))}</span><span className="text-[0.55rem] text-[#8A8A96]"> · AI {a.quality}</span></td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {j.status !== 'published' && <button onClick={() => publish(j)} className="h-7 w-7 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center hover:opacity-85" title="Publish">{publishing === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}</button>}
                        {j.status === 'pending_approval' && <button onClick={() => approve(j)} className="h-7 w-7 rounded-lg bg-[#0EA37A]/10 text-[#0EA37A] flex items-center justify-center hover:bg-[#0EA37A]/20" title="Approve"><Check className="h-3 w-3" /></button>}
                        <button onClick={() => copyLink(j)} className="h-7 w-7 rounded-lg bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE] text-[#8A8A96] hover:text-[#7C3AED]" title="Copy link"><LinkIcon className="h-3 w-3" /></button>
                        <button onClick={() => setSelectedJob(j)} className="h-7 w-7 rounded-lg bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE] text-[#8A8A96] hover:text-[#7C3AED]" title="Details"><Eye className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-[#8A8A96]">No posts match the current filters.</div>}
        </div>
      </motion.div>

      {/* Right drawer */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-white z-50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F1F5]">
              <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Eye className="h-4 w-4 text-white" /></div><h3 className="text-base font-bold text-[#16161D]">Post Details</h3></div>
              <button onClick={() => setSelectedJob(null)} className="h-8 w-8 rounded-full bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE]"><X className="h-4 w-4 text-[#8A8A96]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {jobPlatforms(selectedJob).map(p => <span key={p} className="flex items-center gap-1.5 text-[0.65rem] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: M[p]?.bg, color: M[p]?.color }}><Icon p={p} size={11} />{M[p]?.label}</span>)}
              </div>
              <div className="rounded-xl border border-[#EBECF2] p-3.5 bg-[#FAFAFD]">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1.5">Caption preview</div>
                <p className="text-xs text-[#16161D] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{jobCaption(selectedJob)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 text-center"><div className="text-base font-bold text-[#7C3AED]">{analyze(jobCaption(selectedJob)).quality}</div><div className="text-[0.5rem] text-[#8A8A96] uppercase">AI score</div></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 text-center"><div className="text-base font-bold text-[#3B82F6]">{analyze(jobCaption(selectedJob)).seo}</div><div className="text-[0.5rem] text-[#8A8A96] uppercase">SEO</div></div>
                <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 text-center"><div className="text-base font-bold text-[#0EA37A]">~{fmt(reachPred(selectedJob))}</div><div className="text-[0.5rem] text-[#8A8A96] uppercase">Reach</div></div>
              </div>
              <div className="rounded-xl border border-[#EBECF2] p-3">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Hashtags & mentions</div>
                <div className="flex flex-wrap gap-1.5">
                  {jobPlatforms(selectedJob).flatMap(p => selectedJob.platform_posts?.[p]?.hashtags || []).slice(0, 10).map((t, i) => <span key={i} className="text-[0.65rem] text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2 py-0.5 rounded-full">{t}</span>)}
                  {jobPlatforms(selectedJob).flatMap(p => selectedJob.platform_posts?.[p]?.hashtags || []).length === 0 && <span className="text-[0.65rem] text-[#8A8A96]">None</span>}
                </div>
              </div>
              <div className="rounded-xl border border-[#EBECF2] p-3">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Publishing history</div>
                <div className="space-y-1.5 text-[0.65rem]">
                  <div className="flex justify-between"><span className="text-[#8A8A96]">Created</span><span className="text-[#16161D] font-mono">{selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[#8A8A96]">Scheduled</span><span className="text-[#16161D] font-mono">{selectedJob.scheduled_for ? new Date(selectedJob.scheduled_for).toLocaleString() : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[#8A8A96]">Published</span><span className="text-[#16161D] font-mono">{selectedJob.published_at ? new Date(selectedJob.published_at).toLocaleString() : 'Not yet'}</span></div>
                  <div className="flex justify-between"><span className="text-[#8A8A96]">Status</span><span className="text-[#16161D] font-bold" style={{ color: STATUS_COLORS[selectedJob.status] }}>{selectedJob.status}</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-[#EBECF2] p-3 bg-[#F8F9FC]">
                <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-[#EC4899]" /> AI suggestions</div>
                <div className="space-y-1.5 text-[0.7rem] text-[#16161D]">
                  <div>• {analyze(jobCaption(selectedJob)).ctaScore < 50 ? 'Add a clear CTA to lift engagement.' : 'CTA is strong — keep it.'}</div>
                  <div>• {analyze(jobCaption(selectedJob)).hashtagCount === 0 ? 'Add 5–8 hashtags for discovery.' : 'Hashtag mix looks balanced.'}</div>
                  <div>• Best time window: {bestHour >= 0 ? `${bestHour}:00` : '9:00'} · {DAYS[bestDay >= 0 ? bestDay : 3]}</div>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[#F0F1F5] space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {selectedJob.status !== 'published' && <button onClick={() => { publish(selectedJob); setSelectedJob(null) }} className="py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]"><Send className="h-3.5 w-3.5 inline mr-1.5" />Publish</button>}
                {selectedJob.status === 'pending_approval' && <button onClick={() => { approve(selectedJob); setSelectedJob(null) }} className="py-2.5 rounded-xl text-sm font-bold bg-[#0EA37A] text-white"><Check className="h-3.5 w-3.5 inline mr-1.5" />Approve</button>}
                {selectedJob.status === 'pending_approval' && <button onClick={() => { reject(selectedJob); setSelectedJob(null) }} className="py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500"><X className="h-3.5 w-3.5 inline mr-1.5" />Reject</button>}
                <button onClick={() => sendTG(selectedJob)} className="py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2]"><MessageSquare className="h-3.5 w-3.5 inline mr-1.5 text-[#3B82F6]" />Telegram</button>
                <button onClick={() => copyLink(selectedJob)} className="py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2]"><LinkIcon className="h-3.5 w-3.5 inline mr-1.5 text-[#7C3AED]" />Share link</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { duplicate(selectedJob); setSelectedJob(null) }} className="py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2]"><Copy className="h-3 w-3 inline mr-1 text-[#0EA37A]" />Duplicate</button>
                <button onClick={() => pin(selectedJob)} className="py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2]"><Star className={`h-3 w-3 inline mr-1 ${selectedJob.pinned ? 'text-amber-400 fill-current' : 'text-[#8A8A96]'}`} />{selectedJob.pinned ? 'Pinned' : 'Pin'}</button>
                <button onClick={() => { del(selectedJob); setSelectedJob(null) }} className="py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-500"><Trash2 className="h-3 w-3 inline mr-1" />Delete</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Assistant */}
      <AnimatePresence>
        {assistantOpen && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} className="fixed bottom-24 right-6 z-50 w-[340px] rounded-3xl bg-white shadow-2xl border border-[#EBECF2] overflow-hidden">
            <div className="bg-gradient-to-r from-[#1A1037] to-[#4C1D63] px-4 py-3 flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#C4B5FD]" /><h4 className="text-sm font-bold text-white">AI Scheduling Assistant</h4>
              <button onClick={() => setAssistantOpen(false)} className="ml-auto text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-2">
              {[
                { l: 'Find empty publishing slots', a: () => { const empty = weekDays.filter(d => dayJobs(d).length === 0); setView('week'); setCurrentDate(new Date()); toast.info(empty.length ? `Switched to Week view — open slots: ${empty.map(d => d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')}` : 'No empty days this week — full schedule!') } },
                { l: 'Balance platform distribution', a: () => { const worst = Object.entries(platCounts).sort((a, b) => a[1] - b[1])[0]; toast.success(worst ? `Most underused: ${M[worst[0]]?.label} — schedule more there. Opening Analytics.` : 'No posts yet'); setTimeout(() => { window.location.href = '/analytics' }, 1200) } },
                { l: 'Optimize this week', a: () => autoSchedule(7) },
                { l: 'Move all Instagram to evening', a: () => { let n = 0; jobs.filter(j => jobPlatforms(j).includes('instagram') && j.status === 'scheduled' && j.scheduled_for).forEach(async (j) => { const d = new Date(j.scheduled_for); d.setHours(19, 0, 0, 0); try { await api(`/jobs/${j.id}`, { method: 'PUT', body: { scheduled_for: d.toISOString() } }); n++ } catch {} }); setTimeout(() => { toast.success(`Moved ${n} Instagram posts to 7 PM`); refresh() }, 800) } },
                { l: 'Schedule all drafts', a: () => { let n = 0; jobs.filter(j => j.status === 'draft').slice(0, 8).forEach(async (j) => { const d = new Date(Date.now() + (n + 1) * 864e5); d.setHours(10, 0, 0, 0); try { await api(`/jobs/${j.id}`, { method: 'PUT', body: { status: 'scheduled', scheduled_for: d.toISOString() } }); n++ } catch {} }); setTimeout(() => { toast.success(`Scheduled ${n} draft(s) — one per day at 10 AM`); refresh() }, 800) } },
              ].map((c, i) => (
                <button key={i} onClick={c.a} className="w-full text-left text-[0.7rem] font-medium rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />{c.l}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setAssistantOpen(v => !v)} className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] shadow-xl shadow-[#7C3AED]/30 flex items-center justify-center">
        {assistantOpen ? <X className="h-6 w-6 text-white" /> : <Bot className="h-6 w-6 text-white" />}
      </motion.button>
    </div>
  )
}
