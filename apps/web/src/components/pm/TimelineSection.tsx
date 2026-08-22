import type { TimelineEvent } from '../../domain/ticket'
import { formatHumanDateTime } from '../../domain/sla'
import { Section } from '../ui/layout'

function cleanName(name?: string): string {
  if (!name) return 'System'
  const cleaned = String(name).replace(/^Demo\s+/i, '').trim()
  if (cleaned.toLowerCase() === 'internal team member') return 'Specialist'
  return cleaned || 'System'
}

function getHumanEventCopy(event: TimelineEvent): { title: string; description: string } {
  const actor = cleanName(event.actor)
  const isArrowTransition = (event.detail || '').includes('→')

  switch (event.type) {
    case 'resolved':
      return {
        title: 'Resolved',
        description: isArrowTransition
          ? `${actor} marked this request as completed and fulfilled.`
          : event.detail || 'Request resolved.',
      }
    case 'work_started':
      return {
        title: 'Work Started',
        description: isArrowTransition
          ? `${actor} started active execution on this requirement.`
          : event.detail || 'Work started.',
      }
    case 'acknowledged':
      return {
        title: 'Acknowledged',
        description: isArrowTransition
          ? `${actor} acknowledged receipt within the 24-hour SLA window.`
          : event.detail || 'Request acknowledged.',
      }
    case 'reassigned':
      return {
        title: 'Reassigned',
        description: isArrowTransition
          ? `Request was reassigned to ${actor}.`
          : event.detail || 'Request reassigned.',
      }
    case 'assigned':
      return {
        title: 'Specialist Assigned',
        description: isArrowTransition
          ? `Assigned to ${actor} with a 24-hour acknowledgement window.`
          : event.detail || 'Specialist assigned.',
      }
    case 'request_created':
      return {
        title: 'Request Received',
        description: isArrowTransition
          ? 'Client requirement submitted and recorded in operations queue.'
          : event.detail || 'Request created.',
      }
    case 'sla_breached':
      return {
        title: 'SLA Breached',
        description: isArrowTransition
          ? 'The 24-hour acknowledgement window elapsed without confirmation.'
          : event.detail || 'SLA breached.',
      }
    case 'escalation_triggered':
      return {
        title: 'Escalation Triggered',
        description: isArrowTransition
          ? 'Acknowledgement SLA was breached and an escalation was recorded.'
          : event.detail || 'Escalation triggered.',
      }
    default:
      return {
        title: String(event.title || event.type || 'Activity').replace(/_/g, ' '),
        description: isArrowTransition ? 'Request status updated.' : event.detail || 'Activity recorded.',
      }
  }
}

export function TimelineSection({
  timeline = [],
}: {
  timeline?: TimelineEvent[]
}) {
  const sorted = [...(timeline || [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )

  return (
    <Section title="Request History" label="Chronological activity and audit history">
      {sorted.length === 0 ? (
        <p className="text-[13px] text-[#94a3b8] italic">No activity recorded yet.</p>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2.5 before:bottom-2.5 before:w-[1.5px] before:bg-[#e2e8f0]">
          {sorted.map((event) => {
            const { title, description } = getHumanEventCopy(event)
            const isBreach = event.type === 'sla_breached' || event.type === 'escalation_triggered'
            const isResolved = event.type === 'resolved'
            const isAcknowledged = event.type === 'acknowledged'
            const isWorkStarted = event.type === 'work_started'

            const markerStyle = isBreach
              ? 'bg-[#fff1f2] border-[#ffe4e6] text-[#e11d48]'
              : isResolved || isAcknowledged
              ? 'bg-[#ecfdf5] border-[#d1fae5] text-[#059669]'
              : isWorkStarted
              ? 'bg-[#eef2ff] border-[#e0e7ff] text-[#4f46e5]'
              : 'bg-[#f8fafc] border-[#e2e8f0] text-[#475569]'

            return (
              <div key={event.id} className="relative flex flex-col gap-1">
                {/* Semantic Icon Marker */}
                <span
                  className={`absolute -left-[23px] top-0.5 w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[10px] font-bold shadow-2xs ${markerStyle}`}
                  aria-hidden="true"
                >
                  {isBreach ? '!' : isResolved || isAcknowledged ? '✓' : isWorkStarted ? '▶' : '•'}
                </span>

                {/* Event Primary Line */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <span className="text-[13.5px] font-bold text-[#0f172a]">
                    {title}
                  </span>
                  <span className="text-[12px] text-[#64748b]">
                    {formatHumanDateTime(event.at)}
                  </span>
                </div>

                {/* Event Business Prose Description */}
                <p className="text-[13px] text-[#334155] leading-relaxed">
                  {description}
                </p>

                {/* Actor Attribution */}
                {event.actor && (
                  <span className="text-[11.5px] font-medium text-[#64748b]">
                    Recorded by {cleanName(event.actor)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
