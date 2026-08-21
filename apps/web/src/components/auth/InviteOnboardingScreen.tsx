import React, { useEffect, useState } from 'react'
import { getInvitationDetails, acceptInvitation, type InvitationDetails } from '../../services/authApi'
import { PasswordStrengthMeter, evaluatePassword } from '../ui/PasswordStrengthMeter'
import type { User } from '../../domain/ticket'

interface InviteOnboardingScreenProps {
  token: string
  onOnboardingComplete: (user: User) => void
  onCancel: () => void
}

export const InviteOnboardingScreen: React.FC<InviteOnboardingScreenProps> = ({
  token,
  onOnboardingComplete,
  onCancel,
}) => {
  const [invite, setInvite] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    getInvitationDetails(token)
      .then((data) => {
        if (isMounted) {
          setInvite(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'This invitation link is invalid or has expired.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    const { score } = evaluatePassword(password)
    if (score < 2) {
      setSubmitError('Please choose a stronger password before proceeding.')
      return
    }

    try {
      setSubmitting(true)
      const user = await acceptInvitation(token, password)
      onOnboardingComplete(user)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to accept invitation. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-xl text-slate-950 shadow-lg shadow-emerald-500/20">
            N
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Join the Operations Workspace
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Complete your account setup to start handling incidents & requests.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {loading ? (
            <div className="space-y-4 py-8 text-center">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Verifying your secure invitation link...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-950/50 border border-rose-800/60 text-rose-400 flex items-center justify-center text-xl mx-auto">
                ✕
              </div>
              <h3 className="text-base font-semibold text-white">Invitation Unavailable</h3>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : invite ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Organization & Role Info Card */}
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Organization</span>
                  <span className="font-semibold text-white">{invite.organizationName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Invited As</span>
                  <span className="font-semibold text-emerald-400">
                    {invite.role === 'project_manager' ? 'Project Manager' : 'Operations Specialist'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Work Email</span>
                  <span className="font-mono text-slate-300">{invite.email}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/60">
                  <span className="text-slate-500 text-[11px]">Invited by</span>
                  <span className="text-slate-400 text-[11px]">{invite.inviterName}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300" role="alert">
                  {submitError}
                </div>
              )}

              {/* Password Inputs */}
              <div>
                <label htmlFor="invite-password" className="block text-xs font-medium text-slate-300">
                  Choose Your Password
                </label>
                <input
                  id="invite-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars with mixed case & numbers"
                  className="mt-1 block w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-white placeholder-slate-500 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <PasswordStrengthMeter password={password} />
              </div>

              <div>
                <label htmlFor="invite-confirm-password" className="block text-xs font-medium text-slate-300">
                  Confirm Password
                </label>
                <input
                  id="invite-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 block w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-white placeholder-slate-500 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Activating Account...' : 'Set Password & Enter Workspace →'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
