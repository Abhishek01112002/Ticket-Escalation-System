// ─── Public Tracker API Client ────────────────────────────────────────────────
//
// This is a zero-auth public endpoint. No cookies, no Authorization headers.
// The reference is a bearer identifier — do not append it to URLs in contexts
// where it would be logged or tracked (use state-based navigation instead).

export type PublicRequestStatus = 'RECEIVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'

/**
 * Terminal public statuses. Polling must stop when the tracker reaches one of
 * these states. Extend this set as new terminal states are added to the domain.
 */
export const TERMINAL_PUBLIC_STATUSES = new Set<PublicRequestStatus>(['COMPLETED'])

export const STATUS_DISPLAY: Record<
  PublicRequestStatus,
  { label: string; badgeClass: string; iconChar: string }
> = {
  RECEIVED:    { label: 'Received',             badgeClass: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]', iconChar: '◎' },
  ASSIGNED:    { label: 'Specialist Assigned',  badgeClass: 'bg-[#fefce8] text-[#854d0e] border-[#fef08a]', iconChar: '▸' },
  IN_PROGRESS: { label: 'In Progress',          badgeClass: 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]', iconChar: '▶' },
  COMPLETED:   { label: 'Completed',            badgeClass: 'bg-[#ecfdf5] text-[#065f46] border-[#6ee7b7]', iconChar: '✓' },
}

export type PublicMilestoneType =
  | 'REQUEST_RECEIVED'
  | 'SPECIALIST_ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'COMPLETED'

export interface PublicMilestone {
  type: PublicMilestoneType
  label: string
  occurredAt: string | null
  completed: boolean
}

export interface TrackedRequest {
  reference: string
  status: PublicRequestStatus
  statusLabel: string
  serviceArea: string
  submittedAt: string
  lastUpdatedAt: string
  milestones: PublicMilestone[]
}

// ─── Typed Error Classes ──────────────────────────────────────────────────────

export class TrackerNotFoundError extends Error {
  constructor() {
    super('NOT_FOUND')
    this.name = 'TrackerNotFoundError'
  }
}

export class TrackerInvalidReferenceError extends Error {
  constructor() {
    super('INVALID_REFERENCE')
    this.name = 'TrackerInvalidReferenceError'
  }
}

export class TrackerRateLimitedError extends Error {
  constructor(public readonly retryAfterSecs: number) {
    super('RATE_LIMITED')
    this.name = 'TrackerRateLimitedError'
  }
}

// ─── API Call ────────────────────────────────────────────────────────────────

export async function lookupRequest(reference: string): Promise<TrackedRequest> {
  const resp = await fetch(`/v1/track/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // No credentials: 'include' — this is a fully public endpoint
  })

  if (resp.status === 400) throw new TrackerInvalidReferenceError()
  if (resp.status === 404) throw new TrackerNotFoundError()
  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get('retry-after') ?? '60', 10)
    throw new TrackerRateLimitedError(Number.isFinite(retryAfter) ? retryAfter : 60)
  }
  if (!resp.ok) throw new Error(`TRACKER_ERROR:${resp.status}`)

  return resp.json() as Promise<TrackedRequest>
}

// ─── Reference Format Validation (frontend) ──────────────────────────────────

const REFERENCE_RE = /^NVARA-\d{4}-[A-Z0-9]{8,16}$/

export function isValidReferenceFormat(value: string): boolean {
  return REFERENCE_RE.test(value.trim().toUpperCase())
}

export function canonicaliseInput(value: string): string {
  return value.trim().toUpperCase()
}
