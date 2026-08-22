import React from 'react'

interface PermissionsMatrixModalProps {
  isOpen: boolean
  onClose: () => void
}

interface PermissionItem {
  name: string
  specialist: string
  pm: string
  desc: string
}

const PERMISSIONS: { category: string; items: PermissionItem[] }[] = [
  {
    category: 'Operations Queue & Triage',
    items: [
      {
        name: 'View Operations Queue',
        specialist: '✓',
        pm: '✓',
        desc: 'View incoming and in-progress client requests within organization',
      },
      {
        name: 'Acknowledge Request SLA',
        specialist: 'Assigned only ✓',
        pm: '✓ Direct + Override',
        desc: 'Acknowledge request receipt within the 24-hour SLA window',
      },
      {
        name: 'Resolve Request',
        specialist: 'Assigned only ✓',
        pm: '✓ Direct + Override',
        desc: 'Provide resolution notes and mark active deliverables resolved',
      },
      {
        name: 'Assign & Reassign Specialists',
        specialist: '—',
        pm: '✓',
        desc: 'Assign tickets to specialists or rebalance workload across team',
      },
      {
        name: 'Operational Workflow Override',
        specialist: '—',
        pm: '✓',
        desc: 'Perform permitted workflow actions on behalf of the assigned specialist',
      },
    ],
  },
  {
    category: 'Team & Identity Administration',
    items: [
      {
        name: 'View Team Directory & Workload',
        specialist: '✓ Read-only',
        pm: '✓',
        desc: 'View organization team members, availability, and SLA metrics',
      },
      {
        name: 'Invite & Onboard Team Members',
        specialist: '—',
        pm: '✓',
        desc: 'Generate 7-day cryptographic invite links or provision credentials',
      },
      {
        name: 'Change Roles & Permissions',
        specialist: '—',
        pm: '✓',
        desc: 'Promote specialists or assign administrative roles with self-lockout protection',
      },
      {
        name: 'Deactivate / Reactivate Accounts',
        specialist: '—',
        pm: '✓',
        desc: 'Deactivate members with PM-directed ticket reassignment and immediate session revocation',
      },
      {
        name: 'View Compliance Audit Trail',
        specialist: '—',
        pm: '✓',
        desc: 'Access immutable organizational audit timeline with search and retention controls',
      },
    ],
  },
]

function renderBadge(text: string, isPmCol: boolean) {
  if (text === '—') {
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#f1f5f9] text-[#94a3b8] font-bold text-xs">
        —
      </span>
    )
  }

  if (isPmCol) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#eef2ff] text-[#4338ca] border border-[#c7d2fe] font-semibold text-[11px]">
        {text}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#ecfdf5] text-[#065f46] border border-[#d1fae5] font-semibold text-[11px]">
      {text}
    </span>
  )
}

export const PermissionsMatrixModal: React.FC<PermissionsMatrixModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
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
              Verified access control and privilege boundaries across Nvara Operations.
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
                      <th className="p-3 text-center w-36">Specialist</th>
                      <th className="p-3 text-center w-40">Project Manager</th>
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
                          {renderBadge(item.specialist, false)}
                        </td>
                        <td className="p-3 text-center">
                          {renderBadge(item.pm, true)}
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
