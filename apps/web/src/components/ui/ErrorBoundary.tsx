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
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠
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
