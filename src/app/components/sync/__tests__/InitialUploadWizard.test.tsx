/**
 * E97-S03: Unit tests for InitialUploadWizard component.
 *
 * We mock useInitialUploadProgress and useSyncStatusStore so we can drive
 * state transitions directly without touching IndexedDB. syncEngine is mocked
 * so we can assert fullSync invocations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import type { InitialUploadProgress } from '@/app/hooks/useInitialUploadProgress'

// Mutable progress state returned by the hook mock
let mockProgress: InitialUploadProgress = {
  processed: 0,
  total: 0,
  recentTable: null,
  done: false,
  error: null,
}

vi.mock('@/app/hooks/useInitialUploadProgress', () => ({
  useInitialUploadProgress: (): InitialUploadProgress => mockProgress,
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: {
    saved: vi.fn(),
  },
}))

vi.mock('@/app/hooks/useLiveRegion', () => ({
  LiveRegionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLiveRegion: () => ({ announce: vi.fn() }),
}))

// Zustand store mock — supports both selector call and getState().
const storeState = {
  status: 'synced' as 'synced' | 'syncing' | 'error' | 'offline',
  lastError: null as string | null,
}
function useSyncStatusStoreMock<T>(selector?: (s: typeof storeState) => T): T {
  return selector ? selector(storeState) : (storeState as unknown as T)
}
;(useSyncStatusStoreMock as unknown as { getState: () => typeof storeState }).getState = () =>
  storeState

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: useSyncStatusStoreMock,
}))

import { InitialUploadWizard } from '../InitialUploadWizard'
import { syncEngine } from '@/lib/sync/syncEngine'
import { toastSuccess } from '@/lib/toastHelpers'
import { wizardCompleteKey, wizardDismissedKey } from '@/lib/sync/shouldShowInitialUploadWizard'

const USER = 'user-97-03'

function resetStore() {
  storeState.status = 'synced'
  storeState.lastError = null
}

function resetProgress(total = 0) {
  mockProgress = {
    processed: 0,
    total,
    recentTable: null,
    done: total === 0,
    error: null,
  }
}

function renderWizard(props?: Partial<React.ComponentProps<typeof InitialUploadWizard>>) {
  const onClose = vi.fn()
  const utils = render(<InitialUploadWizard open userId={USER} onClose={onClose} {...props} />)
  return { onClose, ...utils }
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  resetStore()
  resetProgress(3) // default: there is data to upload
})

afterEach(() => {
  cleanup()
})

describe('InitialUploadWizard', () => {
  it('renders nothing when open is false', () => {
    render(<InitialUploadWizard open={false} userId={USER} onClose={() => {}} />)
    expect(screen.queryByTestId('initial-upload-wizard')).toBeNull()
  })

  it('renders nothing when userId is empty', () => {
    render(<InitialUploadWizard open userId="" onClose={() => {}} />)
    expect(screen.queryByTestId('initial-upload-wizard')).toBeNull()
  })

  it('mounts in intro phase by default and transitions to uploading on Start', () => {
    renderWizard()
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'intro')
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    expect(syncEngine.fullSync).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')
  })

  it('fast-path: mounts directly in uploading when status === syncing', () => {
    storeState.status = 'syncing'
    renderWizard()
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')
  })

  it('skip writes dismissal flag, does not invoke syncEngine, and calls onClose', () => {
    const { onClose } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-skip'))
    expect(localStorage.getItem(wizardDismissedKey(USER))).not.toBeNull()
    expect(syncEngine.fullSync).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('transitions to success when status→synced, progress.done, total>0; writes flag + toast', async () => {
    resetProgress(2)
    const { rerender } = renderWizard()

    // Move to uploading
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')

    // Simulate sync completing: progress drains + status stays synced
    act(() => {
      mockProgress = { processed: 2, total: 2, recentTable: null, done: true, error: null }
      storeState.status = 'synced'
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'success')
    })

    expect(localStorage.getItem(wizardCompleteKey(USER))).not.toBeNull()
    expect(toastSuccess.saved).toHaveBeenCalledWith('Initial upload complete')
  })

  it('clears dismissal flag when writing completion flag on success', async () => {
    localStorage.setItem(wizardDismissedKey(USER), '2020-01-01')
    resetProgress(1)
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))

    act(() => {
      mockProgress = { processed: 1, total: 1, recentTable: null, done: true, error: null }
      storeState.status = 'synced'
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)

    await waitFor(() => {
      expect(localStorage.getItem(wizardCompleteKey(USER))).not.toBeNull()
    })
    expect(localStorage.getItem(wizardDismissedKey(USER))).toBeNull()
  })

  it('transitions to error phase on status→error during uploading', async () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))

    act(() => {
      storeState.status = 'error'
      storeState.lastError = 'Network unreachable'
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)

    await waitFor(() => {
      expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'error')
    })
    expect(screen.getByText('Network unreachable')).toBeInTheDocument()
  })

  it('Retry from error re-invokes fullSync and returns to uploading', async () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    act(() => {
      storeState.status = 'error'
      storeState.lastError = 'boom'
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)
    await waitFor(() =>
      expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'error')
    )

    vi.mocked(syncEngine.fullSync).mockClear()
    fireEvent.click(screen.getByTestId('initial-upload-retry'))
    expect(syncEngine.fullSync).toHaveBeenCalledTimes(1)
    // The retry suppresses the stale error status; phase stays 'uploading'
    // until the engine transitions to 'syncing' and either drains or errors again.
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')
  })

  it('success branch does not fire when total === 0 (empty silent close)', async () => {
    resetProgress(0)
    const { onClose } = renderWizard()
    // Click start to enter uploading (fast-path would normally handle this)
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    // total === 0 && done === true → silent close
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toastSuccess.saved).not.toHaveBeenCalled()
    // Completion flag is NOT written here — the detection helper wrote it
    // on the short-circuit branch before the wizard ever mounted.
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
  })
})
