'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Copy, RefreshCw, Scissors, Save, Star, Sparkles, Clock, Eye, Type, MessageSquare, Wand2, Share2, Check, Hash, Heart, BrainCircuit, TrendingUp, Gauge, Monitor, Smartphone, Moon, Sun, Send, Zap, Lightbulb, Target, Users } from 'lucide-react'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'

export const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2', style: 'Professional · Thought leadership', cta: 'Business CTA', limit: 3000, strategy: 'Career insights, first-person authority, value-first' },
  instagram: { label: 'Instagram', color: '#E4405F', style: 'Visual · Emoji rich', cta: 'Creator CTA', limit: 2200, strategy: 'Emotional hook, hashtags 5-8, conversation starter' },
  facebook: { label: 'Facebook', color: '#1877F2', style: 'Community · Long form', cta: 'Engage in comments', limit: 5000, strategy: 'Story-driven, question enders, shareable' },
  threads: { label: 'Threads', color: '#111827', style: 'Conversational · Trending', cta: 'Reply bait', limit: 500, strategy: 'Hot takes, short punchy lines, timely' },
  twitter: { label: 'X', color: '#000000', style: 'Witty · 280 chars', cta: 'Retweet + follow', limit: 280, strategy: 'Threads, bold first line, link in reply' },
  youtube: { label: 'YouTube', color: '#FF0000', style: 'Title · Description · Tags', cta: 'Subscribe + watch', limit: 5000, strategy: 'Keyword title, hook first 30s, timestamped' },
  blog: { label: 'Blog', color: '#0EA37A', style: 'SEO · Structured', cta: 'Read more + share', limit: 30000, strategy: 'H2/H3 structure, internal links, meta description' },
  newsletter: { label: 'Newsletter', color: '#EC4899', style: 'Personal · Curated', cta: 'Subscribe + reply', limit: 10000, strategy: 'Warm greeting, 3 bullets, single CTA' },
}
export const PLATFORM_KEYS = Object.keys(M)
export const REAL_KEYS = ['linkedin', 'instagram', 'facebook', 'threads']

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'your', 'that', 'this', 'are', 'you', 'our', 'from', 'was', 'have', 'will', 'can', 'all', 'not', 'but', 'its', 'has', 'who', 'what', 'how', 'why', 'when', 'into', 'about', 'they', 'them', 'these', 'those', 'than', 'then', 'also', 'more', 'most', 'very', 'just', 'like', 'over', 'such', 'their', 'there', 'were', 'been', 'being', 'out', 'get', 'got', 'good', 'new', 'now', 'one', 'two', 'say', 'day', 'make', 'way', 'look'])

export function analyze(text) {
  const words = (text || '').match(/[A-Za-z0-9#@]+/g) || []
  const sentences = (text || '').split(/[.!?]+/).filter(s => s.trim().length > 0).length
  const chars = (text || '').length
  const readingTime = Math.max(1, Math.round(words.length / 200))
  const emojiCount = ((text || '').match(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu) || []).length
  const hashtagCount = ((text || '').match(/#[a-zA-Z0-9_]{2,}/g) || []).length
  const wordLen = words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 6
  const flesch = Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words.length / Math.max(1, sentences)) - 84.6 * wordLen)))
  const freq = {}
  for (const w of words) { const k = w.toLowerCase().replace(/^#/, ''); if (k.length > 2 && !STOPWORDS.has(k)) freq[k] = (freq[k] || 0) + 1 }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
  const density = words.length ? Math.round(((top?.[1] || 0) / words.length) * 100) : 0
  const seo = Math.min(100, 40 + hashtagCount * 6 + (top ? Math.min(20, top[1] * 3) : 0))
  const grammar = Math.min(100, 92 - (((text || '').match(/\s{2,}/g) || []).length * 2) - (((text || '').match(/\s[.,;:]/g) || []).length * 3) - (words.length && !/^[A-Z]/.test(words[0]) ? 5 : 0))
  const hasCTA = /(click|follow|comment|share|dm|sign up|learn more|link|contact|read more|subscribe|reply)/i.test(text || '')
  const hasHook = /(\?|!|"|statistic|stop|wait|ever|imagine|secret|mistake|why|how)/i.test((text || '').split('\n')[0] || '')
  const engagement = Math.min(100, Math.round(30 + Math.min(30, emojiCount * 3) + (hasCTA ? 15 : 0) + Math.min(15, sentences * 2) + Math.min(15, hashtagCount * 2)))
  const sentiment = emojiCount > 3 ? 'Positive' : emojiCount > 1 ? 'Engaging' : /(great|love|best|excited|happy|amazing)/i.test(text || '') ? 'Positive' : 'Neutral'
  const hookScore = Math.min(100, 40 + (hasHook ? 30 : 0) + (words[0] ? Math.min(30, (words[0].length / 12) * 30) : 0))
  const ctaScore = Math.min(100, hasCTA ? 85 : 30)
  const hashtagScore = Math.min(100, hashtagCount === 0 ? 20 : hashtagCount <= 8 ? 95 : 60)
  const quality = Math.round((seo + grammar + flesch + engagement + hookScore) / 5)
  return {
    words: words.length, chars, readingTime, emojiCount, hashtagCount, flesch,
    seo, grammar, engagement, sentiment, hookScore, ctaScore, hashtagScore, quality, density,
    keyword: top ? { word: top[0], count: top[1] } : null,
    readability: flesch >= 70 ? 'Easy' : flesch >= 50 ? 'Average' : 'Complex',
    predictedReach: Math.round(1000 + engagement * 60 + (hashtagCount > 0 ? 400 : 0)),
  }
}

export function AnalysisPanel({ text }) {
  const a = analyze(text)
  const rows = [
    { label: 'Content Quality', v: a.quality, color: '#7C3AED' },
    { label: 'SEO Score', v: a.seo, color: '#3B82F6' },
    { label: 'Predicted Engagement', v: a.engagement, color: '#EC4899' },
    { label: 'Hook Score', v: a.hookScore, color: '#F59E0B' },
    { label: 'CTA Score', v: a.ctaScore, color: '#0EA37A' },
    { label: 'Hashtag Score', v: a.hashtagScore, color: '#14B8A6' },
    { label: 'Readability', v: a.flesch, color: '#6366F1' },
    { label: 'Grammar', v: a.grammar, color: '#8B5CF6' },
  ]
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center gap-2 mb-3"><BrainCircuit className="h-4 w-4 text-[#7C3AED]" /><h4 className="text-sm font-semibold text-[#16161D]">AI Analysis</h4></div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border border-[#EBECF2] p-2.5 text-center"><div className="text-lg font-bold text-[#7C3AED]">{a.quality}%</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider font-semibold">Quality</div></div>
        <div className="rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5 text-center"><div className="text-lg font-bold text-[#16161D]">{a.predictedReach.toLocaleString()}</div><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider font-semibold">Predicted reach</div></div>
      </div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1"><span className="text-[0.6rem] text-[#8A8A96] font-medium">{r.label}</span><span className="text-[0.6rem] font-bold font-mono" style={{ color: r.color }}>{r.v}%</span></div>
            <div className="h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${r.v}%`, backgroundColor: r.color }} /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#F0F1F5] text-center">
        <div><div className="text-xs font-bold text-[#16161D]">{a.words}</div><div className="text-[0.5rem] text-[#8A8A96]">Words</div></div>
        <div><div className="text-xs font-bold text-[#16161D]">{a.readingTime}m</div><div className="text-[0.5rem] text-[#8A8A96]">Read</div></div>
        <div><div className="text-xs font-bold text-[#0EA37A]">{a.sentiment}</div><div className="text-[0.5rem] text-[#8A8A96]">Mood</div></div>
        <div><div className="text-xs font-bold text-[#16161D]">{a.emojiCount}</div><div className="text-[0.5rem] text-[#8A8A96]">Emojis</div></div>
      </div>
      {a.keyword && <div className="mt-2 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 p-2 text-[0.65rem] text-[#7C3AED]">Keyword density: <b>"{a.keyword.word}"</b> ×{a.keyword.count} ({a.density}%) · {a.readability} reading level</div>}
    </div>
  )
}

export function PlatformPreview({ platform, caption, hashtags, imageUrl }) {
  const [device, setDevice] = useState('desktop')
  const [dark, setDark] = useState(false)
  const c = (caption || '') + (hashtags?.length ? '\n\n' + hashtags.join(' ') : '')
  const bg = dark ? '#16161D' : '#FFFFFF'
  const fg = dark ? '#F4F4F5' : '#16161D'
  const sub = dark ? '#8A8A96' : '#8A8A96'
  return (
    <div className={`${C} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EBECF2] bg-[#FAFAFC]">
        <span className="text-[0.6rem] font-semibold text-[#8A8A96] uppercase tracking-wider">{M[platform]?.label} Preview</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setDevice('desktop')} className={`p-1.5 rounded-lg transition-colors ${device === 'desktop' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#8A8A96]'}`}><Monitor className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDevice('mobile')} className={`p-1.5 rounded-lg transition-colors ${device === 'mobile' ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#8A8A96]'}`}><Smartphone className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDark(v => !v)} className={`p-1.5 rounded-lg transition-colors ${dark ? 'bg-[#7C3AED]/10 text-[#7C3AED]' : 'text-[#8A8A96]'}`}>{dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button>
        </div>
      </div>
      <div className={`p-4 transition-colors ${dark ? 'bg-[#111113]' : 'bg-[#FAFAFC]'}`}>
        <div className={`${device === 'mobile' ? 'max-w-[320px] mx-auto' : ''} rounded-2xl overflow-hidden border shadow-sm transition-colors`} style={{ backgroundColor: bg, borderColor: dark ? '#26262B' : '#EBECF2' }}>
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${dark ? '#26262B' : '#F0F1F5'}` }}>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-[0.65rem] font-bold text-white">SF</div>
            <div><div className="text-xs font-semibold" style={{ color: fg }}>SocialForge</div><div className="text-[0.55rem]" style={{ color: sub }}>@yourbrand · now</div></div>
            <span className="ml-auto text-[0.55rem] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${M[platform]?.color}15`, color: M[platform]?.color }}>{M[platform]?.label}</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto" style={{ color: fg }}>{c || 'Generated content will preview here…'}</p>
            {imageUrl && <img src={imageUrl} alt="" className="mt-3 rounded-xl w-full max-h-44 object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
            <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${dark ? '#26262B' : '#F0F1F5'}` }}>
              <span className="flex items-center gap-1 text-[0.6rem]" style={{ color: sub }}><Heart className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 4))}</span>
              <span className="flex items-center gap-1 text-[0.6rem]" style={{ color: sub }}><MessageSquare className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 14))}</span>
              <span className="flex items-center gap-1 text-[0.6rem]" style={{ color: sub }}><Share2 className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 24))}</span>
              <span className="ml-auto text-[0.55rem]" style={{ color: sub }}>{c.length}/{M[platform]?.limit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContentLibrary({ result, onRestore, onDuplicate, onSave }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_studio_library')) || [] } catch { return [] } })
  const [q, setQ] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const persist = (list) => { setItems(list); localStorage.setItem('sf_studio_library', JSON.stringify(list)) }
  const saveCurrent = () => {
    if (!result) { toast.error('Generate content first'); return }
    const item = { id: Date.now().toString(), title: (result.topic || 'Untitled').slice(0, 60), createdAt: new Date().toISOString(), posts: result.posts, fav: false }
    persist([item, ...items]); toast.success('Saved to content library')
    onSave?.()
  }
  const filtered = items.filter(i => (!q || i.title.toLowerCase().includes(q.toLowerCase())) && (!favOnly || i.fav))
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><Save className="h-4 w-4 text-[#0EA37A]" /> Content Library</h4>
        <button onClick={saveCurrent} className="text-[0.65rem] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">Save current</button>
      </div>
      <div className="flex gap-1.5 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search library…" className="flex-1 rounded-lg border border-[#EBECF2] px-2.5 py-1.5 text-xs min-w-0 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
        <button onClick={() => setFavOnly(v => !v)} className={`px-2.5 rounded-lg border text-[0.6rem] font-semibold transition-colors ${favOnly ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-[#EBECF2] text-[#8A8A96]'}`}><Star className={`h-3.5 w-3.5 ${favOnly ? 'fill-current' : ''}`} /></button>
      </div>
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {filtered.length === 0 && <div className="text-[0.65rem] text-[#8A8A96] text-center py-4">Saved drafts appear here. Generate content and hit "Save current".</div>}
        {filtered.map(i => (
          <div key={i.id} className="group rounded-xl border border-[#EBECF2] p-2.5 hover:border-[#D8C8FB] transition-colors">
            <div className="flex items-center gap-2">
              <button onClick={() => persist(items.map(x => x.id === i.id ? { ...x, fav: !x.fav } : x))} className={i.fav ? 'text-amber-400' : 'text-[#C4C5CE] hover:text-amber-400'}><Star className="h-3.5 w-3.5 fill-current" /></button>
              <span className="text-[0.7rem] font-medium text-[#16161D] truncate flex-1">{i.title}</span>
              <span className="text-[0.5rem] text-[#8A8A96] shrink-0">{new Date(i.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onRestore(i)} className="text-[0.6rem] text-[#7C3AED] font-semibold">Restore</button>
              <button onClick={() => onDuplicate(i)} className="text-[0.6rem] text-[#0EA37A] font-semibold">Duplicate</button>
              <button onClick={() => persist(items.filter(x => x.id !== i.id))} className="text-[0.6rem] text-red-500 font-semibold">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SuggestionPanel({ posts, activeText }) {
  const all = Object.values(posts || {}).map(p => (p?.caption || '')).join(' ')
  const a = analyze(all)
  const suggestions = [
    { icon: <Clock className="h-3.5 w-3.5" />, t: 'Best posting windows: 9–11 AM & 7–9 PM' },
    { icon: <Hash className="h-3.5 w-3.5" />, t: a.hashtagCount > 0 ? `${a.hashtagCount} hashtags used — sweet spot is 5–8` : 'Add 5–8 hashtags to maximize reach' },
    { icon: <MessageSquare className="h-3.5 w-3.5" />, t: a.ctaScore < 50 ? 'Add a clear CTA to lift engagement ~40%' : 'Your CTA is strong — keep it above the fold' },
    { icon: <Lightbulb className="h-3.5 w-3.5" />, t: a.hookScore < 50 ? 'Try a question or bold-statistic first line' : 'Hook looks strong' },
    { icon: <Target className="h-3.5 w-3.5" />, t: 'Reply to comments within the first hour to boost ranking' },
    { icon: <Users className="h-3.5 w-3.5" />, t: 'Repurpose this into a carousel + story for 2.3x reach' },
  ]
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-[#EC4899]" /><h4 className="text-sm font-semibold text-[#16161D]">AI Suggestions</h4></div>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
            <span className="text-[#7C3AED] shrink-0 mt-0.5">{s.icon}</span><span className="text-[0.7rem] text-[#16161D] leading-snug">{s.t}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function AIChat({ post, onUpdate, onRegenerate, disabled }) {
  const [log, setLog] = useState([])
  const [q, setQ] = useState('')
  const scrollRef = useRef(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [log])
  const chips = [
    { label: 'Make professional', fn: (c) => c.replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu, '').replace(/!{2,}/g, '!').replace(/\s{2,}/g, ' ').trim() },
    { label: 'Shorten', fn: (c) => c.split(/\n+/).filter(Boolean).slice(0, 3).join('\n\n').slice(0, Math.floor(c.length * 0.55)) },
    { label: 'Add CTA', fn: (c) => c.trimEnd() + '\n\n👉 What\u2019s your take? Drop a comment below.' },
    { label: 'No emojis', fn: (c) => c.replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu, '').replace(/\s{2,}/g, ' ').trim() },
  ]
  const send = (raw) => {
    const text = (raw || q).trim()
    if (!text) return
    setQ('')
    const lower = text.toLowerCase()
    const c = post?.caption || ''
    let applied = null
    if (lower.includes('shorten')) applied = chips[1]
    else if (lower.includes('emoji')) applied = chips[3]
    else if (lower.includes('cta')) applied = chips[2]
    else if (lower.includes('professional') || lower.includes('ceo') || lower.includes('formal')) applied = { label: 'Made professional', fn: (c) => c.replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu, '').replace(/!{2,}/g, '!').replace(/\s{2,}/g, ' ').trim() }
    const userMsg = { role: 'user', text }
    if (applied) {
      const next = applied.fn(c)
      if (next !== c) { onUpdate({ caption: next }); setLog([...log, userMsg, { role: 'ai', text: `Done — ${applied.label}.` }]) }
      else setLog([...log, userMsg, { role: 'ai', text: 'Your content is already professional — try "Shorten" or "Add CTA" instead.' }])
    } else if (lower.includes('rewrite') || lower.includes('improve') || lower.includes('translate') || lower.includes('kannada') || lower.includes('hindi')) {
      setLog([...log, userMsg, { role: 'ai', text: 'Rewriting with AI… this regenerates the current platform.' }])
      onRegenerate()
    } else {
      setLog([...log, userMsg, { role: 'ai', text: 'I can: shorten, remove emojis, add a CTA, rewrite/improve, or translate (rewrite picks your language in Controls). Try one of those commands.' }])
    }
  }
  return (
    <div className={`${C} p-4 flex flex-col h-[360px]`}>
      <div className="flex items-center gap-2 mb-3"><Zap className="h-4 w-4 text-[#7C3AED]" /><h4 className="text-sm font-semibold text-[#16161D]">Chat with AI</h4><span className="ml-auto text-[0.55rem] text-[#8A8A96]">⌘/ commands</span></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3">
        {log.length === 0 && (
          <div className="text-center py-4">
            <div className="text-xl mb-2">🤖</div>
            <p className="text-xs text-[#8A8A96] max-w-[220px] mx-auto leading-relaxed">Direct the AI: "Make this more professional", "Shorten it", "Generate stronger CTA".</p>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[0.7rem] leading-relaxed ${m.role === 'user' ? 'ml-auto bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white rounded-br-sm' : 'bg-[#F4F5F9] text-[#16161D] rounded-bl-sm'}`}>{m.text}</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {chips.map(c => <button key={c.label} onClick={() => send(c.label)} disabled={disabled} className="text-[0.6rem] bg-[#F4F5F9] hover:bg-[#EDE9FE] text-[#7C3AED] px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50">{c.label}</button>)}
      </div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Ask AI…" className="flex-1 rounded-xl border border-[#EBECF2] px-3 py-2 text-xs min-w-0 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
        <button onClick={() => send()} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white px-3"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

export const QUICK_ACTIONS = [
  { key: 'copy', label: 'Copy', icon: <Copy className="h-3.5 w-3.5" /> },
  { key: 'rewrite', label: 'Rewrite', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { key: 'shorten', label: 'Shorten', icon: <Scissors className="h-3.5 w-3.5" /> },
  { key: 'expand', label: 'Expand', icon: <Wand2 className="h-3.5 w-3.5" /> },
  { key: 'emoji', label: 'No emojis', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'cta', label: 'Add CTA', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'seo', label: 'SEO', icon: <Gauge className="h-3.5 w-3.5" /> },
]

export function runQuickAction(action, caption, hashtags, setPost, onRewrite) {
  const join = () => caption + (hashtags?.length ? '\n\n' + hashtags.join(' ') : '')
  switch (action) {
    case 'copy': navigator.clipboard.writeText(join()); toast.success('Copied to clipboard'); return
    case 'rewrite': onRewrite ? onRewrite() : toast.info('Use AI Rewrite for a fresh version'); return
    case 'shorten': setPost({ caption: caption.split(/\n+/).filter(Boolean).slice(0, 3).join('\n\n').slice(0, Math.floor((caption || '').length * 0.55) || 120) }); toast.success('Shortened'); return
    case 'expand': setPost({ caption: (caption || '') + '\n\nHere\u2019s the deeper breakdown:\n\n• Start with the core idea\n• Add one real example\n• End with a practical takeaway' }); toast.success('Expanded with structure'); return
    case 'emoji': setPost({ caption: (caption || '').replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu, '').replace(/\s{2,}/g, ' ').trim() }); toast.success('Emojis removed'); return
    case 'cta': setPost({ caption: (caption || '').trimEnd() + '\n\n👉 ' + 'What\u2019s your take? Drop a comment below — I reply to everyone.' }); toast.success('CTA added'); return
    case 'seo': setPost({ hashtags: [...new Set([...(hashtags || []), 'digitalmarketing', 'socialmedia', 'contentmarketing'])] }); toast.success('SEO hashtags added'); return
    default: return
  }
}

export const TYPES = [
  { key: 'social', label: 'Social Media Post', desc: 'Native captions for every channel', icon: <PenLineIcon />, g: 'from-[#7C3AED] to-[#A855F7]', plats: 'LinkedIn · IG · FB · Threads', time: '~15s' },
  { key: 'blog', label: 'Blog Article', desc: 'SEO long-form with structure', icon: <FileTextIcon />, g: 'from-[#0EA37A] to-[#34D399]', plats: 'Blog · LinkedIn', time: '~40s' },
  { key: 'linkedin-art', label: 'LinkedIn Article', desc: 'Authority long-form posts', icon: <BriefcaseIcon />, g: 'from-[#0A66C2] to-[#3B82F6]', plats: 'LinkedIn', time: '~35s' },
  { key: 'newsletter', label: 'Newsletter', desc: 'Warm curated subscriber mail', icon: <MailIcon />, g: 'from-[#EC4899] to-[#F97316]', plats: 'Newsletter · Email', time: '~25s' },
  { key: 'email', label: 'Email Campaign', desc: 'Subject + body + single CTA', icon: <MailIcon />, g: 'from-[#14B8A6] to-[#2DD4BF]', plats: 'Email', time: '~20s' },
  { key: 'news', label: 'News Article', desc: 'Headline-first news format', icon: <NewspaperIcon />, g: 'from-[#3B82F6] to-[#60A5FA]', plats: 'Blog · LinkedIn', time: '~25s' },
  { key: 'product', label: 'Product Description', desc: 'Benefits-first conversion copy', icon: <LayoutIcon />, g: 'from-[#F59E0B] to-[#FBBF24]', plats: 'Website · Social', time: '~15s' },
  { key: 'landing', label: 'Landing Page', desc: 'Headline, proof, CTA blocks', icon: <LayoutDashboardIcon />, g: 'from-[#6366F1] to-[#818CF8]', plats: 'Website', time: '~25s' },
  { key: 'press', label: 'Press Release', desc: 'Quotes + boilerplate format', icon: <MegaphoneIcon />, g: 'from-[#EF4444] to-[#F87171]', plats: 'Website · News', time: '~20s' },
  { key: 'case', label: 'Case Study', desc: 'Challenge → solution → results', icon: <BookIcon />, g: 'from-[#8B5CF6] to-[#C084FC]', plats: 'Blog · LinkedIn', time: '~30s' },
  { key: 'video', label: 'Video Script', desc: 'Scenes, hooks, outro CTA', icon: <VideoIcon />, g: 'from-[#DC2626] to-[#F97316]', plats: 'YouTube · TikTok', time: '~30s' },
  { key: 'youtube', label: 'YouTube Script', desc: 'Title + description + tags', icon: <YoutubeIcon />, g: 'from-[#FF0000] to-[#EF4444]', plats: 'YouTube', time: '~30s' },
  { key: 'podcast', label: 'Podcast Script', desc: 'Segments, questions, outro', icon: <MicIcon />, g: 'from-[#4F46E5] to-[#818CF8]', plats: 'Podcast', time: '~25s' },
  { key: 'carousel', label: 'Carousel Copy', desc: '8 slides of scannable value', icon: <ImagesIcon />, g: 'from-[#E4405F] to-[#F59E0B]', plats: 'IG · LinkedIn', time: '~20s' },
  { key: 'story', label: 'Story Caption', desc: 'Short, urgent, poll CTA', icon: <SparklesIcon />, g: 'from-[#F97316] to-[#EF4444]', plats: 'IG Story', time: '~10s' },
  { key: 'reel', label: 'Reel Caption', desc: 'Punchy caption + trending tags', icon: <PlayIcon />, g: 'from-[#EC4899] to-[#7C3AED]', plats: 'IG Reels · TikTok', time: '~12s' },
  { key: 'thread', label: 'Twitter Thread', desc: '8–12 numbered short tweets', icon: <HashIcon />, g: 'from-[#111827] to-[#374151]', plats: 'X', time: '~18s' },
]

function PenLineIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg> }
function FileTextIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg> }
function BriefcaseIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg> }
function MailIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg> }
function NewspaperIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" /></svg> }
function LayoutIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg> }
function LayoutDashboardIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg> }
function MegaphoneIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg> }
function BookIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg> }
function VideoIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z" /><rect width="14" height="12" x="2" y="6" rx="2" ry="2" /></svg> }
function YoutubeIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg> }
function MicIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg> }
function ImagesIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 22H4a2 2 0 0 1-2-2V6" /><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /><circle cx="12" cy="8" r="2" /><path d="M20 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" /></svg> }
function SparklesIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg> }
function PlayIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3" /></svg> }
function HashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" /></svg> }
