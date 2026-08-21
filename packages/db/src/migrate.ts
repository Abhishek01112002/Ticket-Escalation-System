import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadConfig } from '@nvara/config';
import { createDbPool } from './index.js';

const config = loadConfig();
const pool = createDbPool(config.DATABASE_URL);
try {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const version of ['0001_initial', '0002_audit_immutability', '0003_sessions_and_passwords', '0004_user_management_and_password_reset', '0005_user_invitations_and_active_sessions', '0006_expand_audit_event_types', '0007_request_comments', '0008_user_whatsapp_phone']) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (exists.rowCount === 0) {
      const filename = fileURLToPath(new URL(`../migrations/${version}.sql`, import.meta.url));
      const client = await pool.connect();
      try { await client.query('BEGIN'); await client.query(await readFile(path.resolve(filename), 'utf8')); await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      console.log(`Applied migration ${version}`);
    } else console.log(`Migration ${version} already applied`);
  }
} finally { await pool.end(); }
