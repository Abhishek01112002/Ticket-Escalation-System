import type { Request } from '../../domain/ticket'
import { formatDateTime, formatRemaining, type SlaSummary } from '../../domain/sla'
import { Section } from '../ui/layout'

export function SlaSection({
  request,
  sla,
}: {
  request: Request
  sla: SlaSummary
}) {
  const isBreached = sla.state === 'breached' || sla.state === 'escalated'
  const isComplete = sla.state === 'complete'
  const isWarning = sla.state === 'warning'

  const statusColor = isBreached
    ? '#e11d48'
    : isComplete
    ? '#059669'
    : isWarning
    ? '#d97706'
    : '#0f172a'

  return (
    <Section title="Acknowledgement SLA" label="SLA tracking and operational deadline">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-[#f1f5f9]">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
              Current SLA Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full flex-none"
                style={{ background: statusColor }}
                aria-hidden="true"
              />
              <span className="text-[15px] font-bold text-[#0f172a]">
                {sla.label}
              </span>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
              Timer
            </span>
            <span
              className="font-mono text-[14px] font-bold"
              style={{ color: statusColor }}
            >
              {isComplete ? 'SLA Satisfied' : formatRemaining(sla.remainingMs)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
              24h Target Deadline
            </span>
            <span className="font-medium text-[#0f172a]">
              {request.assignment.acknowledgementDeadline
                ? formatDateTime(request.assignment.acknowledgementDeadline)
                : 'Pending assignment'}
            </span>
          </div>

          {request.assignment.acknowledgedAt && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
                Acknowledged At
              </span>
              <span className="font-medium text-[#059669]">
                {formatDateTime(request.assignment.acknowledgedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
