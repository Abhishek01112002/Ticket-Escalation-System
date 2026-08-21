import { useEffect, useState } from 'react'
import type { Request, RequestComment, RequestFilters, TeamMemberCapacity, User } from '../../domain/ticket'
import { DEFAULT_FILTERS } from '../../domain/ticket'
import {
  acknowledgeRequest,
  assignRequest,
  deleteRequest,
  listTeamMembers,
  listRequestComments,
  postRequestComment,
  resolveRequest,
  startWorkRequest,
} from '../../services/pmWorkflowApi'
import { DEV_ACTOR_KEY, getDevActor } from '../../services/devAuth'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useToast } from '../../hooks/useToast'
import { Avatar } from '../ui/layout'
import { NavItem } from '../ui/buttons'
import { ChevronLeft, MenuIcon, QueueIcon, Spinner, XIcon } from '../ui/icons'
import { ErrorState, LoadingState } from '../ui/feedback'
import { RequestQueue } from './RequestQueue'
import { RequestDetail } from './RequestDetail'
import { TeamManagement } from './TeamManagement'
import { ProfileModal } from './ProfileModal'
import { WhatsAppDispatchDrawer, type WhatsAppDispatchPayload } from './WhatsAppDispatchDrawer'

type DetailRequest = Request & { version: number }
type Member = TeamMemberCapacity

function cleanName(name?: string): string {
  if (!name) return ''
  return String(name).replace(/^Demo\s+/i, '')
}

export function ProductionPMPortal({
  user,
  requests,
  loading,
  error,
  retry,
  onOpen,
  onBack,
  onSignOut,
}: {
  user: User
  requests: Request[]
  loading: boolean
  error: string | null
  retry: () => void
  onOpen: (id: string) => Promise<Request>
  onBack: () => void
  onSignOut?: () => void
}) {
  const isPM = user.role === 'project_manager'

  const [currentView, setCurrentView]       = useState<'queue' | 'team'>('queue')
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [selected, setSelected]             = useState<DetailRequest | null>(null)
  const [detailLoading, setDetailLoading]   = useState(false)
  const [members, setMembers]               = useState<Member[]>([])
  const [busy, setBusy]                     = useState(false)
  const [mobileNavOpen, setMobileNavOpen]   = useState(false)
  const [comments, setComments]             = useState<RequestComment[]>([])
  const [whatsappDispatchPayload, setWhatsappDispatchPayload] = useState<WhatsAppDispatchPayload | null>(null)
  // Specialists default to "Assigned to Me"; PM defaults to no filter
  const [activeFilters, setActiveFilters]   = useState<RequestFilters>({
    ...DEFAULT_FILTERS,
    assigneeId: isPM ? null : 'me',
  })
  const { toast, showToast } = useToast()

  useEscapeKey(mobileNavOpen || Boolean(selected) || profileModalOpen || Boolean(whatsappDispatchPayload), () => {
    if (whatsappDispatchPayload) setWhatsappDispatchPayload(null)
    else if (profileModalOpen) setProfileModalOpen(false)
    else if (mobileNavOpen) setMobileNavOpen(false)
    else if (selected) setSelected(null)
  })

  useEffect(() => {
    let active = true
    listTeamMembers()
      .then((data) => {
        if (active) setMembers(data)
      })
      .catch(() => {
        if (active) setMembers([])
      })
    return () => {
      active = false
    }
  }, [])

  const openRequest = async (id: string) => {
    setDetailLoading(true)
    try {
      const data = await onOpen(id)
      setSelected(data as DetailRequest)
      const ticketComments = await listRequestComments(id)
      setComments(ticketComments)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open request.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const run = async (action: () => Promise<DetailRequest>, successMsg: string) => {
    setBusy(true)
    try {
      const updated = await action()
      setSelected(updated)
      retry()
      showToast(successMsg)
    } catch (err) {
      const errorWithStatus = err as Error & { status?: number }
      if (errorWithStatus?.status === 409) {
        showToast('This request was updated elsewhere. Reloading latest data...', 'error')
        if (selected) await openRequest(selected.id)
      } else {
        showToast(err instanceof Error ? err.message : 'Action failed.', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    try {
      await deleteRequest(id)
      setSelected(null)
      retry()
      showToast(`Request ${id} deleted successfully.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete request.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleInlineAssign = async (
    reference: string,
    assigneeUserId: string,
    expectedVersion: number
  ) => {
    try {
      await assignRequest(reference, assigneeUserId, expectedVersion)
      showToast('Specialist assigned successfully.', 'success')
      const assignedMember = members.find((m) => m.id === assigneeUserId)
      const targetReq = requests.find((r) => r.id === reference)
      if (assignedMember && targetReq) {
        setWhatsappDispatchPayload({
          request: {
            ...targetReq,
            assignment: {
              ...targetReq.assignment,
              assignee: {
                id: assignedMember.id,
                name: assignedMember.name,
                initials: assignedMember.name.slice(0, 2),
                role: 'team_member',
                team: 'Specialist team',
                phoneWhatsapp: assignedMember.phoneWhatsapp,
              },
            },
          },
          specialist: {
            id: assignedMember.id,
            name: assignedMember.name,
            email: assignedMember.email,
            phoneWhatsapp: assignedMember.phoneWhatsapp,
          },
        })
      }
      retry()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign specialist.', 'error')
    }
  }

  const handleBack = () => {
    setSelected(null)
    setMobileNavOpen(false)
  }

  /* Development identity switcher — quiet footer utility */
  const devSwitcher =
    import.meta.env.DEV ? (
      <div className="pt-2.5 border-t border-[#18293a] flex items-center gap-2 px-1">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#152332] text-[#38bdf8] border border-[#1e3a5f] flex-none">
          DEV
        </span>
        <select
          defaultValue={getDevActor()}
          onChange={(e) => {
            sessionStorage.setItem(DEV_ACTOR_KEY, e.target.value)
            location.reload()
          }}
          className="text-[11px] font-semibold text-slate-300 hover:text-white bg-[#101c28] border border-[#18293a] rounded-lg px-2 py-1 outline-none cursor-pointer flex-1 truncate transition-colors"
          title="Switch dev actor"
        >
          <option value="pm" className="bg-[#0b131b] text-white">PM Session</option>
          <option value="internal" className="bg-[#0b131b] text-white">Specialist Session</option>
        </select>
      </div>
    ) : null

  /* ── Sidebar Navigation Content (Single Coherent System) ── */
  const navContent = (
    <div className="flex flex-col h-full">
      {/* 1. Brand Identity Header */}
      <div className="px-4 py-4 border-b border-[#18232e] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded bg-[#10b981] text-[#064e3b] flex items-center justify-center font-bold text-[11.5px] flex-none shadow-xs">
            N
          </span>
          <div className="flex flex-col">
            <span className="text-white font-bold text-[13.5px] tracking-tight leading-tight">
              Nvara Media
            </span>
            <span className="text-[10.5px] font-medium text-[#64748b] leading-tight mt-0.5">
              Operations Workspace
            </span>
          </div>
        </div>
        <button
          className="lg:hidden p-1 rounded text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        >
          <XIcon />
        </button>
      </div>

      {/* 2. Workspace Navigation */}
      <div className="p-3 space-y-1">
        <p className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#475569]">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="space-y-1">
          <NavItem
            active={currentView === 'queue' && !selected}
            icon={<QueueIcon />}
            onClick={() => {
              setCurrentView('queue')
              setSelected(null)
              setMobileNavOpen(false)
            }}
          >
            {isPM ? 'Operations Queue' : 'My Queue'}
          </NavItem>

          {isPM && (
            <NavItem
              active={currentView === 'team'}
              icon={
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              onClick={() => {
                setCurrentView('team')
                setSelected(null)
                setMobileNavOpen(false)
              }}
            >
              Team Members
            </NavItem>
          )}
        </nav>
      </div>

      {/* 3. Flexible Center Space */}
      <div className="flex-1" />

      {/* 4. Integrated Account & Environment Footer */}
      <div className="p-3 border-t border-[#18232e] space-y-3">
        {/* User Account Row */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#101c28] border border-[#18293a]">
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer hover:opacity-85 transition-opacity"
            title="Account settings & change password"
          >
            <Avatar user={{ name: cleanName(user.name) }} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 text-[12.5px] font-semibold truncate leading-tight flex items-center gap-1.5">
                <span>{cleanName(user.name)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </p>
              <p className="text-[11px] text-[#64748b] truncate leading-tight mt-0.5">
                {user.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onSignOut || onBack}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-slate-200 hover:bg-[#152332] transition-colors cursor-pointer select-none flex-none"
            title="Sign out"
            aria-label="Sign out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>

        {/* Development Environment Selector */}
        {devSwitcher}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex bg-[#f4f6f5] text-[#0b131b]">
      {/* ── Desktop Sidebar (Fixed 236px Document Flow) ── */}
      <aside
        className="hidden lg:flex flex-col w-[236px] shrink-0 sticky top-0 h-screen z-20"
        style={{
          background: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-sidebar-border)',
        }}
      >
        {navContent}
      </aside>

      {/* ── Mobile Navigation Drawer ── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative flex flex-col w-[260px] max-w-[85vw] h-full z-10 animate-slide-in-left"
            style={{
              background: 'var(--color-sidebar)',
              borderRight: '1px solid var(--color-sidebar-border)',
            }}
          >
            {navContent}
          </aside>
        </div>
      )}

      {/* ── Main Canvas (100% Remaining Width) ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#f4f6f5]">
        {/* Topbar Navigation Shell */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 sm:px-10 bg-white h-14"
          style={{
            borderBottom: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded text-[#64748b] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>

            {/* Breadcrumb Navigation System */}
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-[13px]">
                <li>
                  <button
                    onClick={() => {
                      setSelected(null)
                      setCurrentView('queue')
                    }}
                    className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                      currentView === 'queue' && !selected
                        ? 'text-[#0f172a] font-semibold'
                        : 'text-[#64748b] hover:text-[#0f172a]'
                    }`}
                  >
                    <span>Operations</span>
                  </button>
                </li>
                <li aria-hidden="true" className="text-[#cbd5e1] font-mono">
                  /
                </li>
                <li>
                  <span className="font-semibold text-[#0f172a]">
                    {currentView === 'team' ? 'Team Management' : 'Operations Queue'}
                  </span>
                </li>
                {selected && (
                  <>
                    <li aria-hidden="true" className="text-[#cbd5e1] font-mono">
                      /
                    </li>
                    <li>
                      <span className="font-semibold text-[#0f172a] font-mono text-[12px] bg-[#f1f5f9] px-2 py-0.5 rounded border border-[#e2e8f0]">
                        {selected.id}
                      </span>
                    </li>
                  </>
                )}
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {loading && (
              <span className="text-[12px] text-[#64748b] flex items-center gap-1.5">
                <Spinner size={12} />
                Synchronizing...
              </span>
            )}

            {/* Seamless Portal Switcher in Header */}
            <button
              onClick={onBack}
              className="text-[12px] font-medium text-[#64748b] hover:text-[#0f172a] px-2.5 py-1 rounded border border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Return to client portal landing"
            >
              <ChevronLeft size={12} className="text-[#94a3b8]" />
              <span>Portal Home</span>
            </button>
          </div>
        </header>

        {/* Toast Notifications */}
        {toast && (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`fixed right-6 top-16 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg text-[13px] font-semibold shadow-lg animate-toast max-w-[380px] ${
              toast.kind === 'error'
                ? 'bg-[#fff1f2] border border-[#ffe4e6] text-[#9f1239]'
                : 'bg-white border border-[#e2e8f0] text-[#0f172a]'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-white flex-none ${
                toast.kind === 'error' ? 'bg-[#e11d48]' : 'bg-[#059669]'
              }`}
            >
              {toast.kind === 'error' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            {toast.text}
          </div>
        )}

        <main className="flex-1 w-full">
          {currentView === 'team' ? (
            <TeamManagement currentUser={user} showToast={showToast} />
          ) : loading ? (
            <LoadingState label="Loading queue data..." />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : detailLoading ? (
            <LoadingState label="Loading request details..." />
          ) : selected ? (
            <RequestDetail
              request={selected}
              user={user}
              members={members}
              comments={comments}
              busy={busy}
              onBack={handleBack}
              onAssign={(assigneeUserId) =>
                run(
                  async () => {
                    const updated = await assignRequest(selected.id, assigneeUserId, selected.version)
                    const assignedMember = members.find((m) => m.id === assigneeUserId)
                    if (assignedMember) {
                      setWhatsappDispatchPayload({
                        request: updated,
                        specialist: {
                          id: assignedMember.id,
                          name: assignedMember.name,
                          email: assignedMember.email,
                          phoneWhatsapp: assignedMember.phoneWhatsapp,
                        },
                      })
                    }
                    return updated
                  },
                  'Assignment saved. 24-hour acknowledgement window started.',
                )
              }
              onAcknowledge={() =>
                run(
                  () => acknowledgeRequest(selected.id, selected.version),
                  'Request acknowledged.',
                )
              }
              onStartWork={() =>
                run(
                  () => startWorkRequest(selected.id, selected.version),
                  'Active work started.',
                )
              }
              onResolve={() =>
                run(
                  () => resolveRequest(selected.id, selected.version),
                  'Request marked as resolved. Audit trail updated.',
                )
              }
              onDelete={handleDelete}
              onPostComment={async (reference, body) => {
                const comment = await postRequestComment(reference, body)
                return comment
              }}
              onOpenWhatsAppBriefing={() => {
                if (selected.assignment?.assignee) {
                  const member = members.find((m) => m.id === selected.assignment.assignee.id)
                  setWhatsappDispatchPayload({
                    request: selected,
                    specialist: {
                      id: selected.assignment.assignee.id,
                      name: selected.assignment.assignee.name,
                      email: member?.email,
                      phoneWhatsapp: member?.phoneWhatsapp || selected.assignment.assignee.phoneWhatsapp,
                    },
                  })
                }
              }}
            />
          ) : (
            <RequestQueue
              requests={requests}
              currentUserId={user.id}
              isPM={isPM}
              activeFilters={activeFilters}
              teamMembers={members}
              onFiltersChange={setActiveFilters}
              onOpen={openRequest}
              onInlineAssign={handleInlineAssign}
            />
          )}
        </main>
      </div>

      {/* Profile & Change Password Modal */}
      {profileModalOpen && (
        <ProfileModal user={user} onClose={() => setProfileModalOpen(false)} />
      )}

      {/* Smart Zero-Cost WhatsApp Dispatch Drawer */}
      {whatsappDispatchPayload && (
        <WhatsAppDispatchDrawer
          payload={whatsappDispatchPayload}
          onClose={() => setWhatsappDispatchPayload(null)}
        />
      )}
    </div>
  )
}

