import React, { useEffect, useState } from 'react'
import { listAuditLogs, type AuditLogEntry } from '../../services/userManagementApi'

function formatEventSummary(log: AuditLogEntry): { headline: React.ReactNode; icon: string } {
  const m = log.metadata || {}
  const target = m.displayName || m.email || m.targetEmail || 'Team Member'

  switch (log.eventType) {
    case 'USER_INVITED':
      return {
        icon: '✉️',
        headline: (
          <span>
            Generated invite link for <strong className="text-[#0f172a]">{target}</strong> as <span className="font-semibold text-[#4338ca] capitalize">{(m.role || 'specialist').replace('_', ' ')}</span>.
          </span>
        ),
      }
    case 'USER_CREATED':
    case 'USER_ONBOARDED':
      return {
        icon: '👤',
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
        icon: '⚠️',
        headline: (
          <span>
            Deactivated <strong className="text-[#0f172a]">{target}</strong>. {count > 0 ? `Workload rebalanced: ${count} active ticket(s) (${strat}).` : 'No active tickets were open.'}
          </span>
        ),
      }
    }
    case 'USER_REACTIVATED':
      return {
        icon: '✅',
        headline: (
          <span>
            Reactivated <strong className="text-[#0f172a]">{target}</strong> and restored active workspace access.
          </span>
        ),
      }
    case 'ROLE_CHANGED':
      return {
        icon: '🔄',
        headline: (
          <span>
            Changed authorization role for <strong className="text-[#0f172a]">{target}</strong> from <span className="font-semibold text-[#64748b]">{String(m.oldRole || 'member').replace('_', ' ')}</span> to <span className="font-semibold text-[#059669]">{String(m.newRole || 'pm').replace('_', ' ')}</span>.
          </span>
        ),
      }
    case 'PASSWORD_CHANGED':
      return {
        icon: '🔒',
        headline: (
          <span>
            User password updated securely with verified cryptographic hash.
          </span>
        ),
      }
    case 'PASSWORD_RESET_REQUESTED':
      return {
        icon: '🔑',
        headline: (
          <span>
            Issued one-time password reset link for <strong className="text-[#0f172a]">{m.email || target}</strong>.
          </span>
        ),
      }
    case 'PASSWORD_RESET_COMPLETED':
      return {
        icon: '🛡️',
        headline: (
          <span>
            Password reset completed and verified via single-use entropy token.
          </span>
        ),
      }
    case 'REMOTE_SESSIONS_REVOKED':
    case 'SESSION_REVOKED':
      return {
        icon: '🚪',
        headline: (
          <span>
            Revoked {m.revokedCount ? `${m.revokedCount} ` : ''}active session(s) across connected devices.
          </span>
        ),
      }
    default:
      return {
        icon: '📋',
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
