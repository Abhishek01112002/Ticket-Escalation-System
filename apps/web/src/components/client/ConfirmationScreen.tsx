import { useState } from 'react'
import type { SubmissionConfirmation } from '../../services/clientRequestApi'

export function ConfirmationScreen({
  request,
  onBack,
}: {
  request: SubmissionConfirmation
  onBack(): void
}) {
  const [copied, setCopied] = useState(false)

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(request.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* ── Topbar ── */}
      <header className="h-14 border-b border-[#e2e8f0] bg-white px-6 sm:px-10 flex items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#0f172a] text-white flex items-center justify-center font-bold text-xs">
            N
          </div>
          <span className="font-bold text-[14px] tracking-tight">Nvara Media</span>
        </div>
      </header>

      {/* ── Confirmation Main ── */}
      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="max-w-[540px] w-full bg-white rounded-xl border border-[#e2e8f0] p-8 sm:p-10 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#ecfdf5] text-[#059669] border border-[#d1fae5] flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <p className="text-[11.5px] font-bold uppercase tracking-wider text-[#059669] mb-1">
            Request Submitted
          </p>
          <h1 className="text-[24px] font-bold tracking-tight text-[#0f172a] mb-3">
            Your request has been received.
          </h1>
          <p className="text-[14px] text-[#475569] leading-relaxed mb-6">
            Thank you, <strong className="text-[#0f172a]">{request.clientName}</strong>. Our project management team has been notified and will review your requirements shortly.
          </p>

          {/* Reference Card with Copy Action */}
          <div className="bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-4 mb-6 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-0.5">
                Tracking Reference
              </span>
              <span className="font-mono text-[18px] font-bold text-[#0f172a] tracking-tight">
                {request.reference}
              </span>
            </div>
            <button
              type="button"
              onClick={copyRef}
              className="px-3 py-1.5 rounded bg-white border border-[#cbd5e1] text-[12px] font-semibold text-[#334155] hover:bg-[#f1f5f9] transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Next Steps */}
          <div className="border-t border-[#f1f5f9] pt-6 mb-8">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#64748b] mb-4">
              What happens next
            </h2>
            <ol className="flex flex-col gap-3 text-[13px] text-[#334155]">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#f1f5f9] text-[#0f172a] font-bold text-[11px] flex items-center justify-center flex-none mt-0.5">
                  1
                </span>
                <span>An internal project manager reviews requirement details and assigns an area specialist.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#f1f5f9] text-[#0f172a] font-bold text-[11px] flex items-center justify-center flex-none mt-0.5">
                  2
                </span>
                <span>The assignee acknowledges the request under our 24-hour SLA commitment.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#f1f5f9] text-[#0f172a] font-bold text-[11px] flex items-center justify-center flex-none mt-0.5">
                  3
                </span>
                <span>Direct coordination commences via <strong className="text-[#0f172a]">{request.email}</strong>.</span>
              </li>
            </ol>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2.5 rounded-md bg-[#0f172a] text-white text-[13.5px] font-semibold hover:bg-[#1e293b] transition-colors"
          >
            Return to Portal Home
          </button>
        </div>
      </main>
    </div>
  )
}
