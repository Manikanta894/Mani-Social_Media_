'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, ImageIcon, Star, Wand2, Loader2, Send, Save, RefreshCw, Copy, X, Sparkles, ArrowRight, KeyRound, Clock, List, Link, ChevronDown, SlidersHorizontal, Bot, Zap, FolderPlus, PlayCircle, Trash2, Type, FileText, PenLine, LayoutDashboard, Hash } from 'lucide-react'
import { api, PLATFORMS, resizeImageToBase64 } from '@/components/shared'
import { DEFAULT_PILLARS } from '@/lib/content-pillars'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisPanel, PlatformPreview, ContentLibrary, SuggestionPanel, AIChat, QUICK_ACTIONS, runQuickAction, M, TYPES, REAL_KEYS } from './studio-components'
import { QuickStartCanvas, ProcessingCanvas, VersionPanel, PromptHistory, GenTimeline, AIPack, EXTRA_ACTIONS, runStudioAction, ScoreBadge } from './canvas-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }

const TONES = ['Professional', 'Friendly', 'Luxury', 'Corporate', 'Inspirational', 'Educational', 'Technical', 'Funny', 'Minimal', 'Storytelling']
const AUDIENCES = ['Students', 'HR Professionals', 'Founders', 'Developers', 'Recruiters', 'Businesses', 'Customers', 'Investors']
const LENGTHS = ['Very Short', 'Short', 'Medium', 'Long', 'Very Long']
const CTAS = ['Soft', 'Strong', 'Sales', 'Community', 'Newsletter']
const LANGS = ['English', 'Kannada', 'Hindi', 'Tamil', 'Telugu']
const HOOKS = ['Question', 'Bold statement', 'Story', 'Statistic', 'Pain point', 'Curiosity gap']
const GOALS = ['Awareness', 'Engagement', 'Leads', 'Sales', 'Thought leadership', 'Community']
const LEVELS = ['Beginner', 'Intermediate', 'Expert']

const BRIEFS = {
  social: 'Write a native social media post.',
  blog: 'Write as a long-form SEO blog article: title, intro, 4-6 H2 sections, conclusion. Use markdown.',
  'linkedin-art': 'Write a LinkedIn article: headline, 5-7 sections with subheadings, conclusion.',
  newsletter: 'Write a newsletter: greeting, 3 highlight bullets, main story, sign-off.',
  email: 'Write an email campaign: subject line, preheader, body, single CTA button.',
  news: 'Write a news-style post: headline, lead paragraph, key facts.',
  product: 'Write a persuasive product description with benefits and features.',
  landing: 'Write landing page copy: headline, subheadline, 3 benefits, social proof, CTA.',
  press: 'Write a press release: headline, dateline, quotes, boilerplate.',
  case: 'Write a case study: challenge, solution, results with metrics.',
  video: 'Write a video script with scene directions, hook, body, outro CTA.',
  youtube: 'Write a YouTube script: SEO title, description with timestamps, tags.',
  podcast: 'Write a podcast episode script: intro, segments, questions, outro.',
  carousel: 'Write carousel copy: 8 slides with short titles.',
  story: 'Write a short story caption under 400 chars with a poll CTA.',
  reel: 'Write a punchy reel caption with 3-5 trending hashtags.',
  thread: 'Write a Twitter/X thread: 8-12 short numbered tweets under 280 chars.',
}

const EXAMPLE_PROMPTS = [
  { t: 'Turn my product launch into social posts', kind: 'social' },
  { t: 'Write an SEO blog about remote work', kind: 'blog' },
  { t: 'Turn this research into a LinkedIn article', kind: 'linkedin-art' },
  { t: 'Create a hiring announcement thread', kind: 'thread' },
]

export default function ComposePage() {
  const router = useRouter()
  const [providers, setProviders] = useState([])
  const [styles, setStyles] = useState([])
  const [images, setImages] = useState([])
  const [context, setContext] = useState('')
  const [styleId, setStyleId] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [regenerating, setRegenerating] = useState(null)
  const [url, setUrl] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [tone, setTone] = useState(50)
  const [pillar, setPillar] = useState('general')
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [costEstimate, setCostEstimate] = useState(null)
  const [emojiEnabled, setEmojiEnabled] = useState(true)
  const [emojiDensity, setEmojiDensity] = useState(50)
  const [pastedArticle, setPastedArticle] = useState('')
  const [kind, setKind] = useState('social')
  const [selPlatforms, setSelPlatforms] = useState(REAL_KEYS)
  const [toneLabel, setToneLabel] = useState('Professional')
  const [audience, setAudience] = useState('')
  const [length, setLength] = useState('Medium')
  const [cta, setCta] = useState('Soft')
  const [lang, setLang] = useState('English')
  const [hashtagDensity, setHashtagDensity] = useState(50)
  const [hook, setHook] = useState('')
  const [creativity, setCreativity] = useState(50)
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('linkedin')
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [inputTab, setInputTab] = useState('images')
  const [library, setLibrary] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_studio_library')) || [] } catch { return [] } })
  const [versions, setVersions] = useState([])
  const [promptHistory, setPromptHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('sf_prompt_history')) || [] } catch { return [] } })
  const [timeline, setTimeline] = useState([])
  const [packOpen, setPackOpen] = useState(null)
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    (async () => {
      try {
        const [p, s, t, c] = await Promise.all([
          api('/providers'), api('/prompt-styles'),
          api('/templates').catch(() => []),
          api('/cost-estimate').catch(() => ({ estimated: '0.00' })),
        ])
        setProviders(p); setStyles(s); setTemplates(t); setCostEstimate(c)
        if (s.length > 0) setStyleId(prev => prev || (s.find(x => x.is_active) || s[0])?.id || null)
      } catch (e) { toast.error(e.message) }
    })()
  }, [])

  const activeVision = providers.find(p => p.active_for_vision)
  const activeText = providers.find(p => p.active_for_text)
  const canGenerate = !!activeText && !generating && ((images.length > 0) || context.trim().length > 0 || pastedArticle.trim().length > 0)

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') { e.preventDefault(); if (canGenerate) generate() }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (result) { saveJob({}); } }
      else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); if (result) saveJob({ publishNow: true }) }
      else if (mod && e.key === '/') { e.preventDefault(); setPrompt(''); document.querySelector('#prompt-builder')?.focus(); toast.info('AI command prompt ready') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canGenerate, result])

  const buildInstruction = () => {
    const parts = [BRIEFS[kind] || 'Write a native social media post.']
    if (toneLabel !== 'Professional') parts.push(`Writing tone: ${toneLabel.toLowerCase()}.`)
    if (audience) parts.push(`Target audience: ${audience}.`)
    if (goal) parts.push(`Goal: ${goal.toLowerCase()}.`)
    if (level) parts.push(`Reading level: ${level.toLowerCase()}.`)
    parts.push(`Content length: ${length.toLowerCase()}.`)
    parts.push(`CTA style: ${cta.toLowerCase()}.`)
    if (lang !== 'English') parts.push(`Write entirely in ${lang}.`)
    if (hook) parts.push(`Open with a hook: ${hook.toLowerCase()}.`)
    parts.push(`Creativity: ${creativity}/100.`)
    if (emojiEnabled) parts.push(`Use emojis at density ${emojiDensity}/100.`)
    else parts.push('Do NOT use any emojis.')
    parts.push(`Hashtag density: ${hashtagDensity}/100 for IG/Threads/X only.`)
    if (prompt.trim()) parts.push(`Additional instructions: ${prompt.trim()}`)
    return parts.join(' ')
  }

  const handleFile = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const newImages = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image.`); continue }
      try { const resized = await resizeImageToBase64(file); newImages.push({ file, ...resized }) }
      catch (e) { toast.error(`Failed to process ${file.name}`) }
    }
    if (newImages.length === 0) return
    setPastedArticle('')
    setImages(prev => { const combined = [...prev, ...newImages]; return combined.slice(0, 10) })
    setResult(null)
  }

  useEffect(() => {
    const el = dropRef.current; if (!el) return
    const onDrag = (e) => { e.preventDefault(); e.stopPropagation() }
    const onDrop = (e) => { e.preventDefault(); const files = e.dataTransfer?.files; if (files && files.length > 0) handleFile(files) }
    el.addEventListener('dragover', onDrag); el.addEventListener('drop', onDrop)
    return () => { el.removeEventListener('dragover', onDrag); el.removeEventListener('drop', onDrop) }
  }, [])

  const removeImage = (index) => { setImages(prev => prev.filter((_, i) => i !== index)); setResult(null) }
  const moveImage = (index, direction) => { setImages(prev => { const arr = [...prev]; const target = index + direction; if (target < 0 || target >= arr.length) return arr; [arr[index], arr[target]] = [arr[target], arr[index]]; return arr }) }

  const extractUrl = async () => {
    if (!url.trim()) { toast.error('Enter a URL first'); return }
    setImages([]); setExtracting(true)
    try {
      const data = await api('/extract', { method: 'POST', body: { url: url.trim() } })
      const parts = []; if (data.title) parts.push(`Title: ${data.title}`); if (data.description) parts.push(data.description); if (data.body) parts.push(data.body)
      const extracted = parts.join('\n\n'); setContext(prev => prev ? `${prev}\n\n${extracted}` : extracted); toast.success('Content extracted')
    } catch (e) { toast.error(e.message) } finally { setExtracting(false) }
  }

  const generate = useCallback(async () => {
    if (!activeText) { toast.error('Set a text provider active in Settings first.'); router.push('/settings'); return }
    setGenerating(true); setResult(null)
    try {
      const started = Date.now()
      const contextData = [context.trim(), pastedArticle.trim(), buildInstruction()].filter(Boolean).join('\n\n')
      const payload = { context: contextData, styleId: styleId || undefined, tone, pillar: pillar || undefined, emoji_instruction: emojiEnabled ? `Emoji density ${emojiDensity}/100` : 'No emojis' }
      if (images.length > 0 && !context.trim() && !pastedArticle.trim()) {
        payload.images = images.map(i => ({ base64: i.base64, mimeType: i.mimeType }))
        payload.image_base64 = images[0].base64
        payload.mime_type = images[0].mimeType
      }
      const data = await api('/generate', { method: 'POST', body: payload })
      setResult({ ...data, ms: Date.now() - started, topic: (context || pastedArticle || 'AI Content').slice(0, 80) })
      setActiveTab('linkedin')
      const now = new Date().toISOString()
      setVersions([{ time: now, caption: data.posts?.linkedin?.caption || '', hashtags: data.posts?.linkedin?.hashtags || [] }])
      const ph = [{ time: now, kind, text: (context || pastedArticle || 'AI Content').slice(0, 80), platforms: selPlatforms.join('+') }, ...promptHistory].slice(0, 12)
      setPromptHistory(ph); localStorage.setItem('sf_prompt_history', JSON.stringify(ph))
      setTimeline([
        { label: 'Input analyzed', time: '0.0s', detail: `${images.length} image(s) · ${selPlatforms.length} platforms`, color: '#7C3AED' },
        { label: 'Vision understanding complete', time: `${((started) / 1000).toFixed(1)}s`, detail: 'objects · OCR · scene · mood', color: '#8B5CF6' },
        { label: 'Content generated', time: `${((Date.now() - started) / 1000).toFixed(1)}s`, detail: 'unique copy per platform', color: '#0EA37A' },
        { label: 'Optimization ready', time: `${((Date.now() - started + 500) / 1000).toFixed(1)}s`, detail: 'hashtags · CTA · scores', color: '#EC4899' },
      ])
      toast.success(`Generated in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }, [activeText, context, pastedArticle, buildInstruction, styleId, tone, pillar, emojiEnabled, emojiDensity, images, router])

  const updatePost = (platform, patch) => {
    setResult(prev => prev && ({ ...prev, posts: { ...prev.posts, [platform]: { ...prev.posts[platform], ...patch } } }))
    if (patch.caption && platform === (activeTab || 'linkedin')) {
      setVersions(vs => [{ time: new Date().toISOString(), caption: patch.caption, hashtags: patch.hashtags || [] }, ...vs].slice(0, 10))
    }
  }

  const regenerate = useCallback(async (platform) => {
    setRegenerating(platform)
    try {
      const post = await api('/regenerate', {
        method: 'POST', body: {
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          context: [context.trim(), pastedArticle.trim(), buildInstruction()].filter(Boolean).join('\n\n'),
          styleId: styleId || undefined, platform,
          currentResearchContext: result?.research_context, tone,
        },
      })
      updatePost(platform, post); toast.success(`Rewrote ${M[platform]?.label || platform}`)
    } catch (e) { toast.error(e.message) } finally { setRegenerating(null) }
  }, [images, context, pastedArticle, buildInstruction, styleId, tone, result])

  const saveJob = useCallback(async ({ publishNow = false, scheduleFor = null } = {}) => {
    const r = result; if (!r) return null
    try {
      let status = 'draft'
      if (publishNow) status = 'approved'
      else if (scheduleFor) status = 'scheduled'
      const toneAdj = (tone - 50) / 50
      const job = await api('/jobs', {
        method: 'POST', body: {
          source: 'ai_manual', topic: (context || pastedArticle || 'AI Content').slice(0, 120), pillar,
          tone_adjustment: toneAdj, scheduled_for: scheduleFor,
          image_refs: images.map(i => i.preview || i.base64?.slice(0, 40) || ''),
          research_context: r.research_context,
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          image_base64: images[0]?.base64 || undefined,
          image_mime: images[0]?.mimeType || undefined,
          style_id: r.style_used?.id, style_name: r.style_used?.name,
          platform_posts: r.posts, warnings: r.warnings, status,
        },
      })
      if (publishNow) {
        try { const pr = await api(`/publish/${job.id}`, { method: 'POST', body: {} }); const ok = pr.results.filter(x => x.ok).length; const fail = pr.results.length - ok; toast.success(`Published to ${ok} platform(s)${fail ? ` · ${fail} failed` : ''}`) }
        catch (e) { toast.error('Publish: ' + e.message) }
      } else if (scheduleFor) {
        toast.success(`Scheduled for ${new Date(scheduleFor).toLocaleString()}`)
      } else {
        toast.success('Sent to approval queue')
        try { await api('/telegram/send-draft', { method: 'POST', body: { jobId: job.id } }) } catch {}
      }
      return job
    } catch (e) { toast.error(e.message); return null }
  }, [result, context, pastedArticle, pillar, tone, images])

  const derived = useMemo(() => {
    if (!result?.posts) return {}
    const li = result.posts.linkedin?.caption || ''
    const ig = result.posts.instagram?.caption || li
    return {
      twitter: { caption: (li || ig).replace(/[^\S\n]+/g, ' ').slice(0, 280), hashtags: ['marketing', 'growth'] },
      youtube: { caption: `TITLE: ${(result.topic || 'AI Content').slice(0, 70)}\n\nDESCRIPTION:\n${(li || ig).slice(0, 1200)}\n\nTAGS: socialmedia, marketing, content, ai` },
      blog: { caption: `# ${(result.topic || 'AI Content')}\n\n${(li || ig).split(/\n+/).slice(0, 6).map(l => `## ${l.slice(0, 80)}`).join('\n\n')}\n\n*Generated by SocialForge AI Content Studio*` },
      newsletter: { caption: `Subject: ${(result.topic || 'Your AI update')}\n\nHey there\n\nHere's what's new this week:\n\n• ${(li || ig).slice(0, 140)}...\n• ${(ig || li).slice(0, 120)}...\n\nRead more → [LINK]\n\n— Your Brand` },
    }
  }, [result])

  const allTabs = useMemo(() => {
    const tabs = []
    for (const p of selPlatforms) if (result?.posts?.[p]) tabs.push(p)
    for (const d of Object.keys(derived)) tabs.push(d)
    return [...new Set(tabs)]
  }, [selPlatforms, result, derived])

  const activePost = result?.posts?.[activeTab] || derived[activeTab]
  const activeHashtags = activePost?.hashtags || []
  const libCount = library.length

  const applyExample = (p) => { setKind(p.kind); setContext(prev => prev || p.t); setInputTab('text') }

  if (providers.length === 0) return <OnboardingEmptyState />
  if (!activeText) return <MissingActiveProvider />

  return (
    <div className="max-w-[1720px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl overflow-hidden bg-gradient-to-r from-[#1A1037] via-[#2A1B52] to-[#4C1D63] relative">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#EC4899]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#7C3AED]/30 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg shadow-[#7C3AED]/30"><Wand2 className="h-7 w-7 text-white" /></div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">AI Content Studio</h1>
              <p className="text-sm text-white/60 mt-0.5">Create platform-native, high-performing content using one intelligent AI workspace.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {[{ l: 'New Social Post', k: 'social' }, { l: 'New Blog', k: 'blog' }, { l: 'Repurpose Content', k: 'case' }, { l: 'Import Content', k: 'news' }, { l: 'AI Calendar', k: 'carousel' }, { l: 'Templates', k: 'press' }].map(qa => (
              <button key={qa.k} onClick={() => setKind(qa.k)} className="text-xs font-semibold px-4 py-2 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">{qa.l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-5">
            {[
              { l: 'AI Model', v: activeText.name },
              { l: 'Vision', v: activeVision ? 'Ready' : 'Text only' },
              { l: 'Est. Cost', v: `$${costEstimate?.estimated || '0.00'}` },
              { l: 'Speed', v: '~15s / post' },
              { l: 'Shortcuts', v: '⌘Enter · ⌘S · ⌘P' },
            ].map(s => (
              <div key={s.l} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                <div className="text-[0.55rem] text-white/50 uppercase tracking-wider font-semibold">{s.l}</div>
                <div className="text-sm font-bold text-white mt-0.5 truncate">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_330px] gap-5 items-start">
        {/* ================= LEFT ================= */}
        <div className="space-y-4">
          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><PenLine className="h-4 w-4 text-[#7C3AED]" /> Content Type</h4>
            <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
              {TYPES.map(t => (
                <button key={t.key} onClick={() => setKind(t.key)} className={`rounded-xl p-3 text-left transition-all ${kind === t.key ? 'bg-gradient-to-br ' + t.g + ' text-white shadow-md scale-[1.01]' : 'bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]'}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-1.5 ${kind === t.key ? 'bg-white/20 text-white' : 'bg-white text-[#7C3AED] shadow-sm'}`}>{t.icon}</div>
                  <div className={`text-xs font-bold leading-tight ${kind === t.key ? 'text-white' : 'text-[#16161D]'}`}>{t.label}</div>
                  <div className={`text-[0.55rem] mt-0.5 leading-snug ${kind === t.key ? 'text-white/70' : 'text-[#8A8A96]'}`}>{t.desc}</div>
                  <div className={`text-[0.5rem] mt-1 font-mono ${kind === t.key ? 'text-white/60' : 'text-[#8A8A96]'}`}>{t.plats} · {t.time}</div>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-[#3B82F6]" /> Platforms</h4>
            <div className="grid grid-cols-2 gap-2">
              {REAL_KEYS.map(k => {
                const v = M[k]; const on = selPlatforms.includes(k)
                return (
                  <button key={k} onClick={() => setSelPlatforms(s => on ? s.filter(x => x !== k) : [...s, k])} className={`rounded-xl p-2.5 text-left border transition-all ${on ? 'shadow-sm' : 'bg-[#F8F9FC] border-[#EBECF2] opacity-70 hover:opacity-100'}`} style={on ? { backgroundColor: `${v.color}08`, borderColor: v.color } : {}}>
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg flex items-center justify-center text-[0.6rem] font-bold text-white shrink-0" style={{ backgroundColor: v.color }}>{v.label[0]}</span>
                      <span className="text-xs font-bold" style={{ color: on ? v.color : '#16161D' }}>{v.label}</span>
                      <span className={`ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center ${on ? 'border-[#7C3AED]' : 'border-[#D8D9E3]'}`}>{on && <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />}</span>
                    </div>
                    <div className="text-[0.55rem] text-[#8A8A96] mt-1.5 leading-snug">{v.style}</div>
                    <div className="flex gap-1 mt-1">
                      <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[#F4F5F9] font-mono">{v.limit} chars</span>
                      <span className="text-[0.5rem] px-1.5 py-0.5 rounded-full bg-[#F4F5F9]">{v.cta}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="text-[0.65rem] text-[#8A8A96] mt-2.5">Auto-derived: <b>X · YouTube · Blog · Newsletter</b> — unique content per platform, never one generic caption.</div>
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-[#EC4899]" /> Input Sources</h4>
            <div className="flex gap-1 bg-[#F4F5F9] rounded-xl p-1 mb-3">
              {[{ k: 'images', l: 'Images' }, { k: 'url', l: 'URL' }, { k: 'text', l: 'Text' }, { k: 'topic', l: 'Topic' }].map(t => (
                <button key={t.k} onClick={() => setInputTab(t.k)} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${inputTab === t.k ? 'bg-white shadow-sm text-[#7C3AED]' : 'text-[#8A8A96] hover:text-[#16161D]'}`}>{t.l}</button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {inputTab === 'images' && (
                <motion.div key="img" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div ref={dropRef} onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[#E5E6EF] hover:border-[#7C3AED]/40 rounded-xl overflow-hidden cursor-pointer transition-colors bg-[#FAFAFD]">
                    {images.length > 0 ? (
                      <div className="p-2.5">
                        <div className="flex gap-2 overflow-x-auto pb-1.5">
                          {images.map((img, i) => (
                            <div key={i} className="relative group shrink-0">
                              <img src={img.previewUrl} alt="" className="w-16 h-16 object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-0.5">
                                {i > 0 && <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1) }} className="text-white text-[0.6rem] px-1 hover:bg-white/20 rounded">↑</button>}
                                {i < images.length - 1 && <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1) }} className="text-white text-[0.6rem] px-1 hover:bg-white/20 rounded">↓</button>}
                                <button onClick={(e) => { e.stopPropagation(); removeImage(i) }} className="text-white text-[0.6rem] px-1 hover:bg-white/20 rounded">✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[0.6rem] text-[#8A8A96]">{images.length}/10 · drop more to add · drag to reorder</div>
                      </div>
                    ) : (
                      <div className="p-10 flex flex-col items-center gap-2 text-[#8A8A96]">
                        <ImageIcon className="h-7 w-7 text-[#C4C5CE]" />
                        <div className="text-sm font-semibold text-[#16161D]">Drop images or click</div>
                        <div className="text-xs">OCR · Vision AI detects objects, scene, brand, mood & colors</div>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
                  </div>
                </motion.div>
              )}
              {inputTab === 'url' && (
                <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste website / blog / LinkedIn / YouTube URL…" className="w-full rounded-xl border border-[#EBECF2] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <button onClick={extractUrl} disabled={extracting || !url.trim()} className="w-full rounded-xl bg-[#7C3AED] text-white text-sm font-semibold py-2.5 disabled:opacity-50">{extracting ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : <Link className="h-4 w-4 inline mr-2" />}Extract title, content & SEO metadata</button>
                  <div className="text-xs text-[#8A8A96]">Extracts title, images, main content, keywords — then summarizes before generation.</div>
                </motion.div>
              )}
              {inputTab === 'text' && (
                <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <textarea value={pastedArticle} onChange={e => { setPastedArticle(e.target.value); setImages([]) }} placeholder="Paste raw text, markdown, research paper, email, or a LinkedIn post…" rows={6} className="w-full rounded-xl border border-[#EBECF2] px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {['PDF', 'DOCX', 'PPTX', 'TXT', 'Markdown', 'Research', 'Email'].map(f => <span key={f} className="text-[0.6rem] px-2.5 py-1 rounded-full bg-[#F4F5F9] text-[#8A8A96] border border-[#EBECF2]">{f}</span>)}
                  </div>
                </motion.div>
              )}
              {inputTab === 'topic' && (
                <motion.div key="topic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                  <input value={context} onChange={e => setContext(e.target.value)} placeholder="Type a topic or keywords…" className="w-full rounded-xl border border-[#EBECF2] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXAMPLE_PROMPTS.map(p => <button key={p.t} onClick={() => applyExample(p)} className="text-[0.65rem] text-left rounded-lg bg-[#F8F9FC] border border-[#EBECF2] p-2.5 hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{p.t}</button>)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#0EA37A]" /> AI Controls</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                <select value={toneLabel} onChange={e => setToneLabel(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">{TONES.map(t => <option key={t}>{t}</option>)}</select>
                <select value={audience} onChange={e => setAudience(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">Audience…</option>{AUDIENCES.map(a => <option key={a}>{a}</option>)}</select>
                <select value={goal} onChange={e => setGoal(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">Goal…</option>{GOALS.map(g => <option key={g}>{g}</option>)}</select>
                <select value={level} onChange={e => setLevel(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">Reading level…</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select>
                <select value={length} onChange={e => setLength(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">{LENGTHS.map(l => <option key={l}>{l}</option>)}</select>
                <select value={cta} onChange={e => setCta(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">{CTAS.map(c => <option key={c}>CTA: {c}</option>)}</select>
                <select value={lang} onChange={e => setLang(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">{LANGS.map(l => <option key={l}>{l}</option>)}</select>
                <select value={hook} onChange={e => setHook(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">Hook style…</option>{HOOKS.map(h => <option key={h}>{h}</option>)}</select>
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#8A8A96] mb-1"><span>Formal ←→ Casual</span><span className="font-mono text-[#16161D]">{tone}</span></div>
                <input type="range" min="0" max="100" value={tone} onChange={e => setTone(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-[#8A8A96] mb-1"><span>Creativity · Temperature</span><span className="font-mono text-[#16161D]">{creativity}</span></div>
                <input type="range" min="0" max="100" value={creativity} onChange={e => setCreativity(Number(e.target.value))} className="w-full accent-[#EC4899] h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div><div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Emoji</span><span className="font-mono">{emojiEnabled ? emojiDensity : 'Off'}</span></div><input type="range" min="0" max="100" value={emojiDensity} onChange={e => setEmojiDensity(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" /></div>
                <div><div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Hashtags</span><span className="font-mono">{hashtagDensity}</span></div><input type="range" min="0" max="100" value={hashtagDensity} onChange={e => setHashtagDensity(Number(e.target.value))} className="w-full accent-[#0EA37A] h-1.5" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#8A8A96] cursor-pointer"><input type="checkbox" checked={emojiEnabled} onChange={e => setEmojiEnabled(e.target.checked)} className="accent-[#7C3AED]" /> Enable emojis</label>
              <input id="prompt-builder" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='AI command — "Write like Steve Jobs", "Gen Z voice", "Luxury tone"…' className="w-full rounded-xl border border-[#EBECF2] px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              <div className="grid grid-cols-2 gap-1.5">
                <select value={pillar} onChange={e => setPillar(e.target.value)} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white">{DEFAULT_PILLARS.map(p => <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>)}</select>
                <select value={selectedTemplate} onChange={async (e) => { setSelectedTemplate(e.target.value); if (!e.target.value) return; const t = templates.find(x => x.id === e.target.value); if (t) { setContext(t.context || ''); if (t.style_id) setStyleId(t.style_id); if (t.tone_adjustment) setTone((t.tone_adjustment + 1) * 50) } }} className="rounded-xl border border-[#EBECF2] px-2.5 py-2 text-xs bg-white"><option value="">Template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
            </div>
          </motion.div>

          <motion.button variants={fade} initial="initial" animate="animate" onClick={generate} disabled={!canGenerate} className={`w-full rounded-2xl p-4 flex items-center justify-center gap-2.5 text-base font-bold shadow-lg transition-all ${canGenerate ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-[#7C3AED]/25 hover:opacity-90 hover:-translate-y-0.5' : 'bg-[#E5E6EF] text-[#8A8A96] cursor-not-allowed'}`}>
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
            {generating ? 'AI is writing…' : 'Generate Content'} <span className="text-[0.6rem] font-mono opacity-60 hidden sm:inline">⌘↵</span>
          </motion.button>
        </div>

        {/* ================= CENTER ================= */}
        <div className="space-y-4">
          {!result && !generating && (
            <QuickStartCanvas
              onFiles={(files) => files && handleFile(files)}
              examplePrompts={EXAMPLE_PROMPTS}
              onExample={(p) => applyExample(p)}
              onApplyTemplate={(t) => { setKind('social'); setContext(t.context || ''); if (t.style_id) setStyleId(t.style_id); if (t.tone_adjustment) setTone((t.tone_adjustment + 1) * 50); toast.success(`Template "${t.name}" applied`) }}
              onQuickAction={{
                recent: library,
                restore: (i) => { setResult({ posts: i.posts, topic: i.title }); setActiveTab('linkedin'); toast.success('Restored from library') },
                analyze: () => { setInputTab('images'); document.querySelector('#canvas-file-input')?.click() },
                ideas: () => { setKind('social'); setContext('Generate 5 post ideas about [your topic]'); setInputTab('topic'); toast.info('Type your topic, then Generate') },
                templates: templates,
              }}
              libCount={library.length}
            />
          )}

          {generating && !result && (
            <>
              <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-5`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><Wand2 className="h-5 w-5 text-white" /></div>
                    <span className="absolute -top-1 -right-1 h-3 w-3"><span className="absolute inset-0 rounded-full bg-[#0EA37A] animate-ping" /><span className="absolute inset-0 rounded-full bg-[#0EA37A]" /></span>
                  </div>
                  <div><h3 className="text-lg font-bold text-[#16161D]">AI is thinking…</h3><p className="text-sm text-[#8A8A96]">Understanding your input · optimizing per platform · writing</p></div>
                </div>
                <div className="space-y-3">
                  {[
                    { t: 'Analyzing image & extracting context', w: 100 },
                    { t: 'Detecting objects, scene, mood, colors', w: 88 },
                    { t: 'Writing LinkedIn version', w: 72 },
                    { t: 'Writing Instagram with hashtags', w: 55 },
                    { t: 'Writing Facebook & Threads variants', w: 38 },
                    { t: 'Optimizing engagement & CTA', w: 20 },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${s.w}%` }} transition={{ duration: 0.5, delay: i * 0.35 }} className="h-1.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899]" />
                      <span className="text-[0.65rem] text-[#8A8A96] whitespace-nowrap">{s.t}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs text-[#8A8A96]">
                  <Bot className="h-4 w-4 text-[#7C3AED] animate-bounce" /> Every platform gets its own optimized content — never a generic caption.
                </div>
              </motion.div>
              <motion.div variants={fade} initial="initial" animate="animate">
                <ProcessingCanvas images={images} context={context} pastedArticle={pastedArticle} url={url} hasStarted />
              </motion.div>
            </>
          )}

          {result && (
            <>
              <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><CheckIcon /></div>
                    <div><h3 className="text-base font-bold text-[#16161D]">{result.topic || 'Generated content'}</h3><p className="text-xs text-[#8A8A96]">{(result.ms / 1000).toFixed(1)}s · {allTabs.length} platform variants · {libCount} in library</p></div>
                  </div>
                  <ScoreBadge text={result.posts?.[activeTab]?.caption || activePost?.caption || ''} />
                  <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5 w-full lg:w-auto">
                    {allTabs.map(t => (
                      <button key={t} onClick={() => setActiveTab(t)} className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === t ? 'text-white shadow-sm' : 'bg-[#F8F9FC] border border-[#EBECF2] text-[#8A8A96] hover:text-[#16161D]'}`} style={activeTab === t ? { backgroundColor: M[t]?.color, borderColor: M[t]?.color } : {}}>{M[t]?.label || t}</button>
                    ))}
                  </div>
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fade} initial="initial" animate="animate" exit={{ opacity: 0, y: -6 }} className={`${C} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-[#16161D]">{M[activeTab]?.label || activeTab}</span>
                      <span className="text-[0.6rem] px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: `${M[activeTab]?.color}12`, color: M[activeTab]?.color }}>{M[activeTab]?.style}</span>
                    </div>
                    <span className={`text-xs font-mono ${(activePost?.caption || '').length > 2800 ? 'text-red-500' : 'text-[#8A8A96]'}`}>{(activePost?.caption || '').length} / {M[activeTab]?.limit || '—'}</span>
                  </div>
                  <textarea value={activePost?.caption || ''} onChange={e => result.posts?.[activeTab] ? updatePost(activeTab, { caption: e.target.value }) : null} rows={12} className="w-full text-sm leading-relaxed rounded-xl border border-[#EBECF2] p-4 resize-y focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 whitespace-pre-wrap" />
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(activeHashtags || []).map((tag, i) => (
                      <span key={i} className="text-xs text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">{tag}{result.posts?.[activeTab] && <button onClick={() => updatePost(activeTab, { hashtags: activeHashtags.filter((_, j) => j !== i) })} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-[#F0F1F5] flex-wrap">
                    {QUICK_ACTIONS.map(a => (
                      <button key={a.key} onClick={() => runQuickAction(a.key, activePost?.caption || '', activeHashtags, (patch) => result.posts?.[activeTab] ? updatePost(activeTab, patch) : null)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{a.icon}{a.label}</button>
                    ))}
                    <button onClick={() => regenerate(activeTab)} disabled={regenerating === activeTab} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{regenerating === activeTab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} AI Rewrite</button>
                    <button onClick={() => { localStorage.setItem('sf_studio_draft', JSON.stringify(result)); toast.success('Draft saved') }} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors"><Save className="h-3.5 w-3.5" /> Save Draft</button>
                    <button onClick={() => { const name = prompt('Template name:'); if (!name) return; api('/templates', { method: 'POST', body: { name, context: result.topic || '', style_id: styleId, tone_adjustment: (tone - 50) / 50 } }).then(async () => { setTemplates(await api('/templates')); toast.success('Template saved') }).catch(() => {}) }} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors"><FolderPlus className="h-3.5 w-3.5" /> Save Template</button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F0F1F5]">
                    <div className="text-[0.6rem] text-[#8A8A96] uppercase tracking-wider font-semibold mb-2">AI actions</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {EXTRA_ACTIONS.map(a => (
                        <button key={a.key} onClick={() => runStudioAction(a.key, { caption: activePost?.caption || '', hashtags: activeHashtags, setPost: (patch) => result.posts?.[activeTab] ? updatePost(activeTab, patch) : null, rewrite: () => regenerate(activeTab), setLang, openPack: setPackOpen })} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-[#FAFAFD] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{a.icon}{a.label}</button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
                <h4 className="text-sm font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-[#0EA37A]" /> Publish & Distribute</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => saveJob({ publishNow: true })} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-md hover:opacity-90"><Send className="h-4 w-4" /> Publish Now <span className="text-[0.55rem] font-mono opacity-60">⌘P</span></button>
                  <button onClick={() => setSchedOpen(v => !v)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Clock className="h-4 w-4 text-[#F59E0B]" /> Schedule</button>
                  <button onClick={() => saveJob({})} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><List className="h-4 w-4 text-[#3B82F6]" /> Approval Queue <span className="text-[0.55rem] font-mono opacity-60">⌘S</span></button>
                  <button onClick={() => { localStorage.setItem('sf_studio_draft', JSON.stringify(result)); toast.success('Draft saved locally') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Save className="h-4 w-4 text-[#0EA37A]" /> Draft</button>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ topic: result.topic, posts: result.posts }, null, 2)); toast.success('Export JSON copied') }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><FolderPlus className="h-4 w-4 text-[#14B8A6]" /> Export</button>
                </div>
                <AnimatePresence>
                  {schedOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="flex items-center gap-2 mt-3">
                        <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="rounded-xl border border-[#EBECF2] px-3 py-2 text-sm" />
                        <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="rounded-xl border border-[#EBECF2] px-3 py-2 text-sm" />
                        <button onClick={() => { const d = schedDate || new Date().toISOString().split('T')[0]; const t = schedTime || '10:00'; saveJob({ scheduleFor: new Date(`${d}T${t}:00`).toISOString() }); setSchedOpen(false) }} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#7C3AED] text-white">Confirm</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <VersionPanel
                  versions={versions}
                  onRestore={(v) => { if (result.posts?.[activeTab]) updatePost(activeTab, { caption: v.caption, hashtags: v.hashtags }); toast.success('Version restored') }}
                  onClear={() => setVersions([])}
                />
                <PromptHistory
                  history={promptHistory}
                  onApply={(h) => { setKind(h.kind || 'social'); setContext(h.text || ''); toast.success('Prompt applied — hit Generate') }}
                  onClear={() => { setPromptHistory([]); localStorage.removeItem('sf_prompt_history') }}
                />
              </div>
              <GenTimeline events={timeline} />
            </>
          )}

          <AIPack open={!!packOpen} kind={packOpen} caption={activePost?.caption} hashtags={activeHashtags} onClose={() => setPackOpen(null)} />
        </div>

        {/* ================= RIGHT ================= */}
        <div className="space-y-4">
          <motion.div variants={fade} initial="initial" animate="animate">
            <h4 className="text-sm font-semibold text-[#16161D] mb-2 flex items-center gap-2"><Copy className="h-4 w-4 text-[#7C3AED]" /> Live Preview · {M[activeTab]?.label || activeTab}</h4>
            <PlatformPreview platform={activeTab} caption={activePost?.caption} hashtags={activeHashtags} imageUrl={images[0]?.previewUrl} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate"><AnalysisPanel text={activePost?.caption || ''} /></motion.div>
          <motion.div variants={fade} initial="initial" animate="animate"><SuggestionPanel posts={result?.posts} /></motion.div>
          <motion.div variants={fade} initial="initial" animate="animate">
            <AIChat post={activePost} onUpdate={(patch) => result?.posts?.[activeTab] && updatePost(activeTab, patch)} onRegenerate={() => regenerate(activeTab)} disabled={!result} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate">
            <ContentLibrary result={result} onRestore={(i) => { setResult({ ...result, posts: i.posts, topic: i.title }); setActiveTab('linkedin'); toast.success('Restored from library') }} onDuplicate={(i) => { localStorage.setItem('sf_studio_library', JSON.stringify([...JSON.parse(localStorage.getItem('sf_studio_library') || '[]'), { ...i, id: Date.now().toString(), title: i.title + ' (copy)' }])); setLibrary(JSON.parse(localStorage.getItem('sf_studio_library'))); toast.success('Duplicated') }} onSave={() => setLibrary(JSON.parse(localStorage.getItem('sf_studio_library') || '[]'))} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> }

function OnboardingEmptyState() {
  const router = useRouter()
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center mb-6 shadow-lg shadow-[#7C3AED]/20"><Wand2 className="h-7 w-7 text-white" /></div>
      <h2 className="text-2xl font-bold text-[#16161D]">Welcome to AI Content Studio</h2>
      <p className="text-[#8A8A96] mt-2 max-w-md mx-auto">Add an AI provider and start creating platform-native content from any photo, article, or idea.</p>
      <div className="mt-8"><button onClick={() => router.push('/settings')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold shadow-lg"><KeyRound className="h-4 w-4 inline mr-2" />Add AI provider<ArrowRight className="h-4 w-4 ml-2 inline" /></button></div>
    </div>
  )
}

function MissingActiveProvider() {
  const router = useRouter()
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-500"><Sparkles className="h-5 w-5" /></div>
      <h2 className="text-xl font-bold text-[#16161D]">No active text provider</h2>
      <p className="text-[#8A8A96] mt-2">Mark one of your providers as active for text in Settings.</p>
      <button onClick={() => router.push('/settings')} className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold">Open Settings</button>
    </div>
  )
}
