import { useEffect, useState } from 'react'
import type { Request } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatDateTime, formatRemaining, getSlaSummary } from '../../domain/sla'
import { AttentionChip, EscalationDot, StatusBadge } from '../ui/badges'
import { Avatar } from '../ui/layout'
import { EmptyQueue } from '../ui/feedback'

function cleanName(name: string): string {
  return name.replace(/^Demo\s+/i, '')
}

export function RequestQueue({
  requests,
  onOpen,
}: {
  requests: Request[]
  onOpen: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'needs_ack' | 'escalated' | 'in_progress' | 'resolved'>('all')
  const [pageSize, setPageSize] = useState<number>(7)
  const [page, setPage] = useState<number>(1)

  const needsAck = requests.filter((r) => r.workflowStatus === 'awaiting_acknowledgement')
  const escalated = requests.filter((r) => Boolean(r.escalation) && r.workflowStatus !== 'resolved')
  const inProgress = requests.filter((r) => r.workflowStatus === 'in_progress')
  const resolved = requests.filter((r) => r.workflowStatus === 'resolved')

  const filteredRequests = requests.filter((r) => {
    if (filter === 'needs_ack') return r.workflowStatus === 'awaiting_acknowledgement'
    if (filter === 'escalated') return Boolean(r.escalation) && r.workflowStatus !== 'resolved'
    if (filter === 'in_progress') return r.workflowStatus === 'in_progress'
    if (filter === 'resolved') return r.workflowStatus === 'resolved'
    return true
  })

  // Reset to page 1 when filter or page size changes
  useEffect(() => {
    setPage(1)
  }, [filter, pageSize])

  const totalItems = filteredRequests.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex)

  return (
    <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-12 py-8 text-[#0b131b]">
      {/* ── Compact Header & Attention Area ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#e2e8e5]">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[22px] font-bold tracking-tight text-[#0b131b]">
              Operations Queue
            </h1>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#d1fae5]">
              {requests.length - resolved.length} active · {requests.length} total
            </span>
          </div>
          <p className="text-[13.5px] text-[#5a6e7f]">
            Manage client requests, SLA compliance windows, and specialist assignments.
          </p>
        </div>

        {/* Compact Operational Attention Signals */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#8da0b0] mr-1 hidden sm:inline">
            Status:
          </span>
          {escalated.length > 0 ? (
            <AttentionChip count={escalated.length} label="Escalated" color="rose" />
          ) : null}
          {needsAck.length > 0 ? (
            <AttentionChip count={needsAck.length} label="Awaiting Ack" color="amber" />
          ) : null}
          {inProgress.length > 0 ? (
            <AttentionChip count={inProgress.length} label="In Progress" color="blue" />
          ) : null}
          {escalated.length === 0 && needsAck.length === 0 && inProgress.length === 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#ecfdf5] border border-[#d1fae5] text-[#065f46]">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              All Commitments On Track
            </span>
          )}
        </div>
      </div>

      {/* ── Segmented Navigation Filter ── */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { key: 'all', label: 'All Requests', count: requests.length },
            { key: 'needs_ack', label: 'Awaiting Ack', count: needsAck.length },
            { key: 'escalated', label: 'Escalated', count: escalated.length },
            { key: 'in_progress', label: 'In Progress', count: inProgress.length },
            { key: 'resolved', label: 'Resolved', count: resolved.length },
          ].map((tab) => {
            const active = filter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`px-3.5 py-2 text-[13px] font-medium rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer select-none ${
                  active
                    ? 'bg-[#0b131b] text-white font-bold shadow-xs'
                    : 'bg-white text-[#5a6e7f] hover:text-[#0b131b] hover:bg-[#f8faf9] border border-[#e2e8e5]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                    active ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981] font-bold' : 'bg-[#edf0ee] text-[#5a6e7f]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Rows per page selector */}
        <div className="flex items-center gap-2.5 text-[12.5px] text-[#5a6e7f]">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 px-2.5 rounded-lg border border-[#cbd5d0] bg-white text-[12.5px] font-medium text-[#0b131b] focus:border-[#059669] outline-none cursor-pointer shadow-2xs"
          >
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={21}>21</option>
          </select>
        </div>
      </div>

      {/* ── High-Density Enterprise Operations Table ── */}
      {filteredRequests.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="bg-white rounded-2xl border border-[#e2e8e5] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e2e8e5] text-[11px] font-bold uppercase tracking-wider text-[#5a6e7f]">
                  <th scope="col" className="px-6 py-3.5 w-[26%]">
                    Request
                  </th>
                  <th scope="col" className="px-5 py-3.5 w-[18%]">
                    Client Organization
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[14%]">
                    Service Area
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[15%]">
                    Specialist Owner
                  </th>
                  <th scope="col" className="px-4 py-3.5 w-[13%]">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5 w-[14%]">
                    SLA Window
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ef]">
                {paginatedRequests.map((req) => (
                  <RequestRow key={req.id} request={req} onOpen={onOpen} />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Enterprise Pagination Footer Toolbar ── */}
          <div className="px-6 py-4 bg-[#f8faf9] border-t border-[#e2e8e5] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px]">
            <span className="text-[#5a6e7f] text-[12.5px] font-medium">
              Showing <strong className="text-[#0b131b] font-bold">{startIndex + 1}–{endIndex}</strong> of <strong className="text-[#0b131b] font-bold">{totalItems}</strong> requests
            </span>

            <div className="flex items-center gap-1.5">
              {/* Prev Page Button */}
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8.5 px-3 rounded-lg border border-[#cbd5d0] bg-white text-[#2c3e50] font-medium hover:bg-[#f4f6f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-2xs"
                aria-label="Previous page"
              >
                <span>‹</span>
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Numeric Page Chips */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => {
                  const isActive = pNum === currentPage
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`w-8.5 h-8.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer select-none flex items-center justify-center ${
                        isActive
                          ? 'bg-[#0b131b] text-white shadow-xs'
                          : 'bg-white border border-[#cbd5d0] text-[#5a6e7f] hover:bg-[#f4f6f5] hover:text-[#0b131b]'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>

              {/* Next Page Button */}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8.5 px-3 rounded-lg border border-[#cbd5d0] bg-white text-[#2c3e50] font-medium hover:bg-[#f4f6f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-2xs"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <span>›</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestRow({
  request,
  onOpen,
}: {
  request: Request
  onOpen: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const sla = getSlaSummary(request)
  const isEscalated = Boolean(request.escalation) && request.workflowStatus !== 'resolved'
  const isResolved = request.workflowStatus === 'resolved'

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onOpen(request.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(request.id)
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer transition-colors duration-100 focus-visible:bg-[#f4f6f5] select-none h-[64px]"
      style={{
        background: hovered ? '#f8faf9' : isEscalated ? '#fffbfb' : '#ffffff',
      }}
    >
      {/* 1. Request Column (Nvara Branded Reference Code + Truncated Subject) */}
      <td className="px-6 py-3.5">
        <div className="flex items-start gap-3">
          {isEscalated && <EscalationDot />}
          <div className="min-w-0">
            <span className="font-mono text-[11.5px] font-bold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#d1fae5] inline-block leading-tight mb-1">
              {request.id}
            </span>
            <span className="text-[13.5px] font-semibold text-[#0b131b] block truncate max-w-[270px] leading-snug">
              {request.subject}
            </span>
          </div>
        </div>
      </td>

      {/* 2. Client Column (Company + Name) */}
      <td className="px-5 py-3.5">
        <span className="text-[13.5px] font-semibold text-[#0b131b] block truncate leading-tight">
          {request.client.company}
        </span>
        {request.client.name && (
          <span className="text-[12px] text-[#5a6e7f] block truncate mt-0.5">
            {request.client.name}
          </span>
        )}
      </td>

      {/* 3. Service Column */}
      <td className="px-4 py-3.5">
        <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#edf0ee] text-[#2c3e50] text-[12px] font-medium border border-[#e2e8e5]">
          {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
        </span>
      </td>

      {/* 4. Specialist Owner Column */}
      <td className="px-4 py-3.5">
        {request.assignment?.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar user={{ name: cleanName(request.assignment.assignee.name) }} size="xs" />
            <span className="text-[13px] font-medium text-[#0b131b] truncate max-w-[130px]">
              {cleanName(request.assignment.assignee.name)}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-[#8da0b0] italic">Unassigned</span>
        )}
      </td>

      {/* 5. Status Column */}
      <td className="px-4 py-3.5">
        <StatusBadge status={request.workflowStatus} size="sm" />
      </td>

      {/* 6. SLA Column */}
      <td className="px-5 py-3.5">
        {isResolved ? (
          <span className="text-[12.5px] text-[#059669] font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            Resolved
          </span>
        ) : isEscalated ? (
          <span className="text-[12.5px] text-[#e11d48] font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
            Escalated
          </span>
        ) : (
          <div className="flex flex-col">
            <span
              className={`text-[12.5px] font-bold ${
                sla.state === 'warning'
                  ? 'text-[#d97706]'
                  : sla.state === 'breached'
                  ? 'text-[#e11d48]'
                  : 'text-[#0b131b]'
              }`}
            >
              {formatRemaining(sla.remainingMs)}
            </span>
            <span className="text-[11px] text-[#8da0b0]">
              {formatDateTime(request.assignment.acknowledgementDeadline)}
            </span>
          </div>
        )}
      </td>
    </tr>
  )
}
