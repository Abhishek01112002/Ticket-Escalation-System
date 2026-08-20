import { useEffect, useState } from 'react'
import type { Request, User } from '../../domain/ticket'
import {
  acknowledgeRequest,
  assignRequest,
  deleteRequest,
  listTeamMembers,
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

type DetailRequest = Request & { version: number }
type Member = { id: string; name: string; email: string }

function cleanName(name: string): string {
  return name.replace(/^Demo\s+/i, '')
}

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
  const [detailLoading, setDetailLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { toast, showToast } = useToast()

  useEscapeKey(mobileNavOpen || Boolean(selected), () => {
    if (mobileNavOpen) setMobileNavOpen(false)
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
      const full = await onOpen(id)
      setSelected(full as DetailRequest)
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

  const handleBack = () => {
    setSelected(null)
    setMobileNavOpen(false)
  }

  /* Development identity switcher — quiet footer utility */
  const devSwitcher =
    import.meta.env.DEV ? (
      <div className="pt-3 border-t border-[#18232e] flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#131f2b] text-[#94a3b8] border border-[#1e2d3d] flex-none">
          DEV
        </span>
        <select
          defaultValue={getDevActor()}
          onChange={(e) => {
            sessionStorage.setItem(DEV_ACTOR_KEY, e.target.value)
            location.reload()
          }}
          className="text-[11px] font-medium text-[#94a3b8] hover:text-white bg-transparent border-none outline-none cursor-pointer flex-1 truncate transition-colors"
          title="Switch dev actor"
        >
          <option value="pm" className="bg-[#0b131b] text-white">Project Manager</option>
          <option value="internal" className="bg-[#0b131b] text-white">Rohan Mehta (Specialist)</option>
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
        <nav aria-label="Main navigation">
          <NavItem
            active={true}
            icon={<QueueIcon />}
            onClick={() => {
              setSelected(null)
              setMobileNavOpen(false)
            }}
          >
            Operations Queue
          </NavItem>
        </nav>
      </div>

      {/* 3. Flexible Center Space */}
      <div className="flex-1" />

      {/* 4. Integrated Account & Environment Footer */}
      <div className="p-3 border-t border-[#18232e] space-y-3">
        {/* User Account Row */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors">
          <Avatar user={{ name: cleanName(user.name) }} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-slate-200 text-[12.5px] font-semibold truncate leading-tight">
              {cleanName(user.name)}
            </p>
            <p className="text-[11px] text-[#64748b] truncate leading-tight mt-0.5">
              {user.role === 'project_manager' ? 'Project Manager' : 'Specialist'}
            </p>
          </div>
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
                    onClick={() => setSelected(null)}
                    className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'text-[#64748b] hover:text-[#0f172a]'
                        : 'text-[#0f172a] font-semibold'
                    }`}
                  >
                    {selected && <ChevronLeft size={13} className="text-[#94a3b8]" />}
                    <span>Operations Queue</span>
                  </button>
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
              className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-none ${
                toast.kind === 'error' ? 'bg-[#e11d48]' : 'bg-[#059669]'
              }`}
            >
              {toast.kind === 'error' ? '✕' : '✓'}
            </span>
            {toast.text}
          </div>
        )}

        {/* Content View Router */}
        <main className="flex-1 w-full">
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
              onDelete={handleDelete}
            />
          ) : (
            <RequestQueue requests={requests} onOpen={openRequest} />
          )}
        </main>
      </div>
    </div>
  )
}
