'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Wand2, Send, ImageIcon, Eye, Globe, Pencil, X, Save, ExternalLink, Dribbble, Clock, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, StatusPill, PLATFORMS } from '@/components/shared'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

function BlogPage() {
  const [posts, setPosts] = useState([])
  const [activePost, setActivePost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [context, setContext] = useState('')
  const [styleId, setStyleId] = useState('')
  const [styles, setStyles] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editSeo, setEditSeo] = useState('')
  const [imageBase64, setImageBase64] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([api('/blog/posts'), api('/prompt-styles')])
      setPosts(p || []); setStyles(s || [])
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const handleImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => { const base64 = ev.target.result.split(',')[1]; setImageBase64(base64); setImagePreview(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const generate = async () => {
    if (!context.trim()) return toast.error('Enter a topic or context first')
    setGenerating(true)
    try {
      const result = await api('/blog/generate', {
        method: 'POST',
        body: { image_base64: imageBase64, mime_type: imageFile?.type || 'image/jpeg', context, style_id: styleId || undefined },
      })
      const bp = await api('/blog/posts', {
        method: 'POST',
        body: { title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description, status: 'draft' },
      })
      setActivePost(bp)
      setEditing(false)
      setShowPreview(true)
      toast.success('Article generated — review before publishing')
      setContext(''); setImageFile(null); setImagePreview(null); setImageBase64(null)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const publishNow = async () => {
    if (!activePost) return
    setPublishing(true)
    try {
      const result = await api('/blog/publish/' + activePost.id, { method: 'POST', body: { dry_run: false } })
      toast.success('Published to INSIGHTS!')
      setActivePost(prev => ({ ...prev, status: 'published', published_url: result.url }))
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setPublishing(false) }
  }

  const scheduleForLater = async () => {
    if (!activePost) return
    try {
      const sched = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { status: 'scheduled', scheduled_for: sched } })
      toast.success('Scheduled for 2 hours from now')
      setActivePost(prev => ({ ...prev, status: 'scheduled' }))
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const regenerate = async () => {
    if (!activePost) return
    setGenerating(true)
    try {
      const result = await api('/blog/generate', {
        method: 'POST',
        body: { context: activePost.title + ' — ' + (activePost.seo_description || ''), style_id: styleId || undefined },
      })
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description } })
      toast.success('Regenerated')
      setActivePost(prev => ({ ...prev, title: result.title, body_markdown: result.body_markdown, seo_description: result.seo_description }))
      setEditing(false)
    } catch (e) { toast.error(e.message) } finally { setGenerating(false) }
  }

  const rejectArticle = async () => {
    if (!activePost) return
    try {
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { status: 'rejected' } })
      toast.success('Rejected')
      setActivePost(null)
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const skipDraft = async () => {
    if (!activePost) return
    try {
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { status: 'draft' } })
      toast.success('Saved as draft')
      setActivePost(null)
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const saveEdit = async () => {
    if (!activePost) return
    try {
      await api('/blog/posts/' + activePost.id, { method: 'PUT', body: { title: editTitle, body_markdown: editBody, seo_description: editSeo } })
      toast.success('Saved')
      setEditing(false)
      setActivePost(prev => ({ ...prev, title: editTitle, body_markdown: editBody, seo_description: editSeo }))
    } catch (e) { toast.error(e.message) }
  }

  const selectPost = (p) => { setActivePost(p); setEditing(false); setEditTitle(p.title); setEditBody(p.body_markdown); setEditSeo(p.seo_description || ''); setShowPreview(true) }

  const [dripOpen, setDripOpen] = useState(false); const [dripCount, setDripCount] = useState(4); const [dripSpread, setDripSpread] = useState(5); const [dripRunning, setDripRunning] = useState(false); const [dripResult, setDripResult] = useState(null)

  const runDrip = async () => {
    if (!activePost) return; setDripRunning(true); setDripResult(null)
    try {
      const result = await api('/blog-drip/' + activePost.id, { method: 'POST', body: { count: dripCount, spread_days: dripSpread } })
      setDripResult(result); toast.success('Scheduled ' + result.total + ' drip posts')
    } catch (e) { toast.error(e.message) } finally { setDripRunning(false) }
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <div className="border border-border rounded-sm bg-card p-4 space-y-3 shadow-sm">
            <h4 className="text-sm font-display font-semibold">New Article</h4>
            <Textarea value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="Topic or context for the AI article..." className="text-sm bg-secondary/50 border-border" />
            <div className="flex items-center gap-2">
              <select value={styleId} onChange={e => setStyleId(e.target.value)} className="studio-mono text-[0.625rem] border border-border rounded-sm px-3 py-1.5 bg-card flex-1">
                <option value="">Default style</option>
                {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label className="cursor-pointer studio-mono text-[0.625rem] border border-border rounded-sm px-3 py-1.5 hover:bg-accent/50 text-muted-foreground flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" /> {imageFile ? 'Set' : 'Cover'}
                <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </label>
            </div>
            {imagePreview && <img src={imagePreview} alt="" className="h-20 rounded-sm object-cover" />}
            <Button onClick={generate} disabled={generating || !context.trim()} className="w-full studio-btn-gradient">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              {generating ? 'Generating...' : 'Generate Article'}
            </Button>
          </div>

          <div className="border border-border rounded-sm bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-display font-semibold">Articles ({posts.length})</span>
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" onClick={refresh} />
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {posts.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No articles yet.</div>
              ) : posts.map(p => (
                <div key={p.id} onClick={() => selectPost(p)}
                  className={`px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors ${activePost?.id === p.id ? 'bg-accent/50 border-l-2 border-l-primary' : ''}`}>
                  <div className="text-sm font-medium truncate">{p.title || 'Untitled'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusPill status={p.status} />
                    <span className="studio-mono text-[0.5rem] text-muted-foreground">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-3">
          {!showPreview || !activePost ? (
            <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30 h-full flex items-center justify-center">
              <div>
                <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <div className="text-foreground font-display font-semibold">Review your article</div>
                <div className="text-sm text-muted-foreground mt-1">Generate an article, then review and publish here.</div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-sm bg-card overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <StatusPill status={activePost.status} />
                  {activePost.published_url && (
                    <a href={activePost.published_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activePost.status !== 'published' && activePost.status !== 'rejected' && (
                    <>
                      <Button size="sm" onClick={publishNow} disabled={publishing} className="studio-btn-gradient h-7 text-xs">
                        {publishing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                        Publish Now
                      </Button>
                      <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={scheduleForLater}>
                        <Clock className="h-3 w-3 mr-1" /> Schedule
                      </Button>
                      <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => { setEditing(v => !v); if (!v) { setEditTitle(activePost.title); setEditBody(activePost.body_markdown); setEditSeo(activePost.seo_description || '') } }}>
                        <Pencil className="h-3 w-3 mr-1" /> {editing ? 'Preview' : 'Edit'}
                      </Button>
                      <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={regenerate} disabled={generating}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Regenerate
                      </Button>
                      <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={skipDraft}>
                        <X className="h-3 w-3 mr-1" /> Skip
                      </Button>
                      <Button size="sm" variant="outline" className="border-flag/50 text-flag h-7 text-xs hover:bg-red-50" onClick={rejectArticle}>
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  {activePost.status === 'published' && (
                    <Dialog open={dripOpen} onOpenChange={setDripOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="border-border h-7 text-xs"><Dribbble className="h-3 w-3 mr-1" /> Drip to Social</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Drip to Social</DialogTitle><DialogDescription>Break into {dripCount} posts across {dripSpread} days, each posted to all platforms.</DialogDescription></DialogHeader>
                        <div className="space-y-5 py-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm"><Label>Number of posts</Label><span className="font-medium">{dripCount}</span></div>
                            <Slider min={3} max={5} step={1} value={[dripCount]} onValueChange={v => setDripCount(v[0])} />
                            <div className="flex justify-between text-xs text-muted-foreground"><span>3</span><span>5</span></div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm"><Label>Spread across (days)</Label><span className="font-medium">{dripSpread}</span></div>
                            <Slider min={3} max={7} step={1} value={[dripSpread]} onValueChange={v => setDripSpread(v[0])} />
                            <div className="flex justify-between text-xs text-muted-foreground"><span>3</span><span>7</span></div>
                          </div>
                          <div className="bg-secondary/50 rounded-sm p-3 text-xs space-y-1.5 border border-border">
                            <div className="font-semibold text-foreground/80 mb-1">Schedule preview</div>
                            {Array.from({ length: dripCount }, (_, i) => {
                              const d = new Date(); d.setDate(d.getDate() + Math.floor((dripSpread / dripCount) * i) + 1); d.setHours(10 + (i % 8), 0, 0, 0)
                              return (
                                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                                  <span className="w-5 text-right font-medium text-foreground/60">#{i + 1}</span>
                                  <span>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span className="ml-auto flex gap-0.5">{PLATFORMS.slice(0, 4).map(p => <span key={p.key} className="text-[0.45rem] bg-secondary border border-border rounded-sm px-1">{p.letter}</span>)}</span>
                                </div>
                              )
                            })}
                          </div>
                          {dripResult && (
                            <div className="space-y-2">
                              <div className="font-medium text-primary text-sm">Scheduled! 🎉</div>
                              <div className="grid gap-2">
                                {dripResult.posts?.map(p => {
                                  const icons = { linkedin: '💼', instagram: '📷', facebook: '👥', threads: '🧵', twitter: '🐦' }
                                  return (
                                    <div key={p.id} className="border border-border rounded-sm p-2.5 bg-card text-xs space-y-1">
                                      <div className="flex items-center gap-1.5 font-medium">
                                        <span>{icons[p.platform] || '🌐'}</span>
                                        <span className="capitalize">{p.platform}</span>
                                        <span className="ml-auto text-muted-foreground font-normal">{new Date(p.scheduled_for).toLocaleDateString()} {new Date(p.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      <div className="text-muted-foreground line-clamp-2">{p.caption}</div>
                                      <div className="text-[0.45rem] text-muted-foreground">#{p.index} of {dripCount}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <Button onClick={runDrip} disabled={dripRunning} className="w-full studio-btn-gradient">
                            {dripRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Dribbble className="h-4 w-4 mr-2" />}
                            {dripRunning ? 'Generating...' : 'Generate & Schedule'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              <div className="p-4 max-h-[600px] overflow-y-auto">
                {editing ? (
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" className="text-lg font-semibold bg-secondary/50 border-border" />
                    <Input value={editSeo} onChange={e => setEditSeo(e.target.value)} placeholder="SEO description" className="text-sm text-muted-foreground bg-secondary/50 border-border" />
                    <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={20} className="text-sm studio-mono leading-relaxed bg-secondary/50 border-border" />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="border-border" onClick={() => setEditing(false)}>Cancel</Button>
                      <Button size="sm" onClick={saveEdit} className="studio-btn-gradient"><Save className="h-3 w-3 mr-1" /> Save</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-sm p-4">
                      <div className="studio-eyebrow mb-2">Article</div>
                      <h2 className="studio-title text-lg mb-1">{activePost.title}</h2>
                      <div className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">{activePost.body_markdown}</div>
                    </div>

                    <div className="bg-card border border-border rounded-sm p-4">
                      <div className="studio-eyebrow mb-2">SEO</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider mb-0.5">Meta Description</div>
                          <div className="text-foreground/80">{activePost.seo_description || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider mb-0.5">Keywords</div>
                          <div className="text-foreground/80">{activePost.keywords || activePost.tags?.join(', ') || '—'}</div>
                        </div>
                        <div>
                          <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider mb-0.5">Tags</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">{(activePost.tags || []).slice(0, 6).map((t, i) => <span key={i} className="text-[0.5rem] bg-secondary border border-border rounded-sm px-1.5 py-0.5">{t}</span>)}</div>
                        </div>
                        <div>
                          <div className="text-[0.5rem] text-muted-foreground uppercase tracking-wider mb-0.5">Slug</div>
                          <div className="text-foreground/80 font-mono text-[0.6rem]">{activePost.slug || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card border border-border rounded-sm p-4">
                      <div className="studio-eyebrow mb-2">Platform Previews</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PLATFORMS.slice(0, 4).map(p => (
                          <div key={p.key} className="border border-border rounded-sm p-3 bg-secondary/20 text-xs space-y-1">
                            <div className="font-semibold text-foreground/80 uppercase tracking-wider">{p.label}</div>
                            <div className="text-muted-foreground line-clamp-3">{activePost.seo_description || activePost.title}</div>
                            <div className="text-[0.5rem] text-muted-foreground">Max {p.limit} chars</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {activePost.published_url && (
                      <div className="bg-card border border-border rounded-sm p-4">
                        <a href={activePost.published_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Published at {activePost.published_url}
                        </a>
                      </div>
                    )}
                    {activePost.publish_error && (
                      <div className="text-sm text-flag bg-flag/5 p-3 rounded-sm border border-flag/30">Error: {activePost.publish_error}</div>
                    )}
                    {activePost.status === 'published' && <DripManagement blogId={activePost.id} />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DripManagement({ blogId }) {
  const [dripJobs, setDripJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedPost, setExpandedPost] = useState(null)
  const [expandedPlatform, setExpandedPlatform] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [regenerating, setRegenerating] = useState(null)

  const loadDrips = async () => {
    setLoading(true)
    try {
      const jobs = await api('/jobs')
      const drips = jobs.filter(j => j.campaign_id === `drip_${blogId}`)
      setDripJobs(drips)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (blogId) loadDrips() }, [blogId])

  const savePlatform = async (jobId, platform) => {
    try {
      const job = dripJobs.find(j => j.id === jobId)
      const posts = { ...(job.platform_posts || {}) }
      posts[platform] = { ...(posts[platform] || {}), caption: editValues[`${jobId}_${platform}`] || posts[platform]?.caption, hashtags: editValues[`${jobId}_${platform}_tags`]?.split(',').map(t => t.trim()).filter(Boolean) || posts[platform]?.hashtags }
      await api('/jobs/' + jobId, { method: 'PUT', body: { platform_posts: posts } })
      toast.success('Saved')
      setExpandedPlatform(null)
      await loadDrips()
    } catch (e) { toast.error(e.message) }
  }

  const regeneratePlatform = async (jobId, platform) => {
    setRegenerating(`${jobId}_${platform}`)
    try {
      const job = dripJobs.find(j => j.id === jobId)
      const result = await api('/regenerate/' + jobId, { method: 'POST', body: { platform, styleId: '' } })
      const posts = { ...(job.platform_posts || {}) }
      posts[platform] = { ...result, hashtags: result.hashtags || [] }
      await api('/jobs/' + jobId, { method: 'PUT', body: { platform_posts: posts } })
      toast.success('Regenerated ' + platform)
      await loadDrips()
    } catch (e) { toast.error(e.message) } finally { setRegenerating(null) }
  }

  const platformMeta = { linkedin: { emoji: '💼', label: 'LinkedIn', color: '#0A66C2' }, instagram: { emoji: '📷', label: 'Instagram', color: '#E4405F' }, facebook: { emoji: '👥', label: 'Facebook', color: '#1877F2' }, threads: { emoji: '🧵', label: 'Threads', color: '#000000' }, twitter: { emoji: '🐦', label: 'X', color: '#000000' } }

  if (loading) return <div className="mt-4 text-sm text-muted-foreground">Loading drip posts…</div>
  if (dripJobs.length === 0) return null

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Dribbble className="h-4 w-4 text-primary" />
        <span className="studio-eyebrow">Social Drip ({dripJobs.length} posts)</span>
      </div>
      <div className="space-y-2">
        {dripJobs.map((job, pi) => {
          const platforms = Object.keys(job.platform_posts || {})
          return (
            <div key={job.id} className="border border-border rounded-sm bg-card overflow-hidden">
              <button onClick={() => setExpandedPost(expandedPost === job.id ? null : job.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary/20 transition-colors">
                <span className="font-medium text-muted-foreground">#{pi + 1}</span>
                <span className="flex-1 text-left truncate">{job.topic?.replace(/^Drip \d+\/\d+: /, '') || 'Drip post'}</span>
                <span className="studio-mono text-[0.5rem] text-muted-foreground">{job.scheduled_for ? new Date(job.scheduled_for).toLocaleDateString() : ''}</span>
                <span className="flex gap-1">{platforms.map(p => {
                  const m = platformMeta[p]
                  return m ? <span key={p} style={{ color: m.color }} className="text-xs">{m.emoji}</span> : null
                })}</span>
                {expandedPost === job.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {expandedPost === job.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  {platforms.map(p => {
                    const m = platformMeta[p]
                    const post = job.platform_posts[p] || {}
                    const isOpen = expandedPlatform === `${job.id}_${p}`
                    return (
                      <div key={p} className="border border-border rounded-sm bg-secondary/10">
                        <button onClick={() => setExpandedPlatform(isOpen ? null : `${job.id}_${p}`)} className="w-full flex items-center gap-2 px-2.5 py-2 text-xs hover:bg-secondary/20 transition-colors">
                          <span>{m?.emoji || '🌐'}</span>
                          <span className="font-medium">{m?.label || p}</span>
                          <span className="ml-auto text-muted-foreground">{post.caption?.length || 0} chars</span>
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {isOpen && (
                          <div className="p-2.5 border-t border-border space-y-2">
                            <div>
                              <div className="studio-eyebrow mb-1">Caption</div>
                              <textarea value={editValues[`${job.id}_${p}`] !== undefined ? editValues[`${job.id}_${p}`] : (post.caption || '')} onChange={e => setEditValues(v => ({ ...v, [`${job.id}_${p}`]: e.target.value }))} rows={3} className="w-full text-xs bg-secondary/50 border border-border rounded-sm p-2 resize-none" />
                            </div>
                            <div>
                              <div className="studio-eyebrow mb-1">Hashtags (comma separated)</div>
                              <input value={editValues[`${job.id}_${p}_tags`] !== undefined ? editValues[`${job.id}_${p}_tags`] : (post.hashtags || []).join(', ')} onChange={e => setEditValues(v => ({ ...v, [`${job.id}_${p}_tags`]: e.target.value }))} className="w-full text-xs bg-secondary/50 border border-border rounded-sm px-2 py-1.5" />
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => savePlatform(job.id, p)} className="studio-btn-gradient h-6 text-[0.6rem]"><Save className="h-2.5 w-2.5 mr-1" /> Save</Button>
                              <Button size="sm" variant="outline" className="border-border h-6 text-[0.6rem]" onClick={() => regeneratePlatform(job.id, p)} disabled={regenerating === `${job.id}_${p}`}>
                                {regenerating === `${job.id}_${p}` ? <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5 mr-1" />}
                                Regenerate
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default BlogPage