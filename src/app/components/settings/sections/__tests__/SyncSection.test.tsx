/**
 * E97-S02 Unit 5: Tests for <SyncSection />.
 *
 * Covers:
 *   1. Renders null when user is null (AC5)
 *   2. Renders sync section when authenticated
 *   3. Shows correct status from useSyncStatusStore
 *   4. Sync Now button calls fullSync
 *   5. Sync Now button disabled when already syncing (F1 guard)
 *   6. AlertDialog shown on reset button click
 *   7. AlertDialog confirm calls resetLocalData
 *   8. AlertDialog cancel does not call resetLocalData
 *   9. Sync Now button disabled when offline
 *  10. Error status is displayed when lastError is set
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

const { mockFullSync, mockStop, mockStart, mockResetLocalData, mockRefreshPendingCount } =
  vi.hoisted(() => ({
    mockFullSync: vi.fn().mockResolvedValue(undefined),
    mockStop: vi.fn(),
    mockStart: vi.fn().mockResolvedValue(undefined),
    mockResetLocalData: vi.fn().mockResolvedValue(undefined),
    mockRefreshPendingCount: vi.fn().mockResolvedValue(undefined),
  }))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: (...args: unknown[]) => mockFullSync(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    start: (...args: unknown[]) => mockStart(...args),
    nudge: vi.fn(),
  },
}))

vi.mock('@/lib/sync/resetLocalData', () => ({
  resetLocalData: (...args: unknown[]) => mockResetLocalData(...args),
}))

vi.mock('@/lib/sync/tableRegistry', () => ({
  tableRegistry: [],
}))

vi.mock('@/db', () => ({
  db: {},
}))

vi.mock('@/lib/settings', () => ({
  getSettings: vi.fn().mockReturnValue({ autoSyncEnabled: true }),
  saveSettings: vi.fn(),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { saved: vi.fn(), reset: vi.fn() },
  toastError: { saveFailed: vi.fn() },
}))

vi.mock('@/lib/sync/classifyError', () => ({
  classifyError: (err: unknown) => String(err),
}))

// date-fns mock — avoid relative-time drift in CI
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn().mockReturnValue('2 minutes ago'),
}))

// ---------------------------------------------------------------------------
// Auth store mock — controllable user
// ---------------------------------------------------------------------------

let mockUser: { id: string; email: string } | null = {
  id: 'test-user-id',
  email: 'test@test.local',
}

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}))

// ---------------------------------------------------------------------------
// useSyncStatusStore — use the real store but allow test overrides
// ---------------------------------------------------------------------------

import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'

function resetStore(
  partial: Partial<{
    status: 'synced' | 'syncing' | 'offline' | 'error'
    pendingCount: number
    lastSyncAt: Date | null
    lastError: string | null
  }> = {}
) {
  useSyncStatusStore.setState({
    status: 'synced',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    ...partial,
    // Override refreshPendingCount to avoid real Dexie calls
    refreshPendingCount: mockRefreshPendingCount,
  })
}

// ---------------------------------------------------------------------------
// Import component AFTER mocks are set up
// ---------------------------------------------------------------------------

import { SyncSection } from '../SyncSection'

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderSection() {
  return render(<SyncSection />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('<SyncSection />', () => {
  beforeEach(() => {
    mockUser = { id: 'test-user-id', email: 'test@test.local' }
    mockFullSync.mockReset().mockResolvedValue(undefined)
    mockStop.mockReset()
    mockStart.mockReset().mockResolvedValue(undefined)
    mockResetLocalData.mockReset().mockResolvedValue(undefined)
    mockRefreshPendingCount.mockReset().mockResolvedValue(undefined)
    resetStore()

    // Suppress console.error noise from expected error paths
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Default: online
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. Renders null when user is null (AC5)
  // -------------------------------------------------------------------------

  it('renders null when user is null (AC5)', () => {
    mockUser = null
    const { container } = renderSection()
    expect(container.innerHTML).toBe('')
  })

  // -------------------------------------------------------------------------
  // 2. Renders sync section when authenticated
  // -------------------------------------------------------------------------

  it('renders sync section when authenticated', () => {
    renderSection()
    expect(screen.getByTestId('sync-section')).toBeInTheDocument()
    expect(screen.getByTestId('auto-sync-switch')).toBeInTheDocument()
    expect(screen.getByTestId('sync-now-button')).toBeInTheDocument()
    expect(screen.getByTestId('sync-reset-button')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Shows correct status from useSyncStatusStore
  // -------------------------------------------------------------------------

  it('displays error message when store has lastError set', () => {
    resetStore({ status: 'error', lastError: 'Connection timed out' })
    renderSection()
    expect(screen.getByTestId('sync-last-error')).toBeInTheDocument()
    expect(screen.getByText('Connection timed out')).toBeInTheDocument()
  })

  it('shows "Never synced" when lastSyncAt is null', () => {
    resetStore({ lastSyncAt: null })
    renderSection()
    expect(screen.getByTestId('sync-last-sync')).toHaveTextContent('Never synced')
  })

  it('shows relative time when lastSyncAt is set', () => {
    resetStore({ lastSyncAt: new Date('2026-04-18T10:00:00Z') })
    renderSection()
    expect(screen.getByTestId('sync-last-sync')).toHaveTextContent('Last synced 2 minutes ago')
  })

  // -------------------------------------------------------------------------
  // 4. Sync Now button calls fullSync
  // -------------------------------------------------------------------------

  it('calls syncEngine.fullSync when Sync Now is clicked', async () => {
    renderSection()
    const user = userEvent.setup()
    const button = screen.getByTestId('sync-now-button')
    await user.click(button)
    await waitFor(() => expect(mockFullSync).toHaveBeenCalledTimes(1))
  })

  // -------------------------------------------------------------------------
  // 5. Sync Now button disabled when already syncing (F1 guard)
  // -------------------------------------------------------------------------

  it('does not call fullSync when store status is already syncing', async () => {
    resetStore({ status: 'syncing' })
    renderSection()
    const user = userEvent.setup()
    // The button is disabled when isSyncing=true (status=syncing), so click is a no-op.
    const button = screen.getByTestId('sync-now-button')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(mockFullSync).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 6. AlertDialog shown on reset button click
  // -------------------------------------------------------------------------

  it('opens AlertDialog when reset button is clicked', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('sync-reset-button'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/clear local data and re-sync\?/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 7. AlertDialog confirm calls resetLocalData
  // -------------------------------------------------------------------------

  it('calls resetLocalData when confirm button is clicked', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('sync-reset-button'))
    await user.click(screen.getByTestId('sync-reset-confirm'))
    await waitFor(() => expect(mockResetLocalData).toHaveBeenCalledTimes(1))
    // Dialog should close after completion
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  // -------------------------------------------------------------------------
  // 8. AlertDialog cancel does not call resetLocalData
  // -------------------------------------------------------------------------

  it('does not call resetLocalData when cancel is clicked', async () => {
    renderSection()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('sync-reset-button'))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(mockResetLocalData).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 9. Sync Now button disabled when offline
  // -------------------------------------------------------------------------

  it('disables Sync Now button when offline', async () => {
    renderSection()
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('sync-now-button')).toBeDisabled()
    })
  })

  // -------------------------------------------------------------------------
  // 10. Error status displayed (error branch coverage)
  // -------------------------------------------------------------------------

  it('shows error alert when fullSync throws', async () => {
    mockFullSync.mockRejectedValue(new Error('Network error'))
    renderSection()
    const user = userEvent.setup()
    await user.click(screen.getByTestId('sync-now-button'))
    await waitFor(() => expect(useSyncStatusStore.getState().status).toBe('error'))
  })
})
