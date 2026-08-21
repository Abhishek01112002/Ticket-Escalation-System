import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canonicaliseInput,
  isValidReferenceFormat,
  lookupRequest,
  STATUS_DISPLAY,
  TERMINAL_PUBLIC_STATUSES,
  TrackerNotFoundError,
  TrackerRateLimitedError,
  type PublicMilestoneType,
  type TrackedRequest,
} from '../../services/trackerApi'

// ─── Constants ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 20_000 // 20s polling for active requests

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Milestone Step ────────────────────────────────────────────────────────

function renderMilestoneIcon(type: PublicMilestoneType) {
  switch (type) {
    case 'REQUEST_RECEIVED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case 'SPECIALIST_ASSIGNED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'ACKNOWLEDGED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    case 'COMPLETED':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="16 12 12 8 8 12" />
          <line x1="12" y1="16" x2="12" y2="8" />
        </svg>
      )
  }
}

function MilestoneStep({
  type,
  label,
  occurredAt,
  completed,
  isLast,
}: {
  type: PublicMilestoneType
  label: string
  occurredAt: string | null
  completed: boolean
  isLast: boolean
}) {
  return (
    <div className="flex gap-4">
      {/* Connector + Icon */}
      <div className="flex flex-col items-center">
        <div
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-[14px] flex-none transition-all duration-300
            ${completed
              ? 'bg-[#059669] border-[#059669] text-white shadow-sm'
              : 'bg-white border-[#e2e8f0] text-[#94a3b8]'
            }`}
          aria-hidden="true"
        >
          {completed ? (
            renderMilestoneIcon(type)
          ) : (
            <span className="w-2 h-2 rounded-full bg-[#cbd5e1]" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-[2px] flex-1 min-h-[28px] mt-1 rounded transition-colors duration-300
              ${completed ? 'bg-[#059669]' : 'bg-[#e2e8f0]'}`}
          />
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 flex-1 ${isLast ? '' : ''}`}>
        <p
          className={`text-[13.5px] font-semibold leading-tight ${
            completed ? 'text-[#0f172a]' : 'text-[#94a3b8]'
          }`}
        >
          {label}
        </p>
        {occurredAt ? (
          <p className="text-[12px] text-[#64748b] mt-0.5">{formatDateTime(occurredAt)}</p>
        ) : (
          <p className="text-[12px] text-[#cbd5e1] mt-0.5 italic">Pending</p>
        )}
      </div>
    </div>
  )
}

// ─── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, statusLabel }: { status: string; statusLabel: string }) {
  const display = STATUS_DISPLAY[status as keyof typeof STATUS_DISPLAY]
  if (!display) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-semibold border ${display.badgeClass}`}
    >
      <span aria-hidden="true">{display.iconChar}</span>
      {statusLabel}
    </span>
  )
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({
  data,
  polling,
}: {
  data: TrackedRequest
  polling: boolean
}) {
  const isTerminal = TERMINAL_PUBLIC_STATUSES.has(data.status)

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
            Tracking Reference
          </span>
          <span className="font-mono text-[17px] font-bold text-[#0f172a] tracking-tight">
            {data.reference}
          </span>
        </div>
        <StatusBadge status={data.status} statusLabel={data.statusLabel} />
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-6 py-4 border-b border-[#f1f5f9]">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-0.5">
            Service Area
          </span>
          <span className="text-[13px] font-semibold text-[#0f172a]">{data.serviceArea}</span>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-0.5">
            Submitted
          </span>
          <span className="text-[13px] font-semibold text-[#0f172a]">
            {formatDate(data.submittedAt)}
          </span>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] mb-0.5">
            Last Updated
          </span>
          <span className="text-[13px] font-semibold text-[#0f172a]">
            {formatDate(data.lastUpdatedAt)}
          </span>
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-5">
          Progress
        </h3>
        <div>
          {data.milestones.map((m, idx) => (
            <MilestoneStep
              key={m.type}
              type={m.type}
              label={m.label}
              occurredAt={m.occurredAt}
              completed={m.completed}
              isLast={idx === data.milestones.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Polling indicator */}
      {!isTerminal && polling && (
        <div className="px-6 pb-4">
          <p className="text-[12px] text-[#94a3b8] flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full bg-[#059669] animate-pulse"
              aria-hidden="true"
            />
            Auto-refreshing status every 20 seconds
          </p>
        </div>
      )}
      {isTerminal && (
        <div className="px-6 pb-4">
          <p className="text-[12px] text-[#94a3b8]">
            This request has been completed. No further updates expected.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Not Found State ─────────────────────────────────────────────────────────

function NotFoundState({ reference }: { reference: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 text-center shadow-sm">
      <div className="w-12 h-12 rounded-full bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] flex items-center justify-center mx-auto mb-4 text-xl">
        ?
      </div>
      <h3 className="text-[15px] font-bold text-[#0f172a] mb-2">Reference Not Found</h3>
      <p className="text-[13.5px] text-[#475569] leading-relaxed mb-1">
        No request was found for reference{' '}
        <span className="font-mono font-semibold text-[#0f172a]">{reference}</span>.
      </p>
      <p className="text-[13px] text-[#64748b] leading-relaxed">
        Please double-check the reference from your confirmation email. If you believe this is an
        error, contact the Nvara Media team directly.
      </p>
    </div>
  )
}

// ─── Rate Limited State ───────────────────────────────────────────────────────

function RateLimitedState({ retryAfterSecs }: { retryAfterSecs: number }) {
  return (
    <div className="bg-white rounded-xl border border-[#fef3c7] p-6 text-center shadow-sm">
      <p className="text-[13.5px] font-semibold text-[#92400e] mb-1">Too many requests</p>
      <p className="text-[13px] text-[#78350f]">
        Please wait {retryAfterSecs} seconds before trying again.
      </p>
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface RequestTrackerScreenProps {
  onBack(): void
  /** Pre-fill the reference field (from Confirmation Screen CTA).
   *  Passed as a prop — reference is NEVER placed in the URL to avoid leaking
   *  a bearer identifier into browser history, logs, and analytics. */
  prefillReference?: string
}

export function RequestTrackerScreen({ onBack, prefillReference }: RequestTrackerScreenProps) {
  const [inputValue, setInputValue] = useState('')
  const [submittedRef, setSubmittedRef] = useState<string | null>(null)
  const [result, setResult] = useState<TrackedRequest | null>(null)
  const [state, setState] = useState<
    'idle' | 'loading' | 'result' | 'not_found' | 'invalid' | 'rate_limited' | 'error'
  >('idle')
  const [rateLimitSecs, setRateLimitSecs] = useState(60)
  const prefillConsumed = useRef(false)

  // ── Core lookup function ─────────────────────────────────────────────────
  const performLookup = useCallback(async (ref: string) => {
    setState('loading')
    setSubmittedRef(ref)
    setResult(null)
    try {
      const data = await lookupRequest(ref)
      setResult(data)
      setState('result')
    } catch (err) {
      if (err instanceof TrackerNotFoundError) {
        setState('not_found')
      } else if (err instanceof TrackerRateLimitedError) {
        setRateLimitSecs(err.retryAfterSecs)
        setState('rate_limited')
      } else {
        setState('error')
      }
    }
  }, [])

  // ── Prefill: consume once on mount, auto-submit ──────────────────────────
  // Using a ref guard prevents React Strict Mode double-invoke from submitting
  // twice, which would waste a rate-limit slot.
  useEffect(() => {
    if (prefillReference && !prefillConsumed.current) {
      prefillConsumed.current = true
      const canon = canonicaliseInput(prefillReference)
      setInputValue(canon)
      if (isValidReferenceFormat(canon)) {
        void performLookup(canon)
      }
    }
  }, [prefillReference, performLookup])

  // ── Short polling: 20s interval, stops on terminal status or unmount ─────
  useEffect(() => {
    if (state !== 'result' || !result || !submittedRef) return
    if (TERMINAL_PUBLIC_STATUSES.has(result.status)) return // no poll on terminal

    const intervalId = setInterval(() => {
      lookupRequest(submittedRef)
        .then((fresh) => {
          setResult(fresh)
        })
        .catch(() => {
          // Silently absorb poll errors — user can manually refresh
        })
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [state, result, submittedRef])

  // ── Form submit ───────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const canon = canonicaliseInput(inputValue)
    if (!isValidReferenceFormat(canon)) {
      setState('invalid')
      return
    }
    void performLookup(canon)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value.toUpperCase())
    if (state === 'invalid') setState('idle')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f5] text-[#0b131b]">
      {/* ── Topbar ── */}
      <header className="h-14 border-b border-[#e2e8e5] bg-white px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#0b131b] text-white flex items-center justify-center font-bold text-xs">
            N
          </div>
          <span className="font-bold text-[14px] tracking-tight text-[#0b131b]">Nvara Media</span>
          <span className="text-[12px] font-medium text-[#64748b] hidden sm:inline-block">
            / Track Request
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#64748b] hover:text-[#0f172a] px-2.5 py-1 rounded border border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors cursor-pointer"
        >
          <span>←</span>
          <span>Portal Home</span>
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center px-5 py-12 sm:py-16">
        <div className="max-w-[520px] w-full">
          {/* Page heading */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] text-[12px] font-semibold mb-3">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Request Status Tracker</span>
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[#0f172a] leading-tight mb-2">
              Track your request status
            </h1>
            <p className="text-[14px] text-[#475569] leading-relaxed">
              Enter the reference number from your submission confirmation to check the current
              progress of your request.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="mb-6" noValidate>
            <label
              htmlFor="tracker-ref"
              className="block text-[13px] font-semibold text-[#0f172a] mb-1.5"
            >
              Tracking Reference
            </label>
            <div className="flex gap-2">
              <input
                id="tracker-ref"
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="NVARA-2026-XXXXXXXX"
                maxLength={32}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={`flex-1 font-mono text-[14px] px-3.5 py-2.5 rounded-lg border bg-white placeholder-[#94a3b8] text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] transition-colors ${
                  state === 'invalid'
                    ? 'border-[#fca5a5] ring-1 ring-[#fca5a5]'
                    : 'border-[#cbd5e1]'
                }`}
                aria-describedby={state === 'invalid' ? 'tracker-ref-error' : undefined}
                aria-invalid={state === 'invalid'}
                disabled={state === 'loading'}
              />
              <button
                type="submit"
                disabled={state === 'loading' || !inputValue.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#0f172a] text-white text-[13.5px] font-semibold hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
              >
                {state === 'loading' ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    Checking…
                  </>
                ) : (
                  'Track'
                )}
              </button>
            </div>

            {state === 'invalid' && (
              <p id="tracker-ref-error" role="alert" className="mt-1.5 text-[12.5px] text-[#dc2626]">
                Please enter a valid reference (e.g. NVARA-2026-A3F2B8C1).
              </p>
            )}

            {state === 'error' && (
              <p role="alert" className="mt-1.5 text-[12.5px] text-[#dc2626]">
                Something went wrong. Please try again.
              </p>
            )}
          </form>

          {/* Results */}
          {state === 'result' && result && (
            <ResultCard data={result} polling={!TERMINAL_PUBLIC_STATUSES.has(result.status)} />
          )}
          {state === 'not_found' && submittedRef && (
            <NotFoundState reference={submittedRef} />
          )}
          {state === 'rate_limited' && (
            <RateLimitedState retryAfterSecs={rateLimitSecs} />
          )}
        </div>
      </main>
    </div>
  )
}
