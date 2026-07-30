'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Wand2, Send, ImageIcon, Eye, Globe, Pencil, X, Save, ExternalLink, Dribbble, Clock, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, StatusPill } from '@/components/shared'
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
                        <DialogHeader><DialogTitle>Drip to Social</DialogTitle><DialogDescription>Break into {dripCount} posts across {dripSpread} days.</DialogDescription></DialogHeader>
                        <div className="space-y-5 py-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm"><Label>Posts</Label><span>{dripCount}</span></div>
                            <Slider min={3} max={5} step={1} value={[dripCount]} onValueChange={v => setDripCount(v[0])} />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm"><Label>Spread (days)</Label><span>{dripSpread}</span></div>
                            <Slider min={3} max={7} step={1} value={[dripSpread]} onValueChange={v => setDripSpread(v[0])} />
                          </div>
                          {dripResult && (
                            <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 text-xs">
                              <div className="font-medium text-primary mb-1">Scheduled!</div>
                              {dripResult.posts?.map(p => <div key={p.id} className="text-muted-foreground">#{p.index} — {p.platform} — {new Date(p.scheduled_for).toLocaleDateString()}</div>)}
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
                  <div className="prose prose-sm max-w-none">
                    <h2 className="studio-title text-xl mb-2">{activePost.title}</h2>
                    {activePost.seo_description && <p className="text-sm text-muted-foreground italic mb-4">{activePost.seo_description}</p>}
                    <div className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{activePost.body_markdown}</div>
                    {activePost.published_url && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <a href={activePost.published_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Published at {activePost.published_url}
                        </a>
                      </div>
                    )}
                    {activePost.publish_error && (
                      <div className="mt-4 text-sm text-flag bg-flag/5 p-3 rounded-sm border border-flag/30">Error: {activePost.publish_error}</div>
                    )}
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

export default BlogPage