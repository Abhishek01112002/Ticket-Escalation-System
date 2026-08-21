import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[Application ErrorBoundary Caught]', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-6 antialiased">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[#e11d48] flex items-center justify-center mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Something went wrong
              </h1>
              <p className="text-xs text-text-muted leading-relaxed">
                An unexpected UI exception occurred in the operations workspace. Your saved data and active sessions are intact.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-surface-elevated border border-border/60 rounded-xl p-3.5 text-left text-[11px] font-mono text-rose-300 break-all overflow-x-auto max-h-32">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 bg-brand hover:bg-brand/90 text-text-inverse text-xs font-semibold rounded-xl transition-colors shadow-sm"
              >
                ↻ Recover Workspace
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                className="px-4 py-2.5 bg-surface-elevated hover:bg-border text-text-primary text-xs font-semibold rounded-xl border border-border transition-colors"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
