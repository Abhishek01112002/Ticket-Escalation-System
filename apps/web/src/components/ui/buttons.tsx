import React from 'react'

export function PrimaryBtn({
  onClick,
  disabled,
  busy,
  children,
  className = '',
  type = 'button',
}: {
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none ${className}`}
      style={{
        background: '#0f172a',
        color: '#ffffff',
        border: '1px solid #0f172a',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
      }}
      onMouseOver={(e) => {
        if (!disabled && !busy) e.currentTarget.style.background = '#1e293b'
      }}
      onMouseOut={(e) => {
        if (!disabled && !busy) e.currentTarget.style.background = '#0f172a'
      }}
    >
      {busy && (
        <svg
          className="animate-spin -ml-0.5"
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
          <path d="M12 7a5 5 0 01-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  )
}

export function SecondaryBtn({
  onClick,
  disabled,
  children,
  className = '',
  type = 'button',
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none ${className}`}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        color: '#334155',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = '#f8fafc'
          e.currentTarget.style.borderColor = '#cbd5e1'
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = '#ffffff'
          e.currentTarget.style.borderColor = '#e2e8f0'
        }
      }}
    >
      {children}
    </button>
  )
}

export function NavItem({
  active,
  icon,
  badge,
  children,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  badge?: number
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors select-none ${
        active
          ? 'bg-[var(--color-sidebar-active)] text-white font-semibold'
          : 'text-[var(--color-ink-faint)] hover:bg-[var(--color-sidebar-hover)] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex-none opacity-80">{icon}</span>
        <span className="truncate">{children}</span>
      </div>
      {typeof badge === 'number' && badge > 0 && (
        <span
          className="px-1.5 py-0.5 rounded text-[10.5px] font-bold"
          style={{
            background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
            color: active ? 'white' : 'var(--color-ink-faint)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}
