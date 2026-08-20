import { useState } from 'react'

export type ActivePortal = 'landing' | 'client' | 'pm'

export function Landing({ onPortal }: { onPortal: (p: ActivePortal) => void }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-surface-2)' }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 sm:px-10"
        style={{
          height: '56px',
          background: 'var(--color-sidebar)',
          borderBottom: '1px solid var(--color-sidebar-border)',
        }}
      >
        <span
          className="w-7 h-7 rounded-md grid place-items-center font-bold text-sm flex-none"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-dark)',
            fontFamily: 'var(--font-display)',
          }}
          aria-hidden="true"
        >
          N
        </span>
        <span className="text-white font-bold text-[14px] tracking-tight">Nvara Media</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-16">
        {/* Headline */}
        <div className="text-center mb-10 max-w-[520px]">
          <p
            className="text-[10.5px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-emerald-text)' }}
          >
            Client &amp; Project Management
          </p>
          <h1
            className="text-[32px] sm:text-[40px] font-bold tracking-tight leading-tight mb-4"
            style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
          >
            How can we help?
          </h1>
          <p
            className="text-[14px] sm:text-[15px] leading-relaxed"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            Submit a new project request or access the project management workspace.
          </p>
        </div>

        {/* Portal cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[640px]">
          {/* Client */}
          <PortalCard
            onClick={() => onPortal('client')}
            variant="light"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 7h6M7 10h4M7 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            title="Submit a Request"
            description="Tell us about your project. Our team will review and get in touch within 24 hours."
            cta="Get started"
          />

          {/* PM */}
          <PortalCard
            onClick={() => onPortal('pm')}
            variant="dark"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M11 14h6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            title="Project Manager Portal"
            description="Review requests, assign team members, and monitor SLA and escalation status."
            cta="Open portal"
            restricted
          />
        </div>

        {/* Trust strip */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px]"
          style={{ color: 'var(--color-ink-faint)' }}
        >
          {['Response within 24 hours', 'Dedicated project manager', 'Full audit trail'].map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span style={{ color: 'var(--color-emerald-dot)' }} aria-hidden="true">✓</span>
              {s}
            </span>
          ))}
        </div>
      </main>

      <footer
        className="text-center py-5 text-[11.5px]"
        style={{ color: 'var(--color-ink-faint)' }}
      >
        © 2026 Nvara Media · All rights reserved
      </footer>
    </div>
  )
}

function PortalCard({
  onClick,
  variant,
  icon,
  title,
  description,
  cta,
  restricted,
}: {
  onClick: () => void
  variant: 'light' | 'dark'
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  restricted?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const isDark = variant === 'dark'

  const bg = isDark
    ? hovered
      ? 'var(--color-sidebar-hover)'
      : 'var(--color-sidebar)'
    : hovered
    ? 'var(--color-surface-hover)'
    : 'white'

  const border = isDark ? 'var(--color-sidebar-ring)' : 'var(--color-border)'

  const iconBg = isDark ? 'rgba(184,224,90,.12)' : 'var(--color-emerald-bg)'
  const iconColor = isDark ? 'var(--color-accent)' : 'var(--color-emerald-text)'
  const titleColor = isDark ? 'white' : 'var(--color-ink)'
  const descColor = isDark ? 'var(--color-ink-faint)' : 'var(--color-ink-muted)'
  const ctaColor = isDark ? 'var(--color-accent)' : 'var(--color-emerald-text)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group text-left rounded-xl p-6 transition-all duration-150 focus-visible:outline-2"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'background 120ms ease, box-shadow 150ms ease, transform 150ms ease',
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>

      {/* Title + restricted */}
      <div className="flex items-center gap-2 mb-2">
        <h2
          className="text-[15px] font-bold tracking-tight"
          style={{ color: titleColor }}
        >
          {title}
        </h2>
        {restricted && (
          <span
            className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(184,224,90,.12)',
              color: 'var(--color-accent)',
              border: '1px solid rgba(184,224,90,.2)',
            }}
          >
            Auth
          </span>
        )}
      </div>

      <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: descColor }}>
        {description}
      </p>

      <span
        className="inline-flex items-center gap-1 text-[12.5px] font-bold"
        style={{ color: ctaColor }}
      >
        {cta}{' '}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            transform: hovered ? 'translateX(3px)' : 'none',
            transition: 'transform 150ms ease',
          }}
        >
          →
        </span>
      </span>
    </button>
  )
}
