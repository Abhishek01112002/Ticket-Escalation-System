import type { Escalation } from '../../domain/ticket'
import { formatHumanDateTime } from '../../domain/sla'
import { Avatar, Section } from '../ui/layout'

function cleanName(name: string): string {
  return name.replace(/^Demo\s+/i, '')
}

export function EscalationSection({
  escalation,
}: {
  escalation: Escalation
}) {
  return (
    <Section title="Active Escalation Event" label="Escalation record">
      <div className="rounded-lg bg-[#fff1f2] border border-[#ffe4e6] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[#9f1239]">
          <span className="w-2 h-2 rounded-full bg-[#e11d48] animate-pulse flex-none" />
          <span className="text-[13px] font-bold">
            SLA Breach Escalation Triggered
          </span>
        </div>

        <p className="text-[12.5px] text-[#9f1239] leading-relaxed">
          The 24-hour acknowledgement window elapsed without confirmation. This request has been escalated for management review.
        </p>

        <div className="pt-3 border-t border-[#fecdd3] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-[#9f1239] font-medium">Responsible Specialist:</span>
            <div className="flex items-center gap-1.5 font-bold text-[#0f172a]">
              <Avatar user={{ name: cleanName(escalation.responsiblePerson.name) }} size="xs" />
              <span>{cleanName(escalation.responsiblePerson.name)}</span>
            </div>
          </div>

          <span className="text-[#9f1239] text-[12px]">
            Triggered on {formatHumanDateTime(escalation.triggeredAt)}
          </span>
        </div>
      </div>
    </Section>
  )
}
