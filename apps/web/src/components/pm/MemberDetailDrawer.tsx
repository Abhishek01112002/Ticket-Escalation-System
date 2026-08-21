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
      ? 'text-[#065f46] border-[#d1fae5] bg-[#ecfdf5]'
      : member.slaComplianceRate >= 80
      ? 'text-[#92400e] border-[#fef3c7] bg-[#fffbeb]'
      : 'text-[#9f1239] border-[#ffe4e6] bg-[#fff1f2]'

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#e2e8f0] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0f172a] flex items-center justify-center font-bold text-lg text-white shadow-sm">
                {initials}
              </div>
              <div>
                <h2 id="drawer-title" className="text-[17px] font-bold text-[#0f172a] tracking-tight">
                  {member.displayName}
                </h2>
                <p className="text-[12px] text-[#64748b] font-mono mt-0.5">{member.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      member.role === 'project_manager'
                        ? 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]'
                        : 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
                    }`}
                  >
                    {member.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                      member.isActive
                        ? 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
                        : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        member.isActive ? 'bg-[#059669]' : 'bg-[#94a3b8]'
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
              className="p-1.5 text-[#64748b] hover:text-[#0f172a] rounded-lg hover:bg-[#e2e8f0] transition-colors cursor-pointer"
              aria-label="Close detail drawer"
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Performance Stats Cards */}
            <div>
              <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">
                Workload &amp; SLA Metrics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
                  <span className="text-[11.5px] font-semibold text-[#64748b]">Active Workload</span>
                  <div className="text-2xl font-bold text-[#0f172a] mt-1 flex items-baseline gap-1">
                    {member.activeAssignmentsCount}
                    <span className="text-[11px] font-normal text-[#64748b]">open tickets</span>
                  </div>
                </div>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
                  <span className="text-[11.5px] font-semibold text-[#64748b]">Lifetime Resolved</span>
                  <div className="text-2xl font-bold text-[#059669] mt-1 flex items-baseline gap-1">
                    {member.resolvedAssignmentsCount}
                    <span className="text-[11px] font-normal text-[#64748b]">tickets</span>
                  </div>
                </div>

                <div className={`border rounded-xl p-3.5 ${complianceColor}`}>
                  <span className="text-[11.5px] font-semibold opacity-90">SLA Compliance</span>
                  <div className="text-2xl font-bold mt-1">{member.slaComplianceRate}%</div>
                  <span className="text-[10px] font-medium opacity-80">On-time SLA adherence</span>
                </div>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
                  <span className="text-[11.5px] font-semibold text-[#64748b]">Avg Resolution</span>
                  <div className="text-2xl font-bold text-[#0f172a] mt-1 flex items-baseline gap-1">
                    {member.avgResolutionMinutes}
                    <span className="text-[11px] font-normal text-[#64748b]">mins</span>
                  </div>
                  <span className="text-[10px] text-[#94a3b8]">Mean handling time</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Hub */}
            <div>
              <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-3">
                Administrative Controls
              </h3>
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-[#334155]">Role Privilege</span>
                  <select
                    value={member.role}
                    onChange={(e) =>
                      onRoleChange(member, e.target.value as 'project_manager' | 'internal_team_member')
                    }
                    className="bg-white border border-[#cbd5e1] text-[12px] font-semibold text-[#0f172a] rounded-lg px-2.5 py-1.5 focus:border-[#0f172a] focus:outline-none"
                    aria-label={`Change role for ${member.displayName}`}
                  >
                    <option value="internal_team_member">Operations Specialist</option>
                    <option value="project_manager">Project Manager</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between">
                  <div>
                    <span className="text-[12.5px] font-semibold text-[#334155] block">Account Status</span>
                    <span className="text-[11px] text-[#64748b]">
                      {member.isActive
                        ? 'Active member can sign in and receive tasks'
                        : 'Deactivated account cannot sign in'}
                    </span>
                  </div>
                  {member.isActive ? (
                    <button
                      type="button"
                      onClick={() => onDeactivateClick(member)}
                      className="px-3 py-1.5 bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6] rounded-lg text-[12px] font-bold hover:bg-[#ffe4e6] transition-colors cursor-pointer"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivateClick(member)}
                      className="px-3 py-1.5 bg-[#ecfdf5] text-[#059669] border border-[#d1fae5] rounded-lg text-[12px] font-bold hover:bg-[#d1fae5] transition-colors cursor-pointer"
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
                <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                  Recent Handled Requests
                </h3>
                {recentTickets.length > 0 && (
                  <span className="text-[11px] text-[#475569] bg-[#e2e8f0] px-2 py-0.5 rounded-full font-bold">
                    {recentTickets.length} total
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-[#f1f5f9] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-3 bg-[#fff1f2] border border-[#ffe4e6] rounded-lg text-[12px] text-[#9f1239]">
                  {error}
                </div>
              ) : recentTickets.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-[#cbd5e1] rounded-xl">
                  <p className="text-[12px] text-[#64748b]">No requests assigned yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTickets.map((ticket) => (
                    <div
                      key={ticket.assignmentId}
                      className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl hover:border-[#cbd5e1] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[12px] font-bold text-[#0f172a]">
                          {ticket.reference}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                            ticket.status === 'resolved'
                              ? 'bg-[#ecfdf5] text-[#065f46] border border-[#d1fae5]'
                              : 'bg-[#fffbeb] text-[#92400e] border border-[#fef3c7]'
                          }`}
                        >
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#334155] mt-1 line-clamp-1 font-medium">{ticket.requirement}</p>
                      <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-2">
                        <span className="text-[#475569] font-medium">{ticket.serviceDomain}</span>
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
