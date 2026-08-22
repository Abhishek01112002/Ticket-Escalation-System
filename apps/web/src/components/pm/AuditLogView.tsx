import React, { useEffect, useState, useMemo } from 'react'
import {
  listAuditLogs,
  deleteAuditLog,
  purgeAuditLogs,
  type AuditLogEntry,
  type AuditLogPagination,
} from '../../services/userManagementApi'

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
    case 'request_created':
    case 'assigned':
    case 'reassigned':
    case 'acknowledged':
    case 'work_started':
    case 'resolved':
    case 'request_deleted':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
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
  const m = (log.metadata || {}) as Record<string, any>
  const target = String(m.displayName || m.email || m.targetEmail || 'Team Member')
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
    case 'request_created':
      return {
        icon,
        headline: (
          <span>
            Client request intake recorded in operations queue.
          </span>
        ),
      }
    case 'assigned':
    case 'reassigned':
      return {
        icon,
        headline: (
          <span>
            Request {log.eventType === 'reassigned' ? 'reassigned' : 'assigned'} to internal specialist. 24-hour acknowledgement SLA initiated.
          </span>
        ),
      }
    case 'acknowledged':
      return {
        icon,
        headline: (
          <span>
            Assigned specialist confirmed acknowledgement within SLA window.
          </span>
        ),
      }
    case 'work_started':
      return {
        icon,
        headline: (
          <span>
            Active execution started on ticket deliverables.
          </span>
        ),
      }
    case 'resolved':
      return {
        icon,
        headline: (
          <span>
            Request resolved and marked complete with immutable compliance record.
          </span>
        ),
      }
    case 'request_deleted':
      return {
        icon,
        headline: (
          <span>
            Resolved request soft-deleted by Project Manager. Audit history retained.
          </span>
        ),
      }
    default:
      return {
        icon,
        headline: (
          <span>
            Administrative event <span className="font-mono font-semibold text-[#0f172a]">{log.eventType}</span> recorded.
          </span>
        ),
      }
  }
}

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    limit: 8,
    totalCount: 0,
    totalPages: 1,
    hasMore: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Filters & State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'user' | 'role' | 'security' | 'workflow'>('all')
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<AuditLogEntry | null>(null)
  const [purgeModalOpen, setPurgeModalOpen] = useState(false)
  const [purgeOption, setPurgeOption] = useState<'30' | '90' | 'all'>('30')
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchLogs = async (page = pagination.page, limit = pagination.limit) => {
    try {
      setLoading(true)
      setError(null)
      const res = await listAuditLogs({
        page,
        limit,
        search: debouncedSearch,
        eventType: categoryFilter === 'all' ? undefined : categoryFilter,
      })
      setLogs(res.logs)
      setPagination(res.pagination)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(1, pagination.limit)
  }, [debouncedSearch, categoryFilter, pagination.limit])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    fetchLogs(newPage, pagination.limit)
  }

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteAuditLog(deleteTarget.id)
      setActionSuccess(`Audit record ${deleteTarget.id.slice(0, 8)} removed from active view.`)
      setDeleteTarget(null)
      setTimeout(() => setActionSuccess(null), 3500)
      await fetchLogs(pagination.page, pagination.limit)
    } catch (err: any) {
      setError(err.message || 'Failed to delete audit record.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePurgeLogs = async () => {
    if (purgeOption === 'all' && purgeConfirmText.trim().toUpperCase() !== 'PURGE') return
    setIsDeleting(true)
    try {
      const res = await purgeAuditLogs(
        purgeOption === 'all'
          ? { all: true }
          : { olderThanDays: parseInt(purgeOption, 10) }
      )
      setActionSuccess(`Successfully purged ${res.purgedCount} historical audit records.`)
      setPurgeModalOpen(false)
      setPurgeConfirmText('')
      setTimeout(() => setActionSuccess(null), 4000)
      await fetchLogs(1, pagination.limit)
    } catch (err: any) {
      setError(err.message || 'Failed to purge audit records.')
    } finally {
      setIsDeleting(false)
    }
  }

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
      case 'request_created':
      case 'assigned':
      case 'reassigned':
      case 'acknowledged':
      case 'work_started':
      case 'resolved':
        return 'bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]'
      default:
        return 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]'
    }
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#e2e8f0]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[#0f172a]">Compliance Audit Trail</h2>
            <span className="text-[10.5px] font-mono font-bold bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded border border-[#e2e8f0]">
              {pagination.totalCount} Records
            </span>
          </div>
          <p className="text-[12px] text-[#64748b] mt-0.5">
            Immutable log of identity, security, and operational workflow mutations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Purge / Prune Retention Action */}
          <button
            type="button"
            onClick={() => {
              setPurgeConfirmText('')
              setPurgeModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#fff1f2] text-[#e11d48] border border-[#fecdd3] rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Prune or purge historical audit records"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Purge History</span>
          </button>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => fetchLogs(pagination.page, pagination.limit)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div className="p-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl text-xs font-medium text-[#065f46] flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-[#065f46] hover:opacity-75 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-2.5 text-[#94a3b8]"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, email, or event detail..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-white rounded-lg border border-[#cbd5e1] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none text-[#0f172a] placeholder-[#94a3b8] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-[#94a3b8] hover:text-[#0f172a] text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All Events' },
              { id: 'user', label: 'User Lifecycle' },
              { id: 'role', label: 'Roles & Access' },
              { id: 'security', label: 'Security & Auth' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border ${
                categoryFilter === tab.id
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-[#64748b] border-[#cbd5e1] hover:bg-[#f8fafc]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-2.5 py-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-[#f1f5f9] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-[#fff1f2] border border-[#ffe4e6] rounded-xl text-xs font-medium text-[#9f1239]">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#cbd5e1] rounded-2xl bg-[#f8fafc]">
          <p className="text-sm font-medium text-[#64748b]">No compliance audit records found.</p>
          {debouncedSearch && (
            <p className="text-xs text-[#94a3b8] mt-1">Try clearing your search query or filters.</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden divide-y divide-[#f1f5f9] shadow-xs">
          {logs.map((log) => {
            const { headline, icon } = formatEventSummary(log)
            const isJsonExpanded = expandedLogId === log.id

            return (
              <div key={log.id} className="p-4 hover:bg-[#f8fafc] transition-colors flex flex-col gap-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center text-[13px] shrink-0 mt-0.5 shadow-2xs">
                      {icon}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-[13px] text-[#1e293b] leading-snug">
                        {headline}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-[#64748b]">
                        <span>Actor: <strong className="text-[#0f172a]">{log.actorName}</strong></span>
                        {log.actorEmail && (
                          <span className="font-mono text-[11px] text-[#64748b]">({log.actorEmail})</span>
                        )}
                        <span>·</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9.5px] font-bold border uppercase tracking-wider ${getEventBadge(
                            log.eventType
                          )}`}
                        >
                          {String(log.eventType || 'EVENT').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-[#64748b]">
                      {new Date(log.occurredAt).toLocaleString()}
                    </span>

                    {/* Raw JSON Inspector */}
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

                    {/* Delete Individual Log Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(log)}
                      className="p-1 rounded text-[#94a3b8] hover:text-[#e11d48] hover:bg-[#fff1f2] transition-colors cursor-pointer border border-transparent hover:border-[#fecdd3]"
                      title="Delete record from active view"
                      aria-label="Delete audit record"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expandable JSON Inspector Drawer */}
                {isJsonExpanded && (
                  <div className="mt-2 p-3.5 rounded-lg bg-[#0f172a] text-[#f8fafc] font-mono text-[11.5px] overflow-x-auto border border-[#1e293b] animate-fade-in shadow-inner select-text">
                    <div className="flex items-center justify-between text-[#94a3b8] text-[10.5px] mb-2 pb-1.5 border-b border-[#334155]">
                      <span>Audit Record ID: {log.id}</span>
                      <span>actor_type: {log.actorType}</span>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && logs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-[#e2e8f0] text-xs text-[#64748b]">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pagination.limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10)
                setPagination((prev) => ({ ...prev, limit: newLimit }))
              }}
              className="px-2 py-1 bg-white border border-[#cbd5e1] rounded-md text-xs font-semibold text-[#0f172a] focus:border-[#2563eb] outline-none cursor-pointer"
            >
              <option value="8">8</option>
              <option value="16">16</option>
              <option value="32">32</option>
            </select>

            <span className="text-[#94a3b8]">|</span>

            <span>
              Showing{' '}
              <strong className="text-[#0f172a]">
                {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalCount)}
              </strong>
              –
              <strong className="text-[#0f172a]">
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
              </strong>{' '}
              of <strong className="text-[#0f172a]">{pagination.totalCount}</strong> audit events
            </span>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="px-2.5 py-1 rounded border border-[#cbd5e1] bg-white text-[#334155] font-semibold hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                .map((p, idx, arr) => {
                  const prevPage = arr[idx - 1]
                  const showEllipsis = prevPage && p - prevPage > 1

                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1 text-[#94a3b8]">...</span>}
                      <button
                        type="button"
                        onClick={() => handlePageChange(p)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors cursor-pointer ${
                          pagination.page === p
                            ? 'bg-[#0f172a] text-white'
                            : 'bg-white text-[#334155] border border-[#cbd5e1] hover:bg-[#f8fafc]'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  )
                })}
            </div>

            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="px-2.5 py-1 rounded border border-[#cbd5e1] bg-white text-[#334155] font-semibold hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Single Log Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-labelledby="delete-log-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#cbd5e1] p-5 space-y-4 text-left font-sans animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#fff1f2] border border-[#ffe4e6] text-[#e11d48] flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 id="delete-log-modal-title" className="text-sm font-bold text-[#0f172a]">
                  Delete Audit Log Entry
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Are you sure you want to remove this record from the active compliance view?
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-[#64748b]">Record ID:</span>
                <span className="font-bold text-[#0f172a] truncate max-w-[200px]">{deleteTarget.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Event Type:</span>
                <span className="font-bold text-[#059669]">{deleteTarget.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748b]">Timestamp:</span>
                <span className="text-[#334155]">{new Date(deleteTarget.occurredAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="text-[11.5px] text-[#64748b] bg-[#fffbeb] p-2.5 rounded-lg border border-[#fef3c7]">
              <strong>Compliance Notice:</strong> This operation applies a verified soft-delete timestamp. Historical audit integrity and cryptographic payload immutability are permanently retained.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSingle}
                className="px-4 py-2 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Purge History Safeguard Modal ── */}
      {purgeModalOpen && (
        <div
          role="dialog"
          aria-labelledby="purge-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#cbd5e1] p-5 space-y-4 text-left font-sans animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#fff1f2] border border-[#ffe4e6] text-[#e11d48] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 id="purge-modal-title" className="text-sm font-bold text-[#0f172a]">
                  Compliance Retention & Purge
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Select an archival retention threshold or purge old organizational audit records.
                </p>
              </div>
            </div>

            {/* Retention Strategy Radio Options */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#334155] block">Select Retention Policy:</label>
              {[
                { id: '30', label: 'Prune records older than 30 days', desc: 'Retains all active compliance logs from the last month.' },
                { id: '90', label: 'Prune records older than 90 days', desc: 'Standard enterprise quarter-retention policy.' },
                { id: 'all', label: 'Purge all current audit logs', desc: 'Clears all active entries from the organization timeline.' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    purgeOption === opt.id
                      ? 'border-[#e11d48] bg-[#fff1f2]/30'
                      : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="purgeOption"
                    value={opt.id}
                    checked={purgeOption === opt.id}
                    onChange={() => setPurgeOption(opt.id as any)}
                    className="mt-0.5 text-[#e11d48] focus:ring-[#e11d48]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#0f172a] block">{opt.label}</span>
                    <span className="text-[11px] text-[#64748b] block">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Confirmation verification for Purge All */}
            {purgeOption === 'all' && (
              <div className="space-y-1.5 p-3 rounded-lg bg-[#fff1f2] border border-[#fecdd3]">
                <label htmlFor="confirm-purge-input" className="block text-xs font-bold text-[#9f1239]">
                  Type <span className="font-mono underline">PURGE</span> to authorize full audit trail cleanup:
                </label>
                <input
                  id="confirm-purge-input"
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="PURGE"
                  className="w-full text-xs px-3 py-2 rounded-md border border-[#fca5a5] focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48] outline-none text-[#0f172a] bg-white font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPurgeModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-[#cbd5e1] text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || (purgeOption === 'all' && purgeConfirmText.trim().toUpperCase() !== 'PURGE')}
                onClick={handlePurgeLogs}
                className="px-4 py-2 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Purging Records...' : 'Execute Retention Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
