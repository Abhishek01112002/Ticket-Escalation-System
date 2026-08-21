/**
 * RequestQueue — FAANG-grade operations queue with advanced multi-filter,
 * role-specific default views, and high-density enterprise table.
 *
 * Filter capabilities:
 *  - Status tabs: All / Needs Ack / In Progress / Escalated / Resolved
 *  - Service Domain dropdown (8 domains)
 *  - Urgency dropdown (Flexible / Soon / Time Sensitive)
 *  - SLA Status: Healthy / Near Breach / Breached
 *  - Date Range: Last 7d / 30d / 90d / All Time
 *  - Full-text search: requirement + client + reference (client-side)
 *  - "Assigned to Me" toggle for Specialists (first-class filter)
 *  - Active filter count badge + "Clear All" chip
 *  - Server-side filters (domain, urgency, slaStatus, dateFrom/dateTo, assigneeId)
 *    are hoisted up to ProductionPMPortal which re-fetches via listPmRequests().
 *  - Client-side filters (status tab, search) applied locally on fetched data.
 */

import { useEffect, useRef, useState } from 'react'
import type { Request, RequestFilters, ServiceDomain, TeamMemberCapacity } from '../../domain/ticket'
import { DEFAULT_FILTERS, SERVICE_DOMAIN_LABELS } from '../../domain/ticket'
import { formatDateTime, formatRemaining, getSlaSummary } from '../../domain/sla'
import { AttentionChip, EscalationDot, SlaCountdownBadge, StatusBadge } from '../ui/badges'
import { Avatar } from '../ui/layout'
import { EmptyQueue } from '../ui/feedback'

// ── Constants ─────────────────────────────────────────────────────────────────

const URGENCY_LABELS: Record<string, string> = {
  flexible:      'Flexible',
  soon:          'Soon',
  time_sensitive: 'Time Sensitive',
}

const SLA_STATUS_LABELS: Record<string, string> = {
  healthy:     'Healthy',
  near_breach: 'Near Breach (< 4h)',
  breached:    'Breached',
}

const DATE_RANGES: { label: string; days: number | null }[] = [
  { label: 'All Time',   days: null },
  { label: 'Last 7d',   days: 7    },
  { label: 'Last 30d',  days: 30   },
  { label: 'Last 90d',  days: 90   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanName(name?: string): string {
  if (!name) return ''
  return String(name).replace(/^Demo\s+/i, '')
}

function dateRangeFromDays(days: number | null): { dateFrom: string | null; dateTo: string | null } {
  if (!days) return { dateFrom: null, dateTo: null }
  const from = new Date()
  from.setDate(from.getDate() - days)
  return { dateFrom: from.toISOString(), dateTo: null }
}

function countActiveFilters(filters: RequestFilters): number {
  return Object.values(filters).filter(v => v !== null && v !== undefined && v !== '').length
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RequestQueue({
  requests,
  currentUserId,
  isPM,
  activeFilters,
  teamMembers = [],
  onFiltersChange,
  onOpen,
  onInlineAssign,
}: {
  requests: Request[]
  currentUserId: string
  isPM: boolean
  activeFilters: RequestFilters
  teamMembers?: TeamMemberCapacity[]
  onFiltersChange: (filters: RequestFilters) => void
  onOpen: (id: string) => void
  onInlineAssign?: (reference: string, assigneeUserId: string, expectedVersion: number) => Promise<void>
}) {
  // ── Local UI state ─────────────────────────────────────────────────────────
  type StatusTab = 'all' | 'needs_ack' | 'escalated' | 'in_progress' | 'resolved'
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [search, setSearch]       = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<number | null>(null)
  const [pageSize, setPageSize]   = useState<number>(7)
  const [page, setPage]           = useState<number>(1)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Keyboard shortcut: / to focus search ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Reset page on any filter change ───────────────────────────────────────
  useEffect(() => { setPage(1) }, [statusTab, search, pageSize, activeFilters])

  // ── Count buckets for status tabs ─────────────────────────────────────────
  // ── Multi-criteria filter pipeline (Domain, Urgency, SLA Status, Date, Assignee, Status, Search) ──
  const baseFiltered = requests.filter(r => {
    // 1. Assignee Filter
    if (activeFilters.assigneeId === 'me') {
      const isAssigned =
        r.assignment?.assignee?.id === currentUserId ||
        (r as any).currentResponsibility?.id === currentUserId ||
        (r as any).assigneeId === currentUserId
      if (!isAssigned) return false
    } else if (activeFilters.assigneeId) {
      const matchesAssignee =
        r.assignment?.assignee?.id === activeFilters.assigneeId ||
        (r as any).currentResponsibility?.id === activeFilters.assigneeId ||
        (r as any).assigneeId === activeFilters.assigneeId
      if (!matchesAssignee) return false
    }

    // 2. Service Domain Filter
    if (activeFilters.domain && r.serviceDomain !== activeFilters.domain) {
      return false
    }

    // 3. Urgency Filter
    if (activeFilters.urgency) {
      const urg = r.clientUrgency || (r as any).urgency
      if (urg !== activeFilters.urgency) return false
    }

    // 4. SLA Status Filter
    if (activeFilters.slaStatus) {
      const sla = getSlaSummary(r)
      if (activeFilters.slaStatus === 'healthy' && (sla.state === 'breached' || sla.state === 'escalated')) {
        return false
      }
      if (activeFilters.slaStatus === 'near_breach' && !(sla.remainingMs <= 4 * 60 * 60 * 1000 && sla.remainingMs > 0 && r.workflowStatus !== 'resolved')) {
        return false
      }
      if (activeFilters.slaStatus === 'breached' && sla.state !== 'breached' && sla.state !== 'escalated') {
        return false
      }
    }

    // 5. Date Range Filter
    if (activeFilters.dateFrom) {
      const created = new Date(r.createdAt).getTime()
      const from = new Date(activeFilters.dateFrom).getTime()
      if (!isNaN(created) && !isNaN(from) && created < from) return false
    }
    if (activeFilters.dateTo) {
      const created = new Date(r.createdAt).getTime()
      const to = new Date(activeFilters.dateTo).getTime()
      if (!isNaN(created) && !isNaN(to) && created > to) return false
    }

    return true
  })

  // ── Status Tab Buckets (scoped to active criteria) ──
  const needsAck   = baseFiltered.filter(r => r.workflowStatus === 'awaiting_acknowledgement')
  const escalated  = baseFiltered.filter(r => Boolean(r.escalation) && r.workflowStatus !== 'resolved')
  const inProgress = baseFiltered.filter(r => r.workflowStatus === 'in_progress')
  const resolved   = baseFiltered.filter(r => r.workflowStatus === 'resolved')

  // ── Status Tab Filter ──
  const afterStatusFilter = baseFiltered.filter(r => {
    if (statusTab === 'needs_ack')  return r.workflowStatus === 'awaiting_acknowledgement'
    if (statusTab === 'escalated')  return Boolean(r.escalation) && r.workflowStatus !== 'resolved'
    if (statusTab === 'in_progress') return r.workflowStatus === 'in_progress'
    if (statusTab === 'resolved')   return r.workflowStatus === 'resolved'
    return true
  })

  // ── Full-text Search ──
  const searchLower = search.toLowerCase().trim()
  const filteredRequests = searchLower
    ? afterStatusFilter.filter(r =>
        r.id.toLowerCase().includes(searchLower) ||
        r.subject.toLowerCase().includes(searchLower) ||
        (r.description && r.description.toLowerCase().includes(searchLower)) ||
        r.client.name.toLowerCase().includes(searchLower) ||
        r.client.company.toLowerCase().includes(searchLower) ||
        SERVICE_DOMAIN_LABELS[r.serviceDomain]?.toLowerCase().includes(searchLower)
      )
    : afterStatusFilter

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalItems   = filteredRequests.length
  const totalPages   = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage  = Math.min(page, totalPages)
  const startIndex   = (currentPage - 1) * pageSize
  const endIndex     = Math.min(startIndex + pageSize, totalItems)
  const paginated    = filteredRequests.slice(startIndex, endIndex)

  // ── Server-side filter helpers ─────────────────────────────────────────────
  const serverFilterCount = countActiveFilters(activeFilters)

  const clearAllFilters = () => {
    onFiltersChange({ ...DEFAULT_FILTERS, assigneeId: isPM ? null : 'me' })
    setSelectedDateRange(null)
    setSearch('')
    setStatusTab('all')
    setPage(1)
  }

  const isAssignedToMe = activeFilters.assigneeId === 'me'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1440px] w-full mx-auto px-6 sm:px-12 py-8 text-[#0b131b]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-[#e2e8e5]">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[22px] font-bold tracking-tight text-[#0b131b]">
              {isPM ? 'Operations Queue' : 'My Queue'}
            </h1>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#d1fae5]">
              {requests.length - resolved.length} active · {requests.length} total
            </span>
          </div>
          <p className="text-[13.5px] text-[#5a6e7f]">
            {isPM
              ? 'Manage client requests, SLA compliance windows, and specialist assignments.'
              : 'Your assigned tickets and active work items.'}
          </p>
        </div>

        {/* Operational Attention Signals */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-[#8da0b0] mr-1 hidden sm:inline">Status:</span>
          {escalated.length > 0 && <AttentionChip count={escalated.length} label="Escalated" color="rose" />}
          {needsAck.length > 0   && <AttentionChip count={needsAck.length}  label="Awaiting Ack" color="amber" />}
          {inProgress.length > 0 && <AttentionChip count={inProgress.length} label="In Progress" color="blue" />}
          {escalated.length === 0 && needsAck.length === 0 && inProgress.length === 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#ecfdf5] border border-[#d1fae5] text-[#065f46]">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              All Commitments On Track
            </span>
          )}
        </div>
      </div>

      {/* ── Status Tabs + Page Size ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {([
            { key: 'all',        label: 'All Requests',  count: requests.length   },
            { key: 'needs_ack',  label: 'Awaiting Ack',  count: needsAck.length   },
            { key: 'escalated',  label: 'Escalated',     count: escalated.length  },
            { key: 'in_progress',label: 'In Progress',   count: inProgress.length },
            { key: 'resolved',   label: 'Resolved',      count: resolved.length   },
          ] as { key: StatusTab; label: string; count: number }[]).map(tab => {
            const active = statusTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={`px-3.5 py-2 text-[13px] font-medium rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer select-none ${
                  active
                    ? 'bg-[#0b131b] text-white font-bold shadow-xs'
                    : 'bg-white text-[#5a6e7f] hover:text-[#0b131b] hover:bg-[#f8faf9] border border-[#e2e8e5]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${active ? 'bg-[rgba(16,185,129,0.2)] text-[#10b981] font-bold' : 'bg-[#edf0ee] text-[#5a6e7f]'}`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2.5 text-[12.5px] text-[#5a6e7f]">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            className="h-8 px-2.5 rounded-lg border border-[#cbd5d0] bg-white text-[12.5px] font-medium text-[#0b131b] focus:border-[#059669] outline-none cursor-pointer shadow-2xs"
          >
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={21}>21</option>
          </select>
        </div>
      </div>

      {/* ── Advanced Filter Bar ──────────────────────────────────────────────── */}
      <div className="mb-5 bg-white rounded-2xl border border-[#e2e8e5] shadow-xs overflow-hidden">
        {/* Filter Topbar */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f1f5f9] flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search requests, clients… (/)"
              className="w-full h-8.5 pl-8 pr-3 rounded-lg border border-[#e2e8e5] bg-[#f8faf9] text-[13px] text-[#0b131b] placeholder-[#94a3b8] focus:border-[#059669] focus:bg-white outline-none transition-all"
            />
          </div>

          {/* "Assigned to Me" toggle — always visible for Specialists; optional for PM */}
          <button
            type="button"
            onClick={() => onFiltersChange({ ...activeFilters, assigneeId: isAssignedToMe ? null : 'me' })}
            className={`h-8.5 px-3.5 rounded-lg text-[12.5px] font-semibold border transition-all cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
              isAssignedToMe
                ? 'bg-[#0f172a] text-white border-[#0f172a]'
                : 'bg-white text-[#5a6e7f] border-[#e2e8e5] hover:border-[#94a3b8]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isAssignedToMe ? 'bg-[#10b981]' : 'bg-[#cbd5d0]'}`} />
            My Tickets
          </button>

          {/* Expand/Collapse advanced filters */}
          <button
            type="button"
            onClick={() => setFiltersExpanded(v => !v)}
            className={`h-8.5 px-3.5 rounded-lg text-[12.5px] font-semibold border transition-all cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
              serverFilterCount > 0
                ? 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
                : 'bg-white text-[#5a6e7f] border-[#e2e8e5] hover:border-[#94a3b8]'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filters
            {serverFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#059669] text-white text-[10px] font-bold flex items-center justify-center">
                {serverFilterCount}
              </span>
            )}
            <span className="text-[10px] opacity-60">{filtersExpanded ? '▲' : '▼'}</span>
          </button>

          {/* Clear all button */}
          {(serverFilterCount > 0 || search || statusTab !== 'all') && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="h-8.5 px-3.5 rounded-lg text-[12.5px] font-semibold text-[#e11d48] border border-[#ffe4e6] bg-[#fff1f2] hover:bg-[#ffe4e6] transition-colors cursor-pointer select-none whitespace-nowrap"
            >
              ✕ Clear All
            </button>
          )}
        </div>

        {/* Expanded Advanced Filters Row */}
        {filtersExpanded && (
          <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap bg-[#fafbfa] border-b border-[#f1f5f9]">

            {/* Service Domain */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Domain</label>
              <select
                value={activeFilters.domain ?? ''}
                onChange={e => onFiltersChange({ ...activeFilters, domain: (e.target.value as ServiceDomain) || null })}
                className="h-8.5 px-2.5 pr-7 rounded-lg border border-[#e2e8e5] bg-white text-[12.5px] font-medium text-[#0b131b] focus:border-[#059669] outline-none cursor-pointer shadow-2xs"
              >
                <option value="">All Domains</option>
                {Object.entries(SERVICE_DOMAIN_LABELS).map(([slug, label]) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>

            {/* Urgency */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Urgency</label>
              <select
                value={activeFilters.urgency ?? ''}
                onChange={e => onFiltersChange({ ...activeFilters, urgency: (e.target.value as any) || null })}
                className="h-8.5 px-2.5 pr-7 rounded-lg border border-[#e2e8e5] bg-white text-[12.5px] font-medium text-[#0b131b] focus:border-[#059669] outline-none cursor-pointer shadow-2xs"
              >
                <option value="">All Urgencies</option>
                {Object.entries(URGENCY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* SLA Status */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">SLA Status</label>
              <select
                value={activeFilters.slaStatus ?? ''}
                onChange={e => onFiltersChange({ ...activeFilters, slaStatus: e.target.value || null })}
                className="h-8.5 px-2.5 pr-7 rounded-lg border border-[#e2e8e5] bg-white text-[12.5px] font-medium text-[#0b131b] focus:border-[#059669] outline-none cursor-pointer shadow-2xs"
              >
                <option value="">All SLA States</option>
                {Object.entries(SLA_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Date Range</label>
              <div className="flex items-center gap-1">
                {DATE_RANGES.map(({ label, days }) => {
                  const active = selectedDateRange === days
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setSelectedDateRange(days)
                        const { dateFrom, dateTo } = dateRangeFromDays(days)
                        onFiltersChange({ ...activeFilters, dateFrom, dateTo })
                      }}
                      className={`h-8.5 px-2.5 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer select-none whitespace-nowrap ${
                        active
                          ? 'bg-[#0b131b] text-white border-[#0b131b]'
                          : 'bg-white text-[#5a6e7f] border-[#e2e8e5] hover:border-[#94a3b8] hover:text-[#0b131b]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips summary */}
        {serverFilterCount > 0 && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-[#f8faf9] flex-wrap">
            <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Active:</span>
            {activeFilters.domain && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                🏢 {SERVICE_DOMAIN_LABELS[activeFilters.domain as ServiceDomain] ?? activeFilters.domain}
                <button type="button" onClick={() => onFiltersChange({ ...activeFilters, domain: null })} className="text-[#0369a1] hover:text-[#0284c7] font-bold cursor-pointer">✕</button>
              </span>
            )}
            {activeFilters.urgency && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#fef9c3] text-[#854d0e] border border-[#fde68a]">
                ⚡ {URGENCY_LABELS[activeFilters.urgency] ?? activeFilters.urgency}
                <button type="button" onClick={() => onFiltersChange({ ...activeFilters, urgency: null })} className="text-[#854d0e] hover:text-[#a16207] font-bold cursor-pointer">✕</button>
              </span>
            )}
            {activeFilters.slaStatus && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#fff1f2] text-[#9f1239] border border-[#ffe4e6]">
                🔴 {SLA_STATUS_LABELS[activeFilters.slaStatus] ?? activeFilters.slaStatus}
                <button type="button" onClick={() => onFiltersChange({ ...activeFilters, slaStatus: null })} className="text-[#9f1239] hover:text-[#be123c] font-bold cursor-pointer">✕</button>
              </span>
            )}
            {activeFilters.assigneeId === 'me' && isPM && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                👤 My Tickets
                <button type="button" onClick={() => onFiltersChange({ ...activeFilters, assigneeId: null })} className="text-[#166534] hover:text-[#15803d] font-bold cursor-pointer">✕</button>
              </span>
            )}
            {selectedDateRange && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                📅 Last {selectedDateRange}d
                <button type="button" onClick={() => { setSelectedDateRange(null); onFiltersChange({ ...activeFilters, dateFrom: null, dateTo: null }) }} className="text-[#475569] hover:text-[#334155] font-bold cursor-pointer">✕</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Results count when filtering ─────────────────────────────────────── */}
      {(serverFilterCount > 0 || search || statusTab !== 'all') && filteredRequests.length !== requests.length && (
        <p className="mb-4 text-[12.5px] text-[#64748b] font-medium">
          Showing <strong className="text-[#0b131b]">{filteredRequests.length}</strong> matching request{filteredRequests.length !== 1 ? 's' : ''} of {requests.length} total
        </p>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      {filteredRequests.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="bg-white rounded-2xl border border-[#e2e8e5] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-[#f8faf9] border-b border-[#e2e8e5] text-[11px] font-bold uppercase tracking-wider text-[#5a6e7f]">
                  <th scope="col" className="px-6 py-3.5 w-[26%]">Request</th>
                  <th scope="col" className="px-5 py-3.5 w-[18%]">Client Organization</th>
                  <th scope="col" className="px-4 py-3.5 w-[14%]">Service Area</th>
                  <th scope="col" className="px-4 py-3.5 w-[15%]">Specialist Owner</th>
                  <th scope="col" className="px-4 py-3.5 w-[13%]">Status</th>
                  <th scope="col" className="px-5 py-3.5 w-[14%]">SLA Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ef]">
                {paginated.map(req => (
                  <RequestRow
                    key={req.id}
                    request={req}
                    isPM={isPM}
                    teamMembers={teamMembers}
                    onInlineAssign={onInlineAssign}
                    onOpen={onOpen}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Footer ────────────────────────────────────────────── */}
          <div className="px-6 py-4 bg-[#f8faf9] border-t border-[#e2e8e5] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px]">
            <span className="text-[#5a6e7f] text-[12.5px] font-medium">
              Showing <strong className="text-[#0b131b] font-bold">{startIndex + 1}–{endIndex}</strong> of <strong className="text-[#0b131b] font-bold">{totalItems}</strong> requests
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8.5 px-3 rounded-lg border border-[#cbd5d0] bg-white text-[#2c3e50] font-medium hover:bg-[#f4f6f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-2xs"
                aria-label="Previous page"
              >
                <span>‹</span><span className="hidden sm:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  // Smart page chip rendering: show max 7 pages with ellipsis
                  const chips: (number | '…')[] = []
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) chips.push(i)
                  } else {
                    chips.push(1)
                  }
                  return chips.map((chip, idx) =>
                    chip === '…' ? (
                      <span key={`ellipsis-${idx}`} className="w-8.5 text-center text-[12px] text-[#94a3b8]">…</span>
                    ) : (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setPage(chip)}
                        className={`w-8.5 h-8.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer select-none flex items-center justify-center ${
                          chip === currentPage
                            ? 'bg-[#0b131b] text-white shadow-xs'
                            : 'bg-white border border-[#cbd5d0] text-[#5a6e7f] hover:bg-[#f4f6f5] hover:text-[#0b131b]'
                        }`}
                      >
                        {chip}
                      </button>
                    )
                  )
                })()}
              </div>

              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8.5 px-3 rounded-lg border border-[#cbd5d0] bg-white text-[#2c3e50] font-medium hover:bg-[#f4f6f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-2xs"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span><span>›</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── InlineAssignPopover ───────────────────────────────────────────────────────

function InlineAssignPopover({
  request,
  teamMembers,
  onAssign,
  onClose,
}: {
  request: Request
  teamMembers: TeamMemberCapacity[]
  onAssign: (assigneeUserId: string) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const filtered = teamMembers.filter(
    m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = async (memberId: string) => {
    setLoading(true)
    try {
      await onAssign(memberId)
      onClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div
      ref={popoverRef}
      onClick={e => e.stopPropagation()}
      className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white rounded-xl shadow-xl border border-[#cbd5e1] p-2.5 text-left animate-fade-in font-sans"
    >
      <div className="flex items-center justify-between px-1.5 pb-2 mb-2 border-b border-[#f1f5f9]">
        <span className="text-[11.5px] font-bold text-[#0f172a] uppercase tracking-wider">
          Assign Specialist
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[#94a3b8] hover:text-[#0f172a] text-xs font-bold px-1 rounded hover:bg-[#f1f5f9] cursor-pointer"
        >
          ✕
        </button>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search specialists..."
        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] focus:border-[#059669] focus:ring-1 focus:ring-[#059669] outline-none text-[#0f172a] placeholder-[#94a3b8] mb-2 bg-[#f8fafc]"
      />

      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-[#94a3b8]">No specialists found</div>
        ) : (
          filtered.map(member => {
            const isCurrent = request.assignment?.assignee?.id === member.id
            const count = member.activeAssignmentsCount
            const countBadgeColor =
              count === 0
                ? 'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]'
                : count <= 3
                ? 'bg-[#fffbeb] text-[#92400e] border-[#fef3c7]'
                : 'bg-[#fff1f2] text-[#9f1239] border-[#ffe4e6]'

            return (
              <button
                key={member.id}
                type="button"
                disabled={loading}
                onClick={() => handleSelect(member.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-[#f0fdf4] border border-[#bbf7d0]'
                    : 'hover:bg-[#f8fafc] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar user={{ name: cleanName(member.name) }} size="xs" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-[#0f172a] block truncate">
                      {cleanName(member.name)}
                    </span>
                    <span className="text-[10.5px] text-[#64748b] block truncate">
                      {member.email}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${countBadgeColor} flex-none ml-2`}
                  title={`${count} active tickets`}
                >
                  {count} active
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── RequestRow (FAANG-grade density with 1-Click Assignment & Live SLA) ────────

function RequestRow({
  request,
  isPM,
  teamMembers = [],
  onInlineAssign,
  onOpen,
}: {
  request: Request
  isPM?: boolean
  teamMembers?: TeamMemberCapacity[]
  onInlineAssign?: (reference: string, assigneeUserId: string, expectedVersion: number) => Promise<void>
  onOpen: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showAssignPopover, setShowAssignPopover] = useState(false)
  const isEscalated = Boolean(request.escalation) && request.workflowStatus !== 'resolved'

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onOpen(request.id)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(request.id) } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer transition-colors duration-100 focus-visible:bg-[#f4f6f5] select-none h-[64px]"
      style={{ background: hovered ? '#f8faf9' : isEscalated ? '#fffbfb' : '#ffffff' }}
    >
      <td className="px-6 py-3.5">
        <div className="flex items-start gap-3">
          {isEscalated && <EscalationDot />}
          <div className="min-w-0">
            <span className="font-mono text-[11.5px] font-bold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#d1fae5] inline-block leading-tight mb-1">
              {request.id}
            </span>
            <span className="text-[13.5px] font-semibold text-[#0b131b] block truncate max-w-[270px] leading-snug">
              {request.subject}
            </span>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-[13.5px] font-semibold text-[#0b131b] block truncate leading-tight">{request.client.company}</span>
        {request.client.name && <span className="text-[12px] text-[#5a6e7f] block truncate mt-0.5">{request.client.name}</span>}
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#edf0ee] text-[#2c3e50] text-[12px] font-medium border border-[#e2e8e5]">
          {SERVICE_DOMAIN_LABELS[request.serviceDomain]}
        </span>
      </td>
      <td className="px-4 py-3.5 relative">
        {isPM && teamMembers && teamMembers.length > 0 && request.workflowStatus !== 'resolved' ? (
          <div className="relative inline-block">
            {request.assignment?.assignee ? (
              <div className="flex items-center gap-2 group">
                <Avatar user={{ name: cleanName(request.assignment.assignee.name) }} size="xs" />
                <span className="text-[13px] font-medium text-[#0b131b] truncate max-w-[110px]">
                  {cleanName(request.assignment.assignee.name)}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setShowAssignPopover(!showAssignPopover)
                  }}
                  className="text-[11px] font-bold text-[#64748b] hover:text-[#059669] hover:bg-[#f1f5f9] px-1 py-0.5 rounded border border-transparent hover:border-[#cbd5e1] transition-all cursor-pointer"
                  title="Reassign specialist"
                >
                  ⇄
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setShowAssignPopover(!showAssignPopover)
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-semibold text-[#065f46] bg-[#ecfdf5] border border-dashed border-[#10b981] hover:bg-[#d1fae5] transition-colors cursor-pointer"
              >
                <span>+ Assign</span>
              </button>
            )}

            {showAssignPopover && (
              <InlineAssignPopover
                request={request}
                teamMembers={teamMembers}
                onAssign={async memberId => {
                  if (onInlineAssign) {
                    await onInlineAssign(request.id, memberId, request.version ?? 1)
                  }
                }}
                onClose={() => setShowAssignPopover(false)}
              />
            )}
          </div>
        ) : request.assignment?.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar user={{ name: cleanName(request.assignment.assignee.name) }} size="xs" />
            <span className="text-[13px] font-medium text-[#0b131b] truncate max-w-[130px]">
              {cleanName(request.assignment.assignee.name)}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-[#8da0b0] italic">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={request.workflowStatus} size="sm" />
      </td>
      <td className="px-5 py-3.5">
        <SlaCountdownBadge
          deadlineAt={request.assignment?.acknowledgementDeadline || request.sla?.deadlineAt}
          status={request.workflowStatus}
          acknowledgedAt={request.assignment?.acknowledgedAt || request.sla?.acknowledgedAt}
          size="sm"
        />
      </td>
    </tr>
  )
}

// ── Re-export SERVICE_DOMAIN_LABELS for RequestRow ────────────────────────────
// (already imported at top)
