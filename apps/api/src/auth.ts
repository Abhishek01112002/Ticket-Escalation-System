import type { FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { AppConfig } from '@nvara/config';
import { ApiError } from './errors.js';

export type PmAuth = { id: string; organizationId: string; displayName: string; email: string; role: 'project_manager' | 'internal_team_member'; organizationName: string };
export async function authenticatePm(request: FastifyRequest, pool: pg.Pool, config: AppConfig): Promise<PmAuth> {
  const header = request.headers['x-dev-auth-subject'];
  const subject = config.NODE_ENV === 'development' && config.DEV_AUTH_ENABLED && typeof header === 'string' ? header : undefined;
  if (!subject) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const result = await pool.query<PmAuth>(`SELECT u.id, u.organization_id AS "organizationId", u.display_name AS "displayName", u.email, o.name AS "organizationName", r.code AS role
    FROM users u JOIN organizations o ON o.id=u.organization_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.auth_subject=$1 AND u.is_active=true AND r.code IN ('project_manager','internal_team_member')`, [subject]);
  if (result.rowCount !== 1) throw new ApiError(403, 'FORBIDDEN', 'Project manager access is required.');
  if (request.url.includes('/assignments') && result.rows[0].role !== 'project_manager') throw new ApiError(403, 'FORBIDDEN', 'Project manager access is required.');
  return result.rows[0];
}
