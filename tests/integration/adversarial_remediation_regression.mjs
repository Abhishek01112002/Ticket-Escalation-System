import assert from 'node:assert/strict'
import pg from 'pg'

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'
const DB_URL = process.env.DATABASE_URL ?? 'postgres://nvara:nvara_local_dev_only@localhost:55432/nvara'

const pool = new pg.Pool({ connectionString: DB_URL })

console.log('\n── Adversarial Audit Remediation Regression Suite ──\n')

async function runTests() {
  let passed = 0
  let failed = 0

  async function test(name, fn) {
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

  // Setup: Fetch PM login cookie & users
  const pmLoginRes = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@nvaramedia.com', password: 'Nvara#PM2026!Secure' }),
  })
  const pmCookie = pmLoginRes.headers.get('set-cookie')?.split(';')[0]

  const rohanUser = (await pool.query("SELECT id FROM users WHERE email = 'rohan.mehta@nvaramedia.com'")).rows[0]
  const priyaUser = (await pool.query("SELECT id FROM users WHERE email = 'priya.sharma@nvaramedia.com'")).rows[0]

  // Helper to create ticket
  async function createTicket(prefix = 'adv') {
    const key = `create-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({
        name: 'Adversarial Client',
        company: 'AuditCorp',
        email: `client.${Date.now()}@auditcorp.test`,
        phone: '+919876543210',
        serviceDomain: 'web_app_development',
        requirement: 'Full system adversarial verification test ticket.',
        urgency: 'soon',
      }),
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    return body.reference
  }

  // ──────────────────────────────────────────────────────────────────────────
  // P1: PUBLIC TRACKER SEMANTICS (FIND2-P1-02)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Public Tracker Semantics: PM Triage vs Specialist Assignment')

  let trackerRef = ''
  await test('Initial ticket assigned to PM shows RECEIVED in public tracker (NOT Specialist Assigned)', async () => {
    trackerRef = await createTicket('tracker-sem')
    const res = await fetch(`${API_URL}/v1/track/${trackerRef}`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, 'RECEIVED', 'Expected status to be RECEIVED during initial PM triage')
    assert.equal(body.statusLabel, 'Received')
    const specialistMilestone = body.milestones.find(m => m.type === 'SPECIALIST_ASSIGNED')
    assert.equal(specialistMilestone?.completed, false, 'Specialist Assigned milestone must be incomplete')
  })

  await test('Assigning internal specialist transitions public tracker to ASSIGNED', async () => {
    // PM assigns to Rohan
    const assignRes = await fetch(`${API_URL}/v1/pm/requests/${trackerRef}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `assign-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1, assigneeUserId: rohanUser.id }),
    })
    assert.equal(assignRes.status, 200)

    const res = await fetch(`${API_URL}/v1/track/${trackerRef}`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.status, 'ASSIGNED')
    assert.equal(body.statusLabel, 'Specialist Assigned')
    const specialistMilestone = body.milestones.find(m => m.type === 'SPECIALIST_ASSIGNED')
    assert.equal(specialistMilestone?.completed, true)
    assert.ok(specialistMilestone?.occurredAt)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // P0: DELETE / AUDIT INTEGRITY & CONCURRENCY (FIND2-P0-01, FIND2-P2-02)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Delete / Audit Trail Integrity & Concurrency Guards')

  let delRef = ''
  await test('Attempting to delete active/awaiting_acknowledgement request fails with 409', async () => {
    delRef = await createTicket('del-active')
    const res = await fetch(`${API_URL}/v1/pm/requests/${delRef}`, {
      method: 'DELETE',
      headers: { 'Cookie': pmCookie },
    })
    assert.equal(res.status, 409, `Expected 409, got ${res.status}`)
    const body = await res.json()
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION')
  })

  await test('Attempting to delete in_progress request fails with 409', async () => {
    // Acknowledge and start work
    await fetch(`${API_URL}/v1/requests/${delRef}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `ack-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1 }),
    })
    await fetch(`${API_URL}/v1/requests/${delRef}/start-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `start-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 2 }),
    })

    const res = await fetch(`${API_URL}/v1/pm/requests/${delRef}`, {
      method: 'DELETE',
      headers: { 'Cookie': pmCookie },
    })
    assert.equal(res.status, 409)
    const body = await res.json()
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION')
  })

  await test('Attempting to delete with stale expectedVersion returns 409 Conflict', async () => {
    // Resolve ticket first (version will become 4)
    await fetch(`${API_URL}/v1/requests/${delRef}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `resolve-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 3 }),
    })

    // Try deleting with stale version 1
    const res = await fetch(`${API_URL}/v1/pm/requests/${delRef}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie },
      body: JSON.stringify({ expectedVersion: 1 }),
    })
    assert.equal(res.status, 409)
    const body = await res.json()
    assert.equal(body.error.code, 'REQUEST_VERSION_CONFLICT')
  })

  await test('Deleting resolved request succeeds via soft delete', async () => {
    const res = await fetch(`${API_URL}/v1/pm/requests/${delRef}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie },
      body: JSON.stringify({ expectedVersion: 4 }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.success, true)
    assert.equal(body.deletedReference, delRef)
  })

  await test('Deleted request is removed from PM queue and Public Tracker (404)', async () => {
    const queueRes = await fetch(`${API_URL}/v1/pm/requests`, { headers: { 'Cookie': pmCookie } })
    const queueBody = await queueRes.json()
    const foundInQueue = queueBody.requests.some((r) => r.reference === delRef)
    assert.equal(foundInQueue, false, 'Soft-deleted ticket must not appear in active PM queue')

    const trackRes = await fetch(`${API_URL}/v1/track/${delRef}`)
    assert.equal(trackRes.status, 404, 'Soft-deleted ticket must return 404 on public tracker')
  })

  await test('Audit trail & compliance history remain 100% intact after deletion', async () => {
    const auditRes = await pool.query(
      `SELECT a.event_type, a.metadata
       FROM audit_events a
       JOIN requests r ON r.id = a.request_id
       WHERE r.public_reference = $1
       ORDER BY a.occurred_at ASC`,
      [delRef]
    )
    assert.ok(auditRes.rowCount >= 4, `Expected full audit trail preserved, found ${auditRes.rowCount} events`)
    const eventTypes = auditRes.rows.map(r => r.event_type)
    assert.ok(eventTypes.includes('request_created'))
    assert.ok(eventTypes.includes('acknowledged'))
    assert.ok(eventTypes.includes('work_started'))
    assert.ok(eventTypes.includes('resolved'))
    assert.ok(eventTypes.includes('request_deleted'), 'Must include request_deleted audit event')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // P1: ACTIVE VS HISTORICAL ESCALATION ISOLATION (FIND2-P1-04)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Active vs Historical Escalation Isolation after Reassignment')

  let escRef = ''
  await test('Escalation on old assignment is isolated from new healthy assignment post-reassignment', async () => {
    escRef = await createTicket('esc-iso')

    // PM assigns to Rohan (Version 1 -> 2)
    await fetch(`${API_URL}/v1/pm/requests/${escRef}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `assign-rohan-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1, assigneeUserId: rohanUser.id }),
    })

    // Simulate SLA breach on Rohan's assignment in DB
    const reqRow = (await pool.query('SELECT id FROM requests WHERE public_reference = $1', [escRef])).rows[0]
    const slaRow = (await pool.query(
      "SELECT s.id, a.id as assignment_id FROM sla_records s JOIN assignments a ON a.id = s.assignment_id WHERE a.request_id = $1 AND a.ended_at IS NULL",
      [reqRow.id]
    )).rows[0]

    await pool.query("UPDATE sla_records SET status = 'breached', breached_at = now() WHERE id = $1", [slaRow.id])
    await pool.query(
      `INSERT INTO escalation_events (request_id, assignment_id, sla_record_id, responsible_user_id, reason, policy_code, idempotency_key)
       VALUES ($1, $2, $3, $4, 'acknowledgement_sla_breached', 'acknowledgement_24h', $5)`,
      [reqRow.id, slaRow.assignment_id, slaRow.id, rohanUser.id, `manual-breach-${Date.now()}`]
    )

    // Verify detail shows active escalation for Rohan
    const detailBefore = await (await fetch(`${API_URL}/v1/pm/requests/${escRef}`, { headers: { 'Cookie': pmCookie } })).json()
    assert.ok(detailBefore.request.escalation, 'Expected active escalation before reassignment')
    assert.equal(detailBefore.request.escalation.responsibleName, 'Rohan Mehta')

    // PM reassigns to Priya with fresh SLA (Version 2 -> 3)
    const reassignRes = await fetch(`${API_URL}/v1/pm/requests/${escRef}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': `reassign-priya-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 2, assigneeUserId: priyaUser.id }),
    })
    assert.equal(reassignRes.status, 200)

    // Verify detail now shows NO active escalation because Priya's SLA is healthy!
    const detailAfter = await (await fetch(`${API_URL}/v1/pm/requests/${escRef}`, { headers: { 'Cookie': pmCookie } })).json()
    assert.equal(detailAfter.request.escalation, null, 'Active escalation MUST be null on new healthy assignment')
    assert.equal(detailAfter.request.sla.status, 'active')

    // Verify timeline STILL preserves Rohan's historical escalation event
    const timelineRes = await (await fetch(`${API_URL}/v1/pm/requests/${escRef}/timeline`, { headers: { 'Cookie': pmCookie } })).json()
    const reassignedEvent = timelineRes.events.find(e => e.type === 'reassigned')
    assert.ok(reassignedEvent, 'Timeline must retain reassignment and history')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // P2: INTERNAL COMMENT IDEMPOTENCY (FIND2-P2-01)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Internal Comment Idempotency & Deduplication')

  await test('Repeated comment submission with same Idempotency-Key replays exact comment without duplicates', async () => {
    const commentKey = `comment-idem-${Date.now()}`
    const uniqueBody = `Verification note on client deliverable milestones - ${Date.now()}`
    const payload = { body: uniqueBody }

    // Call 1
    const res1 = await fetch(`${API_URL}/v1/pm/requests/${escRef}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': commentKey },
      body: JSON.stringify(payload),
    })
    assert.equal(res1.status, 201)
    const body1 = await res1.json()

    // Call 2 (Double click retry)
    const res2 = await fetch(`${API_URL}/v1/pm/requests/${escRef}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': pmCookie, 'Idempotency-Key': commentKey },
      body: JSON.stringify(payload),
    })
    assert.equal(res2.status, 201)
    const body2 = await res2.json()

    assert.equal(body1.comment.id, body2.comment.id)

    // Check DB count for this comment
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM request_comments WHERE body = $1',
      [uniqueBody]
    )
    assert.equal(parseInt(countRes.rows[0].count, 10), 1, 'Expected exactly 1 comment in DB')
  })

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
  await pool.end()

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err)
  pool.end().finally(() => process.exit(1))
})
