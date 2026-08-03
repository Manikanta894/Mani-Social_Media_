'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useSearchParams()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    const rlKey = 'sf_login_attempts'
    let rl = null
    try { rl = JSON.parse(localStorage.getItem(rlKey)) || null } catch { rl = null }
    if (rl && Date.now() - rl.start < 15 * 60 * 1000 && rl.count >= 5) {
      toast.error('Too many attempts. Try again in 15 minutes.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const now = Date.now()
        if (rl && now - rl.start < 15 * 60 * 1000) { rl.count++; localStorage.setItem(rlKey, JSON.stringify(rl)) }
        else localStorage.setItem(rlKey, JSON.stringify({ count: 1, start: now }))
        toast.error('Invalid password')
        return
      }
      localStorage.removeItem(rlKey)
      toast.success('Welcome back')
      window.location.href = params.get('next') || '/'
    } catch (err) { toast.error(err.message) } finally { setLoading(false) }
  }

  const inputClass = "w-full border border-[#E6E6EC] rounded-lg px-4 py-2.5 text-sm text-[#16161D] bg-white placeholder:text-[#6B6A78] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all"

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC]">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.03)] border border-[#E6E6EC] p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#7C3AED]/20">
            <span className="text-white font-bold text-lg font-display">S</span>
          </div>
          <h1 className="text-xl font-bold text-[#16161D] font-display">Studio</h1>
          <p className="text-sm mt-1 text-[#6B6A78]">creator command center</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoFocus className={inputClass} />
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:from-[#6D28D9] hover:to-[#DB2777] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
