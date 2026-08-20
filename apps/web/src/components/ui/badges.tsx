import type { WorkflowStatus } from '../../domain/ticket'
import { FlagIcon } from './icons'

const STATUS_CONFIG: Record<
  WorkflowStatus,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  awaiting_acknowledgement: {
    bg: '#fffbeb',
    border: '#fef3c7',
    text: '#92400e',
    dot: '#d97706',
    label: 'Awaiting Ack',
  },
  acknowledged: {
    bg: '#ecfdf5',
    border: '#d1fae5',
    text: '#065f46',
    dot: '#059669',
    label: 'Acknowledged',
  },
  in_progress: {
    bg: '#eef2ff',
    border: '#e0e7ff',
    text: '#3730a3',
    dot: '#4f46e5',
    label: 'In Progress',
  },
  resolved: {
    bg: '#f8fafc',
    border: '#e2e8f0',
    text: '#475569',
    dot: '#64748b',
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
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.awaiting_acknowledgement
  const padding = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium tracking-tight whitespace-nowrap ${padding}`}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-none"
        style={{ background: c.dot }}
        aria-hidden="true"
      />
      {c.label}
    </span>
  )
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { label: string; bg: string; border: string; text: string }> = {
    flexible: {
      label: 'Flexible',
      bg: '#f8fafc',
      border: '#e2e8f0',
      text: '#475569',
    },
    soon: {
      label: 'Soon',
      bg: '#fffbeb',
      border: '#fef3c7',
      text: '#92400e',
    },
    time_sensitive: {
      label: 'Time-sensitive',
      bg: '#fff1f2',
      border: '#ffe4e6',
      text: '#9f1239',
    },
  }
  const c = config[urgency] ?? config.flexible

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium tracking-tight whitespace-nowrap"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {c.label}
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
      <FlagIcon size={10} /> Escalated
    </span>
  )
}

export function EscalationDot() {
  return (
    <span
      className="w-2 h-2 rounded-full flex-none bg-[#e11d48]"
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
      bg: '#fffbeb',
      border: '#fef3c7',
      text: '#92400e',
      dot: '#d97706',
    },
    rose: {
      bg: '#fff1f2',
      border: '#ffe4e6',
      text: '#9f1239',
      dot: '#e11d48',
    },
    blue: {
      bg: '#eef2ff',
      border: '#e0e7ff',
      text: '#3730a3',
      dot: '#4f46e5',
    },
    emerald: {
      bg: '#ecfdf5',
      border: '#d1fae5',
      text: '#065f46',
      dot: '#059669',
    },
  }[color]

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
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
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
    </div>
  )
}
