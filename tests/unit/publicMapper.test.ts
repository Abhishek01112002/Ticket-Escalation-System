/**
 * publicMapper.test.ts
 *
 * Contract-level unit tests for the Public Tracker DTO builder and mapper.
 *
 * These tests enforce the strongest possible invariant:
 *   - The PUBLIC response is EXACTLY the fields in the allowlist
 *   - No new internal field can leak without this file failing
 *   - Unknown internal statuses MUST throw (fail-closed)
 *   - Milestone list is always exactly 4 items in correct order
 *
 * Run: npx tsx --test tests/unit/publicMapper.test.ts
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import {
  mapPublicStatus,
  buildMilestones,
  buildPublicDto,
} from '../../apps/api/src/publicTracker.js'

// ─── Test Data ──────────────────────────────────────────────────────────────

const BASE_DATE = new Date('2026-08-14T09:30:00Z')
const ASSIGNED_DATE = new Date('2026-08-14T11:00:00Z')
const ACKNOWLEDGED_DATE = new Date('2026-08-14T18:00:00Z')
const RESOLVED_DATE = new Date('2026-08-15T10:00:00Z')

function makeRow(overrides: {
  db_status?: string
  first_assigned_at?: Date | null
  acknowledged_at?: Date | null
  resolved_at?: Date | null
  service_domain_name?: string
} = {}): Parameters<typeof buildPublicDto>[0] {
  return {
    public_reference: 'NVARA-2026-A3F2B8C1',
    db_status: overrides.db_status ?? 'awaiting_acknowledgement',
    service_domain_name: overrides.service_domain_name ?? 'SEO',
    created_at: BASE_DATE,
    first_assigned_at: overrides.first_assigned_at !== undefined
      ? overrides.first_assigned_at
      : ASSIGNED_DATE,
    acknowledged_at: overrides.acknowledged_at !== undefined
      ? overrides.acknowledged_at
      : null,
    resolved_at: overrides.resolved_at !== undefined
      ? overrides.resolved_at
      : null,
  }
}

// ─── Allowlist DTO Keys ──────────────────────────────────────────────────────

/** The COMPLETE and EXHAUSTIVE list of keys the public DTO may contain.
 *  Any new key added to buildPublicDto MUST also be added here intentionally.
 *  This is the primary regression guard. */
const ALLOWED_DTO_KEYS = [
  'lastUpdatedAt',
  'milestones',
  'reference',
  'serviceArea',
  'status',
  'statusLabel',
  'submittedAt',
].sort()

/** The complete list of keys each milestone may contain. */
const ALLOWED_MILESTONE_KEYS = ['completed', 'label', 'occurredAt', 'type'].sort()

/** Internal DB fields that must NEVER appear in the public DTO. */
const FORBIDDEN_DTO_FIELDS = [
  'assignee', 'assigneeEmail', 'assigneeId', 'assigneeName',
  'clientEmail', 'clientName', 'clientPhone', 'clientId',
  'sla', 'slaStatus', 'sla_status', 'deadline', 'breachedAt',
  'escalation', 'escalationEvents',
  'internalNotes', 'priority', 'internalPriority',
  'auditTrail', 'auditEvents',
  'organizationId', 'organization_id',
  'id', 'version',
  'requirement', 'urgency',
  'db_status', 'service_domain_name', 'public_reference',
  'first_assigned_at', 'acknowledged_at', 'resolved_at', 'created_at',
]

// ─── mapPublicStatus ─────────────────────────────────────────────────────────

describe('mapPublicStatus', () => {
  test('awaiting_acknowledgement without assignment → RECEIVED', () => {
    assert.equal(mapPublicStatus('awaiting_acknowledgement', false), 'RECEIVED')
  })

  test('awaiting_acknowledgement with assignment → ASSIGNED', () => {
    assert.equal(mapPublicStatus('awaiting_acknowledgement', true), 'ASSIGNED')
  })

  test('acknowledged → IN_PROGRESS', () => {
    assert.equal(mapPublicStatus('acknowledged', true), 'IN_PROGRESS')
  })

  test('in_progress → IN_PROGRESS', () => {
    assert.equal(mapPublicStatus('in_progress', true), 'IN_PROGRESS')
  })

  test('resolved → COMPLETED', () => {
    assert.equal(mapPublicStatus('resolved', true), 'COMPLETED')
  })

  test('unknown internal status THROWS (fail-closed — never silently downgrades)', () => {
    assert.throws(
      () => mapPublicStatus('cancelled', true),
      /unhandled_internal_status/,
    )
    assert.throws(
      () => mapPublicStatus('blocked', false),
      /unhandled_internal_status/,
    )
    assert.throws(
      () => mapPublicStatus('reopened', true),
      /unhandled_internal_status/,
    )
    assert.throws(
      () => mapPublicStatus('pm_escalated', true),
      /unhandled_internal_status/,
    )
    assert.throws(
      () => mapPublicStatus('', false),
      /unhandled_internal_status/,
    )
  })
})

// ─── buildMilestones ─────────────────────────────────────────────────────────

describe('buildMilestones', () => {
  test('always returns exactly 4 milestones in fixed order', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: null,
      acknowledged_at: null,
      resolved_at: null,
    })
    assert.equal(ms.length, 4)
    assert.equal(ms[0].type, 'REQUEST_RECEIVED')
    assert.equal(ms[1].type, 'SPECIALIST_ASSIGNED')
    assert.equal(ms[2].type, 'ACKNOWLEDGED')
    assert.equal(ms[3].type, 'COMPLETED')
  })

  test('REQUEST_RECEIVED is always completed with created_at timestamp', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: null,
      acknowledged_at: null,
      resolved_at: null,
    })
    assert.equal(ms[0].completed, true)
    assert.equal(ms[0].occurredAt, BASE_DATE.toISOString())
  })

  test('SPECIALIST_ASSIGNED reflects first_assigned_at, not current assignee', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: ASSIGNED_DATE,
      acknowledged_at: null,
      resolved_at: null,
    })
    assert.equal(ms[1].completed, true)
    assert.equal(ms[1].occurredAt, ASSIGNED_DATE.toISOString())
  })

  test('SPECIALIST_ASSIGNED incomplete when no assignment ever existed', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: null,
      acknowledged_at: null,
      resolved_at: null,
    })
    assert.equal(ms[1].completed, false)
    assert.equal(ms[1].occurredAt, null)
  })

  test('ACKNOWLEDGED and COMPLETED have independent timestamps', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: ASSIGNED_DATE,
      acknowledged_at: ACKNOWLEDGED_DATE,
      resolved_at: RESOLVED_DATE,
    })
    assert.equal(ms[2].occurredAt, ACKNOWLEDGED_DATE.toISOString())
    assert.equal(ms[3].occurredAt, RESOLVED_DATE.toISOString())
    // They must NOT be the same timestamp (the ACKNOWLEDGED=IN_PROGRESS bug)
    assert.notEqual(ms[2].occurredAt, ms[3].occurredAt)
  })

  test('each milestone has exactly the allowed keys', () => {
    const ms = buildMilestones({
      created_at: BASE_DATE,
      first_assigned_at: null,
      acknowledged_at: null,
      resolved_at: null,
    })
    for (const m of ms) {
      assert.deepEqual(
        Object.keys(m).sort(),
        ALLOWED_MILESTONE_KEYS,
        `Milestone ${m.type} has unexpected keys`,
      )
    }
  })
})

// ─── buildPublicDto ──────────────────────────────────────────────────────────

describe('buildPublicDto — allowlist key assertion (primary regression guard)', () => {
  test('DTO contains EXACTLY the allowed keys — no more, no less', () => {
    const dto = buildPublicDto(makeRow())
    assert.deepEqual(
      Object.keys(dto).sort(),
      ALLOWED_DTO_KEYS,
      `DTO key mismatch. Expected: ${ALLOWED_DTO_KEYS.join(', ')}. Got: ${Object.keys(dto).sort().join(', ')}`,
    )
  })

  test('forbidden internal fields are absent from DTO', () => {
    const dto = buildPublicDto(makeRow({ db_status: 'in_progress' }))
    const dtoStr = JSON.stringify(dto)
    for (const field of FORBIDDEN_DTO_FIELDS) {
      assert.ok(
        !Object.prototype.hasOwnProperty.call(dto, field),
        `Forbidden field "${field}" found in public DTO`,
      )
      // Also ensure the field name doesn't appear as a nested key label
      assert.ok(
        !dtoStr.includes(`"${field}"`),
        `Forbidden field "${field}" appears somewhere in serialised DTO`,
      )
    }
  })

  test('lastUpdatedAt is the latest public transition — not created_at when later events exist', () => {
    const dto = buildPublicDto(makeRow({
      db_status: 'resolved',
      first_assigned_at: ASSIGNED_DATE,
      acknowledged_at: ACKNOWLEDGED_DATE,
      resolved_at: RESOLVED_DATE,
    }))
    assert.equal(dto.lastUpdatedAt, RESOLVED_DATE.toISOString())
    assert.notEqual(dto.lastUpdatedAt, BASE_DATE.toISOString())
  })

  test('lastUpdatedAt falls back to created_at when no subsequent events exist', () => {
    const dto = buildPublicDto(makeRow({
      db_status: 'awaiting_acknowledgement',
      first_assigned_at: null,
      acknowledged_at: null,
      resolved_at: null,
    }))
    assert.equal(dto.lastUpdatedAt, BASE_DATE.toISOString())
  })

  test('throws on unknown internal status — does not silently produce a DTO', () => {
    assert.throws(
      () => buildPublicDto(makeRow({ db_status: 'cancelled' })),
      /unhandled_internal_status/,
    )
  })

  test('serviceArea is the human-readable domain name from DB, not a raw slug', () => {
    const dto = buildPublicDto(makeRow({ service_domain_name: 'Social Media Marketing' }))
    assert.equal(dto.serviceArea, 'Social Media Marketing')
  })

  test('reference is preserved exactly from DB', () => {
    const dto = buildPublicDto(makeRow())
    assert.equal(dto.reference, 'NVARA-2026-A3F2B8C1')
  })

  test('adding a new property to the input row does NOT change DTO output', () => {
    // Simulate a developer accidentally adding a raw column to the query
    const rowWithExtra = {
      ...makeRow({ db_status: 'in_progress' }),
      // These simulate newly-added columns that must NOT leak
      assignee_email: 'specialist@nvara.com',
      sla_status: 'breached',
      internal_priority: 'urgent',
    }
    // buildPublicDto only reads explicitly named properties — extras are ignored
    const dto = buildPublicDto(rowWithExtra as Parameters<typeof buildPublicDto>[0])
    assert.deepEqual(Object.keys(dto).sort(), ALLOWED_DTO_KEYS)
    assert.ok(!JSON.stringify(dto).includes('specialist@nvara.com'))
    assert.ok(!JSON.stringify(dto).includes('breached'))
  })
})
