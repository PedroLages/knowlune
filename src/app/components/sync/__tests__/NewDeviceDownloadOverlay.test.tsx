/**
 * E97-S04 Unit 5: Unit tests for NewDeviceDownloadOverlay.
 *
 * Mocks `useDownloadProgress`, `useDownloadEngineWatcher`, and `observedHydrate`
 * so we can drive phase transitions directly without touching the real sync
 * stack.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import type { DownloadProgress } from '@/app/hooks/useDownloadProgress'

// Mutable progress state returned by the hook mock.
let mockProgress: DownloadProgress = {
  processed: 0,
  total: 0,
  done: false,
  error: false,
  errorMessage: null,
  recentTable: null,
  totalsFailedCount: 0,
  totalTables: 10,
}

vi.mock('@/app/hooks/useDownloadProgress', () => ({
  useDownloadProgress: () => mockProgress,
}))

const watcherSpy = vi.fn()
vi.mock('@/app/hooks/useDownloadEngineWatcher', () => ({
  useDownloadEngineWatcher: (userId: string, enabled: boolean) => {
    watcherSpy(userId, enabled)
  },
}))

const mockObservedHydrate = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/sync/observedHydrate', () => ({
  observedHydrate: (...args: unknown[]) => mockObservedHydrate(...args),
}))

import { NewDeviceDownloadOverlay } from '../NewDeviceDownloadOverlay'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'

const USER = 'user-1'

function resetProgress(overrides: Partial<DownloadProgress> = {}) {
  mockProgress = {
    processed: 0,
    total: 0,
    done: false,
    error: false,
    errorMessage: null,
    recentTable: null,
    totalsFailedCount: 0,
    totalTables: 10,
    ...overrides,
  }
}

function resetStore(
  status: ReturnType<typeof useDownloadStatusStore.getState>['status'] = 'hydrating-p3p4'
) {
  useDownloadStatusStore.setState({
    status,
    lastError: null,
    startedAt: Date.now(),
  })
}

beforeEach(() => {
  resetProgress()
  resetStore('hydrating-p3p4')
  watcherSpy.mockClear()
  mockObservedHydrate.mockClear()
  mockObservedHydrate.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NewDeviceDownloadOverlay', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <NewDeviceDownloadOverlay open={false} userId={USER} onClose={vi.fn()} />
    )
    expect(container.querySelector('[data-testid="new-device-download-overlay"]')).toBeNull()
    // watcher was disabled
    expect(watcherSpy).toHaveBeenCalledWith(USER, false)
  })

  it('renders nothing when userId is empty', () => {
    render(<NewDeviceDownloadOverlay open userId="" onClose={vi.fn()} />)
    expect(screen.queryByTestId('new-device-download-overlay')).toBeNull()
  })

  it('renders hydrating-p3p4 phase with Phase A copy', () => {
    resetStore('hydrating-p3p4')
    resetProgress({ processed: 2, total: 10 })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    const overlay = screen.getByTestId('new-device-download-overlay')
    expect(overlay.getAttribute('data-phase')).toBe('hydrating-p3p4')
    expect(screen.getByText(/Restoring your Knowlune library/i)).toBeInTheDocument()
    expect(screen.getByText(/Restoring 2 of 10/i)).toBeInTheDocument()
  })

  it('renders downloading-p0p2 phase with Phase B copy', () => {
    resetStore('downloading-p0p2')
    resetProgress({ processed: 8, total: 10 })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    const overlay = screen.getByTestId('new-device-download-overlay')
    expect(overlay.getAttribute('data-phase')).toBe('downloading-p0p2')
    expect(screen.getByText(/Finishing sync/i)).toBeInTheDocument()
  })

  it('renders success phase after store reaches complete and calls onClose', async () => {
    resetStore('complete')
    resetProgress({ processed: 10, total: 10, done: true })
    const onClose = vi.fn()
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={onClose} />)

    const overlay = screen.getByTestId('new-device-download-overlay')
    expect(overlay.getAttribute('data-phase')).toBe('success')
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument()

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1000 })
  })

  it('renders error phase with Retry and Close when store is error', () => {
    resetStore('error')
    useDownloadStatusStore.setState({
      status: 'error',
      lastError: 'Network unavailable',
      startedAt: null,
    })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    const overlay = screen.getByTestId('new-device-download-overlay')
    expect(overlay.getAttribute('data-phase')).toBe('error')
    expect(screen.getByText(/Network unavailable/)).toBeInTheDocument()
    expect(screen.getByTestId('new-device-download-retry')).toBeInTheDocument()
    expect(screen.getByTestId('new-device-download-close')).toBeInTheDocument()
  })

  it('clicking Retry re-invokes observedHydrate and resets store to hydrating-p3p4', async () => {
    useDownloadStatusStore.setState({
      status: 'error',
      lastError: 'boom',
      startedAt: null,
    })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('new-device-download-retry'))

    expect(useDownloadStatusStore.getState().status).toBe('hydrating-p3p4')
    await waitFor(() => expect(mockObservedHydrate).toHaveBeenCalledWith(USER))
  })

  it('clicking Close in error phase calls onClose', () => {
    useDownloadStatusStore.setState({
      status: 'error',
      lastError: 'boom',
      startedAt: null,
    })
    const onClose = vi.fn()
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('new-device-download-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('forces error phase when progress reports ALL HEAD failed', () => {
    resetStore('hydrating-p3p4')
    resetProgress({
      error: true,
      errorMessage: 'Could not determine remote totals — check your connection.',
      totalsFailedCount: 10,
      totalTables: 10,
    })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    const overlay = screen.getByTestId('new-device-download-overlay')
    expect(overlay.getAttribute('data-phase')).toBe('error')
    expect(screen.getByText(/Could not determine remote totals/)).toBeInTheDocument()
  })

  it('renders (partial counts) suffix when progress has partial HEAD failure', () => {
    resetStore('downloading-p0p2')
    resetProgress({
      processed: 3,
      total: 8,
      totalsFailedCount: 2,
      totalTables: 10,
    })
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    expect(screen.getByText(/\(partial counts\)/)).toBeInTheDocument()
    // Still a non-error phase
    expect(screen.getByTestId('new-device-download-overlay').getAttribute('data-phase')).toBe(
      'downloading-p0p2'
    )
  })

  it('fires watchdog after 60s in an active phase', async () => {
    vi.useFakeTimers()
    resetStore('hydrating-p3p4')
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(60_001)
    })

    expect(useDownloadStatusStore.getState().status).toBe('error')
    expect(useDownloadStatusStore.getState().lastError).toMatch(/Taking longer/)
    vi.useRealTimers()
  })

  it('watchdog also fires from downloading-p0p2', async () => {
    vi.useFakeTimers()
    resetStore('downloading-p0p2')
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)

    act(() => {
      vi.advanceTimersByTime(60_001)
    })
    expect(useDownloadStatusStore.getState().status).toBe('error')
    vi.useRealTimers()
  })

  it('mounts the engine watcher with enabled=true while open', () => {
    resetStore('downloading-p0p2')
    render(<NewDeviceDownloadOverlay open userId={USER} onClose={vi.fn()} />)
    expect(watcherSpy).toHaveBeenCalledWith(USER, true)
  })
})
