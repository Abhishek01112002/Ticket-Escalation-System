import React, { useEffect, useState } from 'react'
import { resetPassword, verifyResetToken } from '../../services/authApi'
import { PasswordStrengthMeter } from '../ui/PasswordStrengthMeter'

export function ResetPasswordScreen({
  token,
  onSuccess,
  onBack,
}: {
  token: string
  onSuccess: () => void
  onBack: () => void
}) {
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let active = true
    if (!token || token.length < 16) {
      setVerifying(false)
      setTokenValid(false)
      return
    }

    verifyResetToken(token).then((isValid) => {
      if (active) {
        setTokenValid(isValid)
        setVerifying(false)
      }
    })

    return () => {
      active = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await resetPassword(token, newPassword)
      setCompleted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.')
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
              Security & Access
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5a6e7f] hover:text-[#0b131b] px-3 py-1.5 rounded-lg border border-[#cbd5d0] hover:bg-[#f4f6f5] transition-colors cursor-pointer select-none shadow-2xs"
        >
          <span>←</span>
          <span>Back to Sign In</span>
        </button>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-[#e2e8e5] p-8 sm:p-9 shadow-md">
          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <svg className="animate-spin mx-auto text-[#059669]" width="28" height="28" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
                <path d="M12 7a5 5 0 01-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-[13.5px] font-medium text-[#5a6e7f]">Verifying password reset link…</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] flex items-center justify-center mx-auto text-xl font-bold">
                ✕
              </div>
              <h2 className="text-[19px] font-bold text-[#0b131b]">Reset Link Expired or Invalid</h2>
              <p className="text-[13px] text-[#5a6e7f] leading-relaxed">
                This password reset link is invalid or has expired for your security. Password reset links expire after 15 minutes.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full h-11 rounded-xl text-[13.5px] font-bold bg-[#0b131b] hover:bg-[#152332] text-white transition-colors cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            </div>
          ) : completed ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-[#ecfdf5] border border-[#d1fae5] text-[#059669] flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h2 className="text-[20px] font-bold text-[#0b131b]">Password Reset Successfully</h2>
              <p className="text-[13px] text-[#5a6e7f] leading-relaxed">
                Your password has been securely updated. Any existing active sessions have been revoked.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={onSuccess}
                  className="w-full h-11 rounded-xl text-[13.5px] font-bold bg-[#059669] hover:bg-[#047857] text-white shadow-xs transition-colors cursor-pointer"
                >
                  Sign In with New Password
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <div className="w-9 h-9 rounded-xl bg-[#0b131b] text-white flex items-center justify-center font-bold text-sm mb-4 shadow-xs">
                  🔒
                </div>
                <h2 className="text-[20px] font-bold tracking-tight text-[#0b131b]">
                  Set New Password
                </h2>
                <p className="text-[13px] text-[#5a6e7f] mt-1">
                  Choose a strong, secure password for your internal account.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 p-3.5 rounded-xl bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[13px] font-medium flex items-start gap-2.5"
                >
                  <span className="flex-none">⚠</span>
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-[12.5px] font-bold text-[#2c3e50] mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      disabled={loading}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-[#cbd5d0] bg-white text-[13.5px] text-[#0b131b] placeholder:text-[#8da0b0] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5a6e7f] hover:text-[#0b131b] transition-colors cursor-pointer select-none"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={newPassword} />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-[12.5px] font-bold text-[#2c3e50] mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#cbd5d0] bg-white text-[13.5px] text-[#0b131b] placeholder:text-[#8da0b0] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/20 outline-none transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full h-11 rounded-xl text-[14px] font-bold bg-[#0b131b] hover:bg-[#152332] active:bg-black text-white border border-[#0b131b] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? 'Updating Password…' : 'Set New Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
