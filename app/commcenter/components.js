'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Send, Clock, Wand2, ExternalLink, Pencil, Sparkles, Bot, CalendarDays, TrendingUp, Newspaper, ListChecks, Bell, Settings2, Sun, Moon, Star, Zap, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'

export const STATUS_META = {
  published: { label: 'Published', color: '#0EA37A', bg: 'bg-emerald-50 text-[#0EA37A]' },
  pending_approval: { label: 'Needs approval', color: '#F59E0B', bg: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Approved', color: '#3B82F6', bg: 'bg-blue-50 text-blue-600' },
  scheduled: { label: 'Scheduled', color: '#7C3AED', bg: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
  draft: { label: 'Draft', color: '#8A8A96', bg: 'bg-[#F4F5F9] text-[#8A8A96]' },
  failed: { label: 'Failed', color: '#EF4444', bg: 'bg-red-50 text-red-500' },
  new: { label: 'New', color: '#8A8A96', bg: 'bg-[#F4F5F9] text-[#8A8A96]' },
  ai_generated: { label: 'AI ready', color: '#7C3AED', bg: 'bg-[#7C3AED]/10 text-[#7C3AED]' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'bg-red-50 text-red-500' },
  done: { label: 'Completed', color: '#0EA37A', bg: 'bg-emerald-50 text-[#0EA37A]' },
}

export function CommCard({ item, onAction, busy }) {
  const [expanded, setExpanded] = useState(false)
  const st = STATUS_META[item.status] || STATUS_META.draft
  const platforms = item.platforms || []
  const isErr = item.type === 'error' || item.status === 'failed'
  const isAppr = item.status === 'pending_approval'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${C} p-4 hover:shadow-[0_8px_24px_rgba(124,58,237,0.08)] transition-all ${item.unread ? 'ring-1 ring-[#7C3AED]/30 bg-[#7C3AED]/[0.02]' : ''} ${isErr ? 'border-l-4 border-l-red-400' : isAppr ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-transparent'}`}>
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${item.emojiBg || 'bg-[#F4F5F9]'}`}>{item.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[0.9rem] font-bold uppercase tracking-wider text-[#8A8A96]">{item.source}</span>
            <span className={`text-[0.9rem] font-bold px-2 py-0.5 rounded-full ${st.bg}`}>{st.label}</span>
            {item.priority === 'High' && <span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">HIGH</span>}
            {item.priority === 'Medium' && <span className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">MEDIUM</span>}
            {item.unread && <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" title="Unread" />}
            <span className="ml-auto text-[0.9rem] font-mono text-[#8A8A96]">{item.time}</span>
          </div>
          <div className="text-sm font-bold text-[#16161D] leading-snug">{item.title}</div>
          {item.summary && <p className={`text-[0.875rem] text-[#8A8A96] leading-relaxed mt-1 ${expanded ? '' : 'line-clamp-2'}`}>{item.summary}</p>}
          {item.draft && expanded && (
            <div className="mt-2.5 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-3">
              <div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1"><Sparkles className="h-3 w-3 text-[#7C3AED]" /> Generated draft</div>
              <p className="text-[0.875rem] text-[#16161D] whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{item.draft}</p>
            </div>
          )}
          {platforms.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {platforms.map(p => <span key={p} className="text-[0.9rem] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] border border-[#D8C8FB]">{p}</span>)}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {isAppr && <button onClick={() => onAction('approve', item)} disabled={busy} className="flex items-center gap-1 text-[0.85rem] font-bold px-3 py-1.5 rounded-lg bg-[#0EA37A] text-white hover:opacity-90">{busy ? '…' : <Check className="h-3 w-3" />}Approve</button>}
            {isAppr && <button onClick={() => onAction('reject', item)} disabled={busy} className="flex items-center gap-1 text-[0.85rem] font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><X className="h-3 w-3" />Reject</button>}
            {(item.status === 'approved' || item.status === 'ai_generated' || item.status === 'new') && <button onClick={() => onAction('schedule', item)} disabled={busy} className="flex items-center gap-1 text-[0.85rem] font-semibold px-3 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><Clock className="h-3 w-3 text-[#7C3AED]" />Schedule</button>}
            {(item.status === 'approved' || item.status === 'ai_generated' || item.status === 'scheduled') && <button onClick={() => onAction('publish', item)} disabled={busy} className="flex items-center gap-1 text-[0.85rem] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"><Send className="h-3 w-3" />Publish</button>}
            {item.canGenerate && <button onClick={() => onAction('generate', item)} disabled={busy} className="flex items-center gap-1 text-[0.85rem] font-semibold px-3 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><Wand2 className="h-3 w-3 text-[#EC4899]" />Generate AI</button>}
            {item.href && <a href={item.href} className="flex items-center gap-1 text-[0.85rem] font-semibold px-3 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] text-[#7C3AED]"><ExternalLink className="h-3 w-3" />Open</a>}
            <button onClick={() => setExpanded(v => !v)} className="text-[0.85rem] font-semibold px-3 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]"><Pencil className="h-3 w-3 inline mr-1 text-[#8A8A96]" />{expanded ? 'Collapse' : 'Details'}</button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AssistantPanel({ brief, events, news }) {
  const items = [
    { i: <Sun className="h-3.5 w-3.5" />, c: '#F59E0B', t: `Today: ${events.today?.length || 0} event(s) · ${news?.filter(n => new Date(n.created_at || n.published_at || 0).toDateString() === new Date().toDateString()).length || 0} news item(s) detected` },
    { i: <TrendingUp className="h-3.5 w-3.5" />, c: '#EC4899', t: news?.[0] ? `Trending: "${news[0].title?.slice(0, 50)}" — post within 30 min` : 'No trending news yet today' },
    { i: <CalendarDays className="h-3.5 w-3.5" />, c: '#7C3AED', t: events.tomorrow?.[0] ? `Tomorrow: ${events.tomorrow.map(e => e.name).slice(0, 3).join(', ')} — campaign ${events.tomorrow[0].isDrafted ? 'ready' : 'not generated'}` : 'No events tomorrow' },
    { i: <ListChecks className="h-3.5 w-3.5" />, c: '#0EA37A', t: brief?.pending ? `${brief.pending} item(s) awaiting approval in your inbox` : 'Inbox clear — nothing awaiting approval' },
    { i: <Star className="h-3.5 w-3.5" />, c: '#3B82F6', t: brief?.best ? `Top opportunity: ${brief.best}` : 'No top opportunity yet — publish something great today' },
  ]
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-[#7C3AED]" /> AI Assistant</h4>
      <div className="space-y-2">
        {items.map((x, i) => (
          <div key={i} className="flex items-start gap-2.5 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
            <span className="text-[#7C3AED] shrink-0 mt-0.5" style={{ color: x.c }}>{x.i}</span>
            <span className="text-[0.875rem] text-[#16161D] leading-snug">{x.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TimelinePanel({ events }) {
  if (!events?.length) return null
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-[#EC4899]" /> AI Automation Timeline</h4>
      <div className="relative">
        <div className="absolute left-[6px] top-1 bottom-1 w-px bg-[#EEEFF4]" />
        <div className="space-y-2.5">
          {events.slice(0, 8).map((e, i) => (
            <div key={i} className="relative pl-6">
              <span className="absolute left-0 top-1 h-[13px] w-[13px] rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: e.failed ? '#EF4444' : e.ok ? '#0EA37A' : '#7C3AED' }} />
              <div className="text-xs font-medium text-[#16161D]">{e.label}</div>
              <div className="text-[0.9rem] text-[#8A8A96] font-mono">{e.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RulesPanel({ rules, setRules }) {
  const channels = [
    ['dashboard', 'Dashboard Only'], ['telegram', 'Telegram + Dashboard'], ['whatsapp', 'WhatsApp + Dashboard'], ['email', 'Email (future)'],
  ]
  const events = [
    ['breaking', 'Breaking news'], ['seasonal', 'Seasonal alerts'], ['approvals', 'Approval requests'], ['published', 'Publishing success'], ['failed', 'Publishing failed'], ['reports', 'Weekly / monthly reports'],
  ]
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-[#3B82F6]" /> Notification Rules</h4>
      <div className="text-[0.95rem] text-[#8A8A96] font-semibold uppercase tracking-wider mb-1.5">Delivery channel</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {channels.map(([k, l]) => (
          <button key={k} onClick={() => setRules({ ...rules, channel: k })} className={`text-[0.85rem] font-semibold px-3 py-1.5 rounded-full transition-all ${rules.channel === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{l}</button>
        ))}
      </div>
      <div className="text-[0.95rem] text-[#8A8A96] font-semibold uppercase tracking-wider mb-1.5">Notify me about</div>
      <div className="space-y-1.5">
        {events.map(([k, l]) => (
          <label key={k} className="flex items-center justify-between rounded-lg bg-[#F8F9FC] border border-[#EBECF2] px-3 py-2 cursor-pointer">
            <span className="text-[0.875rem] font-medium text-[#16161D]">{l}</span>
            <button onClick={() => setRules({ ...rules, [k]: !rules[k] })} className={`h-5 w-9 rounded-full transition-colors relative ${rules[k] ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899]' : 'bg-[#E5E6EF]'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${rules[k] ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </label>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-2.5 text-[0.95rem] text-[#8A8A96] leading-relaxed">
        <Settings2 className="h-3 w-3 inline mr-1 text-[#7C3AED]" /> Every AI event is created once in this center — your chosen channels just deliver the notification.
      </div>
    </div>
  )
}

export function BriefPanel({ onGenerate, brief }) {
  const [type, setType] = useState('morning')
  const gen = () => { onGenerate(type); toast.success(`${type === 'morning' ? 'Morning' : 'Evening'} brief generated`) }
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2">{type === 'morning' ? <Sun className="h-4 w-4 text-[#F59E0B]" /> : <Moon className="h-4 w-4 text-[#8B5CF6]" />} Daily Brief</h4>
      <div className="flex gap-1.5 mb-3">
        {[['morning', 'Morning'], ['evening', 'Evening']].map(([k, l]) => (
          <button key={k} onClick={() => setType(k)} className={`flex-1 text-[0.85rem] font-semibold px-3 py-2 rounded-xl transition-all ${type === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{l}</button>
        ))}
      </div>
      <button onClick={gen} className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Generate now</button>
      {brief && (
        <div className="mt-3 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-3">
          <div className="text-[0.9rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-1.5">Last {brief.type}</div>
          <div className="text-[0.875rem] text-[#16161D] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">{brief.text}</div>
        </div>
      )}
    </div>
  )
}

export function EmptyInbox() {
  return (
    <div className={`${C} p-14 text-center`}>
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0EA37A]/10 to-[#7C3AED]/10 flex items-center justify-center mb-4"><Check className="h-6 w-6 text-[#0EA37A]" /></div>
      <h3 className="text-base font-bold text-[#16161D]">Inbox zero</h3>
      <p className="text-sm text-[#8A8A96] mt-1.5 max-w-sm mx-auto">Every AI event — news, approvals, seasonal campaigns, errors — will appear here as it happens. Nothing needs attention right now.</p>
    </div>
  )
}
