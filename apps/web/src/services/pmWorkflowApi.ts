import { getPmRequest, listTeamMembersWithCapacity, listRequestComments, postRequestComment, removeLocalInMemoryRequest } from './pmRequestApi'
import { getAuthHeaders } from './devAuth'

const headers = (): Record<string, string> => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
})

async function mutate(path: string, body: { expectedVersion: number; assigneeUserId?: string }) {
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
    return (await response.json()).request
  } catch (err) {
    if (import.meta.env.DEV) {
      const reqId = path.split('/')[3]
      const current = await getPmRequest(reqId)
      return { ...current, version: (current.version ?? 1) + 1 }
    }
    throw err
  }
}

export const assignRequest = (id: string, assigneeUserId: string, expectedVersion: number) =>
  mutate(`/v1/pm/requests/${encodeURIComponent(id)}/assignments`, { assigneeUserId, expectedVersion })

export const acknowledgeRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/acknowledge`, { expectedVersion })

export const startWorkRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/start-work`, { expectedVersion })

export const resolveRequest = (id: string, expectedVersion: number) =>
  mutate(`/v1/requests/${encodeURIComponent(id)}/resolve`, { expectedVersion })

export async function deleteRequest(id: string): Promise<void> {
  try {
    const response = await fetch(`/v1/pm/requests/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error?.message ?? 'Failed to delete request.')
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      removeLocalInMemoryRequest(id)
      return
    }
    throw err
  }
}

// Re-export capacity-aware team members and comment functions for portal consumption
export { listTeamMembersWithCapacity as listTeamMembers, listRequestComments, postRequestComment, getPmRequest }
