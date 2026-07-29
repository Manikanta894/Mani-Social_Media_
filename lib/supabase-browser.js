// Browser-side Supabase client (anon key, cookie-based session).
// Never import this in server-side code.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ghqakcbyqqxolavwfepe.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

let _client = null

export function supabaseBrowser() {
  if (typeof window === 'undefined') throw new Error('supabaseBrowser() can only be called in the browser')
  if (_client) return _client
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'socialforge-auth',
      flowType: 'pkce',
    },
  })
  return _client
}
