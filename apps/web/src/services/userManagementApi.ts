import { getAuthHeaders } from './devAuth'

export interface OrganizationUser {
  id: string
  displayName: string
  email: string
  phoneWhatsapp?: string | null
  role: 'project_manager' | 'internal_team_member'
  isActive: boolean
  createdAt: string
  activeAssignmentsCount: number
  resolvedAssignmentsCount: number
  slaComplianceRate: number
  avgResolutionMinutes: number
}

export interface InviteUserInput {
  displayName: string
  email: string
  phoneWhatsapp?: string
  role: 'project_manager' | 'internal_team_member'
  mode: 'invite_link' | 'instant_password'
  initialPassword?: string
}

export interface InviteUserResponse {
  mode: 'invite_link' | 'instant_password'
  inviteUrl?: string
  rawToken?: string
  expiresAt?: string
  user?: OrganizationUser
  temporaryPassword?: string
  message: string
}

export interface UpdateUserInput {
  displayName?: string
  phoneWhatsapp?: string | null
  role?: 'project_manager' | 'internal_team_member'
  isActive?: boolean
  reassignToUserId?: string | null
}

export interface RecentTicket {
  assignmentId: string
  requestId: string
  reference: string
  requirement: string
  urgency: string
  status: string
  assignedAt: string
  endedAt: string | null
  isLate: boolean
  serviceDomain: string
}

export interface MemberDetailResponse {
  member: {
    id: string
    displayName: string
    email: string
    phoneWhatsapp?: string | null
    role: 'project_manager' | 'internal_team_member'
    isActive: boolean
    createdAt: string
  }
  recentTickets: RecentTicket[]
}

export interface AuditLogEntry {
  id: string
  eventType: string
  occurredAt: string
  actorType: string
  actorName: string
  actorEmail: string | null
  metadata: Record<string, unknown>
}

export async function listOrganizationUsers(): Promise<OrganizationUser[]> {
  const res = await fetch('/v1/pm/users', {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message || 'Failed to load organization team members.')
  }

  const data = await res.json()
  return data.users as OrganizationUser[]
}

export async function getMemberDetail(id: string): Promise<MemberDetailResponse> {
  const res = await fetch(`/v1/pm/users/${encodeURIComponent(id)}/detail`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message || 'Failed to load member profile.')
  }

  return res.json()
}

export async function inviteOrganizationUser(
  input: InviteUserInput
): Promise<InviteUserResponse> {
  const payload: Record<string, unknown> = {
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    role: input.role,
    mode: input.mode,
  }
  if (input.phoneWhatsapp?.trim()) {
    payload.phoneWhatsapp = input.phoneWhatsapp.trim()
  }
  if (input.mode === 'instant_password' && input.initialPassword?.trim()) {
    payload.initialPassword = input.initialPassword.trim()
  }

  const res = await fetch('/v1/pm/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to process team member invitation.')
  }

  return data as InviteUserResponse
}

export async function createOrganizationUser(
  input: { displayName: string; email: string; role: 'project_manager' | 'internal_team_member'; initialPassword?: string }
): Promise<InviteUserResponse> {
  return inviteOrganizationUser({ ...input, mode: 'instant_password' })
}

export async function updateOrganizationUser(
  userId: string,
  input: UpdateUserInput
): Promise<{ user: OrganizationUser; message: string }> {
  const res = await fetch(`/v1/pm/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update team member.')
  }

  return data
}

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch('/v1/pm/audit-logs', {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error?.message || 'Failed to load audit logs.')
  }

  const data = await res.json()
  return data.logs || []
}
