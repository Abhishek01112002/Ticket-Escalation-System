import { evaluateOverdueSlas } from '../../apps/worker/src/worker.ts'
import pg from 'pg'
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const result=await evaluateOverdueSlas(pool);console.log(JSON.stringify(result));await pool.end();process.exit(0)
