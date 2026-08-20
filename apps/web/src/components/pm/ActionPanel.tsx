import { useEffect, useState } from 'react'
import type { Request, User } from '../../domain/ticket'
import { PrimaryBtn } from '../ui/buttons'

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

function cleanName(name: string): string {
  if (!name) return 'Specialist'
  const cleaned = name.replace(/^Demo\s+/i, '').trim()
  if (cleaned.toLowerCase() === 'internal team member') return 'Specialist'
  return cleaned || 'Specialist'
}

function cleanSpecialistLabel(member: Member): string {
  const name = cleanName(member.name)
  const isPM = member.email.includes('pm') || member.id === 'usr-pm-1'
  const role = isPM ? 'Project Lead' : 'Senior Specialist'
  return `${name} · ${role}`
}

export function ActionPanel({
  request,
  user,
  members,
  busy,
  isPM,
  isAssignee,
  needsAck,
  canStartWork,
  canResolve,
  onAssign,
  onAcknowledge,
  onStartWork,
  onResolve,
}: {
  request: DetailRequest
  user: User
  members: Member[]
  busy: boolean
  isPM: boolean
  isAssignee: boolean
  needsAck: boolean
  canStartWork: boolean
  canResolve: boolean
  onAssign: (userId: string) => void
  onAcknowledge: () => void
  onStartWork: () => void
  onResolve: () => void
}) {
  const currentAssigneeId = request.assignment?.assignee?.id
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  useEffect(() => {
    if (members.length > 0) {
      setSelectedUserId(currentAssigneeId || members[0]?.id || '')
    }
  }, [members, currentAssigneeId])

  const targetMember = members.find((m) => m.id === selectedUserId)
  const targetMemberName = cleanName(targetMember?.name ?? 'Specialist')
  const hasChangedAssignee = selectedUserId !== currentAssigneeId && Boolean(selectedUserId)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Contextual Lifecycle Action Box ── */}
      {needsAck && (
        <div className="rounded-xl bg-[#fffbeb] border border-[#fef3c7] p-5 flex flex-col gap-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#92400e]">
              Acknowledgement SLA Active
            </span>
            <span className="w-2 h-2 rounded-full bg-[#d97706] animate-pulse" />
          </div>

          <p className="text-[13px] text-[#92400e] leading-relaxed">
            {isAssignee
              ? 'You are the assigned specialist. Confirm receipt to meet the 24-hour SLA window.'
              : `Awaiting receipt confirmation from ${cleanName(request.assignment?.assignee?.name || 'assigned specialist')}.`}
          </p>

          {isAssignee && (
            <PrimaryBtn
              onClick={onAcknowledge}
              disabled={busy}
              busy={busy}
              className="w-full h-10 rounded-lg bg-[#059669] hover:bg-[#047857] active:bg-[#064e3b] text-white font-bold shadow-xs"
            >
              ✓ Acknowledge Request
            </PrimaryBtn>
          )}
        </div>
      )}

      {canStartWork && (
        <div className="rounded-xl bg-[#f0fdf4] border border-[#dcfce7] p-5 flex flex-col gap-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#166534]">
              Ready For Execution
            </span>
            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
          </div>

          <p className="text-[13px] text-[#166534] leading-relaxed">
            Receipt acknowledged. Begin active project execution.
          </p>

          {(isAssignee || isPM) && (
            <PrimaryBtn
              onClick={onStartWork}
              disabled={busy}
              busy={busy}
              className="w-full h-10 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold shadow-xs"
            >
              ▶ Start Active Work
            </PrimaryBtn>
          )}
        </div>
      )}

      {canResolve && (
        <div className="rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-5 flex flex-col gap-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Work In Progress
            </span>
            <span className="w-2 h-2 rounded-full bg-[#4f46e5] animate-pulse" />
          </div>

          <p className="text-[13px] text-[#475569] leading-relaxed">
            Specialist is actively completing deliverables.
          </p>

          {(isAssignee || isPM) && (
            <PrimaryBtn
              onClick={onResolve}
              disabled={busy}
              busy={busy}
              className="w-full h-10 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold shadow-xs"
            >
              ✓ Mark as Resolved
            </PrimaryBtn>
          )}
        </div>
      )}

      {/* ── PM Specialist Allocation Control ── */}
      {isPM && (
        <div className="pt-2 flex flex-col gap-3.5">
          <div>
            <label htmlFor="select-assignee" className="block text-[12.5px] font-bold text-[#0f172a] mb-1">
              {request.assignment?.assignee ? 'Reassign Specialist' : 'Assign Specialist'}
            </label>
            <p className="text-[12.5px] text-[#64748b] mb-3 leading-relaxed">
              Select team member responsible for this client requirement.
            </p>

            {members.length > 0 ? (
              <select
                id="select-assignee"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={busy}
                className="w-full h-10 px-3.5 rounded-lg border border-[#cbd5e1] bg-white text-[13px] font-medium text-[#0f172a] hover:border-[#94a3b8] focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {cleanSpecialistLabel(m)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[12px] text-[#64748b]">Loading team members...</p>
            )}
          </div>

          {hasChangedAssignee && (
            <PrimaryBtn
              onClick={() => {
                if (selectedUserId) onAssign(selectedUserId)
              }}
              disabled={busy || !selectedUserId || selectedUserId === currentAssigneeId}
              busy={busy}
              className="w-full h-10 rounded-lg"
            >
              {request.assignment?.assignee
                ? `Confirm Reassignment to ${targetMemberName}`
                : `Assign to ${targetMemberName}`}
            </PrimaryBtn>
          )}
        </div>
      )}
    </div>
  )
}
