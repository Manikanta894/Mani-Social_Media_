// Browser-side Supabase client (anon key).
// Sessions are persisted to localStorage AND mirrored to a cookie
// so middleware + API routes can verify auth server-side.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ghqakcbyqqxolavwfepe.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const STORAGE_KEY = 'socialforge-auth'
const COOKIE_NAME = 'sb-socialforge-auth-auth-token'

function setCookie(name, value, days = 7) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function clearCookie(name) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

// Storage adapter: localStorage as source of truth + cookie mirror of the JWT
const cookieMirrorStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value) } catch {}
    // Mirror access_token to cookie for server-side auth checks
    if (key.includes('auth-token')) {
      try {
        const parsed = JSON.parse(value)
        if (parsed?.access_token) setCookie(COOKIE_NAME, parsed.access_token)
        else clearCookie(COOKIE_NAME)
      } catch { clearCookie(COOKIE_NAME) }
    }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key) } catch {}
    if (key.includes('auth-token')) clearCookie(COOKIE_NAME)
  },
}

let _client = null

export function supabaseBrowser() {
  if (typeof window === 'undefined') throw new Error('supabaseBrowser() can only be called in the browser')
  if (_client) return _client
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
      storage: cookieMirrorStorage,
      flowType: 'pkce',
    },
  })
  return _client
}

// Sync existing localStorage session into the auth cookie.
// Needed for sessions created before the cookie mirror existed.
export function syncSessionCookie() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(`sb-${STORAGE_KEY}-auth-token`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.access_token) setCookie(COOKIE_NAME, parsed.access_token)
    }
  } catch {}
}