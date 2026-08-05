'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Layers, Loader2, Plus, Pencil, Trash2, Check, X, RefreshCw,
  FileText, Wand2, Calendar as CalendarIcon, Upload, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, PLATFORMS, StatusStamp } from '@/components/shared'

export default function BulkPage() {
  const [campaigns, setCampaigns] = useState([])
  const [activeCampaignId, setActiveCampaignId] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [addTab, setAddTab] = useState('manual')
  const [newCampaignName, setNewCampaignName] = useState('')
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  // Manual add
  const [manualPosts, setManualPosts] = useState({})

  // CSV import
  const [csvText, setCsvText] = useState('')

  // AI bulk gen
  const [bulkTopic, setBulkTopic] = useState('')
  const [bulkGenerating, setBulkGenerating] = useState(false)

  // Batch schedule
  const [batchRows, setBatchRows] = useState([{ platform: 'linkedin', caption: '', scheduled_for: '' }])

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId) || null

  const refreshCampaigns = useCallback(async () => {
    try { setCampaigns(await api('/campaigns')) } catch (e) { toast.error(e.message) }
  }, [])

  const refreshJobs = useCallback(async () => {
    if (!activeCampaignId) { setJobs([]); return }
    setJobsLoading(true)
    try { setJobs(await api('/jobs?campaign_id=' + activeCampaignId)) } catch (e) { toast.error(e.message) }
    finally { setJobsLoading(false) }
  }, [activeCampaignId])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await refreshCampaigns()
      setLoading(false)
    })()
  }, [refreshCampaigns])

  useEffect(() => { refreshJobs() }, [refreshJobs])

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return
    setCreating(true)
    try {
      const c = await api('/campaigns', { method: 'POST', body: { name: newCampaignName.trim() } })
      setNewCampaignName('')
      await refreshCampaigns()
      setActiveCampaignId(c.id)
      toast.success('Campaign created')
    } catch (e) { toast.error(e.message) } finally { setCreating(false) }
  }

  const renameCampaign = async (id, name) => {
    if (!name.trim()) return
    try {
      await api('/campaigns/' + id, { method: 'PUT', body: { name: name.trim() } })
      setRenamingId(null)
      await refreshCampaigns()
      toast.success('Renamed')
    } catch (e) { toast.error(e.message) }
  }

  const deleteCampaign = async (id) => {
    if (!confirm('Delete this campaign and all its posts?')) return
    try {
      await api('/campaigns/' + id, { method: 'DELETE' })
      if (activeCampaignId === id) setActiveCampaignId(null)
      await refreshCampaigns()
      toast.success('Campaign deleted')
    } catch (e) { toast.error(e.message) }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === jobs.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(jobs.map(j => j.id)))
  }

  // Manual add
  const addManualPost = async (platform) => {
    const text = manualPosts[platform]?.trim()
    if (!text) return
    if (!activeCampaign) return toast.error('Select a campaign first')
    try {
      const r = await api('/jobs/bulk', { method: 'POST', body: {
        jobs: [{ source: 'manual', platform_posts: { [platform]: { caption: text } }, status: 'draft', campaign_id: activeCampaign.id }]
      }})
      setManualPosts(p => ({ ...p, [platform]: '' }))
      await refreshJobs()
      toast.success('Post added')
    } catch (e) { toast.error(e.message) }
  }

  // CSV import
  const importCSV = async () => {
    if (!csvText.trim()) return toast.error('Paste CSV data first')
    if (!activeCampaign) return toast.error('Select a campaign first')
    try {
      const lines = csvText.trim().split('\n').filter(Boolean)
      const jobs = lines.map(line => {
        const parts = line.split(',').map(s => s.trim())
        const platform = parts[0] || ''
        const caption = parts[1] || ''
        const scheduled = parts[2] || ''
        return { source: 'csv', platform_posts: { [platform]: { caption } }, scheduled_for: scheduled || null, status: 'draft', campaign_id: activeCampaign.id }
      })
      const r = await api('/jobs/bulk', { method: 'POST', body: { jobs } })
      setCsvText('')
      await refreshJobs()
      toast.success(`Imported ${r.succeeded} post(s)${r.failed ? ' · ' + r.failed + ' failed' : ''}`)
    } catch (e) { toast.error(e.message) }
  }

  // AI bulk generation
  const generateBulkPosts = async () => {
    if (!bulkTopic.trim()) return toast.error('Enter a topic')
    if (!activeCampaign) return toast.error('Select a campaign first')
    setBulkGenerating(true)
    try {
      const r = await api('/generate/bulk', { method: 'POST', body: { topic: bulkTopic.trim(), campaign_id: activeCampaign.id, platforms: PLATFORMS.map(p => p.key) } })
      setBulkTopic('')
      await refreshJobs()
      toast.success(`Generated posts for ${PLATFORMS.length} platforms`)
    } catch (e) { toast.error(e.message) } finally { setBulkGenerating(false) }
  }

  // Batch schedule — add multiple rows
  const addBatchRow = () => {
    setBatchRows(prev => [...prev, { platform: 'linkedin', caption: '', scheduled_for: '' }])
  }

  const updateBatchRow = (i, field, value) => {
    setBatchRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  const removeBatchRow = (i) => {
    setBatchRows(prev => prev.filter((_, idx) => idx !== i))
  }

  const submitBatch = async () => {
    const valid = batchRows.filter(r => r.caption.trim())
    if (valid.length === 0) return toast.error('Add at least one post with a caption')
    if (!activeCampaign) return toast.error('Select a campaign first')
    try {
      const jobs = valid.map(r => ({
        source: 'manual',
        platform_posts: { [r.platform]: { caption: r.caption.trim() } },
        scheduled_for: r.scheduled_for || null,
        status: r.scheduled_for ? 'scheduled' : 'draft',
        campaign_id: activeCampaign.id,
      }))
      const result = await api('/jobs/bulk', { method: 'POST', body: { jobs } })
      setBatchRows([{ platform: 'linkedin', caption: '', scheduled_for: '' }])
      await refreshJobs()
      toast.success(`Added ${result.succeeded} post(s)`)
    } catch (e) { toast.error(e.message) }
  }

  // Bulk actions
  const bulkUpdateStatus = async (status) => {
    if (selectedIds.size === 0) return toast.error('Select posts first')
    try {
      const ids = [...selectedIds]
      for (const id of ids) {
        await api('/jobs/' + id, { method: 'PUT', body: { status } })
      }
      const label = status === 'approved' ? 'Approved' : status === 'scheduled' ? 'Scheduled' : 'Archived'
      setSelectedIds(new Set())
      await refreshJobs()
      toast.success(`${label} ${ids.length} post(s)`)
    } catch (e) { toast.error(e.message) }
  }

  const getPlatforms = (job) => Object.keys(job.platform_posts || {})
  const getCaption = (job) => {
    const posts = job.platform_posts || {}
    const first = Object.values(posts)[0]
    return first?.caption || ''
  }

  // Prompt rename
  const startRename = (c) => { setRenamingId(c.id); setRenameValue(c.name) }

  if (loading) return <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading campaigns…</div>

  return (
    <div className="space-y-6">
      {/* Empty state — no campaigns */}
      {campaigns.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
          <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <div className="text-foreground font-serif font-semibold">No campaigns yet</div>
          <div className="text-sm text-muted-foreground mt-1">Create a campaign to start managing posts in bulk.</div>
          <div className="flex items-center gap-2 mt-4 max-w-xs mx-auto">
            <Input value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)}
              placeholder="Campaign name…" className="bg-secondary/50 border-border"
              onKeyDown={e => e.key === 'Enter' && createCampaign()} />
            <Button onClick={createCampaign} disabled={creating || !newCampaignName.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* LEFT PANEL — Campaign list */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <Input value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)}
                placeholder="New campaign…" className="bg-secondary/50 border-border text-sm"
                onKeyDown={e => e.key === 'Enter' && createCampaign()} />
              <Button onClick={createCampaign} disabled={creating || !newCampaignName.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0" size="sm">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="border border-border rounded-sm bg-card shadow-sm divide-y divide-border max-h-[500px] overflow-y-auto">
              {campaigns.map(c => (
                <div key={c.id}
                  onClick={() => setActiveCampaignId(c.id)}
                  className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent/30 ${activeCampaignId === c.id ? 'bg-accent/50 border-l-2 border-l-primary' : ''}`}
                >
                  {renamingId === c.id ? (
                    <div className="flex items-center gap-1">
                      <Input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        className="bg-secondary/50 border-border text-xs h-7"
                        onKeyDown={e => { if (e.key === 'Enter') renameCampaign(c.id, renameValue); if (e.key === 'Escape') setRenamingId(null) }}
                        autoFocus onClick={e => e.stopPropagation()} />
                      <button onClick={e => { e.stopPropagation(); renameCampaign(c.id, renameValue) }} className="text-primary hover:text-primary/80 p-0.5"><Check className="h-3 w-3" /></button>
                      <button onClick={e => { e.stopPropagation(); setRenamingId(null) }} className="text-muted-foreground hover:text-foreground p-0.5"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="editorial-mono text-[0.875rem] text-muted-foreground">{jobs.filter(j => j.campaign_id === c.id).length || 0} post(s)</div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startRename(c)} className="text-muted-foreground hover:text-foreground p-1 rounded-sm hover:bg-accent" title="Rename"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => deleteCampaign(c.id)} className="text-muted-foreground hover:text-flag p-1 rounded-sm hover:bg-accent" title="Delete"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL — Campaign detail */}
          <div className="lg:col-span-3 space-y-5">
            {!activeCampaign ? (
              <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <div className="text-foreground font-serif font-semibold">Select a campaign</div>
                <div className="text-sm text-muted-foreground mt-1">Choose a campaign from the left to view and manage its posts.</div>
              </div>
            ) : (
              <>
                {/* Campaign header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-serif font-semibold text-lg">{activeCampaign.name}</h3>
                    <p className="text-sm text-muted-foreground">{jobs.length} post(s) in this campaign</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startRename(activeCampaign)} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm px-2.5 py-1 flex items-center gap-1"><Pencil className="h-3 w-3" /> Rename</button>
                    <button onClick={() => deleteCampaign(activeCampaign.id)} className="text-xs text-flag hover:text-flag/80 border border-flag/30 rounded-sm px-2.5 py-1 flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
                    <Button variant="outline" className="border-border" size="sm" onClick={refreshJobs}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                {/* Tabs for adding posts */}
                <Tabs value={addTab} onValueChange={setAddTab}>
                  <TabsList className="bg-card border border-border">
                    <TabsTrigger value="manual" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Pencil className="h-4 w-4 mr-2" /> Manual</TabsTrigger>
                    <TabsTrigger value="csv" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><FileText className="h-4 w-4 mr-2" /> CSV Import</TabsTrigger>
                    <TabsTrigger value="ai" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><Wand2 className="h-4 w-4 mr-2" /> AI Bulk Gen</TabsTrigger>
                    <TabsTrigger value="batch" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"><CalendarIcon className="h-4 w-4 mr-2" /> Batch Schedule</TabsTrigger>
                  </TabsList>

                  {/* Manual tab */}
                  <TabsContent value="manual">
                    <div className="border border-border rounded-sm bg-card p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Write a caption for each platform and add it individually.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {PLATFORMS.map(p => (
                          <div key={p.key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="editorial-eyebrow">{p.label}</span>
                              <span className="editorial-mono text-[0.875rem] text-muted-foreground">{manualPosts[p.key]?.length || 0}/{p.limit}</span>
                            </div>
                            <Textarea value={manualPosts[p.key] || ''}
                              onChange={e => setManualPosts(prev => ({ ...prev, [p.key]: e.target.value }))}
                              rows={3} placeholder={`Write a ${p.label} caption…`}
                              className="bg-secondary/50 border-border text-sm" />
                            <Button size="sm" onClick={() => addManualPost(p.key)} disabled={!manualPosts[p.key]?.trim() || !activeCampaign}
                              className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                              <Plus className="h-3 w-3 mr-1" /> Add to campaign
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* CSV tab */}
                  <TabsContent value="csv">
                    <div className="border border-border rounded-sm bg-card p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Paste CSV rows. Each line: <code className="editorial-mono text-[0.875rem] bg-secondary/50 px-1">platform,caption,scheduled_time(optional)</code></p>
                      <Textarea value={csvText} onChange={e => setCsvText(e.target.value)}
                        rows={8} placeholder={`linkedin,Check out our new product launch!,\ninstagram,New product alert! 🔥,2025-01-15T10:00:00Z\nfacebook,Big news everyone!,`}
                        className="bg-secondary/50 border-border text-sm editorial-mono" />
                      <div className="flex items-center gap-2">
                        <Button onClick={importCSV} disabled={!csvText.trim() || !activeCampaign}
                          className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <Upload className="h-4 w-4 mr-2" /> Import CSV
                        </Button>
                        <span className="editorial-mono text-[0.875rem] text-muted-foreground">Supported: linkedin, instagram, facebook, threads, twitter</span>
                      </div>
                    </div>
                  </TabsContent>

                  {/* AI Bulk Gen tab */}
                  <TabsContent value="ai">
                    <div className="border border-border rounded-sm bg-card p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Generate captions for all platforms at once using AI.</p>
                      <Textarea value={bulkTopic} onChange={e => setBulkTopic(e.target.value)}
                        rows={3} placeholder="Describe the topic or context for AI-generated posts…"
                        className="bg-secondary/50 border-border text-sm" />
                      <Button onClick={generateBulkPosts} disabled={bulkGenerating || !bulkTopic.trim() || !activeCampaign}
                        className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {bulkGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                        {bulkGenerating ? 'Generating…' : 'Generate for All Platforms'}
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Batch Schedule tab */}
                  <TabsContent value="batch">
                    <div className="border border-border rounded-sm bg-card p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Add multiple posts with scheduled times at once.</p>
                      <div className="space-y-2">
                        {batchRows.map((row, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Select value={row.platform} onValueChange={v => updateBatchRow(i, 'platform', v)}>
                              <SelectTrigger className="bg-secondary/50 border-border w-[140px] shrink-0"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {PLATFORMS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input value={row.caption} onChange={e => updateBatchRow(i, 'caption', e.target.value)}
                              placeholder="Caption…" className="bg-secondary/50 border-border text-sm flex-1 min-w-0" />
                            <Input type="datetime-local" value={row.scheduled_for} onChange={e => updateBatchRow(i, 'scheduled_for', e.target.value)}
                              className="bg-secondary/50 border-border text-sm w-[200px] shrink-0" />
                            <button onClick={() => removeBatchRow(i)} className="text-muted-foreground hover:text-flag p-1.5 mt-0.5 shrink-0"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="border-border" onClick={addBatchRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button>
                        <Button size="sm" onClick={submitBatch} disabled={!batchRows.some(r => r.caption.trim()) || !activeCampaign}
                          className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Add Scheduled Posts
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Jobs table */}
                {jobsLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading posts…</div>
                ) : jobs.length === 0 ? (
                  <div className="border border-dashed border-border rounded-sm p-10 text-center bg-secondary/30">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <div className="text-foreground font-serif font-semibold">No posts yet</div>
                    <div className="text-sm text-muted-foreground mt-1">Add posts using one of the methods above.</div>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-sm overflow-hidden shadow-sm">
                    {/* Bulk action bar */}
                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-accent/30 border-b border-border">
                        <span className="text-sm font-medium">{selectedIds.size} selected</span>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button size="sm" onClick={() => bulkUpdateStatus('approved')} className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                          <Check className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" onClick={() => bulkUpdateStatus('scheduled')} variant="outline" className="border-border h-7 text-xs">
                          <CalendarIcon className="h-3 w-3 mr-1" /> Schedule
                        </Button>
                        <Button size="sm" onClick={() => bulkUpdateStatus('archived')} variant="outline" className="border-flag/50 text-flag h-7 text-xs">
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/20 editorial-mono text-[0.8125rem] text-muted-foreground uppercase">
                            <th className="w-10 px-3 py-2.5 text-left">
                              <input type="checkbox" checked={selectedIds.size === jobs.length && jobs.length > 0}
                                onChange={selectAll} className="accent-primary cursor-pointer" />
                            </th>
                            <th className="px-3 py-2.5 text-left">Platforms</th>
                            <th className="px-3 py-2.5 text-left">Caption</th>
                            <th className="px-3 py-2.5 text-left">Scheduled</th>
                            <th className="px-3 py-2.5 text-left">Status</th>
                            <th className="w-16 px-3 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {jobs.map((job, i) => (
                            <tr key={job.id} className="hover:bg-accent/20 transition-colors">
                              <td className="px-3 py-2.5">
                                <input type="checkbox" checked={selectedIds.has(job.id)}
                                  onChange={() => toggleSelect(job.id)} className="accent-primary cursor-pointer" />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  {getPlatforms(job).map(p => {
                                    const plat = PLATFORMS.find(x => x.key === p)
                                    return (
                                      <span key={p} className="editorial-mono text-[0.875rem] border border-border/50 px-1.5 py-0.5 rounded-sm bg-secondary/30">
                                        {plat?.letter || p?.slice(0, 2)}
                                      </span>
                                    )
                                  })}
                                  {getPlatforms(job).length === 0 && <span className="text-muted-foreground text-[0.875rem]">—</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 max-w-[240px]">
                                <div className="truncate text-foreground/80 text-xs">{getCaption(job) || <span className="text-muted-foreground italic">No caption</span>}</div>
                                {job.topic && <div className="editorial-mono text-[0.875rem] text-muted-foreground truncate mt-0.5">{job.topic}</div>}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="editorial-mono text-[0.875rem] text-muted-foreground">
                                  {job.scheduled_for ? new Date(job.scheduled_for).toLocaleString() : '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5"><StatusStamp status={job.status} /></td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <button onClick={async () => { try { await api('/jobs/' + job.id, { method: 'PUT', body: { status: job.status === 'approved' ? 'draft' : 'approved' } }); await refreshJobs(); toast.success(job.status === 'approved' ? 'Unapproved' : 'Approved') } catch (e) { toast.error(e.message) } }}
                                    className="text-muted-foreground hover:text-primary p-1 rounded-sm hover:bg-accent" title="Toggle approve">
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button onClick={async () => { try { await api('/jobs/' + job.id, { method: 'PUT', body: { status: 'archived' } }); await refreshJobs(); toast.success('Deleted') } catch (e) { toast.error(e.message) } }}
                                    className="text-muted-foreground hover:text-flag p-1 rounded-sm hover:bg-accent" title="Delete">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="editorial-mono text-[0.875rem] text-muted-foreground px-4 py-2 border-t border-border text-right">
                      {jobs.length} post(s)
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
