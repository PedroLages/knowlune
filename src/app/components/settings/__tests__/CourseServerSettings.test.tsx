/**
 * Unit tests for CourseServerSettings — status indicator fallback (KI-bugfix).
 *
 * Verifies that the StatusIndicator does not crash when a CourseServer record
 * has an unrecognized status value (e.g., corrupted Dexie data). The bug was
 * that the inline status lookup returned undefined and accessing .Icon on it
 * threw "Cannot read properties of undefined (reading 'Icon')".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CourseServerSettings } from '@/app/components/settings/CourseServerSettings'
import type { CourseServer } from '@/data/types'

// ---------------------------------------------------------------------------
// Hoisted mutable state for mock factories
// ---------------------------------------------------------------------------

const { mockState } = vi.hoisted(() => ({
  mockState: {
    servers: [] as CourseServer[],
    isLoaded: true,
  },
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLoadServers = vi.fn()

vi.mock('@/stores/useCourseServerStore', () => ({
  useCourseServerStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      servers: mockState.servers,
      isLoaded: mockState.isLoaded,
      loadServers: mockLoadServers,
      addServer: vi.fn(),
      updateServer: vi.fn(),
      removeServer: vi.fn(),
      checkServerStatus: vi.fn(),
    }
    return selector ? selector(state as Record<string, unknown>) : state
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeServer(overrides: Partial<CourseServer> = {}): CourseServer {
  return {
    id: 'srv-1',
    name: 'Test Server',
    url: 'https://example.com',
    status: 'unknown',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.servers.length = 0
  mockState.isLoaded = true
  mockLoadServers.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CourseServerSettings', () => {
  it('renders the card title when loaded and no servers exist', () => {
    render(<CourseServerSettings />)

    expect(screen.getByText('Course Content Servers')).toBeInTheDocument()
    expect(screen.getByText(/No servers configured/)).toBeInTheDocument()
  })

  it('renders a server with "connected" status without crashing', () => {
    mockState.servers.push(makeServer({ id: 'srv-connected', status: 'connected' }))

    render(<CourseServerSettings />)

    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('renders a server with "offline" status without crashing', () => {
    mockState.servers.push(makeServer({ id: 'srv-offline', status: 'offline' }))

    render(<CourseServerSettings />)

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('renders a server with "auth-failed" status without crashing', () => {
    mockState.servers.push(makeServer({ id: 'srv-auth', status: 'auth-failed' }))

    render(<CourseServerSettings />)

    expect(screen.getByText('Auth Failed')).toBeInTheDocument()
  })

  it('renders a server with "unknown" status without crashing', () => {
    mockState.servers.push(makeServer({ id: 'srv-unknown', status: 'unknown' }))

    render(<CourseServerSettings />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('falls back to "Unknown" when status is an unrecognized string (e.g., corrupted data)', () => {
    const broken = makeServer({ id: 'srv-broken', status: 'error' as CourseServer['status'] })
    mockState.servers.push(broken)

    render(<CourseServerSettings />)

    // Should not crash — the StatusIndicator must degrade gracefully.
    // Both the corrupted record and the Unknown badge should appear.
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText(broken.name)).toBeInTheDocument()
  })

  it('falls back to "Unknown" when status is an empty string', () => {
    const broken = makeServer({ id: 'srv-empty', status: '' as CourseServer['status'] })
    mockState.servers.push(broken)

    render(<CourseServerSettings />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText(broken.name)).toBeInTheDocument()
  })

  it('renders multiple servers with mixed statuses without crashing', () => {
    mockState.servers.push(
      makeServer({ id: 'srv-1', name: 'Good Server', status: 'connected' }),
      makeServer({
        id: 'srv-2',
        name: 'Bad Server',
        status: 'not-a-real-status' as CourseServer['status'],
      }),
      makeServer({ id: 'srv-3', name: 'Offline Server', status: 'offline' })
    )

    render(<CourseServerSettings />)

    expect(screen.getByText('Good Server')).toBeInTheDocument()
    expect(screen.getByText('Bad Server')).toBeInTheDocument()
    expect(screen.getByText('Offline Server')).toBeInTheDocument()
    // "Unknown" appears for both the bad-status server and the "unknown" status
    // if any servers have it. The bad-status server should show Unknown.
    const unknownBadges = screen.getAllByText('Unknown')
    expect(unknownBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows loading state when not yet loaded', () => {
    mockState.isLoaded = false

    render(<CourseServerSettings />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
