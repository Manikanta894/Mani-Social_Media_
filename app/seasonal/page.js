'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays, List, Sliders, Loader2, RefreshCw, AlertTriangle, Sun,
  Sparkles, Brain, TrendingUp, Star, Clock, Check, X, ArrowRight, Trash2, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { api } from '@/components/shared'

export default function SeasonalDashboard() {
  const [tab, setTab] = useState('events')
  const [events, setEvents] = useState([])
  const [queueItems, setQueueItems] = useState([])
  const [settings, setSettings] = useState({ countries: ['India'], industries: [], detectionWindow: 7, autoDraft: false, telegramNotify: false, approvalRequired: true, autoPublish: false })
  const [loading, setLoading] = useState({ events: true, queue: true, settings: false })
  const [generating, setGenerating] = useState({})
  const [eventFilter, setEventFilter] = useState('all')
  const [error, setError] = useState(null)

  const refreshEvents = async () => {
    setLoading(p => ({ ...p, events: true }))
    try {
      const data = await api('/seasonal/detect', { method: 'POST', body: { daysAhead: settings.detectionWindow || 14 } })
      setEvents(data || [])
      setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(p => ({ ...p, events: false })) }
  }

  const refreshQueue = async () => {
    setLoading(p => ({ ...p, queue: true }))
    try {
      const data = await api('/seasonal')
      setQueueItems(data || [])
    } catch (e) { setError(e.message) }
    finally { setLoading(p => ({ ...p, queue: false })) }
  }

  const refreshSettings = async () => {
    setLoading(p => ({ ...p, settings: true }))
    try {
      const data = await api('/seasonal/settings')
      setSettings(prev => ({ ...prev, ...data }))
    } catch (e) { console.warn(e.message) }
    finally { setLoading(p => ({ ...p, settings: false })) }
  }

  useEffect(() => { refreshEvents() }, [])
  useEffect(() => { if (tab === 'queue') refreshQueue() }, [tab])
  useEffect(() => { if (tab === 'settings') refreshSettings() }, [tab])

  const generateDraft = async (event) => {
    setGenerating(g => ({ ...g, [event.name]: true }))
    try {
      await api('/seasonal/generate', { method: 'POST', body: { event } })
      toast.success(`Draft created for ${event.name}`)
      await refreshEvents()
    } catch (e) { toast.error(e.message) }
    finally { setGenerating(g => ({ ...g, [event.name]: false })) }
  }

  const updateQueueItem = async (id, patch) => {
    try {
      await api(`/seasonal/${id}`, { method: 'PUT', body: patch })
      toast.success('Updated')
      await refreshQueue()
    } catch (e) { toast.error(e.message) }
  }

  const deleteQueueItem = async (id) => {
    try {
      await api(`/seasonal/${id}`, { method: 'DELETE' })
      toast.success('Removed from queue')
      await refreshQueue()
    } catch (e) { toast.error(e.message) }
  }

  const saveSettings = async () => {
    try {
      await api('/seasonal/settings', { method: 'POST', body: settings })
      toast.success('Seasonal settings saved')
    } catch (e) { toast.error(e.message) }
  }

  const filteredEvents = events.filter(e => {
    if (eventFilter === 'all') return true
    if (eventFilter === 'india') return e.country === 'India'
    if (eventFilter === 'global') return e.type === 'global'
    if (eventFilter === 'industry') return e.type === 'industry'
    return true
  })

  const tabsList = [
    { key: 'events', label: 'Events', icon: CalendarDays },
    { key: 'queue', label: 'Queue', icon: List },
    { key: 'settings', label: 'Settings', icon: Sliders },
  ]

  const statusColors = {
    draft: 'bg-stone-100 text-stone-700 border-stone-300',
    pending_approval: 'bg-amber-50 text-amber-700 border-amber-300',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-300',
    published: 'bg-purple-50 text-purple-700 border-purple-300',
    skipped: 'bg-gray-50 text-gray-500 border-gray-200',
    rejected: 'bg-red-50 text-red-700 border-red-300',
    archived: 'bg-stone-50 text-stone-400 border-stone-200',
  }

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'india', label: 'Indian Festivals' },
    { key: 'global', label: 'Global' },
    { key: 'industry', label: 'Industry' },
  ]

  const COUNTRIES = ['India', 'Global']
  const INDUSTRIES = ['tech', 'health', 'education', 'finance', 'marketing', 'general', 'environment', 'food', 'culture', 'sports', 'travel', 'social', 'lifestyle', 'fun', 'regional', 'hr', 'cybersecurity', 'data']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {tabsList.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.key === 'queue' && queueItems.length > 0 && (
              <span className="ml-1 editorial-mono text-[0.5rem] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{queueItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-flag bg-flag/5 border border-flag/30 rounded-sm p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {filterTabs.map(ft => (
                <button key={ft.key} onClick={() => setEventFilter(ft.key)}
                  className={`editorial-mono text-[0.6rem] px-2.5 py-1 rounded-sm border transition-colors ${
                    eventFilter === ft.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {ft.label}
                </button>
              ))}
            </div>
            <Button onClick={refreshEvents} disabled={loading.events} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading.events ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading.events ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading events…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
              <Sun className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <div className="text-foreground font-serif font-semibold">No upcoming events</div>
              <div className="text-sm text-muted-foreground mt-1">Adjust your detection window or filters.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredEvents.map((e, i) => {
                const typeColors = {
                  festival: 'bg-amber-50 text-amber-700 border-amber-200',
                  national: 'bg-blue-50 text-blue-700 border-blue-200',
                  global: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  industry: 'bg-violet-50 text-violet-700 border-violet-200',
                  observance: 'bg-stone-50 text-stone-600 border-stone-200',
                }
                const tc = typeColors[e.type] || typeColors.observance
                const isGen = generating[e.name]
                return (
                  <div key={i} className={`border rounded-sm p-4 bg-card shadow-sm ${e.isDrafted ? 'border-primary/30 ring-1 ring-primary/20' : 'border-border'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{e.emoji}</span>
                      {e.isDrafted && <span className="editorial-mono text-[0.5rem] text-primary border border-primary/30 px-1.5 py-0.5 rounded-sm bg-primary/5">DRAFTED</span>}
                    </div>
                    <h4 className="font-medium text-sm leading-tight">{e.name}</h4>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="editorial-mono text-[0.5rem] text-muted-foreground">{e.month}/{e.day}</span>
                      <span className={`editorial-mono text-[0.5rem] px-1.5 py-0.5 rounded-sm border ${tc}`}>{e.type}</span>
                      {e.daysUntil === 0 ? (
                        <span className="editorial-mono text-[0.5rem] text-flag border border-flag/30 px-1.5 py-0.5 rounded-sm">TODAY</span>
                      ) : (
                        <span className="editorial-mono text-[0.5rem] text-muted-foreground">in {e.daysUntil}d</span>
                      )}
                    </div>
                    {e.industry && (
                      <div className="editorial-mono text-[0.5rem] text-muted-foreground mt-1.5">#{e.industry}</div>
                    )}
                    {e.relevanceScore && (
                      <div className="mt-2 flex items-center gap-2">
                        <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${e.relevanceScore * 10}%` }} />
                        </div>
                        <span className="editorial-mono text-[0.5rem] text-muted-foreground">{e.relevanceScore}/10</span>
                      </div>
                    )}
                    <div className="mt-3">
                      <Button onClick={() => generateDraft(e)} disabled={isGen || e.isDrafted} size="sm" className="w-full h-7 text-xs">
                        {isGen ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        {isGen ? 'Generating…' : e.isDrafted ? 'Drafted' : 'Generate Draft'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{queueItems.length} item(s) in queue</span>
            </div>
            <Button onClick={refreshQueue} disabled={loading.queue} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading.queue ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading.queue ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</div>
          ) : queueItems.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm p-12 text-center bg-secondary/30">
              <List className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <div className="text-foreground font-serif font-semibold">Queue is empty</div>
              <div className="text-sm text-muted-foreground mt-1">Generate drafts from the Events tab to populate the queue.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {queueItems.map(item => (
                <div key={item.id} className="border border-border rounded-sm p-4 bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{item.emoji || '📅'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{item.event_name}</h4>
                          <span className={`editorial-mono text-[0.5rem] px-1.5 py-0.5 rounded-sm border ${statusColors[item.status] || statusColors.draft}`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{item.event_month}/{item.event_day}</span>
                          <span>·</span>
                          <span className="editorial-mono">{item.event_type}</span>
                          {item.event_industry && (
                            <>
                              <span>·</span>
                              <span>#{item.event_industry}</span>
                            </>
                          )}
                        </div>
                        {item.analysis && (
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1">
                              <Brain className="h-3 w-3 text-muted-foreground" />
                              <span className="editorial-mono text-[0.5rem] text-muted-foreground">Rel: {item.analysis.relevanceScore || '?'}/10</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                              <span className="editorial-mono text-[0.5rem] text-muted-foreground">Eng: {item.analysis.engagementPotential || '?'}/10</span>
                            </div>
                            {item.ai_confidence && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-muted-foreground" />
                                <span className="editorial-mono text-[0.5rem] text-muted-foreground">AI: {Math.round(item.ai_confidence * 100)}%</span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.analysis && item.analysis.recommendedPlatforms && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {item.analysis.recommendedPlatforms.map(p => (
                              <span key={p} className="editorial-mono text-[0.5rem] bg-secondary/50 px-1.5 py-0.5 rounded-sm text-muted-foreground">{p}</span>
                            ))}
                          </div>
                        )}
                        {item.scheduled_for && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="editorial-mono text-[0.5rem] text-muted-foreground">{new Date(item.scheduled_for).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'draft' && (
                        <button onClick={() => updateQueueItem(item.id, { status: 'pending_approval' })}
                          className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Send for approval">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {item.status === 'pending_approval' && (
                        <>
                          <button onClick={() => updateQueueItem(item.id, { status: 'approved' })}
                            className="p-1.5 rounded-sm hover:bg-emerald-50 text-muted-foreground hover:text-emerald-700 transition-colors" title="Approve">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => updateQueueItem(item.id, { status: 'rejected' })}
                            className="p-1.5 rounded-sm hover:bg-red-50 text-muted-foreground hover:text-red-700 transition-colors" title="Reject">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {item.status === 'approved' && (
                        <button onClick={() => {
                          const d = new Date()
                          d.setDate(d.getDate() + 1)
                          updateQueueItem(item.id, { status: 'scheduled', scheduled_for: d.toISOString() })
                        }} className="p-1.5 rounded-sm hover:bg-blue-50 text-muted-foreground hover:text-blue-700 transition-colors" title="Schedule for tomorrow">
                          <Clock className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {item.status === 'scheduled' && (
                        <button onClick={() => updateQueueItem(item.id, { status: 'published' })}
                          className="p-1.5 rounded-sm hover:bg-purple-50 text-muted-foreground hover:text-purple-700 transition-colors" title="Mark published">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {['draft', 'pending_approval', 'rejected', 'scheduled'].includes(item.status) && (
                        <button onClick={() => deleteQueueItem(item.id)}
                          className="p-1.5 rounded-sm hover:bg-red-50 text-muted-foreground hover:text-red-700 transition-colors" title="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-xl space-y-6">
          <div>
            <h4 className="font-serif font-semibold text-sm mb-2">Target Countries</h4>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map(c => (
                <button key={c} onClick={() => setSettings(s => ({
                  ...s,
                  countries: s.countries.includes(c) ? s.countries.filter(x => x !== c) : [...s.countries, c],
                }))} className={`editorial-mono text-[0.6rem] px-2.5 py-1 rounded-sm border transition-colors ${
                  settings.countries.includes(c) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif font-semibold text-sm mb-2">Target Industries</h4>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {INDUSTRIES.map(ind => (
                <button key={ind} onClick={() => setSettings(s => ({
                  ...s,
                  industries: s.industries.includes(ind) ? s.industries.filter(x => x !== ind) : [...s.industries, ind],
                }))} className={`editorial-mono text-[0.6rem] px-2.5 py-1 rounded-sm border transition-colors ${
                  settings.industries.includes(ind) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                }`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-serif font-semibold text-sm mb-2">Detection Window: {settings.detectionWindow} days</h4>
            <input type="range" min="3" max="14" value={settings.detectionWindow}
              onChange={e => setSettings(s => ({ ...s, detectionWindow: parseInt(e.target.value) }))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-[0.5rem] text-muted-foreground editorial-mono">
              <span>3 days</span>
              <span>14 days</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Auto-draft</div>
                <div className="text-xs text-muted-foreground">Automatically generate drafts for detected events</div>
              </div>
              <Switch checked={settings.autoDraft} onCheckedChange={v => setSettings(s => ({ ...s, autoDraft: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Telegram notifications</div>
                <div className="text-xs text-muted-foreground">Send alerts when new seasonal drafts are created</div>
              </div>
              <Switch checked={settings.telegramNotify} onCheckedChange={v => setSettings(s => ({ ...s, telegramNotify: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Approval required</div>
                <div className="text-xs text-muted-foreground">Drafts start in pending_approval instead of draft</div>
              </div>
              <Switch checked={settings.approvalRequired} onCheckedChange={v => setSettings(s => ({ ...s, approvalRequired: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Auto-publish</div>
                <div className="text-xs text-muted-foreground">Automatically publish approved drafts</div>
              </div>
              <Switch checked={settings.autoPublish} onCheckedChange={v => setSettings(s => ({ ...s, autoPublish: v }))} />
            </div>
          </div>

          <Button onClick={saveSettings} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      )}
    </div>
  )
}
