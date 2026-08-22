import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const api = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000'
const pm = { 'X-Dev-Auth-Subject': 'dev-pm-subject-001' }
const internal = { 'X-Dev-Auth-Subject': 'dev-internal-subject-001' }
const otherSpecialist = { 'X-Dev-Auth-Subject': 'dev-priya-subject-001' }
async function read(request: any, ref: string, headers: Record<string,string>) { const response = await request.get(`${api}/v1/pm/requests/${ref}`, { headers }); expect(response.ok()).toBeTruthy(); return (await response.json()).request }
async function mutate(request: any, path: string, headers: Record<string,string>, body: unknown, key: string) { return request.post(`${api}${path}`, { headers: { ...headers, 'content-type':'application/json', 'Idempotency-Key':key }, data: body }) }

test('PM/internal workflow authorization and refresh persistence', async ({ page, request }) => {
  const uid = randomUUID()
  const created = await request.post(`${api}/v1/client/requests`, { headers: { ...pm, 'Idempotency-Key': `e2e-${uid}`, 'content-type':'application/json' }, data: { name:'Closure E2E', company:'Closure Test', email:`closure-${uid}@example.test`, phone:'+919999999999', serviceDomain:'seo', requirement:'Closure workflow validation request.', urgency:'soon' } })
  expect(created.status()).toBe(201)
  const ref = (await created.json()).reference as string
  let state = await read(request, ref, pm)
  const members = await request.get(`${api}/v1/pm/team-members`, { headers: pm });
  const memberList = (await members.json()).teamMembers;
  const r = memberList.find((m: any) => m.email === 'rohan.mehta@nvaramedia.com') ?? memberList[0];
  const assigned = await mutate(request, `/v1/pm/requests/${ref}/assignments`, pm, { assigneeUserId:r.id, expectedVersion:state.version }, `assign-${randomUUID()}`)
  expect(assigned.status()).toBe(200); state = (await assigned.json()).request; expect(state.version).toBe(2)
  await page.goto(`/`); await page.reload(); state = await read(request, ref, pm); expect(state.version).toBe(2); expect(state.currentResponsibility.name).toBe(r.name)
  const denied = await mutate(request, `/v1/requests/${ref}/acknowledge`, otherSpecialist, { expectedVersion:state.version }, `deny-${randomUUID()}`)
  expect(denied.status()).toBe(403); expect((await read(request, ref, pm)).version).toBe(2)
  await page.reload(); state = await read(request, ref, internal)
  const acknowledged = await mutate(request, `/v1/requests/${ref}/acknowledge`, internal, { expectedVersion:state.version }, `ack-${randomUUID()}`); expect(acknowledged.status()).toBe(200); state=(await acknowledged.json()).request; expect(state.version).toBe(3); expect(state.sla.acknowledgedAt).toBeTruthy()
  await page.reload(); state=await read(request, ref, internal); expect(state.version).toBe(3)
  const started=await mutate(request, `/v1/requests/${ref}/start-work`, internal, {expectedVersion:state.version}, `start-${randomUUID()}`); expect(started.status()).toBe(200); state=(await started.json()).request; expect(state.status).toBe('in_progress'); expect(state.version).toBe(4)
  await page.reload(); state=await read(request, ref, internal); expect(state.status).toBe('in_progress')
  const resolved=await mutate(request, `/v1/requests/${ref}/resolve`, internal, {expectedVersion:state.version}, `resolve-${randomUUID()}`); expect(resolved.status()).toBe(200); state=(await resolved.json()).request; expect(state.status).toBe('resolved'); expect(state.version).toBe(5); expect(state.sla.status).toBe('closed')
  await page.reload(); state=await read(request, ref, pm); expect(state.status).toBe('resolved'); expect(state.version).toBe(5)
})
