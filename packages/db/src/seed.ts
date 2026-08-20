import { loadConfig } from '@nvara/config';
import { createDbPool } from './index.js';
const pool = createDbPool(loadConfig().DATABASE_URL);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const org = (await client.query("INSERT INTO organizations(name) VALUES ('Nvara Media') ON CONFLICT (name) DO UPDATE SET updated_at = organizations.updated_at RETURNING id")).rows[0];
  const domains: Array<[string, string]> = [
    ['Digital Marketing', 'digital_marketing'],
    ['Social Media Marketing', 'social_media_marketing'],
    ['SEO', 'seo'],
    ['Influencer Marketing', 'influencer_marketing'],
    ['Web & App Development', 'web_app_development'],
    ['Branding & Graphic Design', 'branding_graphic_design'],
    ['Video Production', 'video_production'],
    ['Immersive Media', 'immersive_media'],
  ];
  for (const [name, slug] of domains) await client.query('INSERT INTO service_domains(organization_id,name,slug) VALUES ($1,$2,$3) ON CONFLICT (organization_id,slug) DO UPDATE SET name = EXCLUDED.name, is_active = true', [org.id, name, slug]);
  const roles = ['client','project_manager','internal_team_member'];
  for (const code of roles) await client.query('INSERT INTO roles(code) VALUES ($1) ON CONFLICT (code) DO NOTHING', [code]);
  const users = [['Demo Project Manager','pm.demo@invalid.test','project_manager','dev-pm-subject-001'],['Demo Internal Team Member','internal.demo@invalid.test','internal_team_member','dev-internal-subject-001'],['Demo Client','client.demo@invalid.test','client','dev-client-subject-001']];
  for (const [displayName,email,role,authSubject] of users) { const user = (await client.query('INSERT INTO users(organization_id,display_name,email,auth_subject,is_active,is_demo) VALUES ($1,$2,$3,$4,true,true) ON CONFLICT (organization_id,email) DO UPDATE SET display_name = EXCLUDED.display_name, auth_subject = EXCLUDED.auth_subject, is_active = true RETURNING id', [org.id,displayName,email,authSubject])).rows[0]; const roleRow = (await client.query('SELECT id FROM roles WHERE code=$1',[role])).rows[0]; await client.query('INSERT INTO user_roles(user_id,role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[user.id,roleRow.id]); }
  const pm = (await client.query("SELECT id FROM users WHERE email='pm.demo@invalid.test' AND organization_id=$1", [org.id])).rows[0].id;
  const internal = (await client.query("SELECT id FROM users WHERE email='internal.demo@invalid.test' AND organization_id=$1", [org.id])).rows[0].id;
  const domain = (await client.query("SELECT id FROM service_domains WHERE organization_id=$1 AND slug='web_app_development'", [org.id])).rows[0].id;
  for (const scenario of [['Fresh PM request','fresh.pm@invalid.test','awaiting_acknowledgement',pm],['Internal assigned request','assigned.internal@invalid.test','awaiting_acknowledgement',internal],['In progress request','progress.internal@invalid.test','in_progress',internal],['Resolved request','resolved.internal@invalid.test','resolved',internal]] as const) {
    const existingClient=await client.query('SELECT id FROM clients WHERE organization_id=$1 AND email=$2',[org.id,scenario[1]]);
    const clientRow=existingClient.rowCount ? existingClient.rows[0] : (await client.query('INSERT INTO clients(organization_id,name,company,email,phone_whatsapp) VALUES($1,$2,$3,$4,$5) RETURNING id',[org.id,scenario[0],scenario[0]+' Co',scenario[1],'+910000000000'])).rows[0];
    const request=(await client.query("INSERT INTO requests(organization_id,public_reference,client_id,service_domain_id,requirement,urgency,status) VALUES($1,$2,$3,$4,$5,'flexible',$6) ON CONFLICT (public_reference) DO UPDATE SET status=EXCLUDED.status RETURNING id",[org.id,'SEED-'+scenario[1].split('.')[0].toUpperCase(),clientRow.id,domain,scenario[0]+' requirement',scenario[2]])).rows[0];
    const assignment=(await client.query('INSERT INTO assignments(request_id,assignee_user_id,assigned_by_user_id) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM assignments WHERE request_id=$1 AND ended_at IS NULL) RETURNING id',[request.id,scenario[3],pm])).rows[0];
    if(assignment){await client.query("INSERT INTO sla_records(assignment_id,policy_code,duration_seconds,started_at,deadline_at,acknowledged_at,status) VALUES($1,'acknowledgement',86400,now(),now()+interval '24 hours',CASE WHEN $2 IN ('in_progress','resolved') THEN now() ELSE NULL END,CASE WHEN $2='resolved' THEN 'closed' WHEN $2='in_progress' THEN 'acknowledged' ELSE 'active' END)",[assignment.id,scenario[2]]);await client.query("INSERT INTO audit_events(organization_id,request_id,assignment_id,actor_user_id,actor_type,event_type,new_state) VALUES($1,$2,$3,$4,'system','request_created',$5) ON CONFLICT DO NOTHING",[org.id,request.id,assignment.id,pm,scenario[2]])}
  }
  await client.query('COMMIT');
  console.log('Development seed complete');
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
