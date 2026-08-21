import React, { useEffect, useRef, useState } from 'react'
import type { User } from '../../domain/ticket'
import {
  inviteOrganizationUser,
  listOrganizationUsers,
  updateOrganizationUser,
  type InviteUserInput,
  type OrganizationUser,
} from '../../services/userManagementApi'
import { Avatar } from '../ui/layout'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { XIcon } from '../ui/icons'
import { MemberDetailDrawer } from './MemberDetailDrawer'
import { PermissionsMatrixModal } from './PermissionsMatrixModal'
import { AuditLogView } from './AuditLogView'

export function TeamManagement({
  currentUser,
  showToast,
}: {
  currentUser: User
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [activeView, setActiveView] = useState<'members' | 'audit'>('members')
  const [users, setUsers] = useState<OrganizationUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'project_manager' | 'internal_team_member'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Pagination state
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(8)

  // Selected Member for Detail Drawer
  const [selectedMember, setSelectedMember] = useState<OrganizationUser | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Invite Modal States
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteUserInput>({
    displayName: '',
    email: '',
    role: 'internal_team_member',
    mode: 'invite_link',
    initialPassword: '',
  })
  const [inviteResult, setInviteResult] = useState<{
    mode: 'invite_link' | 'instant_password'
    inviteUrl?: string
    temporaryPassword?: string
    email: string
    displayName: string
  } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Deactivation confirmation modal state with Workload Rebalancing
  const [deactivateTarget, setDeactivateTarget] = useState<OrganizationUser | null>(null)
  const [reassignOption, setReassignOption] = useState<'unassign' | 'reassign'>('unassign')
  const [reassignToUserId, setReassignToUserId] = useState<string>('')
  const [actionLoading, setActionLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isPm = currentUser.role === 'project_manager'

  useEscapeKey(inviteModalOpen || Boolean(deactivateTarget) || Boolean(inviteResult) || matrixOpen, () => {
    setInviteModalOpen(false)
    setDeactivateTarget(null)
    setInviteResult(null)
    setMatrixOpen(false)
  })

  // Linear-style global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInputActive =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (e.key === '/' && !isInputActive) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if ((e.key === 'n' || e.key === 'N') && !isInputActive && !inviteModalOpen && isPm) {
        e.preventDefault()
        setInviteForm({
          displayName: '',
          email: '',
          role: 'internal_team_member',
          mode: 'invite_link',
          initialPassword: '',
        })
        setInviteModalOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inviteModalOpen, isPm])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await listOrganizationUsers()
      setUsers(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load team members.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteForm.displayName.trim() || !inviteForm.email.trim()) {
      showToast('Please provide both name and email.', 'error')
      return
    }

    setInviteLoading(true)
    try {
      const res = await inviteOrganizationUser(inviteForm)
      setInviteResult({
        mode: res.mode,
        inviteUrl: res.inviteUrl,
        temporaryPassword: res.temporaryPassword,
        email: inviteForm.email,
        displayName: inviteForm.displayName,
      })
      setInviteModalOpen(false)
      setInviteForm({
        displayName: '',
        email: '',
        role: 'internal_team_member',
        mode: 'invite_link',
        initialPassword: '',
      })
      await loadUsers()
      showToast(res.message || 'Team member added.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to invite team member.', 'error')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRoleChange = async (member: OrganizationUser, newRole: 'project_manager' | 'internal_team_member') => {
    if (member.id === currentUser.id) {
      showToast('You cannot change your own administrative role.', 'error')
      return
    }

    try {
      const res = await updateOrganizationUser(member.id, { role: newRole })
      showToast(res.message || 'Role updated successfully.', 'success')
      await loadUsers()
      if (selectedMember && selectedMember.id === member.id) {
        setSelectedMember({ ...selectedMember, role: newRole })
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role.', 'error')
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return
    setActionLoading(true)

    try {
      const reassignId = reassignOption === 'reassign' && reassignToUserId ? reassignToUserId : null
      const res = await updateOrganizationUser(deactivateTarget.id, {
        isActive: false,
        reassignToUserId: reassignId,
      })
      showToast(res.message || 'Member deactivated and workload rebalanced.', 'success')
      setDeactivateTarget(null)
      setSelectedMember(null)
      await loadUsers()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate member.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async (member: OrganizationUser) => {
    try {
      const res = await updateOrganizationUser(member.id, { isActive: true })
      showToast(res.message || 'Team member reactivated successfully.', 'success')
      await loadUsers()
      if (selectedMember && selectedMember.id === member.id) {
        setSelectedMember({ ...selectedMember, isActive: true })
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reactivate member.', 'error')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const otherActiveSpecialists = users.filter(
    (u) => u.isActive && u.id !== deactivateTarget?.id && u.role === 'internal_team_member'
  )

  const activeCount      = users.filter((u) => u.isActive).length
  const pmCount          = users.filter((u) => u.isActive && u.role === 'project_manager').length
  const specialistCount  = users.filter((u) => u.isActive && u.role === 'internal_team_member').length

  // Pagination derived values
  const totalItems  = filteredUsers.length
  const totalPages  = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIdx    = (currentPage - 1) * pageSize
  const endIdx      = Math.min(startIdx + pageSize, totalItems)
  const pagedUsers  = filteredUsers.slice(startIdx, endIdx)

  // Reset to page 1 whenever the filter criteria change
  useEffect(() => { setPage(1) }, [search, roleFilter, statusFilter, pageSize])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Team Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-elevated border border-border text-text-muted">
              {users.length} members
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Manage organization members, assign roles, monitor SLA compliance, and audit mutations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Toggle */}
          <div className="flex bg-surface-elevated p-1 rounded-xl border border-border text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveView('members')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeView === 'members'
                  ? 'bg-surface text-brand font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Directory
            </button>
            <button
              type="button"
              onClick={() => setActiveView('audit')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeView === 'audit'
                  ? 'bg-surface text-brand font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Audit Trail
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMatrixOpen(true)}
            className="px-3.5 py-2 bg-surface-elevated hover:bg-border text-text-primary border border-border rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>🛡️ Permissions Matrix</span>
          </button>

          {isPm && (
            <button
              type="button"
              onClick={() => {
                setInviteForm({
                  displayName: '',
                  email: '',
                  role: 'internal_team_member',
                  mode: 'invite_link',
                  initialPassword: '',
                })
                setInviteModalOpen(true)
              }}
              className="px-4 py-2 bg-brand hover:bg-brand/90 text-text-inverse rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>+ Add Team Member</span>
            </button>
          )}
        </div>
      </div>

      {activeView === 'audit' ? (
        <AuditLogView />
      ) : (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 bg-surface-elevated border border-border rounded-2xl">
              <div className="text-[11px] text-text-muted font-medium">Active Members</div>
              <div className="text-2xl font-bold text-text-primary mt-1">{activeCount}</div>
              <div className="text-[11px] text-brand mt-0.5">Ready for incident triage</div>
            </div>
            <div className="p-4 bg-surface-elevated border border-border rounded-2xl">
              <div className="text-[11px] text-text-muted font-medium">Project Managers</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">{pmCount}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Admin & escalation access</div>
            </div>
            <div className="p-4 bg-surface-elevated border border-border rounded-2xl">
              <div className="text-[11px] text-text-muted font-medium">Operations Specialists</div>
              <div className="text-2xl font-bold text-teal-400 mt-1">{specialistCount}</div>
              <div className="text-[11px] text-text-muted mt-0.5">Active triage executors</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-elevated/40 p-2.5 rounded-2xl border border-border">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email... (Press / to focus)"
                className="w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2 text-xs text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
                aria-label="Filter by role"
              >
                <option value="all">All Roles</option>
                <option value="project_manager">Project Managers</option>
                <option value="internal_team_member">Specialists</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-surface-elevated rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-surface-elevated/20">
              <p className="text-sm font-semibold text-text-primary">No team members match your criteria</p>
              <p className="text-xs text-text-muted mt-1">Try clearing search filters or invite a new member.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated/60 text-text-muted border-b border-border font-medium">
                    <tr>
                      <th className="p-4">Member</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Workload</th>
                      <th className="p-4">SLA Compliance</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text-secondary">
                    {pagedUsers.map((u) => {
                      const initials = u.displayName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()

                      return (
                        <tr
                          key={u.id}
                          onClick={() => setSelectedMember(u)}
                          className="hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar user={{ name: u.displayName, initials }} size="sm" />
                              <div>
                                <div className="font-semibold text-text-primary group-hover:text-brand transition-colors flex items-center gap-1.5">
                                  <span>{u.displayName}</span>
                                  {u.id === currentUser.id && (
                                    <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.2 rounded font-mono font-medium">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-text-muted font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                u.role === 'project_manager'
                                  ? 'bg-purple-950/50 text-purple-300 border-purple-800/60'
                                  : 'bg-teal-950/50 text-teal-300 border-teal-800/60'
                              }`}
                            >
                              {u.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                u.isActive
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                }`}
                              />
                              {u.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="text-text-primary font-medium">
                              {u.activeAssignmentsCount}{' '}
                              <span className="text-text-muted text-[11px]">active</span>
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  u.slaComplianceRate >= 95
                                    ? 'text-emerald-400'
                                    : u.slaComplianceRate >= 80
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {u.slaComplianceRate}%
                              </span>
                              <span className="text-[10px] text-text-muted font-normal">on-time</span>
                            </div>
                          </td>

                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {isPm && u.id !== currentUser.id && (
                                <>
                                  {u.isActive ? (
                                    <button
                                      type="button"
                                      onClick={() => setDeactivateTarget(u)}
                                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReactivate(u)}
                                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedMember(u)}
                                className="px-2.5 py-1 bg-surface-elevated hover:bg-border text-text-primary rounded-lg text-xs font-medium transition-colors"
                              >
                                View →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination Footer ─────────────────────────────────── */}
              {totalPages > 1 || totalItems > 8 ? (
                <div className="px-5 py-3.5 border-t border-border bg-surface-elevated/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-[12px] text-text-muted">
                    <span>
                      Showing <strong className="text-text-primary">{startIdx + 1}–{endIdx}</strong> of{' '}
                      <strong className="text-text-primary">{totalItems}</strong> members
                    </span>
                    <span className="text-border">|</span>
                    <div className="flex items-center gap-1.5">
                      <span>Per page:</span>
                      <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                        className="h-7 px-2 rounded-lg border border-border bg-surface text-[11.5px] font-medium text-text-primary focus:border-brand outline-none cursor-pointer"
                      >
                        <option value={8}>8</option>
                        <option value={16}>16</option>
                        <option value={32}>32</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-7.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary text-[12px] font-medium hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer select-none"
                    >
                      ‹ Prev
                    </button>

                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      // Smart windowed page chips
                      let pNum: number
                      if (totalPages <= 7) {
                        pNum = i + 1
                      } else if (currentPage <= 4) {
                        pNum = i + 1
                        if (i === 6) pNum = totalPages
                      } else if (currentPage >= totalPages - 3) {
                        pNum = i === 0 ? 1 : totalPages - 6 + i
                      } else {
                        const map = [1, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2, totalPages]
                        pNum = map[i]
                      }
                      const isActive = pNum === currentPage
                      return (
                        <button
                          key={`pg-${pNum}-${i}`}
                          type="button"
                          onClick={() => setPage(pNum)}
                          className={`w-7.5 h-7.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer select-none flex items-center justify-center ${
                            isActive
                              ? 'bg-brand text-white shadow-xs'
                              : 'border border-border bg-surface text-text-muted hover:bg-surface-elevated hover:text-text-primary'
                          }`}
                        >
                          {pNum}
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-7.5 px-2.5 rounded-lg border border-border bg-surface text-text-primary text-[12px] font-medium hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer select-none"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {/* Slide-over Detail Drawer */}
      <MemberDetailDrawer
        member={selectedMember}
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        onRoleChange={handleRoleChange}
        onDeactivateClick={(m) => {
          setSelectedMember(null)
          setDeactivateTarget(m)
        }}
        onReactivateClick={handleReactivate}
      />

      {/* Permissions Matrix Modal */}
      <PermissionsMatrixModal isOpen={matrixOpen} onClose={() => setMatrixOpen(false)} />

      {/* Add Member / Dual-Mode Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-primary">Add Team Member</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Onboard a new specialist or manager to your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-2 rounded-lg hover:bg-surface-elevated transition-colors"
                aria-label="Close add member modal"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              {/* Mode Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-muted">Onboarding Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, mode: 'invite_link' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      inviteForm.mode === 'invite_link'
                        ? 'bg-brand/10 border-brand text-brand font-semibold'
                        : 'bg-surface-elevated border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="block font-bold">Invite Link</span>
                    <span className="text-[10px] opacity-80">One-time secure onboarding</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, mode: 'instant_password' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      inviteForm.mode === 'instant_password'
                        ? 'bg-brand/10 border-brand text-brand font-semibold'
                        : 'bg-surface-elevated border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="block font-bold">Temp Password</span>
                    <span className="text-[10px] opacity-80">Direct account creation</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="invite-display-name" className="block text-xs font-medium text-text-muted mb-1">
                  Full Name
                </label>
                <input
                  id="invite-display-name"
                  type="text"
                  required
                  value={inviteForm.displayName}
                  onChange={(e) => {
                    const val = e.target.value
                    setInviteForm((prev) => ({ ...prev, displayName: val }))
                  }}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="invite-email" className="block text-xs font-medium text-text-muted mb-1">
                  Work Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => {
                    const val = e.target.value
                    setInviteForm((prev) => ({ ...prev, email: val }))
                  }}
                  placeholder="alex.rivera@nvaramedia.com"
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-xs font-medium text-text-muted mb-1">
                  System Role
                </label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) => {
                    const val = e.target.value as any
                    setInviteForm((prev) => ({ ...prev, role: val }))
                  }}
                  className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary focus:border-brand focus:outline-none"
                >
                  <option value="internal_team_member">Operations Specialist (Queue Execution)</option>
                  <option value="project_manager">Project Manager (Admin & Assignment)</option>
                </select>
              </div>

              {inviteForm.mode === 'instant_password' && (
                <div>
                  <label htmlFor="invite-password" className="block text-xs font-medium text-text-muted mb-1">
                    Initial Password (Optional)
                  </label>
                  <input
                    id="invite-password"
                    type="password"
                    value={inviteForm.initialPassword || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setInviteForm((prev) => ({ ...prev, initialPassword: val }))
                    }}
                    placeholder="Leave blank to auto-generate"
                    className="w-full bg-surface-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-text-primary placeholder-text-muted focus:border-brand focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-border text-text-primary rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-brand hover:bg-brand/90 text-text-inverse rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {inviteLoading ? 'Creating...' : inviteForm.mode === 'invite_link' ? 'Generate Invite Link' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Result Modal (Invite Link or Temp Password with Copy Feedback) */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex items-center justify-center text-lg font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Team Member Created</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {inviteResult.mode === 'invite_link'
                  ? `Share this one-time onboarding link with ${inviteResult.displayName}:`
                  : `Credentials generated for ${inviteResult.displayName}:`}
              </p>
            </div>

            {inviteResult.mode === 'invite_link' && inviteResult.inviteUrl && (
              <div className="space-y-2">
                <div className="p-3 bg-surface-elevated border border-border rounded-xl flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-emerald-400 break-all select-all">
                    {inviteResult.inviteUrl}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteResult.inviteUrl!)}
                  className="w-full py-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  {copiedLink ? '✓ Copied to clipboard!' : 'Copy Invite Link'}
                </button>
              </div>
            )}

            {inviteResult.mode === 'instant_password' && inviteResult.temporaryPassword && (
              <div className="space-y-2">
                <div className="p-3.5 bg-surface-elevated border border-border rounded-xl space-y-1">
                  <div className="text-[11px] text-text-muted">Temporary Login Password</div>
                  <div className="text-sm font-mono font-bold text-emerald-400 select-all">
                    {inviteResult.temporaryPassword}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteResult.temporaryPassword!)}
                  className="w-full py-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  {copiedLink ? '✓ Copied to clipboard!' : 'Copy Password'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setInviteResult(null)}
              className="w-full py-2 bg-surface-elevated hover:bg-border text-text-primary rounded-xl text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Deactivation & Workload Rebalancer Modal */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-rose-900/50 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center font-bold text-lg">
                !
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  Deactivate {deactivateTarget.displayName}
                </h2>
                <p className="text-xs text-text-muted">Revoke access & rebalance active tickets.</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              This will immediately terminate all active sessions for{' '}
              <strong className="text-text-primary font-mono">{deactivateTarget.email}</strong>.
            </p>

            {deactivateTarget.activeAssignmentsCount > 0 && (
              <div className="p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <span>⚠️ Active Workload Detected</span>
                  <span className="font-bold">({deactivateTarget.activeAssignmentsCount} open tickets)</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="reassign"
                      checked={reassignOption === 'unassign'}
                      onChange={() => setReassignOption('unassign')}
                      className="text-brand focus:ring-0"
                    />
                    <span>Release tickets back to Unassigned Queue</span>
                  </label>

                  {otherActiveSpecialists.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="reassign"
                        checked={reassignOption === 'reassign'}
                        onChange={() => setReassignOption('reassign')}
                        className="text-brand focus:ring-0"
                      />
                      <span>Reassign all open tickets to another specialist:</span>
                    </label>
                  )}
                </div>

                {reassignOption === 'reassign' && otherActiveSpecialists.length > 0 && (
                  <select
                    value={reassignToUserId}
                    onChange={(e) => setReassignToUserId(e.target.value)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                    aria-label="Select reassignment specialist"
                  >
                    <option value="">-- Choose Active Specialist --</option>
                    {otherActiveSpecialists.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName} ({s.activeAssignmentsCount} active tickets)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="px-4 py-2 bg-surface-elevated hover:bg-border text-text-primary rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Deactivating...' : 'Deactivate Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
