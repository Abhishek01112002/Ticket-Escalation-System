import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { evaluateOverdueSlas } from '../../apps/worker/src/worker.ts'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const connection = await pool.connect()
const suffix = randomUUID()
try {
  await connection.query('BEGIN')
  const organization = (await connection.query('INSERT INTO organizations(name) VALUES($1) RETURNING id', [`Worker Isolated ${suffix}`])).rows[0].id
  const pmRole = (await connection.query("SELECT id FROM roles WHERE code='project_manager'")).rows[0].id
  const memberRole = (await connection.query("SELECT id FROM roles WHERE code='internal_team_member'")).rows[0].id
  const pm = (await connection.query('INSERT INTO users(organization_id,display_name,email) VALUES($1,$2,$3) RETURNING id', [organization, 'PM', `pm-${suffix}@example.test`])).rows[0].id
  const member = (await connection.query('INSERT INTO users(organization_id,display_name,email) VALUES($1,$2,$3) RETURNING id', [organization, 'Assignee', `assignee-${suffix}@example.test`])).rows[0].id
  await connection.query('INSERT INTO user_roles VALUES($1,$2),($3,$4)', [pm, pmRole, member, memberRole])
  const client = (await connection.query('INSERT INTO clients(organization_id,name,company,email) VALUES($1,$2,$3,$4) RETURNING id', [organization, 'Client', 'Co', `client-${suffix}@example.test`])).rows[0].id
  const domain = (await connection.query('INSERT INTO service_domains(organization_id,name,slug) VALUES($1,$2,$3) RETURNING id', [organization, 'Domain', `domain-${suffix}`])).rows[0].id
  const request = (await connection.query('INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [organization, `W-${suffix}`, client, domain, 'fixture', 'soon'])).rows[0].id
  const assignment = (await connection.query("INSERT INTO assignments(request_id,assignee_user_id,assigned_by_user_id,assigned_at) VALUES($1,$2,$3,'2020-01-01') RETURNING id", [request, member, pm])).rows[0].id
  const sla = (await connection.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES($1,'ack',86400,'2020-01-01','2020-01-01T01:00:00Z') RETURNING id", [assignment])).rows[0].id
  await connection.query('INSERT INTO audit_events(organization_id,request_id,assignment_id,sla_record_id,actor_type,event_type) VALUES($1,$2,$3,$4,$5,$6)', [organization, request, assignment, sla, 'system', 'request_created'])
  await connection.query('COMMIT')
  const first = await evaluateOverdueSlas(pool)
  assert.equal(first.breached, 1)
  const second = await evaluateOverdueSlas(pool)
  assert.equal(second.breached, 0)
  assert.equal((await pool.query('SELECT status FROM sla_records WHERE id=$1', [sla])).rows[0].status, 'breached')
  console.log('Isolated worker fixture passed')
} finally {
  connection.release()
  await pool.end()
}
