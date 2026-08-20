import { test, expect } from '@playwright/test'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const api = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000'
const pm = { 'X-Dev-Auth-Subject': 'dev-pm-subject-001' }

test('worker escalation persists through API and PM portal', async ({ page, request }) => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const connection = await db.connect()
  const unique = randomUUID()
  let reference = ''

  try {
    await connection.query('BEGIN')
    const organization = (await connection.query("SELECT id FROM organizations WHERE name='Nvara Media'")).rows[0].id
    const pmUser = (await connection.query("SELECT id FROM users WHERE organization_id=$1 AND auth_subject='dev-pm-subject-001'", [organization])).rows[0].id
    const internalMember = (await connection.query("SELECT id FROM users WHERE organization_id=$1 AND auth_subject='dev-internal-subject-001'", [organization])).rows[0].id
    const serviceDomain = (await connection.query("SELECT id FROM service_domains WHERE organization_id=$1 AND slug='seo'", [organization])).rows[0].id
    const client = (await connection.query('INSERT INTO clients(organization_id,name,company,email) VALUES($1,$2,$3,$4) RETURNING id', [organization, 'E2E Client', 'E2E Co', `e2e-${unique}@example.test`])).rows[0].id
    reference = `E2E-${unique}`
    const requestRow = (await connection.query('INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [organization, reference, client, serviceDomain, 'Automatic escalation E2E', 'soon'])).rows[0].id
    const assignment = (await connection.query("INSERT INTO assignments(request_id,assignee_user_id,assigned_by_user_id,assigned_at) VALUES($1,$2,$3,'2020-01-01') RETURNING id", [requestRow, internalMember, pmUser])).rows[0].id
    await connection.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES($1,'acknowledgement_24h',86400,'2020-01-01','2020-01-01T01:00:00Z')", [assignment])
    await connection.query('COMMIT')
  } finally {
    connection.release()
  }

  const before = await request.get(`${api}/v1/pm/requests/${reference}`, { headers: pm })
  expect(before.ok()).toBeTruthy()
  expect((await before.json()).request.escalation).toBeNull()
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/integration/run-worker-once.mjs'], { env: process.env, stdio: 'pipe' })

  const detail = await request.get(`${api}/v1/pm/requests/${reference}`, { headers: pm })
  const body = (await detail.json()).request
  expect(body.sla.status).toBe('breached')
  expect(body.escalation.responsibleName).toBe('Demo Internal Team Member')
  expect(body.escalation.reason).toBe('acknowledgement_sla_breached')
  const timeline = await request.get(`${api}/v1/pm/requests/${reference}/timeline`, { headers: pm })
  expect((await timeline.json()).events.filter((event: any) => event.type === 'escalation_triggered')).toHaveLength(1)

  await page.goto('/')
  await page.getByRole('button', { name: /Project Manager Portal/ }).click()
  await expect(page.getByText(reference)).toBeVisible()
  await page.getByRole('button', { name: new RegExp(reference) }).click()
  await expect(page.getByText('Escalation triggered', { exact: true })).toBeVisible()
  await expect(page.getByText(/Responsible person:/)).toContainText('Demo Internal Team Member')
  await page.reload()
  await page.getByRole('button', { name: new RegExp(reference) }).click()
  await expect(page.getByText('Escalation triggered', { exact: true })).toBeVisible()
  execFileSync(process.execPath, ['--import', 'tsx', 'tests/integration/run-worker-once.mjs'], { env: process.env, stdio: 'pipe' })
  await page.reload()
  await page.getByRole('button', { name: new RegExp(reference) }).click()
  await expect(page.getByText('Escalation triggered', { exact: true })).toBeVisible()
  const after = await request.get(`${api}/v1/pm/requests/${reference}/timeline`, { headers: pm })
  expect((await after.json()).events.filter((event: any) => event.type === 'escalation_triggered')).toHaveLength(1)
  await db.end()
})
