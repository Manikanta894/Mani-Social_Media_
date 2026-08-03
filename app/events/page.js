'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw, Radio, Zap, CheckCircle, XCircle, Activity, Globe, Plus, Trash2, Power, RotateCcw, Eye, Clock, AlertTriangle, Bot, Filter, Search, ShieldCheck } from 'lucide-react'
import { api } from '@/components/shared'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const TYPE_COLORS = {
  post_published: '#0EA37A', post_failed: '#EF4444', breaking_news: '#EF4444', campaign_generated: '#F97316',
  campaign_ready: '#F59E0B', dashboard_approved: '#3B82F6', blog_published: '#0EA37A', ai_generation_failed: '#EF4444',
  workflow_failed: '#EF4444', workflow_completed: '#0EA37A', ai_generation_completed: '#7C3AED', followers_updated: '#14B8A6',
}
const PROVIDERS = ['linkedin', 'facebook', 'instagram', 'threads', 'youtube', 'wordpress', 'ghost', 'telegram', 'whatsapp', 'rss', 'google_alerts', 'news_api', 'email', 'custom']

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [hookForm, setHookForm] = useState({ provider: 'telegram', endpoint: '', secret: '' })

  const refresh = async () => {
    setLoading(true)
    try {
      const [e, s, w] = await Promise.all([
        api('/events?limit=100').catch(() => []),
        api('/events/stats').catch(() => ({})),
        api('/events/webhooks').catch(() => []),
      ])
      setEvents(e || []); setStats(s || {}); setWebhooks(w || [])
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { const iv = setInterval(() => { api('/events?limit=50').then(setEvents).catch(() => {}) }, 15000); return () => clearInterval(iv) }, [])

  const addHook = async () => {
    if (!hookForm.provider) return toast.error('Choose a provider')
    try {
      const endpoint = hookForm.endpoint || `${window.location.origin}/api/events/webhook/${hookForm.provider}`
      await api('/events/webhooks', { method: 'POST', body: { provider: hookForm.provider, endpoint, secret: hookForm.secret || null, max_retries: 5 } })
      toast.success('Webhook registered')
      setShowAdd(false); setHookForm({ provider: 'telegram', endpoint: '', secret: '' }); refresh()
    } catch (e) { toast.error(e.message) }
  }
  const toggleHook = async (h) => { try { await api(`/events/webhooks/${h.id}`, { method: 'PUT', body: { enabled: !h.enabled } }); refresh() } catch (e) { toast.error(e.message) } }
  const delHook = async (id) => { try { await api(`/events/webhooks/${id}`, { method: 'DELETE' }); refresh() } catch (e) { toast.error(e.message) } }
  const testHook = async (h) => { try { await api(`/events/webhook/${h.provider}`, { method: 'POST', body: { event_type: 'workflow_completed', payload: { note: 'test' } } }); toast.success('Test event delivered'); refresh() } catch (e) { toast.error(e.message) } }
  const retry = async (id) => { try { const r = await api(`/events/retry/${id}`, { method: 'POST' }); toast.success(r.retried ? 'Event re-emitted' : 'Event not found'); refresh() } catch (e) { toast.error(e.message) } }

  const filtered = events.filter(e => (!typeFilter || e.type === typeFilter) && (!search || (e.type + ' ' + (e.source || '') + ' ' + JSON.stringify(e.payload || {})).toLowerCase().includes(search.toLowerCase())))

  const topTypes = Object.entries(stats?.byType || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const kpis = [
    { l: 'Events (30d)', v: fmt(stats?.total || events.length), c: '#7C3AED' },
    { l: 'Today', v: fmt(stats?.today || 0), c: '#3B82F6' },
    { l: 'Published', v: fmt(stats?.published || 0), c: '#0EA37A' },
    { l: 'Failed', v: fmt(stats?.failed || 0), c: '#EF4444' },
    { l: 'Webhooks', v: fmt(webhooks.length), c: '#F59E0B' },
    { l: 'Active hooks', v: fmt(webhooks.filter(h => h.enabled).length), c: '#0EA37A' },
    { l: 'Last hour', v: fmt(stats?.lastHour?.length || 0), c: '#EC4899' },
    { l: 'Retry schedule', v: '1-5-15-30-60m', c: '#14B8A6' },
  ]

  if (loading) return <div className="flex items-center justify-center py-24 gap-2 text-[#8A8A96]"><Loader2 className="h-5 w-5 animate-spin" /> Loading Event Engine…</div>

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#3B82F6]/25 relative"><Radio className="h-5 w-5 text-white" /><span className="absolute -top-1 -right-1 h-3 w-3"><span className="absolute inset-0 rounded-full bg-[#0EA37A] animate-ping" /><span className="absolute inset-0 rounded-full bg-[#0EA37A]" /></span></div>
          <div><h1 className="text-xl font-bold text-[#16161D] tracking-tight">Event Engine</h1><p className="text-sm text-[#8A8A96]">Real-time event bus — every platform event captured, normalized, routed and acted upon.</p></div>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><RefreshCw className="h-4 w-4 text-[#8A8A96]" /></button>
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

      {/* Pipeline */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
        <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-[#3B82F6]" /> Event pipeline</h4>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['Incoming Webhook', 'Verification', 'Auth', 'Validation', 'Normalization', 'Queue', 'Processing', 'AI Analysis', 'Notification', 'Database', 'Dashboard'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`text-[0.6rem] font-bold px-2.5 py-1.5 rounded-lg ${i < 8 ? 'bg-gradient-to-r from-[#3B82F6]/10 to-[#EC4899]/10 text-[#3B82F6] border border-[#3B82F6]/20' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{s}</span>
              {i < 10 && <span className="text-[#C4C5CE] text-[0.6rem]">→</span>}
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* ============ REAL-TIME FEED ============ */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-3.5 flex items-center gap-2 flex-wrap`}>
            <div className="flex gap-1 overflow-x-auto max-w-full pb-0.5">
              <button onClick={() => setTypeFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${!typeFilter ? 'bg-gradient-to-r from-[#3B82F6] to-[#EC4899] text-white' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>All</button>
              {Object.entries(stats?.byType || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, c]) => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${typeFilter === t ? 'bg-gradient-to-r from-[#3B82F6] to-[#EC4899] text-white' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{t} ({c})</button>
              ))}
            </div>
            <div className="flex-1 min-w-[150px] flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…" className="flex-1 bg-transparent text-xs focus:outline-none" />
            </div>
            <span className="text-[0.6rem] font-semibold text-[#0EA37A] flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#0EA37A] animate-pulse" /> Live</span>
          </motion.div>

          {filtered.length === 0 ? (
            <div className={`${C} p-14 text-center`}>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-[#EC4899]/10 flex items-center justify-center mb-4"><Activity className="h-6 w-6 text-[#3B82F6]" /></div>
              <h3 className="text-base font-bold text-[#16161D]">No events yet</h3>
              <p className="text-sm text-[#8A8A96] mt-1.5 max-w-sm mx-auto">Events appear here the moment they happen — publishing, approvals, news, seasonal, AI workflows, webhooks.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.slice(0, 40).map((e, i) => {
                const c = TYPE_COLORS[e.type] || (e.priority === 'high' ? '#EF4444' : '#7C3AED')
                return (
                  <motion.div key={e.event_id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }} className={`${C} p-3.5 hover:shadow-[0_8px_24px_rgba(124,58,237,0.08)] transition-all ${e.priority === 'high' ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c + '15', color: c }}><Bot className="h-3 w-3" /></span>
                      <span className="text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: c }}>{e.type}</span>
                      <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#F4F5F9] text-[#8A8A96]">{e.source || 'system'}</span>
                      {e.platform && <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED]">{e.platform}</span>}
                      <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${e.priority === 'high' ? 'bg-red-50 text-red-500' : e.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{e.priority}</span>
                      <span className="ml-auto text-[0.55rem] font-mono text-[#8A8A96]">{e.timestamp ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
                      <button onClick={() => retry(e.event_id)} className="text-[0.55rem] font-bold text-[#7C3AED] hover:underline flex items-center gap-0.5"><RotateCcw className="h-2.5 w-2.5" />Retry</button>
                    </div>
                    {Object.keys(e.payload || {}).length > 0 && <div className="text-[0.65rem] text-[#8A8A96] leading-relaxed truncate">{JSON.stringify(e.payload).slice(0, 160)}</div>}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* ============ RIGHT: WEBHOOKS + TYPES ============ */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#16161D] flex items-center gap-2"><Globe className="h-4 w-4 text-[#3B82F6]" /> Webhook Management</h4>
              <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-[0.65rem] font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#EC4899] text-white"><Plus className="h-3 w-3" /> Add</button>
            </div>
            <AnimatePresence>
              {showAdd && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2 mb-3 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-3">
                    <select value={hookForm.provider} onChange={e => setHookForm({ ...hookForm, provider: e.target.value })} className="w-full rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">
                      {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input value={hookForm.endpoint} onChange={e => setHookForm({ ...hookForm, endpoint: e.target.value })} placeholder="Endpoint URL (auto-filled if empty)" className="w-full rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs" />
                    <input value={hookForm.secret} onChange={e => setHookForm({ ...hookForm, secret: e.target.value })} placeholder="Webhook secret (optional)" className="w-full rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs" />
                    <button onClick={addHook} className="w-full py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#3B82F6] to-[#EC4899]">Register webhook</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-2">
              {webhooks.length === 0 && <div className="text-[0.7rem] text-[#8A8A96] text-center py-4">No webhooks registered — add one to receive external events.</div>}
              {webhooks.map(h => (
                <div key={h.id} className="rounded-xl border border-[#EBECF2] p-2.5 bg-[#FAFAFD]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center ${h.enabled ? 'bg-[#0EA37A]/15 text-[#0EA37A]' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}><Power className="h-3 w-3" /></span>
                    <span className="text-[0.7rem] font-bold text-[#16161D] capitalize">{h.provider}</span>
                    <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${h.enabled ? 'bg-emerald-50 text-[#0EA37A]' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{h.enabled ? 'ENABLED' : 'DISABLED'}</span>
                    <span className="ml-auto text-[0.55rem] font-mono text-[#8A8A96]">{h.success_rate ?? 100}% success</span>
                  </div>
                  <div className="text-[0.55rem] text-[#8A8A96] truncate mb-1.5">{h.endpoint || `/api/events/webhook/${h.provider}`} · {(h.deliveries || 0)} deliveries · retries 1/5/15/30/60m</div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggleHook(h)} className={`text-[0.6rem] font-bold px-2 py-1 rounded-lg ${h.enabled ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-[#0EA37A]'}`}>{h.enabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => testHook(h)} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-[#F4F5F9] text-[#8A8A96]">Test</button>
                    <button onClick={() => delHook(h.id)} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-red-50 text-red-500"><Trash2 className="h-3 w-3 inline" /></button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
            <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-[#EC4899]" /> Event types by volume</h4>
            <div className="space-y-2">
              {topTypes.map(([t, c]) => {
                const max = Math.max(...topTypes.map(x => x[1]), 1)
                const col = TYPE_COLORS[t] || '#7C3AED'
                return (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-[0.6rem] font-semibold text-[#16161D] w-32 truncate">{t}</span>
                    <div className="flex-1 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c / max) * 100}%`, backgroundColor: col }} /></div>
                    <span className="text-[0.6rem] font-mono text-[#8A8A96] w-6 text-right">{c}</span>
                  </div>
                )
              })}
              {topTypes.length === 0 && <div className="text-[0.7rem] text-[#8A8A96] text-center py-3">Event volume appears as events flow in.</div>}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${C} p-4`}>
            <h4 className="text-sm font-bold text-[#16161D] mb-2.5 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#0EA37A]" /> Event pipeline status</h4>
            <div className="space-y-1.5">
              {[['Webhook intake', 'active'], ['Verification & auth', 'active'], ['Normalization', 'active'], ['AI routing', 'active'], ['Telegram notifications', 'active'], ['Dashboard feed', 'active']].map(([l, s]) => (
                <div key={l} className="flex items-center justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2">
                  <span className="text-[0.7rem] font-medium text-[#16161D]">{l}</span>
                  <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#0EA37A]">{s}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
