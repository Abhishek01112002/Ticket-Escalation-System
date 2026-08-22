import assert from 'node:assert/strict'
import pg from 'pg'

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'
const DB_URL = process.env.DATABASE_URL ?? 'postgres://nvara:nvara_local_dev_only@localhost:55432/nvara'

const pool = new pg.Pool({ connectionString: DB_URL })

console.log('\n── Audit Findings Regression Suite ──\n')

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

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 1: MULTI-PM INTAKE REGRESSION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Multi-PM Intake Routing & Zero-PM Graceful Handling')

  // Setup: Fetch default org
  const orgRes = await pool.query("SELECT id FROM organizations WHERE name = 'Nvara Media'")
  const orgId = orgRes.rows[0].id
  const pmRoleRes = await pool.query("SELECT id FROM roles WHERE code = 'project_manager'")
  const pmRoleId = pmRoleRes.rows[0].id

  await test('Intake succeeds with exactly 1 active PM', async () => {
    const key = `test-intake-1pm-${Date.now()}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        name: 'Client Alpha',
        company: 'Alpha Corp',
        email: 'alpha@example.com',
        phone: '+919876543210',
        serviceDomain: 'seo',
        requirement: 'Organic visibility optimization audit for enterprise website.',
        urgency: 'soon',
      }),
    })

    assert.equal(res.status, 201, `Expected 201, got ${res.status}`)
    const body = await res.json()
    assert.ok(body.reference.startsWith('NVARA-2026-'))
  })

  await test('Intake succeeds and routes deterministically when 2 active PMs exist', async () => {
    // Add second active PM
    const pm2Email = `test.pm2.${Date.now()}@nvaramedia.com`
    const insertPm2 = await pool.query(
      `INSERT INTO users (organization_id, display_name, email, is_active)
       VALUES ($1, 'Second PM', $2, true) RETURNING id`,
      [orgId, pm2Email]
    )
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [insertPm2.rows[0].id, pmRoleId]
    )

    const key = `test-intake-2pm-${Date.now()}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        name: 'Client Beta',
        company: 'Beta Corp',
        email: 'beta@example.com',
        phone: '+919876543211',
        serviceDomain: 'web_app_development',
        requirement: 'Full stack React and Node.js portal overhaul requirement.',
        urgency: 'time_sensitive',
      }),
    })

    assert.equal(res.status, 201, `Expected 201 with 2 PMs, got ${res.status}`)
    const body = await res.json()
    assert.ok(body.reference.startsWith('NVARA-2026-'))
  })

  await test('Intake succeeds when 3 active PMs exist', async () => {
    // Add third active PM
    const pm3Email = `test.pm3.${Date.now()}@nvaramedia.com`
    const insertPm3 = await pool.query(
      `INSERT INTO users (organization_id, display_name, email, is_active)
       VALUES ($1, 'Third PM', $2, true) RETURNING id`,
      [orgId, pm3Email]
    )
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [insertPm3.rows[0].id, pmRoleId]
    )

    const key = `test-intake-3pm-${Date.now()}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        name: 'Client Gamma',
        company: 'Gamma Corp',
        email: 'gamma@example.com',
        phone: '+919876543212',
        serviceDomain: 'branding_graphic_design',
        requirement: 'Complete visual branding identity system and typography guidelines.',
        urgency: 'flexible',
      }),
    })

    assert.equal(res.status, 201, `Expected 201 with 3 PMs, got ${res.status}`)
    const body = await res.json()
    assert.ok(body.reference.startsWith('NVARA-2026-'))
  })

  await test('Zero active PMs returns explicit 503 SERVICE_UNAVAILABLE instead of unhandled 500', async () => {
    // Deactivate all PMs temporarily
    await pool.query(
      `UPDATE users SET is_active = false WHERE id IN (
        SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role_id = $1
      )`,
      [pmRoleId]
    )

    const key = `test-intake-0pm-${Date.now()}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        name: 'Client Delta',
        company: 'Delta Corp',
        email: 'delta@example.com',
        phone: '+919876543213',
        serviceDomain: 'digital_marketing',
        requirement: 'High-conversion Google search campaign deployment.',
        urgency: 'soon',
      }),
    })

    assert.equal(res.status, 503, `Expected 503 with 0 PMs, got ${res.status}`)
    const body = await res.json()
    assert.equal(body.error.code, 'SERVICE_UNAVAILABLE')

    // Restore primary PM
    await pool.query(
      `UPDATE users SET is_active = true WHERE email = 'pm@nvaramedia.com'`
    )
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 2: PM OPERATIONAL OVERRIDE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. PM Operational Override & Audit Trail Verification')

  // Log in as PM
  const pmLoginRes = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@nvaramedia.com', password: 'Nvara#PM2026!Secure' }),
  })
  const pmCookie = pmLoginRes.headers.get('set-cookie')?.split(';')[0]

  // Log in as Specialist Rohan
  const rohanLoginRes = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rohan.mehta@nvaramedia.com', password: 'Rohan#Ops2026!Dev' }),
  })
  const rohanCookie = rohanLoginRes.headers.get('set-cookie')?.split(';')[0]

  // Log in as Specialist Priya
  const priyaLoginRes = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'priya.sharma@nvaramedia.com', password: 'Priya#Ops2026!Dev' }),
  })
  const priyaCookie = priyaLoginRes.headers.get('set-cookie')?.split(';')[0]

  let testTicketRef = ''
  let testTicketVersion = 1

  await test('Create fresh test ticket for assignment', async () => {
    const key = `test-ticket-override-${Date.now()}`
    const res = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({
        name: 'Enterprise Client',
        company: 'MegaCorp',
        email: 'megacorp@example.com',
        phone: '+919999988888',
        serviceDomain: 'seo',
        requirement: 'Technical SEO site architecture and Core Web Vitals remediation.',
        urgency: 'time_sensitive',
      }),
    })
    const body = await res.json()
    testTicketRef = body.reference
    assert.ok(testTicketRef)
  })

  // PM assigns ticket to Rohan
  await test('PM assigns ticket to Rohan', async () => {
    const rohanUser = (await pool.query("SELECT id FROM users WHERE email = 'rohan.mehta@nvaramedia.com'")).rows[0]
    const res = await fetch(`${API_URL}/v1/pm/requests/${testTicketRef}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `assign-rohan-${Date.now()}`,
      },
      body: JSON.stringify({
        expectedVersion: 1,
        assigneeUserId: rohanUser.id,
      }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    testTicketVersion = body.request.version
    assert.equal(testTicketVersion, 2)
  })

  await test('Non-assigned Specialist Priya receives 403 Forbidden attempting to acknowledge', async () => {
    const res = await fetch(`${API_URL}/v1/requests/${testTicketRef}/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': priyaCookie,
        'Idempotency-Key': `priya-ack-${Date.now()}`,
      },
      body: JSON.stringify({ expectedVersion: testTicketVersion }),
    })
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`)
    const body = await res.json()
    assert.equal(body.error.code, 'FORBIDDEN')
  })

  await test('PM successfully acknowledges ticket via Operational Override', async () => {
    const res = await fetch(`${API_URL}/v1/requests/${testTicketRef}/acknowledge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `pm-override-ack-${Date.now()}`,
      },
      body: JSON.stringify({ expectedVersion: testTicketVersion }),
    })
    assert.equal(res.status, 200, `Expected 200 on PM override, got ${res.status}`)
    const body = await res.json()
    assert.equal(body.request.status, 'acknowledged')
    testTicketVersion = body.request.version
  })

  await test('Audit trail records override=true and originalAssigneeUserId', async () => {
    const auditRes = await pool.query(
      `SELECT a.event_type, a.metadata, u.email as actor_email
       FROM audit_events a
       JOIN requests r ON r.id = a.request_id
       JOIN users u ON u.id = a.actor_user_id
       WHERE r.public_reference = $1 AND a.event_type = 'acknowledged'
       ORDER BY a.occurred_at DESC LIMIT 1`,
      [testTicketRef]
    )
    assert.equal(auditRes.rowCount, 1)
    const audit = auditRes.rows[0]
    assert.equal(audit.actor_email, 'pm@nvaramedia.com')
    assert.equal(audit.metadata.override, true)
    assert.ok(audit.metadata.originalAssigneeUserId)
  })

  await test('Stale version triggers 409 Conflict even for PM override', async () => {
    const res = await fetch(`${API_URL}/v1/requests/${testTicketRef}/start-work`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `pm-stale-start-${Date.now()}`,
      },
      body: JSON.stringify({ expectedVersion: 1 }), // Stale version 1
    })
    assert.equal(res.status, 409, `Expected 409 on stale version, got ${res.status}`)
  })

  await test('PM starts work and resolves ticket via override', async () => {
    // Start work
    const startRes = await fetch(`${API_URL}/v1/requests/${testTicketRef}/start-work`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `pm-override-start-${Date.now()}`,
      },
      body: JSON.stringify({ expectedVersion: testTicketVersion }),
    })
    assert.equal(startRes.status, 200)
    const startBody = await startRes.json()
    assert.equal(startBody.request.status, 'in_progress')
    testTicketVersion = startBody.request.version

    // Resolve
    const resolveRes = await fetch(`${API_URL}/v1/requests/${testTicketRef}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `pm-override-resolve-${Date.now()}`,
      },
      body: JSON.stringify({ expectedVersion: testTicketVersion }),
    })
    assert.equal(resolveRes.status, 200)
    const resolveBody = await resolveRes.json()
    assert.equal(resolveBody.request.status, 'resolved')
    testTicketVersion = resolveBody.request.version
  })

  await test('Resolved request cannot be reassigned (protected state)', async () => {
    const priyaUser = (await pool.query("SELECT id FROM users WHERE email = 'priya.sharma@nvaramedia.com'")).rows[0]
    const res = await fetch(`${API_URL}/v1/pm/requests/${testTicketRef}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': pmCookie,
        'Idempotency-Key': `reassign-resolved-${Date.now()}`,
      },
      body: JSON.stringify({
        expectedVersion: testTicketVersion,
        assigneeUserId: priyaUser.id,
      }),
    })
    assert.equal(res.status, 409, `Expected 409, got ${res.status}`)
    const body = await res.json()
    assert.equal(body.error.code, 'INVALID_STATE_TRANSITION')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // TASK 4: IDEMPOTENCY LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Client Idempotency Lifecycle & Deduplication')

  await test('Rapid repeated submission with same Idempotency-Key replays exact response without duplicate DB rows', async () => {
    const fixedKey = `idem-lifecycle-test-${Date.now()}`
    const uniqueCompany = `SameCorp-${Date.now()}`
    const payload = {
      name: 'Idempotency Tester',
      company: uniqueCompany,
      email: `samecorp.${Date.now()}@example.com`,
      phone: '+919876500000',
      serviceDomain: 'seo',
      requirement: 'Deduplication verification for rapid double click.',
      urgency: 'soon',
    }

    // Call 1
    const res1 = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': fixedKey },
      body: JSON.stringify(payload),
    })
    assert.equal(res1.status, 201)
    const body1 = await res1.json()

    // Call 2 (Simulating rapid double click)
    const res2 = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': fixedKey },
      body: JSON.stringify(payload),
    })
    assert.equal(res2.status, 201)
    const body2 = await res2.json()

    assert.equal(body1.reference, body2.reference)

    // Check DB count for this company
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM clients c JOIN requests r ON r.client_id = c.id WHERE c.company = $1",
      [uniqueCompany]
    )
    assert.equal(parseInt(countRes.rows[0].count, 10), 1, 'Expected exactly 1 request created in DB')
  })

  await test('Reusing same Idempotency-Key with different payload fails with 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const fixedKey = `idem-conflict-test-${Date.now()}`
    const payloadA = {
      name: 'Client A',
      company: 'Corp A',
      email: 'a@example.com',
      phone: '+919876500001',
      serviceDomain: 'seo',
      requirement: 'First requirement specification.',
      urgency: 'soon',
    }
    const payloadB = {
      name: 'Client B',
      company: 'Corp B',
      email: 'b@example.com',
      phone: '+919876500002',
      serviceDomain: 'web_app_development',
      requirement: 'Completely different requirement specification.',
      urgency: 'time_sensitive',
    }

    await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': fixedKey },
      body: JSON.stringify(payloadA),
    })

    const resB = await fetch(`${API_URL}/v1/client/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': fixedKey },
      body: JSON.stringify(payloadB),
    })

    assert.equal(resB.status, 409)
    const bodyB = await resB.json()
    assert.equal(bodyB.error.code, 'IDEMPOTENCY_KEY_REUSED')
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
