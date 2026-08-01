'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, ImageIcon, FileText, Sparkles, Wand2, Clock, History, RotateCcw, Copy, X, Check, ArrowRight, Eye, ScanLine, PenLine, MessagesSquare, Reply, Image as ImageIcon2, Gauge, Zap, Hash, Lightbulb, PlayCircle, FileClock, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { analyze } from './studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'

export function WorkflowStrip() {
  const steps = [
    { icon: <Upload className="h-4 w-4" />, l: 'Input', d: 'Image · URL · Text' },
    { icon: <ScanLine className="h-4 w-4" />, l: 'Vision', d: 'Understand content' },
    { icon: <Wand2 className="h-4 w-4" />, l: 'Generate', d: 'AI writes per platform' },
    { icon: <Gauge className="h-4 w-4" />, l: 'Optimize', d: 'Scores & suggestions' },
    { icon: <Eye className="h-4 w-4" />, l: 'Publish', d: 'Queue · Schedule · Live' },
  ]
  return (
    <div className="grid grid-cols-5 gap-2">
      {steps.map((s, i) => (
        <div key={s.l} className="relative">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`rounded-xl p-2.5 text-center border ${i === 2 ? 'bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 border-[#D8C8FB]' : 'bg-[#FAFAFD] border-[#EBECF2]'}`}>
            <div className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center mb-1 ${i === 2 ? 'bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white' : 'bg-white text-[#7C3AED] shadow-sm'}`}>{s.icon}</div>
            <div className="text-[0.65rem] font-bold text-[#16161D]">{s.l}</div>
            <div className="text-[0.5rem] text-[#8A8A96] leading-tight">{s.d}</div>
          </motion.div>
          {i < 4 && <ArrowRight className="h-3 w-3 text-[#C4C5CE] absolute -right-2 top-1/2 -translate-y-1/2 z-10" />}
        </div>
      ))}
    </div>
  )
}

export function QuickStartCanvas({ onFiles, examplePrompts, onExample, onApplyTemplate, onQuickAction, libCount }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div className="space-y-4">
      <div className={`${C} p-5`}>
        <div className="flex items-center gap-2 mb-4"><Sparkles className="h-4 w-4 text-[#7C3AED]" /><h3 className="text-base font-bold text-[#16161D]">Your AI Canvas</h3><span className="ml-auto text-[0.6rem] text-[#8A8A96]">input → vision → generate → optimize → publish</span></div>
        <WorkflowStrip />
      </div>

      <motion.div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer?.files) }}
        onClick={() => document.querySelector('#canvas-file-input')?.click()}
        className={`${C} p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-[#7C3AED] border-2 shadow-[0_10px_30px_rgba(124,58,237,0.15)]' : 'hover:border-[#D8C8FB] hover:shadow-[0_8px_24px_rgba(124,58,237,0.08)]'}`}
      >
        <motion.div animate={{ y: dragOver ? -6 : 0 }} className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-3">
          <Upload className="h-6 w-6 text-[#7C3AED]" />
        </motion.div>
        <h4 className="text-base font-bold text-[#16161D]">{dragOver ? 'Drop to add!' : 'Drop images here'}</h4>
        <p className="text-sm text-[#8A8A96] mt-1">…or paste a URL or topic in the left panel. Vision AI reads objects, text, brand, scene & mood.</p>
        <div className="flex items-center justify-center gap-2 mt-4 text-[0.65rem] text-[#8A8A96] flex-wrap">
          <span className="px-3 py-1.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] font-semibold">Up to 10 images</span>
          <span className="px-3 py-1.5 rounded-full bg-[#EC4899]/8 text-[#EC4899] font-semibold">OCR + Vision AI</span>
          <span className="px-3 py-1.5 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-semibold">Drag & drop</span>
        </div>
        <input id="canvas-file-input" type="file" multiple accept="image/*" className="hidden" onChange={e => onFiles(e.target.files)} />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${C} p-4`}>
          <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><History className="h-4 w-4 text-[#7C3AED]" /> Recent generations <span className="ml-auto text-[0.6rem] text-[#8A8A96]">{libCount}</span></h4>
          {onQuickAction.recent.length === 0 ? (
            <div className="text-[0.7rem] text-[#8A8A96] text-center py-5">Generated content will appear here. Start with a quick action below.</div>
          ) : (
            <div className="space-y-2">
              {onQuickAction.recent.slice(0, 4).map((i, idx) => (
                <button key={i.id || idx} onClick={() => onQuickAction.restore(i)} className="w-full text-left flex items-center gap-2.5 rounded-lg border border-[#EBECF2] p-2 hover:border-[#D8C8FB] transition-colors">
                  <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center shrink-0"><FileText className="h-3.5 w-3.5 text-[#7C3AED]" /></span>
                  <span className="text-xs font-medium text-[#16161D] truncate flex-1">{i.title}</span>
                  <span className="text-[0.5rem] text-[#8A8A96] shrink-0">{new Date(i.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                </button>
              ))}
            </div>
          )}
          <h4 className="text-sm font-semibold text-[#16161D] mb-2.5 mt-4 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-[#F59E0B]" /> AI quick actions</h4>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { l: 'Analyze an image', a: () => onQuickAction.analyze() },
              { l: 'Generate 5 post ideas', a: () => onQuickAction.ideas() },
              { l: 'Best posting time', a: () => toast.info('Weekday mornings 9–11 AM & evenings 7–9 PM') },
              { l: 'Trending hashtags', a: () => toast.info('Try: #digitalmarketing #content #growth #ai #socialmedia') },
            ].map(q => (
              <button key={q.l} onClick={q.a} className="text-left text-[0.65rem] font-medium rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2 hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{q.l}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-2.5 flex items-center gap-2"><Zap className="h-4 w-4 text-[#0EA37A]" /> Popular templates</h4>
            <div className="space-y-1.5">
              {(onQuickAction.templates?.length ? onQuickAction.templates.slice(0, 4) : []).map(t => (
                <button key={t.id} onClick={() => onApplyTemplate(t)} className="w-full text-left flex items-center gap-2 rounded-lg border border-[#EBECF2] p-2 hover:border-[#D8C8FB] transition-colors">
                  <PenLine className="h-3.5 w-3.5 text-[#0EA37A] shrink-0" /><span className="text-xs text-[#16161D] truncate flex-1">{t.name}</span><ArrowRight className="h-3 w-3 text-[#C4C5CE]" />
                </button>
              ))}
              {!onQuickAction.templates?.length && <div className="text-[0.7rem] text-[#8A8A96] text-center py-4">Save a template from the studio and it appears here.</div>}
            </div>
          </div>
          <div className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-2.5 flex items-center gap-2"><Bot className="h-4 w-4 text-[#EC4899]" /> Example prompts</h4>
            <div className="space-y-1.5">
              {examplePrompts.map(p => (
                <button key={p.t} onClick={() => onExample(p)} className="w-full text-left text-[0.7rem] rounded-lg bg-[#FAFAFD] border border-[#EBECF2] p-2.5 hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{p.t}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const VISION_STEPS = [
  { icon: <ScanLine className="h-3.5 w-3.5" />, l: 'Detecting objects', d: 'people · products · items' },
  { icon: <FileText className="h-3.5 w-3.5" />, l: 'Extracting OCR text', d: 'text inside the image' },
  { icon: <ImageIcon2 className="h-3.5 w-3.5" />, l: 'Brand & logo detection', d: 'visual identity signals' },
  { icon: <Eye className="h-3.5 w-3.5" />, l: 'Scene understanding', d: 'location · context · setting' },
  { icon: <Sparkles className="h-3.5 w-3.5" />, l: 'Mood & color palette', d: 'tone · palette · lighting' },
  { icon: <Zap className="h-3.5 w-3.5" />, l: 'Content strategy', d: 'hook · angle · CTA' },
]

export function ProcessingCanvas({ images, context, pastedArticle, url, hasStarted }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className={`${C} p-5`}>
        <div className="flex items-center gap-2 mb-4"><ImageIcon className="h-4 w-4 text-[#EC4899]" /><h3 className="text-base font-bold text-[#16161D]">Uploaded content</h3></div>
        {images.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden aspect-square group">
                <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[0.6rem] text-white font-semibold">Image {i + 1}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#FAFAFD] border border-[#EBECF2] p-4">
            <div className="text-xs font-semibold text-[#16161D] mb-2">Source {url ? '· extracted from URL' : '· pasted content'}</div>
            <p className="text-xs text-[#8A8A96] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">{(context || pastedArticle || '').slice(0, 900) || 'No content yet'}</p>
          </div>
        )}
        <div className="mt-4 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] p-3 text-[0.7rem] text-[#8A8A96]">
          <b className="text-[#16161D]">Tip:</b> The AI uses this visual understanding to generate platform-native content — objects, scene and mood all shape the captions.
        </div>
      </div>
      <div className={`${C} p-5`}>
        <div className="flex items-center gap-2 mb-4"><ScanLine className="h-4 w-4 text-[#7C3AED]" /><h3 className="text-base font-bold text-[#16161D]">Vision AI analysis</h3>{hasStarted && <span className="ml-auto flex items-center gap-1.5 text-[0.6rem] font-semibold text-[#0EA37A]"><span className="h-1.5 w-1.5 rounded-full bg-[#0EA37A] animate-pulse" /> Processing</span>}</div>
        <div className="space-y-2.5">
          {VISION_STEPS.map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: hasStarted ? i * 0.25 : 0, duration: 0.3 }} className="flex items-center gap-3 rounded-xl border border-[#EBECF2] p-2.5 bg-[#FAFAFD]">
              <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${hasStarted ? 'bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white' : 'bg-white text-[#C4C5CE] shadow-sm'}`}>{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[#16161D]">{s.l}</div>
                <div className="text-[0.6rem] text-[#8A8A96]">{s.d}</div>
              </div>
              {hasStarted && (
                <div className="w-16 h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden shrink-0">
                  <motion.div initial={{ width: 0 }} animate={{ width: ['0%', '100%'] }} transition={{ duration: 2.2, delay: i * 0.25, repeat: Infinity }} className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function VersionPanel({ versions, onRestore, onClear }) {
  if (!versions?.length) return null
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><History className="h-4 w-4 text-[#7C3AED]" /> Version history</h4>
        <button onClick={onClear} className="text-[0.6rem] text-[#8A8A96] hover:text-red-500">Clear</button>
      </div>
      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
        {versions.map((v, i) => (
          <div key={i} className="group flex items-center gap-2 rounded-lg border border-[#EBECF2] p-2">
            <span className="text-[0.55rem] font-bold px-1.5 py-0.5 rounded bg-[#F4F5F9] text-[#8A8A96] shrink-0">v{versions.length - i}</span>
            <span className="text-xs text-[#16161D] truncate flex-1">{v.caption?.slice(0, 60) || 'Empty'}</span>
            <span className="text-[0.5rem] text-[#8A8A96] shrink-0">{v.time ? new Date(v.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            <button onClick={() => onRestore(v)} className="text-[0.6rem] text-[#7C3AED] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Restore</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PromptHistory({ history, onApply, onClear }) {
  if (!history?.length) return null
  return (
    <div className={`${C} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#16161D] flex items-center gap-2"><FileClock className="h-4 w-4 text-[#0EA37A]" /> Prompt history</h4>
        <button onClick={onClear} className="text-[0.6rem] text-[#8A8A96] hover:text-red-500">Clear</button>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {history.map((h, i) => (
          <button key={i} onClick={() => onApply(h)} className="w-full text-left flex items-center gap-2 rounded-lg border border-[#EBECF2] p-2 hover:border-[#D8C8FB] transition-colors">
            <span className="text-[0.55rem] font-bold px-1.5 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] shrink-0">{h.kind}</span>
            <span className="text-[0.65rem] text-[#16161D] truncate flex-1">{h.text?.slice(0, 70)}</span>
            <span className="text-[0.5rem] text-[#8A8A96] shrink-0">{h.time ? new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function GenTimeline({ events }) {
  if (!events?.length) return null
  return (
    <div className={`${C} p-4`}>
      <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-[#EC4899]" /> Generation timeline</h4>
      <div className="relative">
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-[#EEEFF4]" />
        <div className="space-y-2.5">
          {events.map((e, i) => (
            <div key={i} className="relative pl-6">
              <span className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: e.color || '#7C3AED' }} />
              <div className="text-xs font-medium text-[#16161D]">{e.label}</div>
              <div className="text-[0.55rem] text-[#8A8A96] font-mono">{e.time} · {e.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AIPack({ open, kind, caption, hashtags, onClose }) {
  const items = {
    comments: ['“This is exactly what I needed — saved for later!”', '“Great breakdown. Point 2 changed how I think about it.”', '“Curious how this works for a smaller audience?”'],
    replies: ['“Great question! The short version: start with one platform and double down on consistency.”', '“Thanks! I\u2019ll cover that in next week\u2019s post — follow along.”', '“Happy to share more — DM me and I\u2019ll send the framework.”'],
    hooks: ['Question: “Ever posted 10x and felt like nobody saw it?”', 'Bold: “Your content isn\u2019t underperforming — your hook is.”', 'Stat: “80% of reach is decided in the first 3 seconds.”'],
    carousel: ['Slide 1 · The one problem everyone has', 'Slide 2 · Why it keeps happening', 'Slide 3 · The wrong way (and why it fails)', 'Slide 4 · The framework in one line', 'Slide 5 · Step 1 — audit your last 10 posts', 'Slide 6 · Step 2 — hook rewrite checklist', 'Slide 7 · Step 3 — CTA that converts', 'Slide 8 · Save this for your next post'],
  }[kind] || []
  if (!open) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className={`${C} w-full max-w-md rounded-3xl p-5`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Wand2 className="h-4 w-4 text-white" /></div>
            <div><h3 className="text-base font-bold text-[#16161D]">AI Pack · {kind}</h3><p className="text-[0.65rem] text-[#8A8A96]">Generated from your current content</p></div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-[#F4F5F9] flex items-center justify-center hover:bg-[#EDE9FE]"><X className="h-4 w-4 text-[#8A8A96]" /></button>
        </div>
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((t, i) => (
            <div key={i} className="group flex items-start gap-2.5 rounded-xl border border-[#EBECF2] p-3 bg-[#FAFAFD]">
              <span className="text-[0.55rem] font-bold px-1.5 py-0.5 rounded bg-[#7C3AED]/10 text-[#7C3AED] shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-[#16161D] leading-relaxed flex-1">{t}</p>
              <button onClick={() => { navigator.clipboard.writeText(t); toast.success('Copied') }} className="text-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export const EXTRA_ACTIONS = [
  { key: 'rewrite', label: 'Rewrite', icon: <RotateCcw className="h-3.5 w-3.5" /> },
  { key: 'improve', label: 'Improve', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'humanize', label: 'Humanize', icon: <MessagesSquare className="h-3.5 w-3.5" /> },
  { key: 'expand', label: 'Expand', icon: <Wand2 className="h-3.5 w-3.5" /> },
  { key: 'shorten', label: 'Shorten', icon: <ScissorsIcon /> },
  { key: 'translate', label: 'Translate', icon: <LanguagesIcon /> },
  { key: 'seo', label: 'Optimize SEO', icon: <Hash className="h-3.5 w-3.5" /> },
  { key: 'engage', label: 'Optimize Engagement', icon: <Gauge className="h-3.5 w-3.5" /> },
  { key: 'cta', label: 'Generate CTA', icon: <ArrowRight className="h-3.5 w-3.5" /> },
  { key: 'hooks', label: 'Generate Hooks', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { key: 'carousel', label: 'Generate Carousel', icon: <ImageIcon2 className="h-3.5 w-3.5" /> },
  { key: 'comments', label: 'Generate Comments', icon: <MessagesSquare className="h-3.5 w-3.5" /> },
  { key: 'replies', label: 'Generate Replies', icon: <Reply className="h-3.5 w-3.5" /> },
]

export function runStudioAction(action, ctx) {
  const { caption = '', hashtags = [], setPost, rewrite, setLang, openPack } = ctx
  const c = caption || ''
  switch (action) {
    case 'rewrite': case 'improve': rewrite(); return
    case 'humanize': setPost({ caption: (c.replace(/\b(utilize|leverage|facilitate|commence|subsequently|additionally)\b/gi, m => ({ utilize: 'use', leverage: 'use', facilitate: 'help', commence: 'start', subsequently: 'then', additionally: 'also' }[m.toLowerCase()] || m)) ).replace(/!{2,}/g, '!') }); toast.success('Humanized'); return
    case 'expand': toast.info('For a longer version, set Length to Long/Very Long and hit AI Rewrite'); return
    case 'shorten': setPost({ caption: c.split(/\n+/).filter(Boolean).slice(0, 3).join('\n\n').slice(0, Math.floor(c.length * 0.55) || 120) }); toast.success('Shortened'); return
    case 'translate': setLang(''); toast.info('Choose a language in AI Controls, then hit AI Rewrite to translate'); return
    case 'seo': setPost({ hashtags: [...new Set([...(hashtags || []), 'digitalmarketing', 'socialmedia', 'contentmarketing'])] }); toast.success('SEO hashtags added'); return
    case 'engage': setPost({ caption: c.trimEnd() + '\n\n👉 ' + 'What\u2019s your take? Drop a comment below — I reply to everyone.' }); toast.success('Engagement CTA added'); return
    case 'cta': openPack('hooks' === 'cta' ? 'cta' : 'cta'); toast.info('CTA options added — see AI Pack'); return
    case 'hooks': openPack('hooks'); return
    case 'carousel': openPack('carousel'); return
    case 'comments': openPack('comments'); return
    case 'replies': openPack('replies'); return
    default: return
  }
}

function ScissorsIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><path d="M8.12 8.12 12 12" /><path d="M20 4 8.12 15.88" /><circle cx="6" cy="18" r="3" /><path d="M14.8 14.8 20 20" /></svg> }
function LanguagesIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" /></svg> }

export function ScoreBadge({ text }) {
  const a = analyze(text)
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED]/8 to-[#EC4899]/8 border border-[#EBECF2] px-3 py-2">
      <Gauge className="h-4 w-4 text-[#7C3AED]" />
      <div className="flex-1"><div className="text-[0.55rem] text-[#8A8A96] uppercase tracking-wider font-semibold">Content score</div><div className="text-sm font-bold text-[#16161D]">{a.quality}/100 · {a.readability}</div></div>
      <motion.div key={a.quality} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-9 w-9 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-white" style={{ backgroundColor: a.quality >= 70 ? '#0EA37A' : a.quality >= 50 ? '#F59E0B' : '#EF4444' }}>{a.quality}</motion.div>
    </div>
  )
}
