/**
 * tracker_security.mjs
 *
 * Integration security tests for GET /v1/track/:reference
 *
 * Tests:
 *  - Valid reference returns correct DTO shape with no forbidden fields
 *  - Allowlist equality: exactly the expected top-level keys
 *  - Invalid reference format → 400
 *  - Well-formed but absent reference → 404 (identical shape for all not-found)
 *  - Rate limiting: 11th request → 429 with Retry-After header
 *  - Security headers: Cache-Control: no-store, X-Robots-Tag present
 *  - Adversarial inputs: SQL payloads, unicode, oversized, whitespace
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4000 node tests/integration/tracker_security.mjs
 */

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'

let passed = 0
let failed = 0

async function t(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`)
}

async function track(ref, options = {}) {
  return fetch(`${API_URL}/v1/track/${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...options,
  })
}

// ─── Test Groups ──────────────────────────────────────────────────────────────

console.log('\n── Public Tracker Security Tests ──\n')

// ── Security Headers ─────────────────────────────────────────────────────────
console.log('Security Headers')

await t('Cache-Control: no-store present on 404 response', async () => {
  const res = await track('NVARA-2026-FFFFFFFF')
  const cc = res.headers.get('cache-control') ?? ''
  assert(cc.toLowerCase().includes('no-store'), `Expected no-store, got: ${cc}`)
})

await t('X-Robots-Tag: noindex, nofollow present', async () => {
  const res = await track('NVARA-2026-FFFFFFFF')
  const tag = res.headers.get('x-robots-tag') ?? ''
  assert(tag.includes('noindex'), `Expected noindex in X-Robots-Tag, got: ${tag}`)
  assert(tag.includes('nofollow'), `Expected nofollow in X-Robots-Tag, got: ${tag}`)
})

await t('Cache-Control: no-store present on 400 response', async () => {
  const res = await track('NOT-A-VALID-REF')
  const cc = res.headers.get('cache-control') ?? ''
  assert(cc.toLowerCase().includes('no-store'), `Expected no-store, got: ${cc}`)
})

// ── Input Validation ─────────────────────────────────────────────────────────
console.log('\nInput Validation')

const MALFORMED_INPUTS = [
  ['empty string', ''],
  ['whitespace only', '   '],
  ['missing year', 'NVARA-AAAAAAAA'],
  ['wrong prefix', 'NVARA2026AAAAAAAA'],
  ['too short suffix', 'NVARA-2026-AAAA'],
  ['too long overall', 'NVARA-2026-' + 'A'.repeat(25)],
  ['SQL injection chars in suffix', "NVARA-2026-' OR '1'="],
  ['unicode chars in suffix', 'NVARA-2026-ΑΒΓΔΕΖΗΘ'],
  ['special chars in suffix', 'NVARA-2026-@#$%^&*('],
  ['path traversal', '../../../etc/passwd'],
]

for (const [label, input] of MALFORMED_INPUTS) {
  await t(`malformed input (${label}) → 400`, async () => {
    const res = await track(input)
    assertEqual(res.status, 400, `Expected 400 for input: ${JSON.stringify(input)}, got ${res.status}`)
    const body = await res.json()
    assert(body.error?.code === 'INVALID_REFERENCE', `Expected INVALID_REFERENCE code, got: ${JSON.stringify(body)}`)
  })
}

// ── Not-Found Behaviour ──────────────────────────────────────────────────────
console.log('\nNot-Found Behaviour')

await t('well-formed but absent reference → 404', async () => {
  const res = await track('NVARA-2026-00000000')
  assertEqual(res.status, 404)
})

await t('404 body has standard error shape', async () => {
  const res = await track('NVARA-2026-00000000')
  const body = await res.json()
  assert(body.error?.code === 'NOT_FOUND', `Expected NOT_FOUND code, got: ${JSON.stringify(body)}`)
  assert(typeof body.error.message === 'string', 'Expected error.message to be a string')
})

await t('404 body must NOT contain any reference-specific data hint', async () => {
  const res = await track('NVARA-2026-DEADBEEF')
  const body = await res.json()
  const bodyStr = JSON.stringify(body)
  // Must not include the reference in the error response
  assert(!bodyStr.includes('DEADBEEF'), 'Response must not echo back the reference')
  // Must not include internal field names
  assert(!bodyStr.includes('assignee'), 'Response must not include assignee')
  assert(!bodyStr.includes('sla'), 'Response must not include sla field')
})

// ── DTO Allowlist (only runs if a real reference exists in DB) ────────────────
// This section is skipped gracefully in a fresh DB with no submitted requests.
// Run after submitting at least one request via the client portal.
console.log('\nDTO Allowlist (requires at least one DB record)')

const ALLOWED_TOP_LEVEL_KEYS = [
  'lastUpdatedAt', 'milestones', 'reference',
  'serviceArea', 'status', 'statusLabel', 'submittedAt',
].sort()

const FORBIDDEN_FIELDS = [
  'assignee', 'assigneeEmail', 'assigneeId', 'assigneeName',
  'clientEmail', 'clientName', 'clientPhone', 'clientId',
  'sla', 'slaStatus', 'breachedAt', 'escalation',
  'internalNotes', 'priority', 'auditTrail', 'auditEvents',
  'organizationId', 'id', 'version', 'requirement', 'urgency',
  'db_status', 'service_domain_name', 'public_reference',
]

// Try to find a real reference by hitting a known-good one from the seed
// In CI you'd pass a reference via env var from the E2E setup step
const TEST_REFERENCE = process.env.TEST_TRACKER_REFERENCE
if (TEST_REFERENCE) {
  await t('valid reference → 200', async () => {
    const res = await track(TEST_REFERENCE)
    assertEqual(res.status, 200)
  })

  await t('DTO top-level keys are EXACTLY the allowlist (allowlist equality)', async () => {
    const res = await track(TEST_REFERENCE)
    const body = await res.json()
    const keys = Object.keys(body).sort()
    assert(
      JSON.stringify(keys) === JSON.stringify(ALLOWED_TOP_LEVEL_KEYS),
      `Key mismatch.\nExpected: ${ALLOWED_TOP_LEVEL_KEYS.join(', ')}\nGot:      ${keys.join(', ')}`,
    )
  })

  await t('DTO contains no forbidden internal fields', async () => {
    const res = await track(TEST_REFERENCE)
    const body = await res.json()
    const bodyStr = JSON.stringify(body)
    for (const field of FORBIDDEN_FIELDS) {
      assert(
        !bodyStr.includes(`"${field}"`),
        `Forbidden field "${field}" found in public DTO response`,
      )
    }
  })

  await t('milestones array has exactly 4 items with allowed keys', async () => {
    const res = await track(TEST_REFERENCE)
    const { milestones } = await res.json()
    assertEqual(milestones.length, 4)
    const allowedMilestoneKeys = ['completed', 'label', 'occurredAt', 'type'].sort()
    for (const m of milestones) {
      const keys = Object.keys(m).sort()
      assert(
        JSON.stringify(keys) === JSON.stringify(allowedMilestoneKeys),
        `Milestone ${m.type} key mismatch: ${keys.join(', ')}`,
      )
    }
  })

  await t('status field is one of the valid public enum values', async () => {
    const res = await track(TEST_REFERENCE)
    const { status } = await res.json()
    const valid = ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED']
    assert(valid.includes(status), `Invalid status value: ${status}`)
  })
} else {
  console.log('  (skipped — set TEST_TRACKER_REFERENCE env var to test with a real reference)')
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
console.log('\nRate Limiting')

await fetch('http://127.0.0.1:4000/v1/test/reset-tracker-rate-limit', { method: 'POST' }).catch(() => {})

await t('11th request within 60s window from same IP → 429 with Retry-After', async () => {
  // Send 10 requests (the limit) — these should all succeed or 404
  const DUMMY_REF = 'NVARA-2026-RATELIMIT'
  for (let i = 0; i < 10; i++) {
    await track(DUMMY_REF)
  }
  // 11th request should be rate limited
  const res = await track(DUMMY_REF)
  assertEqual(res.status, 429, 'Expected 429 on 11th request')
  const retryAfter = res.headers.get('retry-after')
  assert(retryAfter !== null, 'Expected Retry-After header on 429')
  assert(parseInt(retryAfter, 10) > 0, `Expected positive Retry-After, got: ${retryAfter}`)
  const body = await res.json()
  assertEqual(body.error, 'RATE_LIMITED')
})

await fetch('http://127.0.0.1:4000/v1/test/reset-tracker-rate-limit', { method: 'POST' }).catch(() => {})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
