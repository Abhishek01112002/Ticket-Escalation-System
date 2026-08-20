import { useState } from 'react'
import { ArrowRightIcon } from '../ui/icons'

export type ActivePortal = 'landing' | 'client' | 'pm'

export function Landing({ onPortal }: { onPortal: (p: ActivePortal) => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* ── Topbar ── */}
      <header className="h-14 border-b border-[#e2e8f0] bg-white px-6 sm:px-10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#0f172a] text-white flex items-center justify-center font-bold text-xs tracking-tight">
            N
          </div>
          <span className="font-bold text-[14px] tracking-tight text-[#0f172a]">
            Nvara Media
          </span>
          <span className="hidden sm:inline-block text-[11px] font-medium text-[#64748b] pl-2 border-l border-[#e2e8f0]">
            Request Management System
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#059669]" aria-hidden="true" />
          <span className="text-[12px] font-medium text-[#64748b]">Systems Operational</span>
        </div>
      </header>

      {/* ── Main Canvas ── */}
      <main className="flex-1 flex flex-col justify-center max-w-[1080px] w-full mx-auto px-6 sm:px-10 py-12 sm:py-20">
        {/* Headline & Architectural Context */}
        <div className="max-w-[640px] mb-12">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ecfdf5] border border-[#d1fae5] text-[#065f46] text-[11.5px] font-semibold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            Enterprise Service Operations
          </div>
          <h1 className="text-[32px] sm:text-[40px] font-extrabold tracking-tight leading-[1.15] text-[#0f172a] mb-3">
            Client requests, SLAs, and escalations in one workspace.
          </h1>
          <p className="text-[15px] leading-relaxed text-[#475569]">
            Submit new project requirements, track delivery workflows, and monitor operational SLA commitments with automated escalation tracking.
          </p>
        </div>

        {/* Dual Portal Gateways */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
          {/* Gateway 1: Client Portal */}
          <button
            onClick={() => onPortal('client')}
            className="group text-left bg-white rounded-xl border border-[#e2e8f0] p-7 transition-all duration-150 hover:border-[#cbd5e1] hover:shadow-md focus-visible:outline-2 flex flex-col justify-between"
            style={{ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#f1f5f9] text-[#0f172a] flex items-center justify-center mb-5 group-hover:bg-[#0f172a] group-hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[17px] font-bold text-[#0f172a] tracking-tight">
                  Client Request Intake
                </h2>
                <span className="text-[11px] font-semibold text-[#059669] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#d1fae5]">
                  Public Portal
                </span>
              </div>
              <p className="text-[13px] text-[#64748b] leading-relaxed mb-6">
                Submit marketing, development, SEO, or media production requirements and receive a durable reference code.
              </p>
            </div>

            <div className="pt-4 border-t border-[#f1f5f9] flex items-center justify-between text-[13px] font-semibold text-[#0f172a]">
              <span>Submit a new request</span>
              <span className="transition-transform group-hover:translate-x-1"><ArrowRightIcon size={14} /></span>
            </div>
          </button>

          {/* Gateway 2: PM Workspace */}
          <button
            onClick={() => onPortal('pm')}
            className="group text-left bg-[#0f172a] text-white rounded-xl border border-[#1e293b] p-7 transition-all duration-150 hover:bg-[#1e293b] hover:shadow-lg focus-visible:outline-2 flex flex-col justify-between"
            style={{ boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)' }}
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#1e293b] text-[#10b981] flex items-center justify-center mb-5 group-hover:bg-[#10b981] group-hover:text-[#064e3b] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[17px] font-bold text-white tracking-tight">
                  Project Manager Workspace
                </h2>
                <span className="text-[11px] font-semibold text-[#10b981] bg-[rgba(16,185,129,0.15)] px-2 py-0.5 rounded border border-[rgba(16,185,129,0.25)]">
                  Authorized
                </span>
              </div>
              <p className="text-[13px] text-[#94a3b8] leading-relaxed mb-6">
                Manage incoming queue, assign specialists, monitor 24-hour SLA timers, and resolve escalated requests.
              </p>
            </div>

            <div className="pt-4 border-t border-[#1e293b] flex items-center justify-between text-[13px] font-semibold text-[#10b981]">
              <span>Open management workspace</span>
              <span className="transition-transform group-hover:translate-x-1"><ArrowRightIcon size={14} /></span>
            </div>
          </button>
        </div>

        {/* Operational Guardrails & Trust Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#e2e8f0] pt-8">
          {[
            {
              title: '24-Hour SLA Protection',
              desc: 'Automated background worker tracks acknowledgement windows and triggers escalations.',
            },
            {
              title: 'Immutable Audit Trail',
              desc: 'Every assignment, status change, and worker event is permanently recorded in PostgreSQL.',
            },
            {
              title: 'Optimistic Concurrency',
              desc: 'Strict version locking prevents conflicting updates across concurrent team operations.',
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-1">
              <span className="text-[12.5px] font-bold text-[#0f172a]">{item.title}</span>
              <span className="text-[12px] text-[#64748b] leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e2e8f0] bg-white py-5 px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#94a3b8]">
        <span>(c) 2026 Nvara Media Client Operations</span>
        <span>Production Release v0.1.0</span>
      </footer>
    </div>
  )
}
