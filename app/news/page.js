'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw, Loader2, Wand2, Send, X, List, Plus, Globe, Trash2, AlertTriangle, Radio, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, StatusStamp } from '@/components/shared'
import { toast } from 'sonner'

function NewsRadarPage() {
  const [sources, setSources] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [showSources, setShowSources] = useState(false)
  const [editingSource, setEditingSource] = useState(null)
  const [generating, setGenerating] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [conflicts, setConflicts] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([api('/news/sources'), api('/news/all?status=' + statusFilter)])
      setSources(s); setPosts(p)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [statusFilter])

  const checkNow = async () => {
    setChecking(true)
    try { const r = await api('/news/check', { method: 'POST' }); toast.success(`Checked sources — ${r.new} new item(s) found`); await refresh() }
    catch (e) { toast.error(e.message) } finally { setChecking(false) }
  }

  const addSource = async () => {
    const name = prompt('Source name:')
    if (!name) return
    const url = prompt('RSS/Atom feed URL:')
    if (!url) return
    try { await api('/news/sources', { method: 'POST', body: { name, url } }); toast.success('Source added'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const deleteSource = async (id) => {
    if (!confirm('Delete this source?')) return
    try { await api('/news/' + id + '/source', { method: 'DELETE' }); toast.success('Source deleted'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const generateAi = async (newsId) => {
    setGenerating(newsId)
    try { await api('/news/generate', { method: 'POST', body: { news_id: newsId } }); toast.success('AI content generated'); await refresh() }
    catch (e) { toast.error(e.message) } finally { setGenerating(null) }
  }

  const approveAndSchedule = async (item) => {
    const platforms = Object.keys(item.generated_posts || {})
    if (platforms.length === 0) return toast.error('Generate AI content first')
    const now = new Date()
    now.setMinutes(now.getMinutes() + 5)
    const suggestedSlot = now.toISOString()
    try {
      const c = await api('/news/conflicts', { method: 'POST', body: { platform: platforms[0], scheduled_for: suggestedSlot, exclude_id: item.id } })
      if (c.length > 0) {
        const nextSlot = await api('/news/next-slot', { method: 'POST', body: { platform: platforms[0], after: suggestedSlot } })
        setConflicts({ item, conflicts: c, nextSlot: nextSlot })
        return
      }
      await publishNow(item)
    } catch (e) { toast.error(e.message) }
  }

  const publishNow = async (item, platforms) => {
    setPublishing(item.id)
    try {
      const r = await api('/news/publish', { method: 'POST', body: { news_id: item.id, platforms: platforms || Object.keys(item.generated_posts || {}) } })
      if (r.results?.some(rr => rr.ok)) toast.success('Published!')
      else toast.error('Publish failed: ' + (r.results?.[0]?.error || 'unknown'))
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setPublishing(null); setConflicts(null) }
  }

  const rejectItem = async (id) => {
    try { await api('/news/' + id, { method: 'PUT', body: { status: 'rejected' } }); toast.success('Rejected'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const statuses = ['', 'new', 'ai_generated', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected']
  const statusLabels = { '': 'All', new: 'New', ai_generated: 'AI Ready', pending_approval: 'Pending Approval', approved: 'Approved', scheduled: 'Scheduled', published: 'Published', rejected: 'Rejected' }

  const itemActions = (item) => {
    const canGenerate = item.status === 'new'
    const canPublish = item.status === 'pending_approval' || item.status === 'approved'
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {canGenerate && (
          <Button size="sm" onClick={() => generateAi(item.id)} disabled={generating === item.id} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7">
            {generating === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
            Generate AI
          </Button>
        )}
        {canPublish && (
          <>
            <Button size="sm" onClick={() => approveAndSchedule(item)} disabled={publishing === item.id} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-7">
              {publishing === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
              Approve & Publish
            </Button>
            <Button size="sm" onClick={() => rejectItem(item.id)} variant="outline" className="border-flag/50 text-flag text-xs h-7">
              <X className="h-3 w-3 mr-1" /> Reject
            </Button>
          </>
        )}
        {item.status === 'published' && item.publish_results && (
          <div className="editorial-mono text-[0.5rem] text-muted-foreground">Published {item.published_at_actual ? new Date(item.published_at_actual).toLocaleDateString() : ''}</div>
        )}
      </div>
    )
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-serif font-semibold text-lg">News Radar</h3>
          <p className="text-sm text-muted-foreground">Breaking news from your monitored RSS sources.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border" onClick={() => setShowSources(v => !v)}>
            <List className="h-4 w-4 mr-2" /> Sources ({sources.length})
          </Button>
          <Button onClick={checkNow} disabled={checking} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Check for News
          </Button>
          <Button variant="outline" className="border-border" onClick={addSource}>
            <Plus className="h-4 w-4 mr-2" /> Add Source
          </Button>
        </div>
      </div>

      {showSources && (
        <div className="border border-border rounded-sm p-4 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-serif font-semibold">News Sources</h4>
            <span className="editorial-mono text-[0.5rem] text-muted-foreground">{sources.filter(s => s.is_active).length} active</span>
          </div>
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No sources yet. Add an RSS/Atom feed URL.</div>
          ) : (
            <div className="space-y-1.5">
              {sources.map(s => (
                <div key={s.id} className="flex items-center gap-3 text-sm bg-secondary/30 border border-border rounded-sm px-3 py-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="editorial-mono text-[0.5rem] text-muted-foreground truncate">{s.url}</div>
                  </div>
                  <span className="editorial-mono text-[0.5rem] text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-sm">{s.category}</span>
                  <StatusStamp status={s.is_active ? 'live' : 'draft'} />
                  <span className="editorial-mono text-[0.5rem] text-muted-foreground">{s.last_checked_at ? new Date(s.last_checked_at).toLocaleDateString() : 'never'}</span>
                  <button onClick={() => deleteSource(s.id)} className="text-muted-foreground hover:text-flag"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {conflicts && (
        <div className="border border-flag/30 rounded-sm p-4 bg-flag/5 space-y-3">
          <div className="flex items-center gap-2 text-flag font-serif font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" /> Scheduling Conflict Detected
          </div>
          <p className="editorial-mono text-[0.5rem] text-flag/80">The selected time conflicts with other scheduled content:</p>
          <ul className="editorial-mono text-[0.5rem] text-flag/70 space-y-1">
            {conflicts.conflicts.map((c, i) => (
              <li key={i}>• {c.source}: "{c.title}" at {new Date(c.scheduled_for).toLocaleString()} on {c.platform}</li>
            ))}
          </ul>
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" onClick={() => publishNow(conflicts.item)} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
              Publish Anyway
            </Button>
            <Button size="sm" onClick={async () => { await publishNow(conflicts.item); setConflicts(null) }} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
              Publish After Conflict ({new Date(conflicts.nextSlot).toLocaleTimeString()})
            </Button>
            <Button size="sm" variant="outline" className="border-border text-xs" onClick={() => setConflicts(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
          <Radio className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">No news items</div>
          <div className="text-sm text-muted-foreground mt-1">Add a news source, then click "Check for News".</div>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(item => (
            <div key={item.id} className="border border-border rounded-sm p-4 bg-card space-y-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.is_trending && <span className="status-stamp status-stamp--pending">TRENDING</span>}
                    {item.is_urgent && <span className="status-stamp status-stamp--failed">URGENT</span>}
                    <StatusStamp status={item.status} />
                    {item.source_name && <span className="editorial-mono text-[0.5rem] text-muted-foreground">{item.source_name}</span>}
                  </div>
                  <h4 className="font-medium text-sm leading-snug">{item.title}</h4>
                  {item.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
                  {item.generated_posts && (
                    <div className="flex items-center gap-1.5 mt-2 editorial-mono text-[0.5rem] text-muted-foreground">
                      {Object.keys(item.generated_posts).map(p => (
                        <span key={p} className="editorial-mono text-[0.5rem] text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-sm">{p}</span>
                      ))}
                      <span className="ml-1">AI captions ready</span>
                    </div>
                  )}
                </div>
                {item.image_url && <img src={item.image_url} alt="" className="h-16 w-16 rounded-sm object-cover shrink-0 border border-border" />}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 editorial-mono text-[0.5rem] text-muted-foreground">
                  {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3 w-3" /> Source</a>}
                  {item.published_at && <span>{new Date(item.published_at).toLocaleDateString()}</span>}
                  {item.category && <span className="editorial-mono text-[0.5rem] text-muted-foreground border border-border/50 px-1.5 py-0.5 rounded-sm">{item.category}</span>}
                </div>
                {itemActions(item)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default NewsRadarPage
