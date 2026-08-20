import React from 'react'
import type { User, WorkflowStatus } from '../../domain/ticket'

export function Section({
  title,
  label,
  children,
}: {
  title: string
  label: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="rounded-xl p-5"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <h2
        className="text-[10.5px] font-bold uppercase tracking-wider mb-4"
        style={{ color: 'var(--color-ink-muted)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

export function MetaField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt
        className="text-[10.5px] font-semibold uppercase tracking-wider mb-0.5"
        style={{ color: 'var(--color-ink-faint)' }}
      >
        {label}
      </dt>
      <dd className="text-[13px] font-medium" style={{ color: 'var(--color-ink-secondary)' }}>
        {children}
      </dd>
    </div>
  )
}

export function Avatar({
  user,
  size = 'md',
}: {
  user: User
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const dims = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-[12px]',
    lg: 'w-11 h-11 text-[14px]',
  }[size]

  return (
    <span
      className={`${dims} rounded-full flex items-center justify-center font-bold flex-none`}
      style={{
        background: 'var(--color-emerald-bg)',
        color: 'var(--color-emerald-text)',
        border: '1px solid var(--color-emerald-border)',
      }}
      aria-label={user.name}
    >
      {user.initials}
    </span>
  )
}

const STEPS: { key: WorkflowStatus; label: string }[] = [
  { key: 'awaiting_acknowledgement', label: 'Pending' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
]

export function WorkflowStepper({ status }: { status: WorkflowStatus }) {
  const current = STEPS.findIndex((s) => s.key === status)

  return (
    <div
      className="flex items-center overflow-x-auto py-1"
      role="list"
      aria-label="Workflow progress"
    >
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div
            key={step.key}
            role="listitem"
            className="flex items-center flex-1 min-w-[70px]"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                style={{
                  background: done
                    ? 'var(--color-emerald-dot)'
                    : active
                    ? 'var(--color-accent)'
                    : 'var(--color-border)',
                  color: done
                    ? 'white'
                    : active
                    ? 'var(--color-accent-dark)'
                    : 'var(--color-ink-faint)',
                }}
                aria-label={
                  done
                    ? `${step.label} — complete`
                    : active
                    ? `${step.label} — current`
                    : step.label
                }
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className="text-[11.5px] font-semibold whitespace-nowrap"
                style={{
                  color: done
                    ? 'var(--color-emerald-text)'
                    : active
                    ? 'var(--color-ink)'
                    : 'var(--color-ink-faint)',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2"
                style={{
                  background: done
                    ? 'var(--color-emerald-dot)'
                    : 'var(--color-border)',
                }}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
