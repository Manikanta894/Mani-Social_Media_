'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { Sparkles, Calendar as CalendarIcon, ImageIcon, BarChart3, MessageSquare,
  Settings as SettingsIcon, Wand2, List, Radio, Globe, Sun, X, PlugZap, Loader2, Hash,
  HelpCircle, FileText } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { api } from '@/components/shared'
import './globals.css'

const NAV_ITEMS = [
  { key: '/',          label: 'Dashboard', icon: ImageIcon },
  { key: '/compose',   label: 'Compose',   icon: Sparkles },
  { key: '/calendar',  label: 'Schedule',  icon: CalendarIcon },
  { key: '/automation',label: 'Automation',icon: Wand2 },
  { key: '/analytics', label: 'Analytics', icon: BarChart3 },
  { key: '/bulk',      label: 'Bulk Posts',icon: List },
  { key: '/comments',  label: 'Inbox',     icon: MessageSquare },
  { key: '/news',      label: 'News Radar',icon: Radio },
  { key: '/blog',      label: 'Blog',      icon: Globe },
  { key: '/seasonal',  label: 'Seasonal',  icon: Sun },
  { key: '/hashtags',  label: 'Hashtags',  icon: Hash },
]

export default function RootLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStyle, setActiveStyle] = useState(null)
  const [textProvider, setTextProvider] = useState(null)
  const [providersConfigured, setProvidersConfigured] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession()
      if (!data?.session) { router.replace('/login'); return }
      setUser(data.session.user)
      try {
        const [providers, styles] = await Promise.all([
          api('/providers'), api('/prompt-styles'),
        ])
        setActiveStyle(styles.find(s => s.is_active) || styles[0])
        const tp = providers.find(p => p.active_for_text)
        setTextProvider(tp)
        setProvidersConfigured(providers.length > 0 && !!tp)
      } catch (e) { toast.error(e.message) }
      finally { setLoading(false) }
    })()
  }, [])

  const handleLogout = async () => {
    await supabaseBrowser().auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  // Public pages don't need the sidebar
  if (pathname === '/login') return <html><head><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#2E5339" /><meta name="apple-mobile-web-app-capable" content="yes" /></head><body>{children}</body></html>

  if (loading) return (
    <html><head><link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#2E5339" /><meta name="apple-mobile-web-app-capable" content="yes" /></head><body className="bg-background text-foreground">
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
        <div className="flex h-screen w-full overflow-hidden">
          <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground">
            <div className="px-5 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-sm bg-primary flex items-center justify-center">
                  <span className="font-serif text-sm font-bold text-primary-foreground">D</span>
                </div>
                <div>
                  <div className="font-serif font-semibold text-base tracking-tight text-foreground">The Desk</div>
                  <div className="editorial-mono text-[0.625rem] text-muted-foreground">editorial command</div>
                </div>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => router.push(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                    pathname === key
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="px-3 pb-3">
              <button
                onClick={() => router.push('/help')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                Help
              </button>
              <button
                onClick={() => router.push('/changelog')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              >
                <FileText className="h-4 w-4" />
                Build Log
              </button>
              <button
                onClick={() => router.push('/settings')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  pathname === '/settings' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
                {!providersConfigured && (
                  <span className="ml-auto editorial-mono text-[0.5rem] text-flag border border-flag/40 px-1 py-0.5 rounded-sm">SETUP</span>
                )}
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-sm text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors mt-1">
                <X className="h-4 w-4" /> Logout
              </button>
            </div>
            {activeStyle && (
              <div className="mx-3 mb-3 p-3 rounded-sm border border-border bg-card">
                <div className="editorial-eyebrow mb-1">Active style</div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  {activeStyle.name}
                </div>
              </div>
            )}
          </aside>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
