import { scryptSync, randomBytes } from 'node:crypto'
import { loadConfig } from '@nvara/config'
import { createDbPool } from './index.js'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `${salt}:${derivedKey.toString('hex')}`
}

async function wipeDatabaseToScratch() {
  const config = loadConfig()
  const pool = createDbPool(config.DATABASE_URL)
  const client = await pool.connect()

  console.log('[DB WIPE] Initializing database clean reset to scratch...')

  try {
    await client.query('BEGIN')

    // 1. Temporarily disable immutability trigger on audit_events to allow clean truncate
    await client.query('ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only')

    // 2. Truncate all operational transaction tables
    console.log('[DB WIPE] Truncating operational tickets, assignments, comments, audit logs, sessions, and tokens...')
    await client.query(`
      TRUNCATE TABLE 
        request_comments,
        escalation_events,
        audit_events,
        sla_records,
        assignments,
        requests,
        clients,
        idempotency_keys,
        password_reset_tokens,
        user_invitations,
        sessions
      CASCADE;
    `)

    // 3. Re-enable immutability trigger
    await client.query('ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only')

    // 4. Organization setup
    const orgRes = await client.query(
      "INSERT INTO organizations(name) VALUES ('Nvara Media') ON CONFLICT (name) DO UPDATE SET updated_at = now() RETURNING id"
    )
    const orgId = orgRes.rows[0].id

    // 5. Ensure core service domains are present and clean
    const domains: Array<[string, string]> = [
      ['Digital Marketing', 'digital_marketing'],
      ['Social Media Marketing', 'social_media_marketing'],
      ['SEO', 'seo'],
      ['Influencer Marketing', 'influencer_marketing'],
      ['Web & App Development', 'web_app_development'],
      ['Branding & Graphic Design', 'branding_graphic_design'],
      ['Video Production', 'video_production'],
      ['Immersive Media', 'immersive_media'],
    ]

    for (const [name, slug] of domains) {
      await client.query(
        'INSERT INTO service_domains(organization_id, name, slug) VALUES ($1, $2, $3) ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name, is_active = true',
        [orgId, name, slug]
      )
    }

    // 6. Ensure roles exist
    for (const code of ['client', 'project_manager', 'internal_team_member']) {
      await client.query('INSERT INTO roles(code) VALUES ($1) ON CONFLICT (code) DO NOTHING', [code])
    }

    // 7. Delete all stray/test/e2e users except core team
    await client.query(
      "DELETE FROM users WHERE email NOT IN ('pm@nvaramedia.com', 'rohan.mehta@nvaramedia.com', 'priya.sharma@nvaramedia.com')"
    )

    // 8. Re-seed clean PM and clean Specialists with WhatsApp phone numbers
    const pmPassword = process.env.DEV_PM_PASSWORD || 'Nvara#PM2026!Secure'
    const rohanPassword = process.env.DEV_ROHAN_PASSWORD || 'Rohan#Ops2026!Dev'
    const priyaPassword = process.env.DEV_PRIYA_PASSWORD || 'Priya#Ops2026!Dev'

    const coreUsers = [
      ['Project Manager', 'pm@nvaramedia.com', 'project_manager', 'dev-pm-subject-001', hashPassword(pmPassword), '+919900011122'],
      ['Rohan Mehta', 'rohan.mehta@nvaramedia.com', 'internal_team_member', 'dev-internal-subject-001', hashPassword(rohanPassword), '+919876543210'],
      ['Priya Sharma', 'priya.sharma@nvaramedia.com', 'internal_team_member', 'dev-priya-subject-001', hashPassword(priyaPassword), '+919811122233'],
    ]

    for (const [displayName, email, role, authSubject, passwordHash, phoneWhatsapp] of coreUsers) {
      await client.query(
        'UPDATE users SET auth_subject = NULL WHERE auth_subject = $1 AND email <> $2',
        [authSubject, email]
      )

      let user = (
        await client.query(
          'SELECT id FROM users WHERE organization_id = $1 AND email = $2',
          [orgId, email]
        )
      ).rows[0]

      if (!user) {
        user = (
          await client.query(
            'INSERT INTO users(organization_id, display_name, email, auth_subject, password_hash, phone_whatsapp, is_active, is_demo) VALUES ($1, $2, $3, $4, $5, $6, true, false) ON CONFLICT (auth_subject) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, phone_whatsapp = EXCLUDED.phone_whatsapp, is_active = true RETURNING id',
            [orgId, displayName, email, authSubject, passwordHash, phoneWhatsapp]
          )
        ).rows[0]
      } else {
        await client.query(
          'UPDATE users SET display_name = $1, auth_subject = $2, password_hash = $3, phone_whatsapp = $4, is_active = true WHERE id = $5',
          [displayName, authSubject, passwordHash, phoneWhatsapp, user.id]
        )
      }

      const roleRow = (await client.query('SELECT id FROM roles WHERE code=$1', [role])).rows[0]
      await client.query('INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, roleRow.id])
    }

    await client.query('COMMIT')

    console.log('[DB WIPE] SUCCESS: Database is now completely clean and ready for real testing from scratch!')
    console.log('──────────────────────────────────────────────────────────────────────────')
    console.log('• Requests & Tickets:   0 (Empty queue, ready for fresh entries)')
    console.log('• Assignments:          0')
    console.log('• Comments:             0')
    console.log('• Audit Logs:           0')
    console.log('• Clients:              0')
    console.log('• Primary Admin / PM:   pm@nvaramedia.com (Password: Nvara#PM2026!Secure)')
    console.log('• Baseline Specialists: rohan.mehta@nvaramedia.com (+919876543210)')
    console.log('                        priya.sharma@nvaramedia.com (+919811122233)')
    console.log('──────────────────────────────────────────────────────────────────────────')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[DB WIPE] FAILED to reset database:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

wipeDatabaseToScratch()
