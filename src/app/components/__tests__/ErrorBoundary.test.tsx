import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import * as errorTracking from '@/lib/errorTracking'

// A helper component that throws on render
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render error')
  }
  return <div>Child rendered successfully</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Suppress React's noisy error boundary console output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('shows fallback UI when a child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred. You can try again or reload the app.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload App' })).toBeInTheDocument()
  })

  it('calls reportError when an error is caught', () => {
    const spy = vi.spyOn(errorTracking, 'reportError')

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )

    expect(spy).toHaveBeenCalledOnce()
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test render error' }),
      expect.stringContaining('ErrorBoundary')
    )
  })

  it('"Try Again" button resets error state and re-renders children', async () => {
    const user = userEvent.setup()

    // Use a stateful wrapper to control whether the child throws
    let shouldThrow = true
    function ConditionalChild() {
      if (shouldThrow) {
        throw new Error('Conditional error')
      }
      return <div>Recovered</div>
    }

    render(
      <ErrorBoundary>
        <ConditionalChild />
      </ErrorBoundary>
    )

    // Verify fallback is shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop throwing before clicking retry
    shouldThrow = false

    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    // Children should render again
    expect(screen.getByText('Recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    // import.meta.env.DEV is true by default in vitest (jsdom)
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    )

    // The error message should appear in the dev-only <pre> block
    expect(screen.getByText('Test render error')).toBeInTheDocument()
  })
})
