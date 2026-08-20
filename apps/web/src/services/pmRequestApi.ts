import type { Request, ServiceDomain, TimelineEvent, User } from '../domain/ticket'
import { getAuthHeaders } from './devAuth'

const headers = getAuthHeaders

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: headers() })
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

function user(name: string, email?: string, id?: string): User {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return {
    id: id ?? email ?? name,
    name,
    initials,
    role: 'team_member',
    team: 'Internal team',
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
      name: row.client.name,
      company: row.client.company,
      email: '',
      phone: '',
    },
    createdAt: '',
    workflowStatus: row.status,
    assignment: (row.currentResponsibility
      ? {
          assignedBy: 'System',
          acknowledgementDeadline: row.sla.deadlineAt,
          assignee: user(
            row.currentResponsibility.name,
            row.currentResponsibility.email,
            row.currentResponsibility.id,
          ),
          assignedAt: row.currentResponsibility.assignedAt,
          acknowledgedAt: row.sla.acknowledgedAt ?? undefined,
        }
      : {
          assignedBy: 'System',
          acknowledgementDeadline: row.sla.deadlineAt,
          assignee: null as any,
          assignedAt: '',
          acknowledgedAt: undefined,
        }) as any,
    sla: {
      deadlineAt: row.sla.deadlineAt,
      status: row.sla.status,
      acknowledgedAt: row.sla.acknowledgedAt ?? undefined,
      breachedAt: row.sla.breachedAt ?? undefined,
    },
    timeline: [],
  }
}

export async function getPmMe() {
  const data = await get<{
    user: {
      id: string
      displayName: string
      email: string
      role: 'project_manager' | 'internal_team_member'
      organizationName: string
    }
  }>('/v1/auth/me')
  return {
    id: data.user.id,
    name: data.user.displayName,
    initials: data.user.displayName
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    role: (data.user.role === 'project_manager'
      ? 'project_manager'
      : 'team_member') as User['role'],
    team: data.user.organizationName,
  }
}

export async function listPmRequests() {
  const data = await get<{ requests: Summary[] }>('/v1/pm/requests')
  return data.requests.map(map)
}

export async function getPmRequest(reference: string) {
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
}
