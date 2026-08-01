'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, RefreshCw, Scissors, Trash2, Save, Star, Sparkles, Clock, Eye, Type, MessageSquare, Wand2, Share2, Download, Check, Hash, Heart, BrainCircuit, TrendingUp, Gauge } from 'lucide-react'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'

export const M = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2', rule: 'Professional · Thought leadership · Business CTA' },
  instagram: { label: 'Instagram', color: '#E4405F', rule: 'Engaging · Emoji rich · Visual first' },
  facebook: { label: 'Facebook', color: '#1877F2', rule: 'Community · Conversation · Long form' },
  threads: { label: 'Threads', color: '#111827', rule: 'Conversational · Short · Trending' },
  twitter: { label: 'X', color: '#000000', rule: '280 characters · Thread support' },
  youtube: { label: 'YouTube', color: '#FF0000', rule: 'Title · Description · Tags' },
  blog: { label: 'Blog', color: '#0EA37A', rule: 'SEO optimized · Long form · Structured' },
  newsletter: { label: 'Newsletter', color: '#EC4899', rule: 'Personal · Curated · Subscriber-first' },
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'your', 'that', 'this', 'are', 'you', 'our', 'from', 'was', 'have', 'will', 'can', 'all', 'not', 'but', 'its', 'has', 'who', 'what', 'how', 'why', 'when', 'into', 'about', 'they', 'them', 'these', 'those', 'than', 'then', 'also', 'more', 'most', 'very', 'just', 'like', 'make', 'make', 'over', 'such'])

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
  const seo = Math.min(100, 40 + hashtagCount * 6 + (top ? Math.min(20, top[1] * 3) : 0))
  const grammar = Math.min(100, 92 - (((text || '').match(/\s{2,}/g) || []).length * 2) - (((text || '').match(/\s[.,;:]/g) || []).length * 3))
  const hasCTA = /(click|follow|comment|share|dm|sign up|learn more|link|contact|read more)/i.test(text || '')
  const engagement = Math.min(100, Math.round(30 + Math.min(30, emojiCount * 3) + (hasCTA ? 15 : 0) + Math.min(15, sentences * 2) + Math.min(15, hashtagCount * 2)))
  const sentiment = emojiCount > 3 ? 'Positive' : emojiCount > 1 ? 'Engaging' : /(great|love|best|excited|happy|amazing)/i.test(text || '') ? 'Positive' : 'Neutral'
  return {
    words: words.length, chars, readingTime, emojiCount, hashtagCount, flesch,
    seo, grammar, engagement, sentiment,
    keyword: top ? { word: top[0], count: top[1] } : null,
    readability: flesch >= 70 ? 'Easy' : flesch >= 50 ? 'Average' : 'Complex',
  }
}

const scores = [
  { key: 'seo', label: 'SEO Score', color: '#7C3AED', icon: <Gauge className="h-3.5 w-3.5" /> },
  { key: 'engagement', label: 'Predicted Engagement', color: '#EC4899', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: 'grammar', label: 'Grammar', color: '#0EA37A', icon: <Check className="h-3.5 w-3.5" /> },
  { key: 'readability', label: 'Readability', color: '#3B82F6', icon: <Type className="h-3.5 w-3.5" /> },
]

export function AnalysisPanel({ text }) {
  const a = analyze(text)
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center gap-2 mb-3"><BrainCircuit className="h-4 w-4 text-[#7C3AED]" /><h4 className="text-xs font-semibold text-[#16161D]">AI Analysis</h4></div>
      <div className="space-y-2.5">
        {scores.map(s => (
          <div key={s.key}>
            <div className="flex items-center justify-between mb-1"><span className="text-[0.6rem] text-[#8A8A96] font-medium flex items-center gap-1.5">{s.icon}{s.label}</span><span className="text-[0.6rem] font-bold font-mono" style={{ color: s.color }}>{a[s.key]}%</span></div>
            <div className="h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${a[s.key]}%`, backgroundColor: s.color }} /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#F0F1F5] text-center">
        <div><div className="text-xs font-bold text-[#16161D]">{a.words}</div><div className="text-[0.5rem] text-[#8A8A96]">Words</div></div>
        <div><div className="text-xs font-bold text-[#16161D]">{a.readingTime}m</div><div className="text-[0.5rem] text-[#8A8A96]">Read time</div></div>
        <div><div className="text-xs font-bold text-[#0EA37A]">{a.sentiment}</div><div className="text-[0.5rem] text-[#8A8A96]">Sentiment</div></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2 text-center"><div className="text-xs font-bold text-[#16161D]">{a.emojiCount}</div><div className="text-[0.5rem] text-[#8A8A96]">Emojis</div></div>
        <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2 text-center"><div className="text-xs font-bold text-[#16161D]">{a.hashtagCount}</div><div className="text-[0.5rem] text-[#8A8A96]">Hashtags</div></div>
      </div>
      {a.keyword && <div className="mt-2 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 p-2 text-[0.6rem] text-[#7C3AED]">Top keyword: <b>"{a.keyword.word}"</b> ×{a.keyword.count}</div>}
    </div>
  )
}

export function PlatformPreview({ platform, caption, hashtags, imageUrl }) {
  const c = (caption || '') + (hashtags?.length ? '\n\n' + hashtags.join(' ') : '')
  const body = (
    <div className={`${C} overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EBECF2]">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-[0.6rem] font-bold text-white">{M[platform]?.label?.slice(0, 2) || 'SF'}</div>
        <div><div className="text-xs font-semibold text-[#16161D]">SocialForge</div><div className="text-[0.55rem] text-[#8A8A96]">@yourbrand · now</div></div>
        <span className="ml-auto text-[0.55rem] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${M[platform]?.color}12`, color: M[platform]?.color }}>{M[platform]?.label}</span>
      </div>
      <div className="p-4">
        <p className="text-xs leading-relaxed text-[#16161D] whitespace-pre-wrap max-h-40 overflow-y-auto">{c || 'Generated content will preview here…'}</p>
        {imageUrl && <img src={imageUrl} alt="" className="mt-3 rounded-xl w-full max-h-48 object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F0F1F5] text-[#8A8A96]">
          <span className="flex items-center gap-1 text-[0.6rem]"><Heart className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 4))}</span>
          <span className="flex items-center gap-1 text-[0.6rem]"><MessageSquare className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 14))}</span>
          <span className="flex items-center gap-1 text-[0.6rem]"><Share2 className="h-3 w-3" /> {Math.max(1, Math.round(c.length / 24))}</span>
          <span className="ml-auto text-[0.55rem] text-[#8A8A96]">{c.length} chars · {M[platform]?.rule}</span>
        </div>
      </div>
    </div>
  )
  return body
}

export function ContentLibrary({ result, onRestore, onDuplicate, onDelete, onFavorite, onSave }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_studio_library')) || [] } catch { return [] } })
  const [q, setQ] = useState('')
  const persist = (list) => { setItems(list); localStorage.setItem('sf_studio_library', JSON.stringify(list)) }
  const saveCurrent = () => {
    if (!result) { toast.error('Generate content first'); return }
    const item = { id: Date.now().toString(), title: (result.topic || 'Untitled').slice(0, 60), createdAt: new Date().toISOString(), posts: result.posts, fav: false }
    persist([item, ...items]); toast.success('Saved to content library')
    onSave?.()
  }
  const toggleFav = (id) => persist(items.map(i => i.id === id ? { ...i, fav: !i.fav } : i))
  const filtered = items.filter(i => !q || i.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-[#16161D] flex items-center gap-2"><Save className="h-3.5 w-3.5 text-[#0EA37A]" /> Content Library</h4>
        <button onClick={saveCurrent} className="text-[0.6rem] font-semibold px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white">Save current</button>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search library…" className="w-full rounded-lg border border-[#EBECF2] px-2.5 py-1.5 text-xs mb-2 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {filtered.length === 0 && <div className="text-[0.65rem] text-[#8A8A96] text-center py-4">Saved drafts appear here. Generate content and hit "Save current".</div>}
        {filtered.map(i => (
          <div key={i.id} className="group rounded-xl border border-[#EBECF2] p-2.5 hover:border-[#D8C8FB] transition-colors">
            <div className="flex items-center gap-2">
              <button onClick={() => toggleFav(i.id)} className={i.fav ? 'text-amber-400' : 'text-[#C4C5CE] hover:text-amber-400'}><Star className="h-3.5 w-3.5 fill-current" /></button>
              <span className="text-[0.7rem] font-medium text-[#16161D] truncate flex-1">{i.title}</span>
              <span className="text-[0.5rem] text-[#8A8A96] shrink-0">{new Date(i.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onRestore(i)} className="text-[0.55rem] text-[#7C3AED] font-semibold">Restore</button>
              <button onClick={() => onDuplicate(i)} className="text-[0.55rem] text-[#0EA37A] font-semibold">Duplicate</button>
              <button onClick={() => persist(items.filter(x => x.id !== i.id))} className="text-[0.55rem] text-red-500 font-semibold">Delete</button>
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
    { icon: <Clock className="h-3.5 w-3.5" />, t: 'Best posting window: 9–11 AM or 7–9 PM (peak engagement)' },
    { icon: <Hash className="h-3.5 w-3.5" />, t: 'Mix 3 niche + 3 broad hashtags per post for discovery' },
    { icon: <MessageSquare className="h-3.5 w-3.5" />, t: 'Open with a question hook — boosts replies by ~40%' },
    { icon: <Sparkles className="h-3.5 w-3.5" />, t: a.hashtagCount > 0 ? `You used ${a.hashtagCount} hashtags — keep 5–8 for reach` : 'Add 5–8 hashtags to maximize reach' },
    { icon: <TrendingUp className="h-3.5 w-3.5" />, t: 'Reply to comments within the first hour to boost ranking' },
  ]
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-[#EC4899]" /><h4 className="text-xs font-semibold text-[#16161D]">AI Suggestions</h4></div>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-2.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
            <span className="text-[#7C3AED] shrink-0 mt-0.5">{s.icon}</span><span className="text-[0.65rem] text-[#16161D] leading-snug">{s.t}</span>
          </motion.div>
        ))}
      </div>
      {activeText && <div className="mt-3 rounded-lg bg-[#0EA37A]/5 border border-[#0EA37A]/10 p-2.5 text-[0.6rem] text-[#0EA37A] font-medium">Provider: {activeText.name} · ready to generate</div>}
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
  { key: 'seo', label: 'Optimize SEO', icon: <Gauge className="h-3.5 w-3.5" /> },
  { key: 'reel', label: 'Reel caption', icon: <Clapperboard className="h-3.5 w-3.5" /> },
]

function Clapperboard(props) { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" /><path d="m6.2 5.3 3.1 3.9" /><path d="m12.4 3.4 3.1 4" /><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg> }

export function runQuickAction(action, caption, hashtags, setPost) {
  const join = () => caption + (hashtags?.length ? '\n\n' + hashtags.join(' ') : '')
  switch (action) {
    case 'copy': navigator.clipboard.writeText(join()); toast.success('Copied to clipboard'); return
    case 'shorten': setPost({ caption: caption.split(/\n+/).filter(Boolean).slice(0, 3).join('\n\n').slice(0, Math.floor((caption || '').length * 0.55) || 120) }); toast.success('Shortened'); return
    case 'expand': toast.info('Expand uses AI — use Rewrite for a fuller version'); return
    case 'emoji': setPost({ caption: (caption || '').replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}])/gu, '').replace(/\s{2,}/g, ' ').trim() }); toast.success('Emojis removed'); return
    case 'cta': setPost({ caption: (caption || '').trimEnd() + '\n\n👉 ' + 'What\u2019s your take? Drop a comment below — I reply to everyone.' }); toast.success('CTA added'); return
    case 'seo': setPost({ hashtags: [...new Set([...(hashtags || []), 'digitalmarketing', 'socialmedia', 'contentmarketing'])] }); toast.success('SEO hashtags added'); return
    case 'reel': setPost({ caption: (caption || '').slice(0, 200) + '\n\n🎬 Watch till the end!' }); toast.success('Reel caption ready'); return
    default: return
  }
}
