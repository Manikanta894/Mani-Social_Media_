'use client'

import { useState, useEffect, useRef } from 'react'
import {
  PlugZap, Sliders, Wand2, MessageSquare, KeyRound, Star, Plus, Check, X, Trash2, Pencil,
  Save, Loader2, RefreshCw, Eye, EyeOff, Send, Layers, Zap, Copy, ArrowRight, Upload, ImageIcon, AlertTriangle, Download,
  Link as LinkIcon, ExternalLink,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { api, PROVIDER_TYPES, StatusStamp, RunningOrderRow, resizeImageToBase64 } from '@/components/shared'
import { toast } from 'sonner'

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const COMMON_TZ = ['Asia/Kolkata','Asia/Dubai','Asia/Singapore','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Australia/Sydney','UTC']

function SettingsPage() {
  const [providers, setProviders] = useState([])
  const [styles, setStyles] = useState([])

  const refreshProviders = async () => setProviders(await api('/providers'))
  const refreshStyles = async () => setStyles(await api('/prompt-styles'))

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refreshProviders(), refreshStyles()])
      } catch (e) {
        toast.error(e.message)
      }
    })()
  }, [])

  return (
    <Tabs defaultValue="providers" className="space-y-6">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="providers"  className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><PlugZap className="h-4 w-4 mr-2" /> AI Providers</TabsTrigger>
        <TabsTrigger value="styles"     className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Sliders className="h-4 w-4 mr-2" /> Prompt Styles</TabsTrigger>
        <TabsTrigger value="automation" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Wand2 className="h-4 w-4 mr-2" /> Automation</TabsTrigger>
        <TabsTrigger value="telegram"   className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><MessageSquare className="h-4 w-4 mr-2" /> Telegram</TabsTrigger>
        <TabsTrigger value="security"   className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><KeyRound className="h-4 w-4 mr-2" /> Security</TabsTrigger>
        <TabsTrigger value="bio-links" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><LinkIcon className="h-4 w-4 mr-2" /> Bio Links</TabsTrigger>
        <TabsTrigger value="danger-zone" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><AlertTriangle className="h-4 w-4 mr-2" /> Danger Zone</TabsTrigger>
      </TabsList>
      <TabsContent value="providers">
        <ProvidersTab providers={providers} onRefresh={refreshProviders} />
      </TabsContent>
      <TabsContent value="styles">
        <PromptStylesTab styles={styles} onRefresh={refreshStyles} />
      </TabsContent>
      <TabsContent value="automation">
        <AutomationTab />
      </TabsContent>
      <TabsContent value="telegram">
        <TelegramTab />
      </TabsContent>
      <TabsContent value="security">
        <SecurityTab />
      </TabsContent>
      <TabsContent value="bio-links">
        <BioLinksTab />
      </TabsContent>
      <TabsContent value="danger-zone">
        <DangerZoneTab />
      </TabsContent>
    </Tabs>
  )
}

function ProvidersTab({ providers, onRefresh }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [testingId, setTestingId] = useState(null)
  const [usage, setUsage] = useState([])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (p) => { setEditing(p); setDialogOpen(true) }

  const remove = async (p) => {
    if (!confirm(`Delete provider "${p.name}"?`)) return
    try { await api(`/providers/${p.id}`, { method: 'DELETE' }); toast.success('Deleted'); onRefresh() }
    catch (e) { toast.error(e.message) }
  }

  const setActive = async (role, providerId) => {
    try { await api('/providers/set-active', { method: 'POST', body: { role, providerId } }); onRefresh() }
    catch (e) { toast.error(e.message) }
  }

  const test = async (p) => {
    setTestingId(p.id)
    try {
      const r = await api(`/providers/${p.id}/test`, { method: 'POST' })
      toast.success(`Connection OK — replied "${r.sample.trim()}" in ${r.ms}ms`)
    } catch (e) { toast.error(e.message) } finally { setTestingId(null) }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/providers/usage')
        setUsage(data || [])
      } catch (e) { /* usage data optional */ }
    })()
  }, [providers])

  const totalCalls = usage.reduce((s, r) => s + r.call_count, 0)
  const totalTokens = usage.reduce((s, r) => s + r.token_count, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif font-semibold text-lg">AI Providers</h3>
          <p className="text-sm text-muted-foreground">Bring your own keys. One provider marked active for vision, one for text.</p>
        </div>
        <Button onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> Add provider</Button>
      </div>

      {providers.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-10 text-center bg-secondary/30">
          <PlugZap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">No providers yet</div>
          <div className="text-sm text-muted-foreground mt-1">Add Gemini (recommended for vision + free tier) or any OpenAI-compatible service.</div>
          <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add your first</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map(p => (
            <div key={p.id} className="border border-border rounded-sm p-4 bg-card flex items-center gap-4 flex-wrap shadow-sm">
              <div className="h-10 w-10 rounded-sm bg-secondary flex items-center justify-center border border-border">
                <PlugZap className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="editorial-mono text-[0.8125rem] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>{PROVIDER_TYPES.find(t => t.value === p.type)?.label || p.type}</span>
                  <span>·</span>
                  <span>{p.model}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 editorial-mono text-[0.8125rem] text-muted-foreground">
                  <Switch checked={!!p.active_for_vision} onCheckedChange={(v) => v && setActive('vision', p.id)} />
                  Vision
                </label>
                <label className="flex items-center gap-2 editorial-mono text-[0.8125rem] text-muted-foreground">
                  <Switch checked={!!p.active_for_text} onCheckedChange={(v) => v && setActive('text', p.id)} />
                  Text
                </label>
                <Button variant="outline" size="sm" onClick={() => test(p)} disabled={testingId === p.id} className="border-border">
                  {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-flag" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {usage.length > 0 && (
        <div className="border border-border rounded-sm p-4 bg-card">
          <h4 className="font-serif font-semibold text-sm mb-2">Usage this month</h4>
          <table className="w-full text-xs editorial-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left pb-1.5 font-medium">Provider</th>
                <th className="text-right pb-1.5 font-medium">Month</th>
                <th className="text-right pb-1.5 font-medium">Calls</th>
                <th className="text-right pb-1.5 font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {usage.map(r => {
                const prov = providers.find(p => p.id === r.provider_id)
                return (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-1">{prov?.name || r.provider_id}</td>
                    <td className="text-right py-1">{r.month}</td>
                    <td className="text-right py-1">{r.call_count}</td>
                    <td className="text-right py-1">{r.token_count?.toLocaleString()}</td>
                  </tr>
                )
              })}
              <tr className="font-medium">
                <td className="py-1.5">Total</td>
                <td />
                <td className="text-right py-1.5">{totalCalls}</td>
                <td className="text-right py-1.5">{totalTokens.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <ProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={() => { setDialogOpen(false); onRefresh() }} />
    </div>
  )
}

function ProviderDialog({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState({
    name: '', type: 'gemini', api_key: '', model: 'gemini-2.5-flash', base_url: '',
    active_for_vision: false, active_for_text: false,
  })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        name: editing.name || '',
        type: editing.type || 'gemini',
        api_key: '',
        model: editing.model || '',
        base_url: editing.base_url || '',
        active_for_vision: !!editing.active_for_vision,
        active_for_text: !!editing.active_for_text,
      })
    } else {
      setForm({ name: '', type: 'gemini', api_key: '', model: 'gemini-2.5-flash', base_url: '', active_for_vision: false, active_for_text: false })
    }
  }, [open, editing])

  const onTypeChange = (t) => {
    const def = PROVIDER_TYPES.find(x => x.value === t)
    setForm(f => ({ ...f, type: t, model: def?.defaultModel || f.model }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form }
      if (editing) {
        if (!payload.api_key) delete payload.api_key
        await api(`/providers/${editing.id}`, { method: 'PUT', body: payload })
      } else {
        await api('/providers', { method: 'POST', body: payload })
      }
      toast.success(editing ? 'Provider updated' : 'Provider added')
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const currentType = PROVIDER_TYPES.find(t => t.value === form.type)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">{editing ? 'Edit provider' : 'Add AI provider'}</DialogTitle>
          <DialogDescription>Your key is stored server-side. It never leaves your app.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Nickname</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gemini (personal)" className="bg-card border-border" />
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Provider type</Label>
            <Select value={form.type} onValueChange={onTypeChange}>
              <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label} {!t.supportsVision && <span className="editorial-mono text-[0.875rem] text-muted-foreground ml-1">(text only)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">
              API key {editing && <span className="text-muted-foreground">(leave blank to keep existing)</span>}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                placeholder={editing ? '••••••••••••' : 'paste your key…'}
                className="bg-card border-border pr-9 editorial-mono text-sm"
              />
              <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Model</Label>
            <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="bg-card border-border editorial-mono text-sm" />
          </div>

          {form.type === 'custom' && (
            <div>
              <Label className="editorial-eyebrow mb-1.5 block">Base URL</Label>
              <Input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="https://…/v1" className="bg-card border-border editorial-mono text-sm" />
            </div>
          )}

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Active for vision</Label>
              <div className="editorial-mono text-[0.8125rem] text-muted-foreground">Analyzes uploaded photos</div>
            </div>
            <Switch checked={form.active_for_vision} onCheckedChange={v => setForm({ ...form, active_for_vision: v })} disabled={currentType && !currentType.supportsVision} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Active for text</Label>
              <div className="editorial-mono text-[0.8125rem] text-muted-foreground">Writes captions + hashtags</div>
            </div>
            <Switch checked={form.active_for_text} onCheckedChange={v => setForm({ ...form, active_for_text: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name || (!editing && !form.api_key) || !form.model} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            {editing ? 'Save changes' : 'Add provider'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PromptStylesTab({ styles, onRefresh }) {
  const [selectedId, setSelectedId] = useState(styles[0]?.id)
  const selected = styles.find(s => s.id === selectedId) || styles[0]
  const [draft, setDraft] = useState({ name: '', instructions: '' })
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (selected) setDraft({ name: selected.name, instructions: selected.instructions })
  }, [selected?.id])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api(`/prompt-styles/${selected.id}`, { method: 'PUT', body: draft })
      toast.success('Saved')
      onRefresh()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const setActive = async (id) => {
    try { await api('/prompt-styles/set-active', { method: 'POST', body: { id } }); toast.success('Style activated'); onRefresh() }
    catch (e) { toast.error(e.message) }
  }

  const addNew = async () => {
    try {
      const created = await api('/prompt-styles', { method: 'POST', body: { name: 'New style', instructions: 'Describe the tone and voice…' } })
      toast.success('Style created')
      onRefresh()
      setSelectedId(created.id)
    } catch (e) { toast.error(e.message) }
  }

  const remove = async () => {
    if (!selected) return
    if (styles.length <= 1) return toast.error('Keep at least one style.')
    if (!confirm(`Delete "${selected.name}"?`)) return
    try {
      await api(`/prompt-styles/${selected.id}`, { method: 'DELETE' })
      toast.success('Deleted')
      onRefresh()
      setSelectedId(styles.find(s => s.id !== selected.id)?.id)
    } catch (e) { toast.error(e.message) }
  }

  const preview = async () => {
    if (!selected) return
    setPreviewLoading(true)
    setPreviewOpen(true)
    setPreviewText('')
    try {
      const r = await api('/prompt-styles/preview', { method: 'POST', body: { styleId: selected.id } })
      setPreviewText(r.preview)
    } catch (e) {
      setPreviewText(`Error: ${e.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      <div className="space-y-1">
        {styles.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedId(s.id)}
            className={
              'w-full text-left px-3 py-2 rounded-sm text-sm flex items-center gap-2 transition-colors ' +
              (selected?.id === s.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground')
            }
          >
            {s.is_active && <Star className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className="truncate">{s.name}</span>
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={addNew} className="w-full mt-2 border-dashed border-border hover:bg-card">
          <Plus className="h-3.5 w-3.5 mr-1" /> New style
        </Button>
      </div>

      {selected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif font-semibold text-lg">{selected.name}</h3>
              <p className="editorial-mono text-[0.8125rem] text-muted-foreground">Instructions shape every caption, hashtag, and emoji choice.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-border" onClick={preview}>
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Preview
              </Button>
              {!selected.is_active && (
                <Button size="sm" variant="outline" className="border-border" onClick={() => setActive(selected.id)}>
                  <Star className="h-3.5 w-3.5 mr-1.5" /> Set active
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-flag" /></Button>
            </div>
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Name</Label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="bg-card border-border" />
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Instructions</Label>
            <Textarea
              value={draft.instructions}
              onChange={e => setDraft({ ...draft, instructions: e.target.value })}
              rows={12}
              className="bg-card border-border editorial-mono text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Style preview — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="min-h-[100px] rounded-sm border border-border p-4 bg-secondary/30 text-sm leading-relaxed whitespace-pre-wrap">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating preview…
              </div>
            ) : previewText}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TelegramTab() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ bot_token: '', admin_chat_id: '' })
  const [showToken, setShowToken] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const s = await api('/telegram/status')
      setStatus(s)
      setForm({ bot_token: '', admin_chat_id: s.admin_chat_id || '' })
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api('/telegram/settings', { method: 'PUT', body: form })
      toast.success('Saved')
      await refresh()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const register = async () => {
    try {
      await api('/telegram/register', { method: 'POST' })
      toast.success('Webhook registered')
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const unregister = async () => {
    try {
      await api('/telegram/unregister', { method: 'POST' })
      toast.success('Webhook removed')
      await refresh()
    } catch (e) { toast.error(e.message) }
  }

  const sendTest = async () => {
    try {
      await api('/telegram/test', { method: 'POST' })
      toast.success('Test message sent — check Telegram')
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  const botInfo = status?.bot
  const webhook = status?.webhook
  const isConnected = status?.bot_token_set && botInfo && !botInfo.error
  const webhookOk = webhook && !webhook.error && webhook.url === status.expected_webhook_url

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif font-semibold text-lg">Telegram control surface</h3>
        <p className="text-sm text-muted-foreground">Approve, edit, and post drafts by tapping buttons in your Telegram chat.</p>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-sm border border-border bg-secondary/30 p-3">
              <div className="editorial-eyebrow mb-1">Bot</div>
              {isConnected ? (
                <>
                  <div className="text-sm font-medium">{botInfo.first_name}</div>
                  <div className="editorial-mono text-[0.8125rem] text-muted-foreground">@{botInfo.username}</div>
                  <StatusStamp status="live" className="mt-2" />
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">Not connected</div>
                  <StatusStamp status="draft" className="mt-2" />
                </>
              )}
            </div>
            <div className="rounded-sm border border-border bg-secondary/30 p-3">
              <div className="editorial-eyebrow mb-1">Webhook</div>
              {webhookOk ? (
                <>
                  <div className="text-sm">Registered</div>
                  <div className="editorial-mono text-[0.875rem] text-muted-foreground truncate">{webhook.url}</div>
                  <StatusStamp status="live" className="mt-2" />
                </>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">{webhook?.url ? 'URL mismatch' : 'Not registered'}</div>
                  <StatusStamp status="pending" className="mt-2" />
                </>
              )}
            </div>
          </div>

          <Separator className="bg-border" />

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Bot token {status?.bot_token_set && <span className="text-muted-foreground">(current: <code className="text-foreground/70">{status.bot_token_masked}</code>)</span>}</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={form.bot_token}
                onChange={e => setForm({ ...form, bot_token: e.target.value })}
                placeholder={status?.bot_token_set ? 'leave blank to keep existing' : 'paste from @BotFather'}
                className="bg-secondary/50 border-border pr-9 editorial-mono text-sm"
              />
              <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="editorial-eyebrow mb-1.5 block">Admin chat ID</Label>
            <Input
              value={form.admin_chat_id}
              onChange={e => setForm({ ...form, admin_chat_id: e.target.value })}
              placeholder="Numeric id — or send /start to the bot"
              className="bg-secondary/50 border-border editorial-mono text-sm"
            />
            <div className="editorial-mono text-[0.875rem] text-muted-foreground mt-1">
              Tip: open your bot in Telegram and send <code>/start</code>. On first message we auto-capture the chat id.
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={saveSettings} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
            <Button onClick={register} variant="outline" className="border-border"><PlugZap className="h-4 w-4 mr-2" /> Register webhook</Button>
            <Button onClick={sendTest} variant="outline" className="border-border" disabled={!isConnected}><Send className="h-4 w-4 mr-2" /> Send test</Button>
            <Button onClick={unregister} variant="ghost" className="text-muted-foreground hover:text-flag ml-auto">Unregister</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-serif">How the approval flow works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>• Each draft gets posted to your bot chat with the 5 platform captions and inline buttons.</div>
          <div>• Tap <b>Approve</b>, <b>Post now</b>, <b>Schedule</b>, <b>Regen all</b>, or <b>Regen {'<platform>'}</b> to act instantly.</div>
          <div>• Send <code>/help</code>, <code>/pending</code>, <code>/styles</code>, <code>/style playful</code> to the bot for text control.</div>
          <div className="editorial-mono text-[0.875rem] text-muted-foreground pt-2">Note: <b>Post now</b> currently stubs the platform APIs — real LinkedIn / Meta / Threads / X posting arrives in the next slice.</div>
        </CardContent>
      </Card>
    </div>
  )
}

function SecurityTab() {
  // Single-user security: password lives in env (APP_PASSWORD), session is a
  // signed HttpOnly cookie. No database, no MFA enrollment UI needed.
  const [session, setSession] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try { const s = await api('/auth/session'); setSession(!!s?.session) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const logout = async () => { await fetch('/api/auth/signout', { method: 'POST' }); window.location.href = '/login' }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-[#EBECF2] bg-[#FAFAFD] p-4 text-sm">
          <div className="font-bold text-[#16161D]">Session status</div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${session ? 'bg-[#0EA37A]' : 'bg-[#C4C5CE]'}`} />
            <span className="text-[#8A8A96]">{session ? 'Active session (signed cookie)' : 'No session'}</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#EBECF2] bg-[#FAFAFD] p-4 text-sm space-y-2">
          <div className="font-bold text-[#16161D]">Single-operator auth</div>
          <ul className="text-xs text-[#8A8A96] space-y-1.5 leading-relaxed">
            <li>• Password is stored in <code className="text-[#7C3AED]">APP_PASSWORD</code> (environment variable) — change it there.</li>
            <li>• Sessions are 30-day signed HttpOnly cookies signed by <code className="text-[#7C3AED]">APP_SESSION_SECRET</code>.</li>
            <li>• No credentials are stored in Google Sheets or any database.</li>
          </ul>
        </div>
        <Button variant="outline" onClick={logout}>Sign out everywhere</Button>
      </CardContent>
    </Card>
  )
}

function AutomationTab() {
  const [modules, setModules] = useState([])
  const [prompts, setPrompts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([api('/automation/modules'), api('/platform-prompts')])
      setModules(m)
      setPrompts(p)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const saveModule = async (key, patch) => {
    setSavingKey(key)
    try {
      await api(`/automation/module/${key}`, { method: 'PUT', body: patch })
      toast.success('Saved')
      refresh()
    } catch (e) { toast.error(e.message) } finally { setSavingKey(null) }
  }

  const savePlatformPrompt = async (platform, prompt_template) => {
    try {
      await api(`/platform-prompts/${platform}`, { method: 'PUT', body: { prompt_template } })
      toast.success(`${platform} prompt saved`)
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif font-semibold text-lg">AI Automation Center</h3>
        <p className="text-sm text-muted-foreground">Independent modules. Each has its own prompt template and enable toggle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {modules.map(m => (
          <Card key={m.module_key} className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-serif flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-muted-foreground" /> {m.display_name}
                </CardTitle>
                <Switch checked={!!m.enabled} onCheckedChange={v => saveModule(m.module_key, { enabled: v })} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="editorial-eyebrow">Prompt template</Label>
              <Textarea
                defaultValue={m.prompt_template}
                onBlur={e => e.target.value !== m.prompt_template && saveModule(m.module_key, { prompt_template: e.target.value })}
                rows={5}
                className="bg-secondary/50 border-border editorial-mono text-xs leading-relaxed"
              />
              <div className="editorial-mono text-[0.875rem] text-muted-foreground">
                Uses <code>{'{{context}}'}</code>, <code>{'{{platform}}'}</code>, <code>{'{{mode}}'}</code>, <code>{'{{target}}'}</code>, <code>{'{{count}}'}</code>, <code>{'{{style}}'}</code> as variables.
              </div>
              {savingKey === m.module_key && <div className="editorial-mono text-[0.875rem] text-primary flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> saving…</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="bg-border" />

      <div>
        <h3 className="font-serif font-semibold text-lg">Per-platform prompt templates</h3>
        <p className="text-sm text-muted-foreground mb-4">Fine-tune caption behavior for each platform.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(prompts).map(([platform, row]) => (
            <Card key={platform} className="bg-card border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-serif capitalize">{platform}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  defaultValue={row.prompt_template}
                  onBlur={e => e.target.value !== row.prompt_template && savePlatformPrompt(platform, e.target.value)}
                  rows={3}
                  className="bg-secondary/50 border-border text-xs"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function BioLinksTab() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ title: '', url: '', icon: 'link' })
  const [editId, setEditId] = useState(null)
  const load = async () => { try { setLinks(await api('/bio-links')) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const save = async () => {
    if (!form.title || !form.url) return toast.error('Title and URL required')
    try {
      if (editId) await api(`/bio-links/${editId}`, { method: 'PUT', body: form }).then(() => { setEditId(null); setForm({ title: '', url: '', icon: 'link' }); load() })
      else await api('/bio-links', { method: 'POST', body: form }).then(() => { setForm({ title: '', url: '', icon: 'link' }); load() })
      toast.success('Saved')
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { try { await api(`/bio-links/${id}`, { method: 'DELETE' }); load() } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-4">
      <div><h3 className="font-serif font-semibold text-lg">Bio Links</h3><p className="text-sm text-muted-foreground">Manage links for your public bio page at /bio.</p></div>
      <div className="flex gap-2">
        <Input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-secondary/50 border-border flex-1" />
        <Input placeholder="URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="bg-secondary/50 border-border flex-[2]" />
        <Button size="sm" onClick={save} className="bg-primary text-primary-foreground"><Save className="h-3.5 w-3.5 mr-1" /> {editId ? 'Update' : 'Add'}</Button>
      </div>
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : links.length === 0 ? <div className="text-sm text-muted-foreground">No links yet.</div> : (
        <div className="space-y-1">
          {links.map(l => (
            <div key={l.id} className="flex items-center gap-2 p-2 border border-border rounded-sm bg-card">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">{l.title} <span className="text-muted-foreground">— {l.url}</span></span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditId(l.id); setForm({ title: l.title, url: l.url, icon: l.icon }) }}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">Public at: <code>{typeof window !== 'undefined' ? window.location.origin : ''}/bio</code></div>
    </div>
  )
}

function DangerZoneTab() {
  const [killSwitch, setKillSwitch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingBackup, setDownloadingBackup] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (json.ok) setKillSwitch(!!json.data.kill_switch)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const toggleKillSwitch = async (v) => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kill_switch: v }) })
      const json = await res.json()
      if (json.ok) {
        setKillSwitch(v)
        toast.success(v ? 'Kill switch activated — publishing paused' : 'Kill switch deactivated — publishing resumed')
      } else {
        toast.error(json.error)
      }
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  const downloadBackup = async () => {
    setDownloadingBackup(true)
    try {
      const res = await fetch('/api/backup/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `socialforge-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    } catch (e) { toast.error(e.message) } finally { setDownloadingBackup(false) }
  }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="font-serif font-semibold text-lg text-flag">Danger Zone</h3>
        <p className="text-sm text-muted-foreground mt-1">Destructive actions that pause or alter publishing behavior.</p>
      </div>

      <div className="border border-border rounded-sm p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Download Backup</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Export all content jobs, blog posts, audit logs, hashtag stats, and mentions as JSON.
            </div>
          </div>
          <Button onClick={downloadBackup} disabled={downloadingBackup} variant="outline" className="border-border">
            {downloadingBackup ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download
          </Button>
        </div>
      </div>

      <div className="border border-flag/40 rounded-sm p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Global Kill Switch</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {killSwitch
                ? 'All publishing is currently paused. Toggle off to resume.'
                : 'When activated, all publish endpoints will immediately return an error.'}
            </div>
          </div>
          <Switch checked={killSwitch} onCheckedChange={toggleKillSwitch} disabled={saving} />
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
