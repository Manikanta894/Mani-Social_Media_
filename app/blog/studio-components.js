'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gauge, Search, Type, Hash, Link2, Image as ImageIcon, Copy, Wand2, Check, AlertTriangle, Sparkles, FileText, List, Quote, ImageIcon as ImageIcon2, Table, BookOpen, Target, Send, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const STOP = new Set(['the', 'and', 'for', 'with', 'your', 'that', 'this', 'are', 'you', 'our', 'from', 'was', 'have', 'will', 'can', 'all', 'not', 'but', 'its', 'has', 'who', 'what', 'how', 'why', 'when', 'into', 'about', 'they', 'them', 'these', 'those', 'than', 'then', 'also', 'more', 'most', 'very', 'just', 'like', 'over', 'such', 'their', 'there', 'were', 'been', 'being', 'out', 'get', 'got', 'good', 'new', 'now', 'one', 'two', 'say', 'day', 'make', 'way', 'look'])

export function blogSeo(title, body, meta, slug, imageRef) {
  const text = (body || '').replace(/[#*`>\[\]!-]/g, '')
  const words = text.match(/[A-Za-z0-9]+/g) || []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length
  const freq = {}
  for (const w of words) { const k = w.toLowerCase(); if (k.length > 2 && !STOP.has(k)) freq[k] = (freq[k] || 0) + 1 }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
  const h2s = ((body || '').match(/^##\s.+$/gm) || []).length
  const h3s = ((body || '').match(/^###\s.+$/gm) || []).length
  const links = ((body || '').match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g) || []).length
  const alts = ((body || '').match(/!\[[^\]]*\]/g) || []).length
  const readTime = Math.max(1, Math.round(words.length / 200))
  const titleScore = Math.min(100, (title || '').length >= 30 && (title || '').length <= 65 ? 90 : (title || '').length < 30 ? 45 : 60)
  const metaScore = Math.min(100, (meta || '').length >= 120 && (meta || '').length <= 165 ? 95 : (meta || '').length > 0 ? 55 : 15)
  const kw = top ? (text.toLowerCase().includes(top[0]) ? 40 : 0) + Math.min(30, top[1] * 2) : 0
  const headScore = Math.min(100, 30 + h2s * 15 + h3s * 5)
  const readScore = Math.min(100, Math.max(20, 100 - Math.abs(words.length / Math.max(1, sentences) - 18) * 3))
  const linkScore = Math.min(100, Math.min(60, links * 12) + (alts > 0 ? 20 : 0))
  const slugScore = (slug || '').length > 3 ? 80 : 30
  const seo = Math.round((titleScore * 0.2 + metaScore * 0.2 + headScore * 0.15 + Math.min(100, kw + 20) * 0.15 + readScore * 0.1 + linkScore * 0.1 + slugScore * 0.1))
  const suggestions = []
  if ((title || '').length < 30) suggestions.push('Title is too short — aim for 30-65 characters with the primary keyword')
  if ((title || '').length > 65) suggestions.push('Title is too long — search engines truncate past 65 characters')
  if (!meta || meta.length < 120) suggestions.push('Meta description too short — write 120-165 characters with the keyword')
  if (h2s < 3) suggestions.push(`Add ${3 - h2s} more H2 headings for better structure`)
  if (!text.toLowerCase().includes((top?.[0] || 'your topic').toLowerCase()) || (top?.[1] || 0) < 3) suggestions.push('Include the primary keyword in the first paragraph and repeat naturally')
  if (words.length < 600) suggestions.push(`Article is ${words.length} words — aim for 800+ for competitive ranking`)
  if (links < 2) suggestions.push('Add internal/external links (at least 2) for authority')
  if (alts === 0) suggestions.push('Add image alt texts for accessibility + SEO')
  if (sentences > 0 && words.length / Math.max(1, sentences) > 24) suggestions.push('Reduce passive voice — sentences are too long')
  if (!/## FAQ/i.test(body || '')) suggestions.push('Add an FAQ section (rich snippet opportunity)')
  return { seo, titleScore, metaScore, headScore, kw: Math.min(100, kw + 20), readScore, linkScore, slugScore, words: words.length, readTime, h2s, h3s, links, alts, top: top ? top[0] : null, density: words.length ? Math.round(((top?.[1] || 0) / words.length) * 100) : 0, suggestions: suggestions.slice(0, 6) }
}

export function SeoPanel({ post }) {
  const s = blogSeo(post?.title, post?.body_markdown, post?.seo_description, post?.slug, post?.image_ref)
  const rows = [
    ['Title', s.titleScore, '#7C3AED'], ['Meta Description', s.metaScore, '#3B82F6'], ['Headings', s.headScore, '#0EA37A'],
    ['Keyword Usage', s.kw, '#EC4899'], ['Readability', s.readScore, '#6366F1'], ['Links & Alt', s.linkScore, '#14B8A6'], ['URL/Slug', s.slugScore, '#F59E0B'],
  ]
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center gap-2 mb-3"><Gauge className="h-4 w-4 text-[#7C3AED]" /><h4 className="text-sm font-semibold text-[#16161D]">SEO Center</h4>
        <span className="ml-auto h-8 w-8 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-white" style={{ backgroundColor: s.seo >= 70 ? '#0EA37A' : s.seo >= 45 ? '#F59E0B' : '#EF4444' }}>{s.seo}</span>
      </div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r[0]}><div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-0.5"><span>{r[0]}</span><span className="font-mono">{r[1]}%</span></div>
            <div className="h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${r[1]}%`, backgroundColor: r[2] }} /></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#F0F1F5] text-center">
        <div><div className="text-sm font-bold text-[#16161D]">{s.words}</div><div className="text-[0.5rem] text-[#8A8A96]">Words</div></div>
        <div><div className="text-sm font-bold text-[#16161D]">{s.readTime}m</div><div className="text-[0.5rem] text-[#8A8A96]">Read</div></div>
        <div><div className="text-sm font-bold text-[#0EA37A]">{s.density}%</div><div className="text-[0.5rem] text-[#8A8A96]">Density</div></div>
      </div>
      {s.top && <div className="mt-2 rounded-lg bg-[#7C3AED]/5 border border-[#7C3AED]/10 p-2 text-[0.65rem] text-[#7C3AED]">Primary keyword: <b>"{s.top}"</b> · H2: {s.h2s} · Links: {s.links} · Alt tags: {s.alts}</div>}
    </div>
  )
}

export function SeoSuggestions({ post, onApply }) {
  const s = blogSeo(post?.title, post?.body_markdown, post?.seo_description, post?.slug)
  if (!s.suggestions.length) return null
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#EC4899]" /> AI Content Review</h4>
      <div className="space-y-2">
        {s.suggestions.map((sg, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[0.7rem] text-[#16161D] leading-snug flex-1">{sg}</span>
          </div>
        ))}
      </div>
      <button onClick={onApply} className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Apply suggested fixes</button>
    </div>
  )
}

export function GooglePreview({ post }) {
  const s = blogSeo(post?.title, post?.body_markdown, post?.seo_description, post?.slug)
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Search className="h-4 w-4 text-[#3B82F6]" /> Google Search Preview</h4>
      <div className="rounded-xl border border-[#EBECF2] bg-white p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="h-6 w-6 rounded-full bg-gradient-to-br from-[#4285F4] to-[#EA4335] flex items-center justify-center text-[0.5rem] font-bold text-white">G</span>
          <div><div className="text-[0.6rem] text-[#16161D] font-medium">insights.manikantar.in</div><div className="text-[0.5rem] text-[#8A8A96]">https://insights.manikantar.in/{post?.slug || 'article'}</div></div>
        </div>
        <div className="text-[0.75rem] leading-snug text-[#1A0DAB] font-medium mb-1">{post?.title || 'Untitled article'}</div>
        <p className="text-[0.65rem] text-[#4D5156] leading-relaxed">{post?.seo_description || 'Meta description will appear here — write 120-165 characters.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2"><div className="text-sm font-bold text-[#16161D]">{s.words}w</div><div className="text-[0.5rem] text-[#8A8A96]">Length</div></div>
        <div className="rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2"><div className="text-sm font-bold text-[#0EA37A]">{s.readTime}m</div><div className="text-[0.5rem] text-[#8A8A96]">Read time</div></div>
      </div>
    </div>
  )
}

export function AssistantPanel({ title, body, onInsert }) {
  const [gen, setGen] = useState(null)
  const text = (body || '').replace(/[#*`>]/g, '')
  const firstLine = (title || '').trim() || (text || 'Your topic').slice(0, 50)
  const intro = text.split(/\n+/).slice(0, 3).join(' ')
  const generate = (kind) => {
    const t = firstLine
    const out = {
      title_ideas: [`The Complete Guide to ${t} in 2026`, `${t}: What Nobody Tells You`, `Why ${t} Matters More Than Ever`, `10 Things I Learned About ${t}`, `${t} — The Honest Breakdown`],
      intro: `When it comes to ${t.toLowerCase()}, most advice misses the point. Here's the practical reality, explained simply. ${intro ? `\n\n${intro.slice(0, 200)}…` : ''}`,
      conclusion: `That's the honest take on ${t.toLowerCase()}. The key is to start small, stay consistent, and measure what works. Which part resonated with you most? Share it below — and save this for your next planning session.`,
      faq: `## FAQ\n\n**Is ${t} worth the effort?**\nYes — the returns compound over time when done consistently.\n\n**How long until results show?**\nMost see meaningful progress within 30-90 days.\n\n**What's the biggest mistake?**\nTrying to do everything at once instead of focusing on one proven approach.`,
      summary: `In short: ${t} comes down to focus, consistency, and iteration. Pick one method, execute for 30 days, and optimize from real data.`,
      cta: `Want more breakdowns like this? Subscribe to the newsletter — one actionable insight every week.`,
      quote: `> "${t} is not about doing more — it's about doing what matters, consistently."`,
      takeaways: `## Key Takeaways\n\n- Start with one focused approach\n- Measure results weekly, not daily\n- Double down on what works\n- Document the process as you go`,
      image_prompt: `Professional editorial illustration for "${t}": clean minimalist composition, warm modern palette (deep purple and coral accents), subtle depth of field, premium SaaS blog cover style, no text overlay`,
    }
    setGen({ kind, items: Array.isArray(out[kind]) ? out[kind] : [out[kind]], list: Array.isArray(out[kind]) })
  }
  const actions = [
    ['title_ideas', 'Title Ideas', FileText], ['intro', 'Introduction', Type], ['conclusion', 'Conclusion', Lightbulb], ['faq', 'FAQ Section', List],
    ['summary', 'Summary', BookOpen], ['cta', 'CTA', Send], ['quote', 'Pull Quote', Quote], ['takeaways', 'Key Takeaways', List], ['image_prompt', 'Image Prompt', ImageIcon2], ['table', 'Comparison Table', Table],
  ]
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Wand2 className="h-4 w-4 text-[#7C3AED]" /> AI Article Assistant</h4>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map(([k, l, Ic]) => (
          <button key={k} onClick={() => generate(k)} className="flex items-center gap-1.5 text-[0.62rem] font-semibold px-2 py-2 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">
            <Ic className="h-3.5 w-3.5" />{l}
          </button>
        ))}
      </div>
      {gen && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#7C3AED]">{gen.kind.replace('_', ' ')}</span>
            <div className="flex gap-1.5">
              <button onClick={() => onInsert(gen.items.join('\n\n'))} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-[#7C3AED] text-white"><Check className="h-3 w-3 inline mr-1" />Insert</button>
              <button onClick={() => { navigator.clipboard.writeText(gen.items.join('\n\n')); toast.success('Copied') }} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-[#F4F5F9]"><Copy className="h-3 w-3 inline mr-1" />Copy</button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {gen.items.map((it, i) => <p key={i} className="text-[0.7rem] text-[#16161D] leading-relaxed whitespace-pre-wrap">{it}</p>)}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export function RepurposePanel({ title, body, onDrip }) {
  const text = (body || '').replace(/[#*`>]/g, '').slice(0, 2000)
  const t = (title || 'This article').slice(0, 60)
  const items = {
    linkedin: `${t}\n\n${text.slice(0, 900)}\n\nWhat's your take? Drop a comment below — I reply to everyone.`,
    instagram: `${text.slice(0, 300)}\n\nSave this for later 🔖\n\n#${t.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 25)} #insights #thoughtleadership`,
    facebook: `${text.slice(0, 500)}\n\nHave you tried this approach? Tell me in the comments — this community learns together.`,
    threads: `${text.slice(0, 350)}\n\nWhat do you think? 👇`,
    newsletter: `Subject: ${t}\n\nHere's this week's deep dive:\n\n${text.slice(0, 600)}\n\nRead the full article → [LINK]\n\n— Your Brand`,
    email: `Subject: ${t}\n\nHi there,\n\n${text.slice(0, 400)}\n\n[Read the full article]\n\nBest,\nYour Brand`,
    twitter: `${text.slice(0, 260)}...\n\nRead more: ${t}`,
    youtube: `TITLE: ${t} — full breakdown\n\nDESCRIPTION:\n${text.slice(0, 800)}\n\nTAGS: ${t.toLowerCase().replace(/[^a-z0-9]+/g, ',')}`,
  }
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-[#EC4899]" /> Repurpose to Social</h4>
      <div className="space-y-1.5">
        {Object.entries(items).map(([k, v]) => (
          <div key={k} className="group flex items-center gap-2 rounded-lg border border-[#EBECF2] p-2 hover:border-[#D8C8FB] transition-colors">
            <span className="text-[0.65rem] font-bold capitalize text-[#7C3AED] w-20 shrink-0">{k}</span>
            <span className="text-[0.6rem] text-[#8A8A96] truncate flex-1">{v.slice(0, 60)}…</span>
            <button onClick={() => { navigator.clipboard.writeText(v); toast.success(`${k} copied`) }} className="text-[0.6rem] font-bold px-2 py-1 rounded-lg bg-[#F4F5F9] opacity-0 group-hover:opacity-100"><Copy className="h-3 w-3 inline mr-1" />Copy</button>
          </div>
        ))}
      </div>
      <button onClick={onDrip} className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899]">Schedule Drip Campaign (all platforms)</button>
    </div>
  )
}
