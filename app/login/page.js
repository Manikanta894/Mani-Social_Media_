'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabaseBrowser, syncSessionCookie, hasSessionCookie } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [step, setStep] = useState('login')
  const [loading, setLoading] = useState(false)
  const [enrollData, setEnrollData] = useState(null)

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (data?.session) {
        const synced = syncSessionCookie(data.session)
        if (!synced) return
        supabaseBrowser().auth.mfa.listFactors().then(({ data: mfa }) => {
          const enrolled = mfa?.all?.filter(f => f.status === 'verified') || []
          if (enrolled.length === 0) setStep('enroll')
          else window.location.href = '/'
        })
      }
    })
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    // Client-side rate limit check
    const rlKey = 'sf_login_attempts'
    const raw = localStorage.getItem(rlKey)
    let rl = null
    try { rl = raw ? JSON.parse(raw) : null } catch { rl = null }
    if (rl && Date.now() - rl.start < 15 * 60 * 1000 && rl.count >= 5) {
      toast.error('Too many attempts. Try again in 15 minutes.')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
      if (error) {
        // Track failed attempt
        const now = Date.now()
        if (rl && now - rl.start < 15 * 60 * 1000) {
          rl.count++
          localStorage.setItem(rlKey, JSON.stringify(rl))
        } else {
          localStorage.setItem(rlKey, JSON.stringify({ count: 1, start: now }))
        }
        toast.error(error.message); return
      }

      // Clear rate limit on success
      localStorage.removeItem(rlKey)

      // Audit log (best-effort)
      fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, success: true }) }).catch(() => {})

      // Check MFA
      const { data: mfa } = await supabaseBrowser().auth.mfa.listFactors().catch(() => ({ data: null }))
      const verified = mfa?.all?.filter(f => f.status === 'verified') || []

      if (verified.length > 0) {
        setStep('mfa')
        return
      }

      // No MFA enrolled yet — prompt to set up
      setStep('enroll')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const handleMfa = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { session } } = await supabaseBrowser().auth.getSession()
      if (!session) { toast.error('No session — please sign in again'); setStep('login'); return }

      const { data: mfa } = await supabaseBrowser().auth.mfa.listFactors().catch(() => ({ data: null }))
      const verified = mfa?.all?.filter(f => f.status === 'verified') || []
      if (verified.length === 0) { toast.error('No MFA factors enrolled'); setStep('login'); return }

      const factorId = verified[0].id
      const { data: challenge, error: challengeErr } = await supabaseBrowser().auth.mfa.challenge({ factorId })
      if (challengeErr) { toast.error(challengeErr.message); return }

      const { error: verifyErr } = await supabaseBrowser().auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode,
      })
      if (verifyErr) { toast.error('Invalid code'); return }

      syncSessionCookie(); window.location.href = '/'
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const handleEnroll = async () => {
    setLoading(true)
    try {
      const res = await supabaseBrowser().auth.mfa.enroll({ factorType: 'totp', issuer: 'SocialForge', friendlyName: 'SocialForge MFA' })
      if (res.error) { toast.error(res.error.message); return }
      setEnrollData({ id: res.data.id, totp: res.data.totp })
      setStep('enrolled')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const handleVerifyEnroll = async () => {
    if (!totpCode || !enrollData) return
    setLoading(true)
    try {
      const { data: challenge, error: challengeErr } = await supabaseBrowser().auth.mfa.challenge({ factorId: enrollData.id })
      if (challengeErr) { toast.error(challengeErr.message); return }

      const { error: verifyErr } = await supabaseBrowser().auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challenge.id,
        code: totpCode,
      })
      if (verifyErr) { toast.error(verifyErr.message); return }

      toast.success('TOTP enrolled successfully')
      syncSessionCookie(); window.location.href = '/'
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const enrollMfaLater = () => { window.location.href = '/' }

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

        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className={inputClass} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className={inputClass} />
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:from-[#6D28D9] hover:to-[#DB2777] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={handleMfa} className="space-y-4">
            <div style={{ color: '#57534e' }} className="text-sm mb-2">Enter the 6-digit code from your authenticator app.</div>
            <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} required className={inputClass + " text-center text-lg tracking-widest"} />
            <button type="submit" disabled={loading || totpCode.length !== 6}
              className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:from-[#6D28D9] hover:to-[#DB2777] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        {step === 'enroll' && !enrollData && (
          <div className="text-center space-y-4">
            <div style={{ color: '#57534e' }} className="text-sm">Secure your account with two-factor authentication.</div>
            <button onClick={handleEnroll} disabled={loading}
              className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:from-[#6D28D9] hover:to-[#DB2777] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Preparing…' : 'Set up TOTP Authenticator'}
            </button>
            <button onClick={enrollMfaLater} className="text-xs underline" style={{ color: '#a8a29e' }}>Skip for now</button>
          </div>
        )}

        {step === 'enrolled' && enrollData && (
          <div className="space-y-4">
            <div style={{ color: '#57534e' }} className="text-sm">Scan this QR code with your authenticator app, then enter the 6-digit code.</div>
            {enrollData.totp?.qr_code && (
              <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }} />
            )}
            {enrollData.totp?.secret && (
              <div className="bg-[#F4F4F9] rounded-lg p-3 text-center">
                <div className="text-[10px] uppercase mb-1" style={{ color: '#a8a29e' }}>Or enter this key manually</div>
                <code className="text-xs font-mono break-all" style={{ color: '#44403c' }}>{enrollData.totp.secret}</code>
              </div>
            )}
            <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} className={inputClass + " text-center text-lg tracking-widest"} />
            <button onClick={handleVerifyEnroll} disabled={loading || totpCode.length !== 6}
              className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:from-[#6D28D9] hover:to-[#DB2777] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify & Complete'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
