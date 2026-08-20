import { useState } from 'react'
import type { Request } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatRemaining, getSlaSummary } from '../../domain/sla'
import { AttentionChip, EscalationDot, StatusBadge } from '../ui/badges'
import { Avatar } from '../ui/layout'
import { EmptyQueue } from '../ui/feedback'

export function RequestQueue({
  requests,
  onOpen,
}: {
  requests: Request[]
  onOpen: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'needs_ack' | 'escalated' | 'in_progress' | 'resolved'>('all')

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

  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 sm:px-10 py-8">
      {/* ── Page Header & Stats ── */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            Operations Queue
          </h1>
          <p className="text-[13px] text-[#64748b] mt-0.5">
            {requests.length - resolved.length} active requests requiring oversight · {requests.length} total
          </p>
        </div>

        {/* Attention Strip */}
        <div className="flex items-center gap-2 flex-wrap">
          {escalated.length > 0 && (
            <AttentionChip count={escalated.length} label="Escalated" color="rose" />
          )}
          {needsAck.length > 0 && (
            <AttentionChip count={needsAck.length} label="Awaiting Ack" color="amber" />
          )}
          {inProgress.length > 0 && (
            <AttentionChip count={inProgress.length} label="In Progress" color="blue" />
          )}
        </div>
      </div>

      {/* ── Filter Tab Bar ── */}
      <div className="flex items-center gap-1 border-b border-[#e2e8f0] mb-4">
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
              className={`px-3.5 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
                active
                  ? 'border-[#0f172a] text-[#0f172a] font-semibold'
                  : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[11px] ${
                  active ? 'bg-[#0f172a] text-white font-bold' : 'bg-[#f1f5f9] text-[#64748b]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Requests Table ── */}
      {filteredRequests.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  <th scope="col" className="px-5 py-3 w-[26%]">
                    Reference &amp; Subject
                  </th>
                  <th scope="col" className="px-4 py-3 w-[16%]">
                    Client
                  </th>
                  <th scope="col" className="px-4 py-3 w-[15%]">
                    Service Area
                  </th>
                  <th scope="col" className="px-4 py-3 w-[16%]">
                    Assigned Owner
                  </th>
                  <th scope="col" className="px-4 py-3 w-[13%]">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 w-[14%]">
                    SLA Window
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredRequests.map((req) => (
                  <RequestRow key={req.id} request={req} onOpen={onOpen} />
                ))}
              </tbody>
            </table>
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
      className="cursor-pointer transition-colors duration-100 focus-visible:bg-[#f1f5f9] select-none"
      style={{
        background: hovered ? '#f8fafc' : isEscalated ? '#fffbfb' : '#ffffff',
      }}
    >
      {/* Reference & Subject */}
      <td className="px-5 py-3.5">
        <div className="flex items-start gap-2">
          {isEscalated && <EscalationDot />}
          <div className="min-w-0">
            <span className="font-mono text-[11.5px] font-semibold text-[#64748b] block mb-0.5">
              {request.id}
            </span>
            <span className="text-[13.5px] font-semibold text-[#0f172a] block truncate leading-snug">
              {request.subject}
            </span>
          </div>
        </div>
      </td>

      {/* Client */}
      <td className="px-4 py-3.5">
        <span className="text-[13px] font-medium text-[#0f172a] block truncate">
          {request.client.company}
        </span>
        {request.client.name && (
          <span className="text-[11.5px] text-[#64748b] block truncate">
            {request.client.name}
          </span>
        )}
      </td>

      {/* Service Area */}
      <td className="px-4 py-3.5">
        <span className="inline-block px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-[12px] font-medium border border-[#e2e8f0]">
          {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
        </span>
      </td>

      {/* Owner */}
      <td className="px-4 py-3.5">
        {request.assignment?.assignee ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar user={request.assignment.assignee} size="xs" />
            <span className="text-[12.5px] font-medium text-[#0f172a] truncate">
              {request.assignment.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-[#94a3b8] italic">Unassigned</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <StatusBadge status={request.workflowStatus} />
      </td>

      {/* SLA Window */}
      <td className="px-4 py-3.5">
        <span
          className={`font-mono text-[12px] font-medium ${
            isResolved
              ? 'text-[#64748b]'
              : sla.state === 'breached' || sla.state === 'escalated'
              ? 'text-[#e11d48] font-bold'
              : sla.state === 'warning'
              ? 'text-[#d97706] font-semibold'
              : 'text-[#0f172a]'
          }`}
        >
          {isResolved ? 'Resolved' : formatRemaining(sla.remainingMs)}
        </span>
      </td>
    </tr>
  )
}
