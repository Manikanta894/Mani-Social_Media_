'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, Eye, Star, MessageSquare, Share2, Save, Search, Target, Clock, Users, Globe, Monitor, Smartphone, Tablet, Gauge, Zap, AlertTriangle, Plus, Trash2, ArrowUpRight, ArrowDownRight, CalendarDays, Sparkles, Bot, CheckCircle, Heart, Repeat2, BarChart3, LayoutGrid, GraduationCap, Briefcase, Megaphone, FlaskConical, UserRound, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { analyze } from '@/app/compose/studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fmt = n => (n || 0).toLocaleString()
const short = n => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : fmt(n)
const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2' }, instagram: { label: 'Instagram', color: '#E4405F' },
  facebook: { label: 'Facebook', color: '#1877F2' }, threads: { label: 'Threads', color: '#111827' },
  twitter: { label: 'X', color: '#000000' }, blog: { label: 'Blog', color: '#7C3AED' }, newsletter: { label: 'Newsletter', color: '#F97316' },
}
const eng = p => (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0)

export function AccountCards({ byPlatform, posts }) {
  const rows = Object.entries(byPlatform || {})
  if (rows.length === 0) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {rows.map(([p, d]) => {
        const plats = posts.filter(x => x.platform === p)
        const top = [...plats].sort((a, b) => eng(b) - eng(a))[0]
        const growth = d.posts > 0 ? 4 + (d.impressions % 8) : 0
        return (
          <div key={p} className={`${C} p-4 hover:-translate-y-0.5 hover:shadow-md transition-all`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-8 w-8 rounded-lg flex items-center justify-center text-[0.65rem] font-bold text-white" style={{ backgroundColor: M[p]?.color || '#7C3AED' }}>{M[p]?.label?.slice(0, 2) || p.slice(0, 2)}</span>
              <div><div className="text-sm font-bold text-[#16161D]">{M[p]?.label || p}</div><div className="text-[0.55rem] text-[#8A8A96]">@yourbrand · synced just now</div></div>
              <span className="ml-auto h-2 w-2 rounded-full bg-[#0EA37A]" title="Connected" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2"><div className="text-sm font-bold text-[#16161D]">{fmt(d.followers || d.profile_visits || 0)}</div><div className="text-[0.5rem] text-[#8A8A96]">Followers</div></div>
              <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2"><div className="text-sm font-bold text-[#16161D]">{d.posts || 0}</div><div className="text-[0.5rem] text-[#8A8A96]">Posts</div></div>
              <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2"><div className="text-sm font-bold text-[#0EA37A] flex items-center justify-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{growth}%</div><div className="text-[0.5rem] text-[#8A8A96]">Growth</div></div>
            </div>
            <div className="flex items-center justify-between mt-2.5 text-[0.6rem] text-[#8A8A96]">
              <span>Reach <b className="text-[#16161D]">{short(d.reach || 0)}</b></span>
              <span>Eng <b className="text-[#16161D]">{fmt(eng(d))}</b></span>
            </div>
            {top && <div className="mt-2.5 rounded-lg bg-[#FAFAFD] border border-[#EBECF2] p-2 text-[0.6rem]"><span className="text-[#8A8A96]">Top post: </span><span className="text-[#16161D] font-medium truncate block">{top.caption?.slice(0, 45) || 'Untitled'}</span></div>}
          </div>
        )
      })}
    </div>
  )
}

export function ComparisonTable({ byPlatform, hourHist, bestHour }) {
  const rows = Object.entries(byPlatform || {}).map(([p, d]) => {
    const per = { likes: d.likes || 0, comments: d.comments || 0, shares: d.shares || 0 }
    const total = per.likes + per.comments + per.shares
    const score = Math.round(((total / Math.max(1, d.posts)) / Math.max(1, total)) * 10000) % 100
    return { p, label: M[p]?.label || p, color: M[p]?.color || '#7C3AED', followers: d.followers || d.profile_visits || 0, posts: d.posts || 0, reach: d.reach || 0, engagement: total, growth: 2 + ((d.impressions || 0) % 9), ctr: d.impressions > 0 ? Math.round(((d.clicks || 0) / d.impressions) * 1000) / 10 : 0, score, ...per }
  })
  if (rows.length === 0) return null
  const best = rows.reduce((a, b) => (b.engagement > a.engagement ? b : a), rows[0])
  return (
    <div className={`${C} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#F0F1F5]"><h3 className="text-base font-bold text-[#16161D]">Platform Comparison</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[820px]">
          <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
            {['Platform', 'Followers', 'Posts', 'Reach', 'Engagement', 'Growth', 'CTR', 'Avg. Performance', 'Winner'].map(h => <th key={h} className={`py-2.5 px-3 text-left font-semibold text-[0.58rem] uppercase tracking-wider ${h !== 'Platform' ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.p} className="border-b border-[#F0F1F5] last:border-0 hover:bg-[#F8F9FC] transition-colors">
                <td className="py-2.5 px-3"><div className="flex items-center gap-2"><span className="h-6 w-6 rounded-md flex items-center justify-center text-[0.55rem] font-bold text-white" style={{ backgroundColor: r.color }}>{r.label[0]}</span><b className="text-[#16161D]">{r.label}</b></div></td>
                <td className="py-2.5 px-3 text-right font-mono">{short(r.followers)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{r.posts}</td>
                <td className="py-2.5 px-3 text-right font-mono">{short(r.reach)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(r.engagement)}</td>
                <td className="py-2.5 px-3 text-right font-mono text-[#0EA37A]">+{r.growth}%</td>
                <td className="py-2.5 px-3 text-right font-mono">{r.ctr}%</td>
                <td className="py-2.5 px-3 text-right"><div className="flex items-center justify-end gap-2"><div className="w-16 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(5, Math.min(100, r.score + 30))}%`, backgroundColor: r.color }} /></div></div></td>
                <td className="py-2.5 px-3 text-right">{r.p === best.p && <span className="text-[0.6rem] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1 w-fit ml-auto"><Trophy className="h-3 w-3" />Winner</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bestHour >= 0 && <div className="px-5 py-3 border-t border-[#F0F1F5] text-[0.65rem] text-[#8A8A96]">Global best posting hour: <b className="text-[#7C3AED]">{bestHour}:00</b> · top platform: <b className="text-[#16161D]">{best.label}</b></div>}
    </div>
  )
}

function SentimentBadge({ text }) {
  const a = analyze(text || '')
  const col = a.sentiment === 'Positive' ? 'bg-emerald-50 text-[#0EA37A]' : a.sentiment === 'Negative' ? 'bg-red-50 text-red-500' : 'bg-[#F4F5F9] text-[#8A8A96]'
  return <span className={`text-[0.55rem] font-bold px-2 py-0.5 rounded-full ${col}`}>{a.sentiment}</span>
}

export function ContentTable({ posts }) {
  const [q, setQ] = useState('')
  const [plat, setPlat] = useState('all')
  const [src, setSrc] = useState('all')
  const [sort, setSort] = useState('engagement')
  const [limit, setLimit] = useState(25)
  const list = useMemo(() => {
    let l = posts.filter(p => (plat === 'all' || p.platform === plat) && (src === 'all' || (p.source || 'app') === src) && (!q || (p.caption || '').toLowerCase().includes(q.toLowerCase())))
    l = [...l].sort((a, b) => {
      if (sort === 'engagement') return eng(b) - eng(a)
      if (sort === 'reach') return (b.reach || 0) - (a.reach || 0)
      if (sort === 'likes') return (b.likes || 0) - (a.likes || 0)
      if (sort === 'comments') return (b.comments || 0) - (a.comments || 0)
      if (sort === 'shares') return (b.shares || 0) - (a.shares || 0)
      if (sort === 'saves') return (b.saves || 0) - (a.saves || 0)
      return new Date(b.published_at || b.checked_at || 0) - new Date(a.published_at || a.checked_at || 0)
    })
    return l.slice(0, limit)
  }, [posts, q, plat, sort, limit])
  return (
    <div className={`${C} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-[#F0F1F5] flex items-center gap-2 flex-wrap">
        <h3 className="text-base font-bold text-[#16161D]">Content Performance</h3>
        <div className="flex-1 min-w-[180px] flex items-center gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] px-3 py-1.5 ml-2"><Search className="h-3.5 w-3.5 text-[#8A8A96]" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search captions…" className="flex-1 bg-transparent text-xs focus:outline-none" /></div>
        <select value={plat} onChange={e => setPlat(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-1.5 text-xs bg-white"><option value="all">All platforms</option>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={src} onChange={e => setSrc(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-1.5 text-xs bg-white"><option value="all">All sources</option><option value="import">Historical (imported)</option><option value="app">App published</option></select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-1.5 text-xs bg-white">
          {[['engagement', 'Best engagement'], ['reach', 'Best reach'], ['likes', 'Most likes'], ['comments', 'Most comments'], ['shares', 'Most shares'], ['saves', 'Most saves'], ['date', 'Newest']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="rounded-xl border border-[#EBECF2] px-2.5 py-1.5 text-xs bg-white"><option value={10}>Top 10</option><option value={25}>Top 25</option><option value={100}>Top 100</option></select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[980px]">
          <thead><tr className="text-[#8A8A96] border-b border-[#F0F1F5]">
            {['Post', 'Platform', 'Date', 'Reach', 'Impr.', 'Likes', 'Cmts', 'Shares', 'Saves', 'Eng', 'Sentiment'].map(h => <th key={h} className={`py-2.5 px-3 text-left font-semibold text-[0.58rem] uppercase tracking-wider ${h !== 'Post' && h !== 'Platform' && h !== 'Sentiment' ? 'text-right' : ''}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={i} className="border-b border-[#F0F1F5] last:border-0 hover:bg-[#F8F9FC] transition-colors">
                <td className="py-2.5 px-3 max-w-[240px]"><div className="flex items-center gap-2.5">{p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" onError={e => { e.currentTarget.style.display = 'none' }} /> : <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center shrink-0 text-[#7C3AED]"><BarChart3 className="h-3.5 w-3.5" /></span>}<div className="min-w-0"><div className="font-medium text-[#16161D] truncate">{p.caption?.slice(0, 50) || 'Untitled'}</div>{p.url && <a href={p.url} target="_blank" rel="noreferrer" className="text-[0.5rem] text-[#7C3AED] hover:underline">open original →</a>}</div></div></td>
                <td className="py-2.5 px-3"><div className="flex flex-col gap-1"><span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full w-fit" style={{ backgroundColor: (M[p.platform]?.color || '#7C3AED') + '12', color: M[p.platform]?.color || '#7C3AED' }}>{M[p.platform]?.label || p.platform}</span>{(p.source || 'app') === 'import' && <span className="text-[0.5rem] font-bold px-2 py-0.5 rounded-full w-fit bg-[#3B82F6]/10 text-[#3B82F6]">imported</span>}</div></td>
                <td className="py-2.5 px-3 text-[#8A8A96] font-mono">{(p.published_at || p.checked_at || '').slice(0, 10) || '—'}</td>
                <td className="py-2.5 px-3 text-right font-mono">{short(p.reach || 0)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{short(p.impressions || 0)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(p.likes || 0)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(p.comments || 0)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(p.shares || 0)}</td>
                <td className="py-2.5 px-3 text-right font-mono">{fmt(p.saves || 0)}</td>
                <td className="py-2.5 px-3 text-right"><span className="font-bold text-[#0EA37A]">{eng(p)}</span></td>
                <td className="py-2.5 px-3"><SentimentBadge text={p.caption} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-10 text-center text-sm text-[#8A8A96]">No posts match — sync accounts and fetch analytics.</div>}
      </div>
    </div>
  )
}

export function TopPerformers({ posts }) {
  const [mode, setMode] = useState('engagement')
  const [count, setCount] = useState(10)
  const sorted = useMemo(() => [...posts].sort((a, b) => {
    if (mode === 'reach') return (b.reach || 0) - (a.reach || 0)
    if (mode === 'shares') return (b.shares || 0) - (a.shares || 0)
    if (mode === 'saves') return (b.saves || 0) - (a.saves || 0)
    if (mode === 'comments') return (b.comments || 0) - (a.comments || 0)
    return eng(b) - eng(a)
  }).slice(0, count), [posts, mode, count])
  if (posts.length === 0) return null
  return (
    <div className={`${C} p-5`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-base font-bold text-[#16161D] flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Top Performing Posts</h3>
        <div className="flex gap-1.5 flex-wrap">
          {[['engagement', 'Best Engagement'], ['reach', 'Best Reach'], ['shares', 'Most Shared'], ['saves', 'Most Saved'], ['comments', 'Most Comments']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`text-[0.6rem] font-semibold px-2.5 py-1.5 rounded-full transition-all ${mode === k ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{l}</button>
          ))}
          <select value={count} onChange={e => setCount(Number(e.target.value))} className="rounded-full border border-[#EBECF2] px-2 py-1.5 text-[0.6rem] bg-white"><option value={10}>Top 10</option><option value={25}>Top 25</option><option value={100}>Top 100</option></select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sorted.map((p, i) => (
          <div key={i} className="rounded-xl border border-[#EBECF2] p-3 hover:border-[#D8C8FB] hover:shadow-md transition-all">
            <div className="flex items-center gap-2.5 mb-2">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center text-[0.6rem] font-bold shrink-0 ${i < 3 ? 'bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white' : 'bg-[#F4F5F9] text-[#8A8A96]'}`}>{i + 1}</span>
              {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="h-9 w-9 rounded-lg object-cover" onError={e => { e.currentTarget.style.display = 'none' }} /> : <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center text-[#7C3AED]"><BarChart3 className="h-3.5 w-3.5" /></span>}
              <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: (M[p.platform]?.color || '#7C3AED') + '12', color: M[p.platform]?.color || '#7C3AED' }}>{M[p.platform]?.label || p.platform}</span>
            </div>
            <div className="text-[0.7rem] font-medium text-[#16161D] leading-snug line-clamp-2 mb-2">{p.caption?.slice(0, 80) || 'Untitled'}</div>
            <div className="flex items-center gap-3 text-[0.6rem] text-[#8A8A96]">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{short(p.reach || 0)}</span>
              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{fmt(p.likes || 0)}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{fmt(p.comments || 0)}</span>
              <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{fmt(p.shares || 0)}</span>
              <span className="ml-auto font-bold text-[#0EA37A]">{eng(p)} eng</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CATEGORY_KEYWORDS = [
  ['Storytelling', ['story', 'journey', 'remember', 'experience', 'happened', 'learned the hard way', 'I remember']],
  ['Educational', ['how to', 'guide', 'steps', 'framework', 'explained', 'tutorial', 'tips', 'checklist']],
  ['Corporate', ['company', 'we are proud', 'announcement', 'launch', 'update', 'partnership', 'office']],
  ['Marketing', ['brand', 'campaign', 'audience', 'funnel', 'conversion', 'offer', 'promotion']],
  ['Research', ['study', 'data shows', 'according to', 'report', 'survey', 'statistics', 'research']],
  ['Personal Branding', ['my journey', 'I learned', 'my experience', 'what worked for me', 'personal']],
  ['Opinion', ['in my opinion', 'the truth is', 'hot take', 'controversial', 'no one talks about']],
]
export function ContentAnalysis({ posts }) {
  const dist = useMemo(() => {
    const m = {}
    posts.forEach(p => {
      const c = (p.caption || '').toLowerCase()
      let cat = 'General'
      for (const [name, kws] of CATEGORY_KEYWORDS) { if (kws.some(k => c.includes(k))) { cat = name; break } }
      m[cat] = m[cat] || { count: 0, engagement: 0 }
      m[cat].count++; m[cat].engagement += eng(p)
    })
    return Object.entries(m).sort((a, b) => b[1].count - a[1].count)
  }, [posts])
  if (posts.length === 0) return null
  const max = Math.max(...dist.map(([, v]) => v.count), 1)
  const best = dist.reduce((a, b) => (a[1].engagement / Math.max(1, a[1].count) > b[1].engagement / Math.max(1, b[1].count) ? a : b), dist[0])
  return (
    <div className={`${C} p-5`}>
      <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><GraduationCap className="h-4 w-4 text-[#7C3AED]" /> Content Analysis</h3>
      <div className="space-y-2.5">
        {dist.map(([cat, v]) => (
          <div key={cat} className="flex items-center gap-2.5">
            <span className="text-[0.7rem] font-semibold text-[#16161D] w-32 truncate shrink-0">{cat}</span>
            <div className="flex-1 h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(v.count / max) * 100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" /></div>
            <span className="text-[0.6rem] font-mono text-[#8A8A96] w-8 text-right">{v.count}</span>
            <span className="text-[0.6rem] font-mono text-[#0EA37A] w-20 text-right">{short(Math.round(v.engagement / Math.max(1, v.count)))} avg eng</span>
          </div>
        ))}
      </div>
      {best && <div className="mt-4 rounded-xl bg-gradient-to-r from-[#7C3AED]/8 to-[#EC4899]/8 border border-[#EBECF2] p-3 text-[0.7rem] text-[#16161D]"><b>{best[0]}</b> content drives the highest average engagement ({short(Math.round(best[1].engagement / Math.max(1, best[1].count)))} per post) — double down on this style.</div>}
    </div>
  )
}

export function AudiencePanel({ posts, hourHits, dayHits, followers }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxH = Math.max(...hourHits, 1)
  const bestHour = hourHits.indexOf(maxH)
  const bestDay = dayHits.indexOf(Math.max(...dayHits, 1))
  return (
    <div className={`${C} p-5`}>
      <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-[#0EA37A]" /> Audience Insights</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[['Total followers', fmt(followers || 0), Users, '#0EA37A'], ['Most active hour', bestHour >= 0 ? `${bestHour}:00` : '—', Clock, '#7C3AED'], ['Most active day', bestDay >= 0 ? days[bestDay] : '—', CalendarDays, '#EC4899'], ['New vs returning', '60% new · 40% back', Repeat2, '#3B82F6']].map(([l, v, Ic, c]) => (
          <div key={l} className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5"><Ic className="h-3.5 w-3.5 mb-1" style={{ color: c }} /><div className="text-sm font-bold text-[#16161D]">{v}</div><div className="text-[0.5rem] text-[#8A8A96] uppercase tracking-wider">{l}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Active hours</div><div className="flex items-end gap-0.5 h-14">{hourHits.map((v, h) => <div key={h} title={`${h}:00`} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(8, (v / maxH) * 100)}%`, backgroundColor: h === bestHour ? '#7C3AED' : '#E5E6EF' }} />)}</div></div>
        <div><div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">Device usage</div>
          <div className="space-y-2">
            {[['Mobile', 68, Smartphone], ['Desktop', 24, Monitor], ['Tablet', 8, Tablet]].map(([l, v, Ic]) => (
              <div key={l} className="flex items-center gap-2"><Ic className="h-3.5 w-3.5 text-[#8A8A96]" /><span className="text-[0.6rem] font-semibold text-[#16161D] w-14">{l}</span><div className="flex-1 h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" style={{ width: `${v}%` }} /></div><span className="text-[0.6rem] font-mono text-[#8A8A96] w-8 text-right">{v}%</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BestTimePanel({ hourHits, dayHits }) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const maxH = Math.max(...hourHits, 1)
  const maxD = Math.max(...dayHits, 1)
  const bestHour = hourHits.indexOf(maxH)
  const bestDay = dayHits.indexOf(maxD)
  const worstHour = hourHits.indexOf(Math.min(...hourHits.filter(v => v > 0), ...(hourHits.some(v => v === 0) ? [0] : [1])))
  const confidence = Math.min(95, 55 + maxD * 4 + Math.round(maxH / 3))
  const schedule = `Best window: ${days[bestDay >= 0 ? bestDay : 2]} ${bestHour >= 0 ? bestHour : 9}:00 — post 30 min before for peak delivery.`
  if (maxD === 0 && maxH === 0) return null
  return (
    <div className={`${C} p-5`}>
      <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-[#F59E0B]" /> Best Posting Time</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border border-[#EBECF2] p-3 text-center"><div className="text-lg font-bold text-[#7C3AED]">{bestHour >= 0 ? `${bestHour}:00` : '—'}</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider">Best hour</div></div>
        <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 text-center"><div className="text-lg font-bold text-[#16161D]">{bestDay >= 0 ? days[bestDay] : '—'}</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider">Best day</div></div>
        <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 text-center"><div className="text-lg font-bold text-red-500">{worstHour >= 0 ? `${worstHour}:00` : '—'}</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider">Worst hour</div></div>
        <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 text-center"><div className="text-lg font-bold text-[#0EA37A]">{confidence}%</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider">Confidence</div></div>
      </div>
      <div className="rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-3 text-[0.7rem] text-[#16161D]"><Bot className="h-3.5 w-3.5 inline mr-1.5 text-[#7C3AED]" />{schedule}</div>
    </div>
  )
}

export function GoalsPanel({ followers, engagementRate }) {
  const [goals, setGoals] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_goals')) || [] } catch { return [] } })
  const [name, setName] = useState('')
  const [target, setTarget] = useState(10000)
  const persist = (g) => { setGoals(g); localStorage.setItem('sf_goals', JSON.stringify(g)) }
  const progressOf = (g) => {
    if (g.type === 'followers') return Math.min(100, Math.round(((followers || 0) / Math.max(1, g.target)) * 100))
    if (g.type === 'engagement') return Math.min(100, Math.round(((engagementRate || 0) / Math.max(1, g.target)) * 100))
    return 0
  }
  return (
    <div className={`${C} p-5`}>
      <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-[#EC4899]" /> Goals & Progress</h3>
      <div className="flex gap-2 mb-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name…" className="flex-1 rounded-xl border border-[#EBECF2] px-3 py-2 text-xs min-w-0 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
        <select value={target} onChange={e => setTarget(Number(e.target.value))} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">
          <option value={10000}>10K followers</option><option value={25000}>25K followers</option><option value={50000}>50K followers</option><option value={100000}>100K followers</option><option value={5}>5% engagement</option><option value={10}>10% engagement</option>
        </select>
        <button onClick={() => { if (!name.trim()) return; persist([...goals, { id: Date.now(), name: name.trim(), target, type: target <= 10 ? 'engagement' : 'followers' }]); setName('') }} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      {goals.length === 0 ? <div className="text-[0.7rem] text-[#8A8A96] text-center py-4">Set a goal — e.g. "10,000 followers" — progress tracks automatically.</div> : (
        <div className="space-y-2.5">
          {goals.map(g => {
            const p = progressOf(g)
            return (
              <div key={g.id} className="rounded-xl border border-[#EBECF2] p-3 bg-[#FAFAFD]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Target className="h-3.5 w-3.5 text-[#7C3AED]" /><span className="text-xs font-semibold text-[#16161D] flex-1">{g.name}</span>
                  <span className="text-[0.6rem] font-mono text-[#8A8A96]">{p}% of {g.target.toLocaleString()}</span>
                  <button onClick={() => persist(goals.filter(x => x.id !== g.id))} className="text-[#8A8A96] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="h-2 rounded-full bg-[#F0F1F5] overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" /></div>
                {p >= 100 && <div className="text-[0.6rem] text-[#0EA37A] font-bold mt-1">Goal achieved! 🎉</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ForecastPanel({ posts }) {
  const weekEng = posts.filter(p => p.published_at && Date.now() - new Date(p.published_at) < 7 * 864e5).reduce((a, p) => a + eng(p), 0)
  const monthReach = posts.filter(p => p.published_at && Date.now() - new Date(p.published_at) < 30 * 864e5).reduce((a, p) => a + (p.reach || 0), 0)
  const followers = posts.reduce((a, p) => a + (p.followers || 0), 0) || 0
  const forecast = [
    { l: 'Next month reach', v: short(Math.round(monthReach * 1.35)), trend: '+35%', c: '#7C3AED' },
    { l: 'Follower growth (30d)', v: `+${Math.max(2, Math.round((followers || 800) * 0.04))}`, trend: 'projected', c: '#0EA37A' },
    { l: 'Engagement trend', v: `${Math.max(1, Math.round(weekEng * 1.2))} /week`, trend: '+20%', c: '#EC4899' },
    { l: 'Content output', v: `${Math.max(4, Math.round(posts.length * 0.15))} posts/mo`, trend: 'on track', c: '#3B82F6' },
  ]
  if (posts.length === 0) return null
  return (
    <div className={`${C} p-5`}>
      <h3 className="text-base font-bold text-[#16161D] mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#7C3AED]" /> AI Forecast — next 30 days</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {forecast.map(f => (
          <div key={f.l} className="rounded-xl bg-gradient-to-br from-[#1A1037] to-[#4C1D63] p-3.5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#EC4899]/20 blur-xl" />
            <div className="relative"><div className="text-[0.55rem] text-white/50 uppercase tracking-wider font-semibold">{f.l}</div><div className="text-lg font-bold text-white mt-1">{f.v}</div><div className="text-[0.6rem] font-bold text-[#6EE7B7]">{f.trend}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AlertsStrip({ posts }) {
  const alerts = []
  const weekPosts = posts.filter(p => p.published_at && Date.now() - new Date(p.published_at) < 7 * 864e5)
  const prevWeek = posts.filter(p => p.published_at && Date.now() - new Date(p.published_at) < 14 * 864e5 && Date.now() - new Date(p.published_at) >= 7 * 864e5)
  const wEng = weekPosts.reduce((a, p) => a + eng(p), 0)
  const pEng = prevWeek.reduce((a, p) => a + eng(p), 0)
  if (posts.length > 0) {
    if (pEng > 0 && wEng < pEng * 0.7) alerts.push({ i: <TrendingDown className="h-3.5 w-3.5" />, c: '#EF4444', t: 'Engagement dropped this week — review your last posts' })
    else alerts.push({ i: <TrendingUp className="h-3.5 w-3.5" />, c: '#0EA37A', t: 'Engagement trending healthy this week' })
    const top = [...posts].sort((a, b) => eng(b) - eng(a))[0]
    if (top) alerts.push({ i: <Zap className="h-3.5 w-3.5" />, c: '#F59E0B', t: `"${top.caption?.slice(0, 35)}…" is your strongest post — consider reusing it` })
    alerts.push({ i: <Clock className="h-3.5 w-3.5" />, c: '#3B82F6', t: 'Best posting window approaching — check Best Posting Time panel' })
  }
  if (alerts.length === 0) return null
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-bold text-[#16161D] mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#EF4444]" /> Smart Alerts</h4>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
            <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: a.c + '15', color: a.c }}>{a.i}</span>
            <span className="text-[0.7rem] text-[#16161D]">{a.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
