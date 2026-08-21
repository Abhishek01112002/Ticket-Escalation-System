import React, { useEffect, useState } from 'react'
import { listAuditLogs, type AuditLogEntry } from '../../services/userManagementApi'

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    <div className="space-y-4">
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
        <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden divide-y divide-[#e2e8f0] shadow-xs">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-[#f8fafc] transition-colors flex items-start gap-4 text-xs">
              <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center font-mono font-bold text-[11px] text-[#475569] shrink-0 mt-0.5">
                {log.actorType === 'system' ? 'SYS' : 'USR'}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#0f172a] text-[13px]">{log.actorName}</span>
                  {log.actorEmail && (
                    <span className="text-[#64748b] font-mono text-[11px]">({log.actorEmail})</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getEventBadge(
                      log.eventType
                    )}`}
                  >
                    {String(log.eventType || 'EVENT').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-[#475569] text-[11px] font-mono bg-[#f8fafc] px-2.5 py-1.5 rounded border border-[#e2e8f0]">
                  {JSON.stringify(log.metadata)}
                </div>
              </div>
              <span className="text-[11.5px] font-medium text-[#64748b] shrink-0">
                {new Date(log.occurredAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
