import type { Request } from '../../domain/ticket'
import { formatDateTime } from '../../domain/sla'

export function EscalationSection({
  escalation,
}: {
  escalation: NonNullable<Request['escalation']>
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--color-rose-bg)',
        border: '1px solid var(--color-rose-border)',
        borderLeft: '3px solid var(--color-rose-dot)',
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[13px] flex-none mt-0.5"
          style={{
            background: 'var(--color-rose-surface)',
            color: 'var(--color-rose-text)',
          }}
        >
          !
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10.5px] font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--color-rose-text)' }}
          >
            Escalation Record
          </p>
          <p
            className="text-[14.5px] font-bold leading-snug"
            style={{ color: 'var(--color-rose-text)' }}
          >
            Escalation triggered
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded flex-none"
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid var(--color-rose-border)',
            color: 'var(--color-rose-text)',
          }}
        >
          RECORDED
        </span>
      </div>

      <p className="text-[12.5px] mb-4 leading-relaxed" style={{ color: 'var(--color-rose-text)' }}>
        {escalation.reason}
      </p>

      <div
        className="grid grid-cols-2 gap-4 pt-3"
        style={{ borderTop: '1px solid var(--color-rose-border)' }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-rose-text)' }}>
            Responsible person:
          </p>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-rose-text)' }}>
            {escalation.responsiblePerson.name}
          </p>
          {escalation.responsiblePerson.team && (
            <p className="text-[11.5px]" style={{ color: 'var(--color-rose-text)', opacity: 0.75 }}>
              {escalation.responsiblePerson.team}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-rose-text)' }}>
            Triggered
          </p>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-rose-text)' }}>
            {formatDateTime(escalation.triggeredAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
