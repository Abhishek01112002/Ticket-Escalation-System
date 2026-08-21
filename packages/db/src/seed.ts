import { scryptSync, randomBytes } from 'node:crypto'
import { loadConfig } from '@nvara/config'
import { createDbPool } from './index.js'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `${salt}:${derivedKey.toString('hex')}`
}

const pool = createDbPool(loadConfig().DATABASE_URL)
const client = await pool.connect()

try {
  await client.query('BEGIN')

  // 1. Organization
  const org = (
    await client.query(
      "INSERT INTO organizations(name) VALUES ('Nvara Media') ON CONFLICT (name) DO UPDATE SET updated_at = organizations.updated_at RETURNING id"
    )
  ).rows[0]

  // 2. Service Domains
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
      [org.id, name, slug]
    )
  }

  // 3. Roles
  for (const code of ['client', 'project_manager', 'internal_team_member']) {
    await client.query('INSERT INTO roles(code) VALUES ($1) ON CONFLICT (code) DO NOTHING', [code])
  }

  // 4. Users (Independent Scrypt credentials provisioned)
  const pmPassword = process.env.DEV_PM_PASSWORD || 'Nvara#PM2026!Secure'
  const rohanPassword = process.env.DEV_ROHAN_PASSWORD || 'Rohan#Ops2026!Dev'
  const priyaPassword = process.env.DEV_PRIYA_PASSWORD || 'Priya#Ops2026!Dev'

  const users = [
    ['Project Manager', 'pm@nvaramedia.com', 'project_manager', 'dev-pm-subject-001', hashPassword(pmPassword), '+919900011122'],
    ['Rohan Mehta', 'rohan.mehta@nvaramedia.com', 'internal_team_member', 'dev-internal-subject-001', hashPassword(rohanPassword), '+919876543210'],
    ['Priya Sharma', 'priya.sharma@nvaramedia.com', 'internal_team_member', 'dev-priya-subject-001', hashPassword(priyaPassword), '+919811122233'],
  ]

  for (const [displayName, email, role, authSubject, passwordHash, phoneWhatsapp] of users) {
    await client.query(
      'UPDATE users SET auth_subject = NULL WHERE auth_subject = $1 AND email <> $2',
      [authSubject, email]
    )

    let user = (
      await client.query(
        'SELECT id FROM users WHERE organization_id = $1 AND email = $2',
        [org.id, email]
      )
    ).rows[0]

    if (!user) {
      user = (
        await client.query(
          'INSERT INTO users(organization_id, display_name, email, auth_subject, password_hash, phone_whatsapp, is_active, is_demo) VALUES ($1, $2, $3, $4, $5, $6, true, false) ON CONFLICT (auth_subject) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, phone_whatsapp = EXCLUDED.phone_whatsapp, is_active = true RETURNING id',
          [org.id, displayName, email, authSubject, passwordHash, phoneWhatsapp]
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

  const pmUser = (await client.query("SELECT id FROM users WHERE email='pm@nvaramedia.com' AND organization_id=$1", [org.id])).rows[0]
  const rohanUser = (await client.query("SELECT id FROM users WHERE email='rohan.mehta@nvaramedia.com' AND organization_id=$1", [org.id])).rows[0]
  const priyaUser = (await client.query("SELECT id FROM users WHERE email='priya.sharma@nvaramedia.com' AND organization_id=$1", [org.id])).rows[0]

  const existingReqs = await client.query('SELECT count(*)::int as count FROM requests WHERE organization_id=$1', [org.id])
  if (existingReqs.rows[0].count === 0) {
    // 6. Exactly 10 realistic client request scenarios
    const seedRequests = [
    {
      ref: 'NVARA-2026-AURA101',
      clientName: 'Sarah Jenkins',
      company: 'Aura Cosmetics',
      email: 'sarah@auracosmetics.com',
      phone: '+91 98201 11223',
      domain: 'social_media_marketing',
      urgency: 'time_sensitive',
      status: 'awaiting_acknowledgement',
      subject: 'Paid Social Performance Campaign for Q4 Holiday Launch',
      assignee: rohanUser.id,
      slaStatus: 'active',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-NEXA102',
      clientName: 'Vikram Malhotra',
      company: 'Nexa Fintech',
      email: 'vikram@nexafintech.io',
      phone: '+91 98334 44556',
      domain: 'web_app_development',
      urgency: 'soon',
      status: 'awaiting_acknowledgement',
      subject: 'Mobile Banking Experience Redesign & Component Architecture',
      assignee: priyaUser.id,
      slaStatus: 'active',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-ZEN103',
      clientName: 'Elena Rostova',
      company: 'Zen Dynamics',
      email: 'elena@zendynamics.com',
      phone: '+91 98450 77889',
      domain: 'seo',
      urgency: 'flexible',
      status: 'in_progress',
      subject: 'Global Technical SEO Audit, Core Web Vitals & Content Restructure',
      assignee: rohanUser.id,
      slaStatus: 'acknowledged',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-HORIZ104',
      clientName: 'Marcus Vance',
      company: 'Horizon Media',
      email: 'marcus@horizonmedia.com',
      phone: '+91 98110 33445',
      domain: 'branding_graphic_design',
      urgency: 'soon',
      status: 'acknowledged',
      subject: 'Comprehensive Brand Identity, Design Tokens & Marketing Collateral',
      assignee: priyaUser.id,
      slaStatus: 'acknowledged',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-PEAK105',
      clientName: 'David K.',
      company: 'Peak Logistics',
      email: 'david@peaklogistics.com',
      phone: '+91 98661 22334',
      domain: 'web_app_development',
      urgency: 'time_sensitive',
      status: 'in_progress',
      subject: 'Realtime Fleet Telemetry Dashboard & Dispatch Portal',
      assignee: priyaUser.id,
      slaStatus: 'acknowledged',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-SOLIS106',
      clientName: 'Amara Chen',
      company: 'Solis Energy',
      email: 'amara@solisenergy.com',
      phone: '+91 98772 55667',
      domain: 'video_production',
      urgency: 'flexible',
      status: 'resolved',
      subject: 'Commercial Video Production & 3D Rendered Product Showcase',
      assignee: rohanUser.id,
      slaStatus: 'closed',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-VERTEX107',
      clientName: 'Dr. Neil Patel',
      company: 'Vertex Health',
      email: 'neil@vertexhealth.org',
      phone: '+91 98883 99001',
      domain: 'web_app_development',
      urgency: 'soon',
      status: 'resolved',
      subject: 'HIPAA Compliant Patient Telehealth & Booking Application',
      assignee: priyaUser.id,
      slaStatus: 'closed',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-URBAN108',
      clientName: 'Maya Kapoor',
      company: 'Urban Nest Living',
      email: 'maya@urbannest.com',
      phone: '+91 98994 11228',
      domain: 'influencer_marketing',
      urgency: 'flexible',
      status: 'awaiting_acknowledgement',
      subject: 'Creator Collaboration Program & UGC Campaign for Autumn Collection',
      assignee: null,
      slaStatus: 'active',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-QNTM109',
      clientName: 'Arjun Das',
      company: 'Quantum AI Systems',
      email: 'arjun@quantumai.dev',
      phone: '+91 98005 33449',
      domain: 'immersive_media',
      urgency: 'soon',
      status: 'resolved',
      subject: 'Interactive WebGL 3D Data Visualizer for Cloud Compute Nodes',
      assignee: rohanUser.id,
      slaStatus: 'closed',
      escalated: false,
    },
    {
      ref: 'NVARA-2026-STEL110',
      clientName: 'Rachel Green',
      company: 'Stellar Labs',
      email: 'rachel@stellarlabs.com',
      phone: '+91 98116 77880',
      domain: 'digital_marketing',
      urgency: 'time_sensitive',
      status: 'awaiting_acknowledgement',
      subject: 'Omnichannel B2B Growth Strategy & Inbound Funnel Optimization',
      assignee: rohanUser.id,
      slaStatus: 'breached',
      escalated: true,
    },
  ]

  for (const s of seedRequests) {
    // Client
    const clientRes = await client.query(
      'INSERT INTO clients(organization_id, name, company, email, phone_whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [org.id, s.clientName, s.company, s.email, s.phone]
    )
    const clientId = clientRes.rows[0].id

    // Service domain
    const domainRow = (await client.query('SELECT id FROM service_domains WHERE organization_id=$1 AND slug=$2', [org.id, s.domain])).rows[0]

    // Request
    const reqRes = await client.query(
      'INSERT INTO requests(organization_id, public_reference, client_id, service_domain_id, requirement, urgency, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [org.id, s.ref, clientId, domainRow.id, s.subject, s.urgency, s.status]
    )
    const reqId = reqRes.rows[0].id

    // Initial audit event
    await client.query(
      "INSERT INTO audit_events(organization_id, request_id, actor_type, event_type, new_state) VALUES ($1, $2, 'client', 'request_created', 'awaiting_acknowledgement')",
      [org.id, reqId]
    )

    // Assignment & SLA if assigned
    if (s.assignee) {
      const assignRes = await client.query(
        'INSERT INTO assignments(request_id, assignee_user_id, assigned_by_user_id) VALUES ($1, $2, $3) RETURNING id',
        [reqId, s.assignee, pmUser.id]
      )
      const assignId = assignRes.rows[0].id

      await client.query(
        "INSERT INTO audit_events(organization_id, request_id, assignment_id, actor_user_id, actor_type, event_type, new_state) VALUES ($1, $2, $3, $4, 'human', 'assigned', $5)",
        [org.id, reqId, assignId, pmUser.id, s.status]
      )

      // SLA Record
      const deadline = s.slaStatus === 'breached' ? "now() - interval '2 hours'" : "now() + interval '20 hours'"
      const ackAt = s.status === 'in_progress' || s.status === 'resolved' || s.status === 'acknowledged' ? 'now()' : 'NULL'

      await client.query(
        `INSERT INTO sla_records(assignment_id, policy_code, duration_seconds, started_at, deadline_at, acknowledged_at, status) VALUES ($1, 'acknowledgement', 86400, now() - interval '4 hours', ${deadline}, ${ackAt}, $2)`,
        [assignId, s.slaStatus]
      )

      if (s.escalated) {
        await client.query(
          "INSERT INTO escalation_events(organization_id, request_id, assignment_id, responsible_user_id, reason) VALUES ($1, $2, $3, $4, 'Acknowledgement SLA breach (24-hour window expired)')",
          [org.id, reqId, assignId, s.assignee]
        )
        await client.query(
          "INSERT INTO audit_events(organization_id, request_id, assignment_id, actor_type, event_type, new_state) VALUES ($1, $2, $3, 'system', 'escalation_triggered', 'awaiting_acknowledgement')",
          [org.id, reqId, assignId]
        )
      }
    }
  }
  }

  await client.query('COMMIT')
  console.log('Clean 10-item production seed completed successfully.')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
