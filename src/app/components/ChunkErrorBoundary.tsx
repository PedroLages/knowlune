import { Component, type ErrorInfo, type ReactNode } from 'react'
import { OfflineRouteFallback } from './OfflineRouteFallback'
import { RouteErrorFallback } from './RouteErrorBoundary'

interface ChunkErrorBoundaryProps {
  children: ReactNode
}

interface ChunkErrorBoundaryState {
  hasError: boolean
  error: Error | null
  isChunkLoadError: boolean
}

/**
 * Detects chunk-load failures (lazy import() failures when offline or when
 * a chunk is missing) and shows the appropriate fallback.
 *
 * Chunk load errors → OfflineRouteFallback (no retry — if offline, retry won't help)
 * Other errors → RouteErrorFallback (with retry + navigation escape)
 *
 * Must be a class component — React error boundaries require
 * componentDidCatch or getDerivedStateFromError, which hooks cannot provide.
 *
 * @since E64-S09
 */
export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, isChunkLoadError: false }
  }

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    const isChunkLoadError =
      error.name === 'TypeError' &&
      (error.message?.includes('dynamically imported') ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('Loading chunk') ||
        error.message?.includes('ChunkLoadError'))

    return {
      hasError: true,
      error,
      isChunkLoadError,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentName =
      info.componentStack
        ?.split('\n')
        .find(line => line.trim().startsWith('at '))
        ?.trim()
        ?.replace(/^at /, '')
        .split(' ')[0] ?? 'Unknown'

    console.error(`[ChunkErrorBoundary] Component: ${componentName}, Error: ${error.message}`)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkLoadError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.state.isChunkLoadError) {
      return <OfflineRouteFallback />
    }

    // For non-chunk errors, use the existing RouteErrorFallback so users
    // can retry or navigate elsewhere
    return <RouteErrorFallback error={this.state.error} onRetry={this.handleRetry} />
  }
}
