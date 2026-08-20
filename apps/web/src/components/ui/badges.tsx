import type { WorkflowStatus } from '../../domain/ticket'

const STATUS_STYLES: Record<
  WorkflowStatus,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  awaiting_acknowledgement: {
    bg: 'var(--color-amber-bg)',
    border: 'var(--color-amber-border)',
    text: 'var(--color-amber-text)',
    dot: 'var(--color-amber-dot)',
    label: 'Awaiting acknowledgement',
  },
  acknowledged: {
    bg: 'var(--color-emerald-bg)',
    border: 'var(--color-emerald-border)',
    text: 'var(--color-emerald-text)',
    dot: 'var(--color-emerald-dot)',
    label: 'Acknowledged',
  },
  in_progress: {
    bg: 'var(--color-blue-bg)',
    border: 'var(--color-blue-border)',
    text: 'var(--color-blue-text)',
    dot: 'var(--color-blue-dot)',
    label: 'In progress',
  },
  resolved: {
    bg: 'var(--color-slate-bg)',
    border: 'var(--color-slate-border)',
    text: 'var(--color-slate-text)',
    dot: 'var(--color-slate-dot)',
    label: 'Resolved',
  },
}

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: WorkflowStatus
  size?: 'sm' | 'md'
}) {
  const s = STATUS_STYLES[status]
  const px = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1'
  const textSize = size === 'md' ? 'text-[12px]' : 'text-[11px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${px} ${textSize}`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: s.dot }} aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, { label: string; bg: string; border: string; text: string }> = {
    flexible: {
      label: 'Flexible',
      bg: 'var(--color-slate-bg)',
      border: 'var(--color-slate-border)',
      text: 'var(--color-slate-text)',
    },
    soon: {
      label: 'Soon',
      bg: 'var(--color-amber-bg)',
      border: 'var(--color-amber-border)',
      text: 'var(--color-amber-text)',
    },
    time_sensitive: {
      label: 'Time-sensitive',
      bg: 'var(--color-rose-bg)',
      border: 'var(--color-rose-border)',
      text: 'var(--color-rose-text)',
    },
  }
  const style = map[urgency] ?? map.flexible
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}
    >
      {style.label}
    </span>
  )
}

export function EscalationBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
      style={{
        background: 'var(--color-rose-bg)',
        border: '1px solid var(--color-rose-border)',
        color: 'var(--color-rose-text)',
      }}
    >
      ⚑ Escalated
    </span>
  )
}

export function EscalationDot() {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-none mt-1"
      style={{ background: 'var(--color-rose-dot)' }}
      title="Escalated"
      aria-hidden="true"
    />
  )
}

export function AttentionChip({
  count,
  label,
  color,
}: {
  count: number
  label: string
  color: 'amber' | 'rose' | 'blue' | 'emerald'
}) {
  const styles = {
    amber: {
      bg: 'var(--color-amber-bg)',
      border: 'var(--color-amber-border)',
      text: 'var(--color-amber-text)',
      dot: 'var(--color-amber-dot)',
    },
    rose: {
      bg: 'var(--color-rose-bg)',
      border: 'var(--color-rose-border)',
      text: 'var(--color-rose-text)',
      dot: 'var(--color-rose-dot)',
    },
    blue: {
      bg: 'var(--color-blue-bg)',
      border: 'var(--color-blue-border)',
      text: 'var(--color-blue-text)',
      dot: 'var(--color-blue-dot)',
    },
    emerald: {
      bg: 'var(--color-emerald-bg)',
      border: 'var(--color-emerald-border)',
      text: 'var(--color-emerald-text)',
      dot: 'var(--color-emerald-dot)',
    },
  }[color]

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
      style={{
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-none"
        style={{ background: styles.dot }}
        aria-hidden="true"
      />
      <strong>{count}</strong>&nbsp;{label}
    </span>
  )
}
