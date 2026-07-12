import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorFallback } from '../RouteErrorBoundary'

vi.mock('@/lib/errorTracking', () => ({ reportError: vi.fn() }))

describe('RouteErrorFallback', () => {
  it('offers a version reload for lazy chunk failures', () => {
    render(
      <MemoryRouter>
        <RouteErrorFallback
          error={
            new TypeError('Failed to fetch dynamically imported module: /assets/Courses-old.js')
          }
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'A new version is available' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reload latest' })).toBeDefined()
  })

  it('keeps ordinary component failures on the local retry path', () => {
    render(
      <MemoryRouter>
        <RouteErrorFallback error={new Error('Render failed')} onRetry={vi.fn()} />
      </MemoryRouter>
    )

    expect(
      screen.getByRole('heading', { name: 'Something went wrong in this section' })
    ).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  })
})
