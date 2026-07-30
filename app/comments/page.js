'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw, MessageSquare, Reply, Send, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { api, StatusStamp, RunningOrderRow } from '@/components/shared'
import { toast } from 'sonner'

function InboxPage() {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [replyingId, setReplyingId] = useState(null)
  const [replyTexts, setReplyTexts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [sortBy, setSortBy] = useState('chronological')

  const refresh = async () => {
    setLoading(true)
    try { setComments(await api('/comments')) } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const generateDraft = async (id) => {
    try {
      const r = await api(`/comments/${id}/auto-reply`, { method: 'POST' })
      setReplyTexts(prev => ({ ...prev, [id]: r.draft_reply }))
      toast.success('Draft generated')
    } catch (e) { toast.error(e.message) }
  }

  const fetchNow = async () => {
    setFetching(true)
    try {
      const r = await api('/comments/fetch', { method: 'POST' })
      toast.success(`Fetched ${r.fetched} new comment(s)`)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setFetching(false) }
  }

  const updateStatus = async (id, status) => {
    try {
      await api(`/comments/${id}`, { method: 'PUT', body: { status } })
      toast.success(status === 'replied' ? 'Marked as replied' : status === 'ignored' ? 'Ignored' : 'Updated')
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const saveDraftReply = async (id) => {
    setSavingId(id)
    try {
      await api(`/comments/${id}`, { method: 'PUT', body: { draft_reply: replyTexts[id] || '' } })
      toast.success('Draft saved')
    } catch (e) { toast.error(e.message) } finally { setSavingId(null) }
  }

  const sendReply = async (id) => {
    const text = replyTexts[id]
    if (!text || !text.trim()) return toast.error('Write a reply first')
    setSavingId(id)
    try {
      await api(`/comments/${id}/reply`, { method: 'POST', body: { reply_text: text } })
      toast.success('Reply posted')
      setReplyTexts(r => { const n = { ...r }; delete n[id]; return n })
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setSavingId(null) }
  }

  const statusCounts = { all: comments.length, pending: 0, replied: 0, ignored: 0 }
  for (const c of comments) { if (statusCounts[c.status] !== undefined) statusCounts[c.status]++ }

  let filtered = statusFilter === 'all' ? comments : comments.filter(c => c.status === statusFilter)
  if (sortBy === 'followers') filtered = [...filtered].sort((a, b) => (b.commenter_follower_count || 0) - (a.commenter_follower_count || 0))
  else filtered = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

  const statusFilters = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'replied', label: 'Replied', count: statusCounts.replied },
    { key: 'ignored', label: 'Ignored', count: statusCounts.ignored },
  ]

  const sentimentColors = { positive: 'text-green-500', neutral: 'text-gray-400', negative: 'text-red-500' }
  const sentimentIcons = { positive: '🟢', neutral: '⚪', negative: '🔴' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-serif font-semibold text-lg">Unified Inbox</h3>
          <p className="text-sm text-muted-foreground">Comments from all connected platforms, in one place.</p>
        </div>
        <Button onClick={fetchNow} disabled={fetching} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Fetch new
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {statusFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={
              'text-xs px-3 py-1.5 rounded-sm border transition-colors ' +
              (statusFilter === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:text-foreground')
            }
          >
            {f.label}
            <span className="ml-1.5 opacity-60">{f.count}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="editorial-mono text-[0.5rem] text-muted-foreground">Sort:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-xs bg-secondary/50 border border-border rounded-sm px-2 py-1">
            <option value="chronological">Newest</option>
            <option value="followers">By followers</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">The inbox is quiet</div>
          <div className="text-sm text-muted-foreground mt-1">Publish some posts, then fetch their comments.</div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-sm p-4 sm:p-5">
          <div className="divide-y divide-border">
            {filtered.map((c, i) => {
              const pc = { facebook: 'fb', instagram: 'ig', linkedin: 'in' }[c.platform] || c.platform?.slice(0, 2)
              return (
                <RunningOrderRow key={c.id} index={i}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="editorial-eyebrow">{pc}</span>
                        <span className="font-medium text-sm">{c.author}</span>
                        <span className={`text-xs ${sentimentColors[c.sentiment] || 'text-gray-400'}`}>{sentimentIcons[c.sentiment] || '⚪'}</span>
                        {c.commenter_follower_count > 0 && <span className="editorial-mono text-[0.5rem] text-muted-foreground">{c.commenter_follower_count} followers</span>}
                        <span className="editorial-mono text-[0.625rem] text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                        <StatusStamp status={c.status} />
                        {c.auto_sent && <span className="editorial-mono text-[0.5rem] text-green-600 border border-green-200 px-1 rounded-sm">🤖 auto</span>}
                      </div>
                      <div className="text-sm text-foreground/80 bg-secondary/30 rounded-sm p-3 border border-border/50">
                        {c.comment_text}
                      </div>
                      {replyingId === c.id && (
                        <div className="space-y-2 pl-3 border-l-2 border-primary/30">
                          {c.draft_reply && (
                            <div className="editorial-mono text-[0.625rem] text-muted-foreground mb-1 italic">Saved draft: "{c.draft_reply}"</div>
                          )}
                          {c.ai_generated_draft && (
                            <div className="editorial-mono text-[0.5rem] text-blue-600 mb-1">🤖 AI-generated draft</div>
                          )}
                          <Textarea
                            value={replyTexts[c.id] ?? c.draft_reply ?? ''}
                            onChange={e => setReplyTexts(r => ({ ...r, [c.id]: e.target.value }))}
                            placeholder="Write a reply…"
                            rows={3}
                            className="bg-secondary/50 border-border text-sm"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" onClick={() => sendReply(c.id)} disabled={savingId === c.id || !replyTexts[c.id]?.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                              {savingId === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                              Post reply
                            </Button>
                            <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => saveDraftReply(c.id)} disabled={savingId === c.id}>
                              <Save className="h-3 w-3 mr-1" /> Save draft
                            </Button>
                            <Button size="sm" variant="outline" className="border-border h-7 text-xs" onClick={() => generateDraft(c.id)}>
                              <RefreshCw className="h-3 w-3 mr-1" /> AI draft
                            </Button>
                            {c.status === 'pending' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { updateStatus(c.id, 'replied'); setReplyingId(null) }}>
                                Mark replied (no post)
                              </Button>
                            )}
                          </div>
                          <button onClick={() => { 
                            let existing = []
                            try { existing = JSON.parse(localStorage.getItem('sf_ideas')) || [] } catch { existing = [] }
                            existing.unshift({ id: Date.now(), text: c.comment_text || c.dm_content || '', created_at: new Date().toISOString(), source: c.platform })
                            localStorage.setItem('sf_ideas', JSON.stringify(existing))
                            toast.success('Added to idea backlog')
                          }} className="text-xs text-muted-foreground hover:text-accent px-2 py-1">
                            📝 Idea
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0">
                      {c.status === 'pending' && (
                        <>
                          <button onClick={() => setReplyingId(replyingId === c.id ? null : c.id)} className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent" title="Reply">
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { 
                            let existing = []
                            try { existing = JSON.parse(localStorage.getItem('sf_ideas')) || [] } catch { existing = [] }
                            existing.unshift({ id: Date.now(), text: c.comment_text || c.dm_content || '', created_at: new Date().toISOString(), source: c.platform })
                            localStorage.setItem('sf_ideas', JSON.stringify(existing))
                            toast.success('Added to idea backlog')
                          }} className="text-muted-foreground hover:text-accent p-1 rounded-sm hover:bg-accent" title="Convert to idea">
                            <span className="text-xs">📝</span>
                          </button>
                          <button onClick={() => updateStatus(c.id, 'ignored')} className="text-muted-foreground hover:text-flag p-1 rounded-sm hover:bg-accent" title="Ignore">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {c.status === 'replied' && (
                        <button onClick={() => setReplyingId(replyingId === c.id ? null : c.id)} className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent" title="View reply">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </RunningOrderRow>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default InboxPage
