import { useEffect, useState } from 'react'
import type { Request, User } from '../../domain/ticket'
import { Section } from '../ui/layout'
import { PrimaryBtn, SecondaryBtn } from '../ui/buttons'

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

export function ActionPanel({
  request,
  user: _user,
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
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? '')

  useEffect(() => {
    if (!assigneeId && members.length > 0) {
      setAssigneeId(members[0].id)
    }
  }, [members, assigneeId])

  return (
    <Section title="Actions" label="Available actions">
      <div className="flex flex-col gap-3">
        {/* PM: assign */}
        {isPM && (
          <div>
            <p
              className="text-[12.5px] font-semibold mb-2"
              style={{ color: 'var(--color-ink-secondary)' }}
            >
              Assign team member
            </p>
            {members.length > 0 ? (
              <>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-md px-3 py-2 text-[13px] font-medium mb-2"
                  style={{
                    border: '1px solid var(--color-border)',
                    background: 'white',
                    color: 'var(--color-ink)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                  aria-label="Select team member to assign"
                >
                  <option value="" disabled>
                    Select team member…
                  </option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <PrimaryBtn
                  disabled={busy || !assigneeId}
                  busy={busy}
                  onClick={() => assigneeId && onAssign(assigneeId)}
                >
                  {request.assignment?.assignee ? 'Reassign' : 'Assign'}
                </PrimaryBtn>
              </>
            ) : (
              <p className="text-[12.5px] italic" style={{ color: 'var(--color-ink-faint)' }}>
                Loading team members…
              </p>
            )}
            {/* Divider */}
            <div
              className="my-3"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            />
          </div>
        )}

        {/* Assignee: acknowledge */}
        {isAssignee && needsAck && (
          <div>
            <p
              className="text-[12px] mb-2"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              Confirm you've received this request and will begin working on it.
            </p>
            <PrimaryBtn busy={busy} disabled={busy} onClick={onAcknowledge}>
              Acknowledge request
            </PrimaryBtn>
          </div>
        )}

        {/* Assignee: start work */}
        {isAssignee && canStartWork && (
          <div>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-ink-muted)' }}>
              Acknowledgement recorded. Begin work when ready.
            </p>
            <PrimaryBtn busy={busy} disabled={busy} onClick={onStartWork}>
              Start work
            </PrimaryBtn>
          </div>
        )}

        {/* Assignee: resolve */}
        {isAssignee && canResolve && (
          <div>
            <p className="text-[12px] mb-2" style={{ color: 'var(--color-ink-muted)' }}>
              Mark as resolved once the client's request is complete.
            </p>
            <PrimaryBtn busy={busy} disabled={busy} onClick={onResolve}>
              Resolve request
            </PrimaryBtn>
          </div>
        )}

        {/* PM: acknowledge as PM */}
        {isPM && needsAck && (
          <SecondaryBtn busy={busy} disabled={busy} onClick={onAcknowledge}>
            Acknowledge as PM
          </SecondaryBtn>
        )}

        {!isPM && !isAssignee && (
          <p className="text-[12.5px] italic" style={{ color: 'var(--color-ink-faint)' }}>
            You are not the current assignee.
          </p>
        )}
      </div>
    </Section>
  )
}
