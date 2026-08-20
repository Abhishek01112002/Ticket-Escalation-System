import { createHash } from 'node:crypto'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import type { AppConfig } from '@nvara/config'
import { authenticatePm, type PmAuth } from './auth.js'
import { ApiError } from './errors.js'

const mutationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  assigneeUserId: z.string().uuid().optional(),
}).strict()
type MutationBody = z.infer<typeof mutationSchema>

const bodySchema = (body: unknown): MutationBody => {
  const parsed = mutationSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(422, 'VALIDATION_ERROR', 'The mutation payload is invalid.', { body: 'expectedVersion is required and unknown fields are not allowed.' })
  return parsed.data
}

const keyOf = (request: FastifyRequest): string => {
  const value = request.headers['idempotency-key']
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid Idempotency-Key header is required.')
  return value.trim()
}

const hash = (body: unknown): string => createHash('sha256').update(JSON.stringify(body)).digest('hex')
const routeOf = (request: FastifyRequest): string => request.url.split('?')[0]

async function idem(c: pg.PoolClient, auth: PmAuth, method: string, route: string, key: string, body: MutationBody) {
  const requestHash = hash(body)
  const inserted = await c.query<{ response_status: number | null; response_body: unknown }>(
    `INSERT INTO idempotency_keys(actor_id,organization_id,method,route,key,request_hash,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,now()+interval '24 hours')
     ON CONFLICT (organization_id,actor_id,method,route,key) DO NOTHING
     RETURNING response_status,response_body`,
    [auth.id, auth.organizationId, method, route, key, requestHash],
  )
  if (inserted.rowCount) return null
  const existing = await c.query<{ request_hash: string; response_status: number | null; response_body: unknown }>(
    'SELECT request_hash,response_status,response_body FROM idempotency_keys WHERE organization_id=$1 AND actor_id=$2 AND method=$3 AND route=$4 AND key=$5 FOR UPDATE',
    [auth.organizationId, auth.id, method, route, key],
  )
  const row = existing.rows[0]
  if (!row || row.request_hash !== requestHash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request.')
  if (row.response_body && row.response_status) return { status: row.response_status, body: row.response_body }
  throw new ApiError(409, 'IDEMPOTENCY_IN_PROGRESS', 'An identical request is already being processed.')
}

async function saveIdem(c: pg.PoolClient, auth: PmAuth, method: string, route: string, key: string, status: number, response: unknown) {
  await c.query(
    'UPDATE idempotency_keys SET response_status=$1,response_body=$2 WHERE organization_id=$3 AND actor_id=$4 AND method=$5 AND route=$6 AND key=$7',
    [status, response, auth.organizationId, auth.id, method, route, key],
  )
}

async function detail(c: pg.PoolClient, organizationId: string, reference: string) {
  const query = await c.query<any>(
    `SELECT r.public_reference AS reference,r.requirement,r.urgency,r.status,r.version,r.created_at,r.updated_at,
      c.name,c.company,c.email,c.phone_whatsapp,d.slug AS service_domain,
      u.display_name AS assignee_name,u.email AS assignee_email,a.assigned_at,
      s.started_at,s.deadline_at,s.status AS sla_status,s.acknowledged_at,s.breached_at
     FROM requests r JOIN clients c ON c.id=r.client_id JOIN service_domains d ON d.id=r.service_domain_id
     LEFT JOIN assignments a ON a.request_id=r.id AND a.ended_at IS NULL
     LEFT JOIN users u ON u.id=a.assignee_user_id LEFT JOIN sla_records s ON s.assignment_id=a.id
     WHERE r.organization_id=$1 AND r.public_reference=$2`,
    [organizationId, reference],
  )
  if (!query.rowCount) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.')
  const row = query.rows[0]
  return { request: {
    reference: row.reference, requirement: row.requirement, urgency: row.urgency, status: row.status, version: row.version,
    serviceDomain: row.service_domain, createdAt: row.created_at, updatedAt: row.updated_at,
    client: { name: row.name, company: row.company, email: row.email, phone: row.phone_whatsapp },
    currentResponsibility: row.assignee_name ? { name: row.assignee_name, email: row.assignee_email, assignedAt: row.assigned_at } : null,
    sla: { startedAt: row.started_at, deadlineAt: row.deadline_at, status: row.sla_status, acknowledgedAt: row.acknowledged_at, breachedAt: row.breached_at },
  } }
}

export function registerWorkflowMutationRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig) {
  app.post('/v1/pm/requests/:id/assignments', async (request, reply) => {
    const auth = await authenticatePm(request, pool, config)
    if (auth.role !== 'project_manager') throw new ApiError(403, 'FORBIDDEN', 'Project manager access is required.')
    const body = bodySchema(request.body)
    if (!body.assigneeUserId) throw new ApiError(422, 'INVALID_ASSIGNEE', 'Select an active internal team member.')
    const key = keyOf(request)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const route = routeOf(request)
      const replay = await idem(client, auth, 'POST', route, key, body)
      if (replay) { await client.query('COMMIT'); return reply.code(replay.status).send(replay.body) }
      const currentRequest = await client.query<any>('SELECT id,status,version FROM requests WHERE organization_id=$1 AND public_reference=$2 FOR UPDATE', [auth.organizationId, String((request.params as any).id)])
      if (!currentRequest.rowCount) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.')
      const row = currentRequest.rows[0]
      if (row.version !== body.expectedVersion) throw new ApiError(409, 'REQUEST_VERSION_CONFLICT', 'The request has changed. Refresh and retry.')
      if (row.status === 'resolved') throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Resolved requests cannot be reassigned.')
      const target = await client.query<any>(
        `SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles role ON role.id=ur.role_id
         WHERE u.id=$1 AND u.organization_id=$2 AND u.is_active=true AND role.code='internal_team_member'`,
        [body.assigneeUserId, auth.organizationId],
      )
      if (!target.rowCount) throw new ApiError(422, 'INVALID_ASSIGNEE', 'Select an active internal team member.')
      const currentAssignment = await client.query<any>('SELECT id FROM assignments WHERE request_id=$1 AND ended_at IS NULL FOR UPDATE', [row.id])
      const eventType = currentAssignment.rowCount ? 'reassigned' : 'assigned'
      if (currentAssignment.rowCount) {
        await client.query("UPDATE assignments SET ended_at=now(),end_reason='reassigned' WHERE id=$1", [currentAssignment.rows[0].id])
        await client.query("UPDATE sla_records SET status='superseded',updated_at=now() WHERE assignment_id=$1 AND status IN ('active','breached')", [currentAssignment.rows[0].id])
      }
      const assignment = await client.query<any>('INSERT INTO assignments(request_id,assignee_user_id,assigned_by_user_id) VALUES($1,$2,$3) RETURNING id', [row.id, body.assigneeUserId, auth.id])
      await client.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES($1,'acknowledgement_24h',86400,now(),now()+interval '24 hours')", [assignment.rows[0].id])
      await client.query('UPDATE requests SET status=\'awaiting_acknowledgement\',version=version+1,updated_at=now() WHERE id=$1', [row.id])
      await client.query('INSERT INTO audit_events(organization_id,request_id,assignment_id,actor_user_id,actor_type,event_type,previous_state,new_state,metadata,correlation_id) VALUES($1,$2,$3,$4,\'user\',$5,$6,\'awaiting_acknowledgement\',$7,$8)', [auth.organizationId, row.id, assignment.rows[0].id, auth.id, eventType, row.status, JSON.stringify({ assigneeUserId: body.assigneeUserId }), request.id])
      const response = await detail(client, auth.organizationId, String((request.params as any).id))
      await saveIdem(client, auth, 'POST', route, key, 200, response)
      await client.query('COMMIT')
      return reply.send(response)
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  })

  const mutate = async (request: FastifyRequest, reply: any, action: 'acknowledge' | 'start-work' | 'resolve') => {
    const auth = await authenticatePm(request, pool, config)
    const body = bodySchema(request.body)
    const key = keyOf(request)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const route = routeOf(request)
      const replay = await idem(client, auth, 'POST', route, key, body)
      if (replay) { await client.query('COMMIT'); return reply.code(replay.status).send(replay.body) }
      const currentRequest = await client.query<any>('SELECT id,status,version FROM requests WHERE organization_id=$1 AND public_reference=$2 FOR UPDATE', [auth.organizationId, String((request.params as any).id)])
      if (!currentRequest.rowCount) throw new ApiError(404, 'REQUEST_NOT_FOUND', 'Request not found.')
      const row = currentRequest.rows[0]
      if (row.version !== body.expectedVersion) throw new ApiError(409, 'REQUEST_VERSION_CONFLICT', 'The request has changed. Refresh and retry.')
      const assignment = await client.query<any>(
        `SELECT a.id,a.assignee_user_id,s.id AS sla_id,s.acknowledged_at,s.deadline_at
         FROM assignments a JOIN sla_records s ON s.assignment_id=a.id
         WHERE a.request_id=$1 AND a.ended_at IS NULL FOR UPDATE`, [row.id],
      )
      if (!assignment.rowCount) throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'No current assignee.')
      const current = assignment.rows[0]
      if (current.assignee_user_id !== auth.id) throw new ApiError(403, 'FORBIDDEN', 'Only the current assignee can perform this action.')
      let next = row.status
      if (action === 'acknowledge') {
        if (row.status !== 'awaiting_acknowledgement' || current.acknowledged_at) throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Request is not awaiting acknowledgement.')
        const late = new Date() > new Date(current.deadline_at)
        await client.query("UPDATE sla_records SET acknowledged_at=now(),acknowledged_by_user_id=$1,is_late=$2,status=CASE WHEN $2 THEN 'breached' ELSE 'acknowledged' END,updated_at=now() WHERE id=$3", [auth.id, late, current.sla_id])
        next = 'acknowledged'
      } else if (action === 'start-work') {
        if (row.status !== 'acknowledged' || !current.acknowledged_at) throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Acknowledgement is required before starting work.')
        next = 'in_progress'
      } else {
        if (row.status !== 'in_progress' || !current.acknowledged_at) throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Request must be in progress before resolution.')
        next = 'resolved'
        await client.query('UPDATE requests SET resolved_at=now(),resolved_by_user_id=$1 WHERE id=$2', [auth.id, row.id])
        await client.query("UPDATE sla_records SET status='closed',updated_at=now() WHERE id=$1", [current.sla_id])
      }
      await client.query('UPDATE requests SET status=$1,version=version+1,updated_at=now() WHERE id=$2', [next, row.id])
      await client.query('INSERT INTO audit_events(organization_id,request_id,assignment_id,actor_user_id,actor_type,event_type,previous_state,new_state,metadata,correlation_id) VALUES($1,$2,$3,$4,\'user\',$5,$6,$7,$8,$9)', [auth.organizationId, row.id, current.id, auth.id, action === 'start-work' ? 'work_started' : action === 'acknowledge' ? 'acknowledged' : 'resolved', row.status, next, JSON.stringify({ late: action === 'acknowledge' && new Date() > new Date(current.deadline_at) }), request.id])
      const response = await detail(client, auth.organizationId, String((request.params as any).id))
      await saveIdem(client, auth, 'POST', route, key, 200, response)
      await client.query('COMMIT')
      return reply.send(response)
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error } finally { client.release() }
  }

  app.post('/v1/requests/:id/acknowledge', (request, reply) => mutate(request, reply, 'acknowledge'))
  app.post('/v1/requests/:id/start-work', (request, reply) => mutate(request, reply, 'start-work'))
  app.post('/v1/requests/:id/resolve', (request, reply) => mutate(request, reply, 'resolve'))
}
