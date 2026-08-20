import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import type { AppConfig } from '@nvara/config'
import { authenticatePm } from './auth.js'

const reference = (request: FastifyRequest) => String((request.params as any).id ?? '')

export function registerPmRequestRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig) {
  app.get('/v1/auth/me', async request => {
    const user = await authenticatePm(request, pool, config)
    return { user: { id: user.id, displayName: user.displayName, email: user.email, role: user.role, organizationName: user.organizationName } }
  })

  app.get('/v1/pm/team-members', async request => {
    const user = await authenticatePm(request, pool, config)
    const result = await pool.query("SELECT u.id,u.display_name AS name,u.email FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles role ON role.id=ur.role_id WHERE u.organization_id=$1 AND u.is_active=true AND role.code='internal_team_member'", [user.organizationId])
    return { teamMembers: result.rows }
  })

  app.get('/v1/pm/requests', async request => {
    const user = await authenticatePm(request, pool, config)
    const result = await pool.query(`
      SELECT r.public_reference AS reference,r.version,r.requirement,r.urgency,r.status,
        d.slug AS service_domain,c.name AS client_name,c.company,
        u2.id AS assignee_id,u2.display_name AS assignee_name,u2.email AS assignee_email,
        a.assigned_at,s.deadline_at,s.status AS sla_status,s.acknowledged_at,s.breached_at
      FROM requests r JOIN clients c ON c.id=r.client_id JOIN service_domains d ON d.id=r.service_domain_id
      LEFT JOIN assignments a ON a.request_id=r.id AND a.ended_at IS NULL LEFT JOIN users u2 ON u2.id=a.assignee_user_id
      LEFT JOIN sla_records s ON s.assignment_id=a.id WHERE r.organization_id=$1 ORDER BY r.updated_at DESC`, [user.organizationId])
    return { requests: result.rows.map(row => ({
      reference: row.reference, version: row.version, requirement: row.requirement, service_domain: row.service_domain,
      urgency: row.urgency, status: row.status, client: { name: row.client_name, company: row.company },
      currentResponsibility: row.assignee_name ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email, assignedAt: row.assigned_at } : null,
      sla: { deadlineAt: row.deadline_at, status: row.sla_status, acknowledgedAt: row.acknowledged_at, breachedAt: row.breached_at },
    })) }
  })

  app.get('/v1/pm/requests/:id', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)
    const result = await pool.query(`
      SELECT r.public_reference AS reference,r.version,r.requirement,r.urgency,r.status,r.created_at,r.updated_at,
        d.slug AS service_domain,c.name,c.company,c.email,c.phone_whatsapp,
        u2.id AS assignee_id,u2.display_name AS assignee_name,u2.email AS assignee_email,a.assigned_at,
        s.started_at,s.deadline_at,s.status AS sla_status,s.acknowledged_at,s.breached_at
      FROM requests r JOIN clients c ON c.id=r.client_id JOIN service_domains d ON d.id=r.service_domain_id
      LEFT JOIN assignments a ON a.request_id=r.id AND a.ended_at IS NULL LEFT JOIN users u2 ON u2.id=a.assignee_user_id
      LEFT JOIN sla_records s ON s.assignment_id=a.id WHERE r.organization_id=$1 AND r.public_reference=$2`, [user.organizationId, reference(request)])
    if (!result.rowCount) return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    const row = result.rows[0]
    const escalation = await pool.query(`SELECT e.triggered_at,e.reason,u.display_name AS responsible_name FROM escalation_events e JOIN users u ON u.id=e.responsible_user_id JOIN requests r ON r.id=e.request_id WHERE r.organization_id=$1 AND r.public_reference=$2 ORDER BY e.triggered_at DESC LIMIT 1`, [user.organizationId, reference(request)])
    return { request: {
      reference: row.reference, version: row.version, requirement: row.requirement, urgency: row.urgency, status: row.status,
      serviceDomain: row.service_domain, createdAt: row.created_at, updatedAt: row.updated_at,
      client: { name: row.name, company: row.company, email: row.email, phone: row.phone_whatsapp },
      currentResponsibility: row.assignee_name ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email, assignedAt: row.assigned_at } : null,
      sla: { startedAt: row.started_at, deadlineAt: row.deadline_at, status: row.sla_status, acknowledgedAt: row.acknowledged_at, breachedAt: row.breached_at },
      escalation: escalation.rowCount ? { triggeredAt: escalation.rows[0].triggered_at, reason: escalation.rows[0].reason, responsibleName: escalation.rows[0].responsible_name } : null,
    } }
  })

  app.get('/v1/pm/requests/:id/timeline', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)
    const result = await pool.query(`SELECT a.event_type,a.occurred_at,a.actor_type,a.previous_state,a.new_state,u.display_name FROM audit_events a JOIN requests r ON r.id=a.request_id LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=$1 AND r.public_reference=$2 ORDER BY a.occurred_at`, [user.organizationId, reference(request)])
    if (!result.rowCount) return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
    return { events: result.rows.map(row => ({ type: row.event_type, at: row.occurred_at, actor: row.display_name ?? (row.actor_type === 'system' ? 'System' : 'Client'), title: row.event_type.replaceAll('_', ' '), detail: row.new_state ? `${row.previous_state ?? 'new'} → ${row.new_state}` : 'Request activity recorded.' })) }
  })

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
        [user.organizationId, reference(request)]
      )
      if (!targetReq.rowCount) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: { code: 'REQUEST_NOT_FOUND', message: 'Request not found.' } })
      }
      const reqId = targetReq.rows[0].id
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
