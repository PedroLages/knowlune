import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react'
import type { InitialUploadProgress } from '@/app/hooks/useInitialUploadProgress'

const mockState = vi.hoisted(() => ({
  progress: null as unknown as InitialUploadProgress,
  coordinatorProgress: null as unknown as InitialUploadProgress,
  initialUploadActive: false,
  startInitialUpload: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/hooks/useInitialUploadProgress', () => ({
  useInitialUploadProgress: (): InitialUploadProgress => mockState.progress,
}))

vi.mock('@/lib/sync/syncCoordinator', () => ({
  syncCoordinator: {
    get isInitialUploadActive() {
      return mockState.initialUploadActive
    },
    getInitialUploadProgress: () => mockState.coordinatorProgress,
    startInitialUpload: mockState.startInitialUpload,
  },
}))

vi.mock('@/lib/sync/repairAccountData', () => ({
  markAccountRepairComplete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/toastHelpers', () => ({
  toastSuccess: { saved: vi.fn() },
}))

const mockAnnounce = vi.fn()
vi.mock('@/app/hooks/useLiveRegion', () => ({
  useLiveRegion: () => ({ announce: mockAnnounce }),
}))

import { InitialUploadWizard } from '../InitialUploadWizard'
import { syncCoordinator } from '@/lib/sync/syncCoordinator'
import { toastSuccess } from '@/lib/toastHelpers'
import { wizardCompleteKey, wizardDismissedKey } from '@/lib/sync/shouldShowInitialUploadWizard'

const USER = 'user-97-03'

function progress(overrides: Partial<InitialUploadProgress> = {}): InitialUploadProgress {
  return {
    phase: 'original',
    processed: 0,
    total: 3,
    recentTable: null,
    done: false,
    error: null,
    additionalPendingCount: 0,
    failures: [],
    ...overrides,
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
  mockAnnounce.mockClear()
  mockState.initialUploadActive = false
  mockState.coordinatorProgress = progress({ phase: 'idle', total: 0 })
  mockState.progress = progress()
})

afterEach(cleanup)

describe('InitialUploadWizard', () => {
  it('renders nothing when closed or missing a user', () => {
    render(<InitialUploadWizard open={false} userId={USER} onClose={() => {}} />)
    expect(screen.queryByTestId('initial-upload-wizard')).toBeNull()
    render(<InitialUploadWizard open userId="" onClose={() => {}} />)
    expect(screen.queryByTestId('initial-upload-wizard')).toBeNull()
  })

  it('starts one bounded coordinator upload from the intro state', () => {
    renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    expect(syncCoordinator.startInitialUpload).toHaveBeenCalledWith({ userId: USER })
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')
    expect(mockAnnounce).toHaveBeenCalledWith('Uploading your data. Please wait.')
  })

  it('fast-paths into uploading when the bounded run is already active', () => {
    mockState.initialUploadActive = true
    renderWizard()
    expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'uploading')
  })

  it('labels follow-up writes as additional changes', () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    act(() => {
      mockState.progress = progress({
        phase: 'additional',
        processed: 2,
        total: 5,
        additionalPendingCount: 5,
      })
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)
    expect(
      screen.getByText(/Original upload complete\. Saving 2 of 5 additional changes/)
    ).toBeInTheDocument()
  })

  it('announces the additional-change count before the follow-up phase starts moving', () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    act(() => {
      mockState.progress = progress({
        phase: 'additional',
        processed: 0,
        total: 31,
        additionalPendingCount: 31,
      })
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)

    expect(
      screen.getByText('Original upload complete. Saving 31 additional changes')
    ).toBeInTheDocument()
  })

  it('records success only after the coordinator reports completion', async () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    act(() => {
      mockState.progress = progress({ phase: 'complete', processed: 3, total: 3, done: true })
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)

    await waitFor(() =>
      expect(screen.getByTestId('initial-upload-wizard')).toHaveAttribute('data-phase', 'success')
    )
    expect(localStorage.getItem(wizardCompleteKey(USER))).not.toBeNull()
    expect(toastSuccess.saved).toHaveBeenCalledWith('Initial upload complete')
  })

  it('surfaces the coordinator failure and rebuilds on Retry', async () => {
    const { rerender } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-start'))
    act(() => {
      mockState.progress = progress({
        phase: 'error',
        error: new Error('importedVideos: missing title'),
        failures: [
          {
            table: 'importedVideos',
            recordId: 'video-1',
            message: 'importedVideos: missing title',
            retryable: false,
          },
        ],
      })
    })
    rerender(<InitialUploadWizard open userId={USER} onClose={() => {}} />)
    await waitFor(() =>
      expect(screen.getByText('importedVideos: missing title')).toBeInTheDocument()
    )

    fireEvent.click(screen.getByTestId('initial-upload-retry'))
    expect(syncCoordinator.startInitialUpload).toHaveBeenLastCalledWith({
      userId: USER,
      rebuildFailed: true,
    })
  })

  it('skip only dismisses the wizard and never writes a completion marker', () => {
    const { onClose } = renderWizard()
    fireEvent.click(screen.getByTestId('initial-upload-skip'))
    expect(localStorage.getItem(wizardDismissedKey(USER))).not.toBeNull()
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
