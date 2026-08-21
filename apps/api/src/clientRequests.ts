import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type pg from 'pg';
import type { AppConfig } from '@nvara/config';
import { ApiError } from './errors.js';
import { logger } from './logger.js';

const submissionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(40).regex(/^[\d\s+()\-.]+$/),
  serviceDomain: z.string().trim().min(1).max(64),
  requirement: z.string().trim().min(10).max(5000),
  urgency: z.enum(['flexible', 'soon', 'time_sensitive']),
}).strict();

type Submission = z.infer<typeof submissionSchema>;
type SafeResponse = { reference: string; createdAt: string; status: 'received' };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function requestHash(body: Submission): string { return createHash('sha256').update(stableJson(body)).digest('hex'); }
function normalizePhone(value: string): string { const digits = value.replace(/\D/g, ''); return value.trim().startsWith('+') ? `+${digits}` : digits; }
function publicReference(): string { return `NVARA-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`; }
function requestBody(request: FastifyRequest): unknown { return request.body; }
const rateWindows = new Map<string, { startedAt: number; count: number }>();
function enforceRateLimit(request: FastifyRequest, limit: number): void {
  const now = Date.now();
  if (rateWindows.size > 10_000) for (const [key, window] of rateWindows) if (now - window.startedAt >= 60_000) rateWindows.delete(key);
  const key = request.ip;
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > limit) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
}

export function registerClientRequestRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig): void {
  app.post('/v1/client/requests', { bodyLimit: 32 * 1024 }, async (request, reply) => {
    enforceRateLimit(request, config.PUBLIC_RATE_LIMIT_PER_MINUTE);
    const rawKey = request.headers['idempotency-key'];
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (!key || key.length > 200) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid Idempotency-Key header is required.', { 'Idempotency-Key': 'Required and limited to 200 characters.' });

    const parsed = submissionSchema.safeParse(requestBody(request));
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join('.') || 'body'] = issue.message;
      request.log.warn({ requestId: request.id, fields: Object.keys(fields) }, 'client request validation failed');
      throw new ApiError(422, 'VALIDATION_ERROR', 'Please check the submitted fields.', fields);
    }
    const body = { ...parsed.data, name: parsed.data.name.replace(/\s+/g, ' '), company: parsed.data.company.replace(/\s+/g, ' '), phone: normalizePhone(parsed.data.phone) };
    const hash = requestHash(body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const organization = await client.query<{ id: string }>('SELECT id FROM organizations WHERE name = $1', [config.DEFAULT_ORGANIZATION_NAME]);
      if (organization.rowCount !== 1) throw new ApiError(503, 'CONFIGURATION_ERROR', 'Request intake is not configured.');
      const idempotency = await client.query<{ id: string; request_hash: string; response_status: number | null; response_body: SafeResponse | null }>(
        "INSERT INTO idempotency_keys(actor_id,organization_id,method,route,key,request_hash,expires_at) SELECT 'anonymous', id, 'POST', '/v1/client/requests', $2, $3, now() + interval '24 hours' FROM organizations WHERE name = $1 ON CONFLICT (organization_id,actor_id,method,route,key) DO NOTHING RETURNING id, request_hash, response_status, response_body",
        [config.DEFAULT_ORGANIZATION_NAME, key, hash],
      );
      if (idempotency.rowCount === 0) {
        const existing = await client.query<{ request_hash: string; response_status: number | null; response_body: SafeResponse | null }>("SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE organization_id = (SELECT id FROM organizations WHERE name = $1) AND actor_id = 'anonymous' AND method = 'POST' AND route = '/v1/client/requests' AND key = $2 FOR UPDATE", [config.DEFAULT_ORGANIZATION_NAME, key]);
        const row = existing.rows[0];
        if (!row || row.request_hash !== hash) throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request.');
        if (!row.response_body || !row.response_status) throw new Error('Stored idempotency response is incomplete.');
        await client.query('COMMIT');
        request.log.info({ requestId: request.id }, 'client request idempotency replay');
        return reply.code(row.response_status).send(row.response_body);
      }

      const routing = await client.query<{ organization_id: string; pm_id: string }>("SELECT o.id AS organization_id, u.id AS pm_id FROM organizations o JOIN users u ON u.organization_id = o.id JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE o.name = $1 AND u.is_active = true AND r.code = 'project_manager'", [config.DEFAULT_ORGANIZATION_NAME]);
      if (routing.rowCount !== 1) throw new Error('Exactly one active initial project manager is required.');
      const { organization_id: organizationId, pm_id: pmId } = routing.rows[0];
      const domain = await client.query<{ id: string }>('SELECT id FROM service_domains WHERE organization_id = $1 AND slug = $2 AND is_active = true', [organizationId, body.serviceDomain]);
      if (domain.rowCount !== 1) throw new ApiError(422, 'VALIDATION_ERROR', 'The selected service domain is not available.', { serviceDomain: 'Unknown or inactive service domain.' });
      const existingClient = await client.query<{ id: string }>('SELECT id FROM clients WHERE organization_id = $1 AND email = $2 FOR UPDATE', [organizationId, body.email]);
      let clientId: string;
      if (existingClient.rowCount === 1) {
        clientId = existingClient.rows[0].id;
        await client.query('UPDATE clients SET name = $1, company = $2, phone_whatsapp = $3, updated_at = now() WHERE id = $4', [body.name, body.company, body.phone, clientId]);
      } else {
        clientId = (await client.query<{ id: string }>('INSERT INTO clients(organization_id,name,company,email,phone_whatsapp) VALUES ($1,$2,$3,$4,$5) RETURNING id', [organizationId, body.name, body.company, body.email, body.phone])).rows[0].id;
      }
      const reference = publicReference();
      const created = await client.query<{ id: string; created_at: string }>('INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at', [organizationId, reference, clientId, domain.rows[0].id, body.requirement, body.urgency]);
      const assignment = await client.query<{ id: string; assigned_at: string }>('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2) RETURNING id, assigned_at', [created.rows[0].id, pmId]);
      const sla = await client.query<{ id: string }>("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES ($1,'acknowledgement_24h',86400,$2::timestamptz,$2::timestamptz + interval '24 hours') RETURNING id", [assignment.rows[0].id, assignment.rows[0].assigned_at]);
      const auditBase = [organizationId, created.rows[0].id, assignment.rows[0].id, sla.rows[0].id];
      await client.query("INSERT INTO audit_events(organization_id,request_id,assignment_id,sla_record_id,actor_type,event_type,new_state,metadata,correlation_id) VALUES ($1,$2,$3,$4,'system','request_created','awaiting_acknowledgement',$5,$6)", [...auditBase, JSON.stringify({ source: 'client_submission' }), request.id]);
      await client.query("INSERT INTO audit_events(organization_id,request_id,assignment_id,sla_record_id,actor_type,event_type,new_state,metadata,correlation_id) VALUES ($1,$2,$3,$4,'system','assigned','awaiting_acknowledgement',$5,$6)", [...auditBase, JSON.stringify({ assignment: 'initial_project_manager' }), request.id]);
      const response: SafeResponse = { reference, createdAt: created.rows[0].created_at, status: 'received' };
      await client.query('UPDATE idempotency_keys SET response_status = $1, response_body = $2 WHERE id = $3', [201, JSON.stringify(response), idempotency.rows[0].id]);
      await client.query('COMMIT');
      request.log.info({ requestId: request.id, reference }, 'client request created');
      return reply.code(201).send(response);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ApiError) throw error;
      request.log.error({ requestId: request.id, err: error }, 'client request transaction failed');
      throw new ApiError(500, 'INTERNAL_ERROR', 'The request could not be saved.');
    } finally { client.release(); }
  });
}

export function clientRequestErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const fastifyCode = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    const statusCode = error instanceof ApiError ? error.statusCode : fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 413 : fastifyCode === 'FST_ERR_CTP_INVALID_JSON_BODY' || fastifyCode === 'FST_ERR_VALIDATION' ? 400 : typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    const code = error instanceof ApiError ? error.code : fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE' : fastifyCode === 'FST_ERR_CTP_INVALID_JSON_BODY' ? 'INVALID_JSON' : fastifyCode === 'FST_ERR_VALIDATION' ? 'VALIDATION_ERROR' : statusCode < 500 ? 'REQUEST_ERROR' : 'INTERNAL_ERROR';
    const message = error instanceof ApiError ? error.message : code === 'PAYLOAD_TOO_LARGE' ? 'Request body is too large.' : code === 'INVALID_JSON' ? 'Request body must be valid JSON.' : code === 'VALIDATION_ERROR' ? 'Please check the submitted fields.' : statusCode < 500 && error instanceof Error ? error.message : 'Internal server error';
    
    // Attach error summary to request for HTTP response logger
    (request as any).routeError = { code, message };

    if (statusCode >= 500) {
      logger.error('Unhandled internal server error', error, { requestId: request.id, method: request.method, url: request.url });
    }

    return reply.code(statusCode).send({ error: { code, message, requestId: request.id, fields: error instanceof ApiError ? error.fields : undefined } });
  });
}
