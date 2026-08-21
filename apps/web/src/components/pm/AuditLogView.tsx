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
        return 'bg-blue-950/50 text-blue-300 border-blue-800/60'
      case 'USER_CREATED':
      case 'USER_ONBOARDED':
        return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
      case 'USER_DEACTIVATED':
        return 'bg-rose-950/50 text-rose-300 border-rose-800/60'
      case 'USER_REACTIVATED':
        return 'bg-teal-950/50 text-teal-300 border-teal-800/60'
      case 'ROLE_CHANGED':
        return 'bg-purple-950/50 text-purple-300 border-purple-800/60'
      case 'PASSWORD_CHANGED':
      case 'PASSWORD_RESET_COMPLETED':
      case 'REMOTE_SESSIONS_REVOKED':
        return 'bg-amber-950/50 text-amber-300 border-amber-800/60'
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Compliance Audit Trail</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable log of identity and authorization mutations in your organization.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
        >
          ↻ Refresh Log
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-300">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
          <p className="text-sm text-slate-400">No administrative audit events recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/60">
          {logs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-800/20 transition-colors flex items-start gap-4 text-xs">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-slate-300 shrink-0 mt-0.5">
                {log.actorType === 'system' ? 'SYS' : 'USR'}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{log.actorName}</span>
                  {log.actorEmail && (
                    <span className="text-slate-500 font-mono text-[11px]">({log.actorEmail})</span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getEventBadge(
                      log.eventType
                    )}`}
                  >
                    {log.eventType.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] font-mono">
                  {JSON.stringify(log.metadata)}
                </div>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0">
                {new Date(log.occurredAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
