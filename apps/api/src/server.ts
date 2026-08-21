import Fastify, { type FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { loadConfig } from '@nvara/config'
import { checkDatabase, createDbPool } from '@nvara/db'
import type pg from 'pg'
import { registerAuthRoutes } from './auth.js'
import { clientRequestErrorHandler, registerClientRequestRoutes } from './clientRequests.js'
import { logger } from './logger.js'
import { registerPmRequestRoutes } from './pmRequests.js'
import { registerPublicTrackerRoutes } from './publicTracker.js'
import { registerUserManagementRoutes } from './userManagement.js'
import { registerWorkflowMutationRoutes } from './workflowMutations.js'

export function buildApp(pool: pg.Pool, config = loadConfig()): FastifyInstance {
  const app = Fastify({
    logger: false, // Managed by high-signal AppLogger
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    bodyLimit: 32 * 1024,
  })

  pool.on('error', (error) => logger.error('Database pool connection error', error))

  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return false
    if (origin === config.WEB_ORIGIN) return true
    if (
      config.NODE_ENV !== 'production' &&
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
    ) {
      return true
    }
    return false
  }

  // Request timer hook
  app.addHook('onRequest', async (request, reply) => {
    ;(request as any).startTime = process.hrtime.bigint()

    const origin = request.headers.origin
    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin)) {
        return reply
          .code(403)
          .send({ error: { code: 'CORS_FORBIDDEN', message: 'Origin is not allowed.', requestId: request.id } })
      }
      return reply
        .header('access-control-allow-origin', origin)
        .header('access-control-allow-credentials', 'true')
        .header('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        .header(
          'access-control-allow-headers',
          'content-type,idempotency-key,x-request-id,x-dev-auth-subject,authorization,cookie'
        )
        .code(204)
        .send()
    }
  })

  // Response headers hook
  app.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin
    if (isAllowedOrigin(origin)) {
      reply
        .header('access-control-allow-origin', origin)
        .header('access-control-allow-credentials', 'true')
        .header('vary', 'Origin')
    }
    reply.header('x-request-id', request.id)
    reply.header('x-content-type-options', 'nosniff')
    reply.header('x-frame-options', 'DENY')
    reply.header('referrer-policy', 'strict-origin-when-cross-origin')
  })

  // High-signal response logging hook
  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime as bigint | undefined
    const durationMs = startTime ? Number(process.hrtime.bigint() - startTime) / 1_000_000 : 0
    const routeError = (request as any).routeError as { code?: string; message?: string } | undefined
    logger.logHttp(request.method, request.url, reply.statusCode, durationMs, request.id, routeError)
  })

  app.get('/health/live', async () => ({ status: 'ok' }))
  app.get('/health/ready', async (_request, reply) => {
    try {
      await checkDatabase(pool)
      return { status: 'ok' }
    } catch {
      return reply.code(503).send({ error: { code: 'DATABASE_NOT_READY', message: 'Database is not ready' } })
    }
  })

  registerAuthRoutes(app, pool, config)
  registerClientRequestRoutes(app, pool, config)
  registerPublicTrackerRoutes(app, pool, config)
  registerPmRequestRoutes(app, pool, config)
  registerUserManagementRoutes(app, pool, config)
  registerWorkflowMutationRoutes(app, pool, config)

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  )
  clientRequestErrorHandler(app)

  return app
}

const config = loadConfig()
const pool = createDbPool(config.DATABASE_URL)
const app = buildApp(pool, config)
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, gracefully shutting down API server...`)
  await app.close()
  await pool.end()
  process.exit(0)
}
process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
await app.listen({ port: config.API_PORT, host: '0.0.0.0' })
logger.info(`API Server ready on http://127.0.0.1:${config.API_PORT} [Environment: ${config.NODE_ENV}]`)
