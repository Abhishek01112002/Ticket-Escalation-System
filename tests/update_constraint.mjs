import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/nvara_dev?sslmode=disable'
})

const client = await pool.connect()
try {
  await client.query(`
    ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_event_type_allowed;
    ALTER TABLE audit_events ADD CONSTRAINT audit_event_type_allowed CHECK (
      event_type IN (
        'request_created',
        'assigned',
        'reassigned',
        'acknowledged',
        'work_started',
        'resolved',
        'sla_breached',
        'escalation_triggered',
        'USER_INVITED',
        'USER_ONBOARDED',
        'USER_CREATED',
        'USER_DEACTIVATED',
        'USER_REACTIVATED',
        'ROLE_CHANGED',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_COMPLETED',
        'SESSIONS_REVOKED',
        'REMOTE_SESSIONS_REVOKED'
      )
    );
  `)
  console.log('Constraint updated successfully')
} finally {
  client.release()
  await pool.end()
}
