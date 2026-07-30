'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Upload, ImageIcon, Star, Wand2, Loader2, Trash2, Eye, EyeOff, Pencil,
  Send, Save, RefreshCw, Copy, X, Sparkles, ArrowRight, AlertTriangle, KeyRound,
  ChevronUp, ChevronDown, Link, Clock, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api, PLATFORMS, PROVIDER_TYPES, resizeImageToBase64, StatusPill, BoardRow } from '@/components/shared'
import { DEFAULT_PILLARS } from '@/lib/content-pillars'

function complianceCheck(caption) {
  const warnings = []
  const statPattern = /\d+(\.\d+)?\s*%|\d+x\b/i
  if (statPattern.test(caption)) warnings.push('Unverifiable stat detected')
  const absWords = /\b(best|worst|always|never|guaranteed)\b/i
  if (absWords.test(caption)) warnings.push('Absolute claim detected')
  const mentionPattern = /@\w+/i
  if (mentionPattern.test(caption)) warnings.push('Mentions competitor')
  return warnings
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
  const [variantsEnabled, setVariantsEnabled] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [costEstimate, setCostEstimate] = useState(null)
  const [emojiEnabled, setEmojiEnabled] = useState(true)
  const [emojiDensity, setEmojiDensity] = useState(50)
  const [pastedArticle, setPastedArticle] = useState('')
  const [inputMode, setInputMode] = useState('photo')
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
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
        if (s.length > 0) {
          setStyleId(prev => prev || (s.find(x => x.is_active) || s[0])?.id || null)
        }
      } catch (e) { toast.error(e.message) }
    })()
  }, [])

  const activeVision = providers.find(p => p.active_for_vision)
  const activeText = providers.find(p => p.active_for_text)
  const canGenerate = !!activeText && !generating && ((inputMode === 'photo' && images.length > 0) || context.trim().length > 0 || pastedArticle.trim().length > 0)

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
    setPastedArticle('') // clear article text when using photos
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

  const moveImage = (index, direction) => { setImages(prev => { const arr = [...prev]; const target = index + direction; if (target < 0 || target >= arr.length) return arr; [arr[index], arr[target]] = [arr[target], arr[index]]; return arr }) }
  const removeImage = (index) => { setImages(prev => { const removed = prev[index]; if (removed?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl); return prev.filter((_, i) => i !== index) }); setResult(null) }

  const extractUrl = async () => {
    if (!url.trim()) { toast.error('Enter a URL first'); return }
    setImages([]) // clear photos when using article mode
    setExtracting(true)
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
      const contextData = context.trim() || pastedArticle.trim() || undefined
      const emojiInstruction = emojiEnabled ? `Use emojis in captions at density level ${emojiDensity}/100. ${emojiDensity < 30 ? 'Use sparingly, roughly 1 every 2-3 sentences.' : emojiDensity < 60 ? 'Use a moderate amount of emojis.' : 'Use emojis liberally throughout each caption.'}` : 'Do NOT use any emojis in any caption.'
      const payload = {
        context: contextData,
        styleId: styleId || undefined,
        tone,
        pillar: pillar || undefined,
        variants: variantsEnabled ? 2 : undefined,
        emoji_instruction: emojiInstruction,
      }
      if (images.length > 0) {
        payload.images = images.map(i => ({ base64: i.base64, mimeType: i.mimeType }))
        payload.image_base64 = images[0].base64
        payload.mime_type = images[0].mimeType
      }
      const data = await api('/generate', { method: 'POST', body: payload })
      setResult({ ...data, ms: Date.now() - started })
      toast.success(`Generated captions in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const updatePost = (platform, patch) => { setResult(prev => prev && ({ ...prev, posts: { ...prev.posts, [platform]: { ...prev.posts[platform], ...patch } } })) }

  const regenerate = async (platform) => {
    setRegenerating(platform)
    try {
      const post = await api('/regenerate', {
        method: 'POST', body: {
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          context: context.trim() || pastedArticle.trim() || undefined,
          styleId: styleId || undefined, platform,
          currentResearchContext: result?.research_context, tone,
        },
      })
      updatePost(platform, post); toast.success(`Regenerated ${platform}`)
    } catch (e) { toast.error(e.message) } finally { setRegenerating(null) }
  }

  const saveJob = async ({ publishNow = false, scheduleFor = null, variantResult = null } = {}) => {
    const r = variantResult || result; if (!r) return null
    try {
      let status = 'draft'
      if (publishNow) status = 'approved'
      else if (scheduleFor) status = 'scheduled'
      const toneAdj = (tone - 50) / 50
      const job = await api('/jobs', {
        method: 'POST', body: {
          source: 'ai_manual', topic: (context || pastedArticle || '').slice(0, 120), pillar,
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

  if (providers.length === 0) return <OnboardingEmptyState />
  if (!activeText) return <MissingActiveProvider />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* Left column */}
      <div className="space-y-4">
        {/* Section A: From Photo */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> From Photo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div ref={dropRef} onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-border hover:border-primary/40 rounded-sm overflow-hidden cursor-pointer transition-colors bg-secondary/30">
              {images.length > 0 ? (
                <div className="p-2">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative group shrink-0">
                        <img src={img.previewUrl} alt="" className="w-20 h-20 object-cover rounded-sm" />
                        <div className="absolute inset-0 bg-[#16161D]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {i > 0 && <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1) }} className="text-white p-0.5 hover:bg-white/20 rounded"><ChevronUp className="h-3 w-3" /></button>}
                          {i < images.length - 1 && <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1) }} className="text-white p-0.5 hover:bg-white/20 rounded"><ChevronDown className="h-3 w-3" /></button>}
                          <button onClick={(e) => { e.stopPropagation(); removeImage(i) }} className="text-white p-0.5 hover:bg-white/20 rounded"><X className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ))}
                    {images.length < 10 && <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }} className="w-20 h-20 border border-dashed border-border rounded-sm flex items-center justify-center text-muted-foreground hover:border-primary/40 shrink-0"><ImageIcon className="h-5 w-5" /></button>}
                  </div>
                  <div className="studio-mono text-[0.5rem] text-muted-foreground">{images.length}/10 images</div>
                </div>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                  <div className="text-sm">Drop photos or click</div>
                  <div className="studio-mono text-[0.5rem] text-muted-foreground/60">Up to 10 images</div>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
            </div>
          </CardContent>
        </Card>

        {/* Section B: From Article or Post */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
              <Link className="h-4 w-4 text-primary" /> From Article or Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Paste article/post URL…" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-secondary/50 border-border text-sm flex-1" />
              <Button variant="outline" size="sm" onClick={extractUrl} disabled={extracting || !url.trim()} className="border-border shrink-0">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                Extract
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span>or paste raw text</span>
              <Separator className="flex-1" />
            </div>
            <Textarea placeholder="Paste a long-form article or post directly here…" value={pastedArticle} onChange={(e) => setPastedArticle(e.target.value)} rows={4} className="bg-secondary/50 border-border text-sm resize-none" />
          </CardContent>
        </Card>

        {/* Shared controls: Voice, Pillar, Tone, Emoji */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-semibold">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="studio-eyebrow mb-1 block">Template</Label>
              <div className="flex gap-2">
                <Select value={selectedTemplate} onValueChange={async (v) => { setSelectedTemplate(v); if (!v) return; const t = templates.find(x => x.id === v); if (t) { setContext(t.context || ''); if (t.style_id) setStyleId(t.style_id); if (t.tone_adjustment) setTone((t.tone_adjustment + 1) * 50) } }}>
                  <SelectTrigger className="bg-secondary/50 border-border flex-1"><SelectValue placeholder="Load a template…" /></SelectTrigger>
                  <SelectContent>{templates.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="border-border shrink-0" onClick={async () => { const name = prompt('Template name:'); if (!name) return; await api('/templates', { method: 'POST', body: { name, context, style_id: styleId, tone_adjustment: (tone - 50) / 50 } }); setTemplates(await api('/templates')); toast.success('Saved') }}><Save className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <div>
              <Label className="studio-eyebrow mb-1 block">Voice</Label>
              <Select value={styleId || undefined} onValueChange={setStyleId}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Choose a voice…" /></SelectTrigger>
                <SelectContent>{styles.map(s => (<SelectItem key={s.id} value={s.id}><span className="flex items-center gap-2">{s.is_active && <Star className="h-3 w-3 text-muted-foreground" />}{s.name}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>

            <div>
              <Label className="studio-eyebrow mb-1 block">Pillar</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{DEFAULT_PILLARS.map(p => (<SelectItem key={p.key} value={p.key}><span className="flex items-center gap-2">{p.emoji} {p.label}</span></SelectItem>))}</SelectContent>
              </Select>
            </div>

            <div>
              <Label className="studio-eyebrow mb-1 block">Tone</Label>
              <div className="flex items-center gap-3">
                <span className="studio-mono text-[0.5rem] text-muted-foreground w-10 text-right">Casual</span>
                <input type="range" min="0" max="100" value={tone} onChange={(e) => setTone(Number(e.target.value))} className="flex-1 accent-primary h-1.5" />
                <span className="studio-mono text-[0.5rem] text-muted-foreground w-10">Formal</span>
                <span className="studio-mono text-[0.5rem] text-foreground/70 w-7 text-right">{tone}</span>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Emoji</Label>
                <div className="studio-mono text-[0.5rem] text-muted-foreground">{emojiEnabled ? 'On' : 'Off'}</div>
              </div>
              <Switch checked={emojiEnabled} onCheckedChange={setEmojiEnabled} />
            </div>

            {emojiEnabled && (
              <div>
                <Label className="studio-eyebrow mb-1 block">Emoji density</Label>
                <div className="flex items-center gap-3">
                  <span className="studio-mono text-[0.5rem] text-muted-foreground w-12 text-right">Minimal</span>
                  <input type="range" min="0" max="100" value={emojiDensity} onChange={(e) => setEmojiDensity(Number(e.target.value))} className="flex-1 accent-primary h-1.5" />
                  <span className="studio-mono text-[0.5rem] text-muted-foreground w-12">Heavy</span>
                  <span className="studio-mono text-[0.5rem] text-foreground/70 w-7 text-right">{emojiDensity}</span>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
              <input type="checkbox" checked={variantsEnabled} onChange={(e) => setVariantsEnabled(e.target.checked)} className="accent-primary" />
              A/B variants
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={generate} disabled={!canGenerate} className="flex-1 studio-btn-gradient" size="lg">
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                {generating ? 'Writing…' : 'Write captions'}
              </Button>
              {costEstimate && <div className="studio-mono text-[0.5rem] text-muted-foreground bg-secondary/50 border border-border rounded-sm px-2 py-1.5 shrink-0">~${costEstimate.estimated}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column — platform cards */}
      <div className="space-y-4">
        {generating && !result && <SkeletonResults />}
        {!generating && !result && <EmptyResults />}
        {result && result.variants && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultsPanel result={result.variant_a} variantLabel="A" regenerating={regenerating} onRegenerate={regenerate} onUpdatePost={updatePost} onSaveJob={saveJob} />
            <ResultsPanel result={result.variant_b} variantLabel="B" regenerating={regenerating} onRegenerate={regenerate} onUpdatePost={updatePost} onSaveJob={saveJob} />
          </div>
        )}
        {result && !result.variants && (
          <ResultsPanel result={result} regenerating={regenerating} onRegenerate={regenerate} onUpdatePost={updatePost} onSaveJob={saveJob} />
        )}
      </div>
    </div>
  )
}

const PLATFORM_STYLES = {
  linkedin: { bg: '#F0F2F5', avatar: '💼', name: 'LinkedIn Post' },
  instagram: { bg: '#FAFAFA', avatar: '📷', name: 'Instagram Post' },
  facebook: { bg: '#F0F2F5', avatar: '👥', name: 'Facebook Post' },
  threads: { bg: '#FAFAFA', avatar: '🧵', name: 'Threads Post' },
}

function EmptyResults() {
  return (
    <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30 h-full flex items-center justify-center">
      <div>
        <div className="mx-auto h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center mb-4"><Sparkles className="h-5 w-5 text-muted-foreground" /></div>
        <div className="text-foreground font-display font-semibold">Nothing on the desk yet</div>
        <div className="text-sm text-muted-foreground mt-1">Upload a photo, paste a URL, or write a brief — then generate.</div>
      </div>
    </div>
  )
}

function SkeletonResults() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PLATFORMS.slice(0, 4).map((p, i) => (
        <div key={p.key} className="bg-card border border-border rounded-sm p-4 animate-pulse space-y-2">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      ))}
    </div>
  )
}

function ResultsPanel({ result, regenerating, onRegenerate, onUpdatePost, onSaveJob, variantLabel }) {
  const [showContext, setShowContext] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')

  return (
    <div className="space-y-4">
      {variantLabel && <div className="studio-eyebrow text-sm text-primary font-semibold">Variant {variantLabel}</div>}
      {result.warnings?.length > 0 && (
        <div className="border border-[#D97706]/30 bg-[#D97706]/5 rounded-sm p-3 flex gap-2 text-sm text-[#D97706]">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium font-display">Warnings</div>
            <ul className="list-disc list-inside text-[#D97706]/80 text-xs mt-1 space-y-0.5">{result.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        </div>
      )}

      {/* Platform cards — Buffer-style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLATFORMS.slice(0, 4).map(p => {
          const post = result.posts[p.key]
          if (!post) return null
          const caption = post.caption || ''
          const hashtags = post.hashtags || []
          const overLimit = caption.length > p.limit
          const style = PLATFORM_STYLES[p.key] || {}
          const complianceWarnings = caption ? complianceCheck(caption) : []
          return (
            <div key={p.key} className="bg-card border border-border rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/20">
                <span className="text-sm">{style.avatar || '🌐'}</span>
                <span className="text-xs font-semibold">{style.name || p.label}</span>
                <span className={`ml-auto studio-mono text-[0.45rem] ${overLimit ? 'text-[#D97706]' : 'text-muted-foreground'}`}>{caption.length}/{p.limit}</span>
              </div>
              <div className="p-3 space-y-2" style={{ backgroundColor: style.bg || 'transparent' }}>
                {complianceWarnings.length > 0 && (
                  <div className="flex flex-wrap gap-1">{complianceWarnings.map((w, i) => <span key={i} className="text-[0.45rem] bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 px-1.5 py-0.5 rounded-sm">{w}</span>)}</div>
                )}
                <textarea value={caption} onChange={(e) => onUpdatePost(p.key, { caption: e.target.value })}
                  rows={4} className="w-full text-xs bg-white border border-border/50 rounded-sm p-2 resize-none focus:outline-none focus:border-primary/50"
                  placeholder="Edit caption…" />
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {hashtags.map((tag, i) => (
                      <span key={i} className="studio-mono text-[0.45rem] text-[#7C3AED] bg-[#7C3AED]/5 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        {tag}
                        <button onClick={() => onUpdatePost(p.key, { hashtags: hashtags.filter((_, j) => j !== i) })} className="opacity-60 hover:opacity-100"><X className="h-2 w-2" /></button>
                      </span>
                    ))}
                    <AddHashtagInline onAdd={(tag) => onUpdatePost(p.key, { hashtags: [...hashtags, tag] })} />
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => onRegenerate(p.key)} disabled={regenerating === p.key} className="studio-mono text-[0.45rem] text-muted-foreground hover:text-foreground flex items-center gap-1" title="Regenerate this platform">
                    {regenerating === p.key ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />} Regenerate
                  </button>
                  <button onClick={() => { const text = caption + (hashtags.length ? '\n\n' + hashtags.join(' ') : ''); navigator.clipboard.writeText(text); toast.success('Copied') }} className="studio-mono text-[0.45rem] text-muted-foreground hover:text-foreground" title="Copy">
                    <Copy className="h-2.5 w-2.5 inline mr-0.5" /> Copy
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pt-2 flex-wrap bg-card border border-border rounded-sm p-3">
        <Button size="sm" className="studio-btn-gradient h-8 text-xs" onClick={() => onSaveJob({ publishNow: true })}>
          <Send className="h-3.5 w-3.5 mr-1.5" /> Publish Now
        </Button>
        <div className="flex items-center gap-1">
          <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="w-28 text-[0.5rem] bg-secondary/50 border border-border rounded-sm px-1.5 py-1.5" />
          <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-20 text-[0.5rem] bg-secondary/50 border border-border rounded-sm px-1.5 py-1.5" />
          <Button size="sm" variant="outline" className="border-border h-8 text-xs" onClick={() => {
            const d = schedDate || new Date().toISOString().split('T')[0]; const t = schedTime || '10:00'
            onSaveJob({ scheduleFor: new Date(`${d}T${t}:00`).toISOString() })
          }}>
            <Clock className="h-3.5 w-3.5 mr-1" /> Schedule
          </Button>
        </div>
        <Button size="sm" variant="outline" className="border-border h-8 text-xs" onClick={() => onSaveJob({})}>
          <List className="h-3.5 w-3.5 mr-1" /> Send to Queue
        </Button>
        <span className="ml-auto studio-mono text-[0.45rem] text-muted-foreground">{result.ms ? `${(result.ms / 1000).toFixed(1)}s` : ''}</span>
      </div>
    </div>
  )
}

function AddHashtagInline({ onAdd }) {
  const [v, setV] = useState(''); const [open, setOpen] = useState(false)
  if (!open) return <button onClick={() => setOpen(true)} className="studio-mono text-[0.45rem] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded-full border border-dashed border-border hover:border-muted-foreground">+ tag</button>
  const commit = () => { let t = v.trim(); if (!t) { setOpen(false); return }; if (!t.startsWith('#')) t = '#' + t; t = t.replace(/\s+/g, ''); onAdd(t); setV(''); setOpen(false) }
  return <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false) }} placeholder="#tag" className="studio-mono text-[0.45rem] bg-secondary/50 border border-border rounded-sm px-1.5 py-0.5 w-16 focus:outline-none focus:border-primary" />
}

function OnboardingEmptyState() {
  const router = useRouter()
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="mx-auto h-16 w-16 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center mb-6 shadow-lg shadow-[#7C3AED]/20">
        <span className="font-display text-2xl font-bold text-white">S</span>
      </div>
      <h2 className="studio-title text-2xl">Welcome to Studio</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">Add an AI provider and start generating platform-native captions from any photo, article, or idea.</p>
      <div className="mt-8"><Button size="lg" className="studio-btn-gradient" onClick={() => router.push('/settings')}><KeyRound className="h-4 w-4 mr-2" /> Add AI provider <ArrowRight className="h-4 w-4 ml-2" /></Button></div>
    </div>
  )
}

function MissingActiveProvider() {
  const router = useRouter()
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <AlertTriangle className="h-10 w-10 mx-auto text-[#D97706] mb-4" />
      <h2 className="studio-title text-xl">No active text provider</h2>
      <p className="text-muted-foreground mt-2">Mark one of your providers as active for text in Settings.</p>
      <Button className="mt-6 studio-btn-gradient" onClick={() => router.push('/settings')}>Open Settings</Button>
    </div>
  )
}