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
  const [pageSize, setPageSize] = useState(6)

  // Selected Member for Detail Drawer
  const [selectedMember, setSelectedMember] = useState<OrganizationUser | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Invite Modal States
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteUserInput>({
    displayName: '',
    email: '',
    phoneWhatsapp: '',
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
          phoneWhatsapp: '',
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
      showToast(res.message || 'Member deactivated and workload updated.', 'success')
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
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#0f172a] tracking-tight">Team Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f1f5f9] border border-[#cbd5e1] text-[#334155]">
              {users.length} members
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-1 font-normal">
            Manage organization members, assign roles, monitor SLA compliance, and audit mutations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Toggle - Only visible to Project Managers */}
          {isPm && (
            <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-[#cbd5e1] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveView('members')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeView === 'members'
                    ? 'bg-white text-[#0f172a] font-bold shadow-xs border border-[#cbd5e1]'
                    : 'text-[#64748b] hover:text-[#0f172a] font-semibold'
                }`}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => setActiveView('audit')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeView === 'audit'
                    ? 'bg-white text-[#0f172a] font-bold shadow-xs border border-[#cbd5e1]'
                    : 'text-[#64748b] hover:text-[#0f172a] font-semibold'
                }`}
              >
                Audit Trail
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMatrixOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Permissions Matrix</span>
          </button>

          {isPm && (
            <button
              type="button"
              onClick={() => {
                setInviteForm({
                  displayName: '',
                  email: '',
                  phoneWhatsapp: '',
                  role: 'internal_team_member',
                  mode: 'invite_link',
                  initialPassword: '',
                })
                setInviteModalOpen(true)
              }}
              className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <div className="text-[11.5px] text-[#64748b] font-bold uppercase tracking-wider">Active Members</div>
              <div className="text-3xl font-extrabold text-[#0f172a] mt-1">{activeCount}</div>
              <div className="text-[12px] text-[#047857] font-semibold mt-0.5">Ready for incident triage</div>
            </div>
            <div className="p-5 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <div className="text-[11.5px] text-[#64748b] font-bold uppercase tracking-wider">Project Managers</div>
              <div className="text-3xl font-extrabold text-[#6d28d9] mt-1">{pmCount}</div>
              <div className="text-[12px] text-[#64748b] font-medium mt-0.5">Admin &amp; escalation access</div>
            </div>
            <div className="p-5 bg-white border border-[#e2e8f0] rounded-2xl shadow-xs">
              <div className="text-[11.5px] text-[#64748b] font-bold uppercase tracking-wider">Operations Specialists</div>
              <div className="text-3xl font-extrabold text-[#0f766e] mt-1">{specialistCount}</div>
              <div className="text-[12px] text-[#64748b] font-medium mt-0.5">Active triage executors</div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#e2e8f0] shadow-xs">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email... (Press / to focus)"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#0f172a] focus:bg-white focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2 text-xs text-[#64748b] hover:text-[#0f172a] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0f172a] focus:border-[#0f172a] focus:bg-white focus:outline-none cursor-pointer"
                aria-label="Filter by role"
              >
                <option value="all">All Roles</option>
                <option value="project_manager">Project Managers</option>
                <option value="internal_team_member">Specialists</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3 py-2 text-xs font-semibold text-[#0f172a] focus:border-[#0f172a] focus:bg-white focus:outline-none cursor-pointer"
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
                <div key={i} className="h-16 bg-[#f1f5f9] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#cbd5e1] rounded-2xl bg-white">
              <p className="text-sm font-bold text-[#0f172a]">No team members match your criteria</p>
              <p className="text-xs text-[#64748b] mt-1">Try clearing search filters or invite a new member.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[#475569] border-b border-[#e2e8f0] text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">Member</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Workload</th>
                      <th className="p-4">SLA Compliance</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9] text-[#334155]">
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
                          className="hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar user={{ name: u.displayName, initials }} size="sm" />
                              <div>
                                <div className="font-bold text-[#0f172a] group-hover:text-[#059669] transition-colors flex items-center gap-1.5 text-[13.5px]">
                                  <span>{u.displayName}</span>
                                  {u.id === currentUser.id && (
                                    <span className="text-[10px] bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] px-1.5 py-0.2 rounded font-mono font-bold">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11.5px] text-[#64748b] font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="p-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-bold border ${
                                u.role === 'project_manager'
                                  ? 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]'
                                  : 'bg-[#f0fdfa] text-[#0f766e] border-[#99f6e4]'
                              }`}
                            >
                              {u.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-bold border ${
                                u.isActive
                                  ? 'bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]'
                                  : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.isActive ? 'bg-[#059669] animate-pulse' : 'bg-[#94a3b8]'
                                }`}
                              />
                              {u.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="text-[#0f172a] font-bold text-[13px]">
                              {u.activeAssignmentsCount}{' '}
                              <span className="text-[#64748b] text-[11.5px] font-normal">active</span>
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-[13.5px] ${
                                  u.slaComplianceRate >= 95
                                    ? 'text-[#047857]'
                                    : u.slaComplianceRate >= 80
                                    ? 'text-[#b45309]'
                                    : 'text-[#b91c1c]'
                                }`}
                              >
                                {u.slaComplianceRate}%
                              </span>
                              <span className="text-[11px] text-[#64748b] font-medium">on-time</span>
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
                                      className="px-2.5 py-1 bg-[#fff1f2] hover:bg-[#ffe4e6] text-[#be123c] border border-[#fecdd3] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReactivate(u)}
                                      className="px-2.5 py-1 bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] border border-[#a7f3d0] rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                    >
                                      Reactivate
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedMember(u)}
                                className="px-3 py-1 bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
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
              {totalPages > 1 || totalItems > 6 ? (
                <div className="px-5 py-3.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-[12px] text-[#64748b]">
                    <span>
                      Showing <strong className="text-[#0f172a] font-bold">{startIdx + 1}–{endIdx}</strong> of{' '}
                      <strong className="text-[#0f172a] font-bold">{totalItems}</strong> members
                    </span>
                    <span className="text-[#cbd5e1]">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Per page:</span>
                      <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                        className="h-7 px-2 rounded-lg border border-[#cbd5e1] bg-white text-[11.5px] font-bold text-[#0f172a] focus:border-[#0f172a] outline-none cursor-pointer"
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-7.5 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] text-[12px] font-bold hover:bg-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer select-none shadow-2xs"
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
                              ? 'bg-[#0f172a] text-white shadow-xs'
                              : 'border border-[#cbd5e1] bg-white text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
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
                      className="h-7.5 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] text-[12px] font-bold hover:bg-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer select-none shadow-2xs"
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
        isPm={isPm}
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
      {/* Add Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#0f172a]">Add Team Member</h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Onboard a new specialist or manager to your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-[#64748b] hover:text-[#0f172a] p-1.5 rounded-lg hover:bg-[#e2e8f0] transition-colors cursor-pointer"
                aria-label="Close add member modal"
              >
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4">
              {/* Mode Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#334155]">Onboarding Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, mode: 'invite_link' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      inviteForm.mode === 'invite_link'
                        ? 'bg-[#ecfdf5] border-[#059669] text-[#065f46] font-semibold shadow-xs'
                        : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <span className="block font-bold">Invite Link</span>
                    <span className="text-[10px] opacity-80">One-time secure onboarding</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteForm((prev) => ({ ...prev, mode: 'instant_password' }))}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      inviteForm.mode === 'instant_password'
                        ? 'bg-[#ecfdf5] border-[#059669] text-[#065f46] font-semibold shadow-xs'
                        : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <span className="block font-bold">Temp Password</span>
                    <span className="text-[10px] opacity-80">Direct account creation</span>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="invite-display-name" className="block text-xs font-semibold text-[#334155] mb-1">
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
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#0f172a] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="invite-email" className="block text-xs font-semibold text-[#334155] mb-1">
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
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#0f172a] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="invite-phone" className="block text-xs font-semibold text-[#334155] mb-1">
                  WhatsApp Phone Number <span className="text-[#64748b] font-normal">(for task briefings)</span>
                </label>
                <input
                  id="invite-phone"
                  type="tel"
                  value={inviteForm.phoneWhatsapp || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    setInviteForm((prev) => ({ ...prev, phoneWhatsapp: val }))
                  }}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#059669] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="block text-xs font-semibold text-[#334155] mb-1">
                  System Role
                </label>
                <select
                  id="invite-role"
                  value={inviteForm.role}
                  onChange={(e) => {
                    const val = e.target.value as any
                    setInviteForm((prev) => ({ ...prev, role: val }))
                  }}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#0f172a] focus:border-[#0f172a] focus:bg-white focus:outline-none"
                >
                  <option value="internal_team_member">Operations Specialist (Queue Execution)</option>
                  <option value="project_manager">Project Manager (Admin &amp; Assignment)</option>
                </select>
              </div>

              {inviteForm.mode === 'instant_password' && (
                <div>
                  <label htmlFor="invite-password" className="block text-xs font-semibold text-[#334155] mb-1">
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
                    className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-xl px-3.5 py-2 text-xs font-medium text-[#0f172a] placeholder-[#94a3b8] focus:border-[#0f172a] focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-[#ecfdf5] border border-[#d1fae5] text-[#059669] flex items-center justify-center text-lg font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0f172a]">Team Member Created</h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                {inviteResult.mode === 'invite_link'
                  ? `Share this one-time onboarding link with ${inviteResult.displayName}:`
                  : `Credentials generated for ${inviteResult.displayName}:`}
              </p>
            </div>

            {inviteResult.mode === 'invite_link' && inviteResult.inviteUrl && (
              <div className="space-y-2">
                <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl flex items-center justify-between gap-2">
                  <code className="text-xs font-mono font-bold text-[#059669] break-all select-all">
                    {inviteResult.inviteUrl}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteResult.inviteUrl!)}
                  className="w-full py-2 bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#065f46] border border-[#d1fae5] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {copiedLink ? '✓ Copied to clipboard!' : 'Copy Invite Link'}
                </button>
              </div>
            )}

            {inviteResult.mode === 'instant_password' && inviteResult.temporaryPassword && (
              <div className="space-y-2">
                <div className="p-3.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl space-y-1">
                  <div className="text-[11px] font-semibold text-[#64748b]">Temporary Login Password</div>
                  <div className="text-sm font-mono font-bold text-[#059669] select-all">
                    {inviteResult.temporaryPassword}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteResult.temporaryPassword!)}
                  className="w-full py-2 bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#065f46] border border-[#d1fae5] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {copiedLink ? '✓ Copied to clipboard!' : 'Copy Password'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setInviteResult(null)}
              className="w-full py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Deactivation & Workload Rebalancer Modal */}
      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#fff1f2] border border-[#ffe4e6] text-[#e11d48] flex items-center justify-center font-bold text-lg">
                !
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0f172a]">
                  Deactivate {deactivateTarget.displayName}
                </h2>
                <p className="text-xs text-[#64748b]">Revoke access &amp; manage active ticket assignments.</p>
              </div>
            </div>

            <p className="text-xs text-[#334155] leading-relaxed">
              This will immediately terminate all active sessions for{' '}
              <strong className="text-[#0f172a] font-mono font-bold">{deactivateTarget.email}</strong>.
            </p>

            {deactivateTarget.activeAssignmentsCount > 0 && (
              <div className="p-3.5 bg-[#fffbeb] border border-[#fef3c7] rounded-xl space-y-2.5 text-xs">
                <div className="font-bold text-[#92400e] flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Active Workload Detected</span>
                  <span>({deactivateTarget.activeAssignmentsCount} open tickets)</span>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[#0f172a] font-medium">
                    <input
                      type="radio"
                      name="reassign"
                      checked={reassignOption === 'unassign'}
                      onChange={() => setReassignOption('unassign')}
                      className="text-[#059669] focus:ring-0 cursor-pointer"
                    />
                    <span>Release tickets back to Unassigned Queue</span>
                  </label>

                  {otherActiveSpecialists.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer text-[#0f172a] font-medium">
                      <input
                        type="radio"
                        name="reassign"
                        checked={reassignOption === 'reassign'}
                        onChange={() => setReassignOption('reassign')}
                        className="text-[#059669] focus:ring-0 cursor-pointer"
                      />
                      <span>Reassign all open tickets to another specialist:</span>
                    </label>
                  )}
                </div>

                {reassignOption === 'reassign' && otherActiveSpecialists.length > 0 && (
                  <select
                    value={reassignToUserId}
                    onChange={(e) => setReassignToUserId(e.target.value)}
                    className="w-full mt-1.5 bg-white border border-[#cbd5e1] rounded-lg p-2 text-xs font-semibold text-[#0f172a] focus:border-[#0f172a] focus:outline-none"
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
                className="px-4 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#e11d48] hover:bg-[#be123c] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
