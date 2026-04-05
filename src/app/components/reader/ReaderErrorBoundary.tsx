/**
 * ReaderErrorBoundary — catches EPUB load errors and shows retry UI.
 *
 * Used to wrap EpubRenderer so epub.js failures don't crash the app.
 *
 * @module ReaderErrorBoundary
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface Props {
  children: ReactNode
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ReaderErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    console.error('[ReaderErrorBoundary] EPUB load error:', error)
    toast.error('Failed to load book. Please try again.')
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
          data-testid="reader-error"
        >
          <AlertCircle className="size-12 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Failed to Load Book</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              The book could not be opened. It may be corrupted or no longer available.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={this.handleRetry}
            className="gap-2"
            data-testid="reader-retry-button"
          >
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
