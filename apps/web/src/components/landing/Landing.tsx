import { ArrowRightIcon } from '../ui/icons'

export type ActivePortal = 'landing' | 'client' | 'pm' | 'tracker'

export function Landing({ onPortal }: { onPortal: (p: ActivePortal) => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f5] text-[#0b131b]">
      {/* ── Topbar ── */}
      <header className="h-16 border-b border-[#e2e8e5] bg-white px-6 sm:px-12 flex items-center justify-between sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0b131b] text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            N
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[15px] tracking-tight text-[#0b131b] leading-tight">
              Nvara Media
            </span>
            <span className="text-[11px] font-medium text-[#64748b] leading-tight">
              Service Operations Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f1f5f9] border border-[#e2e8f0]">
          <span className="w-2 h-2 rounded-full bg-[#059669]" aria-hidden="true" />
          <span className="text-[12px] font-medium text-[#334155]">All Systems Operational</span>
        </div>
      </header>

      {/* ── Main Canvas ── */}
      <main className="flex-1 flex flex-col justify-center max-w-[1120px] w-full mx-auto px-6 sm:px-12 py-12 sm:py-16">
        {/* Headline & Context */}
        <div className="max-w-[680px] mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#ecfdf5] border border-[#d1fae5] text-[#065f46] text-[12px] font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            Enterprise Request Management &amp; SLA Tracking
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-extrabold tracking-tight leading-[1.18] text-[#0f172a] mb-4">
            Client requests, SLAs, and escalations in one workspace.
          </h1>
          <p className="text-[15.5px] leading-relaxed text-[#475569]">
            Submit new project requirements with durable tracking codes, manage team allocations, and enforce 24-hour acknowledgement SLA commitments.
          </p>
        </div>

        {/* Portal Gateways — 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-12">
          {/* Gateway 1: Client Portal */}
          <button
            type="button"
            onClick={() => onPortal('client')}
            className="group text-left bg-white rounded-xl border border-[#e2e8f0] p-7 transition-all duration-150 hover:border-[#94a3b8] hover:shadow-md focus-visible:outline-2 flex flex-col justify-between cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#ecfdf5] text-[#059669] border border-[#d1fae5] flex items-center justify-center mb-5 group-hover:bg-[#059669] group-hover:text-white transition-colors">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>

              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[16px] font-bold text-[#0f172a] tracking-tight group-hover:text-[#059669] transition-colors">
                  Client Request Portal
                </h2>
                <span className="text-[11px] font-semibold text-[#059669] bg-[#ecfdf5] px-2 py-0.5 rounded-full border border-[#d1fae5]">
                  Public
                </span>
              </div>

              <p className="text-[13px] text-[#475569] leading-relaxed mb-5">
                Submit marketing, SEO, or media production requirements and receive a verifiable reference code.
              </p>
            </div>

            <div className="pt-3.5 border-t border-[#f1f5f9] flex items-center justify-between text-[13px] font-semibold text-[#059669] group-hover:text-[#047857]">
              <span>Submit a new client request</span>
              <span className="transition-transform group-hover:translate-x-1.5"><ArrowRightIcon size={15} /></span>
            </div>
          </button>

          {/* Gateway 2: Track Request */}
          <button
            type="button"
            onClick={() => onPortal('tracker')}
            className="group text-left bg-white rounded-xl border border-[#e2e8f0] p-7 transition-all duration-150 hover:border-[#94a3b8] hover:shadow-md focus-visible:outline-2 flex flex-col justify-between cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#fffbeb] text-[#d97706] border border-[#fde68a] flex items-center justify-center mb-5 group-hover:bg-[#d97706] group-hover:text-white transition-colors">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[16px] font-bold text-[#0f172a] tracking-tight group-hover:text-[#d97706] transition-colors">
                  Track Your Request
                </h2>
                <span className="text-[11px] font-semibold text-[#d97706] bg-[#fffbeb] px-2 py-0.5 rounded-full border border-[#fde68a]">
                  Status
                </span>
              </div>

              <p className="text-[13px] text-[#475569] leading-relaxed mb-5">
                Enter your tracking reference to see the current status and progress of a submitted request.
              </p>
            </div>

            <div className="pt-3.5 border-t border-[#f1f5f9] flex items-center justify-between text-[13px] font-semibold text-[#d97706] group-hover:text-[#b45309]">
              <span>Track request status</span>
              <span className="transition-transform group-hover:translate-x-1.5"><ArrowRightIcon size={15} /></span>
            </div>
          </button>

          {/* Gateway 3: PM Workspace */}
          <button
            type="button"
            onClick={() => onPortal('pm')}
            className="group text-left bg-white rounded-xl border border-[#e2e8f0] p-7 transition-all duration-150 hover:border-[#94a3b8] hover:shadow-md focus-visible:outline-2 flex flex-col justify-between cursor-pointer"
            style={{ boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#eef2ff] text-[#4f46e5] border border-[#e0e7ff] flex items-center justify-center mb-5 group-hover:bg-[#4f46e5] group-hover:text-white transition-colors">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>

              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[16px] font-bold text-[#0f172a] tracking-tight group-hover:text-[#4f46e5] transition-colors">
                  Operations Workspace
                </h2>
                <span className="text-[11px] font-semibold text-[#4f46e5] bg-[#eef2ff] px-2 py-0.5 rounded-full border border-[#e0e7ff]">
                  Internal
                </span>
              </div>

              <p className="text-[13px] text-[#475569] leading-relaxed mb-5">
                Manage operational queue, assign specialists, monitor SLA timers, and resolve escalated requests.
              </p>
            </div>

            <div className="pt-3.5 border-t border-[#f1f5f9] flex items-center justify-between text-[13px] font-semibold text-[#4f46e5] group-hover:text-[#3730a3]">
              <span>Sign in to operations workspace</span>
              <span className="transition-transform group-hover:translate-x-1.5"><ArrowRightIcon size={15} /></span>
            </div>
          </button>
        </div>


        {/* Operational Guardrails Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[#e2e8f0] pt-8">
          {[
            {
              title: '24-Hour SLA Commitment',
              desc: 'Background worker monitors acknowledgement deadlines and records automatic escalations on breach.',
            },
            {
              title: 'Immutable Audit Trail',
              desc: 'Every assignment, acknowledgement, status change, and worker action is permanently logged.',
            },
            {
              title: 'Optimistic Concurrency',
              desc: 'Strict version locking prevents overwriting simultaneous updates across concurrent team operations.',
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-1.5 bg-white p-5 rounded-lg border border-[#e2e8f0] shadow-xs">
              <span className="text-[13px] font-bold text-[#0f172a]">{item.title}</span>
              <span className="text-[12.5px] text-[#64748b] leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#e2e8f0] bg-white py-5 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12.5px] text-[#64748b]">
        <span>&copy; 2026 Nvara Media Client Operations</span>
        <span>Enterprise Production System</span>
      </footer>
    </div>
  )
}
