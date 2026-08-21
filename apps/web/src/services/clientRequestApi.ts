import type { ClientUrgency, CreateRequestInput, ServiceDomain } from '../domain/ticket'

export interface SubmissionConfirmation {
  reference: string
  createdAt: string
  status: 'received'
  clientName: string
  email: string
  phone: string
}

export class ClientRequestApiError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message)
    this.name = 'ClientRequestApiError'
  }
}

function idempotencyKey() {
  return crypto.randomUUID()
}

export async function submitClientRequest(input: CreateRequestInput): Promise<SubmissionConfirmation> {
  try {
    const response = await fetch('/v1/client/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        name: input.clientName,
        company: input.company,
        email: input.email,
        phone: input.phone,
        serviceDomain: input.serviceDomain as ServiceDomain,
        requirement: `${input.subject.trim()}\n\n${input.description.trim()}`,
        urgency: input.clientUrgency as ClientUrgency,
      }),
    })
    const payload = await response.json().catch(() => null) as {
      reference?: string
      createdAt?: string
      status?: 'received'
      error?: { message?: string; fields?: Record<string, string> }
    } | null

    if (response.ok && payload?.reference && payload.createdAt && payload.status === 'received') {
      return {
        reference: payload.reference,
        createdAt: payload.createdAt,
        status: payload.status,
        clientName: input.clientName,
        email: input.email,
        phone: input.phone,
      }
    }

    if (!response.ok) {
      throw new ClientRequestApiError(
        payload?.error?.message ?? `Submission failed (${response.status}). Please verify your details and try again.`,
        payload?.error?.fields
      )
    }

    throw new ClientRequestApiError(payload?.error?.message ?? 'Service temporarily unavailable.')
  } catch (err) {
    if (err instanceof ClientRequestApiError) throw err

    // In local development preview mode, if backend server is completely offline (network error), provide preview
    if (import.meta.env.DEV && err instanceof TypeError) {
      const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase()
      const demoRef = `NVARA-${new Date().getFullYear()}-${randomHex}`
      return {
        reference: demoRef,
        createdAt: new Date().toISOString(),
        status: 'received',
        clientName: input.clientName,
        email: input.email,
        phone: input.phone,
      }
    }

    throw new ClientRequestApiError('We could not submit your request. Please try again.')
  }
}
