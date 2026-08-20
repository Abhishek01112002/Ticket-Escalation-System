import type { TimelineEvent } from '../../domain/ticket'
import { formatDateTime } from '../../domain/sla'

const timelineEventMeta: Record<
  TimelineEvent['type'],
  { icon: string; isAlert: boolean }
> = {
  request_created: { icon: '○', isAlert: false },
  assigned: { icon: '→', isAlert: false },
  reassigned: { icon: '⇄', isAlert: false },
  acknowledged: { icon: '✓', isAlert: false },
  work_started: { icon: '▷', isAlert: false },
  resolved: { icon: '✓', isAlert: false },
  sla_breached: { icon: '!', isAlert: true },
  escalation_triggered: { icon: '⚑', isAlert: true },
}

export function TimelineSection({ timeline }: { timeline: TimelineEvent[] }) {
  const events = [...timeline].reverse()

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div>
          <p
            className="text-[10.5px] font-bold uppercase tracking-wider mb-0.5"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            Audit trail
          </p>
          <h2
            className="text-[15px] font-bold"
            style={{ color: 'var(--color-ink)' }}
          >
            Request history
          </h2>
        </div>
        <span
          className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {timeline.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-6 text-[13px] italic" style={{ color: 'var(--color-ink-faint)' }}>
          No events yet.
        </p>
      ) : (
        <ol className="px-5 py-4">
          {events.map((event, idx) => {
            const meta = timelineEventMeta[event.type] ?? { icon: '·', isAlert: false }
            const isLast = idx === events.length - 1

            return (
              <li
                key={event.id}
                className="grid gap-x-3"
                style={{
                  gridTemplateColumns: '28px 1fr',
                  paddingBottom: isLast ? 0 : '16px',
                }}
              >
                {/* Icon + vertical line */}
                <div className="flex flex-col items-center">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] flex-none z-10"
                    style={{
                      background: meta.isAlert
                        ? 'var(--color-rose-surface)'
                        : 'var(--color-surface-2)',
                      color: meta.isAlert
                        ? 'var(--color-rose-text)'
                        : 'var(--color-ink-muted)',
                      border: meta.isAlert
                        ? '1px solid var(--color-rose-border)'
                        : '1px solid var(--color-border)',
                    }}
                  >
                    {meta.icon}
                  </span>
                  {!isLast && (
                    <div
                      className="flex-1 w-px mt-1"
                      style={{ background: 'var(--color-border-subtle)' }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="pb-0.5">
                  <div className="flex items-baseline justify-between gap-3 mb-0.5">
                    <p
                      className="text-[13px] font-semibold leading-snug"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {event.title}
                    </p>
                    <time
                      className="text-[11px] flex-none whitespace-nowrap"
                      style={{ color: 'var(--color-ink-faint)', fontFamily: 'var(--font-mono)' }}
                      dateTime={event.at}
                    >
                      {formatDateTime(event.at)}
                    </time>
                  </div>
                  {event.detail && (
                    <p
                      className="text-[12.5px] leading-relaxed mb-0.5"
                      style={{ color: 'var(--color-ink-secondary)' }}
                    >
                      {event.detail}
                    </p>
                  )}
                  <p className="text-[11.5px] font-medium" style={{ color: 'var(--color-ink-muted)' }}>
                    {event.actor}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
