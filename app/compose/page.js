'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Upload, ImageIcon, Star, Wand2, Loader2, Send, Save, RefreshCw, Copy, X, Sparkles, ArrowRight, KeyRound, Clock, List, ChevronDown, Link, PenLine, Newspaper, Mail, FileText, Megaphone, Layout, Briefcase, BookOpen, Video, Mic, Images, Hash, SlidersHorizontal, Bot, LayoutDashboard, Radio, FolderPlus, PlayCircle } from 'lucide-react'
import { api, PLATFORMS, resizeImageToBase64 } from '@/components/shared'
import { DEFAULT_PILLARS } from '@/lib/content-pillars'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisPanel, PlatformPreview, ContentLibrary, SuggestionPanel, QUICK_ACTIONS, runQuickAction, M } from './studio-components'

const C = 'rounded-2xl border border-[#EBECF2] bg-white shadow-sm'
const fade = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }

const TYPES = [
  { key: 'social', label: 'Social Media Post', icon: <PenLine className="h-4 w-4" />, g: 'from-[#7C3AED] to-[#A855F7]' },
  { key: 'blog', label: 'Blog Article', icon: <FileText className="h-4 w-4" />, g: 'from-[#0EA37A] to-[#34D399]' },
  { key: 'news', label: 'News Post', icon: <Newspaper className="h-4 w-4" />, g: 'from-[#3B82F6] to-[#60A5FA]' },
  { key: 'newsletter', label: 'Newsletter', icon: <Mail className="h-4 w-4" />, g: 'from-[#EC4899] to-[#F97316]' },
  { key: 'email', label: 'Email Campaign', icon: <Mail className="h-4 w-4" />, g: 'from-[#14B8A6] to-[#2DD4BF]' },
  { key: 'product', label: 'Product Description', icon: <Layout className="h-4 w-4" />, g: 'from-[#F59E0B] to-[#FBBF24]' },
  { key: 'ad', label: 'Advertisement', icon: <Megaphone className="h-4 w-4" />, g: 'from-[#EF4444] to-[#F87171]' },
  { key: 'landing', label: 'Landing Page Copy', icon: <LayoutDashboard className="h-4 w-4" />, g: 'from-[#6366F1] to-[#818CF8]' },
  { key: 'press', label: 'Press Release', icon: <Briefcase className="h-4 w-4" />, g: 'from-[#0891B2] to-[#22D3EE]' },
  { key: 'case', label: 'Case Study', icon: <BookOpen className="h-4 w-4" />, g: 'from-[#8B5CF6] to-[#C084FC]' },
  { key: 'video', label: 'Video Script', icon: <Video className="h-4 w-4" />, g: 'from-[#DC2626] to-[#F97316]' },
  { key: 'podcast', label: 'Podcast Script', icon: <Mic className="h-4 w-4" />, g: 'from-[#4F46E5] to-[#818CF8]' },
  { key: 'carousel', label: 'Carousel Copy', icon: <Images className="h-4 w-4" />, g: 'from-[#E4405F] to-[#F59E0B]' },
  { key: 'reel', label: 'Reel Caption', icon: <PlayCircle className="h-4 w-4" />, g: 'from-[#EC4899] to-[#7C3AED]' },
  { key: 'story', label: 'Story Caption', icon: <Sparkles className="h-4 w-4" />, g: 'from-[#F97316] to-[#EF4444]' },
  { key: 'thread', label: 'Twitter Thread', icon: <Hash className="h-4 w-4" />, g: 'from-[#000000] to-[#374151]' },
  { key: 'linkedin-art', label: 'LinkedIn Article', icon: <Briefcase className="h-4 w-4" />, g: 'from-[#0A66C2] to-[#3B82F6]' },
]

const TONES = ['Professional', 'Friendly', 'Luxury', 'Corporate', 'Inspirational', 'Educational', 'Technical', 'Funny', 'Minimal', 'Storytelling']
const AUDIENCES = ['Students', 'HR Professionals', 'Founders', 'Developers', 'Recruiters', 'Businesses', 'Customers', 'Investors']
const LENGTHS = ['Very Short', 'Short', 'Medium', 'Long', 'Very Long']
const CTAS = ['Soft', 'Strong', 'Sales', 'Community', 'Newsletter']
const LANGS = ['English', 'Kannada', 'Hindi', 'Tamil', 'Telugu']
const HOOKS = ['Question', 'Bold statement', 'Story', 'Statistic', 'Pain point', 'Curiosity gap']

const BRIEFS = {
  social: 'Write a native social media post.',
  blog: 'Write it as a long-form blog article — include a title, intro, 4-6 H2/H3 sections, and a conclusion. Use markdown.',
  news: 'Write it as a news-style post with headline, lead paragraph, and key facts.',
  newsletter: 'Write as a newsletter: greeting, 3 highlight bullets, main story, and sign-off.',
  email: 'Write as an email campaign: subject line, preheader, body with a single CTA button.',
  product: 'Write as a persuasive product description with benefits and features.',
  ad: 'Write as a short advertising copy with a strong hook and urgent CTA.',
  landing: 'Write as landing page copy: headline, subheadline, 3 benefit points, social proof, CTA.',
  press: 'Write as a professional press release with headline, dateline, quotes and boilerplate.',
  case: 'Write as a case study: challenge, solution, results with metrics.',
  video: 'Write as a video script with scene directions, hook, body and outro CTA.',
  podcast: 'Write as a podcast episode script with intro, segments, questions and outro.',
  carousel: 'Write carousel copy: 8 slides, each with a short title and 1-2 sentences.',
  reel: 'Write a punchy reel caption under 2200 chars with 3-5 trending hashtags.',
  story: 'Write a short story caption under 400 characters with a poll or question CTA.',
  thread: 'Write a Twitter/X thread: 8-12 short numbered tweets under 280 chars each.',
  'linkedin-art': 'Write a LinkedIn article: headline, 5-7 sections with subheadings, and a conclusion.',
}

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
  const [selPlatforms, setSelPlatforms] = useState(['linkedin', 'instagram', 'facebook', 'threads'])
  const [toneLabel, setToneLabel] = useState('Professional')
  const [audience, setAudience] = useState('')
  const [length, setLength] = useState('Medium')
  const [cta, setCta] = useState('Soft')
  const [lang, setLang] = useState('English')
  const [hashtagDensity, setHashtagDensity] = useState(50)
  const [hook, setHook] = useState('')
  const [creativity, setCreativity] = useState(50)
  const [prompt, setPrompt] = useState('')
  const [activeTab, setActiveTab] = useState('linkedin')
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
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

  const buildInstruction = () => {
    const parts = [BRIEFS[kind] || 'Write a native social media post.']
    if (toneLabel !== 'Professional') parts.push(`Writing tone: ${toneLabel.toLowerCase()}.`)
    if (audience) parts.push(`Target audience: ${audience}.`)
    parts.push(`Content length: ${length.toLowerCase()}.`)
    parts.push(`CTA style: ${cta.toLowerCase()}.`)
    if (lang !== 'English') parts.push(`Write entirely in ${lang}.`)
    if (hook) parts.push(`Open with a hook: ${hook.toLowerCase()}.`)
    parts.push(`Creativity level: ${creativity}/100.`)
    if (emojiEnabled) parts.push(`Use emojis at density ${emojiDensity}/100.`)
    else parts.push('Do NOT use any emojis.')
    parts.push(`Hashtag density: ${hashtagDensity}/100. Use hashtags only for Instagram, Threads and X.`)
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

  const generate = async () => {
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
      toast.success(`Generated in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const updatePost = (platform, patch) => { setResult(prev => prev && ({ ...prev, posts: { ...prev.posts, [platform]: { ...prev.posts[platform], ...patch } } })) }

  const regenerate = async (platform) => {
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
  }

  const saveJob = async ({ publishNow = false, scheduleFor = null } = {}) => {
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
  }

  // Derived platforms (client-side optimization from generated content)
  const derived = useMemo(() => {
    if (!result?.posts) return {}
    const li = result.posts.linkedin?.caption || ''
    const ig = result.posts.instagram?.caption || result.posts.linkedin?.caption || ''
    return {
      twitter: { caption: (li || ig).replace(/[^\S\n]+/g, ' ').slice(0, 280), hashtags: ['marketing', 'growth'] },
      youtube: { caption: `TITLE: ${(result.topic || 'AI Content').slice(0, 70)}\n\nDESCRIPTION:\n${(li || ig).slice(0, 1200)}\n\nTAGS: socialmedia, marketing, content, ai` },
      blog: { caption: `# ${(result.topic || 'AI Content')}\n\n${(li || ig).split(/\n+/).slice(0, 6).map(l => `## ${l.slice(0, 80)}`).join('\n\n')}\n\n*Generated by SocialForge AI Content Studio*` },
      newsletter: { caption: `Subject: ${(result.topic || 'Your AI update')}\n\nHey there 👋\n\nHere's what's new this week:\n\n• ${(li || ig).slice(0, 140)}…\n• ${(ig || li).slice(0, 120)}…\n\nRead more → [LINK]\n\n— Your Brand` },
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

  if (providers.length === 0) return <OnboardingEmptyState />
  if (!activeText) return <MissingActiveProvider />

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl overflow-hidden bg-gradient-to-r from-[#1A1037] via-[#2A1B52] to-[#4C1D63] relative">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#EC4899]/20 blur-3xl" />
        <div className="relative px-6 sm:px-8 py-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-lg"><Wand2 className="h-5 w-5 text-white" /></div>
              <div><h1 className="text-xl font-bold text-white tracking-tight">AI Content Studio</h1><p className="text-sm text-white/50">Create high-performing content for every platform in one intelligent workspace.</p></div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {[{ l: 'New Social Post', k: 'social' }, { l: 'New Blog', k: 'blog' }, { l: 'Repurpose Content', k: 'case' }, { l: 'Import Content', k: 'news' }, { l: 'Newsletter', k: 'newsletter' }, { l: 'Templates', k: 'press' }].map(qa => (
                <button key={qa.k} onClick={() => setKind(qa.k)} className="text-[0.6rem] font-semibold px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-colors">{qa.l}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[0.6rem] text-white/60 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Bot className="h-3.5 w-3.5 text-[#C4B5FD]" /> {activeText.name} · {activeVision ? 'Vision ready' : 'Text only'}
            </div>
            <div className="text-[0.6rem] text-white/50 bg-white/5 border border-white/10 rounded-xl px-3 py-2">~${costEstimate?.estimated} est. per generation</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr_320px] gap-5 items-start">
        {/* ================= LEFT: Inputs & Controls ================= */}
        <div className="space-y-4">
          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-xs font-semibold text-[#16161D] mb-3 flex items-center gap-2"><PenLine className="h-3.5 w-3.5 text-[#7C3AED]" /> What are you creating?</h4>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {TYPES.map(t => (
                <button key={t.key} onClick={() => setKind(t.key)} className={`rounded-xl p-2 text-left transition-all ${kind === t.key ? 'bg-gradient-to-br ' + t.g + ' text-white shadow-md scale-[1.02]' : 'bg-[#F8F9FC] border border-[#EBECF2] hover:border-[#D8C8FB]'}`}>
                  <div className={`h-6 w-6 rounded-lg flex items-center justify-center mb-1 ${kind === t.key ? 'bg-white/20 text-white' : 'bg-white text-[#7C3AED] shadow-sm'}`}>{t.icon}</div>
                  <div className={`text-[0.6rem] font-semibold leading-tight ${kind === t.key ? 'text-white' : 'text-[#16161D]'}`}>{t.label}</div>
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-xs font-semibold text-[#16161D] mb-3 flex items-center gap-2"><LayoutDashboard className="h-3.5 w-3.5 text-[#3B82F6]" /> Platforms</h4>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(M).slice(0, 4).map(([k, v]) => (
                <button key={k} onClick={() => setSelPlatforms(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])} className={`rounded-full px-3 py-1.5 text-[0.65rem] font-semibold border transition-all ${selPlatforms.includes(k) ? 'text-white shadow-sm' : 'bg-[#F8F9FC] border-[#EBECF2] text-[#8A8A96] hover:border-[#D8C8FB]'}`} style={selPlatforms.includes(k) ? { backgroundColor: v.color, borderColor: v.color } : {}}>{v.label}</button>
              ))}
            </div>
            <div className="text-[0.6rem] text-[#8A8A96] mt-2">Auto-generated: X · YouTube · Blog · Newsletter</div>
            <div className="mt-3 pt-3 border-t border-[#F0F1F5] space-y-1.5">
              {Object.entries(M).slice(0, 4).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[0.6rem]"><span className="font-semibold text-[#16161D] w-16 shrink-0">{v.label}</span><span className="text-[#8A8A96] truncate">{v.rule}</span></div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-xs font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Upload className="h-3.5 w-3.5 text-[#EC4899]" /> Input Sources</h4>
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
                  <div className="text-[0.55rem] text-[#8A8A96]">{images.length}/10 images · drag to reorder · drop more to add</div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center gap-1.5 text-[#8A8A96]">
                  <ImageIcon className="h-6 w-6 text-[#C4C5CE]" />
                  <div className="text-xs font-medium text-[#16161D]">Drop images or click</div>
                  <div className="text-[0.6rem]">Vision AI will detect objects, scene, brand, mood & more</div>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
            </div>
            <div className="flex gap-1.5 mt-2">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste article / blog / post URL…" className="flex-1 rounded-lg border border-[#EBECF2] px-2.5 py-1.5 text-xs min-w-0 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              <button onClick={extractUrl} disabled={extracting || !url.trim()} className="rounded-lg bg-[#F4F5F9] border border-[#EBECF2] px-2.5 text-[0.6rem] font-semibold text-[#7C3AED] disabled:opacity-50 shrink-0">{extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Extract'}</button>
            </div>
            <textarea value={pastedArticle} onChange={e => { setPastedArticle(e.target.value); setImages([]) }} placeholder="…or paste raw text, email, research, markdown, or a LinkedIn post here" rows={3} className="w-full mt-2 rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
            <input value={context} onChange={e => setContext(e.target.value)} placeholder="Or type a topic / keyword brief…" className="w-full mt-2 rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
          </motion.div>

          <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
            <h4 className="text-xs font-semibold text-[#16161D] mb-3 flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5 text-[#0EA37A]" /> Advanced AI Controls</h4>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5">
                <select value={toneLabel} onChange={e => setToneLabel(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={audience} onChange={e => setAudience(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  <option value="">Audience…</option>{AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
                <select value={length} onChange={e => setLength(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  {LENGTHS.map(l => <option key={l}>{l}</option>)}
                </select>
                <select value={cta} onChange={e => setCta(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  {CTAS.map(c => <option key={c}>CTA: {c}</option>)}
                </select>
                <select value={lang} onChange={e => setLang(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  {LANGS.map(l => <option key={l}>{l}</option>)}
                </select>
                <select value={hook} onChange={e => setHook(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  <option value="">Hook style…</option>{HOOKS.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Tone: Formal ←→ Casual</span><span className="font-mono text-[#16161D]">{tone}</span></div>
                <input type="range" min="0" max="100" value={tone} onChange={e => setTone(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Creativity (temperature)</span><span className="font-mono text-[#16161D]">{creativity}</span></div>
                <input type="range" min="0" max="100" value={creativity} onChange={e => setCreativity(Number(e.target.value))} className="w-full accent-[#EC4899] h-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Emoji density</span><span className="font-mono">{emojiEnabled ? emojiDensity : 'Off'}</span></div>
                  <input type="range" min="0" max="100" value={emojiDensity} onChange={e => setEmojiDensity(Number(e.target.value))} className="w-full accent-[#7C3AED] h-1.5" />
                </div>
                <div>
                  <div className="flex justify-between text-[0.6rem] text-[#8A8A96] mb-1"><span>Hashtag density</span><span className="font-mono">{hashtagDensity}</span></div>
                  <input type="range" min="0" max="100" value={hashtagDensity} onChange={e => setHashtagDensity(Number(e.target.value))} className="w-full accent-[#0EA37A] h-1.5" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[0.65rem] text-[#8A8A96] cursor-pointer"><input type="checkbox" checked={emojiEnabled} onChange={e => setEmojiEnabled(e.target.checked)} className="accent-[#7C3AED]" /> Enable emojis</label>
              <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder='Prompt builder — "Write like Steve Jobs", "Luxury tone", "Gen Z voice"…' className="w-full rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20" />
              <div className="grid grid-cols-2 gap-1.5">
                <select value={pillar} onChange={e => setPillar(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  {DEFAULT_PILLARS.map(p => <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>)}
                </select>
                <select value={selectedTemplate} onChange={async (e) => { setSelectedTemplate(e.target.value); if (!e.target.value) return; const t = templates.find(x => x.id === e.target.value); if (t) { setContext(t.context || ''); if (t.style_id) setStyleId(t.style_id); if (t.tone_adjustment) setTone((t.tone_adjustment + 1) * 50) } }} className="rounded-lg border border-[#EBECF2] px-2 py-1.5 text-[0.65rem] bg-white">
                  <option value="">Template…</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </motion.div>

          <motion.button variants={fade} initial="initial" animate="animate" onClick={generate} disabled={!canGenerate} className={`w-full rounded-2xl p-4 flex items-center justify-center gap-2 text-white font-bold shadow-lg transition-all ${canGenerate ? 'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-[#7C3AED]/25 hover:opacity-90 hover:-translate-y-0.5' : 'bg-[#E5E6EF] text-[#8A8A96] cursor-not-allowed'}`}>
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
            {generating ? 'AI is writing…' : 'Generate Content'}
          </motion.button>
        </div>

        {/* ================= CENTER: Generation workspace ================= */}
        <div className="space-y-4">
          {generating && !result && (
            <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] animate-pulse flex items-center justify-center"><Wand2 className="h-4 w-4 text-white" /></div>
                <div><div className="text-sm font-semibold text-[#16161D]">Generating {M[activeTab]?.label || ''} content…</div><div className="text-[0.6rem] text-[#8A8A96]">Vision analysis · platform optimization · hashtags</div></div>
              </div>
              <div className="space-y-2.5">
                {[92, 84, 76, 68].map((w, i) => <div key={i} className="h-3 rounded-full bg-[#F0F1F5] animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </motion.div>
          )}

          {!generating && !result && (
            <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-10 text-center`}>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center mb-4"><Sparkles className="h-6 w-6 text-[#7C3AED]" /></div>
              <h3 className="text-base font-bold text-[#16161D]">Your AI workspace is ready</h3>
              <p className="text-sm text-[#8A8A96] mt-1.5 max-w-sm mx-auto leading-relaxed">Upload an image, paste a URL or text, choose your platform and controls, then generate platform-native content.</p>
              <div className="flex items-center justify-center gap-2 mt-5 text-[0.65rem] text-[#8A8A96] flex-wrap">
                <span className="px-3 py-1.5 rounded-full bg-[#7C3AED]/8 text-[#7C3AED] font-semibold">1 · Input</span><span>→</span>
                <span className="px-3 py-1.5 rounded-full bg-[#EC4899]/8 text-[#EC4899] font-semibold">2 · Generate</span><span>→</span>
                <span className="px-3 py-1.5 rounded-full bg-[#0EA37A]/8 text-[#0EA37A] font-semibold">3 · Publish</span>
              </div>
            </motion.div>
          )}

          {result && (
            <>
              <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center"><CheckIcon /></div>
                    <div><h3 className="text-sm font-bold text-[#16161D]">{result.topic || 'Generated content'}</h3><p className="text-[0.6rem] text-[#8A8A96]">Generated in {(result.ms / 1000).toFixed(1)}s · {allTabs.length} platform variants</p></div>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5">
                    {allTabs.map(t => (
                      <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-1.5 rounded-full text-[0.65rem] font-semibold whitespace-nowrap transition-all ${activeTab === t ? 'text-white shadow-sm' : 'bg-[#F8F9FC] border border-[#EBECF2] text-[#8A8A96] hover:text-[#16161D]'}`} style={activeTab === t ? { backgroundColor: M[t]?.color, borderColor: M[t]?.color } : {}}>{M[t]?.label || t}</button>
                    ))}
                  </div>
                </div>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fade} initial="initial" animate="animate" exit={{ opacity: 0, y: -6 }} className={`${C} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#16161D]">{M[activeTab]?.label || activeTab}</span>
                      <span className="text-[0.55rem] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${M[activeTab]?.color}12`, color: M[activeTab]?.color }}>{M[activeTab]?.rule}</span>
                    </div>
                    <span className={`text-[0.6rem] font-mono ${(activePost?.caption || '').length > 2800 ? 'text-red-500' : 'text-[#8A8A96]'}`}>{(activePost?.caption || '').length} chars</span>
                  </div>
                  <textarea value={activePost?.caption || ''} onChange={e => result.posts?.[activeTab] ? updatePost(activeTab, { caption: e.target.value }) : null} rows={10} className="w-full text-sm leading-relaxed rounded-xl border border-[#EBECF2] p-3.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 whitespace-pre-wrap" />
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {(activeHashtags || []).map((tag, i) => (
                      <span key={i} className="text-[0.65rem] text-[#7C3AED] bg-[#7C3AED]/5 border border-[#7C3AED]/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        {tag}
                        {result.posts?.[activeTab] && <button onClick={() => updatePost(activeTab, { hashtags: activeHashtags.filter((_, j) => j !== i) })} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F0F1F5] flex-wrap">
                    {QUICK_ACTIONS.map(a => (
                      <button key={a.key} onClick={() => runQuickAction(a.key, activePost?.caption || '', activeHashtags, (patch) => result.posts?.[activeTab] ? updatePost(activeTab, patch) : null)} className="flex items-center gap-1.5 text-[0.6rem] font-medium px-2.5 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">{a.icon}{a.label}</button>
                    ))}
                    <button onClick={() => regenerate(activeTab)} disabled={regenerating === activeTab} className="flex items-center gap-1.5 text-[0.6rem] font-medium px-2.5 py-1.5 rounded-lg bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB] hover:text-[#7C3AED] transition-colors">
                      {regenerating === activeTab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} AI Rewrite
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Publish actions */}
              <motion.div variants={fade} initial="initial" animate="animate" className={`${C} p-4`}>
                <h4 className="text-xs font-semibold text-[#16161D] mb-3 flex items-center gap-2"><Send className="h-3.5 w-3.5 text-[#0EA37A]" /> Publish & Distribute</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => saveJob({ publishNow: true })} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#EC4899] shadow-md hover:opacity-90"><Send className="h-3.5 w-3.5" /> Publish Now</button>
                  <button onClick={() => setSchedOpen(v => !v)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Clock className="h-3.5 w-3.5 text-[#F59E0B]" /> Schedule</button>
                  <button onClick={() => saveJob({})} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><List className="h-3.5 w-3.5 text-[#3B82F6]" /> Approval Queue</button>
                  <button onClick={() => { localStorage.setItem('sf_studio_draft', JSON.stringify(result)); toast.success('Draft saved locally') }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><Save className="h-3.5 w-3.5 text-[#0EA37A]" /> Save Draft</button>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ topic: result.topic, posts: result.posts }, null, 2)); toast.success('Export JSON copied') }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#F8F9FC] border border-[#EBECF2] text-[#16161D] hover:border-[#D8C8FB]"><FolderPlus className="h-3.5 w-3.5 text-[#14B8A6]" /> Export</button>
                </div>
                <AnimatePresence>
                  {schedOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="flex items-center gap-2 mt-3">
                        <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs" />
                        <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="rounded-lg border border-[#EBECF2] px-2.5 py-2 text-xs" />
                        <button onClick={() => { const d = schedDate || new Date().toISOString().split('T')[0]; const t = schedTime || '10:00'; saveJob({ scheduleFor: new Date(`${d}T${t}:00`).toISOString() }); setSchedOpen(false) }} className="px-4 py-2 rounded-xl text-xs font-bold bg-[#7C3AED] text-white">Confirm</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </div>

        {/* ================= RIGHT: Preview, Analysis, Suggestions, Library ================= */}
        <div className="space-y-4">
          <motion.div variants={fade} initial="initial" animate="animate">
            <h4 className="text-xs font-semibold text-[#16161D] mb-2 flex items-center gap-2"><Copy className="h-3.5 w-3.5 text-[#7C3AED]" /> Live Preview · {M[activeTab]?.label || activeTab}</h4>
            <PlatformPreview platform={activeTab} caption={activePost?.caption} hashtags={activeHashtags} imageUrl={images[0]?.previewUrl} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate">
            <AnalysisPanel text={activePost?.caption || ''} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate">
            <SuggestionPanel posts={result?.posts} activeText={activeText} />
          </motion.div>
          <motion.div variants={fade} initial="initial" animate="animate">
            <ContentLibrary result={result} onRestore={(i) => { setResult({ ...result, posts: i.posts, topic: i.title }); toast.success('Restored from library') }} onDuplicate={(i) => { localStorage.setItem('sf_studio_library', JSON.stringify([...JSON.parse(localStorage.getItem('sf_studio_library') || '[]'), { ...i, id: Date.now().toString(), title: i.title + ' (copy)' }])); toast.success('Duplicated') }} onSave={() => {}} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> }

function OnboardingEmptyState() {
  const router = useRouter()
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center mb-6 shadow-lg shadow-[#7C3AED]/20"><Wand2 className="h-7 w-7 text-white" /></div>
      <h2 className="text-2xl font-bold text-[#16161D]">Welcome to AI Content Studio</h2>
      <p className="text-[#8A8A96] mt-2 max-w-md mx-auto text-sm">Add an AI provider and start creating platform-native content from any photo, article, or idea.</p>
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
      <p className="text-[#8A8A96] mt-2 text-sm">Mark one of your providers as active for text in Settings.</p>
      <button onClick={() => router.push('/settings')} className="mt-6 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold">Open Settings</button>
    </div>
  )
}
