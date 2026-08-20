import pg from 'pg';
const { Pool } = pg;
export function createDbPool(databaseUrl: string) { const pool = new Pool({ connectionString: databaseUrl, max: 10 }); pool.on('error', () => undefined); return pool; }
export async function checkDatabase(pool: pg.Pool) { await pool.query('SELECT 1'); }
