'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, Search, Bell, Check, X, Filter, Inbox, Mail, Send, AlertTriangle, Newspaper, Sun, Sparkles, Radio, FileText, LayoutDashboard, CheckCircle, Clock, ListChecks, Bot } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'
import { CommCard, AssistantPanel, TimelinePanel, RulesPanel, BriefPanel, EmptyInbox } from './components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const now = () => new Date().toISOString()

export default function CommCenterPage() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [blogPosts, setBlogPosts] = useState([])
  const [news, setNews] = useState([])
  const [seasonal, setSeasonal] = useState([])
  const [audit, setAudit] = useState([])
  const [auto, setAuto] = useState({})
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [readState, setReadState] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_comm_read')) || {} } catch { return {} } })
  const [rules, setRules] = useState(() => ({ ...{ channel: 'dashboard', breaking: true, seasonal: true, approvals: true, published: true, failed: true, reports: false }, ...(JSON.parse(localStorage.getItem('sf_comm_rules') || '{}')) }))
  const [brief, setBrief] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_comm_brief')) || null } catch { return null } })
  const [busy, setBusy] = useState(null)

  useEffect(() => { localStorage.setItem('sf_comm_rules', JSON.stringify(rules)) }, [rules])

  const refresh = async () => {
    setLoading(true)
    try {
      const [j, b, n, s, a, am] = await Promise.all([
        api('/jobs').catch(() => []), api('/blog/posts').catch(() => []),
        api('/news/all').catch(() => []), api('/seasonal').catch(() => []),
        api('/audit?limit=60').catch(() => []), api('/automation-stats').catch(() => ({})),
      ])
      setJobs(j || []); setBlogPosts(b || []); setNews(n || []); setSeasonal(s || []); setAudit(a || []); setAuto(am || {})
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const markRead = (id) => { const r = { ...readState, [id]: true }; setReadState(r); localStorage.setItem('sf_comm_read', JSON.stringify(r)) }

  const buildItems = () => {
    const items = []
    const t = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    // News
    news.forEach(n => {
      const pending = n.status === 'pending_approval' || n.status === 'approved' || n.status === 'ai_generated'
      items.push({
        id: `news_${n.id}`, type: 'news', source: 'News Radar', emoji: '📰', emojiBg: 'bg-[#EF4444]/10',
        title: n.title || 'Untitled headline', summary: n.summary || `Detected from ${n.source_name || 'monitored source'} — AI can generate platform content.`,
        status: n.status === 'new' ? 'new' : n.status === 'published' ? 'published' : pending ? 'pending_approval' : n.status,
        priority: n.is_urgent ? 'High' : n.is_trending ? 'Medium' : 'Low',
        time: t(n.published_at || n.created_at), href: '/news', canGenerate: n.status === 'new',
        platforms: ['LinkedIn', 'Instagram', 'Blog', 'Newsletter'], draft: n.generated_posts?.linkedin?.caption || '',
        unread: !readState[`news_${n.id}`], refId: n.id, kind: 'news',
      })
    })
    // Seasonal
    seasonal.forEach(s => {
      items.push({
        id: `seasonal_${s.id}`, type: 'seasonal', source: 'Seasonal Engine', emoji: s.emoji || '🎉', emojiBg: 'bg-[#F59E0B]/10',
        title: `${s.event_name} — campaign content ready`, summary: `${Object.keys(s.platform_posts || {}).length} platform drafts · ${s.event_type} · ${s.event_month}/${s.event_day}`,
        status: s.status, priority: s.status === 'pending_approval' ? 'High' : 'Medium',
        time: t(s.created_at), href: '/seasonal', canGenerate: false,
        platforms: Object.keys(s.platform_posts || {}).map(p => p.charAt(0).toUpperCase() + p.slice(1)),
        draft: Object.values(s.platform_posts || {})[0]?.caption || '', unread: !readState[`seasonal_${s.id}`], refId: s.id, kind: 'seasonal',
      })
    })
    // Social jobs
    jobs.forEach(j => {
      const plats = Object.keys(j.platform_posts || {})
      items.push({
        id: `job_${j.id}`, type: 'social', source: 'Social Automation', emoji: '📱', emojiBg: 'bg-[#7C3AED]/10',
        title: j.topic || 'Social post', summary: plats.length ? `${plats.length} platform(s): ${plats.join(', ')}` : 'Draft content',
        status: j.status === 'pending_approval' ? 'pending_approval' : j.status, priority: j.status === 'failed' ? 'High' : j.status === 'pending_approval' ? 'Medium' : 'Low',
        time: t(j.scheduled_for || j.created_at), href: '/calendar', canGenerate: false,
        platforms: plats.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
        draft: j.platform_posts?.[plats[0]]?.caption || '', unread: !readState[`job_${j.id}`], refId: j.id, kind: 'social',
      })
    })
    // Blogs
    blogPosts.forEach(b => {
      items.push({
        id: `blog_${b.id}`, type: 'blog', source: 'Blog Studio', emoji: '📝', emojiBg: 'bg-[#0EA37A]/10',
        title: b.title || 'Blog article', summary: (b.seo_description || '').slice(0, 140) || `${b.status} article — ready for review`,
        status: b.status === 'pending_approval' ? 'pending_approval' : b.status, priority: b.status === 'published' ? 'Low' : 'Medium',
        time: t(b.created_at), href: '/blog', canGenerate: false,
        platforms: ['Blog', 'LinkedIn', 'Newsletter'], draft: (b.body_markdown || '').slice(0, 300),
        unread: !readState[`blog_${b.id}`], refId: b.id, kind: 'blog',
      })
    })
    // Audit → system events
    audit.forEach(a => {
      const failed = a.new_status === 'failed' || /fail|error/i.test(a.action || '')
      items.push({
        id: `audit_${a.id}_${a.performed_at}`, type: failed ? 'error' : 'system', source: 'System', emoji: failed ? '⚠️' : '🤖', emojiBg: failed ? 'bg-red-50' : 'bg-[#8B5CF6]/10',
        title: (a.action || 'event').replace(/_/g, ' '), summary: `${a.entity || 'system'} · ${a.new_status || 'updated'}`,
        status: failed ? 'failed' : 'done', priority: failed ? 'High' : 'Low',
        time: t(a.performed_at), href: null, canGenerate: false, platforms: [],
        draft: '', unread: !readState[`audit_${a.id}_${a.performed_at}`], refId: a.id, kind: 'system',
      })
    })
    return items.sort((a, b) => new Date(b.time && b.time !== '—' ? b.time : 0) - 0)
  }

  const allItems = useMemo(buildItems, [jobs, blogPosts, news, seasonal, audit])
  const sorted = [...allItems].sort((a, b) => (a.unread === b.unread ? 0 : a.unread ? -1 : 1))

  const filtered = sorted.filter(it => {
    if (tab !== 'all' && it.type !== tab && !(tab === 'approvals' && it.status === 'pending_approval') && !(tab === 'completed' && it.status === 'published')) return false
    if (search && !(it.title + ' ' + it.summary + ' ' + it.source).toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'high' && it.priority !== 'High') return false
    if (filter === 'unread' && !it.unread) return false
    if (filter === 'today' && !it.time) return false
    return true
  })

  const unread = sorted.filter(i => i.unread).length
  useEffect(() => { try { localStorage.setItem('sf_comm_unread_count', String(unread)) } catch {} }, [unread])
  const pendingApprovals = sorted.filter(i => i.status === 'pending_approval').length
  const failed = sorted.filter(i => i.status === 'failed' || i.type === 'error').length
  const newsAlerts = sorted.filter(i => i.type === 'news').length
  const seasonalCount = sorted.filter(i => i.type === 'seasonal').length
  const kpis = [
    { l: 'Unread', v: fmt(unread), c: '#7C3AED' },
    { l: 'Approvals Pending', v: fmt(pendingApprovals), c: '#F59E0B' },
    { l: 'News Alerts', v: fmt(newsAlerts), c: '#EF4444' },
    { l: 'Seasonal Campaigns', v: fmt(seasonalCount), c: '#F97316' },
    { l: 'Social Posts', v: fmt(sorted.filter(i => i.type === 'social').length), c: '#3B82F6' },
    { l: 'Blogs', v: fmt(sorted.filter(i => i.type === 'blog').length), c: '#0EA37A' },
    { l: 'Failed / Errors', v: fmt(failed), c: '#EF4444' },
    { l: 'System Events', v: fmt(sorted.filter(i => i.type === 'system').length), c: '#8B5CF6' },
  ]

  const doAction = async (action, item) => {
    setBusy(item.id)
    try {
      if (action === 'approve') {
        if (item.kind === 'news') await api('/news/' + item.refId, { method: 'PUT', body: { status: 'approved' } })
        else if (item.kind === 'seasonal') await api('/seasonal/' + item.refId, { method: 'PUT', body: { status: 'approved' } })
        else await api('/jobs/' + item.refId, { method: 'PUT', body: { status: 'approved' } })
        toast.success('Approved')
      } else if (action === 'reject') {
        if (item.kind === 'news') await api('/news/' + item.refId, { method: 'PUT', body: { status: 'rejected' } })
        else if (item.kind === 'seasonal') await api('/seasonal/' + item.refId, { method: 'PUT', body: { status: 'rejected' } })
        else await api('/jobs/' + item.refId, { method: 'PUT', body: { status: 'rejected' } })
        toast.success('Rejected')
      } else if (action === 'schedule') {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
        if (item.kind === 'news') await api('/news/' + item.refId, { method: 'PUT', body: { status: 'scheduled', scheduled_for: d.toISOString() } })
        else if (item.kind === 'seasonal') await api('/seasonal/' + item.refId, { method: 'PUT', body: { status: 'scheduled', scheduled_for: d.toISOString() } })
        else if (item.kind === 'blog') await api('/blog/posts/' + item.refId, { method: 'PUT', body: { status: 'scheduled', scheduled_for: d.toISOString() } })
        else await api('/jobs/' + item.refId, { method: 'PUT', body: { status: 'scheduled', scheduled_for: d.toISOString() } })
        toast.success('Scheduled for tomorrow 10 AM')
      } else if (action === 'publish') {
        if (item.kind === 'news') { const r = await api('/news/publish', { method: 'POST', body: { news_id: item.refId } }); if (r.results?.some(x => x.ok)) toast.success('Published'); else toast.error('Publish failed') }
        else if (item.kind === 'seasonal') { await api('/seasonal/' + item.refId, { method: 'PUT', body: { status: 'published' } }); toast.success('Published') }
        else if (item.kind === 'blog') { await api('/blog/publish/' + item.refId, { method: 'POST', body: {} }); toast.success('Published to INSIGHTS') }
        else { await api('/publish/' + item.refId, { method: 'POST', body: {} }); toast.success('Publishing started') }
      } else if (action === 'generate') {
        if (item.kind === 'news') await api('/news/generate', { method: 'POST', body: { news_id: item.refId } })
        toast.success('AI content generated')
      }
      markRead(item.id)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  const generateBrief = (type) => {
    const today = new Date().toDateString()
    const todaysNews = news.filter(n => new Date(n.created_at || n.published_at || 0).toDateString() === today).length
    const publishedToday = jobs.filter(j => (j.published_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length
    const lines = type === 'morning'
      ? [`Good Morning! Here's today's plan:`, '', `• ${seasonal.length} seasonal campaign(s) in queue`, `• ${todaysNews} breaking news item(s) detected`, `• ${pendingApprovals} approval(s) waiting`, `• ${publishedToday} post(s) already published`, `• Blog scheduled at 10:00 AM`, '', `Recommended posting window: 9-11 AM & 7-9 PM`]
      : [`Evening report — today's performance:`, '', `• Posts published: ${publishedToday}`, `• Approvals processed: ${pendingApprovals}`, `• News detected: ${todaysNews}`, `• Tomorrow: ${seasonal.filter(s => s.status === 'scheduled').length} scheduled campaign(s)`, '', `Recommendation: review tomorrow's queue and approve early.`]
    const b = { type, text: lines.join('\n'), at: now() }
    setBrief(b); localStorage.setItem('sf_comm_brief', JSON.stringify(b))
  }

  const timeline = audit.slice(0, 12).map(a => ({ label: (a.action || 'event').replace(/_/g, ' '), time: a.performed_at ? new Date(a.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', failed: a.new_status === 'failed', ok: a.new_status === 'published' || a.new_status === 'approved' }))

  const tabs = [['all', 'All'], ['approvals', 'Approvals'], ['news', 'News Radar'], ['seasonal', 'Seasonal'], ['social', 'Social Posts'], ['blog', 'Blogs'], ['system', 'System'], ['error', 'Errors'], ['completed', 'Completed']]

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading Communication Center…</div>

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/25"><Inbox className="h-5 w-5 text-white" /></div>
          <div><h1 className="text-xl font-bold text-[#16161D] tracking-tight">Communication Center</h1><p className="text-sm text-[#8A8A96]">Every AI event in one inbox — Telegram & WhatsApp are just delivery channels now.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[0.65rem] font-semibold px-3 py-2 rounded-xl bg-[#7C3AED]/8 text-[#7C3AED] border border-[#D8C8FB]"><Bell className="h-3.5 w-3.5" /> Delivery: {rules.channel === 'dashboard' ? 'Dashboard only' : rules.channel === 'telegram' ? 'Telegram + Dashboard' : rules.channel === 'whatsapp' ? 'WhatsApp + Dashboard' : 'Email (future)'}</span>
          <button onClick={refresh} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><RefreshCw className="h-4 w-4 text-[#8A8A96]" /></button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={{ animate: { transition: { staggerChildren: 0.04 } } }} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(k => (
          <motion.div key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer`} onClick={() => { if (k.l === 'Unread') setFilter(f => f === 'unread' ? 'all' : 'unread'); if (k.l === 'Approvals Pending') setTab('approvals'); if (k.l === 'News Alerts') setTab('news'); if (k.l === 'Seasonal Campaigns') setTab('seasonal'); if (k.l === 'Failed / Errors') setTab('error') }}>
            <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-[#8A8A96]">{k.l}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.c }}>{k.v}</div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* ============ INBOX ============ */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-3.5 flex items-center gap-2 flex-wrap`}>
            <div className="flex gap-1 overflow-x-auto max-w-full pb-0.5">
              {tabs.map(([k, l]) => {
                const count = k === 'all' ? sorted.length : k === 'approvals' ? pendingApprovals : k === 'news' ? newsAlerts : k === 'seasonal' ? seasonalCount : k === 'error' ? failed : k === 'completed' ? sorted.filter(i => i.status === 'published').length : sorted.filter(i => i.type === k).length
                return (
                  <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${tab === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white shadow-md' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{l} <span className="opacity-70">({count})</span></button>
                )
              })}
            </div>
            <div className="flex-1 min-w-[160px] flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search inbox…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">
              <option value="all">All items</option><option value="high">High priority</option><option value="unread">Unread</option><option value="today">Today</option>
            </select>
            {unread > 0 && <button onClick={() => { const r = {}; sorted.forEach(i => r[i.id] = true); setReadState(r); localStorage.setItem('sf_comm_read', JSON.stringify(r)) }} className="text-[0.6rem] font-bold px-3 py-2 rounded-xl bg-[#F4F5F9] text-[#8A8A96] hover:text-[#7C3AED]">Mark all read</button>}
          </motion.div>

          {filtered.length === 0 ? <EmptyInbox /> : (
            <div className="space-y-3">
              {filtered.slice(0, 40).map(item => <CommCard key={item.id} item={item} onAction={doAction} busy={busy === item.id} />)}
              {filtered.length > 40 && <div className="text-center text-[0.7rem] text-[#8A8A96] py-3">Showing 40 of {filtered.length} — refine filters to narrow down</div>}
            </div>
          )}
        </div>

        {/* ============ RIGHT PANEL ============ */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AssistantPanel brief={{ pending: pendingApprovals, best: seasonal[0]?.event_name || null }} events={{ today: seasonal, tomorrow: [] }} news={news} /></motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><BriefPanel onGenerate={generateBrief} brief={brief} /></motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><TimelinePanel events={timeline} /></motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><RulesPanel rules={rules} setRules={setRules} /></motion.div>
        </div>
      </div>
    </div>
  )
}
