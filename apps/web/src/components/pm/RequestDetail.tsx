import type { Request, User } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatDateTime, getSlaSummary } from '../../domain/sla'
import { EscalationBadge, StatusBadge, UrgencyBadge } from '../ui/badges'
import { Avatar, MetaField, Section, WorkflowStepper } from '../ui/layout'
import { SlaSection } from './SlaSection'
import { EscalationSection } from './EscalationSection'
import { TimelineSection } from './TimelineSection'
import { ActionPanel } from './ActionPanel'

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

export function RequestDetail({
  request,
  user,
  members,
  busy,
  onBack,
  onAssign,
  onAcknowledge,
  onStartWork,
  onResolve,
}: {
  request: DetailRequest
  user: User
  members: Member[]
  busy: boolean
  onBack: () => void
  onAssign: (userId: string) => void
  onAcknowledge: () => void
  onStartWork: () => void
  onResolve: () => void
}) {
  const sla = getSlaSummary(request)
  const isPM = user.role === 'project_manager'
  const isAssignee = request.assignment?.assignee?.id === user.id
  const isResolved = request.workflowStatus === 'resolved'
  const needsAck = request.workflowStatus === 'awaiting_acknowledgement'
  const canStartWork = request.workflowStatus === 'acknowledged'
  const canResolve = request.workflowStatus === 'in_progress'

  return (
    <div className="max-w-[1280px] mx-auto w-full px-5 sm:px-8 py-6 animate-fade-in">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12.5px] font-semibold mb-5 transition-colors"
        style={{ color: 'var(--color-ink-muted)' }}
        onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-ink)')}
        onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
      >
        <span aria-hidden="true">←</span> Back to queue
      </button>

      {/* Page header */}
      <div
        className="pb-5 mb-5"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="text-[11.5px] font-semibold"
                style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {request.id}
              </span>
              <UrgencyBadge urgency={request.clientUrgency} />
              {request.escalation && <EscalationBadge />}
            </div>
            <h1
              className="text-[20px] sm:text-[22px] font-bold tracking-tight leading-snug mb-1.5"
              style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
            >
              {request.subject}
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--color-ink-muted)' }}>
              {request.client.company}
              {request.client.name && ` · ${request.client.name}`}
              {request.createdAt && ` · ${formatDateTime(request.createdAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={request.workflowStatus} size="md" />
          </div>
        </div>

        {/* Workflow stepper */}
        <div className="mt-4">
          <WorkflowStepper status={request.workflowStatus} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
        {/* Left: primary content */}
        <div className="flex flex-col gap-4">
          {/* Request details */}
          <Section title="Request" label="Client request details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-4">
              <MetaField label="Service">{SERVICE_DOMAIN_LABELS[request.serviceDomain]}</MetaField>
              <MetaField label="Urgency">
                <span className="capitalize">{request.clientUrgency.replace('_', ' ')}</span>
              </MetaField>
              {request.client.email && (
                <MetaField label="Email">
                  <a
                    href={`mailto:${request.client.email}`}
                    className="hover:underline"
                    style={{ color: 'var(--color-ink-secondary)' }}
                  >
                    {request.client.email}
                  </a>
                </MetaField>
              )}
              {request.client.phone && (
                <MetaField label="Phone">{request.client.phone}</MetaField>
              )}
            </div>
            {request.subject && (
              <div>
                <p
                  className="text-[10.5px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-ink-muted)' }}
                >
                  Requirement
                </p>
                <p
                  className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'var(--color-ink-secondary)' }}
                >
                  {request.subject}
                </p>
              </div>
            )}
          </Section>

          {/* SLA */}
          <SlaSection request={request} sla={sla} />

          {/* Escalation */}
          {request.escalation && (
            <EscalationSection escalation={request.escalation} />
          )}

          {/* Timeline */}
          <TimelineSection timeline={request.timeline} />
        </div>

        {/* Right: operational sidebar */}
        <div className="flex flex-col gap-4">
          {/* Current owner */}
          <Section title="Current Owner" label="Assignment status">
            {request.assignment?.assignee ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar user={request.assignment.assignee} size="md" />
                  <div>
                    <p
                      className="text-[14px] font-bold leading-tight"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {request.assignment.assignee.name}
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--color-ink-muted)' }}>
                      {request.assignment.assignee.team}
                    </p>
                  </div>
                </div>
                {request.assignment.assignedAt && (
                  <p className="text-[11.5px]" style={{ color: 'var(--color-ink-faint)' }}>
                    Assigned {formatDateTime(request.assignment.assignedAt)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[13px] italic" style={{ color: 'var(--color-ink-faint)' }}>
                Not yet assigned
              </p>
            )}
          </Section>

          {/* Actions */}
          {!isResolved && (
            <ActionPanel
              request={request}
              user={user}
              members={members}
              busy={busy}
              isPM={isPM}
              isAssignee={isAssignee}
              needsAck={needsAck}
              canStartWork={canStartWork}
              canResolve={canResolve}
              onAssign={onAssign}
              onAcknowledge={onAcknowledge}
              onStartWork={onStartWork}
              onResolve={onResolve}
            />
          )}

          {isResolved && (
            <Section title="Status" label="Resolution status">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-none"
                  style={{ background: 'var(--color-emerald-dot)' }}
                >
                  ✓
                </span>
                <p className="text-[13.5px] font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Request resolved
                </p>
              </div>
              <p className="text-[12.5px]" style={{ color: 'var(--color-ink-muted)' }}>
                The full audit trail is preserved in the timeline.
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
