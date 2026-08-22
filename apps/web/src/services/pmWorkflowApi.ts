import { getPmRequest, listTeamMembersWithCapacity, listRequestComments, postRequestComment, removeLocalInMemoryRequest } from './pmRequestApi'
import { getAuthHeaders } from './devAuth'

const headers = (): Record<string, string> => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
})

async function mutate(path: string, body: { expectedVersion: number; assigneeUserId?: string }, id: string) {
  const key = crypto.randomUUID()
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { ...headers(), 'Idempotency-Key': key },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      const error = new Error(data?.error?.message ?? 'Request failed.') as Error & { status?: number }
      error.status = response.status
      throw error
    }
    // Return full mapped Request domain object with timeline and associations
    return await getPmRequest(id)
  } catch (err) {
    if (import.meta.env.DEV) {
      const current = await getPmRequest(id)
      return { ...current, version: (current.version ?? 1) + 1 }
    }
    throw err
  }
}

export const assignRequest = (id: string, assigneeUserId: string, expectedVersion: number) =>
  mutate(`/v1/pm/requests/${encodeURIComponent(id)}/assignments`, { assigneeUserId, expectedVersion }, id)

export const acknowledgeRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/acknowledge`, { expectedVersion }, id)

export const startWorkRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/start-work`, { expectedVersion }, id)

export const resolveRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/resolve`, { expectedVersion }, id)

export async function deleteRequest(id: string, expectedVersion?: number): Promise<void> {
  const response = await fetch(`/v1/pm/requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
    credentials: 'include',
    body: JSON.stringify(expectedVersion !== undefined ? { expectedVersion } : {}),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message ?? 'Failed to delete request.')
  }
}

// Re-export capacity-aware team members and comment functions for portal consumption
export { listTeamMembersWithCapacity as listTeamMembers, listRequestComments, postRequestComment, getPmRequest }
