import React, { useEffect, useState } from 'react'
import {
  type OrganizationUser,
  getMemberDetail,
  type RecentTicket,
} from '../../services/userManagementApi'

interface MemberDetailDrawerProps {
  member: OrganizationUser | null
  isOpen: boolean
  onClose: () => void
  onRoleChange: (member: OrganizationUser, newRole: 'project_manager' | 'internal_team_member') => void
  onDeactivateClick: (member: OrganizationUser) => void
  onReactivateClick: (member: OrganizationUser) => void
}

export const MemberDetailDrawer: React.FC<MemberDetailDrawerProps> = ({
  member,
  isOpen,
  onClose,
  onRoleChange,
  onDeactivateClick,
  onReactivateClick,
}) => {
  const [loading, setLoading] = useState(false)
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !member) return

    let isMounted = true
    setLoading(true)
    setError(null)

    getMemberDetail(member.id)
      .then((data) => {
        if (isMounted) {
          setRecentTickets(data.recentTickets)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load member profile details.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, member])

  if (!isOpen || !member) return null

  const initials = member.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const complianceColor =
    member.slaComplianceRate >= 95
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
      : member.slaComplianceRate >= 80
      ? 'text-amber-400 border-amber-500/30 bg-amber-950/20'
      : 'text-rose-400 border-rose-500/30 bg-rose-950/20'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-emerald-950/50">
                {initials}
              </div>
              <div>
                <h2 id="drawer-title" className="text-lg font-bold text-white tracking-tight">
                  {member.displayName}
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{member.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      member.role === 'project_manager'
                        ? 'bg-purple-950/50 text-purple-300 border-purple-800/60'
                        : 'bg-teal-950/50 text-teal-300 border-teal-800/60'
                    }`}
                  >
                    {member.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      member.isActive
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        member.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    {member.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close detail drawer"
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Performance Stats Cards */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Workload & SLA Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                  <span className="text-xs text-slate-400">Active Workload</span>
                  <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
                    {member.activeAssignmentsCount}
                    <span className="text-xs font-normal text-slate-400">open tickets</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                  <span className="text-xs text-slate-400">Lifetime Resolved</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-baseline gap-1">
                    {member.resolvedAssignmentsCount}
                    <span className="text-xs font-normal text-slate-400">tickets</span>
                  </div>
                </div>

                <div className={`border rounded-xl p-3.5 ${complianceColor}`}>
                  <span className="text-xs opacity-80">SLA Compliance</span>
                  <div className="text-2xl font-bold mt-1">{member.slaComplianceRate}%</div>
                  <span className="text-[10px] opacity-70">On-time SLA adherence</span>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5">
                  <span className="text-xs text-slate-400">Avg Resolution</span>
                  <div className="text-2xl font-bold text-white mt-1 flex items-baseline gap-1">
                    {member.avgResolutionMinutes}
                    <span className="text-xs font-normal text-slate-400">mins</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Mean handling time</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Hub */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Administrative Controls
              </h3>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Role Privilege</span>
                  <select
                    value={member.role}
                    onChange={(e) =>
                      onRoleChange(member, e.target.value as 'project_manager' | 'internal_team_member')
                    }
                    className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    aria-label={`Change role for ${member.displayName}`}
                  >
                    <option value="internal_team_member">Operations Specialist</option>
                    <option value="project_manager">Project Manager</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-300 block">Account Status</span>
                    <span className="text-[11px] text-slate-500">
                      {member.isActive
                        ? 'Active member can sign in and receive tasks'
                        : 'Deactivated account cannot sign in'}
                    </span>
                  </div>
                  {member.isActive ? (
                    <button
                      type="button"
                      onClick={() => onDeactivateClick(member)}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium hover:bg-rose-500/20 transition-colors"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivateClick(member)}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Ticket Activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Recent Handled Requests
                </h3>
                {recentTickets.length > 0 && (
                  <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                    {recentTickets.length} total
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-slate-800/40 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-3 bg-rose-950/20 border border-rose-800/30 rounded-lg text-xs text-rose-300">
                  {error}
                </div>
              ) : recentTickets.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl">
                  <p className="text-xs text-slate-500">No requests assigned yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTickets.map((ticket) => (
                    <div
                      key={ticket.assignmentId}
                      className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-emerald-400">
                          {ticket.reference}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                            ticket.status === 'resolved'
                              ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
                              : 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                          }`}
                        >
                          {ticket.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1">{ticket.requirement}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                        <span className="text-slate-400">{ticket.serviceDomain}</span>
                        <span>Assigned {new Date(ticket.assignedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
