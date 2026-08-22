import { useState } from 'react'
import type { Request, RequestComment, TeamMemberCapacity, User } from '../../domain/ticket'
import { SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatHumanDateTime, getSlaSummary } from '../../domain/sla'
import { EscalationBadge, StatusBadge, UrgencyBadge } from '../ui/badges'
import { Avatar, MetaField, Section, WorkflowStepper } from '../ui/layout'
import { ChevronLeft } from '../ui/icons'
import { SlaSection } from './SlaSection'
import { EscalationSection } from './EscalationSection'
import { TimelineSection } from './TimelineSection'
import { ActionPanel } from './ActionPanel'
import { CommentsThread } from './CommentsThread'

type DetailRequest = Request & { version: number }
type Member = TeamMemberCapacity

function cleanName(name?: string): string {
  if (!name) return 'Specialist'
  const cleaned = String(name).replace(/^Demo\s+/i, '').trim()
  if (cleaned.toLowerCase() === 'internal team member') return 'Specialist'
  return cleaned || 'Specialist'
}

function getSubjectAndDescription(subject: string, description?: string): { headline: string; fullScope: string } {
  const text = (subject || description || 'Client Requirement').trim()
  
  if (text.length > 70 || text.includes('\n') || text.includes('. ')) {
    const firstPeriod = text.indexOf('. ')
    const firstNewline = text.indexOf('\n')
    let splitIdx = -1
    
    if (firstPeriod !== -1 && firstNewline !== -1) splitIdx = Math.min(firstPeriod + 1, firstNewline)
    else if (firstPeriod !== -1) splitIdx = firstPeriod + 1
    else if (firstNewline !== -1) splitIdx = firstNewline
    else splitIdx = 65

    const headline = text.slice(0, splitIdx).trim()
    return {
      headline,
      fullScope: text,
    }
  }

  return {
    headline: text,
    fullScope: description && description !== text ? `${text}\n\n${description}` : text,
  }
}

export function RequestDetail({
  request,
  user,
  members,
  comments,
  busy,
  onBack,
  onAssign,
  onAcknowledge,
  onStartWork,
  onResolve,
  onDelete,
  onPostComment,
  onOpenWhatsAppBriefing,
}: {
  request: DetailRequest
  user: User
  members: Member[]
  comments: RequestComment[]
  busy: boolean
  onBack: () => void
  onAssign: (userId: string) => void
  onAcknowledge: () => void
  onStartWork: () => void
  onResolve: () => void
  onDelete?: (id: string) => void
  onPostComment: (reference: string, body: string) => Promise<RequestComment>
  onOpenWhatsAppBriefing?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const sla = getSlaSummary(request)
  const isPM = user.role === 'project_manager'
  const isAssignee = request.assignment?.assignee?.id === user.id
  const isResolved = request.workflowStatus === 'resolved'
  const needsAck = request.workflowStatus === 'awaiting_acknowledgement'
  const canStartWork = request.workflowStatus === 'acknowledged'
  const canResolve = request.workflowStatus === 'in_progress'

  const copyReference = () => {
    navigator.clipboard.writeText(request.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const { headline, fullScope } = getSubjectAndDescription(request.subject, request.description)

  return (
    <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-12 py-8 text-[#0f172a] animate-fade-in">
      <button
        onClick={onBack}
        className="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-2 text-[13.5px] font-medium text-[#64748b] hover:text-[#0f172a] mb-4 transition-colors cursor-pointer select-none"
        aria-label="Back to Operations Queue"
      >
        <ChevronLeft size={18} className="text-[#94a3b8]" />
        <span>Operations Queue</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-7 sm:p-9 shadow-xs space-y-8">
          <div className="pb-7 border-b border-[#f1f5f9]">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={copyReference}
                  className="font-mono text-[12px] font-bold text-[#64748b] bg-[#f1f5f9] px-2.5 py-1 rounded-md border border-[#e2e8f0] hover:bg-[#e2e8f0] transition-colors"
                >
                  {copied ? '✓ Copied' : request.id}
                </button>
                <UrgencyBadge urgency={request.clientUrgency} />
                {request.escalation && <EscalationBadge />}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={request.workflowStatus} size="md" />
              </div>
            </div>

            <h1 className="text-[24px] sm:text-[26px] font-bold tracking-tight text-[#0f172a] leading-snug mb-3">
              {headline}
            </h1>

            <p className="text-[13.5px] text-[#64748b] flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-7">
              <strong className="text-[#0f172a] font-semibold">{request.client.company}</strong>
              {request.client.name && <span>· {request.client.name}</span>}
              <span>· {SERVICE_DOMAIN_LABELS[request.serviceDomain]}</span>
              {request.createdAt && <span>· Received {formatHumanDateTime(request.createdAt)}</span>}
            </p>

            <div className="pt-2">
              <WorkflowStepper status={request.workflowStatus} />
            </div>
          </div>

          <Section title="Requirement Details" label="Client requirement details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-6 pb-6 border-b border-[#f1f5f9]">
              <MetaField label="Service Area">
                <span className="font-semibold text-[#0f172a] text-[13.5px]">
                  {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
                </span>
              </MetaField>
              <MetaField label="Timeline Urgency">
                <span className="capitalize font-medium text-[#0f172a] text-[13.5px]">
                  {String(request.clientUrgency || 'flexible').replace('_', ' ')}
                </span>
              </MetaField>
              <MetaField label="Work Email">
                <a
                  href={`mailto:${request.client.email}`}
                  className="text-[#059669] hover:underline text-[13.5px] font-medium"
                >
                  {request.client.email}
                </a>
              </MetaField>
              <MetaField label="Contact Phone">
                <span className="text-[#0f172a] text-[13.5px] font-medium">
                  {request.client.phone || '—'}
                </span>
              </MetaField>
            </div>

            {fullScope && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] block mb-2.5">
                  Scope &amp; Description
                </span>
                <div className="p-5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[14px] text-[#334155] leading-relaxed whitespace-pre-wrap font-normal">
                  {fullScope}
                </div>
              </div>
            )}
          </Section>

          {/* 3. Operational SLA Tracking */}
          <SlaSection request={request} sla={sla} />

          {/* 4. Active Escalation (Rendered only when active) */}
          {request.escalation && (
            <EscalationSection escalation={request.escalation} />
          )}

          {/* 5. Chronological Request History */}
          <TimelineSection timeline={request.timeline} />

          {/* 6. Internal Comments Thread (PM + assigned Specialist only) */}
          <div className="pt-2">
            <CommentsThread
              ticketReference={request.id}
              currentUserId={user.id}
              currentUserRole={user.role}
              currentUserName={user.name}
              initialComments={comments}
              onPost={onPostComment}
            />
          </div>
        </div>

        {/* ── Right Column: Unified Operational Panel ── */}
        <div className="space-y-6 sticky top-20">
          {/* Section A: Assigned Specialist Card */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3.5">
              Assigned Specialist
            </h2>
            {request.assignment?.assignee ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3.5">
                  <Avatar user={{ name: cleanName(request.assignment.assignee.name) }} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#0f172a] truncate">
                      {cleanName(request.assignment.assignee.name)}
                    </p>
                    <p className="text-[12.5px] text-[#64748b]">
                      {request.assignment.assignee.team || 'Specialist Operations Team'}
                    </p>
                  </div>
                </div>

                {/* WhatsApp Quick Dispatch Action Button */}
                {isPM && onOpenWhatsAppBriefing && (
                  <button
                    type="button"
                    onClick={onOpenWhatsAppBriefing}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#334155] hover:text-[#0f172a] border border-[#cbd5e1] text-xs font-semibold transition-colors cursor-pointer"
                    title="Generate and dispatch pre-filled task briefing on WhatsApp"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#059669]">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>WhatsApp Task Briefing</span>
                  </button>
                )}

                {request.assignment?.assignedAt && (
                  <p className="text-[12px] text-[#64748b] pt-2 border-t border-[#f1f5f9]">
                    Assigned on {formatHumanDateTime(request.assignment.assignedAt)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[#64748b] italic">
                No specialist assigned yet.
              </p>
            )}
          </div>

          {/* Section B: Next Operational Action Card */}
          {!isResolved && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3.5">
                Next Action
              </h2>
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
            </div>
          )}

          {/* Section C: Resolution Status Card */}
          {isResolved && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3.5">
                Resolution Status
              </h2>
              <div className="flex items-center gap-2.5 mb-2.5 text-[#059669]">
                <span className="w-5 h-5 rounded-full bg-[#ecfdf5] border border-[#d1fae5] flex items-center justify-center text-[11px] font-bold">
                  ✓
                </span>
                <span className="text-[14px] font-bold text-[#0f172a]">
                  Request Completed
                </span>
              </div>
              <p className="text-[13px] text-[#64748b] leading-relaxed mb-5">
                All lifecycle deliverables have been closed and recorded in the audit trail.
              </p>

              {/* Delete Resolved Request Button */}
              {isPM && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={busy}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239] text-[12.5px] font-semibold hover:bg-[#ffe4e6] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete Resolved Request
                </button>
              )}
            </div>
          )}

          {/* Section D: Client Organization Card (Apple Grade Info Box) */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#64748b]">
                Client Organization
              </h2>
              <span className="text-[11px] font-semibold text-[#059669] bg-[#ecfdf5] px-2.5 py-0.5 rounded-full border border-[#d1fae5]">
                Verified Account
              </span>
            </div>

            <div className="flex flex-col gap-3.5 text-[13px]">
              <div>
                <span className="text-[11px] font-medium text-[#94a3b8] block mb-0.5">
                  Company Name
                </span>
                <span className="text-[14.5px] font-bold text-[#0f172a] block">
                  {request.client.company}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#94a3b8] block mb-0.5">
                  Primary Contact Person
                </span>
                <span className="text-[13.5px] font-semibold text-[#334155] block">
                  {request.client.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#94a3b8] block mb-0.5">
                  Work Email Address
                </span>
                <a
                  href={`mailto:${request.client.email}`}
                  className="text-[13px] font-medium text-[#059669] hover:underline block truncate"
                >
                  {request.client.email}
                </a>
              </div>

              {request.client.phone && (
                <div>
                  <span className="text-[11px] font-medium text-[#94a3b8] block mb-0.5">
                    Contact Phone
                  </span>
                  <span className="text-[13px] font-medium text-[#334155] block">
                    {request.client.phone}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Accessible Deletion Confirmation Modal Dialog ── */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/40 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xl max-w-md w-full p-7 text-[#0f172a]">
            <div className="flex items-center gap-3 mb-3 text-[#e11d48]">
              <span className="w-9 h-9 rounded-full bg-[#fff1f2] border border-[#ffe4e6] flex items-center justify-center text-sm font-bold">
                !
              </span>
              <h3 id="modal-delete-title" className="text-[17px] font-bold">
                Permanently Delete Request?
              </h3>
            </div>

            <p className="text-[13.5px] text-[#64748b] leading-relaxed mb-7">
              This action cannot be undone. Request <strong className="font-mono text-[#0f172a]">{request.id}</strong> and all associated audit history, SLA logs, and assignments will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl border border-[#cbd5e1] text-[13px] font-medium text-[#334155] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDelete) onDelete(request.id)
                  setShowDeleteConfirm(false)
                }}
                disabled={busy}
                className="px-4.5 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white text-[13px] font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
