import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const baseUrl = process.env.API_ORIGIN ?? 'http://127.0.0.1:4012'
const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl, 'DATABASE_URL is required')
const body = { name: 'Integration Client', company: 'Integration Co', email: `integration-${randomUUID()}@example.test`, phone: '+919876543210', serviceDomain: 'seo', requirement: 'Validate durable request submission through the API.', urgency: 'flexible' }
const key = `integration-${randomUUID()}`
const concurrentKey = `integration-concurrent-${randomUUID()}`
async function submit(requestBody = body, requestKey = key) {
  const response = await fetch(`${baseUrl}/v1/client/requests`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': requestKey }, body: JSON.stringify(requestBody) })
  return { status: response.status, body: await response.json() }
}

const first = await submit()
assert.equal(first.status, 201)
assert.match(first.body.reference, /^NVARA-\d{4}-[A-F0-9]{8}$/)
const duplicates = await Promise.all(Array.from({ length: 5 }, () => submit(body, concurrentKey)))
assert.ok(duplicates.every((result) => result.status === 201 && result.body.reference === duplicates[0].body.reference))
const changed = await submit({ ...body, company: 'Changed Co' }, concurrentKey)
assert.equal(changed.status, 409)
assert.equal(changed.body.error.code, 'IDEMPOTENCY_KEY_REUSED')
const invalidUrgency = await submit({ ...body, email: `invalid-${randomUUID()}@example.test`, urgency: 'urgent' }, `invalid-${randomUUID()}`)
assert.equal(invalidUrgency.status, 422)
const invalidDomain = await submit({ ...body, email: `invalid-${randomUUID()}@example.test`, serviceDomain: 'unknown' }, `invalid-${randomUUID()}`)
assert.equal(invalidDomain.status, 422)

const pool = new pg.Pool({ connectionString: databaseUrl })
const counts = await pool.query('SELECT count(*)::int AS count FROM requests WHERE public_reference = $1', [first.body.reference])
assert.equal(counts.rows[0].count, 1)
const linked = await pool.query("SELECT (SELECT count(*) FROM assignments a JOIN requests r ON r.id = a.request_id WHERE r.public_reference = $1) AS assignments, (SELECT count(*) FROM sla_records s JOIN assignments a ON a.id = s.assignment_id JOIN requests r ON r.id = a.request_id WHERE r.public_reference = $1) AS sla, (SELECT count(*) FROM audit_events ae JOIN requests r ON r.id = ae.request_id WHERE r.public_reference = $1) AS audits", [first.body.reference])
assert.deepEqual(linked.rows[0], { assignments: '1', sla: '1', audits: '2' })
await pool.end()
console.log('Client request integration tests passed')
