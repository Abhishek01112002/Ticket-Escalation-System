import React from 'react'
import { Spinner } from './icons'

export function PrimaryBtn({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13.5px] font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'var(--color-accent)',
        border: '1px solid var(--color-accent-border)',
        color: 'var(--color-accent-dark)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {busy && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function SecondaryBtn({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        color: 'var(--color-ink-secondary)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {busy && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function NavItem({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-left transition-all duration-100 mx-0"
      style={{
        background: active ? 'var(--color-sidebar-active)' : 'transparent',
        color: active ? 'white' : 'var(--color-ink-faint)',
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--color-sidebar-hover)'
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span className="w-4 h-4 flex items-center justify-center flex-none opacity-75">
        {icon}
      </span>
      {children}
    </button>
  )
}
