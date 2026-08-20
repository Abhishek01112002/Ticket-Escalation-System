import { Spinner } from './icons'

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Spinner size={24} />
      <p className="text-[13px]" style={{ color: 'var(--color-ink-muted)' }}>
        {label}
      </p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 max-w-sm mx-auto text-center px-6">
      <span
        className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] font-bold"
        style={{ background: 'var(--color-rose-bg)', color: 'var(--color-rose-text)' }}
      >
        !
      </span>
      <p className="text-[14px] font-semibold" style={{ color: 'var(--color-ink)' }}>
        Unable to load
      </p>
      <p className="text-[13px]" style={{ color: 'var(--color-ink-muted)' }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
        style={{
          background: 'white',
          border: '1px solid var(--color-border)',
          color: 'var(--color-ink)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        Try again
      </button>
    </div>
  )
}

export function EmptyQueue() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-3 text-center rounded-xl"
      style={{
        background: 'white',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <span className="text-3xl" aria-hidden="true">
        ✓
      </span>
      <p className="text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>
        Queue is clear
      </p>
      <p className="text-[13px] max-w-[260px]" style={{ color: 'var(--color-ink-muted)' }}>
        No requests at this time.
      </p>
    </div>
  )
}
