import { useEffect, useState } from 'react'
import type { Request, User } from '../../domain/ticket'
import { PrimaryBtn } from '../ui/buttons'
import { Section } from '../ui/layout'

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

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
      const firstAvailable =
        members.find((m) => m.id !== currentAssigneeId)?.id ?? members[0]?.id
      setSelectedUserId(firstAvailable ?? '')
    }
  }, [members, currentAssigneeId])

  const targetMemberName = members.find((m) => m.id === selectedUserId)?.name

  return (
    <Section title="Next Action" label="Operational actions">
      <div className="flex flex-col gap-4">
        {/* PM Action: Assign / Reassign */}
        {isPM && (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="select-assignee" className="block text-[11.5px] font-semibold text-[#475569] mb-1.5">
                {request.assignment?.assignee ? 'Reassign specialist' : 'Assign specialist'}
              </label>
              {members.length > 0 ? (
                <select
                  id="select-assignee"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={busy}
                  className="w-full h-9 px-3 rounded-md border border-[#cbd5e1] bg-white text-[13px] font-medium text-[#0f172a] focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a] outline-none transition-colors disabled:opacity-50"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[12px] text-[#94a3b8]">Loading team members...</p>
              )}
            </div>

            <PrimaryBtn
              onClick={() => {
                if (selectedUserId) onAssign(selectedUserId)
              }}
              disabled={busy || !selectedUserId || selectedUserId === currentAssigneeId}
              busy={busy}
              className="w-full"
            >
              {request.assignment?.assignee
                ? `Reassign to ${targetMemberName ?? 'Specialist'}`
                : `Assign to ${targetMemberName ?? 'Specialist'}`}
            </PrimaryBtn>
            <p className="text-[11.5px] text-[#64748b] leading-tight">
              Assignment initiates a fresh 24-hour acknowledgement SLA timer.
            </p>
          </div>
        )}

        {/* Assignee Action: Acknowledge */}
        {needsAck && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#f1f5f9]">
            {isAssignee ? (
              <PrimaryBtn
                onClick={onAcknowledge}
                disabled={busy}
                busy={busy}
                className="w-full bg-[#059669] hover:bg-[#047857]"
              >
                Acknowledge Request
              </PrimaryBtn>
            ) : (
              <div className="p-3 rounded-md bg-[#fffbeb] border border-[#fef3c7] text-[#92400e] text-[12px]">
                Awaiting acknowledgement from <strong>{request.assignment?.assignee?.name}</strong>.
              </div>
            )}
          </div>
        )}

        {/* Assignee Action: Start Work */}
        {canStartWork && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#f1f5f9]">
            {isAssignee || isPM ? (
              <PrimaryBtn
                onClick={onStartWork}
                disabled={busy}
                busy={busy}
                className="w-full"
              >
                Start Active Work
              </PrimaryBtn>
            ) : (
              <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] text-[12px]">
                Only the assigned specialist or PM can begin work.
              </div>
            )}
          </div>
        )}

        {/* Assignee Action: Resolve */}
        {canResolve && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[#f1f5f9]">
            {isAssignee || isPM ? (
              <PrimaryBtn
                onClick={onResolve}
                disabled={busy}
                busy={busy}
                className="w-full bg-[#059669] hover:bg-[#047857]"
              >
                Mark as Resolved
              </PrimaryBtn>
            ) : (
              <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] text-[12px]">
                Work in progress by <strong>{request.assignment?.assignee?.name}</strong>.
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
