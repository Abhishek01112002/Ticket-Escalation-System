import type { Request, User } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatDateTime, getSlaSummary } from '../../domain/sla'
import { EscalationBadge, StatusBadge, UrgencyBadge } from '../ui/badges'
import { Avatar, MetaField, Section, WorkflowStepper } from '../ui/layout'
import { ArrowLeftIcon, CheckIcon } from '../ui/icons'
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
    <div className="max-w-[1400px] w-full mx-auto px-6 sm:px-10 py-7 animate-fade-in">
      {/* ── Breadcrumb / Back ── */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748b] hover:text-[#0f172a] mb-5 transition-colors"
      >
        <ArrowLeftIcon size={13} />
        <span>Back to Operations Queue</span>
      </button>

      {/* ── Header Canvas ── */}
      <div className="bg-white rounded-lg border border-[#e2e8f0] p-6 mb-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-5 border-b border-[#f1f5f9]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="font-mono text-[12px] font-bold text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded border border-[#e2e8f0]">
                {request.id}
              </span>
              <UrgencyBadge urgency={request.clientUrgency} />
              {request.escalation && <EscalationBadge />}
            </div>

            <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-[#0f172a] leading-snug mb-2">
              {request.subject}
            </h1>

            <p className="text-[13px] text-[#64748b] flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="text-[#0f172a]">{request.client.company}</strong>
              {request.client.name && <span>· {request.client.name}</span>}
              {request.createdAt && <span>· Received {formatDateTime(request.createdAt)}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={request.workflowStatus} size="md" />
          </div>
        </div>

        {/* Workflow Progress Bar */}
        <div className="pt-4">
          <WorkflowStepper status={request.workflowStatus} />
        </div>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Left Column: Core Domain & Workflow Details */}
        <div className="flex flex-col gap-6">
          {/* Request Requirements */}
          <Section title="Requirement Scope &amp; Context" label="Client requirement details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-5 pb-4 border-b border-[#f1f5f9]">
              <MetaField label="Service Area">
                {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
              </MetaField>
              <MetaField label="Client Urgency">
                <span className="capitalize">{request.clientUrgency.replace('_', ' ')}</span>
              </MetaField>
              <MetaField label="Client Email">
                <a
                  href={`mailto:${request.client.email}`}
                  className="hover:underline text-[#0f172a]"
                >
                  {request.client.email}
                </a>
              </MetaField>
              <MetaField label="Contact Phone">
                {request.client.phone || '—'}
              </MetaField>
            </div>

            {request.subject && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block mb-2">
                  Full Requirement Description
                </span>
                <p className="text-[13.5px] text-[#334155] leading-relaxed whitespace-pre-wrap">
                  {request.subject}
                </p>
              </div>
            )}
          </Section>

          {/* SLA Tracking */}
          <SlaSection request={request} sla={sla} />

          {/* Escalation Event (if triggered) */}
          {request.escalation && (
            <EscalationSection escalation={request.escalation} />
          )}

          {/* Chronological Audit Timeline */}
          <TimelineSection timeline={request.timeline} />
        </div>

        {/* Right Column: Ownership & Operations Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Current Assignee Card */}
          <Section title="Assigned Specialist" label="Ownership status">
            {request.assignment?.assignee ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar user={request.assignment.assignee} size="md" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#0f172a] truncate">
                      {request.assignment.assignee.name}
                    </p>
                    <p className="text-[12px] text-[#64748b]">
                      {request.assignment.assignee.team || 'Specialist Team'}
                    </p>
                  </div>
                </div>

                {request.assignment.assignedAt && (
                  <p className="text-[11.5px] text-[#94a3b8] border-t border-[#f1f5f9] pt-2">
                    Assigned {formatDateTime(request.assignment.assignedAt)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[#94a3b8] italic">
                No specialist assigned yet.
              </p>
            )}
          </Section>

          {/* Next Action Controls */}
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

          {/* Resolved State Confirmation */}
          {isResolved && (
            <Section title="Resolution Status" label="Completed request">
              <div className="flex items-center gap-2 mb-2 text-[#059669]">
                <span className="w-5 h-5 rounded-full bg-[#ecfdf5] border border-[#d1fae5] flex items-center justify-center text-[11px] font-bold">
                  <CheckIcon size={12} />
                </span>
                <span className="text-[13.5px] font-bold text-[#0f172a]">
                  Request Completed
                </span>
              </div>
              <p className="text-[12.5px] text-[#64748b] leading-relaxed">
                All lifecycle steps have been successfully closed and recorded in the audit trail.
              </p>
            </Section>
          )}

          {/* Client Details Quick Reference */}
          <Section title="Client Organization" label="Client information">
            <div className="flex flex-col gap-2 text-[13px]">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block">
                  Company
                </span>
                <span className="font-semibold text-[#0f172a]">{request.client.company}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block">
                  Primary Contact
                </span>
                <span className="text-[#334155]">{request.client.name}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8] block">
                  Email
                </span>
                <a href={`mailto:${request.client.email}`} className="text-[#0f172a] hover:underline font-mono text-[12px]">
                  {request.client.email}
                </a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
