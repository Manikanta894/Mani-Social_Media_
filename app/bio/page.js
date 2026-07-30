'use client'

import { useEffect, useState } from 'react'
import { api } from '@/components/shared'
import { ExternalLink } from 'lucide-react'

export default function BioPage() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api('/bio-links').then(setLinks).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
          <span className="text-2xl font-serif font-bold text-primary">M</span>
        </div>
        <h1 className="font-serif text-xl font-semibold text-gray-800">Links</h1>
        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : links.length === 0 ? (
          <div className="text-sm text-gray-400">No links yet.</div>
        ) : (
          <div className="space-y-2">
            {links.filter(l => l.visible).map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                className="block w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {l.title} <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </a>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-8">Powered by SocialForge</div>
      </div>
    </div>
  )
}