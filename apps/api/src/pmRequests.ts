import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import type { AppConfig } from '@nvara/config'
import { authenticatePm } from './auth.js'
import { ApiError } from './errors.js'

const reference = (request: FastifyRequest) => String((request.params as any).id ?? '')

// ── Validators ────────────────────────────────────────────────────────────────

const commentBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict()

// ── Filter query-param extraction with safe defaults ──────────────────────────

function extractFilters(query: any) {
  const assigneeId  = typeof query.assigneeId  === 'string' ? query.assigneeId.trim()  : null
  const domain      = typeof query.domain      === 'string' ? query.domain.trim()      : null
  const urgency     = typeof query.urgency     === 'string' ? query.urgency.trim()      : null
  const slaStatus   = typeof query.slaStatus   === 'string' ? query.slaStatus.trim()   : null
  const dateFrom    = typeof query.dateFrom    === 'string' ? query.dateFrom.trim()    : null
  const dateTo      = typeof query.dateTo      === 'string' ? query.dateTo.trim()      : null

  // Allowlist values to prevent injection via enum comparison
  const VALID_URGENCY    = ['flexible', 'soon', 'time_sensitive']
  const VALID_SLA_STATUS = ['healthy', 'near_breach', 'breached', 'active', 'acknowledged', 'superseded', 'closed']

  return {
    assigneeId:  assigneeId || null,
    domain:      domain     || null,
    urgency:     urgency && VALID_URGENCY.includes(urgency)       ? urgency   : null,
    slaStatus:   slaStatus && VALID_SLA_STATUS.includes(slaStatus) ? slaStatus : null,
    dateFrom:    dateFrom && !isNaN(Date.parse(dateFrom))          ? dateFrom  : null,
    dateTo:      dateTo   && !isNaN(Date.parse(dateTo))            ? dateTo    : null,
  }
}

// ── Route Registration ────────────────────────────────────────────────────────

export function registerPmRequestRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig) {

  // ── GET /v1/pm/team-members ─────────────────────────────────────────────────
  // Returns all active internal team members with their live active assignment
  // count so the reassign UI can surface workload capacity.
  app.get('/v1/pm/team-members', async request => {
    const user = await authenticatePm(request, pool, config)
    const result = await pool.query(`
      SELECT
        u.id,
        u.display_name AS name,
        u.email,
        u.phone_whatsapp,
        COUNT(a.id)::int AS active_assignments_count
      FROM users u
      JOIN user_roles ur   ON ur.user_id = u.id
      JOIN roles role       ON role.id    = ur.role_id
      LEFT JOIN assignments a
        ON a.assignee_user_id = u.id
        AND a.ended_at IS NULL
      WHERE u.organization_id = $1
        AND u.is_active        = true
        AND role.code          = 'internal_team_member'
      GROUP BY u.id, u.display_name, u.email, u.phone_whatsapp
      ORDER BY u.display_name
    `, [user.organizationId])
    return {
      teamMembers: result.rows.map(r => ({
        id:                    r.id,
        name:                  r.name,
        email:                 r.email,
        phoneWhatsapp:         r.phone_whatsapp || null,
        activeAssignmentsCount: r.active_assignments_count,
      })),
    }
  })

  // ── GET /v1/pm/requests ─────────────────────────────────────────────────────
  // Global / filtered request queue with composable server-side filters.
  // Query params: assigneeId, domain, urgency, slaStatus, dateFrom, dateTo
  app.get('/v1/pm/requests', async request => {
    const user    = await authenticatePm(request, pool, config)
    const filters = extractFilters(request.query)

    // Dynamically build WHERE clause with numbered parameters
    const conditions: string[] = ['r.organization_id = $1']
    const params: unknown[]    = [user.organizationId]
    let   pidx = 2

    if (filters.assigneeId) {
      // 'me' is a special sentinel meaning "current authenticated user"
      const resolvedId = filters.assigneeId === 'me' ? user.id : filters.assigneeId
      conditions.push(`u2.id = $${pidx++}`)
      params.push(resolvedId)
    }
    if (filters.domain) {
      conditions.push(`d.slug = $${pidx++}`)
      params.push(filters.domain)
    }
    if (filters.urgency) {
      conditions.push(`r.urgency = $${pidx++}`)
      params.push(filters.urgency)
    }
    if (filters.slaStatus) {
      if (filters.slaStatus === 'near_breach') {
        // Near-breach = SLA active AND deadline within 4 hours
        conditions.push(`s.status = 'active' AND s.deadline_at <= now() + interval '4 hours' AND s.deadline_at > now()`)
      } else if (filters.slaStatus === 'breached') {
        conditions.push(`(s.status = 'breached' OR s.breached_at IS NOT NULL)`)
      } else if (filters.slaStatus === 'healthy') {
        conditions.push(`s.status = 'active' AND (s.deadline_at IS NULL OR s.deadline_at > now() + interval '4 hours')`)
      } else {
        conditions.push(`s.status = $${pidx++}`)
        params.push(filters.slaStatus)
      }
    }
    if (filters.dateFrom) {
      conditions.push(`r.created_at >= $${pidx++}`)
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      conditions.push(`r.created_at <= $${pidx++}`)
      params.push(filters.dateTo)
    }

    const result = await pool.query(`
      SELECT
        r.public_reference AS reference,
        r.version,
        r.requirement,
        r.urgency,
        r.status,
        r.created_at,
        d.slug        AS service_domain,
        c.name        AS client_name,
        c.company,
        u2.id         AS assignee_id,
        u2.display_name AS assignee_name,
        u2.email      AS assignee_email,
        u2.phone_whatsapp AS assignee_phone_whatsapp,
        a.assigned_at,
        s.deadline_at,
        s.status      AS sla_status,
        s.acknowledged_at,
        s.breached_at
      FROM requests r
      JOIN clients c         ON c.id  = r.client_id
      JOIN service_domains d ON d.id  = r.service_domain_id
      LEFT JOIN assignments a
        ON a.request_id = r.id AND a.ended_at IS NULL
      LEFT JOIN users u2
        ON u2.id = a.assignee_user_id
      LEFT JOIN sla_records s
        ON s.assignment_id = a.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE r.status
          WHEN 'awaiting_acknowledgement' THEN 1
          WHEN 'acknowledged'             THEN 2
          WHEN 'in_progress'              THEN 3
          ELSE 4
        END,
        r.updated_at DESC
    `, params)

    return {
      requests: result.rows.map(row => ({
        reference:    row.reference,
        version:      row.version,
        requirement:  row.requirement,
        service_domain: row.service_domain,
        urgency:      row.urgency,
        status:       row.status,
        created_at:   row.created_at,
        client: { name: row.client_name, company: row.company },
        currentResponsibility: row.assignee_name ? {
          id:         row.assignee_id,
          name:       row.assignee_name,
          email:      row.assignee_email,
          phoneWhatsapp: row.assignee_phone_whatsapp || null,
          assignedAt: row.assigned_at,
        } : null,
        sla: {
          deadlineAt:     row.deadline_at,
          status:         row.sla_status,
          acknowledgedAt: row.acknowledged_at,
          breachedAt:     row.breached_at,
        },
      })),
    }
  })

  // ── GET /v1/pm/requests/:id ─────────────────────────────────────────────────
  app.get('/v1/pm/requests/:id', async (request, reply) => {
    const user   = await authenticatePm(request, pool, config)
    const result = await pool.query(`
      SELECT r.public_reference AS reference,r.version,r.requirement,r.urgency,r.status,r.created_at,r.updated_at,
        d.slug AS service_domain,c.name,c.company,c.email,c.phone_whatsapp,
        u2.id AS assignee_id,u2.display_name AS assignee_name,u2.email AS assignee_email,u2.phone_whatsapp AS assignee_phone_whatsapp,a.assigned_at,
        s.started_at,s.deadline_at,s.status AS sla_status,s.acknowledged_at,s.breached_at
      FROM requests r JOIN clients c ON c.id=r.client_id JOIN service_domains d ON d.id=r.service_domain_id
      LEFT JOIN assignments a ON a.request_id=r.id AND a.ended_at IS NULL LEFT JOIN users u2 ON u2.id=a.assignee_user_id
      LEFT JOIN sla_records s ON s.assignment_id=a.id WHERE r.organization_id=$1 AND r.public_reference=$2`,
      [user.organizationId, reference(request)])
    if (!result.rowCount) return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    const row = result.rows[0]
    const escalation = await pool.query(
      `SELECT e.triggered_at,e.reason,u.display_name AS responsible_name FROM escalation_events e JOIN users u ON u.id=e.responsible_user_id JOIN requests r ON r.id=e.request_id WHERE r.organization_id=$1 AND r.public_reference=$2 ORDER BY e.triggered_at DESC LIMIT 1`,
      [user.organizationId, reference(request)])
    return {
      request: {
        reference:     row.reference,
        version:       row.version,
        requirement:   row.requirement,
        urgency:       row.urgency,
        status:        row.status,
        serviceDomain: row.service_domain,
        createdAt:     row.created_at,
        updatedAt:     row.updated_at,
        client:        { name: row.name, company: row.company, email: row.email, phone: row.phone_whatsapp },
        currentResponsibility: row.assignee_name ? {
          id:         row.assignee_id,
          name:       row.assignee_name,
          email:      row.assignee_email,
          phoneWhatsapp: row.assignee_phone_whatsapp || null,
          assignedAt: row.assigned_at,
        } : null,
        sla: { startedAt: row.started_at, deadlineAt: row.deadline_at, status: row.sla_status, acknowledgedAt: row.acknowledged_at, breachedAt: row.breached_at },
        escalation: escalation.rowCount ? { triggeredAt: escalation.rows[0].triggered_at, reason: escalation.rows[0].reason, responsibleName: escalation.rows[0].responsible_name } : null,
      },
    }
  })

  // ── GET /v1/pm/requests/:id/timeline ────────────────────────────────────────
  app.get('/v1/pm/requests/:id/timeline', async (request, reply) => {
    const user   = await authenticatePm(request, pool, config)
    const result = await pool.query(
      `SELECT a.event_type,a.occurred_at,a.actor_type,a.previous_state,a.new_state,u.display_name FROM audit_events a JOIN requests r ON r.id=a.request_id LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=$1 AND r.public_reference=$2 ORDER BY a.occurred_at`,
      [user.organizationId, reference(request)])
    if (!result.rowCount) return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    return {
      events: result.rows.map(row => ({
        type:   row.event_type,
        at:     row.occurred_at,
        actor:  row.display_name ?? (row.actor_type === 'system' ? 'System' : 'Client'),
        title:  row.event_type.replaceAll('_', ' '),
        detail: row.new_state ? `${row.previous_state ?? 'new'} → ${row.new_state}` : 'Request activity recorded.',
      })),
    }
  })

  // ── GET /v1/pm/requests/:id/comments ────────────────────────────────────────
  // Returns all internal comments for a ticket in ascending chronological order.
  // Access: PM always; Specialist only if assigned to the request.
  app.get('/v1/pm/requests/:id/comments', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)

    // Resolve request row to get its UUID and verify visibility
    const reqRow = await pool.query(
      `SELECT r.id FROM requests r
       LEFT JOIN assignments a ON a.request_id = r.id AND a.ended_at IS NULL
       WHERE r.organization_id = $1 AND r.public_reference = $2`,
      [user.organizationId, reference(request)])
    if (!reqRow.rowCount) {
      return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    }

    const requestId = reqRow.rows[0].id

    // Specialists can only view comments on tickets assigned to them
    if (user.role === 'internal_team_member') {
      const assignmentCheck = await pool.query(
        `SELECT 1 FROM assignments WHERE request_id = $1 AND assignee_user_id = $2 AND ended_at IS NULL`,
        [requestId, user.id])
      if (!assignmentCheck.rowCount) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'You can only view comments on tickets assigned to you.' } })
      }
    }

    const comments = await pool.query(`
      SELECT
        rc.id,
        rc.body,
        rc.created_at,
        rc.updated_at,
        u.id          AS author_id,
        u.display_name AS author_name,
        r2.code       AS author_role
      FROM request_comments rc
      JOIN users u
        ON u.id = rc.author_user_id
      JOIN user_roles ur2
        ON ur2.user_id = u.id
      JOIN roles r2
        ON r2.id = ur2.role_id
      WHERE rc.request_id = $1
        AND rc.is_internal = true
      ORDER BY rc.created_at ASC
    `, [requestId])

    return {
      comments: comments.rows.map(r => ({
        id:        r.id,
        body:      r.body,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        author: {
          id:       r.author_id,
          name:     r.author_name,
          role:     r.author_role,
          initials: r.author_name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
        },
      })),
    }
  })

  // ── POST /v1/pm/requests/:id/comments ───────────────────────────────────────
  // Creates a new internal comment. Validated with Zod.
  // Access: PM always; Specialist only if assigned.
  app.post('/v1/pm/requests/:id/comments', async (request, reply) => {
    const user   = await authenticatePm(request, pool, config)
    const parsed = commentBodySchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Comment body must be 1–4000 characters.')
    }
    const { body } = parsed.data

    // Resolve the request and check existence
    const reqRow = await pool.query(
      `SELECT r.id FROM requests r WHERE r.organization_id = $1 AND r.public_reference = $2`,
      [user.organizationId, reference(request)])
    if (!reqRow.rowCount) {
      return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    }
    const requestId = reqRow.rows[0].id

    // Specialists: must be current assignee to comment
    if (user.role === 'internal_team_member') {
      const assignmentCheck = await pool.query(
        `SELECT 1 FROM assignments WHERE request_id = $1 AND assignee_user_id = $2 AND ended_at IS NULL`,
        [requestId, user.id])
      if (!assignmentCheck.rowCount) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'You can only comment on tickets assigned to you.' } })
      }
    }

    const inserted = await pool.query(`
      INSERT INTO request_comments (organization_id, request_id, author_user_id, body, is_internal)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, body, created_at, updated_at
    `, [user.organizationId, requestId, user.id, body.trim()])

    const comment = inserted.rows[0]
    return reply.code(201).send({
      comment: {
        id:        comment.id,
        body:      comment.body,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        author: {
          id:       user.id,
          name:     user.displayName,
          role:     user.role,
          initials: user.displayName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
        },
      },
    })
  })

  // ── DELETE /v1/pm/requests/:id ───────────────────────────────────────────────
  app.delete('/v1/pm/requests/:id', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)
    if (user.role !== 'project_manager') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Only Project Managers can delete requests.' } })
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const targetReq = await client.query(
        'SELECT id, status FROM requests WHERE organization_id=$1 AND public_reference=$2 FOR UPDATE',
        [user.organizationId, reference(request)])
      if (!targetReq.rowCount) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
      }
      const reqId = targetReq.rows[0].id
      // Delete child records in dependency order
      await client.query('DELETE FROM request_comments WHERE request_id=$1', [reqId])
      await client.query('DELETE FROM escalation_events WHERE request_id=$1', [reqId])
      await client.query('DELETE FROM audit_events WHERE request_id=$1', [reqId])
      const assignmentIds = (await client.query('SELECT id FROM assignments WHERE request_id=$1', [reqId])).rows.map(r => r.id)
      if (assignmentIds.length > 0) {
        await client.query('DELETE FROM sla_records WHERE assignment_id = ANY($1)', [assignmentIds])
        await client.query('DELETE FROM assignments WHERE request_id=$1', [reqId])
      }
      await client.query('DELETE FROM requests WHERE id=$1', [reqId])
      await client.query('COMMIT')
      return { success: true, deletedReference: reference(request) }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })
}
