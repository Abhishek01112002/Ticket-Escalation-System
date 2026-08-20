import { Spinner } from './icons'

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner size={22} />
      <p className="text-[13px] font-medium text-[#64748b]">
        {label}
      </p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 max-w-sm mx-auto text-center px-6">
      <span className="w-9 h-9 rounded-full bg-[#fff1f2] border border-[#ffe4e6] text-[#e11d48] flex items-center justify-center text-[15px] font-bold">
        !
      </span>
      <p className="text-[14px] font-bold text-[#0f172a]">
        Unable to complete request
      </p>
      <p className="text-[13px] text-[#64748b]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 px-4 py-2 rounded-md border border-[#cbd5e1] bg-white text-[13px] font-semibold text-[#0f172a] hover:bg-[#f8fafc] transition-colors shadow-xs"
      >
        Retry
      </button>
    </div>
  )
}

export function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2.5 text-center bg-white rounded-lg border border-[#e2e8f0] p-8 shadow-xs">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>
        Queue is clear
      </p>
      <p className="text-[13px] max-w-[260px]" style={{ color: 'var(--color-ink-muted)' }}>
        No requests at this time.
      </p>
    </div>
  )
}
