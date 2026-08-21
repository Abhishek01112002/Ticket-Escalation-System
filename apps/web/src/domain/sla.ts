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
  const rawDeadline = request.sla?.deadlineAt || request.assignment?.acknowledgementDeadline
  const deadline = rawDeadline ? new Date(rawDeadline) : null
  const isValidDate = deadline !== null && !isNaN(deadline.getTime())
  const remainingMs = isValidDate ? deadline.getTime() - now.getTime() : 0
  const fallbackDeadline = isValidDate ? deadline : now

  if (request.workflowStatus === 'resolved') {
    return { state: 'complete', deadline: fallbackDeadline, remainingMs, label: 'Resolved' }
  }
  if (request.escalation && request.assignment?.acknowledgedAt) {
    return { state: 'complete', deadline: fallbackDeadline, remainingMs, label: 'Acknowledged after escalation' }
  }
  if (request.escalation && !request.assignment?.acknowledgedAt) {
    return { state: 'escalated', deadline: fallbackDeadline, remainingMs, label: 'Escalation triggered' }
  }
  if (request.assignment?.acknowledgedAt) {
    return { state: 'complete', deadline: fallbackDeadline, remainingMs, label: 'Acknowledged on time' }
  }
  if (!isValidDate) {
    return { state: 'on_track', deadline: fallbackDeadline, remainingMs: 0, label: 'No SLA window set' }
  }
  if (remainingMs <= 0) {
    return { state: 'breached', deadline: fallbackDeadline, remainingMs, label: 'SLA breached' }
  }
  if (remainingMs <= 8 * 60 * 60 * 1000) {
    return { state: 'warning', deadline: fallbackDeadline, remainingMs, label: 'Due soon' }
  }
  return { state: 'on_track', deadline: fallbackDeadline, remainingMs, label: 'On track' }
}

export function formatRemaining(remainingMs: number): string {
  if (isNaN(remainingMs) || !isFinite(remainingMs)) return '—'
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

export function formatHumanDateTime(value: string | Date): string {
  if (!value) return '—'
  const date = new Date(value)
  if (isNaN(date.getTime())) return '—'
  const dayMonth = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(date)
  const time = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
  return `${dayMonth} · ${time}`
}

export interface DynamicSlaInfo {
  state: 'healthy' | 'warning' | 'urgent' | 'breached' | 'acknowledged' | 'resolved' | 'unassigned'
  badgeLabel: string
  detailLabel: string
  remainingMs: number
}

/**
 * Real-time dynamic SLA countdown helper for live tickers
 */
export function getDynamicSlaInfo(
  deadlineAt: string | null | undefined,
  status: string,
  acknowledgedAt?: string | null,
  now = new Date()
): DynamicSlaInfo {
  if (status === 'resolved') {
    return { state: 'resolved', badgeLabel: 'Resolved', detailLabel: 'Ticket resolved', remainingMs: 0 }
  }
  if (acknowledgedAt || status === 'acknowledged' || status === 'in_progress') {
    return { state: 'acknowledged', badgeLabel: 'Acknowledged', detailLabel: 'SLA fulfilled', remainingMs: 0 }
  }
  if (!deadlineAt) {
    return { state: 'unassigned', badgeLabel: 'No SLA Set', detailLabel: 'Awaiting assignment', remainingMs: 0 }
  }
  const deadline = new Date(deadlineAt)
  if (isNaN(deadline.getTime())) {
    return { state: 'unassigned', badgeLabel: 'No SLA Set', detailLabel: 'Invalid deadline', remainingMs: 0 }
  }

  const remainingMs = deadline.getTime() - now.getTime()
  if (remainingMs <= 0) {
    const overdueMinutes = Math.floor(Math.abs(remainingMs) / (60 * 1000))
    const overdueHours = Math.floor(overdueMinutes / 60)
    const overdueStr = overdueHours > 0 ? `${overdueHours}h ${overdueMinutes % 60}m ago` : `${overdueMinutes}m ago`
    return {
      state: 'breached',
      badgeLabel: 'Breached',
      detailLabel: `Breached ${overdueStr}`,
      remainingMs,
    }
  }

  const minutes = Math.floor(remainingMs / (60 * 1000))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let badgeLabel = ''
  if (days > 0) badgeLabel = `${days}d ${hours % 24}h left`
  else if (hours > 0) badgeLabel = `${hours}h ${minutes % 60}m left`
  else badgeLabel = `${minutes}m left`

  if (hours < 1) {
    return { state: 'urgent', badgeLabel, detailLabel: `${minutes}m remaining`, remainingMs }
  }
  if (hours < 4) {
    return { state: 'warning', badgeLabel, detailLabel: `${hours}h ${minutes % 60}m remaining`, remainingMs }
  }
  return { state: 'healthy', badgeLabel, detailLabel: `${hours}h remaining`, remainingMs }
}
