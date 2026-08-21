import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import type { AppConfig } from '@nvara/config'
import { ApiError } from './errors.js'
import { authenticatePm } from './auth.js'
import { generateInvitationToken, generateTempPassword, hashPassword } from './crypto.js'
import { emailService } from './emailService.js'

export interface OrganizationUser {
  id: string
  displayName: string
  email: string
  phoneWhatsapp?: string | null
  role: 'project_manager' | 'internal_team_member'
  isActive: boolean
  createdAt: string
  activeAssignmentsCount: number
  resolvedAssignmentsCount: number
  slaComplianceRate: number
  avgResolutionMinutes: number
}

const inviteUserSchema = z.object({
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters.'),
  email: z.string().trim().email('A valid email address is required.'),
  phoneWhatsapp: z.string().trim().optional().nullable(),
  role: z.enum(['project_manager', 'internal_team_member']),
  mode: z.enum(['invite_link', 'instant_password']).default('invite_link'),
  initialPassword: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
    .refine((v) => !v || v.length >= 8, {
      message: 'Password must be at least 8 characters.',
    }),
})

const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).optional(),
  phoneWhatsapp: z.string().trim().optional().nullable(),
  role: z.enum(['project_manager', 'internal_team_member']).optional(),
  isActive: z.boolean().optional(),
  reassignToUserId: z.string().uuid().nullable().optional(),
})

export function registerUserManagementRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  config: AppConfig
) {
  // GET /v1/pm/users — List all organization members with SLA and workload metrics
  app.get('/v1/pm/users', async (request: FastifyRequest) => {
    const user = await authenticatePm(request, pool, config)

    const result = await pool.query<{
      id: string
      display_name: string
      email: string
      phone_whatsapp: string | null
      role: 'project_manager' | 'internal_team_member'
      is_active: boolean
      created_at: Date
      active_assignments_count: string
      resolved_assignments_count: string
      total_sla_count: string
      breached_sla_count: string
      avg_resolution_seconds: string | null
    }>(
      `SELECT
        u.id,
        u.display_name,
        u.email,
        u.phone_whatsapp,
        r.code AS role,
        u.is_active,
        u.created_at,
        COALESCE(act.cnt, 0)::int AS active_assignments_count,
        COALESCE(res.cnt, 0)::int AS resolved_assignments_count,
        COALESCE(sla_agg.total_sla, 0)::int AS total_sla_count,
        COALESCE(sla_agg.breached_sla, 0)::int AS breached_sla_count,
        res.avg_resolution_seconds
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM assignments
        WHERE assignee_user_id = u.id AND ended_at IS NULL
      ) act ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt,
               AVG(EXTRACT(EPOCH FROM (ended_at - assigned_at))) AS avg_resolution_seconds
        FROM assignments
        WHERE assignee_user_id = u.id AND ended_at IS NOT NULL
      ) res ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(s.id)::int AS total_sla,
               COUNT(s.id) FILTER (WHERE s.is_late = true OR s.status = 'breached')::int AS breached_sla
        FROM assignments a
        JOIN sla_records s ON s.assignment_id = a.id
        WHERE a.assignee_user_id = u.id
      ) sla_agg ON true
      WHERE u.organization_id = $1
      ORDER BY
        CASE
          WHEN u.email = 'pm@nvaramedia.com' THEN 1
          WHEN u.email = 'rohan.mehta@nvaramedia.com' THEN 2
          WHEN u.email = 'priya.sharma@nvaramedia.com' THEN 3
          ELSE 4
        END,
        u.is_active DESC,
        COALESCE(act.cnt, 0) DESC,
        u.display_name ASC`,
      [user.organizationId]
    )

    const users: OrganizationUser[] = result.rows.map((row) => {
      const totalSla = parseInt(row.total_sla_count || '0', 10)
      const breachedSla = parseInt(row.breached_sla_count || '0', 10)
      const complianceRate = totalSla === 0 ? 100 : Math.round(((totalSla - breachedSla) / totalSla) * 1000) / 10
      const avgSec = row.avg_resolution_seconds ? parseFloat(row.avg_resolution_seconds) : 0
      const avgMinutes = Math.round(avgSec / 60)

      return {
        id: row.id,
        displayName: row.display_name,
        email: row.email,
        phoneWhatsapp: row.phone_whatsapp || null,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at.toISOString(),
        activeAssignmentsCount: parseInt(row.active_assignments_count || '0', 10),
        resolvedAssignmentsCount: parseInt(row.resolved_assignments_count || '0', 10),
        slaComplianceRate: complianceRate,
        avgResolutionMinutes: avgMinutes,
      }
    })

    return { users }
  })

  // GET /v1/pm/users/:id/detail — Get comprehensive member profile & recent tickets
  app.get<{ Params: { id: string } }>('/v1/pm/users/:id/detail', async (request, reply) => {
    const actor = await authenticatePm(request, pool, config)
    const targetUserId = String(request.params.id)

    const userRes = await pool.query<{
      id: string
      display_name: string
      email: string
      phone_whatsapp: string | null
      role: 'project_manager' | 'internal_team_member'
      is_active: boolean
      created_at: Date
    }>(
      `SELECT u.id, u.display_name, u.email, u.phone_whatsapp, r.code AS role, u.is_active, u.created_at
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1 AND u.organization_id = $2`,
      [targetUserId, actor.organizationId]
    )

    if (!userRes.rowCount) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Team member not found.')
    }

    const member = userRes.rows[0]

    // Fetch recent 10 assignments
    const assignmentsRes = await pool.query<{
      id: string
      request_id: string
      public_reference: string
      requirement: string
      urgency: string
      status: string
      assigned_at: Date
      ended_at: Date | null
      is_late: boolean | null
      service_domain: string
    }>(
      `SELECT
        a.id,
        req.id AS request_id,
        req.public_reference,
        req.requirement,
        req.urgency,
        req.status,
        a.assigned_at,
        a.ended_at,
        sla.is_late,
        sd.name AS service_domain
       FROM assignments a
       JOIN requests req ON req.id = a.request_id
       JOIN service_domains sd ON sd.id = req.service_domain_id
       LEFT JOIN sla_records sla ON sla.assignment_id = a.id
       WHERE a.assignee_user_id = $1
       ORDER BY a.assigned_at DESC
       LIMIT 10`,
      [targetUserId]
    )

    const recentTickets = assignmentsRes.rows.map((row) => ({
      assignmentId: row.id,
      requestId: row.request_id,
      reference: row.public_reference,
      requirement: row.requirement,
      urgency: row.urgency,
      status: row.status,
      assignedAt: row.assigned_at.toISOString(),
      endedAt: row.ended_at ? row.ended_at.toISOString() : null,
      isLate: Boolean(row.is_late),
      serviceDomain: row.service_domain,
    }))

    return {
      member: {
        id: member.id,
        displayName: member.display_name,
        email: member.email,
        phoneWhatsapp: member.phone_whatsapp || null,
        role: member.role,
        isActive: member.is_active,
        createdAt: member.created_at.toISOString(),
      },
      recentTickets,
    }
  })

  // POST /v1/pm/users/invite — Dual-Mode Onboarding (Invite Link or Instant Password)
  app.post('/v1/pm/users/invite', async (request: FastifyRequest, reply) => {
    const actor = await authenticatePm(request, pool, config)

    if (actor.role !== 'project_manager') {
      throw new ApiError(403, 'FORBIDDEN', 'Only Project Managers can add or invite team members.')
    }

    const parseResult = inviteUserSchema.safeParse(request.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const { displayName, email, role, mode, initialPassword, phoneWhatsapp } = parseResult.data
    const normalizedEmail = email.toLowerCase()

    // Check email uniqueness within organization
    const existing = await pool.query(
      'SELECT id FROM users WHERE organization_id = $1 AND LOWER(email) = LOWER($2)',
      [actor.organizationId, normalizedEmail]
    )

    if (existing.rowCount && existing.rowCount > 0) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'A user with this email address already exists in the organization.')
    }

    // Role lookup
    const roleRes = await pool.query<{ id: string }>('SELECT id FROM roles WHERE code = $1', [role])
    if (!roleRes.rowCount) {
      throw new ApiError(500, 'ROLE_NOT_FOUND', `Role definition for ${role} not found.`)
    }
    const roleId = roleRes.rows[0].id

    // Mode A: Invite Link (Zero-shared secret with 7-day TTL)
    if (mode === 'invite_link') {
      const { rawToken, tokenHash } = generateInvitationToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Invalidate any older pending invitations for this email in this org
      await pool.query(
        'DELETE FROM user_invitations WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND accepted_at IS NULL',
        [actor.organizationId, normalizedEmail]
      )

      await pool.query(
        `INSERT INTO user_invitations (
          organization_id, email, display_name, role_id, token_hash, invited_by_user_id, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actor.organizationId, normalizedEmail, displayName, roleId, tokenHash, actor.id, expiresAt]
      )

      const inviteUrl = `http://127.0.0.1:5173/?invite=${rawToken}`

      // Send transactional invitation email
      await emailService.sendEmail(
        emailService.buildInvitationEmail({
          to: normalizedEmail,
          displayName,
          organizationName: actor.organizationName,
          inviterName: actor.displayName,
          roleName: role === 'project_manager' ? 'Project Manager' : 'Operations Specialist',
          inviteUrl,
          expiresInDays: 7,
        })
      )

      // Audit event
      await pool.query(
        `INSERT INTO audit_events (
          organization_id, actor_user_id, actor_type, event_type, metadata
        ) VALUES ($1, $2, 'user', 'USER_INVITED', $3::jsonb)`,
        [
          actor.organizationId,
          actor.id,
          JSON.stringify({ email: normalizedEmail, role, mode: 'invite_link', phoneWhatsapp: phoneWhatsapp || null }),
        ]
      )

      return reply.code(201).send({
        mode: 'invite_link',
        inviteUrl,
        rawToken,
        expiresAt: expiresAt.toISOString(),
        message: 'Invitation link generated and dispatched successfully.',
      })
    }

    // Mode B: Instant Provisioning with Temporary Password
    const effectivePassword = initialPassword || generateTempPassword()
    const passwordHash = hashPassword(effectivePassword)
    const authSubject = `user-${randomUUID()}`

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const userRes = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO users (
          organization_id, display_name, email, auth_subject, password_hash, phone_whatsapp, is_active, is_demo
        ) VALUES ($1, $2, $3, $4, $5, $6, true, false)
        RETURNING id, created_at`,
        [actor.organizationId, displayName, normalizedEmail, authSubject, passwordHash, phoneWhatsapp || null]
      )

      const newUser = userRes.rows[0]
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [newUser.id, roleId])

      // Audit event
      await client.query(
        `INSERT INTO audit_events (
          organization_id, actor_user_id, actor_type, event_type, metadata
        ) VALUES ($1, $2, 'user', 'USER_CREATED', $3::jsonb)`,
        [
          actor.organizationId,
          actor.id,
          JSON.stringify({ targetUserId: newUser.id, email: normalizedEmail, role, mode: 'instant_password', phoneWhatsapp: phoneWhatsapp || null }),
        ]
      )

      await client.query('COMMIT')

      return reply.code(201).send({
        mode: 'instant_password',
        user: {
          id: newUser.id,
          displayName,
          email: normalizedEmail,
          phoneWhatsapp: phoneWhatsapp || null,
          role,
          isActive: true,
          createdAt: newUser.created_at.toISOString(),
          activeAssignmentsCount: 0,
        },
        temporaryPassword: effectivePassword,
        message: 'Team member created successfully.',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // Backward-compatibility alias for POST /v1/pm/users
  app.post('/v1/pm/users', async (request: FastifyRequest, reply) => {
    const parseResult = inviteUserSchema.safeParse({ ...(request.body as object), mode: 'instant_password' })
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const actor = await authenticatePm(request, pool, config)
    if (actor.role !== 'project_manager') {
      throw new ApiError(403, 'FORBIDDEN', 'Only Project Managers can add team members.')
    }

    const { displayName, email, role, initialPassword } = parseResult.data
    const normalizedEmail = email.toLowerCase()

    const existing = await pool.query(
      'SELECT id FROM users WHERE organization_id = $1 AND LOWER(email) = LOWER($2)',
      [actor.organizationId, normalizedEmail]
    )

    if (existing.rowCount && existing.rowCount > 0) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'A user with this email address already exists in the organization.')
    }

    const roleRes = await pool.query<{ id: string }>('SELECT id FROM roles WHERE code = $1', [role])
    if (!roleRes.rowCount) {
      throw new ApiError(500, 'ROLE_NOT_FOUND', `Role definition for ${role} not found.`)
    }

    const effectivePassword = initialPassword || generateTempPassword()
    const passwordHash = hashPassword(effectivePassword)
    const authSubject = `user-${randomUUID()}`

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const userRes = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO users (
          organization_id, display_name, email, auth_subject, password_hash, is_active, is_demo
        ) VALUES ($1, $2, $3, $4, $5, true, false)
        RETURNING id, created_at`,
        [actor.organizationId, displayName, normalizedEmail, authSubject, passwordHash]
      )
      const newUser = userRes.rows[0]
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [newUser.id, roleRes.rows[0].id])
      await client.query('COMMIT')

      return reply.code(201).send({
        user: {
          id: newUser.id,
          displayName,
          email: normalizedEmail,
          role,
          isActive: true,
          createdAt: newUser.created_at.toISOString(),
          activeAssignmentsCount: 0,
        },
        temporaryPassword: effectivePassword,
        message: 'Team member added successfully.',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // PATCH /v1/pm/users/:id — Role, Status, and Workload Rebalancing
  app.patch<{ Params: { id: string } }>('/v1/pm/users/:id', async (request, reply) => {
    const actor = await authenticatePm(request, pool, config)

    if (actor.role !== 'project_manager') {
      throw new ApiError(403, 'FORBIDDEN', 'Only Project Managers can modify team member settings.')
    }

    const targetUserId = String(request.params.id)

    const parseResult = updateUserSchema.safeParse(request.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const { displayName, role, isActive, reassignToUserId, phoneWhatsapp } = parseResult.data

    // Lookup target user
    const targetRes = await pool.query<{
      id: string
      display_name: string
      email: string
      role: 'project_manager' | 'internal_team_member'
      is_active: boolean
      created_at: Date
    }>(
      `SELECT u.id, u.display_name, u.email, r.code AS role, u.is_active, u.created_at
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1 AND u.organization_id = $2`,
      [targetUserId, actor.organizationId]
    )

    if (!targetRes.rowCount) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Team member not found in your organization.')
    }

    const currentTarget = targetRes.rows[0]

    // ─── 1. Self-lockout guards ──────────────────────────────────────────────
    if (actor.id === targetUserId) {
      if (isActive === false) {
        throw new ApiError(400, 'CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own administrative account.')
      }
      if (role && role !== 'project_manager') {
        throw new ApiError(400, 'CANNOT_DEMOTE_SELF', 'You cannot remove your own Project Manager administrative role.')
      }
    }

    // ─── 2. Last Active PM Invariant (Organization Survival Guard) ───────────
    if (currentTarget.role === 'project_manager' && (isActive === false || (role && role !== 'project_manager'))) {
      const pmCountRes = await pool.query<{ count: string }>(
        `SELECT COUNT(u.id)::int AS count
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.organization_id = $1 AND r.code = 'project_manager' AND u.is_active = true`,
        [actor.organizationId]
      )
      const activePmCount = parseInt(pmCountRes.rows[0]?.count || '0', 10)
      if (activePmCount <= 1) {
        throw new ApiError(
          400,
          'CANNOT_REMOVE_LAST_ADMIN',
          'Cannot deactivate or demote the last remaining active Project Manager in the organization.'
        )
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Update basic fields
      if (displayName !== undefined || isActive !== undefined || phoneWhatsapp !== undefined) {
        await client.query(
          `UPDATE users
           SET
             display_name = COALESCE($1, display_name),
             is_active = COALESCE($2, is_active),
             phone_whatsapp = COALESCE($3, phone_whatsapp),
             updated_at = now()
           WHERE id = $4 AND organization_id = $5`,
          [displayName ?? null, isActive ?? null, phoneWhatsapp ?? null, targetUserId, actor.organizationId]
        )
      }

      // Update role if requested
      if (role !== undefined && role !== currentTarget.role) {
        const roleRes = await client.query<{ id: string }>('SELECT id FROM roles WHERE code = $1', [role])
        if (roleRes.rowCount) {
          await client.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId])
          await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
            targetUserId,
            roleRes.rows[0].id,
          ])

          await client.query(
            `INSERT INTO audit_events (
              organization_id, actor_user_id, actor_type, event_type, metadata
            ) VALUES ($1, $2, 'user', 'ROLE_CHANGED', $3::jsonb)`,
            [
              actor.organizationId,
              actor.id,
              JSON.stringify({ targetUserId, previousRole: currentTarget.role, newRole: role }),
            ]
          )
        }
      }

      // ─── 3. Workload Rebalancer & Session Revocation on Deactivation ─────────
      if (isActive === false) {
        // Revoke active sessions
        await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
          targetUserId,
        ])

        // Fetch open assignments
        const openAssignments = await client.query<{ id: string; request_id: string }>(
          'SELECT id, request_id FROM assignments WHERE assignee_user_id = $1 AND ended_at IS NULL',
          [targetUserId]
        )

        let rebalanceSummary = { unassignedCount: 0, reassignedToUserId: null as string | null }

        if (openAssignments.rowCount && openAssignments.rowCount > 0) {
          if (reassignToUserId) {
            // Verify new assignee exists and is active
            const newAssigneeRes = await client.query(
              'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
              [reassignToUserId, actor.organizationId]
            )
            if (!newAssigneeRes.rowCount) {
              throw new ApiError(400, 'INVALID_REASSIGNEE', 'Selected reassignment specialist is invalid or inactive.')
            }

            // End existing assignments
            await client.query(
              "UPDATE assignments SET ended_at = now(), end_reason = 'reassigned_on_member_deactivation' WHERE assignee_user_id = $1 AND ended_at IS NULL",
              [targetUserId]
            )

            // Create new assignments for each request
            for (const item of openAssignments.rows) {
              await client.query(
                'INSERT INTO assignments (request_id, assignee_user_id, assigned_by_user_id) VALUES ($1, $2, $3)',
                [item.request_id, reassignToUserId, actor.id]
              )
            }
            rebalanceSummary = { unassignedCount: openAssignments.rowCount, reassignedToUserId: reassignToUserId }
          } else {
            // Unassign all open tickets back to triage queue
            await client.query(
              "UPDATE assignments SET ended_at = now(), end_reason = 'unassigned_on_member_deactivation' WHERE assignee_user_id = $1 AND ended_at IS NULL",
              [targetUserId]
            )

            // Reset request status to awaiting_acknowledgement
            const requestIds = openAssignments.rows.map((r) => r.request_id)
            await client.query(
              `UPDATE requests
               SET status = 'awaiting_acknowledgement', updated_at = now()
               WHERE id = ANY($1::uuid[]) AND status IN ('acknowledged', 'in_progress', 'awaiting_acknowledgement')`,
              [requestIds]
            )
            rebalanceSummary = { unassignedCount: openAssignments.rowCount, reassignedToUserId: null }
          }
        }

        // Audit event for deactivation
        await client.query(
          `INSERT INTO audit_events (
            organization_id, actor_user_id, actor_type, event_type, metadata
          ) VALUES ($1, $2, 'user', 'USER_DEACTIVATED', $3::jsonb)`,
          [actor.organizationId, actor.id, JSON.stringify({ targetUserId, rebalance: rebalanceSummary })]
        )
      } else if (isActive === true && currentTarget.is_active === false) {
        // Audit event for reactivation
        await client.query(
          `INSERT INTO audit_events (
            organization_id, actor_user_id, actor_type, event_type, metadata
          ) VALUES ($1, $2, 'user', 'USER_REACTIVATED', $3::jsonb)`,
          [actor.organizationId, actor.id, JSON.stringify({ targetUserId })]
        )
      }

      await client.query('COMMIT')

      return reply.code(200).send({
        user: {
          id: targetUserId,
          displayName: displayName || currentTarget.display_name,
          email: currentTarget.email,
          role: role || currentTarget.role,
          isActive: isActive !== undefined ? isActive : currentTarget.is_active,
        },
        message: 'Team member settings updated successfully.',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // GET /v1/pm/audit-logs — Live organizational audit trail timeline
  app.get('/v1/pm/audit-logs', async (request) => {
    const actor = await authenticatePm(request, pool, config)

    const result = await pool.query<{
      id: string
      event_type: string
      occurred_at: Date
      actor_type: string
      metadata: Record<string, unknown>
      actor_name: string | null
      actor_email: string | null
    }>(
      `SELECT
        a.id,
        a.event_type,
        a.occurred_at,
        a.actor_type,
        a.metadata,
        u.display_name AS actor_name,
        u.email AS actor_email
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.organization_id = $1
       ORDER BY a.occurred_at DESC
       LIMIT 60`,
      [actor.organizationId]
    )

    const logs = result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      occurredAt: row.occurred_at.toISOString(),
      actorType: row.actor_type,
      actorName: row.actor_name || (row.actor_type === 'system' ? 'System Automated' : 'Unknown User'),
      actorEmail: row.actor_email,
      metadata: row.metadata || {},
    }))

    return { logs }
  })
}
