'use client'

import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, Pencil, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, RunningOrderRow } from '@/components/shared'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PLATFORMS } from '@/components/shared'

function HashtagsPage() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [editSet, setEditSet] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const [formName, setFormName] = useState('')
  const [formPlatform, setFormPlatform] = useState('')
  const [formTags, setFormTags] = useState([])
  const [tagInput, setTagInput] = useState('')

  const refresh = async () => {
    setLoading(true)
    try { setSets(await api('/hashtag-sets')) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const openNew = () => {
    setEditSet(null)
    setFormName('')
    setFormPlatform('')
    setFormTags([])
    setTagInput('')
    setDialogOpen(true)
  }

  const openEdit = (set) => {
    setEditSet(set)
    setFormName(set.name)
    setFormPlatform(set.platform || '')
    setFormTags([...(set.tags || [])])
    setTagInput('')
    setDialogOpen(true)
  }

  const addTagFromInput = (e) => {
    const val = e.target.value
    const parts = val.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) {
      const newTags = parts.map(t => t.startsWith('#') ? t : `#${t}`)
      setFormTags(prev => [...prev, ...newTags])
      setTagInput('')
    }
  }

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const t = tagInput.trim()
      if (!t) return
      const tag = t.startsWith('#') ? t : `#${t}`
      setFormTags(prev => [...prev, tag])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && formTags.length > 0) {
      setFormTags(prev => prev.slice(0, -1))
    }
  }

  const removeTag = (idx) => {
    setFormTags(prev => prev.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return }
    if (formTags.length === 0) { toast.error('Add at least one tag'); return }
    const body = {
      name: formName.trim(),
      platform: formPlatform || null,
      tags: formTags,
    }
    try {
      if (editSet) {
        await api(`/hashtag-sets/${editSet.id}`, { method: 'PUT', body })
        toast.success('Updated')
      } else {
        await api('/hashtag-sets', { method: 'POST', body })
        toast.success('Created')
      }
      setDialogOpen(false)
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const remove = async (id) => {
    if (!confirm('Delete this hashtag set?')) return
    try { await api(`/hashtag-sets/${id}`, { method: 'DELETE' }); toast.success('Deleted'); await refresh() }
    catch (e) { toast.error(e.message) }
  }

  const copyTags = async (tags) => {
    try {
      const text = tags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (e) { toast.error('Failed to copy') }
  }

  const platformLabel = (key) => {
    const p = PLATFORMS.find(x => x.key === key)
    return p ? p.label : key || 'All platforms'
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">Hashtag Sets</h1>
          <p className="text-sm text-muted-foreground">Saved hashtag collections for quick reuse</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Set</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editSet ? 'Edit Set' : 'New Hashtag Set'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                <input
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. Tech hashtags"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Platform (optional)</label>
                <select
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={formPlatform}
                  onChange={e => setFormPlatform(e.target.value)}
                >
                  <option value="">All platforms</option>
                  {PLATFORMS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                  {formTags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
                      {tag}
                      <button onClick={() => removeTag(i)} className="hover:text-destructive ml-0.5">&times;</button>
                    </Badge>
                  ))}
                </div>
                <input
                  className="w-full border border-input bg-background rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Type a tag and press Enter, or paste comma-separated"
                  value={tagInput}
                  onChange={e => { setTagInput(e.target.value); addTagFromInput(e) }}
                  onKeyDown={handleTagKeyDown}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancel</Button>
                </DialogClose>
                <Button size="sm" onClick={save}>{editSet ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : sets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No hashtag sets yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={openNew}>
            <Plus className="h-4 w-4" /> Create your first set
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {sets.map((set, i) => (
            <RunningOrderRow key={set.id} index={i}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{set.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {platformLabel(set.platform)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(set.tags || []).slice(0, 8).map((tag, ti) => (
                      <Badge key={ti} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {tag}
                      </Badge>
                    ))}
                    {(set.tags || []).length > 8 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{set.tags.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyTags(set.tags)} title="Copy tags">
                    {copiedId === set.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(set)} title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(set.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </RunningOrderRow>
          ))}
        </div>
      )}

      <SuggestionsPanel refresh={refresh} />
    </div>
  )
}

function SuggestionsPanel({ refresh }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try { setSuggestions(await api('/hashtag-suggestions')) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const act = async (id, action) => {
    try {
      await api(`/hashtag-suggestions`, { method: 'POST', body: { action, id } })
      toast.success(action === 'accept' ? 'Accepted' : 'Rejected')
      await load(); if (refresh) await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const pending = suggestions.filter(s => s.status === 'pending')
  if (pending.length === 0) return null

  return (
    <div className="mt-8 border border-yellow-200 bg-yellow-50/50 rounded-sm p-4">
      <div className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
        <span>💡 Trending suggestions ({pending.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pending.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-white border border-yellow-200 rounded-sm px-2 py-1">
            {s.tag}
            <button onClick={() => act(s.id, 'accept')} className="text-green-600 hover:text-green-800" title="Accept">✓</button>
            <button onClick={() => act(s.id, 'reject')} className="text-red-400 hover:text-red-600" title="Reject">✗</button>
          </span>
        ))}
      </div>
      <div className="text-[0.5rem] text-yellow-600 mt-1">Auto-detected from RSS trends — never auto-added.</div>
    </div>
  )
}

export default HashtagsPage
