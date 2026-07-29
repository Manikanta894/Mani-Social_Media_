'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Sliders, Layers, Loader2, FileText, ArrowRight, Zap, KeyRound,
  Copy, Upload, ImageIcon, RefreshCw, Check, X,
  LayoutDashboard, Clock, Activity, BarChart3, Trash2, SkipForward,
  Play, Pause, ExternalLink,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { api, StatusStamp, resizeImageToBase64 } from '@/components/shared'

export default function BlogAutomationPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif font-semibold text-2xl flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          Blog Automation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered editorial engine for INSIGHTS (insights.manikantar.in) — fully independent from social automation.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard</TabsTrigger>
          <TabsTrigger value="queue"    className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Layers className="h-4 w-4 mr-2" /> Queue</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Sliders className="h-4 w-4 mr-2" /> Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><BlogDashboard /></TabsContent>
        <TabsContent value="queue"><BlogQueueManager /></TabsContent>
        <TabsContent value="settings"><BlogSettings /></TabsContent>
      </Tabs>
    </div>
  )
}

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const COMMON_TZ = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Australia/Sydney','UTC']
const CATEGORIES = ['ai', 'tech', 'business', 'essays', 'productivity']

function BlogDashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [st, act, s] = await Promise.all([
        api('/blog/stats').catch(() => ({})),
        api('/blog/activity?limit=30').catch(() => []),
        api('/blog/settings').catch(() => ({})),
      ])
      setStats(st); setActivity(act); setSettings(s)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const statusCards = [
    ['queued', 'Queued'], ['processing', 'Processing'], ['pending_approval', 'Pending'],
    ['published', 'Published'], ['failed', 'Failed'], ['archived', 'Archived'], ['skipped', 'Skipped'],
  ]

  const actionLabels = {
    generated: { emoji: '🤖', label: 'Generated' },
    approved: { emoji: '✅', label: 'Approved' },
    published: { emoji: '🚀', label: 'Published' },
    failed: { emoji: '❌', label: 'Failed' },
    skipped: { emoji: '⏭', label: 'Skipped' },
    rejected: { emoji: '❌', label: 'Rejected' },
    rescheduled: { emoji: '📅', label: 'Rescheduled' },
    retry: { emoji: '🔄', label: 'Retry' },
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading dashboard…</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {statusCards.map(([k, label]) => (
          <div key={k} className="border border-border rounded-sm p-3 bg-card shadow-sm">
            <div className="editorial-eyebrow">{label}</div>
            <div className={`text-xl font-semibold mt-1 ${(stats?.[k] || 0) > 0 ? '' : 'text-muted-foreground'}`}>{stats?.[k] || 0}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><Clock className="h-4 w-4" /> Today's Publishing Slot</CardTitle>
            <StatusStamp status={settings?.enabled ? 'live' : 'draft'} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 px-3 py-3 rounded-sm bg-secondary/60">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span className="font-medium">{settings?.publishing_time || '10:00'}</span>
              <span className="text-sm text-muted-foreground">{settings?.timezone || 'Asia/Kolkata'}</span>
              <span className="editorial-mono text-[0.5rem] ml-auto">{settings?.articles_per_day || 1} article(s)/day</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button onClick={refresh} variant="ghost" size="sm"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
              <Button onClick={async () => {
                setRunning(true)
                try {
                  const s = await api('/blog/settings')
                  const r = await fetch('/api/blog/tick', {
                    method: 'POST',
                    headers: { 'X-Automation-Secret': s.tick_secret, 'Content-Type': 'application/json' },
                  })
                  const j = await r.json()
                  if (j.ok) toast.success('Blog tick: ' + JSON.stringify(j.data).slice(0, 120))
                  else toast.error(j.error || 'Tick failed')
                  await refresh()
                } catch (e) { toast.error(e.message) }
                finally { setRunning(false) }
              }} disabled={running} variant="outline" size="sm" className="border-border">
                {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                Run Tick
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><Activity className="h-4 w-4" /> Publishing Timeline</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>
            ) : (
              <div className="space-y-2">
                {activity.slice(0, 30).map((a, i) => {
                  const meta = actionLabels[a.action] || { emoji: '•', label: a.action }
                  return (
                    <div key={a.id || i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0">{meta.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{meta.label}</span>
                        {a.details?.title && <span className="text-muted-foreground ml-1 truncate block text-xs">{a.details.title.slice(0, 60)}</span>}
                        {a.details?.url && <a href={a.details.url} target="_blank" className="text-primary ml-1 inline-flex items-center gap-0.5 text-xs"><ExternalLink className="h-3 w-3" /></a>}
                      </div>
                      <span className="editorial-mono text-[0.5rem] text-muted-foreground shrink-0">
                        {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BlogQueueManager() {
  const [stats, setStats] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const fileRef = useRef(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const path = statusFilter ? `/blog/queue?status=${statusFilter}` : '/blog/queue'
      const [st, q] = await Promise.all([api('/blog/stats'), api(path)])
      setStats(st); setQueue(q)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [statusFilter])

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await api('/blog/sync', { method: 'POST' })
      toast.success(`Indexed ${r.indexed} new blog image(s)`)
      await refresh()
    } catch (e) { toast.error(e.message) }
    finally { setSyncing(false) }
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let done = 0, failed = 0
    for (const file of files) {
      if (!file.type.startsWith('image/')) { failed++; continue }
      try {
        const resized = await resizeImageToBase64(file, 2000, 0.9)
        await api('/blog/upload', { method: 'POST', body: { base64: resized.base64, mime_type: resized.mimeType, file_name: file.name } })
        done++
      } catch (e) { failed++ }
    }
    toast.success(`Uploaded ${done}${failed ? ` · ${failed} failed` : ''}`)
    setUploading(false)
    await sync()
  }

  const toggleSelect = (fileId) => {
    const next = new Set(selected)
    if (next.has(fileId)) next.delete(fileId); else next.add(fileId)
    setSelected(next)
  }

  const doBulk = async (action) => {
    if (selected.size === 0) { toast.error('Select items first'); return }
    try {
      const r = await api('/blog/bulk', { method: 'POST', body: { fileIds: [...selected], action } })
      const ok = r.filter(x => x.ok).length
      toast.success(`${action}: ${ok}/${selected.size} done`)
      setSelected(new Set())
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const statusFilters = [
    ['', 'All'], ['queued', 'Queued'], ['processing', 'Processing'],
    ['pending_approval', 'Pending'], ['published', 'Published'],
    ['failed', 'Failed'], ['archived', 'Archived'], ['skipped', 'Skipped'],
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif font-semibold text-lg">Blog Queue</h3>
          <p className="text-sm text-muted-foreground">Upload blog images. Each image generates one premium article on INSIGHTS.</p>
        </div>
        <Button onClick={async () => {
          try {
            const s = await api('/blog/settings')
            await api('/blog/settings', { method: 'PUT', body: { pause_queue: !s.pause_queue } })
            toast.success(s.pause_queue ? 'Resumed' : 'Paused')
            await refresh()
          } catch (e) { toast.error(e.message) }
        }} variant="outline" size="sm" className="border-border">
          <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause/Resume
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {[['queued', 'Queued'], ['processing', 'Processing'], ['pending_approval', 'Pending'], ['published', 'Published'], ['failed', 'Failed'], ['archived', 'Archived'], ['skipped', 'Skipped']].map(([k, label]) => (
            <div key={k} className="border border-border rounded-sm p-3 bg-card shadow-sm cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setStatusFilter(k === statusFilter ? '' : k)}>
              <div className="editorial-eyebrow">{label}</div>
              <div className={`text-xl font-semibold mt-1 ${(stats[k] || 0) > 0 ? '' : 'text-muted-foreground'}`}>{stats[k] || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          className="border-2 border-dashed border-border hover:border-primary/40 rounded-sm cursor-pointer p-6 text-center bg-secondary/30 transition-colors flex-1"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" /> Uploading…</div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Upload className="h-5 w-5" />
              <span className="text-sm">Drop blog images here or click</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>
        <Button onClick={sync} disabled={syncing} variant="outline" className="border-border shrink-0">
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-accent/30 rounded-sm border border-border">
          <span className="text-sm font-medium mr-2">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="border-border" onClick={() => doBulk('archive')}><Trash2 className="h-3.5 w-3.5 mr-1" /> Archive</Button>
          <Button size="sm" variant="outline" className="border-border" onClick={() => doBulk('skip')}><SkipForward className="h-3.5 w-3.5 mr-1" /> Skip</Button>
          <Button size="sm" variant="outline" className="border-border" onClick={() => doBulk('retry')}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</Button>
          <Button size="sm" variant="outline" className="border-border" onClick={() => doBulk('reset')}><X className="h-3.5 w-3.5 mr-1" /> Reset</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading queue…</div>
      ) : queue.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-10 text-center bg-secondary/30">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">No blog images in queue</div>
          <div className="text-sm text-muted-foreground mt-1">Drop images above or upload to the intake/blogs/ bucket in Supabase.</div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-sm">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/20">
            <input type="checkbox" checked={selected.size === queue.length && queue.length > 0} onChange={() => { if (selected.size === queue.length) setSelected(new Set()); else setSelected(new Set(queue.map(r => r.file_id))) }} className="rounded border-border" />
            <span className="text-xs text-muted-foreground">Select all ({queue.length})</span>
            <span className="ml-auto editorial-mono text-[0.5rem] text-muted-foreground">{statusFilter || 'All items'}</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {queue.map((row) => (
              <BlogQueueRow key={row.file_id} row={row} selected={selected.has(row.file_id)} onToggle={() => toggleSelect(row.file_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BlogQueueRow({ row, selected, onToggle }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  useEffect(() => {
    if (row.status === 'archived') return
    api(`/blog/signed-url?path=${encodeURIComponent(row.file_id)}`).then(r => setThumbUrl(r.url)).catch(() => {})
  }, [row.file_id])

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors ${selected ? 'bg-accent/20' : ''}`}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="rounded border-border shrink-0" />
      <div className="flex items-center gap-1.5 text-muted-foreground editorial-mono text-[0.5rem] w-6 shrink-0">#{row.queue_position}</div>
      {thumbUrl ? <img src={thumbUrl} alt="" className="w-10 h-10 rounded-sm object-cover shrink-0" /> : <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center shrink-0"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{row.article_data?.title || row.file_name}</div>
        <div className="flex items-center gap-2 editorial-mono text-[0.5rem] text-muted-foreground">
          <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'published' ? 'bg-emerald-500' : row.status === 'failed' ? 'bg-red-500' : row.status === 'pending_approval' ? 'bg-purple-500' : 'bg-blue-500'}`} />
          <span>{row.status}</span>
          {row.article_data?.category && <span>{row.article_data.category}</span>}
          {row.published_url && <a href={row.published_url} target="_blank" className="text-primary hover:underline"><ExternalLink className="h-3 w-3" /></a>}
        </div>
      </div>
      <StatusStamp status={row.status} />
    </div>
  )
}

function BlogSettings() {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    try { setS(await api('/blog/settings')) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { refresh() }, [])

  if (!s) return <div className="text-muted-foreground flex items-center gap-2 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading settings…</div>

  const save = async (patch) => {
    setSaving(true)
    try {
      const updated = await api('/blog/settings', { method: 'PUT', body: { ...s, ...patch } })
      setS(updated)
      toast.success('Saved')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const toggleDay = (d) => {
    const cur = new Set(s.publishing_days || [])
    if (cur.has(d)) cur.delete(d); else cur.add(d)
    save({ publishing_days: [...cur].sort() })
  }

  const runTickNow = async () => {
    try {
      const r = await fetch('/api/blog/tick', {
        method: 'POST',
        headers: { 'X-Automation-Secret': s.tick_secret, 'Content-Type': 'application/json' },
      })
      const j = await r.json()
      if (j.ok) toast.success('Blog tick: ' + JSON.stringify(j.data).slice(0, 120))
      else toast.error(j.error || 'Tick failed')
    } catch (e) { toast.error(e.message) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const cronSql = `-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'socialforge-blog-tick') THEN
    PERFORM cron.unschedule('socialforge-blog-tick');
  END IF;
END $$;
SELECT cron.schedule('socialforge-blog-tick','* * * * *', $sql$
  SELECT net.http_post(
    url := '${baseUrl}/api/blog/tick',
    headers := '{"X-Automation-Secret": "${s.tick_secret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$sql$);`

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-serif font-semibold text-lg">Blog Automation Settings</h3>
          <StatusStamp status={s.enabled ? 'live' : 'draft'} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={s.enabled} onCheckedChange={v => save({ enabled: v })} />
          <span className="text-sm">Enabled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="editorial-eyebrow">Articles per day</Label>
              <Input type="number" min="1" max="10" value={s.articles_per_day || 1}
                onChange={e => setS({ ...s, articles_per_day: Number(e.target.value) })}
                onBlur={e => save({ articles_per_day: Number(e.target.value) })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
            <div>
              <Label className="editorial-eyebrow">Publishing time</Label>
              <Input type="time" value={s.publishing_time || '10:00'}
                onChange={e => setS({ ...s, publishing_time: e.target.value })}
                onBlur={e => save({ publishing_time: s.publishing_time })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
            <div>
              <Label className="editorial-eyebrow">Buffer minutes (AI starts before)</Label>
              <Input type="number" min="1" max="30" value={s.buffer_minutes || 5}
                onBlur={e => save({ buffer_minutes: Number(e.target.value) })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
            <div>
              <Label className="editorial-eyebrow">Timezone</Label>
              <Select value={s.timezone} onValueChange={v => save({ timezone: v })}>
                <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_TZ.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="editorial-eyebrow">Publishing days</Label>
              <div className="flex gap-1 mt-1">
                {WEEKDAYS.map((wd, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`flex-1 text-xs py-1.5 rounded-sm border transition-colors ${(s.publishing_days || []).includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 border-border text-muted-foreground'}`}
                  >{wd}</button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Writing & Quality</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="editorial-eyebrow">Writing tone</Label>
              <Select value={s.writing_tone || 'professional'} onValueChange={v => save({ writing_tone: v })}>
                <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="editorial">Editorial</SelectItem>
                  <SelectItem value="research">Research-backed</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="editorial-eyebrow">Target word count</Label>
              <Input type="number" min="500" max="5000" step="100" value={s.word_count || 1200}
                onBlur={e => save({ word_count: Number(e.target.value) })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
            <Separator className="bg-border" />
            <div>
              <Label className="editorial-eyebrow">Queue order</Label>
              <Select value={s.queue_order || 'fifo'} onValueChange={v => save({ queue_order: v })}>
                <SelectTrigger className="bg-secondary/50 border-border mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifo">FIFO (First In)</SelectItem>
                  <SelectItem value="lifo">LIFO (Last In)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="editorial-eyebrow">Max retries</Label>
              <Input type="number" min="0" max="10" value={s.max_retries || 3}
                onBlur={e => save({ max_retries: Number(e.target.value) })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Publishing</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div><Label className="text-sm">Require approval via Telegram</Label><div className="editorial-mono text-[0.625rem] text-muted-foreground">Review and approve each article before publishing</div></div>
            <Switch checked={s.approval_required !== false} onCheckedChange={v => save({ approval_required: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label className="text-sm">Auto-publish after approval</Label><div className="editorial-mono text-[0.625rem] text-muted-foreground">Automatically publish once approved</div></div>
            <Switch checked={s.auto_publish !== false} onCheckedChange={v => save({ auto_publish: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label className="text-sm">Draft mode</Label><div className="editorial-mono text-[0.625rem] text-muted-foreground">Save as draft instead of publishing</div></div>
            <Switch checked={s.draft_mode || false} onCheckedChange={v => save({ draft_mode: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label className="text-sm">SEO optimization</Label><div className="editorial-mono text-[0.625rem] text-muted-foreground">Enable SEO title, meta description, keywords</div></div>
            <Switch checked={s.seo_enabled !== false} onCheckedChange={v => save({ seo_enabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Manual Controls & Status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="editorial-mono text-[0.5rem] text-muted-foreground space-y-1">
            <div>Last tick: <span className="text-foreground/70">{s.last_tick_at ? new Date(s.last_tick_at).toLocaleString() : 'never'}</span></div>
            <div>Last category: <span className="text-foreground/70">{s.last_category || 'none'}</span></div>
            <div>Secret: <code className="text-foreground/70">{s.tick_secret}</code></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runTickNow} variant="outline" className="border-border">
              <Zap className="h-4 w-4 mr-2" /> Run tick now
            </Button>
            <Button onClick={refresh} variant="ghost"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif flex items-center gap-2"><KeyRound className="h-4 w-4" /> pg_cron setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="editorial-mono text-[0.5rem] text-muted-foreground">Run this SQL in Supabase SQL Editor once to tick every minute.</div>
          <Textarea readOnly value={cronSql} rows={12} className="bg-secondary/50 border-border editorial-mono text-[0.5rem] leading-relaxed" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-border" onClick={() => { navigator.clipboard.writeText(cronSql); toast.success('SQL copied') }}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy SQL
            </Button>
            <Button size="sm" variant="outline" className="border-border" onClick={() => window.open('https://supabase.com/dashboard/project/ghqakcbyqqxolavwfepe/sql/new', '_blank')}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Open Supabase SQL Editor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}