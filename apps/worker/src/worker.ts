import pino from 'pino'
import { loadConfig } from '@nvara/config'
import { createDbPool } from '@nvara/db'
import type pg from 'pg'

export type SlaEvaluation = {
  candidates: number
  inspected: number
  breached: number
  skipped: number
  failures: number
  oldestOverdueAt?: string
}

export async function evaluateOverdueSlas(pool: pg.Pool, logger = pino({ level: 'silent' })): Promise<SlaEvaluation> {
  const candidates = await pool.query<{ id: string; deadline_at: string }>(
    `SELECT s.id,s.deadline_at FROM sla_records s JOIN assignments a ON a.id=s.assignment_id
     WHERE s.status='active' AND s.acknowledged_at IS NULL AND a.ended_at IS NULL AND s.deadline_at<=CURRENT_TIMESTAMP
     ORDER BY s.deadline_at LIMIT 100`,
  )
  const result: SlaEvaluation = {
    candidates: candidates.rowCount ?? candidates.rows.length,
    inspected: 0,
    breached: 0,
    skipped: 0,
    failures: 0,
    oldestOverdueAt: candidates.rows[0]?.deadline_at,
  }
  for (const candidate of candidates.rows) {
    result.inspected += 1
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<any>(
        `SELECT s.id,s.assignment_id,a.request_id,s.status,s.acknowledged_at,a.assignee_user_id,r.organization_id
         FROM sla_records s JOIN assignments a ON a.id=s.assignment_id JOIN requests r ON r.id=a.request_id
         WHERE s.id=$1 AND a.ended_at IS NULL AND s.deadline_at<=CURRENT_TIMESTAMP
         FOR UPDATE OF r,a,s`, [candidate.id],
      )
      if (!locked.rowCount || locked.rows[0].status !== 'active' || locked.rows[0].acknowledged_at) {
        result.skipped += 1
        await client.query('ROLLBACK')
        continue
      }
      const row = locked.rows[0]
      const idempotencyKey = `sla:${row.id}:acknowledgement-breach`
      const existing = await client.query('SELECT 1 FROM escalation_events WHERE idempotency_key=$1', [idempotencyKey])
      if (existing.rowCount) {
        result.skipped += 1
        await client.query('ROLLBACK')
        continue
      }
      await client.query("UPDATE sla_records SET breached_at=CURRENT_TIMESTAMP,status='breached',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='active'", [row.id])
      await client.query('INSERT INTO escalation_events(request_id,assignment_id,sla_record_id,responsible_user_id,reason,policy_code,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7)', [row.request_id, row.assignment_id, row.id, row.assignee_user_id, 'acknowledgement_sla_breached', 'acknowledgement_24h', idempotencyKey])
      for (const event of ['sla_breached', 'escalation_triggered']) {
        await client.query("INSERT INTO audit_events(organization_id,request_id,assignment_id,sla_record_id,actor_type,event_type,new_state,metadata) VALUES($1,$2,$3,$4,'system',$5,'breached',$6)", [row.organization_id, row.request_id, row.assignment_id, row.id, event, JSON.stringify({ reason: 'acknowledgement_sla_breached' })])
      }
      await client.query('UPDATE requests SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [row.request_id])
      await client.query('COMMIT')
      result.breached += 1
    } catch (error) {
      result.failures += 1
      await client.query('ROLLBACK').catch(() => undefined)
      logger.error({ err: error, slaRecordId: candidate.id }, 'SLA breach transaction failed')
    } finally {
      client.release()
    }
  }
  return result
}

export function startWorker() {
  const config = loadConfig()
  const logger = pino({ level: config.LOG_LEVEL })
  const pool = createDbPool(config.DATABASE_URL)
  pool.on('error', (error) => logger.error({ err: error }, 'worker database pool error'))
  let stopping = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let retryCount = 0

  async function poll() {
  if (stopping) return
  const started = Date.now()
  try {
    const result = await evaluateOverdueSlas(pool, logger)
    retryCount = 0
    logger.info({
      pollDurationMs: Date.now() - started,
      recordsInspected: result.inspected,
      breachesCreated: result.breached,
      recordsSkipped: result.skipped,
      dbFailures: result.failures,
      workerLagMs: result.oldestOverdueAt ? Math.max(0, Date.now() - new Date(result.oldestOverdueAt).getTime()) : 0,
    }, 'SLA poll completed')
  } catch (error) {
    retryCount += 1
    logger.error({ err: error, retryCount, pollDurationMs: Date.now() - started }, 'SLA poll failed; retrying')
  } finally {
    if (!stopping) timer = setTimeout(() => void poll(), config.SLA_POLL_INTERVAL_SECONDS * 1000)
  }
  }

  logger.info({ intervalSeconds: config.SLA_POLL_INTERVAL_SECONDS, batchSize: 100 }, 'worker started')
  void poll()

  async function shutdown(signal: string) {
  if (stopping) return
  stopping = true
  if (timer) clearTimeout(timer)
  logger.info({ signal }, 'worker shutting down')
  await pool.end()
  process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}
