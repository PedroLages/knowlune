import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '@/lib/errorTracking'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary — catches render errors in the component
 * tree and displays a user-friendly fallback UI.
 *
 * Logs errors via the shared errorTracking infrastructure.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentName =
      info.componentStack
        ?.split('\n')
        .find(line => line.trim().startsWith('at '))
        ?.trim()
        .replace(/^at /, '')
        .split(' ')[0] ?? 'Unknown'

    console.error(
      `[ErrorBoundary] Component: ${componentName}, Error: ${error.message}, Stack: ${info.componentStack}`
    )

    reportError(error, `ErrorBoundary (${componentName})`)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const isDev = import.meta.env.DEV

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF5EE] p-6">
        <div className="mx-auto w-full max-w-md rounded-[24px] border border-stone-200 bg-white p-8 text-center shadow-lg">
          {/* Icon */}
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="size-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="mb-2 text-xl font-semibold text-stone-900">Something went wrong</h1>
          <p className="mb-6 text-sm text-stone-500">
            An unexpected error occurred. You can try again or reload the app.
          </p>

          {/* Dev-only error details */}
          {isDev && this.state.error && (
            <pre className="mb-6 max-h-40 overflow-auto rounded-xl bg-stone-100 p-4 text-left text-xs text-destructive">
              {this.state.error.message}
            </pre>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    )
  }
}

/**
 * Re-export error log helpers for convenience.
 */
export { getErrorLog as errorLog } from '@/lib/errorTracking'
