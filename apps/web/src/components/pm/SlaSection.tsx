import type { Request } from '../../domain/ticket'
import { formatDateTime, formatRemaining, getSlaSummary } from '../../domain/sla'

export function SlaSection({
  request,
  sla,
}: {
  request: Request
  sla: ReturnType<typeof getSlaSummary>
}) {
  const isHealthy = sla.state === 'complete' || sla.state === 'on_track'
  const isWarning = sla.state === 'warning'
  const isCritical = sla.state === 'breached' || sla.state === 'escalated'

  const borderColor = isCritical
    ? 'var(--color-rose-dot)'
    : isWarning
    ? 'var(--color-amber-dot)'
    : 'var(--color-emerald-dot)'

  const humanLabel =
    sla.state === 'complete'
      ? request.assignment?.acknowledgedAt
        ? request.escalation
          ? 'Acknowledged after escalation'
          : 'Acknowledged on time'
        : 'Resolved'
      : sla.state === 'escalated'
      ? 'Escalation triggered — acknowledgement overdue'
      : sla.state === 'breached'
      ? `SLA breached ${formatRemaining(sla.remainingMs)}`
      : sla.state === 'warning'
      ? `Acknowledgement due in ${formatRemaining(sla.remainingMs)}`
      : `Acknowledgement due in ${formatRemaining(sla.remainingMs)}`

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-ink-muted)' }}
        >
          Acknowledgement SLA
        </p>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            background: isCritical
              ? 'var(--color-rose-bg)'
              : isWarning
              ? 'var(--color-amber-bg)'
              : 'var(--color-emerald-bg)',
            color: isCritical
              ? 'var(--color-rose-text)'
              : isWarning
              ? 'var(--color-amber-text)'
              : 'var(--color-emerald-text)',
          }}
        >
          {isCritical ? 'Attention' : isWarning ? 'Due soon' : isHealthy ? 'On track' : ''}
        </span>
      </div>

      <p
        className="text-[15px] font-bold mb-3 leading-snug"
        style={{
          color: isCritical
            ? 'var(--color-rose-text)'
            : isWarning
            ? 'var(--color-amber-text)'
            : 'var(--color-ink)',
        }}
      >
        {humanLabel}
      </p>

      <div
        className="grid grid-cols-3 gap-3 pt-3"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        <div>
          <p className="text-[10.5px] font-semibold mb-0.5" style={{ color: 'var(--color-ink-faint)' }}>
            Window
          </p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--color-ink)' }}>
            24 hours
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold mb-0.5" style={{ color: 'var(--color-ink-faint)' }}>
            Deadline
          </p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--color-ink)' }}>
            {formatDateTime(request.assignment?.acknowledgementDeadline ?? '')}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold mb-0.5" style={{ color: 'var(--color-ink-faint)' }}>
            {request.assignment?.acknowledgedAt ? 'Acknowledged' : 'Status'}
          </p>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--color-ink)' }}>
            {request.assignment?.acknowledgedAt
              ? formatDateTime(request.assignment.acknowledgedAt)
              : sla.label}
          </p>
        </div>
      </div>
    </div>
  )
}
