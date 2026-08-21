import React from 'react'

interface PermissionsMatrixModalProps {
  isOpen: boolean
  onClose: () => void
}

const PERMISSIONS = [
  {
    category: 'Operations Queue & Triage',
    items: [
      { name: 'View Operations Queue', pm: true, specialist: true, desc: 'View incoming and in-progress client requests' },
      { name: 'Acknowledge Request SLA', pm: true, specialist: true, desc: 'Acknowledge request within the designated SLA window' },
      { name: 'Resolve Request', pm: true, specialist: true, desc: 'Provide resolution notes and mark request resolved' },
      { name: 'Assign & Reassign Specialists', pm: true, specialist: false, desc: 'Assign tickets to specialists or rebalance workload' },
      { name: 'Manual SLA Policy Overrides', pm: true, specialist: false, desc: 'Override SLA escalation rules on high-priority tickets' },
    ],
  },
  {
    category: 'Team & Identity Administration',
    items: [
      { name: 'View Team Directory', pm: true, specialist: true, desc: 'View team members, status, and workload metrics' },
      { name: 'Invite & Onboard Team Members', pm: true, specialist: false, desc: 'Generate secure invite links or temporary credentials' },
      { name: 'Change Roles & Permissions', pm: true, specialist: false, desc: 'Promote specialists or demote administrators' },
      { name: 'Deactivate / Reactivate Accounts', pm: true, specialist: false, desc: 'Deactivate members with automatic ticket rebalancing' },
      { name: 'View Compliance Audit Trail', pm: true, specialist: false, desc: 'Access immutable organizational audit timeline' },
    ],
  },
]

export const PermissionsMatrixModal: React.FC<PermissionsMatrixModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="matrix-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <div>
            <h2 id="matrix-title" className="text-[17px] font-bold text-[#0f172a]">
              Role &amp; Permissions Matrix
            </h2>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Access control and privilege boundaries across Nvara Operations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748b] hover:text-[#0f172a] p-2 rounded-lg hover:bg-[#e2e8f0] transition-colors cursor-pointer"
            aria-label="Close permissions matrix"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {PERMISSIONS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                {group.category}
              </h3>
              <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[#475569] border-b border-[#e2e8f0] font-semibold text-[11.5px]">
                    <tr>
                      <th className="p-3">Capability</th>
                      <th className="p-3 text-center w-28">Specialist</th>
                      <th className="p-3 text-center w-32">Project Manager</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] text-[#334155]">
                    {group.items.map((item) => (
                      <tr key={item.name} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="p-3">
                          <span className="font-semibold text-[#0f172a] block">{item.name}</span>
                          <span className="text-[11px] text-[#64748b]">{item.desc}</span>
                        </td>
                        <td className="p-3 text-center">
                          {item.specialist ? (
                            <span className="inline-block w-5 h-5 rounded-full bg-[#ecfdf5] text-[#065f46] text-center leading-5 font-bold border border-[#d1fae5]">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded-full bg-[#f1f5f9] text-[#94a3b8] text-center leading-5">
                              —
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.pm ? (
                            <span className="inline-block w-5 h-5 rounded-full bg-[#eef2ff] text-[#4338ca] text-center leading-5 font-bold border border-[#c7d2fe]">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded-full bg-[#f1f5f9] text-[#94a3b8] text-center leading-5">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  )
}
