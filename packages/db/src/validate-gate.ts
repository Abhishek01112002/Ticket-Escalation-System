import { randomUUID } from 'node:crypto';
import { loadConfig } from '@nvara/config';
import { createDbPool } from './index.js';

const expectedTables = ['organizations', 'users', 'roles', 'user_roles', 'clients', 'service_domains', 'requests', 'assignments', 'sla_records', 'escalation_events', 'audit_events', 'idempotency_keys'];
const pool = createDbPool(loadConfig().DATABASE_URL);
const client = await pool.connect();
const fail = (message: string): never => { throw new Error(message); };
const expectDatabaseError = async (operation: () => Promise<unknown>, code: string, label: string) => {
  await client.query('SAVEPOINT expected_error');
  let actualError: unknown;
  try { await operation(); } catch (error) { actualError = error; }
  if (!actualError) { await client.query('RELEASE SAVEPOINT expected_error'); fail(`${label}: expected PostgreSQL error ${code}`); }
  await client.query('ROLLBACK TO SAVEPOINT expected_error');
  await client.query('RELEASE SAVEPOINT expected_error');
  if (actualError instanceof Error && 'code' in actualError && actualError.code === code) return;
  fail(`${label}: unexpected error`);
};

try {
  const tableRows = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const tableNames = new Set(tableRows.rows.map((row) => row.table_name));
  for (const table of expectedTables) if (!tableNames.has(table)) fail(`Missing table: ${table}`);
  const primaryKeys = await client.query<{ table_name: string; data_type: string }>("SELECT tc.table_name, c.data_type FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema JOIN information_schema.columns c ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name AND c.column_name = ccu.column_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'");
  for (const table of expectedTables) if (!primaryKeys.rows.some((row) => row.table_name === table && row.data_type === 'uuid')) fail(`Missing UUID primary key: ${table}`);
  const metadataType = await client.query<{ data_type: string }>("SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_events' AND column_name = 'metadata'");
  if (metadataType.rows[0]?.data_type !== 'jsonb') fail('audit_events.metadata must be jsonb');
  const timestamps = await client.query<{ table_name: string; data_type: string; is_nullable: string }>("SELECT table_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'created_at'");
  for (const table of expectedTables) if (!timestamps.rows.some((row) => row.table_name === table && row.data_type === 'timestamp with time zone' && row.is_nullable === 'NO')) fail(`Missing required timestamptz created_at: ${table}`);
  const foreignKeys = await client.query<{ table_name: string }>("SELECT DISTINCT tc.table_name FROM information_schema.table_constraints tc WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'");
  for (const table of ['users', 'user_roles', 'clients', 'service_domains', 'requests', 'assignments', 'sla_records', 'escalation_events', 'audit_events', 'idempotency_keys']) if (!foreignKeys.rows.some((row) => row.table_name === table)) fail(`Missing foreign key: ${table}`);
  const indexRows = await client.query<{ indexname: string; indexdef: string }>("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'");
  for (const indexName of ['assignments_one_current', 'sla_records_assignment_id_key', 'idempotency_keys_organization_id_actor_id_method_route_key_key']) if (!indexRows.rows.some((row) => row.indexname === indexName)) fail(`Missing required unique index: ${indexName}`);
  const auditTrigger = await client.query<{ trigger_name: string }>("SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'audit_events' AND trigger_name = 'audit_events_append_only'");
  if (!auditTrigger.rowCount) fail('audit_events append-only trigger is missing');

  const org = (await client.query<{ id: string }>("SELECT id FROM organizations WHERE name = 'Nvara Media'" )).rows[0];
  if (!org) fail('Seed organization is missing');
  const seedCounts = await client.query<{ organizations: string; domains: string; demo_users: string; role_mappings: string }>("SELECT (SELECT count(*) FROM organizations WHERE name = 'Nvara Media') AS organizations, (SELECT count(*) FROM service_domains WHERE organization_id = $1) AS domains, (SELECT count(*) FROM users WHERE organization_id = $1 AND is_demo) AS demo_users, (SELECT count(*) FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.organization_id = $1 AND u.is_demo) AS role_mappings", [org.id]);
  const counts = seedCounts.rows[0];
  if (counts.organizations !== '1' || counts.domains !== '8' || counts.demo_users !== '3' || counts.role_mappings !== '3') fail(`Unexpected seed counts: ${JSON.stringify(counts)}`);

  await client.query('BEGIN');
  const suffix = randomUUID();
  const domain = (await client.query<{ id: string }>('SELECT id FROM service_domains WHERE organization_id = $1 ORDER BY slug LIMIT 1', [org.id])).rows[0];
  const pm = (await client.query<{ id: string }>("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE u.organization_id = $1 AND r.code = 'project_manager'", [org.id])).rows[0];
  const clientRow = (await client.query<{ id: string }>('INSERT INTO clients(organization_id,name) VALUES ($1,$2) RETURNING id', [org.id, `Gate client ${suffix}`])).rows[0];
  const request = (await client.query<{ id: string }>("INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency) VALUES ($1,$2,$3,$4,'validation','flexible') RETURNING id", [org.id, `GATE-${suffix}`, clientRow.id, domain.id])).rows[0];
  const assignment = (await client.query<{ id: string }>('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2) RETURNING id', [request.id, pm.id])).rows[0];
  await expectDatabaseError(() => client.query('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2)', [request.id, pm.id]), '23505', 'current assignment uniqueness');
  await client.query('UPDATE assignments SET ended_at = now() WHERE id = $1', [assignment.id]);
  const secondAssignment = (await client.query<{ id: string }>('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2) RETURNING id', [request.id, pm.id])).rows[0];
  const sla = (await client.query<{ id: string }>("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES ($1,'gate',60,now(),now() + interval '60 seconds') RETURNING id", [secondAssignment.id])).rows[0];
  await expectDatabaseError(() => client.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES ($1,'gate',60,now(),now() + interval '60 seconds')", [secondAssignment.id]), '23505', 'SLA uniqueness');
  await client.query("INSERT INTO idempotency_keys(actor_id,organization_id,method,route,key,request_hash,expires_at) VALUES ('gate',$1,'POST','/gate','key','hash',now() + interval '1 hour')", [org.id]);
  await expectDatabaseError(() => client.query("INSERT INTO idempotency_keys(actor_id,organization_id,method,route,key,request_hash,expires_at) VALUES ('gate',$1,'POST','/gate','key','hash',now() + interval '1 hour')", [org.id]), '23505', 'idempotency uniqueness');
  const missing = randomUUID();
  const fkRequest = (await client.query<{ id: string }>("INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency) VALUES ($1,$2,$3,$4,'foreign key validation','flexible') RETURNING id", [org.id, `GATE-FK-${suffix}`, clientRow.id, domain.id])).rows[0];
  await expectDatabaseError(() => client.query('INSERT INTO clients(organization_id,name) VALUES ($1,$2)', [missing, 'invalid org']), '23503', 'organization foreign key');
  await expectDatabaseError(() => client.query('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2)', [fkRequest.id, missing]), '23503', 'user foreign key');
  await expectDatabaseError(() => client.query('INSERT INTO assignments(request_id,assignee_user_id) VALUES ($1,$2)', [missing, pm.id]), '23503', 'request foreign key');
  await expectDatabaseError(() => client.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at) VALUES ($1,'gate',60,now(),now() + interval '60 seconds')", [missing]), '23503', 'assignment foreign key');
  await expectDatabaseError(() => client.query("INSERT INTO escalation_events(request_id,assignment_id,sla_record_id,responsible_user_id,reason,policy_code,idempotency_key) VALUES ($1,$2,$3,$4,'gate','gate',$5)", [request.id, secondAssignment.id, missing, pm.id, `gate-${suffix}`]), '23503', 'SLA foreign key');
  await client.query('ROLLBACK');

  const rollbackMarker = `rollback-${randomUUID()}`;
  await client.query('BEGIN');
  await client.query('INSERT INTO clients(organization_id,name) VALUES ($1,$2)', [org.id, rollbackMarker]);
  await expectDatabaseError(() => client.query('INSERT INTO clients(organization_id,name) VALUES ($1,$2)', [randomUUID(), rollbackMarker]), '23503', 'rollback foreign key');
  await client.query('ROLLBACK');
  const rollbackRows = await client.query('SELECT 1 FROM clients WHERE name = $1', [rollbackMarker]);
  if (rollbackRows.rowCount !== 0) fail('Rollback left a partial row');
  console.log('Database gate validation passed');
} finally { client.release(); await pool.end(); }
