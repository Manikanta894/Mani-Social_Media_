'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusStamp, PLATFORMS } from '@/components/shared'

export default function ApprovePage() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job')
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionTaken, setActionTaken] = useState(null)

  useEffect(() => {
    if (!jobId) { setLoading(false); return }
    fetch(`/api/approve?job=${jobId}`).then(r => r.json()).then(j => {
      if (j.ok) setJob(j.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [jobId])

  const handleAction = async (action) => {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, action }),
    })
    const data = await res.json()
    if (data.ok) setActionTaken(action)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-4 w-4 animate-spin" /></div>
  if (!jobId) return <div className="flex items-center justify-center h-screen text-muted-foreground">No job specified</div>
  if (!job) return <div className="flex items-center justify-center h-screen text-muted-foreground">Job not found</div>

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <CardHeader>
          <CardTitle className="studio-title">{job.topic || 'Untitled Post'}</CardTitle>
          <StatusStamp status={job.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(job.platform_posts || {}).map(([platform, post]) => (
            <div key={platform} className="border border-border rounded-sm p-3">
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">{platform}</div>
              <p className="text-sm">{post.caption}</p>
              {post.hashtags?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">{post.hashtags.join(' ')}</div>
              )}
            </div>
          ))}
          {actionTaken ? (
            <div className="text-center py-4 text-primary font-medium">
              {actionTaken === 'approve' ? '✓ Approved' : '✕ Rejected'}
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleAction('approve')} className="flex-1 studio-btn-gradient">
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button onClick={() => handleAction('reject')} variant="outline" className="flex-1 border-border">
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
