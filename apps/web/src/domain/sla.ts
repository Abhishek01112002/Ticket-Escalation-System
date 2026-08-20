import type { Request } from './ticket'

// ── SLA State ──

export type SlaState = 'on_track' | 'warning' | 'breached' | 'escalated' | 'complete'

export interface SlaSummary {
  state: SlaState
  deadline: Date
  remainingMs: number
  label: string
}

/**
 * Calculates the operational SLA summary for a given request relative to current time.
 */
export function getSlaSummary(request: Request, now = new Date()): SlaSummary {
  const deadline = new Date(request.assignment.acknowledgementDeadline)
  const remainingMs = deadline.getTime() - now.getTime()

  if (request.workflowStatus === 'resolved') {
    return { state: 'complete', deadline, remainingMs, label: 'Resolved' }
  }
  if (request.escalation && request.assignment.acknowledgedAt) {
    return { state: 'complete', deadline, remainingMs, label: 'Acknowledged after escalation' }
  }
  if (request.escalation && !request.assignment.acknowledgedAt) {
    return { state: 'escalated', deadline, remainingMs, label: 'Escalation triggered' }
  }
  if (request.assignment.acknowledgedAt) {
    return { state: 'complete', deadline, remainingMs, label: 'Acknowledged on time' }
  }
  if (remainingMs <= 0) {
    return { state: 'breached', deadline, remainingMs, label: 'SLA breached' }
  }
  if (remainingMs <= 8 * 60 * 60 * 1000) {
    return { state: 'warning', deadline, remainingMs, label: 'Due soon' }
  }
  return { state: 'on_track', deadline, remainingMs, label: 'On track' }
}

export function formatRemaining(remainingMs: number): string {
  const absoluteMs = Math.abs(remainingMs)
  const hours = Math.floor(absoluteMs / (60 * 60 * 1000))
  const minutes = Math.floor((absoluteMs % (60 * 60 * 1000)) / (60 * 1000))
  return remainingMs < 0 ? `${hours}h ${minutes}m overdue` : `${hours}h ${minutes}m remaining`
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}
