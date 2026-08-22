import assert from 'node:assert/strict'
import pg from 'pg'

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'
const DB_URL = process.env.DATABASE_URL ?? 'postgres://nvara:nvara_local_dev_only@localhost:55432/nvara'

const pool = new pg.Pool({ connectionString: DB_URL })

console.log('\n══════════════════════════════════════════════════════════════')
console.log('       FINAL RELEASE CANDIDATE ACCEPTANCE TEST SUITE          ')
console.log('══════════════════════════════════════════════════════════════\n')

async function runAcceptance() {
  let passed = 0
  let failed = 0

  async function step(journeyName, stepName, fn) {
    try {
      await fn()
      console.log(`  ✓ [${journeyName}] ${stepName}`)
      passed++
    } catch (err) {
      console.error(`  ✗ [${journeyName}] ${stepName}`)
      console.error(`    ${err.stack || err.message}`)
      failed++
    }
  }

  // Global ticket creation helper
  async function createTicket(prefix = 'rc') {
    const key = `create-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({
        name: 'Aarav Patel',
        company: 'Vanguard Retail Tech',
        email: `aarav.${Date.now()}@vanguardretail.in`,
        phone: '+919820011223',
        serviceDomain: 'digital_marketing',
        requirement: 'Omnichannel Black Friday paid search and performance marketing campaign setup.',
        urgency: 'time_sensitive',
      }),
    })
    assert.equal(res.status, 201)
    const body = await res.json()
    return body.reference
  }

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 1 — NEW CLIENT REQUEST & PUBLIC TRACKER
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ Journey 1: New Client Request & Public Tracker Semantics')
  let j1Ref = ''
  let j1Id = ''

  await step('Journey 1', 'Client submits realistic digital marketing request with idempotency', async () => {
    j1Ref = await createTicket('j1-intake')
    assert.ok(j1Ref.startsWith('NVARA-2026-'))
  })

  await step('Journey 1', 'Verify persistence in PostgreSQL database with single initial PM assignment', async () => {
    const dbRes = await pool.query(
      `SELECT r.id, r.status, r.version, r.deleted_at, a.id AS assignment_id, u.email AS assignee_email, role.code AS role_code
       FROM requests r
       JOIN assignments a ON a.request_id = r.id AND a.ended_at IS NULL
       JOIN users u ON u.id = a.assignee_user_id
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles role ON role.id = ur.role_id
       WHERE r.public_reference = $1`,
      [j1Ref]
    )
    assert.equal(dbRes.rowCount, 1)
    const row = dbRes.rows[0]
    j1Id = row.id
    assert.equal(row.status, 'awaiting_acknowledgement')
    assert.equal(row.version, 1)
    assert.equal(row.deleted_at, null)
    assert.equal(row.role_code, 'project_manager')
  })

  await step('Journey 1', 'Public tracker returns RECEIVED (not Specialist Assigned) during PM triage', async () => {
    const res = await fetch(`${API_URL}/v1/track/${j1Ref}`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.reference, j1Ref)
    assert.equal(body.status, 'RECEIVED')
    assert.equal(body.statusLabel, 'Received')
    assert.equal(body.serviceArea, 'Digital Marketing')
    const specialistMilestone = body.milestones.find(m => m.type === 'SPECIALIST_ASSIGNED')
    assert.equal(specialistMilestone?.completed, false, 'Specialist Assigned milestone must not be completed during PM triage')
  })

  await step('Journey 1', 'Zero information leak on public tracker endpoint', async () => {
    const res = await fetch(`${API_URL}/v1/track/${j1Ref}`)
    const text = await res.text()
    assert.ok(!text.includes('pm@nvaramedia.com'), 'Must not leak PM email')
    assert.ok(!text.includes('aarav.patel@vanguardretail.in'), 'Must not leak client email')
    assert.ok(!text.includes('+919820011223'), 'Must not leak client phone')
    assert.ok(!text.includes('audit_events'), 'Must not leak audit internals')
    assert.ok(!text.includes('sla_record'), 'Must not leak raw SLA internals')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 2 — PM ASSIGNMENT & SPECIALIST TRANSITION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 2: PM Assignment & Timeline Audit')
  let pmCookie = ''
  let rohanUser = null
  let priyaUser = null

  await step('Journey 2', 'PM signs in with credentials and receives secure session cookie', async () => {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pm@nvaramedia.com', password: 'Nvara#PM2026!Secure' }),
    })
    assert.equal(res.status, 200)
    pmCookie = res.headers.get('set-cookie')?.split(';')[0]
    assert.ok(pmCookie.includes('nvara_session'))

    rohanUser = (await pool.query("SELECT id, display_name FROM users WHERE email = 'rohan.mehta@nvaramedia.com'")).rows[0]
    priyaUser = (await pool.query("SELECT id, display_name FROM users WHERE email = 'priya.sharma@nvaramedia.com'")).rows[0]
  })

  await step('Journey 2', 'PM reviews Operations Queue and opens request detail', async () => {
    const queueRes = await fetch(`${API_URL}/v1/pm/requests`, { headers: { Cookie: pmCookie } })
    assert.equal(queueRes.status, 200)
    const queue = await queueRes.json()
    const found = queue.requests.find(r => r.reference === j1Ref)
    assert.ok(found, 'Request must appear in PM queue')
    assert.equal(found.status, 'awaiting_acknowledgement')

    const detailRes = await fetch(`${API_URL}/v1/pm/requests/${j1Ref}`, { headers: { Cookie: pmCookie } })
    assert.equal(detailRes.status, 200)
  })

  await step('Journey 2', 'PM assigns specialist Rohan Mehta and verifies fresh 24h SLA', async () => {
    const assignRes = await fetch(`${API_URL}/v1/pm/requests/${j1Ref}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `assign-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1, assigneeUserId: rohanUser.id }),
    })
    assert.equal(assignRes.status, 200)
    const detail = await assignRes.json()
    assert.equal(detail.request.version, 2)
    assert.equal(detail.request.currentResponsibility?.name, 'Rohan Mehta')
    assert.equal(detail.request.sla?.status, 'active')
    assert.ok(detail.request.sla?.deadlineAt)

    // Verify old assignment superseded
    const oldAssignments = await pool.query(
      'SELECT id, ended_at, end_reason FROM assignments WHERE request_id = $1 AND ended_at IS NOT NULL',
      [j1Id]
    )
    assert.equal(oldAssignments.rowCount, 1)
    assert.equal(oldAssignments.rows[0].end_reason, 'reassigned')
  })

  await step('Journey 2', 'Public tracker now transitions to Specialist Assigned', async () => {
    const trackRes = await fetch(`${API_URL}/v1/track/${j1Ref}`)
    assert.equal(trackRes.status, 200)
    const body = await trackRes.json()
    assert.equal(body.status, 'ASSIGNED')
    assert.equal(body.statusLabel, 'Specialist Assigned')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 3 — SPECIALIST WORKFLOW LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 3: Specialist Full Workflow Lifecycle')
  let rohanCookie = ''

  await step('Journey 3', 'Specialist Rohan signs in and views assigned ticket', async () => {
    const res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohan.mehta@nvaramedia.com', password: 'Rohan#Ops2026!Dev' }),
    })
    assert.equal(res.status, 200)
    rohanCookie = res.headers.get('set-cookie')?.split(';')[0]
  })

  await step('Journey 3', 'Rohan acknowledges request (awaiting_acknowledgement -> acknowledged)', async () => {
    const ackRes = await fetch(`${API_URL}/v1/requests/${j1Ref}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie, 'Idempotency-Key': `rohan-ack-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 2 }),
    })
    assert.equal(ackRes.status, 200)
    const body = await ackRes.json()
    assert.equal(body.request.status, 'acknowledged')
    assert.equal(body.request.version, 3)
    assert.ok(body.request.sla?.acknowledgedAt)
  })

  await step('Journey 3', 'Rohan begins execution (acknowledged -> in_progress)', async () => {
    const startRes = await fetch(`${API_URL}/v1/requests/${j1Ref}/start-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie, 'Idempotency-Key': `rohan-start-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 3 }),
    })
    assert.equal(startRes.status, 200)
    const body = await startRes.json()
    assert.equal(body.request.status, 'in_progress')
    assert.equal(body.request.version, 4)
  })

  await step('Journey 3', 'Rohan resolves deliverables (in_progress -> resolved)', async () => {
    const resRes = await fetch(`${API_URL}/v1/requests/${j1Ref}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie, 'Idempotency-Key': `rohan-resolve-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 4 }),
    })
    assert.equal(resRes.status, 200)
    const body = await resRes.json()
    assert.equal(body.request.status, 'resolved')
    assert.equal(body.request.version, 5)
    assert.equal(body.request.sla?.status, 'closed')
  })

  await step('Journey 3', 'Public tracker reflects COMPLETED state', async () => {
    const trackRes = await fetch(`${API_URL}/v1/track/${j1Ref}`)
    assert.equal(trackRes.status, 200)
    const body = await trackRes.json()
    assert.equal(body.status, 'COMPLETED')
    assert.equal(body.statusLabel, 'Completed')
    const completedMilestone = body.milestones.find(m => m.type === 'COMPLETED')
    assert.equal(completedMilestone?.completed, true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 4 — PM OPERATIONAL OVERRIDE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 4: PM Operational Override & Audit Authorization')
  let j4Ref = ''

  await step('Journey 4', 'Create request assigned to Priya where PM performs operational override', async () => {
    j4Ref = await createTicket('pm-override')
    // PM assigns to Priya
    await fetch(`${API_URL}/v1/pm/requests/${j4Ref}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `assign-priya-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1, assigneeUserId: priyaUser.id }),
    })

    // PM acknowledges on behalf of Priya
    const pmAck = await fetch(`${API_URL}/v1/requests/${j4Ref}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `pm-ack-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 2 }),
    })
    assert.equal(pmAck.status, 200)
  })

  await step('Journey 4', 'Verify audit metadata contains override=true and originalAssigneeUserId', async () => {
    const auditRes = await pool.query(
      `SELECT a.metadata, a.actor_user_id, u.email as actor_email
       FROM audit_events a
       JOIN requests r ON r.id = a.request_id
       JOIN users u ON u.id = a.actor_user_id
       WHERE r.public_reference = $1 AND a.event_type = 'acknowledged'`,
      [j4Ref]
    )
    assert.equal(auditRes.rowCount, 1)
    const audit = auditRes.rows[0]
    assert.equal(audit.actor_email, 'pm@nvaramedia.com')
    assert.equal(audit.metadata.override, true)
    assert.equal(audit.metadata.originalAssigneeUserId, priyaUser.id)
  })

  await step('Journey 4', 'Non-assigned specialist Rohan receives 403 Forbidden attempting override', async () => {
    const rohanDeny = await fetch(`${API_URL}/v1/requests/${j4Ref}/start-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie, 'Idempotency-Key': `rohan-deny-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 3 }),
    })
    assert.equal(rohanDeny.status, 403)
    const body = await rohanDeny.json()
    assert.equal(body.error.code, 'FORBIDDEN')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 5 & 6 — SLA BREACH & REASSIGNMENT ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 5 & 6: SLA Breach & Reassignment Escalation Isolation')
  let j5Ref = ''
  let j5Id = ''

  await step('Journey 5 & 6', 'Create ticket, assign Rohan, and simulate SLA breach', async () => {
    j5Ref = await createTicket('breach-iso')
    // PM assigns to Rohan
    await fetch(`${API_URL}/v1/pm/requests/${j5Ref}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `assign-rohan-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1, assigneeUserId: rohanUser.id }),
    })

    const reqRow = (await pool.query('SELECT id FROM requests WHERE public_reference = $1', [j5Ref])).rows[0]
    j5Id = reqRow.id

    // Set deadline in past to simulate breach
    await pool.query(
      `UPDATE sla_records SET deadline_at = now() - interval '1 hour', started_at = now() - interval '25 hours'
       WHERE assignment_id IN (SELECT id FROM assignments WHERE request_id = $1 AND ended_at IS NULL)`,
      [j5Id]
    )

    // Execute background worker query
    const overdueSlas = await pool.query(
      `SELECT s.id as sla_id, a.id as assignment_id, r.id as request_id, a.assignee_user_id, r.organization_id
       FROM sla_records s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN requests r ON r.id = a.request_id
       WHERE s.status = 'active' AND s.acknowledged_at IS NULL AND a.ended_at IS NULL AND s.deadline_at <= now()`
    )
    assert.ok(overdueSlas.rowCount >= 1)
    const breachTarget = overdueSlas.rows.find(r => r.request_id === j5Id)
    assert.ok(breachTarget)

    // Atomically execute breach transaction (replicating worker.ts)
    const idemKey = `sla:${breachTarget.sla_id}:acknowledgement-breach`
    await pool.query("UPDATE sla_records SET status = 'breached', breached_at = now() WHERE id = $1", [breachTarget.sla_id])
    await pool.query(
      `INSERT INTO escalation_events (request_id, assignment_id, sla_record_id, responsible_user_id, reason, policy_code, idempotency_key)
       VALUES ($1, $2, $3, $4, 'acknowledgement_sla_breached', 'acknowledgement_24h', $5)`,
      [j5Id, breachTarget.assignment_id, breachTarget.sla_id, breachTarget.assignee_user_id, idemKey]
    )
    await pool.query('UPDATE requests SET version = version + 1 WHERE id = $1', [j5Id])
  })

  await step('Journey 5 & 6', 'Detail surfaces active escalation for Rohan', async () => {
    const detailRes = await fetch(`${API_URL}/v1/pm/requests/${j5Ref}`, { headers: { Cookie: pmCookie } })
    const detail = await detailRes.json()
    assert.ok(detail.request.escalation)
    assert.equal(detail.request.escalation.responsibleName, 'Rohan Mehta')
  })

  await step('Journey 5 & 6', 'PM reassigns to Priya -> Rohan escalation becomes historical, Priya receives healthy SLA', async () => {
    const reassignRes = await fetch(`${API_URL}/v1/pm/requests/${j5Ref}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `reassign-priya-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 3, assigneeUserId: priyaUser.id }),
    })
    assert.equal(reassignRes.status, 200)

    // Verify detail shows escalation is now NULL on active healthy SLA
    const detailAfter = await (await fetch(`${API_URL}/v1/pm/requests/${j5Ref}`, { headers: { Cookie: pmCookie } })).json()
    assert.equal(detailAfter.request.escalation, null, 'Active escalation must be cleared for new healthy SLA')
    assert.equal(detailAfter.request.sla.status, 'active')
    assert.equal(detailAfter.request.currentResponsibility.name, 'Priya Sharma')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 7 — CONCURRENCY & VERSION CONFLICT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 7: Optimistic Concurrency Conflict Detection')

  await step('Journey 7', 'Stale version submission returns 409 REQUEST_VERSION_CONFLICT with no data corruption', async () => {
    const conflictRes = await fetch(`${API_URL}/v1/requests/${j5Ref}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `conflict-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1 }), // Current version is 4
    })
    assert.equal(conflictRes.status, 409)
    const body = await conflictRes.json()
    assert.equal(body.error.code, 'REQUEST_VERSION_CONFLICT')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 8 — DELETION & PERMANENT AUDIT INTEGRITY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 8: Deletion Constraints & Compliance Retention')
  let j8Ref = ''

  await step('Journey 8', 'Non-resolved requests reject deletion with 409 INVALID_STATE_TRANSITION', async () => {
    j8Ref = await createTicket('del-flow')
    const delActive = await fetch(`${API_URL}/v1/pm/requests/${j8Ref}`, {
      method: 'DELETE',
      headers: { Cookie: pmCookie },
    })
    assert.equal(delActive.status, 409)
    const body = await delActive.json()
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION')
  })

  await step('Journey 8', 'Resolved request soft-deletes and preserves permanent immutable audit events', async () => {
    // Acknowledge, start, and resolve via PM override
    await fetch(`${API_URL}/v1/requests/${j8Ref}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `ack-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 1 }),
    })
    await fetch(`${API_URL}/v1/requests/${j8Ref}/start-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `start-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 2 }),
    })
    await fetch(`${API_URL}/v1/requests/${j8Ref}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie, 'Idempotency-Key': `res-${Date.now()}` },
      body: JSON.stringify({ expectedVersion: 3 }),
    })

    // Delete resolved request
    const delRes = await fetch(`${API_URL}/v1/pm/requests/${j8Ref}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
      body: JSON.stringify({ expectedVersion: 4 }),
    })
    assert.equal(delRes.status, 200)

    // Verify hidden from PM queue & Public Tracker
    const qRes = await (await fetch(`${API_URL}/v1/pm/requests`, { headers: { Cookie: pmCookie } })).json()
    assert.equal(qRes.requests.some(r => r.reference === j8Ref), false)

    const tRes = await fetch(`${API_URL}/v1/track/${j8Ref}`)
    assert.equal(tRes.status, 404)

    // Verify PostgreSQL permanently keeps audit trail
    const auditRes = await pool.query(
      'SELECT COUNT(*) FROM audit_events a JOIN requests r ON r.id = a.request_id WHERE r.public_reference = $1',
      [j8Ref]
    )
    assert.ok(parseInt(auditRes.rows[0].count, 10) >= 5, 'All audit events must remain permanently in database')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // JOURNEY 9 — SESSION SECURITY & REVOCATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ Journey 9: Session Security & Revocation')

  await step('Journey 9', 'Sign out revokes session and blocks subsequent PM requests with 401', async () => {
    const logoutRes = await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { Cookie: pmCookie },
    })
    assert.equal(logoutRes.status, 200)

    const testProtected = await fetch(`${API_URL}/v1/pm/requests`, { headers: { Cookie: pmCookie } })
    assert.equal(testProtected.status, 401)
  })

  await step('Journey 9', 'Public client portal continues to operate freely after internal session logout', async () => {
    const clientRef = await createTicket('post-logout')
    assert.ok(clientRef.startsWith('NVARA-2026-'))
  })

  console.log(`\n══════════════════════════════════════════════════════════════`)
  console.log(` RESULTS: ${passed} STEPS PASSED, ${failed} FAILED`)
  console.log(`══════════════════════════════════════════════════════════════\n`)

  await pool.end()

  if (failed > 0) {
    process.exit(1)
  }
}

runAcceptance().catch((err) => {
  console.error('Acceptance suite fatal error:', err)
  pool.end().finally(() => process.exit(1))
})
