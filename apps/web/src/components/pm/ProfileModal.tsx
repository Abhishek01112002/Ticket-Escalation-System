import React, { useEffect, useState } from 'react'
import type { User } from '../../domain/ticket'
import {
  changePassword,
  listUserSessions,
  revokeOtherSessions,
  type UserSession,
} from '../../services/authApi'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { Avatar } from '../ui/layout'
import { XIcon } from '../ui/icons'
import { PasswordStrengthMeter } from '../ui/PasswordStrengthMeter'

type ProfileTab = 'details' | 'password' | 'sessions'

export function ProfileModal({
  user,
  onClose,
}: {
  user: User
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('details')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sessions state
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsMsg, setSessionsMsg] = useState<string | null>(null)

  useEscapeKey(true, onClose)

  useEffect(() => {
    if (activeTab === 'sessions') {
      loadSessions()
    }
  }, [activeTab])

  const loadSessions = async () => {
    try {
      setSessionsLoading(true)
      const data = await listUserSessions()
      setSessions(data)
    } catch {
      // Ignore session loading errors
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleRevokeOthers = async () => {
    try {
      setSessionsLoading(true)
      const result = await revokeOtherSessions()
      setSessionsMsg(result.message)
      await loadSessions()
    } catch (err: any) {
      setSessionsMsg(err.message || 'Failed to revoke other sessions.')
    } finally {
      setSessionsLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      setError('Please enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const msg = await changePassword(currentPassword, newPassword)
      setSuccessMsg(msg)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar user={{ name: user.name, initials: user.initials }} size="md" />
            <div>
              <h2 id="profile-title" className="text-base font-bold text-text-primary">
                {user.name}
              </h2>
              <p className="text-xs text-text-muted">{user.team || 'Nvara Operations Workspace'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-elevated rounded-xl transition-colors"
            aria-label="Close profile modal"
          >
            <XIcon />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border bg-surface-elevated/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Account Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'password'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Security & Password
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Active Devices ({sessions.length || '•'})
          </button>
        </div>

        {/* Tab 1: Account Details */}
        {activeTab === 'details' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-surface-elevated border border-border rounded-xl">
                <span className="text-[11px] text-text-muted block">Full Name</span>
                <span className="text-xs font-semibold text-text-primary mt-0.5 block">
                  {user.name}
                </span>
              </div>
              <div className="p-3.5 bg-surface-elevated border border-border rounded-xl">
                <span className="text-[11px] text-text-muted block">System Role</span>
                <span className="text-xs font-semibold text-brand mt-0.5 block capitalize">
                  {user.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-surface-elevated border border-border rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Organization Workspace</span>
                <span className="font-semibold text-text-primary">{user.team}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted">Internal Account ID</span>
                <span className="font-mono text-[11px] text-text-muted">{user.id}</span>
              </div>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl text-xs text-emerald-300">
              🔒 Authenticated via enterprise Scrypt-hashed credentials with zero-knowledge token management.
            </div>
          </div>
        )}

        {/* Tab 2: Change Password */}
        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300" role="alert">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300" role="status">
                {successMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="current-password" className="block text-xs font-medium text-text-muted mb-1">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter existing password"
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="profile-new-password" className="block text-xs font-medium text-text-muted mb-1">
                  New Password
                </label>
                <input
                  id="profile-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  required
                />
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-medium text-text-muted mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    className="rounded border-border bg-surface-elevated text-brand focus:ring-0"
                  />
                  <span>Show passwords</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-brand hover:bg-brand/90 text-text-inverse rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Active Devices & Sessions */}
        {activeTab === 'sessions' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary block">Active Logins</span>
                <span className="text-[11px] text-text-muted">
                  Devices currently authenticated with your account.
                </span>
              </div>
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={sessionsLoading}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
              >
                Sign out other devices
              </button>
            </div>

            {sessionsMsg && (
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-300">
                {sessionsMsg}
              </div>
            )}

            {sessionsLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-surface-elevated rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 bg-surface-elevated border border-border rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">{sess.userAgent}</span>
                        {sess.isCurrent && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            Current Device
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        IP: <code className="font-mono">{sess.ipAddress}</code> · Last active{' '}
                        {new Date(sess.lastSeenAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
