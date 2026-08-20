import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@nvara/config';
import { checkDatabase, createDbPool } from '@nvara/db';
import type pg from 'pg';
import { clientRequestErrorHandler, registerClientRequestRoutes } from './clientRequests.js';
import { registerPmRequestRoutes } from './pmRequests.js';
import { registerWorkflowMutationRoutes } from './workflowMutations.js';

export function buildApp(pool: pg.Pool, config = loadConfig()): FastifyInstance {
  const app = Fastify({ logger: { level: config.LOG_LEVEL }, requestIdHeader: 'x-request-id', genReqId: () => randomUUID(), bodyLimit: 32 * 1024 });
  pool.on('error', (error) => app.log.error({ err: error }, 'database pool connection error'));
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin === config.WEB_ORIGIN) reply.header('access-control-allow-origin', config.WEB_ORIGIN).header('vary', 'Origin');
    if (request.method === 'OPTIONS') {
      if (request.headers.origin !== config.WEB_ORIGIN) return reply.code(403).send({ error: { code: 'CORS_FORBIDDEN', message: 'Origin is not allowed.', requestId: request.id } });
      return reply.header('access-control-allow-methods', 'GET,POST,OPTIONS').header('access-control-allow-headers', 'content-type,idempotency-key,x-request-id,x-dev-auth-subject').code(204).send();
    }
  });
  app.addHook('onSend', async (request, reply) => { reply.header('x-request-id', request.id); });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => { try { await checkDatabase(pool); return { status: 'ok' }; } catch { return reply.code(503).send({ error: { code: 'DATABASE_NOT_READY', message: 'Database is not ready' } }); } });
  registerClientRequestRoutes(app, pool, config);
  registerPmRequestRoutes(app, pool, config);
  registerWorkflowMutationRoutes(app, pool, config);
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  clientRequestErrorHandler(app);
  return app;
}

const config = loadConfig();
const pool = createDbPool(config.DATABASE_URL);
const app = buildApp(pool, config);
const shutdown = async (signal: string) => { app.log.info({ signal }, 'shutting down'); await app.close(); await pool.end(); process.exit(0); };
process.once('SIGINT', () => void shutdown('SIGINT')); process.once('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
