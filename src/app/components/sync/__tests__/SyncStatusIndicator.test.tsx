/**
 * E97-S01 Unit 3: Tests for <SyncStatusIndicator />.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockCount, mockFullSync, mockToastError } = vi.hoisted(() => ({
  mockCount: vi.fn().mockResolvedValue(0),
  mockFullSync: vi.fn().mockResolvedValue(undefined),
  mockToastError: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    syncQueue: {
      where: () => ({
        equals: () => ({
          count: mockCount,
        }),
      }),
    },
  },
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: mockFullSync,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}))

import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { SyncStatusIndicator } from '../SyncStatusIndicator'

function resetStore(partial: Partial<ReturnType<typeof useSyncStatusStore.getState>> = {}) {
  useSyncStatusStore.setState({
    status: 'synced',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    ...partial,
  })
}

describe('<SyncStatusIndicator />', () => {
  beforeEach(() => {
    resetStore()
    mockCount.mockReset().mockResolvedValue(0)
    mockFullSync.mockReset().mockResolvedValue(undefined)
    mockToastError.mockClear()
    // Default matchMedia — reduced motion NOT set.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders trigger with role=status and the synced aria-label', () => {
    resetStore({ status: 'synced' })
    render(<SyncStatusIndicator />)
    const trigger = screen.getByRole('status', { name: /sync status: synced/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('data-sync-status', 'synced')
  })

  it('renders offline label and icon when status is offline', () => {
    resetStore({ status: 'offline' })
    render(<SyncStatusIndicator />)
    expect(
      screen.getByRole('status', { name: /sync status: offline/i })
    ).toBeInTheDocument()
  })

  it('renders syncing label with animated spinner (no reduced motion)', () => {
    resetStore({ status: 'syncing' })
    render(<SyncStatusIndicator />)
    const icon = screen.getByTestId('sync-status-icon')
    expect(icon.getAttribute('class')).toContain('animate-spin')
  })

  it('renders error label and data-sync-status=error', () => {
    resetStore({ status: 'error', lastError: 'Network error' })
    render(<SyncStatusIndicator />)
    const trigger = screen.getByRole('status', { name: /sync status: sync error/i })
    expect(trigger).toHaveAttribute('data-sync-status', 'error')
  })

  it('shows badge when pendingCount > 0 with correct count', () => {
    resetStore({ pendingCount: 3 })
    render(<SyncStatusIndicator />)
    const badge = screen.getByTestId('sync-status-badge')
    expect(badge).toHaveTextContent('3')
  })

  it('hides badge when pendingCount is 0', () => {
    resetStore({ pendingCount: 0 })
    render(<SyncStatusIndicator />)
    expect(screen.queryByTestId('sync-status-badge')).toBeNull()
  })

  it('caps badge text at 99+ for large pending counts', () => {
    resetStore({ pendingCount: 150 })
    render(<SyncStatusIndicator />)
    expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('99+')
  })

  it('opens popover on click and refreshes pending count exactly once', async () => {
    const user = userEvent.setup()
    mockCount.mockClear()
    render(<SyncStatusIndicator />)
    const trigger = screen.getByTestId('sync-status-indicator')
    await user.click(trigger)
    await waitFor(() => expect(mockCount).toHaveBeenCalledTimes(1))
  })

  it('renders "Not synced yet" when lastSyncAt is null', async () => {
    const user = userEvent.setup()
    resetStore({ lastSyncAt: null })
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    expect(await screen.findByText(/not synced yet/i)).toBeInTheDocument()
  })

  it('renders "All changes saved" when pendingCount is 0', async () => {
    const user = userEvent.setup()
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    // "All changes saved" appears in the Pending <dd>; both the status copy
    // and this dd include similar phrasing, so assert at least one match.
    const matches = await screen.findAllByText(/all changes saved/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders singular copy when pendingCount is 1', async () => {
    const user = userEvent.setup()
    resetStore({ pendingCount: 1 })
    mockCount.mockResolvedValue(1)
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    expect(await screen.findByText(/1 change waiting to upload/i)).toBeInTheDocument()
  })

  it('renders plural copy when pendingCount > 1', async () => {
    const user = userEvent.setup()
    resetStore({ pendingCount: 5 })
    mockCount.mockResolvedValue(5)
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    expect(await screen.findByText(/5 changes waiting to upload/i)).toBeInTheDocument()
  })

  it('shows error panel with lastError message when status is error', async () => {
    const user = userEvent.setup()
    resetStore({ status: 'error', lastError: 'Network error' })
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/network error/i)
  })

  it('Retry invokes syncEngine.fullSync and markSyncComplete on success', async () => {
    const user = userEvent.setup()
    resetStore({ status: 'error', lastError: 'Network error' })
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    const retry = await screen.findByTestId('sync-retry-button')

    await act(async () => {
      await user.click(retry)
    })

    expect(mockFullSync).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('synced')
      expect(state.lastError).toBeNull()
    })
  })

  it('Retry failure sets status=error with classified message and toasts', async () => {
    const user = userEvent.setup()
    resetStore({ status: 'error', lastError: 'Network error' })
    mockFullSync.mockRejectedValueOnce(new Error('fetch failed again'))

    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    const retry = await screen.findByTestId('sync-retry-button')

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await user.click(retry)
    })
    errSpy.mockRestore()

    await waitFor(() => {
      const state = useSyncStatusStore.getState()
      expect(state.status).toBe('error')
      expect(state.lastError).toBe('Network error')
    })
    expect(mockToastError).toHaveBeenCalledWith('Network error')
  })

  it('Retry early-returns if a sync is already in flight (race guard)', async () => {
    const user = userEvent.setup()
    resetStore({ status: 'error', lastError: 'Network error' })
    render(<SyncStatusIndicator />)
    await user.click(screen.getByTestId('sync-status-indicator'))
    const retry = await screen.findByTestId('sync-retry-button')

    // Simulate periodic/online fullSync in-flight.
    act(() => {
      useSyncStatusStore.setState({ status: 'syncing' })
    })

    await act(async () => {
      await user.click(retry)
    })

    // Race guard early-returned — fullSync should not have been invoked by Retry.
    expect(mockFullSync).not.toHaveBeenCalled()
  })

  it('uses static Cloud icon (no animate-spin) when prefers-reduced-motion is set', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    resetStore({ status: 'syncing' })
    render(<SyncStatusIndicator />)
    const icon = screen.getByTestId('sync-status-icon')
    expect(icon.getAttribute('class') ?? '').not.toContain('animate-spin')
  })
})
