import React, { useState } from 'react'
import type { User } from '../../domain/ticket'
import { loginUser, requestPasswordReset } from '../../services/authApi'

export function LoginScreen({
  onSuccess,
  onBack,
  onResetPasswordToken,
}: {
  onSuccess: (user: User) => void
  onBack: () => void
  onResetPasswordToken?: (token: string) => void
}) {
  const [mode, setMode] = useState<'login' | 'forgot_password'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const user = await loginUser(email.trim(), password)
      onSuccess(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your work email address.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await requestPasswordReset(email.trim())
      setForgotSent(true)
      if (res.devResetToken) {
        setDevToken(res.devResetToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f5] text-[#0b131b]">
      {/* ── Topbar ── */}
      <header className="h-16 border-b border-[#e2e8e5] bg-white px-6 sm:px-12 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0b131b] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            N
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] tracking-tight text-[#0b131b] leading-tight">
              Nvara Media
            </span>
            <span className="text-[11.5px] font-medium text-[#5a6e7f] leading-tight">
              Internal Operations
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5a6e7f] hover:text-[#0b131b] px-3 py-1.5 rounded-lg border border-[#cbd5d0] hover:bg-[#f4f6f5] transition-colors cursor-pointer select-none shadow-2xs"
        >
          <span>←</span>
          <span>Portal Home</span>
        </button>
      </header>

      {/* ── Main Hero & Experience ── */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 sm:py-16">
        <div className="max-w-[1040px] w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* ── Left Editorial Identity ── */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ecfdf5] border border-[#d1fae5] text-[12px] font-semibold text-[#065f46]">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>Internal Operations Workspace</span>
            </div>

            <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-[#0b131b] leading-[1.2]">
              Manage client requirements, assign specialists, and keep delivery on track.
            </h1>

            <p className="text-[14.5px] text-[#5a6e7f] leading-relaxed max-w-[480px]">
              Secure internal command center for project managers and specialists to monitor SLA windows, triage service requests, and fulfill client commitments.
            </p>

            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2.5 text-[13px] text-[#2c3e50] font-medium">
                <span className="w-5 h-5 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center text-[12px] font-bold">
                  ✓
                </span>
                <span>Multi-domain client operations queue</span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px] text-[#2c3e50] font-medium">
                <span className="w-5 h-5 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center text-[12px] font-bold">
                  ✓
                </span>
                <span>24-hour acknowledgement SLA monitoring</span>
              </div>
              <div className="flex items-center gap-2.5 text-[13px] text-[#2c3e50] font-medium">
                <span className="w-5 h-5 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center text-[12px] font-bold">
                  ✓
                </span>
                <span>Role-based team access and assignment</span>
              </div>
            </div>
          </div>

          {/* ── Right Card ── */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-[440px] bg-white rounded-2xl border border-[#e2e8e5] p-8 sm:p-9 shadow-md">
              {mode === 'login' ? (
                <>
                  <div className="mb-7">
                    <div className="w-9 h-9 rounded-xl bg-[#0b131b] text-white flex items-center justify-center font-bold text-sm mb-4 shadow-xs">
                      N
                    </div>
                    <h2 className="text-[20px] font-bold tracking-tight text-[#0b131b]">
                      Sign in to Operations
                    </h2>
                    <p className="text-[13px] text-[#5a6e7f] mt-1">
                      Enter your internal credentials to access the workspace.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mb-5 p-3.5 rounded-xl bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium flex items-start gap-2.5 animate-toast"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-0.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="leading-snug">{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-[12.5px] font-bold text-[#2c3e50] mb-1.5"
                      >
                        Work Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pm@nvaramedia.com"
                        className="w-full h-11 px-3.5 rounded-xl border border-[#cbd5d0] bg-white text-[13.5px] text-[#0b131b] placeholder:text-[#8da0b0] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 outline-none transition-all disabled:bg-[#f4f6f5] disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="password"
                          className="block text-[12.5px] font-bold text-[#2c3e50]"
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setForgotSent(false)
                            setMode('forgot_password')
                          }}
                          className="text-[12px] font-semibold text-[#059669] hover:text-[#047857] transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          disabled={loading}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#cbd5d0] bg-white text-[13.5px] text-[#0b131b] placeholder:text-[#8da0b0] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 outline-none transition-all disabled:bg-[#f4f6f5] disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5a6e7f] hover:text-[#0b131b] transition-colors cursor-pointer select-none"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-11 rounded-xl text-[14px] font-bold bg-[#0b131b] hover:bg-[#152332] active:bg-[#000000] text-white border border-[#0b131b] shadow-xs transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer flex items-center justify-center gap-2"
                      >
                        {loading ? 'Signing in…' : 'Sign in'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="w-9 h-9 rounded-xl bg-[#ecfdf5] text-[#059669] border border-[#d1fae5] flex items-center justify-center font-bold text-sm mb-4 shadow-xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l1.5 1.5L13 10l-1.5-1.5L10 10l1.5 1.5L10 13l-1.5-1.5L7 13l1.5 1.5L7 16" />
                        <circle cx="7.5" cy="7.5" r="5.5" />
                      </svg>
                    </div>
                    <h2 className="text-[20px] font-bold tracking-tight text-[#0b131b]">
                      Reset Your Password
                    </h2>
                    <p className="text-[13px] text-[#5a6e7f] mt-1">
                      Enter your work email and we will generate instructions to reset your password.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="mb-5 p-3.5 rounded-xl bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium flex items-start gap-2.5"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-0.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="leading-snug">{error}</span>
                    </div>
                  )}

                  {forgotSent ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#d1fae5] text-[13px] text-[#065f46] space-y-2">
                        <p className="font-semibold">Reset instructions generated</p>
                        <p className="text-[#047857] leading-relaxed">
                          If that email is associated with an active account, password reset instructions have been created with a 15-minute validity window.
                        </p>
                      </div>

                      {devToken && onResetPasswordToken && (
                        <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] block">
                            Development Utility
                          </span>
                          <button
                            type="button"
                            onClick={() => onResetPasswordToken(devToken)}
                            className="w-full py-2 px-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
                          >
                            Open Password Reset Page →
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setForgotSent(false)
                          setMode('login')
                        }}
                        className="w-full h-11 rounded-xl text-[13.5px] font-bold border border-[#cbd5d0] bg-white hover:bg-[#f4f6f5] text-[#2c3e50] transition-colors cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotSubmit} className="space-y-4">
                      <div>
                        <label
                          htmlFor="forgotEmail"
                          className="block text-[12.5px] font-bold text-[#2c3e50] mb-1.5"
                        >
                          Work Email Address
                        </label>
                        <input
                          id="forgotEmail"
                          type="email"
                          required
                          disabled={loading}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="pm@nvaramedia.com"
                          className="w-full h-11 px-3.5 rounded-xl border border-[#cbd5d0] bg-white text-[13.5px] text-[#0b131b] placeholder:text-[#8da0b0] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 outline-none transition-all"
                        />
                      </div>

                      <div className="pt-2 space-y-2.5">
                        <button
                          type="submit"
                          disabled={loading || !email.trim()}
                          className="w-full h-11 rounded-xl text-[14px] font-bold bg-[#0b131b] hover:bg-[#152332] active:bg-[#000000] text-white border border-[#0b131b] shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {loading ? 'Sending…' : 'Send Reset Link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setMode('login')
                          }}
                          className="w-full h-10 text-[13px] font-semibold text-[#5a6e7f] hover:text-[#0b131b] transition-colors cursor-pointer"
                        >
                          Cancel and return to sign in
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              <p className="mt-6 text-center text-[11.5px] text-[#8da0b0]">
                Access restricted to authorized Nvara Media personnel.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

