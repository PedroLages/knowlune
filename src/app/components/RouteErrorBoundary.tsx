import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { reportError } from '@/lib/errorTracking'

interface RouteErrorFallbackProps {
  error: Error | null
  onRetry: () => void
}

/**
 * Fallback UI shown when a route-level error boundary catches an error.
 * Unlike the root ErrorBoundary, this keeps the sidebar and header functional.
 *
 * Provides:
 * - "Try again" button that remounts the crashed page component
 * - "Go to Overview" link as an escape hatch
 * - Dev-only error details
 */
export function RouteErrorFallback({ error, onRetry }: RouteErrorFallbackProps) {
  const isDev = import.meta.env.DEV

  return (
    <div className="flex flex-1 items-center justify-center p-6" role="alert" aria-live="assertive">
      <div className="mx-auto w-full max-w-md rounded-[24px] border border-border bg-card p-8 text-center shadow-lg">
        {/* Icon */}
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h2 className="mb-2 text-xl font-semibold text-card-foreground">
          Something went wrong in this section
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This page encountered an error, but you can still navigate to other sections.
        </p>

        {/* Dev-only error details */}
        {isDev && error && (
          <pre className="mb-6 max-h-40 overflow-auto rounded-xl bg-muted p-4 text-left text-xs text-destructive">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onRetry} className="flex-1 gap-2">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="brand" asChild className="flex-1 gap-2">
            <Link to="/">
              <Home className="size-4" aria-hidden="true" />
              Go to Overview
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Route-level error boundary that wraps individual page components.
 *
 * When a page crashes, only that page's content is replaced with the
 * RouteErrorFallback — the sidebar, header, and navigation remain functional.
 *
 * The root ErrorBoundary in App.tsx remains as a last-resort catch-all.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
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

    console.error(`[RouteErrorBoundary] Component: ${componentName}, Error: ${error.message}`)

    reportError(error, `RouteErrorBoundary (${componentName})`)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <RouteErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}
