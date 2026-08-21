import type { Request, RequestComment, RequestFilters, ServiceDomain, TeamMemberCapacity, TimelineEvent, User } from '../domain/ticket'
import { getAuthHeaders } from './devAuth'

const headers = getAuthHeaders

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: headers(), credentials: 'include' })
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Authentication is required.'
        : response.status === 403
        ? 'You do not have project manager access.'
        : response.status === 404
        ? 'Request not found.'
        : 'Unable to load request data.',
    )
  }
  return response.json() as Promise<T>
}

type Summary = {
  reference: string
  version?: number
  service_domain: ServiceDomain
  urgency: Request['clientUrgency']
  status: Request['workflowStatus']
  requirement: string
  client: { name: string; company: string }
  currentResponsibility: {
    id: string
    name: string
    email: string
    assignedAt: string
  } | null
  sla: {
    deadlineAt: string
    status: string
    acknowledgedAt: string | null
    breachedAt: string | null
  }
}

function user(name?: string, email?: string, id?: string): User {
  const safeName = String(name || email || 'Specialist')
  const initials = safeName
    .replace(/^Demo\s+/i, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return {
    id: id ?? email ?? safeName,
    name: safeName.replace(/^Demo\s+/i, ''),
    initials: initials || 'SP',
    role: 'team_member',
    team: 'Specialist team',
  }
}

function map(row: Summary): Request {
  return {
    id: row.reference,
    version: row.version ?? 1,
    serviceDomain: row.service_domain,
    subject: row.requirement,
    description: row.requirement,
    clientUrgency: row.urgency,
    internalPriority: 'medium',
    client: {
      id: row.reference,
      name: row.client?.name || 'Client',
      company: row.client?.company || '',
      email: '',
      phone: '',
    },
    createdAt: '',
    workflowStatus: row.status,
    assignment: (row.currentResponsibility
      ? {
          assignedBy: 'Project Manager',
          acknowledgementDeadline: row.sla?.deadlineAt,
          assignee: user(
            row.currentResponsibility.name,
            row.currentResponsibility.email,
            row.currentResponsibility.id,
          ),
          assignedAt: row.currentResponsibility.assignedAt,
          acknowledgedAt: row.sla?.acknowledgedAt ?? undefined,
        }
      : {
          assignedBy: 'System',
          acknowledgementDeadline: row.sla?.deadlineAt,
          assignee: null as any,
          assignedAt: '',
          acknowledgedAt: undefined,
        }) as any,
    sla: {
      deadlineAt: row.sla?.deadlineAt,
      status: row.sla?.status || 'active',
      acknowledgedAt: row.sla?.acknowledgedAt ?? undefined,
      breachedAt: row.sla?.breachedAt ?? undefined,
    },
    timeline: [],
  }
}

export async function getPmMe() {
  try {
    const data = await get<{
      user: {
        id: string
        displayName: string
        email: string
        role: 'project_manager' | 'internal_team_member'
        organizationName: string
      }
    }>('/v1/auth/me')
    const displayName = String(data.user?.displayName || data.user?.email || 'Project Manager')
    return {
      id: data.user.id,
      name: displayName.replace(/^Demo\s+/i, ''),
      initials: displayName
        .replace(/^Demo\s+/i, '')
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'PM',
      role: (data.user.role === 'project_manager'
        ? 'project_manager'
        : 'team_member') as User['role'],
      team: data.user.organizationName,
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      return {
        id: 'pm-1',
        name: 'Project Manager',
        initials: 'PM',
        role: 'project_manager' as User['role'],
        team: 'Nvara Media',
      }
    }
    throw err
  }
}

// Exactly 10 clean fallback items for development preview
let inMemoryRequests: Request[] = [
  {
    id: 'NVARA-2026-AURA101',
    version: 1,
    serviceDomain: 'social_media_marketing',
    subject: 'Paid Social Performance Campaign for Q4 Holiday Launch',
    description: 'We are launching a new cosmetic product line and need an end-to-end paid social campaign across Instagram and TikTok with weekly reporting.',
    clientUrgency: 'time_sensitive',
    internalPriority: 'high',
    client: { id: 'c1', name: 'Sarah Jenkins', company: 'Aura Cosmetics', email: 'sarah@auracosmetics.com', phone: '+91 98201 11223' },
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    workflowStatus: 'awaiting_acknowledgement',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() + 20 * 3600000).toISOString(),
      assignee: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'Social Media Specialist' },
      assignedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() + 20 * 3600000).toISOString(), status: 'active' },
    timeline: [
      { id: 't1', type: 'request_created', title: 'Request Created', detail: 'Client submitted requirement via portal.', actor: 'Sarah Jenkins', at: new Date(Date.now() - 5 * 3600000).toISOString() },
      { id: 't2', type: 'assigned', title: 'Specialist Assigned', detail: 'Assigned to Rohan Mehta with 24-hour acknowledgement window.', actor: 'Project Manager', at: new Date(Date.now() - 4 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-NEXA102',
    version: 1,
    serviceDomain: 'web_app_development',
    subject: 'Mobile Banking Experience Redesign & Component Architecture',
    description: 'Redesign of user onboarding and payments flow for the mobile app.',
    clientUrgency: 'soon',
    internalPriority: 'medium',
    client: { id: 'c2', name: 'Vikram Malhotra', company: 'Nexa Fintech', email: 'vikram@nexafintech.io', phone: '+91 98334 44556' },
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    workflowStatus: 'awaiting_acknowledgement',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() + 21 * 3600000).toISOString(),
      assignee: { id: 'u2', name: 'Priya Sharma', initials: 'PS', role: 'team_member', team: 'Design & Frontend Specialist' },
      assignedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() + 21 * 3600000).toISOString(), status: 'active' },
    timeline: [
      { id: 't3', type: 'request_created', title: 'Request Created', detail: 'Requirement received from Nexa Fintech.', actor: 'Vikram Malhotra', at: new Date(Date.now() - 3 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-ZEN103',
    version: 1,
    serviceDomain: 'seo',
    subject: 'Global Technical SEO Audit, Core Web Vitals & Content Restructure',
    description: 'Complete audit of website crawlability, indexation, and Core Web Vitals performance.',
    clientUrgency: 'flexible',
    internalPriority: 'medium',
    client: { id: 'c3', name: 'Elena Rostova', company: 'Zen Dynamics', email: 'elena@zendynamics.com', phone: '+91 98450 77889' },
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    workflowStatus: 'in_progress',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() + 16 * 3600000).toISOString(),
      assignee: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'SEO Specialist' },
      assignedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() + 16 * 3600000).toISOString(), status: 'acknowledged', acknowledgedAt: new Date(Date.now() - 6 * 3600000).toISOString() },
    timeline: [
      { id: 't4', type: 'request_created', title: 'Request Created', detail: 'Requirement submitted by Elena Rostova.', actor: 'Elena Rostova', at: new Date(Date.now() - 8 * 3600000).toISOString() },
      { id: 't5', type: 'acknowledged', title: 'Request Acknowledged', detail: 'SLA satisfied within window.', actor: 'Rohan Mehta', at: new Date(Date.now() - 6 * 3600000).toISOString() },
      { id: 't6', type: 'work_started', title: 'Work Started', detail: 'Technical crawl initiated.', actor: 'Rohan Mehta', at: new Date(Date.now() - 5 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-HORIZ104',
    version: 1,
    serviceDomain: 'branding_graphic_design',
    subject: 'Comprehensive Brand Identity, Design Tokens & Marketing Collateral',
    description: 'Design brand guidelines, typography tokens, pitch decks, and brand templates.',
    clientUrgency: 'soon',
    internalPriority: 'medium',
    client: { id: 'c4', name: 'Marcus Vance', company: 'Horizon Media', email: 'marcus@horizonmedia.com', phone: '+91 98110 33445' },
    createdAt: new Date(Date.now() - 10 * 3600000).toISOString(),
    workflowStatus: 'acknowledged',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() + 14 * 3600000).toISOString(),
      assignee: { id: 'u2', name: 'Priya Sharma', initials: 'PS', role: 'team_member', team: 'Design Lead' },
      assignedAt: new Date(Date.now() - 10 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() + 14 * 3600000).toISOString(), status: 'acknowledged', acknowledgedAt: new Date(Date.now() - 8 * 3600000).toISOString() },
    timeline: [
      { id: 't7', type: 'acknowledged', title: 'Acknowledged', detail: 'Requirement confirmed by Priya Sharma.', actor: 'Priya Sharma', at: new Date(Date.now() - 8 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-PEAK105',
    version: 1,
    serviceDomain: 'web_app_development',
    subject: 'Realtime Fleet Telemetry Dashboard & Dispatch Portal',
    description: 'Map visualization and automated driver dispatch notifications.',
    clientUrgency: 'time_sensitive',
    internalPriority: 'high',
    client: { id: 'c5', name: 'David K.', company: 'Peak Logistics', email: 'david@peaklogistics.com', phone: '+91 98661 22334' },
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    workflowStatus: 'in_progress',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() + 12 * 3600000).toISOString(),
      assignee: { id: 'u2', name: 'Priya Sharma', initials: 'PS', role: 'team_member', team: 'Fullstack Engineer' },
      assignedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 11 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(), status: 'acknowledged', acknowledgedAt: new Date(Date.now() - 11 * 3600000).toISOString() },
    timeline: [],
  },
  {
    id: 'NVARA-2026-SOLIS106',
    version: 1,
    serviceDomain: 'video_production',
    subject: 'Commercial Video Production & 3D Rendered Product Showcase',
    description: '30-second commercial and 3D product animations for solar battery launch.',
    clientUrgency: 'flexible',
    internalPriority: 'medium',
    client: { id: 'c6', name: 'Amara Chen', company: 'Solis Energy', email: 'amara@solisenergy.com', phone: '+91 98772 55667' },
    createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    workflowStatus: 'resolved',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() - 24 * 3600000).toISOString(),
      assignee: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'Media Producer' },
      assignedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 46 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() - 24 * 3600000).toISOString(), status: 'closed', acknowledgedAt: new Date(Date.now() - 46 * 3600000).toISOString() },
    timeline: [
      { id: 't8', type: 'resolved', title: 'Request Resolved', detail: 'All video assets delivered in 4K ProRes.', actor: 'Rohan Mehta', at: new Date(Date.now() - 2 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-VERTEX107',
    version: 1,
    serviceDomain: 'web_app_development',
    subject: 'HIPAA Compliant Patient Telehealth & Booking Application',
    description: 'Patient scheduling portal with encrypted video call integration.',
    clientUrgency: 'soon',
    internalPriority: 'high',
    client: { id: 'c7', name: 'Dr. Neil Patel', company: 'Vertex Health', email: 'neil@vertexhealth.org', phone: '+91 98883 99001' },
    createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    workflowStatus: 'resolved',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() - 48 * 3600000).toISOString(),
      assignee: { id: 'u2', name: 'Priya Sharma', initials: 'PS', role: 'team_member', team: 'Healthtech Specialist' },
      assignedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 70 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() - 48 * 3600000).toISOString(), status: 'closed', acknowledgedAt: new Date(Date.now() - 70 * 3600000).toISOString() },
    timeline: [
      { id: 't9', type: 'resolved', title: 'Request Resolved', detail: 'Final compliance audit passed and deployed.', actor: 'Priya Sharma', at: new Date(Date.now() - 6 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-URBAN108',
    version: 1,
    serviceDomain: 'influencer_marketing',
    subject: 'Creator Collaboration Program & UGC Campaign for Autumn Collection',
    description: 'Recruit 20 lifestyle creators for product unboxing and reviews.',
    clientUrgency: 'flexible',
    internalPriority: 'low',
    client: { id: 'c8', name: 'Maya Kapoor', company: 'Urban Nest Living', email: 'maya@urbannest.com', phone: '+91 98994 11228' },
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    workflowStatus: 'awaiting_acknowledgement',
    assignment: {
      assignedBy: 'System',
      acknowledgementDeadline: '',
      assignee: null as any,
      assignedAt: '',
    },
    sla: { deadlineAt: '', status: 'unassigned' },
    timeline: [
      { id: 't10', type: 'request_created', title: 'Request Created', detail: 'Requirement logged in intake queue.', actor: 'Maya Kapoor', at: new Date(Date.now() - 1 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-QNTM109',
    version: 1,
    serviceDomain: 'immersive_media',
    subject: 'Interactive WebGL 3D Data Visualizer for Cloud Compute Nodes',
    description: 'Three.js 3D visualization of distributed compute clusters.',
    clientUrgency: 'soon',
    internalPriority: 'medium',
    client: { id: 'c9', name: 'Arjun Das', company: 'Quantum AI Systems', email: 'arjun@quantumai.dev', phone: '+91 98005 33449' },
    createdAt: new Date(Date.now() - 96 * 3600000).toISOString(),
    workflowStatus: 'resolved',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() - 72 * 3600000).toISOString(),
      assignee: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'Creative Technologist' },
      assignedAt: new Date(Date.now() - 96 * 3600000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 94 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() - 72 * 3600000).toISOString(), status: 'closed', acknowledgedAt: new Date(Date.now() - 94 * 3600000).toISOString() },
    timeline: [
      { id: 't11', type: 'resolved', title: 'Request Resolved', detail: 'WebGL bundle optimized and published.', actor: 'Rohan Mehta', at: new Date(Date.now() - 12 * 3600000).toISOString() },
    ],
  },
  {
    id: 'NVARA-2026-STEL110',
    version: 1,
    serviceDomain: 'digital_marketing',
    subject: 'Omnichannel B2B Growth Strategy & Inbound Funnel Optimization',
    description: 'Comprehensive lead generation strategy for enterprise software sales.',
    clientUrgency: 'time_sensitive',
    internalPriority: 'high',
    client: { id: 'c10', name: 'Rachel Green', company: 'Stellar Labs', email: 'rachel@stellarlabs.com', phone: '+91 98116 77880' },
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    workflowStatus: 'awaiting_acknowledgement',
    assignment: {
      assignedBy: 'Project Manager',
      acknowledgementDeadline: new Date(Date.now() - 4 * 3600000).toISOString(),
      assignee: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'Growth Strategist' },
      assignedAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    },
    sla: { deadlineAt: new Date(Date.now() - 4 * 3600000).toISOString(), status: 'breached', breachedAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    escalation: {
      triggeredAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      reason: 'Acknowledgement SLA breach (24-hour window expired)',
      responsiblePerson: { id: 'u1', name: 'Rohan Mehta', initials: 'RM', role: 'team_member', team: 'Growth Strategist' },
    },
    timeline: [
      { id: 't12', type: 'request_created', title: 'Request Created', detail: 'Requirement submitted by Rachel Green.', actor: 'Rachel Green', at: new Date(Date.now() - 28 * 3600000).toISOString() },
      { id: 't13', type: 'assigned', title: 'Assigned', detail: 'Assigned to Rohan Mehta.', actor: 'Project Manager', at: new Date(Date.now() - 28 * 3600000).toISOString() },
      { id: 't14', type: 'sla_breached', title: 'SLA Breached', detail: '24-hour acknowledgement SLA expired.', actor: 'System Worker', at: new Date(Date.now() - 4 * 3600000).toISOString() },
      { id: 't15', type: 'escalation_triggered', title: 'Escalation Triggered', detail: 'Management escalation recorded.', actor: 'System Worker', at: new Date(Date.now() - 4 * 3600000).toISOString() },
    ],
  },
]

export async function listPmRequests(filters?: Partial<RequestFilters>): Promise<Request[]> {
  try {
    // Build query string from non-null filter values
    const params = new URLSearchParams()
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (val !== null && val !== undefined && val !== '') {
          params.set(key, String(val))
        }
      }
    }
    const qs = params.toString()
    const data = await get<{ requests: Summary[] }>(`/v1/pm/requests${qs ? `?${qs}` : ''}`)
    return data.requests.map(map)
  } catch (err) {
    if (import.meta.env.DEV) {
      return inMemoryRequests
    }
    throw err
  }
}

// ── Comments API ──────────────────────────────────────────────────────────────

export async function listRequestComments(reference: string): Promise<RequestComment[]> {
  try {
    const data = await get<{ comments: RequestComment[] }>(
      `/v1/pm/requests/${encodeURIComponent(reference)}/comments`,
    )
    return data.comments
  } catch (err) {
    if (import.meta.env.DEV) {
      // Return empty array in dev (no seeded comments)
      return []
    }
    throw err
  }
}

export async function postRequestComment(
  reference: string,
  body: string,
): Promise<RequestComment> {
  const response = await fetch(`/v1/pm/requests/${encodeURIComponent(reference)}/comments`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ body }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message ?? 'Failed to post comment.')
  }
  return (await response.json()).comment as RequestComment
}

// ── Team Members with Capacity ────────────────────────────────────────────────

export async function listTeamMembersWithCapacity(): Promise<TeamMemberCapacity[]> {
  try {
    const response = await fetch('/v1/pm/team-members', {
      headers: getAuthHeaders(),
      credentials: 'include',
    })
    if (!response.ok) throw new Error('Unable to load team members.')
    return (await response.json()).teamMembers as TeamMemberCapacity[]
  } catch (err) {
    if (import.meta.env.DEV) {
      return [
        { id: 'u1', name: 'Rohan Mehta',  email: 'rohan.mehta@nvaramedia.com', activeAssignmentsCount: 3 },
        { id: 'u2', name: 'Priya Sharma', email: 'priya.sharma@nvaramedia.com', activeAssignmentsCount: 1 },
      ]
    }
    throw err
  }
}

export async function getPmRequest(reference: string): Promise<Request> {
  try {
    const [detail, timeline] = await Promise.all([
      get<{
        request: Summary & {
          createdAt: string
          service_domain?: ServiceDomain
          serviceDomain?: ServiceDomain
          client: {
            name: string
            company: string
            email: string
            phone: string
          }
          escalation: {
            triggeredAt: string
            reason: string
            responsibleName: string
          } | null
        }
      }>('/v1/pm/requests/' + encodeURIComponent(reference)),
      get<{
        events: Array<{
          type: string
          at: string
          title: string
          detail: string
          actor: string
        }>
      }>('/v1/pm/requests/' + encodeURIComponent(reference) + '/timeline'),
    ])

    const raw = detail.request
    const normalised: Summary = {
      ...raw,
      service_domain:
        raw.service_domain ?? raw.serviceDomain ?? ('digital_marketing' as ServiceDomain),
    }

    const request = map(normalised)
    request.createdAt = detail.request.createdAt
    request.client = { id: request.id, ...detail.request.client }

    if (detail.request.escalation) {
      request.escalation = {
        triggeredAt: detail.request.escalation.triggeredAt,
        reason: detail.request.escalation.reason,
        responsiblePerson: user(detail.request.escalation.responsibleName),
      }
    }

    request.timeline = timeline.events.map(
      (event): TimelineEvent => ({
        id: event.at + event.type,
        type: event.type as TimelineEvent['type'],
        title: event.title,
        detail: event.detail,
        actor: event.actor,
        at: event.at,
      }),
    )

    return request
  } catch (err) {
    if (import.meta.env.DEV) {
      const found = inMemoryRequests.find((r) => r.id === reference)
      if (found) return found
    }
    throw err
  }
}

export function removeLocalInMemoryRequest(id: string) {
  inMemoryRequests = inMemoryRequests.filter((r) => r.id !== id)
}
