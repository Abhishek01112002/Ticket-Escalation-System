import type { FastifyInstance, FastifyRequest } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import type { AppConfig } from '@nvara/config'
import { ApiError } from './errors.js'
import {
  generatePasswordResetToken,
  generateSessionToken,
  hashPassword,
  hashPasswordResetToken,
  hashSessionToken,
  hashInvitationToken,
  verifyPassword,
} from './crypto.js'
import { emailService } from './emailService.js'

export type PmAuth = {
  id: string
  organizationId: string
  displayName: string
  email: string
  role: 'project_manager' | 'internal_team_member'
  organizationName: string
  sessionId?: string
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=')
    if (name === 'nvara_session') {
      const val = rest.join('=')
      return val ? decodeURIComponent(val) : null
    }
  }
  return null
}

export function extractSessionToken(request: FastifyRequest): string | null {
  // 1. Check HttpOnly cookie
  const cookieToken = parseSessionCookie(request.headers.cookie)
  if (cookieToken) return cookieToken

  // 2. Check Authorization Bearer header
  const authHeader = request.headers.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim()
    if (bearerToken) return bearerToken
  }

  return null
}

export async function authenticatePm(
  request: FastifyRequest,
  pool: pg.Pool,
  config: AppConfig
): Promise<PmAuth> {
  const token = extractSessionToken(request)

  if (token) {
    const tokenHash = hashSessionToken(token)
    const result = await pool.query<{
      sessionId: string
      id: string
      organizationId: string
      displayName: string
      email: string
      organizationName: string
      role: 'project_manager' | 'internal_team_member'
      isActive: boolean
    }>(
      `SELECT
        s.id AS "sessionId",
        u.id,
        u.organization_id AS "organizationId",
        u.display_name AS "displayName",
        u.email,
        o.name AS "organizationName",
        r.code AS role,
        u.is_active AS "isActive"
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      JOIN organizations o ON o.id = u.organization_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE s.session_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()`,
      [tokenHash]
    )

    if (result.rowCount !== 1) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session is invalid or has expired.')
    }

    const row = result.rows[0]
    if (!row.isActive || !['project_manager', 'internal_team_member'].includes(row.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Access denied. Account is inactive or unauthorized.')
    }

    if (request.url.includes('/assignments') && row.role !== 'project_manager') {
      throw new ApiError(403, 'FORBIDDEN', 'Project manager access is required.')
    }

    // Touch last_seen_at asynchronously
    pool.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [row.sessionId]).catch(() => {})

    return {
      id: row.id,
      organizationId: row.organizationId,
      displayName: row.displayName,
      email: row.email,
      role: row.role,
      organizationName: row.organizationName,
      sessionId: row.sessionId,
    }
  }

  // Development fallback (only if DEV_AUTH_ENABLED in development mode)
  const header = request.headers['x-dev-auth-subject']
  const subject =
    config.NODE_ENV === 'development' && config.DEV_AUTH_ENABLED && typeof header === 'string'
      ? header.trim()
      : null

  if (subject) {
    const result = await pool.query<{
      id: string
      organizationId: string
      displayName: string
      email: string
      organizationName: string
      role: 'project_manager' | 'internal_team_member'
      isActive: boolean
    }>(
      `SELECT
        u.id,
        u.organization_id AS "organizationId",
        u.display_name AS "displayName",
        u.email,
        o.name AS "organizationName",
        r.code AS role,
        u.is_active AS "isActive"
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.auth_subject = $1`,
      [subject]
    )

    if (result.rowCount === 1) {
      const row = result.rows[0]
      if (row.isActive && ['project_manager', 'internal_team_member'].includes(row.role)) {
        return {
          id: row.id,
          organizationId: row.organizationId,
          displayName: row.displayName,
          email: row.email,
          role: row.role,
          organizationName: row.organizationName,
        }
      }
    }
  }

  throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in is required to access the operations workspace.')
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig) {
  // Rate limiting map for login
  const loginAttempts = new Map<string, { count: number; resetAt: number }>()

  function checkLoginRateLimit(key: string, isProd: boolean) {
    if (!isProd) return
    const now = Date.now()
    const record = loginAttempts.get(key)
    if (!record) return

    if (now > record.resetAt) {
      loginAttempts.delete(key)
      return
    }

    if (record.count >= 5) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000)
      throw new ApiError(
        429,
        'RATE_LIMITED',
        `Too many failed login attempts. Please try again in ${retryAfterSec} seconds.`
      )
    }
  }

  function recordLoginFailure(key: string) {
    const now = Date.now()
    const record = loginAttempts.get(key)
    if (!record || now > record.resetAt) {
      loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 })
    } else {
      record.count += 1
    }
  }

  function clearLoginAttempts(key: string) {
    loginAttempts.delete(key)
  }

  // POST /v1/auth/login
  app.post('/v1/auth/login', async (request: FastifyRequest, reply) => {
    const isProd = config.NODE_ENV === 'production'
    const ip = String(request.ip || 'unknown')
    const userAgent = (request.headers['user-agent'] as string) || 'Browser Session'

    checkLoginRateLimit(ip, isProd)

    const parseResult = loginSchema.safeParse(request.body)
    if (!parseResult.success) {
      throw new ApiError(400, 'INVALID_INPUT', 'Valid email and password are required.')
    }

    const { email, password } = parseResult.data
    checkLoginRateLimit(email.toLowerCase(), isProd)

    const result = await pool.query<{
      id: string
      organization_id: string
      organization_name: string
      display_name: string
      email: string
      role: string
      password_hash: string | null
      is_active: boolean
    }>(
      `SELECT u.id, u.organization_id, o.name AS organization_name, u.display_name, u.email, r.code AS role, u.password_hash, u.is_active
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    )

    const userRow = result.rows[0]
    if (!userRow || !userRow.password_hash || !userRow.is_active) {
      recordLoginFailure(ip)
      recordLoginFailure(email.toLowerCase())
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    }

    const isValidPassword = await verifyPassword(password, userRow.password_hash)
    if (!isValidPassword) {
      recordLoginFailure(ip)
      recordLoginFailure(email.toLowerCase())
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    }

    if (userRow.role !== 'project_manager' && userRow.role !== 'internal_team_member') {
      recordLoginFailure(ip)
      recordLoginFailure(email.toLowerCase())
      throw new ApiError(403, 'FORBIDDEN_ROLE', 'Account is not authorized for operations access.')
    }

    clearLoginAttempts(ip)
    clearLoginAttempts(email.toLowerCase())

    const user: PmAuth = {
      id: userRow.id,
      organizationId: userRow.organization_id,
      organizationName: userRow.organization_name,
      displayName: userRow.display_name,
      email: userRow.email,
      role: userRow.role as PmAuth['role'],
    }

    // Generate session token (256-bit entropy)
    const { rawToken, tokenHash } = generateSessionToken()
    const sessionTtlSeconds = 86400 * 7 // 7-day session
    const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000)

    await pool.query(
      `INSERT INTO sessions(user_id, organization_id, session_token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.organizationId, tokenHash, expiresAt, userAgent, ip]
    )

    // Set HttpOnly Cookie (Secure only in production)
    const cookieString = `nvara_session=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${
      isProd ? '; Secure' : ''
    }`
    reply.header('Set-Cookie', cookieString)

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        organizationName: user.organizationName,
      },
    }
  })

  // GET /v1/auth/me
  app.get('/v1/auth/me', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)
    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        organizationName: user.organizationName,
      },
    }
  })

  // POST /v1/auth/logout
  app.post('/v1/auth/logout', async (request: FastifyRequest, reply) => {
    const token = extractSessionToken(request)
    if (token) {
      const tokenHash = hashSessionToken(token)
      await pool.query('UPDATE sessions SET revoked_at = now() WHERE session_token_hash = $1', [tokenHash])
    }

    const isProd = config.NODE_ENV === 'production'
    const clearCookie = `nvara_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
      isProd ? '; Secure' : ''
    }`
    reply.header('Set-Cookie', clearCookie)

    return { status: 'ok' }
  })

  // ─── Active Sessions & Device Management ─────────────────────────────────────

  // GET /v1/auth/sessions — List all active sessions for the current user
  app.get('/v1/auth/sessions', async (request) => {
    const user = await authenticatePm(request, pool, config)

    const result = await pool.query<{
      id: string
      user_agent: string | null
      ip_address: string | null
      created_at: Date
      last_seen_at: Date
    }>(
      `SELECT id, user_agent, ip_address, created_at, last_seen_at
       FROM sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
       ORDER BY last_seen_at DESC`,
      [user.id]
    )

    const sessions = result.rows.map((row) => ({
      id: row.id,
      userAgent: row.user_agent || 'Web Browser',
      ipAddress: row.ip_address || 'Unknown',
      createdAt: row.created_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      isCurrent: row.id === user.sessionId,
    }))

    return { sessions }
  })

  // POST /v1/auth/sessions/revoke-others — Sign out of all other devices
  app.post('/v1/auth/sessions/revoke-others', async (request) => {
    const user = await authenticatePm(request, pool, config)

    if (!user.sessionId) {
      throw new ApiError(400, 'CANNOT_REVOKE', 'Current session is not tracked.')
    }

    const result = await pool.query(
      `UPDATE sessions
       SET revoked_at = now()
       WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`,
      [user.id, user.sessionId]
    )

    // Audit log
    await pool.query(
      `INSERT INTO audit_events (
        organization_id, actor_user_id, actor_type, event_type, metadata
      ) VALUES ($1, $2, 'user', 'REMOTE_SESSIONS_REVOKED', $3::jsonb)`,
      [user.organizationId, user.id, JSON.stringify({ revokedCount: result.rowCount })]
    )

    return {
      success: true,
      message: 'All other active sessions have been signed out.',
      revokedCount: result.rowCount || 0,
    }
  })

  // ─── Team Member Invitation & Onboarding Endpoints ──────────────────────────

  // GET /v1/invitations/:token — Verify invitation token and get onboarding details
  app.get<{ Params: { token: string } }>('/v1/invitations/:token', async (request, reply) => {
    const rawToken = String(request.params.token || '')
    const tokenHash = hashInvitationToken(rawToken)

    const result = await pool.query<{
      id: string
      email: string
      display_name: string
      organization_name: string
      role_code: string
      expires_at: Date
      accepted_at: Date | null
      inviter_name: string
    }>(
      `SELECT
        ui.id,
        ui.email,
        ui.display_name,
        o.name AS organization_name,
        r.code AS role_code,
        ui.expires_at,
        ui.accepted_at,
        u_inviter.display_name AS inviter_name
       FROM user_invitations ui
       JOIN organizations o ON o.id = ui.organization_id
       JOIN roles r ON r.id = ui.role_id
       JOIN users u_inviter ON u_inviter.id = ui.invited_by_user_id
       WHERE ui.token_hash = $1`,
      [tokenHash]
    )

    if (!result.rowCount) {
      throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This invitation link is invalid or has expired.')
    }

    const invite = result.rows[0]

    if (invite.accepted_at) {
      throw new ApiError(400, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted. Please sign in.')
    }

    if (new Date() > invite.expires_at) {
      throw new ApiError(400, 'INVITATION_EXPIRED', 'This invitation link has expired. Please request a new invitation from your administrator.')
    }

    return {
      valid: true,
      email: invite.email,
      displayName: invite.display_name,
      organizationName: invite.organization_name,
      role: invite.role_code,
      inviterName: invite.inviter_name,
    }
  })

  const acceptInviteSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters long.'),
  })

  // POST /v1/invitations/:token/accept — Complete onboarding and set password
  app.post<{ Params: { token: string } }>('/v1/invitations/:token/accept', async (request, reply) => {
    const isProd = config.NODE_ENV === 'production'
    const ip = String(request.ip || 'unknown')
    const userAgent = (request.headers['user-agent'] as string) || 'Browser Session'

    const rawToken = String(request.params.token || '')
    const tokenHash = hashInvitationToken(rawToken)

    const parseResult = acceptInviteSchema.safeParse(request.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const { password } = parseResult.data

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const inviteRes = await client.query<{
        id: string
        organization_id: string
        email: string
        display_name: string
        role_id: string
        role_code: string
        organization_name: string
      }>(
        `SELECT
          ui.id,
          ui.organization_id,
          ui.email,
          ui.display_name,
          ui.role_id,
          r.code AS role_code,
          o.name AS organization_name
         FROM user_invitations ui
         JOIN organizations o ON o.id = ui.organization_id
         JOIN roles r ON r.id = ui.role_id
         WHERE ui.token_hash = $1
           AND ui.accepted_at IS NULL
           AND ui.expires_at > now()
         FOR UPDATE`,
        [tokenHash]
      )

      if (!inviteRes.rowCount) {
        await client.query('ROLLBACK')
        throw new ApiError(400, 'INVALID_INVITATION', 'Invitation is invalid, expired, or has already been accepted.')
      }

      const invite = inviteRes.rows[0]
      const passwordHash = hashPassword(password)
      const authSubject = `user-${randomUUID()}`

      // Create new active user
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (
          organization_id,
          display_name,
          email,
          auth_subject,
          password_hash,
          is_active,
          is_demo
        ) VALUES ($1, $2, $3, $4, $5, true, false)
        RETURNING id`,
        [invite.organization_id, invite.display_name, invite.email.toLowerCase(), authSubject, passwordHash]
      )

      const newUserId = userRes.rows[0].id

      // Assign role
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
        newUserId,
        invite.role_id,
      ])

      // Mark invite accepted
      await client.query('UPDATE user_invitations SET accepted_at = now() WHERE id = $1', [invite.id])

      // Generate session token (256-bit entropy)
      const { rawToken: sessionRawToken, tokenHash: sessionHash } = generateSessionToken()
      const sessionTtlSeconds = 86400 * 7 // 7-day session
      const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000)

      await client.query(
        `INSERT INTO sessions(user_id, organization_id, session_token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUserId, invite.organization_id, sessionHash, expiresAt, userAgent, ip]
      )

      // Append immutable audit log
      await client.query(
        `INSERT INTO audit_events (
          organization_id, actor_user_id, actor_type, event_type, metadata
        ) VALUES ($1, $2, 'user', 'USER_ONBOARDED', $3::jsonb)`,
        [
          invite.organization_id,
          newUserId,
          JSON.stringify({
            email: invite.email,
            role: invite.role_code,
            displayName: invite.display_name,
          }),
        ]
      )

      await client.query('COMMIT')

      // Set session cookie
      const cookieString = `nvara_session=${encodeURIComponent(sessionRawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionTtlSeconds}${
        isProd ? '; Secure' : ''
      }`
      reply.header('Set-Cookie', cookieString)

      return reply.code(201).send({
        user: {
          id: newUserId,
          displayName: invite.display_name,
          email: invite.email,
          role: invite.role_code,
          organizationName: invite.organization_name,
        },
        message: 'Welcome to the team! Your account has been activated.',
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // ─── Forgot Password / Password Reset Flow ───────────────────────────────────

  const forgotPasswordAttempts = new Map<string, { count: number; resetAt: number }>()

  const forgotPasswordSchema = z.object({
    email: z.string().trim().email(),
  })

  // POST /v1/auth/forgot-password (Zero-Enumeration)
  app.post('/v1/auth/forgot-password', async (request, reply) => {
    const isProd = config.NODE_ENV === 'production'
    const ip = String(request.ip || 'unknown')
    const now = Date.now()

    // Sliding window rate limit: max 5 requests per 15 mins per IP
    const record = forgotPasswordAttempts.get(ip)
    if (isProd && record) {
      if (now > record.resetAt) {
        forgotPasswordAttempts.delete(ip)
      } else if (record.count >= 5) {
        throw new ApiError(429, 'RATE_LIMITED', 'Too many password reset requests. Please try again later.')
      }
    }

    const parseResult = forgotPasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      throw new ApiError(400, 'INVALID_INPUT', 'A valid email address is required.')
    }

    const { email } = parseResult.data

    if (isProd) {
      if (!record || now > record.resetAt) {
        forgotPasswordAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
      } else {
        record.count += 1
      }
    }

    // Lookup active user
    const userRes = await pool.query<{ id: string; display_name: string; organization_id: string; is_active: boolean }>(
      'SELECT id, display_name, organization_id, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    let devResetToken: string | null = null

    if (userRes.rowCount === 1 && userRes.rows[0].is_active) {
      const user = userRes.rows[0]

      // Invalidate existing unused tokens for this user
      await pool.query(
        'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      )

      // Generate 256-bit token + SHA-256 hash
      const { rawToken, tokenHash } = generatePasswordResetToken()
      devResetToken = rawToken
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15-minute TTL

      await pool.query(
        'INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      )

      // Dispatch transactional email
      const resetUrl = `http://127.0.0.1:5173/reset-password?token=${rawToken}`
      await emailService.sendEmail(
        emailService.buildPasswordResetEmail({
          to: email,
          displayName: user.display_name,
          resetUrl,
          ipAddress: ip,
          ttlMinutes: 15,
        })
      )

      // Append audit log
      await pool.query(
        `INSERT INTO audit_events (
          organization_id, actor_user_id, actor_type, event_type, metadata
        ) VALUES ($1, $2, 'system', 'PASSWORD_RESET_REQUESTED', $3::jsonb)`,
        [user.organization_id, user.id, JSON.stringify({ ipAddress: ip })]
      )

      request.log.info({ op: 'password_reset_requested', userId: user.id }, 'Password reset token generated')
    }

    // Zero user enumeration response
    return {
      message: 'If your email is associated with an active account, password reset instructions have been generated.',
      // In development mode only, expose the token / link to streamline testing
      ...(!isProd && devResetToken ? { devResetToken, resetUrl: `/reset-password?token=${devResetToken}` } : {}),
    }
  })

  const verifyTokenSchema = z.object({
    token: z.string().min(16),
  })

  // POST /v1/auth/verify-reset-token
  app.post('/v1/auth/verify-reset-token', async (request, reply) => {
    const parseResult = verifyTokenSchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.code(400).send({ valid: false, message: 'Invalid token format.' })
    }

    const tokenHash = hashPasswordResetToken(parseResult.data.token)
    const result = await pool.query<{ id: string; user_id: string }>(
      `SELECT prt.id, prt.user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > now()
         AND u.is_active = true`,
      [tokenHash]
    )

    if (result.rowCount !== 1) {
      return reply.code(400).send({ valid: false, message: 'Password reset link is invalid or has expired.' })
    }

    return { valid: true }
  })

  const resetPasswordSchema = z.object({
    token: z.string().min(16),
    newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
  })

  // POST /v1/auth/reset-password
  app.post('/v1/auth/reset-password', async (request, reply) => {
    const parseResult = resetPasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const { token, newPassword } = parseResult.data
    const tokenHash = hashPasswordResetToken(token)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const tokenRes = await client.query<{ id: string; user_id: string; organization_id: string }>(
        `SELECT prt.id, prt.user_id, u.organization_id
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token_hash = $1
           AND prt.used_at IS NULL
           AND prt.expires_at > now()
           AND u.is_active = true
         FOR UPDATE`,
        [tokenHash]
      )

      if (tokenRes.rowCount !== 1) {
        await client.query('ROLLBACK')
        throw new ApiError(400, 'INVALID_TOKEN', 'Password reset link is invalid or has expired.')
      }

      const { id: tokenId, user_id: userId, organization_id: orgId } = tokenRes.rows[0]
      const newPasswordHash = hashPassword(newPassword)

      // Update password hash
      await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        newPasswordHash,
        userId,
      ])

      // Mark token consumed
      await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenId])

      // Security invariant: Revoke ALL active sessions for this user
      await client.query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
      ])

      // Append audit event
      await client.query(
        `INSERT INTO audit_events (
          organization_id, actor_user_id, actor_type, event_type, metadata
        ) VALUES ($1, $2, 'user', 'PASSWORD_RESET_COMPLETED', $3::jsonb)`,
        [orgId, userId, JSON.stringify({ method: 'token_reset' })]
      )

      await client.query('COMMIT')

      request.log.info({ op: 'password_reset_completed', userId }, 'Password reset successfully completed and active sessions revoked')
      return { success: true, message: 'Password has been reset successfully. Please sign in with your new password.' }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  // ─── Authenticated Password Change ──────────────────────────────────────────

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
  })

  // POST /v1/auth/change-password
  app.post('/v1/auth/change-password', async (request, reply) => {
    const user = await authenticatePm(request, pool, config)
    const parseResult = changePasswordSchema.safeParse(request.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Invalid input.'
      throw new ApiError(400, 'INVALID_INPUT', firstError)
    }

    const { currentPassword, newPassword } = parseResult.data

    if (currentPassword === newPassword) {
      throw new ApiError(400, 'SAME_PASSWORD', 'New password must be different from current password.')
    }

    const userRes = await pool.query<{ password_hash: string | null }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    )

    const storedHash = userRes.rows[0]?.password_hash
    if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
      throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'The current password entered is incorrect.')
    }

    const newHash = hashPassword(newPassword)
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      newHash,
      user.id,
    ])

    // Revoke all other remote sessions (keep current session active)
    if (user.sessionId) {
      await pool.query(
        'UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL',
        [user.id, user.sessionId]
      )
    }

    // Append audit event
    await pool.query(
      `INSERT INTO audit_events (
        organization_id, actor_user_id, actor_type, event_type, metadata
      ) VALUES ($1, $2, 'user', 'PASSWORD_CHANGED', $3::jsonb)`,
      [user.organizationId, user.id, JSON.stringify({ revokedRemoteSessions: true })]
    )

    request.log.info({ op: 'password_changed', userId: user.id }, 'User changed password and revoked remote sessions')
    return { success: true, message: 'Your password has been changed successfully. Other active sessions have been signed out.' }
  })
}
