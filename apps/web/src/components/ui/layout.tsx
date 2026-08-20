import React from 'react'
import type { User, WorkflowStatus } from '../../domain/ticket'
import { CheckIcon } from './icons'

export function Section({
  title,
  label,
  children,
  action,
}: {
  title: string
  label: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden"
      style={{ boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}
    >
      <div className="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between bg-[#ffffff]">
        <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748b]">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
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
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
        {label}
      </dt>
      <dd className="text-[13.5px] font-medium text-[#0f172a] leading-snug">
        {children}
      </dd>
    </div>
  )
}

export function Avatar({
  user,
  size = 'md',
}: {
  user: { name: string; initials?: string }
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const initials =
    user.initials ||
    user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  const dims = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-[11.5px]',
    lg: 'w-10 h-10 text-[13px]',
  }[size]

  return (
    <span
      className={`${dims} rounded-full flex items-center justify-center font-bold flex-none select-none`}
      style={{
        background: '#0f172a',
        color: '#ffffff',
        letterSpacing: '-0.02em',
      }}
      aria-label={user.name}
    >
      {initials}
    </span>
  )
}

const STEPS: { key: WorkflowStatus; label: string }[] = [
  { key: 'awaiting_acknowledgement', label: '1. Awaiting Ack' },
  { key: 'acknowledged', label: '2. Acknowledged' },
  { key: 'in_progress', label: '3. In Progress' },
  { key: 'resolved', label: '4. Resolved' },
]

export function WorkflowStepper({ status }: { status: WorkflowStatus }) {
  const currentIdx = STEPS.findIndex((s) => s.key === status)

  return (
    <nav aria-label="Workflow progress" className="w-full py-1">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIdx
          const isCurrent = idx === currentIdx

          return (
            <li key={step.key} className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span
                  style={{
                    color: isCurrent
                      ? '#0f172a'
                      : isDone
                      ? '#059669'
                      : '#94a3b8',
                  }}
                >
                  {step.label}
                </span>
                {isDone && <CheckIcon size={12} className="text-[#059669]" />}
              </div>
              <div
                className="h-1 rounded-full w-full transition-colors duration-200"
                style={{
                  background: isDone
                    ? '#059669'
                    : isCurrent
                    ? '#0f172a'
                    : '#e2e8f0',
                }}
              />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
