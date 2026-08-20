import { useState } from 'react'
import type { Request } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatRemaining, getSlaSummary } from '../../domain/sla'
import { AttentionChip, EscalationDot, StatusBadge } from '../ui/badges'
import { Avatar } from '../ui/layout'
import { ChevronRight } from '../ui/icons'
import { EmptyQueue } from '../ui/feedback'

export function RequestQueue({
  requests,
  onOpen,
}: {
  requests: Request[]
  onOpen: (id: string) => void
}) {
  const open = requests.filter((r) => r.workflowStatus !== 'resolved')
  const needsAck = requests.filter(
    (r) => r.workflowStatus === 'awaiting_acknowledgement',
  )
  const escalated = requests.filter((r) => Boolean(r.escalation) && r.workflowStatus !== 'resolved')
  const inProgress = requests.filter((r) => r.workflowStatus === 'in_progress')
  const resolved = requests.filter((r) => r.workflowStatus === 'resolved')

  return (
    <div className="max-w-[1280px] mx-auto w-full px-5 sm:px-8 py-7">
      {/* Page header */}
      <div className="mb-7">
        <h1
          className="text-[22px] font-bold tracking-tight mb-1"
          style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
        >
          Request Queue
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--color-ink-muted)' }}>
          {open.length} open · {requests.length} total
        </p>
      </div>

      {/* Attention strip */}
      {(needsAck.length > 0 || escalated.length > 0) && (
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="region"
          aria-label="Attention required"
        >
          {needsAck.length > 0 && (
            <AttentionChip
              count={needsAck.length}
              label="awaiting acknowledgement"
              color="amber"
            />
          )}
          {escalated.length > 0 && (
            <AttentionChip
              count={escalated.length}
              label="escalated"
              color="rose"
            />
          )}
          {inProgress.length > 0 && (
            <AttentionChip
              count={inProgress.length}
              label="in progress"
              color="blue"
            />
          )}
        </div>
      )}

      {/* Request table */}
      {requests.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Table header strip */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <p className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-muted)' }}>
              All requests
            </p>
            <div className="flex items-center gap-3 text-[11.5px]" style={{ color: 'var(--color-ink-faint)' }}>
              <span>{resolved.length} resolved</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {[
                    { label: 'Reference & Subject', width: '28%' },
                    { label: 'Client', width: '16%' },
                    { label: 'Service', width: '13%' },
                    { label: 'Owner', width: '15%' },
                    { label: 'Status', width: '12%' },
                    { label: 'SLA', width: '12%' },
                    { label: '', width: '4%' },
                  ].map((col) => (
                    <th
                      key={col.label}
                      scope="col"
                      className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider"
                      style={{
                        color: 'var(--color-ink-muted)',
                        borderBottom: '1px solid var(--color-border)',
                        width: col.width,
                      }}
                    >
                      {col.label || <span className="sr-only">Open</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((req, idx) => (
                  <RequestRow
                    key={req.id}
                    request={req}
                    onOpen={onOpen}
                    isLast={idx === requests.length - 1}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function RequestRow({
  request,
  onOpen,
  isLast,
}: {
  request: Request
  onOpen: (id: string) => void
  isLast: boolean
}) {
  const sla = getSlaSummary(request)
  const [hovered, setHovered] = useState(false)

  const rowStyle = {
    borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
    background: hovered ? 'var(--color-surface-hover)' : 'white',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  }

  const slaDotColor = {
    on_track: 'var(--color-emerald-dot)',
    warning: 'var(--color-amber-dot)',
    breached: 'var(--color-rose-dot)',
    escalated: 'var(--color-rose-dot)',
    complete: 'var(--color-emerald-dot)',
  }[sla.state]

  const slaTextColor = {
    on_track: 'var(--color-ink)',
    warning: 'var(--color-amber-text)',
    breached: 'var(--color-rose-text)',
    escalated: 'var(--color-rose-text)',
    complete: 'var(--color-ink-muted)',
  }[sla.state]

  const slaSummaryText =
    sla.state === 'complete'
      ? request.assignment.acknowledgedAt
        ? 'Acknowledged'
        : 'Resolved'
      : sla.state === 'escalated'
      ? 'Escalated'
      : formatRemaining(sla.remainingMs)

  return (
    <tr
      role="button"
      style={rowStyle}
      tabIndex={0}
      onClick={() => onOpen(request.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(request.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Request ${request.id}: ${request.subject}`}
    >
      {/* Reference + subject */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-start gap-2">
          {request.escalation && request.workflowStatus !== 'resolved' && (
            <span
              className="mt-0.5 flex-none"
              title="Escalated"
              aria-label="Escalated"
            >
              <EscalationDot />
            </span>
          )}
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold mb-0.5 truncate"
              style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {request.id}
            </p>
            <p
              className="text-[13px] font-semibold leading-snug truncate max-w-[280px]"
              style={{ color: 'var(--color-ink)' }}
            >
              {request.subject}
            </p>
          </div>
        </div>
      </td>

      {/* Client */}
      <td className="px-4 py-3 align-middle">
        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
          {request.client.company}
        </p>
        <p className="text-[11.5px] truncate" style={{ color: 'var(--color-ink-muted)' }}>
          {request.client.name}
        </p>
      </td>

      {/* Service */}
      <td className="px-4 py-3 align-middle">
        <span className="text-[12px] font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
          {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
        </span>
      </td>

      {/* Owner */}
      <td className="px-4 py-3 align-middle">
        {request.assignment?.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar user={request.assignment.assignee} size="xs" />
            <span className="text-[12.5px] font-medium truncate" style={{ color: 'var(--color-ink)' }}>
              {request.assignment.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-[12px] italic" style={{ color: 'var(--color-ink-faint)' }}>
            Unassigned
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-middle">
        <StatusBadge status={request.workflowStatus} />
      </td>

      {/* SLA */}
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full flex-none"
            style={{ background: slaDotColor }}
            aria-hidden="true"
          />
          <span className="text-[12px] font-medium" style={{ color: slaTextColor }}>
            {slaSummaryText}
          </span>
        </div>
      </td>

      {/* Arrow */}
      <td className="px-4 py-3 align-middle">
        <ChevronRight
          className="transition-transform group-hover:translate-x-0.5"
          style={{ color: hovered ? 'var(--color-ink-muted)' : 'var(--color-ink-subtle)' }}
        />
      </td>
    </tr>
  )
}
