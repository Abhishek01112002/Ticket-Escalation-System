import type { TimelineEvent } from '../../domain/ticket'
import { formatDateTime } from '../../domain/sla'
import { Section } from '../ui/layout'

export function TimelineSection({
  timeline,
}: {
  timeline: TimelineEvent[]
}) {
  const sorted = [...timeline].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )

  return (
    <Section title="Audit History" label="Chronological event timeline">
      {sorted.length === 0 ? (
        <p className="text-[13px] text-[#94a3b8] italic">No timeline events recorded.</p>
      ) : (
        <div className="relative pl-4 space-y-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#e2e8f0]">
          {sorted.map((event) => {
            const isBreach = event.type === 'sla_breached' || event.type === 'escalation_triggered'
            const isResolved = event.type === 'resolved'
            const isAcknowledged = event.type === 'acknowledged'

            const dotColor = isBreach
              ? 'bg-[#e11d48]'
              : isResolved || isAcknowledged
              ? 'bg-[#059669]'
              : 'bg-[#0f172a]'

            return (
              <div key={event.id} className="relative flex flex-col gap-1">
                <span
                  className={`absolute -left-[13px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${dotColor}`}
                  aria-hidden="true"
                />

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                  <span className="text-[13px] font-bold text-[#0f172a]">
                    {event.title}
                  </span>
                  <span className="text-[11.5px] font-mono text-[#94a3b8]">
                    {formatDateTime(event.at)}
                  </span>
                </div>

                <p className="text-[13px] text-[#475569] leading-relaxed">
                  {event.detail}
                </p>

                {event.actor && (
                  <span className="text-[11.5px] font-medium text-[#64748b] mt-0.5">
                    By {event.actor}
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
