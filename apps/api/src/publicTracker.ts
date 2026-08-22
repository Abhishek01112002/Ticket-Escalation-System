import { createHash } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import type { AppConfig } from '@nvara/config'

// ─── Public Status ────────────────────────────────────────────────────────────
//
// INVARIANT: Internal DB status values are NEVER sent to the client.
// Mapping is intentionally fail-closed: unknown internal states throw rather
// than silently downgrading to a misleading public state.

export type PublicRequestStatus = 'RECEIVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'

/**
 * Terminal states for the tracker UI.
 * Polling must stop when the status is in this set.
 * Add CANCELLED, REJECTED, etc. here as the domain evolves — do not put them
 * in the mapPublicStatus switch without also adding them here.
 */
export const TERMINAL_PUBLIC_STATUSES = new Set<PublicRequestStatus>(['COMPLETED'])

const STATUS_LABELS: Record<PublicRequestStatus, string> = {
  RECEIVED:    'Received',
  ASSIGNED:    'Specialist Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
}

/**
 * Map internal DB status to the public status enum.
 *
 * FAIL CLOSED: an unrecognised internal status throws an Error rather than
 * returning 'RECEIVED'. This forces the API to return a controlled 500 and
 * emit an error log, making mapping failures immediately observable.
 *
 * Never add a default fallback that returns a non-error value.
 */
export function mapPublicStatus(
  dbStatus: string,
  hasAnyAssignment: boolean,
): PublicRequestStatus {
  switch (dbStatus) {
    case 'awaiting_acknowledgement':
      // Before any specialist assignment → RECEIVED; after → ASSIGNED
      return hasAnyAssignment ? 'ASSIGNED' : 'RECEIVED'
    case 'acknowledged':
    case 'in_progress':
      return 'IN_PROGRESS'
    case 'resolved':
      return 'COMPLETED'
    default:
      throw new Error(`unhandled_internal_status:${dbStatus}`)
  }
}

// ─── Public Milestones ────────────────────────────────────────────────────────
//
// INVARIANT: Milestones are derived exclusively from named DB columns.
// The audit_events table is NEVER queried by this endpoint.
// Adding new internal event types to audit_events cannot leak through this path.

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

interface MilestoneRow {
  created_at: Date
  /** Earliest assignment ever created for this request — not just the current active one.
   *  The client milestone is "a specialist was assigned", not "who the current owner is". */
  first_assigned_at: Date | null
  /** Populated from sla_records.acknowledged_at on the CURRENT active assignment. */
  acknowledged_at: Date | null
  resolved_at: Date | null
}

/**
 * Build the 4-step public milestone chain from DB columns.
 * ACKNOWLEDGED and IN_PROGRESS are intentionally NOT duplicated as the same
 * event at the same timestamp — IN_PROGRESS is the status, ACKNOWLEDGED is
 * the milestone. The status badge communicates "In Progress"; the milestone
 * communicates "Acknowledged on date X".
 */
export function buildMilestones(row: MilestoneRow): PublicMilestone[] {
  return [
    {
      type: 'REQUEST_RECEIVED',
      label: 'Request Received',
      occurredAt: row.created_at.toISOString(),
      completed: true, // always true — we only show existing requests
    },
    {
      type: 'SPECIALIST_ASSIGNED',
      label: 'Specialist Assigned',
      occurredAt: row.first_assigned_at?.toISOString() ?? null,
      completed: row.first_assigned_at !== null,
    },
    {
      type: 'ACKNOWLEDGED',
      label: 'Acknowledged',
      occurredAt: row.acknowledged_at?.toISOString() ?? null,
      completed: row.acknowledged_at !== null,
    },
    {
      type: 'COMPLETED',
      label: 'Completed',
      occurredAt: row.resolved_at?.toISOString() ?? null,
      completed: row.resolved_at !== null,
    },
  ]
}

// ─── Public DTO ───────────────────────────────────────────────────────────────

export interface PublicTrackedRequest {
  reference: string
  status: PublicRequestStatus
  statusLabel: string
  serviceArea: string
  submittedAt: string
  lastUpdatedAt: string
  milestones: PublicMilestone[]
}

interface DtoRow extends MilestoneRow {
  public_reference: string
  db_status: string
  service_domain_name: string
}

/**
 * Build the public DTO from a DB row.
 *
 * SECURITY INVARIANT: Every field is explicitly constructed.
 * The DB row is NEVER spread or assigned wholesale.
 * Adding a new column to the query cannot leak data unless this function is
 * explicitly updated to expose it.
 *
 * lastUpdatedAt is derived from the latest client-meaningful state transition
 * timestamp — NOT from requests.updated_at, which can be bumped by internal
 * PM operations (priority changes, etc.) that are invisible to the client.
 */
export function buildPublicDto(row: DtoRow): PublicTrackedRequest {
  const hasAnyAssignment = row.first_assigned_at !== null
  const status = mapPublicStatus(row.db_status, hasAnyAssignment) // throws on unknown status

  // Derive lastUpdatedAt from the latest public-state transition only
  const publicTransitionTimestamps: Date[] = [
    row.created_at,
    ...(row.first_assigned_at ? [row.first_assigned_at] : []),
    ...(row.acknowledged_at ? [row.acknowledged_at] : []),
    ...(row.resolved_at ? [row.resolved_at] : []),
  ]
  const lastUpdatedAt = new Date(
    Math.max(...publicTransitionTimestamps.map((t) => t.getTime())),
  )

  return {
    reference:     row.public_reference,
    status,
    statusLabel:   STATUS_LABELS[status],
    serviceArea:   row.service_domain_name,
    submittedAt:   row.created_at.toISOString(),
    lastUpdatedAt: lastUpdatedAt.toISOString(),
    milestones:    buildMilestones(row),
  }
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────
//
// MULTI-INSTANCE NOTE: These counters are in-process memory.
// In a multi-replica deployment each instance enforces independent limits,
// making the "global" limit effectively per-replica. Migrate to a Redis INCR +
// EXPIRE pattern before scaling to multiple API instances.
//
// Per-instance labelling is intentional to avoid misleading "global guarantee"
// semantics in a distributed context.

const IP_LIMIT_PER_MIN    = 10
const INSTANCE_LIMIT_PER_MIN = 200
const WINDOW_MS           = 60_000

interface Bucket { count: number; resetAt: number }
const ipBuckets   = new Map<string, Bucket>()
let instanceBucket: Bucket = { count: 0, resetAt: Date.now() + WINDOW_MS }

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSecs: number } {
  const now = Date.now()

  // ── Per-instance endpoint floor ──────────────────────────────────────────
  if (now > instanceBucket.resetAt) {
    instanceBucket = { count: 0, resetAt: now + WINDOW_MS }
  }
  if (instanceBucket.count >= INSTANCE_LIMIT_PER_MIN) {
    return { allowed: false, retryAfterSecs: Math.ceil((instanceBucket.resetAt - now) / 1000) }
  }

  // ── Per-IP limit ──────────────────────────────────────────────────────────
  let bucket = ipBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    ipBuckets.set(ip, bucket)
  }
  if (bucket.count >= IP_LIMIT_PER_MIN) {
    return { allowed: false, retryAfterSecs: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  instanceBucket.count++
  return { allowed: true, retryAfterSecs: 0 }
}

// Periodic cleanup to prevent unbounded map growth under sustained traffic
setInterval(
  () => {
    const now = Date.now()
    for (const [ip, b] of ipBuckets) if (now > b.resetAt) ipBuckets.delete(ip)
  },
  5 * 60_000,
).unref()

export function resetTrackerRateLimits(): void {
  ipBuckets.clear()
  instanceBucket = { count: 0, resetAt: Date.now() + WINDOW_MS }
}

// ─── Input Canonicalization ───────────────────────────────────────────────────
//
// Reference entropy note:
//   Current format: NVARA-YYYY-[HEX]{8} → 32 bits of entropy (randomBytes(4))
//   32 bits is defensible at low reference volume; at high volume (≥100k live
//   references) consider upgrading to 10-12 random alphanumeric chars (≥52 bits).
//   The regex below accepts 8–16 suffix chars to be forward-compatible with
//   a future entropy upgrade without a breaking API change.
//
// Security requirement: reference format must be validated before DB lookup.
// Do not let arbitrary strings reach PostgreSQL parameterised query — while
// pg parameterisation prevents SQL injection, length/format validation stops
// verbose error messages and unnecessary DB round-trips.

const REFERENCE_RE = /^NVARA-\d{4}-[A-Z0-9]{8,16}$/

function canonicaliseReference(raw: string): string | null {
  const canon = raw.trim().toUpperCase()
  if (canon.length > 32) return null
  return REFERENCE_RE.test(canon) ? canon : null
}

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerPublicTrackerRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  _config: AppConfig,
): void {
  if (process.env.NODE_ENV !== 'production') {
    app.post('/v1/test/reset-tracker-rate-limit', async () => {
      resetTrackerRateLimits()
      return { success: true }
    })
  }
  app.get<{ Params: { reference: string } }>(
    '/v1/track/:reference',
    async (request, reply) => {
      // ── Security headers ────────────────────────────────────────────────────
      // no-store: prevents CDN/proxy caches retaining client-specific state
      void reply
        .header('cache-control', 'no-store')
        .header('x-robots-tag', 'noindex, nofollow')

      // ── Input canonicalization (BEFORE rate limiting) ─────────────────────
      // Invalid-format requests are rejected immediately without consuming a
      // rate-limit slot — format validation is cheap and doesn't touch the DB.
      const ref = canonicaliseReference(String(request.params.reference ?? ''))
      if (ref === null) {
        return reply.code(400).send({
          error: { code: 'INVALID_REFERENCE', message: 'The reference format is not valid.' },
        })
      }

      // ── Rate limiting (only for valid-format lookups) ──────────────────────
      // request.ip respects Fastify's trustProxy setting — the correct mechanism
      // for extracting real client IP behind a reverse proxy without manually
      // parsing X-Forwarded-For (which is spoofable without proxy trust config).
      const clientIp = request.ip
      const rl = checkRateLimit(clientIp)
      if (!rl.allowed) {
        return reply
          .code(429)
          .header('retry-after', String(rl.retryAfterSecs))
          .header('content-type', 'application/json')
          .send({ error: 'RATE_LIMITED' })
      }

      // ── Redacted logging ─────────────────────────────────────────────────────
      // The reference is a bearer identifier — log only a short SHA-256 fingerprint
      // at INFO level. Full reference is available at DEBUG in development only.
      const refFingerprint = createHash('sha256').update(ref).digest('hex').slice(0, 12)
      request.log.info({ refFingerprint, op: 'tracker_lookup' }, 'public tracker lookup')
      request.log.debug({ refFingerprint, ref }, 'tracker full reference (debug only)')

      // ── DB lookup ────────────────────────────────────────────────────────────
      // Single query. No audit_events. No internal fields.
      // first_assigned_at: earliest assignment ever, not just the current active
      // one — the public milestone is "a specialist was assigned", not "who".
      const result = await pool.query<DtoRow>(
        `
        SELECT
          r.public_reference,
          r.status            AS db_status,
          r.created_at,
          r.resolved_at,
          sd.name             AS service_domain_name,
          fa.first_assigned_at,
          s.acknowledged_at
        FROM requests r
        JOIN service_domains sd ON sd.id = r.service_domain_id
        LEFT JOIN (
          SELECT a.request_id, MIN(a.assigned_at) AS first_assigned_at
          FROM   assignments a
          JOIN   users u ON u.id = a.assignee_user_id
          JOIN   user_roles ur ON ur.user_id = u.id
          JOIN   roles r_role ON r_role.id = ur.role_id
          WHERE  r_role.code = 'internal_team_member'
          GROUP  BY a.request_id
        ) fa ON fa.request_id = r.id
        LEFT JOIN assignments a  ON a.request_id = r.id AND a.ended_at IS NULL
        LEFT JOIN sla_records  s ON s.assignment_id = a.id
        WHERE r.public_reference = $1 AND r.deleted_at IS NULL
        `,
        [ref],
      )

      if (!result.rowCount) {
        // Identical response shape for both "not found" and "wrong format" at
        // the HTTP layer — format invalids are rejected above as 400 before DB
        // lookup, so this 404 is always for a well-formed but absent reference.
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'No request found with this reference.' },
        })
      }

      // ── Public DTO construction (fail-closed) ─────────────────────────────
      let dto: PublicTrackedRequest
      try {
        dto = buildPublicDto(result.rows[0])
      } catch (err) {
        // Unknown internal status — do not expose details externally
        request.log.error({ refFingerprint, err }, 'public status mapping failure — unhandled internal status')
        return reply.code(500).send({
          error: { code: 'INTERNAL_ERROR', message: 'Unable to process this request status.' },
        })
      }

      return reply.code(200).send(dto)
    },
  )
}
