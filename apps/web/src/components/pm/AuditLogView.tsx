import React, { useEffect, useState } from 'react'
import { listAuditLogs, type AuditLogEntry } from '../../services/userManagementApi'

function renderEventIcon(eventType: string) {
  switch (eventType) {
    case 'USER_INVITED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      )
    case 'USER_CREATED':
    case 'USER_ONBOARDED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      )
    case 'USER_DEACTIVATED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    case 'USER_REACTIVATED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    case 'ROLE_CHANGED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      )
    case 'PASSWORD_CHANGED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    case 'PASSWORD_RESET_REQUESTED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5L13 7l1.5 1.5L13 10l-1.5-1.5L10 10l1.5 1.5L10 13l-1.5-1.5L7 13l1.5 1.5L7 16" />
          <circle cx="7.5" cy="7.5" r="5.5" />
        </svg>
      )
    case 'PASSWORD_RESET_COMPLETED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    case 'REMOTE_SESSIONS_REVOKED':
    case 'SESSION_REVOKED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
  }
}

function formatEventSummary(log: AuditLogEntry): { headline: React.ReactNode; icon: React.ReactNode } {
  const m = log.metadata || {}
  const target = m.displayName || m.email || m.targetEmail || 'Team Member'
  const icon = renderEventIcon(log.eventType)

  switch (log.eventType) {
    case 'USER_INVITED':
      return {
        icon,
        headline: (
          <span>
            Generated invite link for <strong className="text-[#0f172a]">{target}</strong> as <span className="font-semibold text-[#4338ca] capitalize">{(m.role || 'specialist').replace('_', ' ')}</span>.
          </span>
        ),
      }
    case 'USER_CREATED':
    case 'USER_ONBOARDED':
      return {
        icon,
        headline: (
          <span>
            Created new team member account for <strong className="text-[#0f172a]">{target}</strong> (<span className="font-medium text-[#059669] capitalize">{(m.role || 'specialist').replace('_', ' ')}</span>).
          </span>
        ),
      }
    case 'USER_DEACTIVATED': {
      const count = Number(m.reassignedCount || m.openAssignmentsCount || 0)
      const strat = m.rebalanceStrategy === 'reassign' ? 'Reassigned to specialist' : 'Released to queue'
      return {
        icon,
        headline: (
          <span>
            Deactivated <strong className="text-[#0f172a]">{target}</strong>. {count > 0 ? `Workload rebalanced: ${count} active ticket(s) (${strat}).` : 'No active tickets were open.'}
          </span>
        ),
      }
    }
    case 'USER_REACTIVATED':
      return {
        icon,
        headline: (
          <span>
            Reactivated <strong className="text-[#0f172a]">{target}</strong> and restored active workspace access.
          </span>
        ),
      }
    case 'ROLE_CHANGED':
      return {
        icon,
        headline: (
          <span>
            Changed authorization role for <strong className="text-[#0f172a]">{target}</strong> from <span className="font-semibold text-[#64748b]">{String(m.oldRole || 'member').replace('_', ' ')}</span> to <span className="font-semibold text-[#059669]">{String(m.newRole || 'pm').replace('_', ' ')}</span>.
          </span>
        ),
      }
    case 'PASSWORD_CHANGED':
      return {
        icon,
        headline: (
          <span>
            User password updated securely with verified cryptographic hash.
          </span>
        ),
      }
    case 'PASSWORD_RESET_REQUESTED':
      return {
        icon,
        headline: (
          <span>
            Issued one-time password reset link for <strong className="text-[#0f172a]">{m.email || target}</strong>.
          </span>
        ),
      }
    case 'PASSWORD_RESET_COMPLETED':
      return {
        icon,
        headline: (
          <span>
            Password reset completed and verified via single-use entropy token.
          </span>
        ),
      }
    case 'REMOTE_SESSIONS_REVOKED':
    case 'SESSION_REVOKED':
      return {
        icon,
        headline: (
          <span>
            Revoked {m.revokedCount ? `${m.revokedCount} ` : ''}active session(s) across connected devices.
          </span>
        ),
      }
    default:
      return {
        icon,
        headline: (
          <span>
            Administrative action <span className="font-mono text-[#0f172a]">{log.eventType}</span> executed.
          </span>
        ),
      }
  }
}

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listAuditLogs()
      setLogs(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'USER_INVITED':
        return 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]'
      case 'USER_CREATED':
      case 'USER_ONBOARDED':
        return 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
      case 'USER_DEACTIVATED':
        return 'bg-[#fff1f2] text-[#9f1239] border-[#ffe4e6]'
      case 'USER_REACTIVATED':
        return 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
      case 'ROLE_CHANGED':
        return 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]'
      case 'PASSWORD_CHANGED':
      case 'PASSWORD_RESET_COMPLETED':
      case 'REMOTE_SESSIONS_REVOKED':
        return 'bg-[#fffbeb] text-[#92400e] border-[#fef3c7]'
      default:
        return 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]'
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-[#0f172a]">Compliance Audit Trail</h2>
          <p className="text-[12px] text-[#64748b] mt-0.5">
            Immutable log of identity and authorization mutations in your organization.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          ↻ Refresh Log
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#f1f5f9] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-[#fff1f2] border border-[#ffe4e6] rounded-xl text-xs font-medium text-[#9f1239]">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#cbd5e1] rounded-2xl bg-[#f8fafc]">
          <p className="text-sm font-medium text-[#64748b]">No administrative audit events recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden divide-y divide-[#f1f5f9] shadow-xs">
          {logs.map((log) => {
            const { headline, icon } = formatEventSummary(log)
            const isJsonExpanded = expandedLogId === log.id

            return (
              <div key={log.id} className="p-4.5 hover:bg-[#f8fafc] transition-colors flex flex-col gap-2.5 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center text-[14px] shrink-0 mt-0.5 shadow-2xs">
                      {icon}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="text-[13px] text-[#334155] leading-snug">
                        {headline}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-[#64748b]">
                        <span>Actor: <strong className="text-[#0f172a]">{log.actorName}</strong></span>
                        {log.actorEmail && (
                          <span className="font-mono text-[11px] text-[#64748b]">({log.actorEmail})</span>
                        )}
                        <span>·</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getEventBadge(
                            log.eventType
                          )}`}
                        >
                          {String(log.eventType || 'EVENT').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] font-medium text-[#64748b]">
                      {new Date(log.occurredAt).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isJsonExpanded ? null : log.id)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer border ${
                        isJsonExpanded
                          ? 'bg-[#0f172a] text-white border-[#0f172a]'
                          : 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0] hover:bg-[#e2e8f0]'
                      }`}
                      title="Inspect raw JSON audit payload"
                    >
                      {'{ } JSON'}
                    </button>
                  </div>
                </div>

                {/* Expandable JSON Inspector Drawer */}
                {isJsonExpanded && (
                  <div className="mt-1 p-3 rounded-xl bg-[#0b131b] text-[#38bdf8] font-mono text-[11.5px] overflow-x-auto border border-[#1e293b] animate-fade-in shadow-inner">
                    <div className="flex items-center justify-between text-[#94a3b8] text-[10.5px] mb-1.5 pb-1.5 border-b border-[#1e293b]">
                      <span>Raw Audit Event: {log.id}</span>
                      <span>actor_type: {log.actorType}</span>
                    </div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
