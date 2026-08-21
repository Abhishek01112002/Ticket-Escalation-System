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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="matrix-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="matrix-title" className="text-lg font-bold text-white">
              Role & Permissions Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Access control and privilege boundaries across Nvara Operations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close permissions matrix"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {PERMISSIONS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {group.category}
              </h3>
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-medium">
                    <tr>
                      <th className="p-3">Capability</th>
                      <th className="p-3 text-center w-28">Specialist</th>
                      <th className="p-3 text-center w-32">Project Manager</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {group.items.map((item) => (
                      <tr key={item.name} className="hover:bg-slate-800/20">
                        <td className="p-3">
                          <span className="font-medium text-white block">{item.name}</span>
                          <span className="text-[11px] text-slate-400">{item.desc}</span>
                        </td>
                        <td className="p-3 text-center">
                          {item.specialist ? (
                            <span className="inline-block w-5 h-5 rounded-full bg-emerald-950/60 text-emerald-400 text-center leading-5 font-bold border border-emerald-800/50">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded-full bg-slate-800 text-slate-500 text-center leading-5">
                              —
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.pm ? (
                            <span className="inline-block w-5 h-5 rounded-full bg-purple-950/60 text-purple-400 text-center leading-5 font-bold border border-purple-800/50">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-block w-5 h-5 rounded-full bg-slate-800 text-slate-500 text-center leading-5">
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
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  )
}
