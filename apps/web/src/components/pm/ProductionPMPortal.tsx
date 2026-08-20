import { useEffect, useState } from 'react'
import type { Request, User } from '../../domain/ticket'
import {
  acknowledgeRequest,
  assignRequest,
  listTeamMembers,
  resolveRequest,
  startWorkRequest,
} from '../../services/pmWorkflowApi'
import { DEV_ACTOR_KEY, getDevActor } from '../../services/devAuth'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useToast } from '../../hooks/useToast'
import { Avatar } from '../ui/layout'
import { NavItem } from '../ui/buttons'
import { CheckIcon, MenuIcon, QueueIcon, Spinner, XIcon } from '../ui/icons'
import { ErrorState, LoadingState } from '../ui/feedback'
import { RequestQueue } from './RequestQueue'
import { RequestDetail } from './RequestDetail'

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

export function ProductionPMPortal({
  user,
  requests,
  loading,
  error,
  retry,
  onOpen,
  onBack,
}: {
  user: User
  requests: Request[]
  loading: boolean
  error: string | null
  retry: () => void
  onOpen: (id: string) => Promise<Request>
  onBack: () => void
}) {
  const [selected, setSelected] = useState<DetailRequest | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const { toast, showToast } = useToast()

  useEscapeKey(mobileNavOpen, () => setMobileNavOpen(false))

  useEffect(() => {
    if (user.role === 'project_manager') {
      void listTeamMembers()
        .then(setMembers)
        .catch(() => setMembers([]))
    }
  }, [user.role])

  const openRequest = async (id: string) => {
    setDetailLoading(true)
    try {
      const detail = await onOpen(id)
      setSelected(detail as DetailRequest)
    } catch {
      showToast('Unable to load request details.', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const run = async (action: () => Promise<Request>, successMsg: string) => {
    setBusy(true)
    try {
      const updated = await action()
      setSelected(updated as DetailRequest)
      showToast(successMsg)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleBack = () => {
    setSelected(null)
    setMobileNavOpen(false)
  }

  /* Development identity switcher — isolated strictly for dev/testing */
  const devSwitcher =
    import.meta.env.DEV ? (
      <div className="mt-auto px-3 pt-4 border-t border-[var(--color-sidebar-border)]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#10b981]">
            Dev Identity
          </span>
          <select
            defaultValue={getDevActor()}
            onChange={(e) => {
              sessionStorage.setItem(DEV_ACTOR_KEY, e.target.value)
              location.reload()
            }}
            className="text-[11.5px] font-medium px-2 py-1 rounded bg-[rgba(255,255,255,0.06)] border border-[var(--color-sidebar-ring)] text-[var(--color-ink-faint)] focus:outline-none"
          >
            <option value="pm">Project Manager</option>
            <option value="internal">Rohan Mehta · Specialist</option>
          </select>
        </label>
      </div>
    ) : null

  /* ── Sidebar Navigation ── */
  const navContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-3 pt-1 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded bg-[#10b981] text-[#064e3b] grid place-items-center font-bold text-xs flex-none">
            N
          </span>
          <span className="text-white font-bold text-[14px] tracking-tight">Nvara Media</span>
        </div>
        <button
          className="lg:hidden p-1 rounded text-[var(--color-ink-faint)] hover:text-white transition-colors"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        >
          <XIcon />
        </button>
      </div>

      {/* Section Label */}
      <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-faint)]">
        Workspace
      </p>

      {/* Nav items */}
      <nav aria-label="Main navigation" className="space-y-0.5">
        <NavItem
          active={true}
          icon={<QueueIcon />}
          onClick={() => { setSelected(null); setMobileNavOpen(false) }}
        >
          Operations Queue
        </NavItem>
      </nav>

      <div className="flex-1" />

      {/* User Profile */}
      <div className="mx-3 mt-4 p-3 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--color-sidebar-ring)]">
        <div className="flex items-center gap-2.5">
          <Avatar user={user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-[12.5px] font-semibold truncate leading-tight">{user.name}</p>
            <p className="text-[11px] text-[var(--color-ink-faint)] leading-tight mt-0.5">
              {user.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
            </p>
          </div>
        </div>
      </div>

      {/* Back to portal home */}
      <button
        onClick={() => { onBack(); setMobileNavOpen(false) }}
        className="mx-3 mt-2.5 mb-1 py-1.5 text-[11.5px] font-medium text-center rounded text-[var(--color-ink-faint)] hover:text-white border border-[var(--color-sidebar-ring)] transition-colors"
      >
        Back to Home
      </button>

      {devSwitcher}
      <div className="h-3" />
    </div>
  )

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 flex-col pt-5 pb-3 z-20"
        style={{
          width: 'var(--sidebar-w)',
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
            className="relative flex flex-col w-[260px] max-w-[85vw] pt-5 pb-3 z-10 animate-slide-in-left"
            style={{
              background: 'var(--color-sidebar)',
              borderRight: '1px solid var(--color-sidebar-border)',
            }}
          >
            {navContent}
          </aside>
        </div>
      )}

      {/* ── Main Canvas ── */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[240px]">
        {/* Topbar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 sm:px-10 bg-white"
          style={{
            height: 'var(--topbar-h)',
            borderBottom: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 -ml-1 rounded text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>

            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-[13px]">
                <li>
                  <button
                    onClick={() => setSelected(null)}
                    className="font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
                  >
                    Operations Queue
                  </button>
                </li>
                {selected && (
                  <>
                    <li aria-hidden="true" className="text-[#cbd5e1]">/</li>
                    <li>
                      <span className="font-semibold text-[#0f172a] font-mono text-[12px]">
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
              className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-none ${
                toast.kind === 'error' ? 'bg-[#e11d48]' : 'bg-[#059669]'
              }`}
            >
              {toast.kind === 'error' ? <XIcon /> : <CheckIcon size={10} />}
            </span>
            {toast.text}
          </div>
        )}

        {/* Content View Router */}
        <main className="flex-1">
          {loading ? (
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
              busy={busy}
              onBack={handleBack}
              onAssign={(assigneeUserId) =>
                run(
                  () => assignRequest(selected.id, assigneeUserId, selected.version),
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
            />
          ) : (
            <RequestQueue requests={requests} onOpen={openRequest} />
          )}
        </main>
      </div>
    </div>
  )
}
