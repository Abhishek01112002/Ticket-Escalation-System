import type { SubmissionConfirmation } from '../../services/clientRequestApi'

export function ConfirmationScreen({
  request,
  onBack,
}: {
  request: SubmissionConfirmation
  onBack(): void
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-2)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-5 sm:px-8"
        style={{
          height: 'var(--topbar-h)',
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
        >
          N
        </span>
        <span className="text-white font-bold text-[14px] tracking-tight">Nvara Media</span>
      </header>

      {/* Content */}
      <main
        className="flex-1 flex items-center justify-center px-5 py-16"
        aria-live="polite"
      >
        <div className="w-full max-w-[480px]">
          {/* Success indicator */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 mx-auto"
            style={{
              background: 'var(--color-emerald-bg)',
              border: '1px solid var(--color-emerald-border)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12l5 5L20 7"
                stroke="var(--color-emerald-dot)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p
            className="text-center text-[10.5px] font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-emerald-text)' }}
          >
            Request Submitted
          </p>
          <h1
            className="text-center text-[26px] font-bold tracking-tight mb-3"
            style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
          >
            Request received
          </h1>
          <p
            className="text-center text-[14px] leading-relaxed mb-7"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            Thank you, <strong style={{ color: 'var(--color-ink)' }}>{request.clientName}</strong>. Our project team will review your request and be in touch shortly.
          </p>

          {/* Reference card */}
          <div
            className="rounded-xl p-5 mb-5 text-center"
            style={{
              background: 'white',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p
              className="text-[10.5px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              Reference Number
            </p>
            <p
              className="text-[22px] font-bold tracking-tight mb-1"
              style={{
                color: 'var(--color-emerald-text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {request.reference}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--color-ink-muted)' }}>
              Keep this reference for your records.
            </p>
          </div>

          {/* Next steps */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{
              background: 'var(--color-emerald-bg)',
              border: '1px solid var(--color-emerald-border)',
            }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: 'var(--color-emerald-text)' }}
            >
              What happens next
            </p>
            <ol className="flex flex-col gap-2.5">
              {[
                'Our project team reviews your request',
                'A specialist is assigned to your project',
                `We contact you at ${request.email}`,
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 text-[13px]" style={{ color: 'var(--color-ink-secondary)' }}>
                  <span
                    className="w-5 h-5 rounded-full text-white text-[10px] font-bold grid place-items-center flex-none mt-0.5"
                    style={{ background: 'var(--color-emerald-dot)' }}
                  >
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-lg text-[13.5px] font-bold transition-all"
            style={{
              background: 'var(--color-accent)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-accent-dark)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Back to home
          </button>
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
