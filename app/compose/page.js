'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Upload, ImageIcon, Star, Wand2, Loader2, Trash2, Eye, EyeOff, Pencil,
  Send, Save, RefreshCw, Copy, X, Sparkles, ArrowRight, AlertTriangle, KeyRound,
  ChevronUp, ChevronDown, Link,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, PLATFORMS, PROVIDER_TYPES, resizeImageToBase64, StatusStamp, RunningOrderRow, PlatformEyebrow } from '@/components/shared'
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
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([api('/providers'), api('/prompt-styles')])
        setProviders(p)
        setStyles(s)
        if (s.length > 0) {
          setStyleId(prev => prev || (s.find(x => x.is_active) || s[0])?.id || null)
        }
      } catch (e) {
        toast.error(e.message)
      }
    })()
  }, [])

  const activeVision = providers.find(p => p.active_for_vision)
  const activeText = providers.find(p => p.active_for_text)
  const canGenerate = !!activeText && !generating && (images.length > 0 || context.trim().length > 0)

  const handleFile = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const newImages = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image.`)
        continue
      }
      try {
        const resized = await resizeImageToBase64(file)
        newImages.push({ file, ...resized })
      } catch (e) {
        toast.error(`Failed to process ${file.name}`)
      }
    }
    if (newImages.length === 0) return
    setImages(prev => {
      const combined = [...prev, ...newImages]
      return combined.slice(0, 10)
    })
    setResult(null)
  }

  useEffect(() => {
    const el = dropRef.current
    if (!el) return
    const onDrag = (e) => { e.preventDefault(); e.stopPropagation() }
    const onDrop = (e) => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (files && files.length > 0) handleFile(files)
    }
    el.addEventListener('dragover', onDrag)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDrag)
      el.removeEventListener('drop', onDrop)
    }
  }, [])

  const moveImage = (index, direction) => {
    setImages(prev => {
      const arr = [...prev]
      const target = index + direction
      if (target < 0 || target >= arr.length) return arr
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  const removeImage = (index) => {
    setImages(prev => {
      const removed = prev[index]
      if (removed?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
    setResult(null)
  }

  const extractUrl = async () => {
    if (!url.trim()) { toast.error('Enter a URL first'); return }
    setExtracting(true)
    try {
      const data = await api('/extract', { method: 'POST', body: { url: url.trim() } })
      const parts = []
      if (data.title) parts.push(`Title: ${data.title}`)
      if (data.description) parts.push(data.description)
      if (data.body) parts.push(data.body)
      const extracted = parts.join('\n\n')
      setContext(prev => prev ? `${prev}\n\n${extracted}` : extracted)
      toast.success('Content extracted')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setExtracting(false)
    }
  }

  const generate = async () => {
    if (!activeText) { toast.error('Set a text provider active in Settings first.'); router.push('/settings'); return }
    setGenerating(true)
    setResult(null)
    try {
      const started = Date.now()
      const data = await api('/generate', {
        method: 'POST',
        body: {
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          context: context.trim() || undefined,
          styleId: styleId || undefined,
          tone,
          pillar: pillar || undefined,
          variants: variantsEnabled ? 2 : undefined,
        },
      })
      setResult({ ...data, ms: Date.now() - started })
      toast.success(`Generated 5 captions in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const updatePost = (platform, patch) => {
    setResult(prev => prev && ({ ...prev, posts: { ...prev.posts, [platform]: { ...prev.posts[platform], ...patch } } }))
  }

  const regenerate = async (platform) => {
    setRegenerating(platform)
    try {
      const post = await api('/regenerate', {
        method: 'POST',
        body: {
          images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
          context: context.trim() || undefined,
          styleId: styleId || undefined,
          platform,
          currentResearchContext: result?.research_context,
          tone,
        },
      })
      updatePost(platform, post)
      toast.success(`Regenerated ${platform}`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setRegenerating(null)
    }
  }

  const saveDraft = async ({ publishNow = false, variantResult = null } = {}) => {
    const r = variantResult || result
    if (!r) return null
    try {
      const job = await api('/jobs', { method: 'POST', body: {
        source: 'ai_manual',
        topic: context.slice(0, 120),
        pillar,
        research_context: r.research_context,
        images: images.map(i => ({ base64: i.base64, mimeType: i.mimeType })),
        image_base64: images[0]?.base64 || undefined,
        image_mime: images[0]?.mimeType || undefined,
        style_id: r.style_used?.id,
        style_name: r.style_used?.name,
        platform_posts: r.posts,
        warnings: r.warnings,
        status: publishNow ? 'approved' : 'draft',
      }})
      toast.success(publishNow ? 'Job saved — publishing…' : 'Saved to drafts')
      if (!publishNow) {
        try {
          await api('/telegram/send-draft', { method: 'POST', body: { jobId: job.id } })
          toast.success('Sent to Telegram for approval')
        } catch (e) {
          if (!/token|chat not found|not configured/i.test(e.message)) {
            toast.error('Telegram: ' + e.message)
          }
        }
      }
      if (publishNow) {
        try {
          const r = await api(`/publish/${job.id}`, { method: 'POST', body: {} })
          const okCount = (r.results || []).filter(x => x.ok).length
          const failCount = (r.results || []).length - okCount
          if (okCount > 0) toast.success(`Published to ${okCount} platform(s)${failCount ? ` · ${failCount} failed` : ''}`)
          else toast.error(`Publish failed on all platforms — see draft warnings`)
        } catch (e) {
          toast.error('Publish: ' + e.message)
        }
      }
      return job
    } catch (e) { toast.error(e.message); return null }
  }

  if (providers.length === 0) return <OnboardingEmptyState />
  if (!activeText) return <MissingActiveProvider />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
      {/* Left column — intake */}
      <div className="space-y-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-serif font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" /> New assignment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              ref={dropRef}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-border hover:border-primary/40 rounded-sm overflow-hidden cursor-pointer transition-colors bg-secondary/30"
            >
              {images.length > 0 ? (
                <div className="p-2">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative group shrink-0">
                        <img src={img.previewUrl} alt="" className="w-20 h-20 object-cover rounded-sm" />
                        <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {i > 0 && (
                            <button onClick={(e) => { e.stopPropagation(); moveImage(i, -1) }} className="text-white p-0.5 hover:bg-white/20 rounded" title="Move left">
                              <ChevronUp className="h-3 w-3" />
                            </button>
                          )}
                          {i < images.length - 1 && (
                            <button onClick={(e) => { e.stopPropagation(); moveImage(i, 1) }} className="text-white p-0.5 hover:bg-white/20 rounded" title="Move right">
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); removeImage(i) }} className="text-white p-0.5 hover:bg-white/20 rounded" title="Remove">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {images.length < 10 && (
                      <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }} className="w-20 h-20 border border-dashed border-border rounded-sm flex items-center justify-center text-muted-foreground hover:border-primary/40 shrink-0">
                        <ImageIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <div className="editorial-mono text-[0.625rem] text-muted-foreground">{images.length}/10 images</div>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
                  <div className="text-sm">Drop photos here or click to browse</div>
                  <div className="editorial-mono text-[0.625rem] text-muted-foreground/60">JPG, PNG, WEBP — up to 10 images</div>
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files)} />
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Paste article/post URL…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-secondary/50 border-border text-sm flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={extractUrl}
                disabled={extracting || !url.trim()}
                className="border-border shrink-0"
              >
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                Extract
              </Button>
            </div>

            <div>
              <Label className="editorial-eyebrow mb-1.5 block">Brief</Label>
              <Textarea
                placeholder="e.g. Product launch for our new titanium travel mug — target eco-conscious commuters."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={4}
                className="bg-secondary/50 border-border resize-none text-sm"
              />
            </div>

            <div>
              <Label className="editorial-eyebrow mb-1.5 block">Voice</Label>
              <Select value={styleId || undefined} onValueChange={setStyleId}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue placeholder="Choose a voice…" /></SelectTrigger>
                <SelectContent>
                  {styles.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.is_active && <Star className="h-3 w-3 text-muted-foreground" />}
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="editorial-eyebrow mb-1.5 block">Pillar</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_PILLARS.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      <span className="flex items-center gap-2">{p.emoji} {p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="editorial-eyebrow mb-1.5 block">Tone</Label>
              <div className="flex items-center gap-3">
                <span className="editorial-mono text-[0.625rem] text-muted-foreground w-10 text-right">Casual</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tone}
                  onChange={(e) => setTone(Number(e.target.value))}
                  className="flex-1 accent-primary h-1.5"
                />
                <span className="editorial-mono text-[0.625rem] text-muted-foreground w-10">Formal</span>
                <span className="editorial-mono text-[0.625rem] text-foreground/70 w-7 text-right">{tone}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={variantsEnabled}
                onChange={(e) => setVariantsEnabled(e.target.checked)}
                className="accent-primary"
              />
              Generate A/B variants
            </label>

            <Button
              onClick={generate}
              disabled={!canGenerate}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-40"
              size="lg"
            >
              {generating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Writing…</>) : (<><Wand2 className="h-4 w-4 mr-2" /> Write captions</>)}
            </Button>

            <div className="editorial-mono text-[0.625rem] text-muted-foreground space-y-1 pt-1">
              <div className="flex items-center gap-1.5"><Eye className="h-3 w-3" /> Vision: <span className="text-foreground/70">{activeVision ? `${activeVision.name} · ${activeVision.model}` : 'not configured'}</span></div>
              <div className="flex items-center gap-1.5"><Pencil className="h-3 w-3" /> Text: <span className="text-foreground/70">{activeText.name} · {activeText.model}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column — running order results */}
      <div className="space-y-4">
        {generating && !result && <SkeletonResults />}
        {!generating && !result && <EmptyResults />}
        {result && result.variants && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultsPanel
              result={result.variant_a}
              variantLabel="A"
              regenerating={regenerating}
              onRegenerate={regenerate}
              onUpdatePost={updatePost}
              onSaveDraft={(opts) => saveDraft({ ...opts, variantResult: result.variant_a })}
              onPublishNow={(opts) => saveDraft({ publishNow: true, ...opts, variantResult: result.variant_a })}
            />
            <ResultsPanel
              result={result.variant_b}
              variantLabel="B"
              regenerating={regenerating}
              onRegenerate={regenerate}
              onUpdatePost={updatePost}
              onSaveDraft={(opts) => saveDraft({ ...opts, variantResult: result.variant_b })}
              onPublishNow={(opts) => saveDraft({ publishNow: true, ...opts, variantResult: result.variant_b })}
            />
          </div>
        )}
        {result && !result.variants && (
          <ResultsPanel
            result={result}
            regenerating={regenerating}
            onRegenerate={regenerate}
            onUpdatePost={updatePost}
            onSaveDraft={() => saveDraft({ publishNow: false })}
            onPublishNow={() => saveDraft({ publishNow: true })}
          />
        )}
      </div>
    </div>
  )
}

function EmptyResults() {
  return (
    <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
      <div className="mx-auto h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center mb-4">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-foreground font-serif font-semibold">Nothing on the desk yet</div>
      <div className="text-sm text-muted-foreground mt-1">Drop in a photo to start — or add a brief and let the AI write from scratch.</div>
    </div>
  )
}

function SkeletonResults() {
  return (
    <div className="space-y-0 divide-y divide-border">
      {PLATFORMS.map((p, i) => (
        <div key={p.key} className="running-order-row row-enter" style={{ animationDelay: `${i * 40}ms` }}>
          <span className="running-order-number">{i + 1}</span>
          <div className="flex-1 animate-pulse space-y-2">
            <div className="h-3 w-20 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ResultsPanel({ result, regenerating, onRegenerate, onUpdatePost, onSaveDraft, onPublishNow, variantLabel }) {
  const [showContext, setShowContext] = useState(false)
  return (
    <div className="space-y-4">
      {variantLabel && (
        <div className="editorial-eyebrow text-sm text-accent font-semibold">Variant {variantLabel}</div>
      )}
      {result.warnings?.length > 0 && (
        <div className="border border-flag/30 bg-flag/5 rounded-sm p-3 flex gap-2 text-sm text-flag">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium font-serif">Proofing notes</div>
            <ul className="list-disc list-inside text-flag/80 text-xs mt-1 space-y-0.5">
              {result.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      {result.research_context && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-serif flex items-center justify-between">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> Vision notes</span>
              <Button variant="ghost" size="sm" onClick={() => setShowContext(!showContext)}>
                {showContext ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {showContext && (
            <CardContent className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
              {result.research_context}
            </CardContent>
          )}
        </Card>
      )}

      {/* Running order — the signature layout */}
      <div className="bg-card border border-border rounded-sm p-4 sm:p-5">
        <div className="editorial-eyebrow mb-3">Running order · {result.style_used?.name || 'default'} voice</div>
        <div className="divide-y divide-border">
          {PLATFORMS.map((p, i) => (
            <PlatformRunningOrderRow
              key={p.key}
              index={i}
              platform={p}
              post={result.posts[p.key]}
              regenerating={regenerating === p.key}
              onRegenerate={() => onRegenerate(p.key)}
              onUpdate={(patch) => onUpdatePost(p.key, patch)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 flex-wrap">
        <Button variant="outline" className="border-border hover:bg-card" onClick={onSaveDraft}>
          <Save className="h-4 w-4 mr-2" /> Save draft
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={onPublishNow}>
          <Send className="h-4 w-4 mr-2" /> Publish now
        </Button>
        <div className="ml-auto editorial-mono text-[0.625rem] text-muted-foreground">
          Generated in {(result.ms / 1000).toFixed(1)}s
        </div>
      </div>
    </div>
  )
}

function PlatformRunningOrderRow({ index, platform, post, regenerating, onRegenerate, onUpdate }) {
  const caption = post?.caption || ''
  const hashtags = post?.hashtags || []
  const overLimit = caption.length > platform.limit
  const complianceWarnings = caption ? complianceCheck(caption) : []

  return (
    <RunningOrderRow index={index}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        {/* Left: platform + caption */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <PlatformEyebrow platform={platform.key} />
            <span className={`editorial-mono text-[0.625rem] ${overLimit ? 'text-flag' : 'text-muted-foreground'}`}>
              {caption.length}/{platform.limit}
            </span>
          </div>
          {complianceWarnings.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {complianceWarnings.map((w, i) => (
                <span key={i} className="text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 px-2 py-0.5 rounded-sm flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
                </span>
              ))}
            </div>
          )}
          <Textarea
            value={caption}
            onChange={(e) => onUpdate({ caption: e.target.value })}
            rows={3}
            className="bg-secondary/30 border-border text-sm resize-none mt-1"
          />
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hashtags.map((tag, i) => (
                <span key={i} className="editorial-mono text-[0.625rem] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                  {tag}
                  <button onClick={() => onUpdate({ hashtags: hashtags.filter((_, j) => j !== i) })} className="opacity-60 hover:opacity-100">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <AddHashtagInline onAdd={(tag) => onUpdate({ hashtags: [...hashtags, tag] })} />
            </div>
          )}
        </div>
        {/* Right: actions */}
        <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent disabled:opacity-50"
            title="Rewrite"
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => {
              const text = caption + (hashtags.length ? '\n\n' + hashtags.join(' ') : '')
              navigator.clipboard.writeText(text)
              toast.success('Copied')
            }}
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </RunningOrderRow>
  )
}

function AddHashtagInline({ onAdd }) {
  const [v, setV] = useState('')
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="editorial-mono text-[0.625rem] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-sm border border-dashed border-border hover:border-muted-foreground">
        + tag
      </button>
    )
  }
  const commit = () => {
    let t = v.trim()
    if (!t) { setOpen(false); return }
    if (!t.startsWith('#')) t = '#' + t
    t = t.replace(/\s+/g, '')
    onAdd(t); setV(''); setOpen(false)
  }
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setOpen(false) }}
      placeholder="#tag"
      className="editorial-mono text-[0.625rem] bg-secondary/50 border border-border rounded-sm px-2 py-0.5 w-20 focus:outline-none focus:border-primary"
    />
  )
}

function OnboardingEmptyState() {
  const router = useRouter()
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      <div className="mx-auto h-16 w-16 rounded-sm bg-primary flex items-center justify-center mb-6">
        <span className="font-serif text-2xl font-bold text-primary-foreground">D</span>
      </div>
      <h2 className="editorial-title text-2xl">Welcome to The Desk</h2>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">
        Your one-person newsroom. Add an AI provider and start generating platform-native captions from any photo.
      </p>
      <div className="mt-8">
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          onClick={() => router.push('/settings')}
        >
          <KeyRound className="h-4 w-4 mr-2" /> Add AI provider <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-10 text-xs text-muted-foreground">
        {PROVIDER_TYPES.slice(0, 4).map(p => (
          <div key={p.value} className="border border-border rounded-sm p-3 bg-card">
            <div className="text-foreground font-medium">{p.label}</div>
            <div className="editorial-mono text-[0.625rem] mt-1">{p.defaultModel}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MissingActiveProvider() {
  const router = useRouter()
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <AlertTriangle className="h-10 w-10 mx-auto text-flag mb-4" />
      <h2 className="editorial-title text-xl">No active text provider</h2>
      <p className="text-muted-foreground mt-2">Mark one of your providers as active for text in Settings.</p>
      <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => router.push('/settings')}>Open Settings</Button>
    </div>
  )
}
