'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  Sliders, Layers, Loader2, Wand2, ArrowRight, Zap, KeyRound,
  Copy, Plus, Upload, ImageIcon, RefreshCw, Check, X, Send, Save,
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
import { api, StatusStamp, RunningOrderRow, resizeImageToBase64 } from '@/components/shared'

export default function AutomationPage() {
  const [tab, setTab] = useState('settings')
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="settings" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Sliders className="h-4 w-4 mr-2" /> Settings</TabsTrigger>
        <TabsTrigger value="queue"    className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Layers  className="h-4 w-4 mr-2" /> Queue Manager</TabsTrigger>
      </TabsList>
      <TabsContent value="settings"><AutomationSettings /></TabsContent>
      <TabsContent value="queue"><QueueManager /></TabsContent>
    </Tabs>
  )
}

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const COMMON_TZ = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Australia/Sydney','UTC']

function AutomationSettings() {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [ticking, setTicking] = useState(false)

  const refresh = async () => {
    try { setS(await api('/automation/settings')) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { refresh() }, [])

  if (!s) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  const save = async (patch) => {
    setSaving(true)
    try {
      const updated = await api('/automation/settings', { method: 'PUT', body: patch })
      setS(updated)
      toast.success('Saved')
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const setTime = (i, v) => {
    const times = [...(s.posting_times || [])]
    times[i] = v
    save({ posting_times: times })
  }

  const toggleWorkingDay = (d) => {
    const cur = new Set(s.working_days || [])
    if (cur.has(d)) cur.delete(d); else cur.add(d)
    save({ working_days: [...cur].sort() })
  }

  const runTickNow = async () => {
    setTicking(true)
    try {
      const r = await fetch('/api/automation/tick', {
        method: 'POST',
        headers: { 'X-Automation-Secret': s.tick_secret, 'Content-Type': 'application/json' },
      })
      const j = await r.json()
      if (j.ok) toast.success('Tick: ' + JSON.stringify(j.data).slice(0, 120))
      else toast.error(j.error || 'Tick failed')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setTicking(false) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const cronSql = `-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'socialforge-tick') THEN
    PERFORM cron.unschedule('socialforge-tick');
  END IF;
END $$;
SELECT cron.schedule('socialforge-tick','* * * * *', $sql$
  SELECT net.http_post(
    url := '${baseUrl}/api/automation/tick',
    headers := '{"X-Automation-Secret": "${s.tick_secret}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$sql$);`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif font-semibold text-lg flex items-center gap-2">
            Automation
            <StatusStamp status={s.enabled ? 'live' : 'draft'} />
          </h3>
          <p className="text-sm text-muted-foreground">24/7 orchestrator that pulls from intake bucket → AI → Telegram approval → publish → archive.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch />
          <span className="text-sm">Enabled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="editorial-eyebrow">Posts per day</Label>
              <Input type="number" min="1" max="24" value={s.posts_per_day || 5}
                onChange={e => setS({ ...s, posts_per_day: Number(e.target.value) })}
                onBlur={e => save({ posts_per_day: Number(e.target.value) })}
                className="bg-secondary/50 border-border mt-1" />
            </div>
            <div>
              <Label className="editorial-eyebrow">Posting times</Label>
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {(s.posting_times || []).map((t, i) => (
                  <Input key={i} type="time" value={t}
                    onChange={e => setTime(i, e.target.value)}
                    className="bg-secondary/50 border-border text-xs" />
                ))}
              </div>
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
              <Label className="editorial-eyebrow">Working days</Label>
              <div className="flex gap-1 mt-1">
                {WEEKDAYS.map((wd, i) => (
                  <button key={i}
                    onClick={() => toggleWorkingDay(i)}
                    className={
                      'flex-1 text-xs py-1.5 rounded-sm border transition-colors ' +
                      ((s.working_days || []).includes(i)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary/50 border-border text-muted-foreground')
                    }
                  >{wd}</button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-serif">Approval flow</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Approval required</Label>
                <div className="editorial-mono text-[0.625rem] text-muted-foreground">Wait for you to tap Approve in Telegram</div>
              </div>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Auto-publish after Approve</Label>
                <div className="editorial-mono text-[0.625rem] text-muted-foreground">Single tap → publishes immediately</div>
              </div>
              <Switch />
            </div>
            <Separator className="bg-border" />
            <div className="editorial-mono text-[0.5rem] text-muted-foreground space-y-1">
              <div>Last tick: <span className="text-foreground/70">{s.last_tick_at ? new Date(s.last_tick_at).toLocaleString() : 'never'}</span></div>
            </div>
            <Button onClick={runTickNow} disabled={ticking} variant="outline" className="w-full border-border">
              {ticking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Run tick now (manual test)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif flex items-center gap-2"><KeyRound className="h-4 w-4" /> pg_cron setup — run this SQL in Supabase once</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="editorial-mono text-[0.5rem] text-muted-foreground">Open Supabase SQL Editor and paste this. It hits our tick endpoint every minute.</div>
          <Textarea readOnly value={cronSql} rows={12} className="bg-secondary/50 border-border editorial-mono text-[0.5rem] leading-relaxed" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-border" onClick={() => { navigator.clipboard.writeText(cronSql); toast.success('SQL copied') }}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy SQL
            </Button>
            <Button size="sm" variant="outline" className="border-border" onClick={() => window.open('https://supabase.com/dashboard/project/ghqakcbyqqxolavwfepe/sql/new', '_blank')}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" /> Open Supabase SQL Editor
            </Button>
          </div>
          <div className="editorial-mono text-[0.5rem] text-muted-foreground mt-2">Tick secret: <code className="text-foreground/70">{s.tick_secret}</code> (already inlined in the SQL above)</div>
        </CardContent>
      </Card>
    </div>
  )
}

function QueueManager() {
  const [stats, setStats] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const fileRef = useRef(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [st, q] = await Promise.all([api('/intake/stats'), api('/intake/queue')])
      setStats(st); setQueue(q)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await api('/intake/sync', { method: 'POST' })
      toast.success(`Indexed ${r.indexed} new file(s)`)
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setSyncing(false) }
  }

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return
    setUploading(true)
    let done = 0, failed = 0
    for (const file of files) {
      if (!file.type.startsWith('image/')) { failed++; continue }
      try {
        const resized = await resizeImageToBase64(file, 2000, 0.9)
        await api('/intake/upload', { method: 'POST', body: {
          base64: resized.base64,
          mime_type: resized.mimeType,
          file_name: file.name,
        }})
        done++
      } catch (e) { failed++ }
    }
    toast.success(`Uploaded ${done}${failed ? ` · ${failed} failed` : ''}`)
    setUploading(false)
    await sync()
  }

  const statuses = [
    ['queued', 'Queued'],
    ['processing', 'Processing'],
    ['pending_approval', 'Pending'],
    ['published', 'Published'],
    ['archived', 'Archived'],
    ['failed', 'Failed'],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif font-semibold text-lg">Queue Manager</h3>
        <p className="text-sm text-muted-foreground">Drop bulk photos here. Automation picks the next queued item at each posting slot.</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {statuses.map(([k, label]) => (
            <div key={k} className="border border-border rounded-sm p-3 bg-card shadow-sm">
              <div className="editorial-eyebrow">{label}</div>
              <div className="editorial-title text-xl mt-1">{stats[k] || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-border hover:border-primary/40 rounded-sm cursor-pointer p-8 text-center bg-secondary/30 transition-colors"
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-primary"><Loader2 className="h-5 w-5 animate-spin" /> Uploading…</div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm text-foreground/80">Drop images here or click to browse (bulk upload)</div>
            <div className="editorial-mono text-[0.625rem] text-muted-foreground mt-1">JPG, PNG, WEBP — up to 25MB each</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={sync} disabled={syncing} variant="outline" className="border-border">
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync from bucket
        </Button>
        <Button onClick={refresh} variant="ghost" size="icon"><RefreshCw className="h-4 w-4" /></Button>
        <div className="ml-auto editorial-mono text-[0.625rem] text-muted-foreground">
          {queue.length} row(s) · {stats?.total || 0} total
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : queue.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-10 text-center bg-secondary/30">
          <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">Nothing on the desk yet — drop in a photo to start</div>
          <div className="text-sm text-muted-foreground mt-1">Drop photos above, or upload directly into the intake bucket in Supabase.</div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-sm p-4 sm:p-5">
          <div className="divide-y divide-border">
            {queue.slice(0, 100).map((row, i) => (
              <QueueRow key={row.file_id} row={row} index={i} />
            ))}
            {queue.length > 100 && <div className="editorial-mono text-[0.5rem] text-muted-foreground text-center py-2">Showing 100 of {queue.length}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function QueueRow({ row, index }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  useEffect(() => {
    if (row.status === 'archived') return
    api(`/intake/signed-url?path=${encodeURIComponent(row.file_id)}`)
      .then(r => setThumbUrl(r.url))
      .catch(() => {})
  }, [row.file_id])

  return (
    <RunningOrderRow index={index}>
      <div className="flex items-center gap-3">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-10 h-10 rounded-sm object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center shrink-0">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{row.file_name}</div>
          <div className="editorial-mono text-[0.5rem] text-muted-foreground truncate">{row.file_id}</div>
        </div>
        <StatusStamp status={row.status} />
        {row.content_job_id && <div className="editorial-mono text-[0.5rem] text-muted-foreground">job:{row.content_job_id.slice(0, 6)}</div>}
      </div>
    </RunningOrderRow>
  )
}
