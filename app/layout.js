'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sparkles, Calendar as CalendarIcon, ImageIcon, BarChart3, MessageSquare,
  Settings as SettingsIcon, Wand2, List, Radio, Globe, Sun, X, PlugZap, Loader2, Hash,
  HelpCircle, FileText, Bell } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { api } from '@/components/shared'
import ErrorBoundary from '@/components/error-boundary'
import './globals.css'

const NAV_ITEMS = [
  { key: '/',                label: 'Dashboard',    icon: ImageIcon },
  { key: '/compose',         label: 'Compose',      icon: Sparkles },
  { key: '/commcenter',      label: 'Comm Center',  icon: MessageSquare },
  { key: '/calendar',        label: 'Schedule',     icon: CalendarIcon },
  { key: '/automation',      label: 'Automation',   icon: Wand2 },
  { key: '/blog-automation', label: 'Blog Engine',  icon: FileText },
  { key: '/analytics',       label: 'Analytics',    icon: BarChart3 },
  { key: '/events',          label: 'Event Engine', icon: Radio },
  { key: '/bulk',            label: 'Bulk Posts',   icon: List },
  { key: '/comments',        label: 'Inbox',        icon: MessageSquare },
  { key: '/news',            label: 'News Radar',   icon: Radio },
  { key: '/blog',            label: 'Blog Manual',  icon: Globe },
  { key: '/seasonal',        label: 'Seasonal',     icon: Sun },
  { key: '/hashtags',        label: 'Hashtags',     icon: Hash },
]

export default function RootLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStyle, setActiveStyle] = useState(null)
  const [textProvider, setTextProvider] = useState(null)
  const [providersConfigured, setProvidersConfigured] = useState(false)
  const [commUnread, setCommUnread] = useState(0)

  useEffect(() => {
    const read = () => { try { setCommUnread(parseInt(localStorage.getItem('sf_comm_unread_count') || '0', 10) || 0) } catch {} }
    read()
    const iv = setInterval(read, 15000)
    window.addEventListener('storage', read)
    return () => { clearInterval(iv); window.removeEventListener('storage', read) }
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    // Command palette
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const pages = [
          { key: '/', label: 'Dashboard' }, { key: '/compose', label: 'Compose' },
          { key: '/calendar', label: 'Schedule' }, { key: '/automation', label: 'Automation' },
          { key: '/blog-automation', label: 'Blog Engine' }, { key: '/analytics', label: 'Analytics' },
          { key: '/bulk', label: 'Bulk Posts' }, { key: '/comments', label: 'Inbox' },
          { key: '/news', label: 'News Radar' }, { key: '/blog', label: 'Blog' },
          { key: '/seasonal', label: 'Seasonal' }, { key: '/hashtags', label: 'Hashtags' },
          { key: '/settings', label: 'Settings' }, { key: '/help', label: 'Help' },
        ]
        const input = window.prompt('Go to: (Ctrl+K palette)\n' + pages.map(p => `${p.key} — ${p.label}`).join('\n'))
        if (input) {
          const match = pages.find(p => p.key.includes(input) || p.label.toLowerCase().includes(input.toLowerCase()))
          if (match) router.push(match.key)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(false) }, 5000)
    ;(async () => {
      try {
        const s = await api('/auth/session')
        if (!s?.session) { router.replace('/login'); return }
        setUser({ email: 'operator' })
        const [providers, styles] = await Promise.all([
          api('/providers'), api('/prompt-styles'),
        ])
        setActiveStyle(styles.find(s => s.is_active) || styles[0])
        const tp = providers.find(p => p.active_for_text)
        setTextProvider(tp)
        setProvidersConfigured(providers.length > 0 && !!tp)
      } catch (e) { if (e?.message) toast.error(e.message) }
      finally { clearTimeout(timer); setLoading(false) }
    })()
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  // Public pages don't need the sidebar
  if (pathname === '/login') return <html><head><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#7C3AED" /><meta name="apple-mobile-web-app-capable" content="yes" /></head><body>{children}</body></html>

  if (loading) return (
    <html><head><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#7C3AED" /><meta name="apple-mobile-web-app-capable" content="yes" /></head><body className="bg-background text-foreground">
      <div className="flex items-center justify-center h-screen text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    </body></html>
  )

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2E5339" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-background text-foreground">
        <ErrorBoundary>
        <div className="flex h-screen w-full overflow-hidden">
          <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
            <div className="px-5 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-sm">
                  <span className="font-display text-sm font-bold text-white">S</span>
                </div>
                <div>
                  <div className="studio-title text-lg text-foreground">Studio</div>
                  <div className="studio-mono text-[0.5rem] text-muted-foreground">creator command</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => router.push(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === key
                      ? 'bg-gradient-to-r from-[#7C3AED]/10 to-[#EC4899]/10 text-[#7C3AED] shadow-sm border border-[#7C3AED]/15'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${pathname === key ? 'text-[#7C3AED]' : ''}`} />
                  <span className="flex-1 text-left">{label}</span>
                  {key === '/commcenter' && commUnread > 0 && (
                    <span className="h-5 min-w-5 px-1 rounded-full bg-[#EF4444] text-white text-[0.55rem] font-bold flex items-center justify-center">{commUnread}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="px-3 pb-3">
              <button
                onClick={async () => {
                  try {
                    const [j, audit] = await Promise.all([
                      api('/jobs').catch(() => []),
                      api('/audit?limit=5').catch(() => []),
                    ])
                    const failures = j.filter(x => x.status === 'failed').length
                    const pending = j.filter(x => x.status === 'pending_approval').length
                    const recent = audit.slice(0, 3).map(a => `${a.action} — ${a.entity_type}`)
                    toast.info(`📊 ${pending} pending · ${failures} failed\n` + recent.join('\n'), { duration: 5000 })
                  } catch {}
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </button>
              <button
                onClick={() => router.push('/help')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
              >
                <HelpCircle className="h-4 w-4" />
                Help
              </button>
              <button
                onClick={() => router.push('/changelog')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
              >
                <FileText className="h-4 w-4" />
                Build Log
              </button>
              <button
                onClick={() => router.push('/settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === '/settings' ? 'bg-gradient-to-r from-[#7C3AED]/10 to-[#EC4899]/10 text-[#7C3AED] shadow-sm border border-[#7C3AED]/15' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
                {!providersConfigured && (
                  <span className="ml-auto studio-mono text-[0.5rem] text-[#D97706] bg-[#D97706]/10 border border-[#D97706]/20 px-1.5 py-0.5 rounded-full">SETUP</span>
                )}
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all mt-1">
                <X className="h-4 w-4" /> Logout
              </button>
            </div>
            {activeStyle && (
              <div className="mx-3 mb-3 p-3 rounded-lg bg-gradient-to-br from-[#7C3AED]/5 to-[#EC4899]/5 border border-[#7C3AED]/10">
                <div className="studio-eyebrow mb-1">Active style</div>
                <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
                  {activeStyle.name}
                </div>
              </div>
            )}
          </aside>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        </ErrorBoundary>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
