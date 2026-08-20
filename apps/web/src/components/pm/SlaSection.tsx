import type { Request } from '../../domain/ticket'
import { formatHumanDateTime, formatRemaining, type SlaSummary } from '../../domain/sla'
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

  // Construct human-readable primary operational message
  let primaryHeadline = ''
  let primarySubtitle = ''

  if (request.workflowStatus === 'resolved') {
    primaryHeadline = 'SLA Satisfied'
    primarySubtitle = 'All deliverables fulfilled and verified'
  } else if (isComplete) {
    primaryHeadline = 'SLA Satisfied'
    primarySubtitle = request.assignment.acknowledgedAt
      ? `Acknowledged on time on ${formatHumanDateTime(request.assignment.acknowledgedAt)}`
      : 'Acknowledged within the 24-hour commitment window'
  } else if (isBreached) {
    primaryHeadline = sla.remainingMs < 0 ? `SLA Breached (${formatRemaining(sla.remainingMs)})` : 'SLA Breached'
    primarySubtitle = 'Acknowledgement deadline passed · Escalation recorded'
  } else if (isWarning) {
    primaryHeadline = `Due in ${formatRemaining(sla.remainingMs)}`
    primarySubtitle = 'Approaching 24-hour window · Needs specialist attention'
  } else if (request.assignment.acknowledgementDeadline) {
    primaryHeadline = `Due in ${formatRemaining(sla.remainingMs)}`
    primarySubtitle = 'Awaiting specialist acknowledgement'
  } else {
    primaryHeadline = 'Pending Assignment'
    primarySubtitle = '24-hour SLA timer starts once assigned'
  }

  return (
    <Section title="Acknowledgement SLA" label="SLA tracking and operational commitment">
      <div className="flex flex-col gap-4">
        {/* Human Primary Metric Hero */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-[#f1f5f9]">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ background: statusColor }}
                aria-hidden="true"
              />
              <span className="text-[17px] font-bold text-[#0f172a] tracking-tight">
                {primaryHeadline}
              </span>
            </div>
            <p className="text-[12.5px] text-[#64748b]">
              {primarySubtitle}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
              Target Deadline
            </span>
            <span className="text-[13px] font-medium text-[#0f172a]">
              {request.assignment.acknowledgementDeadline
                ? formatHumanDateTime(request.assignment.acknowledgementDeadline)
                : 'Pending specialist assignment'}
            </span>
          </div>
        </div>

        {/* Supporting Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
              Assigned Timeline
            </span>
            <span className="font-medium text-[#334155]">
              {request.assignment.assignedAt
                ? `Assigned on ${formatHumanDateTime(request.assignment.assignedAt)}`
                : 'Not assigned yet'}
            </span>
          </div>

          {request.assignment.acknowledgedAt && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-0.5">
                Acknowledged Timestamp
              </span>
              <span className="font-medium text-[#059669]">
                {formatHumanDateTime(request.assignment.acknowledgedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
