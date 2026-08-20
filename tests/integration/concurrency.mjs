import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const base = process.env.API_ORIGIN ?? 'http://127.0.0.1:4012'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let hardeningUserId
const auth = (subject) => ({ 'content-type': 'application/json', 'X-Dev-Auth-Subject': subject })
const call = async (path, subject, body, key) => {
  const response = await fetch(base + path, { method: 'POST', headers: { ...auth(subject), 'Idempotency-Key': key }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
const get = async (path, subject) => {
  const response = await fetch(base + path, { headers: auth(subject) })
  return { status: response.status, body: await response.json() }
}

const submitted = await fetch(`${base}/v1/client/requests`, {
  method: 'POST',
  headers: { ...auth('dev-client-subject-001'), 'Idempotency-Key': `hardening-${randomUUID()}` },
  body: JSON.stringify({ name: 'Concurrency Client', company: 'Concurrency Co', email: `concurrency-${randomUUID()}@example.test`, phone: '+919876543210', serviceDomain: 'seo', requirement: 'Exercise deterministic workflow concurrency behavior.', urgency: 'soon' }),
})
assert.equal(submitted.status, 201)
const { reference } = await submitted.json()
const connection = await db.connect()
try {
  const organization = (await connection.query("SELECT id FROM organizations WHERE name='Nvara Media'")).rows[0].id
  const role = (await connection.query("SELECT id FROM roles WHERE code='internal_team_member'")).rows[0].id
  hardeningUserId = (await connection.query('INSERT INTO users(organization_id,display_name,email,auth_subject) VALUES($1,$2,$3,$4) RETURNING id', [organization, 'Hardening Member', `hardening-${randomUUID()}@invalid.test`, `hardening-${randomUUID()}`])).rows[0].id
  await connection.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [hardeningUserId, role])
} finally { connection.release() }
const members = (await get('/v1/pm/team-members', 'dev-pm-subject-001')).body.teamMembers
assert.ok(members.length >= 2)
let detail = (await get(`/v1/pm/requests/${reference}`, 'dev-pm-subject-001')).body.request

const assignments = await Promise.all([
  call(`/v1/pm/requests/${reference}/assignments`, 'dev-pm-subject-001', { assigneeUserId: members[0].id, expectedVersion: detail.version }, `race-a-${randomUUID()}`),
  call(`/v1/pm/requests/${reference}/assignments`, 'dev-pm-subject-001', { assigneeUserId: members[1].id, expectedVersion: detail.version }, `race-b-${randomUUID()}`),
])
assert.equal(assignments.filter((result) => result.status === 200).length, 1)
assert.equal(assignments.filter((result) => result.status === 409).length, 1)

detail = (await get(`/v1/pm/requests/${reference}`, 'dev-pm-subject-001')).body.request
const duplicateKey = `duplicate-${randomUUID()}`
const duplicates = await Promise.all(Array.from({ length: 5 }, () => call(`/v1/pm/requests/${reference}/assignments`, 'dev-pm-subject-001', { assigneeUserId: members[0].id, expectedVersion: detail.version }, duplicateKey)))
assert.ok(duplicates.every((result) => result.status === 200))
assert.equal(new Set(duplicates.map((result) => result.body.request.version)).size, 1)

detail = (await get(`/v1/pm/requests/${reference}`, 'dev-pm-subject-001')).body.request
const acknowledged = await call(`/v1/requests/${reference}/acknowledge`, 'dev-internal-subject-001', { expectedVersion: detail.version, extra: 'rejected' }, `strict-${randomUUID()}`)
assert.equal(acknowledged.status, 422)
console.log('Concurrency hardening integration passed')
await db.query('UPDATE users SET is_active=false WHERE id=$1', [hardeningUserId])
await db.end()
