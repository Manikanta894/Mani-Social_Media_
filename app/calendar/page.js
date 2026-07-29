'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Loader2, GripVertical, Send, MessageSquare, Link, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, StatusStamp, PLATFORMS } from '@/components/shared'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const [jobs, setJobs] = useState([])
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [draggingJob, setDraggingJob] = useState(null)
  const [publishing, setPublishing] = useState(null)
  const [showList, setShowList] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const data = await api('/jobs')
      setJobs(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const getWeekDays = (date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d
    })
  }

  const getMonthDays = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const start = new Date(firstDay)
    start.setDate(start.getDate() - start.getDay())
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const getJobsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return jobs.filter(j => {
      if (j.scheduled_for && j.scheduled_for.startsWith(dateStr)) return true
      if (!j.scheduled_for && j.created_at && j.created_at.startsWith(dateStr)) return true
      return false
    })
  }

  const handleDragStart = (e, job) => {
    setDraggingJob(job)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', job.id)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, targetDate) => {
    e.preventDefault()
    if (!draggingJob) return
    const newDate = new Date(targetDate)
    const oldDate = draggingJob.scheduled_for ? new Date(draggingJob.scheduled_for) : new Date()
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0)
    try {
      await api(`/jobs/${draggingJob.id}`, { method: 'PUT', body: { scheduled_for: newDate.toISOString() } })
      toast.success(`Rescheduled to ${newDate.toLocaleDateString()}`)
      refresh()
    } catch (err) { toast.error(err.message) }
    setDraggingJob(null)
  }

  const navigate = (dir) => {
    const d = new Date(currentDate)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCurrentDate(d)
  }

  const publish = async (job) => {
    setPublishing(job.id)
    try {
      const r = await api(`/publish/${job.id}`, { method: 'POST', body: {} })
      const okCount = (r.results || []).filter(x => x.ok).length
      if (okCount > 0) toast.success(`Published to ${okCount} platform(s)`)
      else toast.error(`Publish failed: ${r.results?.[0]?.error || 'unknown'}`)
      refresh()
    } catch (e) { toast.error(e.message) }
    finally { setPublishing(null) }
  }

  const sendToTelegram = async (job) => {
    try {
      await api('/telegram/send-draft', { method: 'POST', body: { jobId: job.id } })
      toast.success('Sent to Telegram')
    } catch (e) { toast.error(e.message) }
  }

  const copyApprovalLink = async (jobId) => {
    const url = `${window.location.origin}/approve?job=${jobId}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Approval link copied')
    } catch { toast.error('Failed to copy link') }
  }

  const days = view === 'week' ? getWeekDays(currentDate) : getMonthDays(currentDate)
  const isToday = (d) => d.toDateString() === new Date().toDateString()
  const isCurrentMonth = (d) => d.getMonth() === currentDate.getMonth()

  if (loading) return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6">
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-6">
      <div className="border-b border-border pb-6 mb-6">
        <h1 className="editorial-title text-2xl">Print Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">Drag posts to reschedule. Your running order at a glance.</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-serif font-semibold text-lg">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
        <div className="flex gap-1">
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>Week</Button>
          <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setView('month')}>Month</Button>
          <Button variant={showList ? 'default' : 'outline'} size="sm" onClick={() => setShowList(!showList)} className="ml-2">
            <CalendarIcon className="h-3.5 w-3.5 mr-1" /> List
          </Button>
        </div>
      </div>

      {!showList && (
        view === 'week' ? (
          <div className="grid grid-cols-7 gap-px bg-border rounded-sm overflow-hidden mb-6">
            {days.map((day, i) => (
              <div
                key={i}
                className={`bg-card min-h-[140px] p-2 ${isToday(day) ? 'ring-2 ring-accent/30' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={`text-xs font-medium mb-2 ${isToday(day) ? 'text-accent font-bold' : 'text-muted-foreground'}`}>
                  {DAY_NAMES[day.getDay()]} {day.getDate()}
                </div>
                <div className="space-y-1">
                  {getJobsForDate(day).map(job => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      className="bg-accent/10 border border-accent/20 rounded-sm p-1.5 text-xs cursor-grab active:cursor-grabbing hover:bg-accent/20 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
                        <StatusStamp status={job.status} className="text-[0.4rem]" />
                      </div>
                      <div className="truncate mt-0.5 font-medium">{job.topic || 'Untitled'}</div>
                      {job.scheduled_for && (
                        <div className="text-muted-foreground text-[0.5rem]">
                          {new Date(job.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      <div className="flex gap-0.5 mt-1">
                        {job.status !== 'published' && (
                          <button onClick={(e) => { e.stopPropagation(); publish(job) }} className="text-[0.5rem] text-accent hover:underline">
                            {publishing === job.id ? '...' : 'Publish'}
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); copyApprovalLink(job.id) }} className="text-[0.5rem] text-muted-foreground hover:text-foreground">
                          Copy link
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-border rounded-sm overflow-hidden mb-6">
            {DAY_NAMES.map(d => (
              <div key={d} className="bg-muted p-2 text-xs font-medium text-center text-muted-foreground">{d}</div>
            ))}
            {days.map((day, i) => (
              <div
                key={i}
                className={`bg-card min-h-[80px] p-1.5 ${!isCurrentMonth(day) ? 'opacity-40' : ''} ${isToday(day) ? 'ring-2 ring-accent/30' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={`text-xs mb-1 ${isToday(day) ? 'text-accent font-bold' : 'text-muted-foreground'}`}>{day.getDate()}</div>
                {getJobsForDate(day).slice(0, 3).map(job => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job)}
                    className="bg-accent/10 border border-accent/20 rounded-sm p-0.5 text-[0.5rem] truncate cursor-grab hover:bg-accent/20"
                  >
                    {job.topic || 'Untitled'}
                  </div>
                ))}
                {getJobsForDate(day).length > 3 && (
                  <div className="text-[0.5rem] text-muted-foreground">+{getJobsForDate(day).length - 3} more</div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Running order list */}
      <div className="bg-card border border-border rounded-sm p-4 sm:p-5">
        <div className="editorial-eyebrow mb-3">Running order · {jobs.length} item{jobs.length !== 1 ? 's' : ''}</div>
        <div className="divide-y divide-border">
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nothing on the print schedule yet.</div>
          ) : jobs.map((job, i) => {
            const post = job.platform_posts?.linkedin || job.platform_posts?.instagram || job.platform_posts?.facebook || Object.values(job.platform_posts || {})[0]
            const preview = post?.caption?.slice(0, 140) || '(no caption)'
            return (
              <div key={job.id} className="running-order-row row-enter py-3" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="running-order-number">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusStamp status={job.status} />
                        {job.style_name && <span className="editorial-mono text-[0.5rem] text-muted-foreground border border-border/50 px-1 py-0.5 rounded-sm">{job.style_name}</span>}
                        <span className="editorial-mono text-[0.5rem] text-muted-foreground">{new Date(job.created_at).toLocaleString()}</span>
                        {job.scheduled_for && <span className="editorial-mono text-[0.5rem] text-primary">{'\uD83D\uDCC6'} {new Date(job.scheduled_for).toLocaleString()}</span>}
                        {job.published_url && <a href={job.published_url} target="_blank" rel="noreferrer" className="editorial-mono text-[0.5rem] text-primary hover:underline">{'\u2197'} live</a>}
                      </div>
                      <div className="text-sm text-foreground/80 line-clamp-2">{preview}</div>
                      <div className="editorial-mono text-[0.5rem] text-muted-foreground">{job.id}</div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-1 shrink-0">
                      {job.status !== 'published' && (
                        <Button size="sm" onClick={() => publish(job)} disabled={publishing === job.id} className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs">
                          {publishing === job.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Publish</>}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => sendToTelegram(job)} className="border-border h-7 text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" /> TG
                      </Button>
                      {(job.status === 'pending_approval' || job.status === 'scheduled') && (
                        <Button size="sm" variant="outline" onClick={() => copyApprovalLink(job.id)} className="border-border h-7 text-xs">
                          <Link className="h-3 w-3 mr-1" /> Copy link
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
