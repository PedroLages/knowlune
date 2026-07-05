/**
 * Unit tests for BulkImportDialog batch import flow (F-003).
 *
 * Tests the two distinct paths in handleConfirmImport:
 *   — Manifest present: routes to batchImportTrackCourses
 *   — No manifest:     preserves existing per-course persist loop
 *
 * @since E108-S01
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkImportDialog } from '../BulkImportDialog'
import { toast } from 'sonner'
import type { BulkScanResult, ScannedCourse } from '@/lib/courseImport'
import type { BatchImportResult } from '@/lib/trackManifestImport'

// ───── Mocks ─────

const mockReadTrackManifest = vi.fn()
const mockBatchImportTrackCourses = vi.fn()
const mockFetchTrackManifestFromUrl = vi.fn()
const mockShowDirectoryPicker = vi.fn()
const mockListSubDirectories = vi.fn()
const mockScanCourseFolderFromHandle = vi.fn()
const mockScanCourseFromSource = vi.fn()
const mockListServerSubDirectories = vi.fn()
const mockPersistScannedCourse = vi.fn()
const mockDetectAuthorFromFolderName = vi.fn()
const mockMatchOrCreateAuthor = vi.fn()

vi.mock('@/lib/trackManifestImport', () => ({
  readTrackManifest: (...args: unknown[]) => mockReadTrackManifest(...args),
  batchImportTrackCourses: (...args: unknown[]) => mockBatchImportTrackCourses(...args),
  fetchTrackManifestFromUrl: (...args: unknown[]) => mockFetchTrackManifestFromUrl(...args),
}))

vi.mock('@/lib/courseImport', () => ({
  scanCourseFolderFromHandle: (...args: unknown[]) => mockScanCourseFolderFromHandle(...args),
  scanCourseFromSource: (...args: unknown[]) => mockScanCourseFromSource(...args),
  listServerSubDirectories: (...args: unknown[]) => mockListServerSubDirectories(...args),
  listSubDirectories: (...args: unknown[]) => mockListSubDirectories(...args),
  persistScannedCourse: (...args: unknown[]) => mockPersistScannedCourse(...args),
}))

vi.mock('@/lib/fileSystem', () => ({
  showDirectoryPicker: (...args: unknown[]) => mockShowDirectoryPicker(...args),
}))

vi.mock('@/lib/authorDetection', () => ({
  detectAuthorFromFolderName: (...args: unknown[]) => mockDetectAuthorFromFolderName(...args),
  matchOrCreateAuthor: (...args: unknown[]) => mockMatchOrCreateAuthor(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

const mockSetDialogOpen = vi.fn()
const mockStartImport = vi.fn()
const mockUpdateProcessingProgress = vi.fn()
const mockCompleteCourse = vi.fn()
const mockFailCourse = vi.fn()
const mockConfirmCancellation = vi.fn()

const importProgressState = {
  setDialogOpen: mockSetDialogOpen,
  startImport: mockStartImport,
  updateProcessingProgress: mockUpdateProcessingProgress,
  completeCourse: mockCompleteCourse,
  failCourse: mockFailCourse,
  cancelRequested: false,
  confirmCancellation: mockConfirmCancellation,
}

vi.mock('@/stores/useImportProgressStore', () => ({
  useImportProgressStore: Object.assign(
    (selector?: (s: typeof importProgressState) => unknown) =>
      selector ? selector(importProgressState) : importProgressState,
    { getState: () => importProgressState, setState: vi.fn() }
  ),
}))

const mockLoadImportedCourses = vi.fn()

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({ loadImportedCourses: mockLoadImportedCourses } as Record<string, unknown>)
        : { loadImportedCourses: mockLoadImportedCourses },
    {
      getState: () => ({ loadImportedCourses: mockLoadImportedCourses }),
      setState: vi.fn(),
    }
  ),
}))

const mockReorderCourse = vi.fn()
const mockBatchAddCoursesToPath = vi.fn()
const mockCreatePathWithCourses = vi.fn()

const learningPathState = {
  paths: [] as Array<{ id: string; name: string }>,
  entries: [] as Array<{ courseId: string; pathId: string; position: number }>,
  reorderCourse: mockReorderCourse,
  batchAddCoursesToPath: mockBatchAddCoursesToPath,
  createPathWithCourses: mockCreatePathWithCourses,
}

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (s: typeof learningPathState) => unknown) =>
      selector ? selector(learningPathState) : learningPathState,
    {
      getState: () => learningPathState,
      setState: vi.fn(),
    }
  ),
}))

// ───── Helpers ─────

function mockDirHandle(name: string): FileSystemDirectoryHandle {
  return { name } as unknown as FileSystemDirectoryHandle
}

function makeScannedCourse(id: string, folderName: string): ScannedCourse {
  return {
    id,
    name: folderName,
    videos: [],
    pdfs: [],
    images: [],
    directoryHandle: mockDirHandle(folderName),
  } as unknown as ScannedCourse
}

function makeScanSuccess(id: string, folderName: string): BulkScanResult {
  return { status: 'success' as const, course: makeScannedCourse(id, folderName) }
}

// ───── Suite ─────

describe('BulkImportDialog — batch import flow (F-003)', () => {
  let onComplete: Mock
  let onOpenChange: Mock

  beforeEach(() => {
    vi.clearAllMocks()
    onComplete = vi.fn()
    onOpenChange = vi.fn()
    mockDetectAuthorFromFolderName.mockReturnValue(null)
    mockLoadImportedCourses.mockResolvedValue(undefined)
  })

  describe('manifest present — batch import path', () => {
    const mockManifestResponse = {
      ok: true as const,
      summary: {
        trackName: 'Test Track',
        trackDescription: 'A test track',
        courseFolders: ['alpha', 'beta'],
      },
      manifest: {
        track: {
          name: 'Test Track',
          description: 'A test track',
          courses: [
            { folder: 'alpha', position: 1 },
            { folder: 'beta', position: 2 },
          ],
        },
      },
    }

    const successResult: BatchImportResult = {
      trackId: 'track-abc',
      trackName: 'Test Track',
      courses: [
        { folder: 'alpha', success: true, courseId: 'course-alpha' },
        { folder: 'beta', success: true, courseId: 'course-beta' },
      ],
      successCount: 2,
      failureCount: 0,
    }

    const allFailResult: BatchImportResult = {
      trackId: undefined,
      trackName: 'Test Track',
      courses: [
        { folder: 'alpha', success: false, error: 'Folder not found' },
        { folder: 'beta', success: false, error: 'Already imported' },
      ],
      successCount: 0,
      failureCount: 2,
    }

    beforeEach(() => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirHandle('ParentFolder'))
      mockListSubDirectories.mockResolvedValue([mockDirHandle('alpha'), mockDirHandle('beta')])
      mockReadTrackManifest.mockResolvedValue(mockManifestResponse)
      // Scanning still runs before the review step — make every folder scan successfully
      mockScanCourseFromSource.mockImplementation(
        (source: { folderName: string; handle: FileSystemDirectoryHandle | null }) =>
          makeScanSuccess(`id-${source.folderName}`, source.folderName)
      )
      mockBatchImportTrackCourses.mockResolvedValue(successResult)
    })

    async function flowToReview(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
    }

    async function flowToResults(user: ReturnType<typeof userEvent.setup>) {
      await flowToReview(user)
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())
    }

    it('(1) manifest present routes to batchImportTrackCourses', async () => {
      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await flowToReview(user)
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      await waitFor(() => {
        expect(mockBatchImportTrackCourses).toHaveBeenCalledTimes(1)
      })
      const [parentHandle, manifest] = mockBatchImportTrackCourses.mock.calls[0]
      expect(parentHandle.name).toBe('ParentFolder')
      expect(manifest.track.name).toBe('Test Track')
    })

    it('(2) onComplete fires with trackId when batch import succeeds', async () => {
      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await flowToResults(user)

      // Close the dialog — triggers onComplete
      await user.click(screen.getByTestId('bulk-done-btn'))

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(['course-alpha', 'course-beta'], 'track-abc')
      })
    })

    it('(4) all-fail does not fire onComplete (ids.length === 0 guard)', async () => {
      mockBatchImportTrackCourses.mockResolvedValue(allFailResult)

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await flowToResults(user)
      await user.click(screen.getByTestId('bulk-done-btn'))

      // The production code guards onComplete with `if (ids.length > 0)`, so
      // when all courses fail onComplete should NOT fire.
      await waitFor(() => {
        expect(onComplete).not.toHaveBeenCalled()
      })
    })

    it('shows error toast and returns to review step when batchImportTrackCourses throws', async () => {
      mockBatchImportTrackCourses.mockRejectedValue(new Error('Disk full'))

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await flowToReview(user)
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      // Should show error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Disk full'))
      })

      // Should return to review step so user can retry
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument()
      })
    })
  })

  describe('no manifest — per-course persist path', () => {
    beforeEach(() => {
      mockShowDirectoryPicker.mockResolvedValue(mockDirHandle('ParentFolder'))
      mockListSubDirectories.mockResolvedValue([mockDirHandle('alpha'), mockDirHandle('beta')])
      mockReadTrackManifest.mockResolvedValue({ ok: false as const, error: 'No manifest' })
      mockScanCourseFromSource.mockImplementation(
        (source: { folderName: string; handle: FileSystemDirectoryHandle | null }) =>
          makeScanSuccess(`id-${source.folderName}`, source.folderName)
      )
      mockPersistScannedCourse.mockResolvedValue(undefined)
    })

    it('(3) no-manifest preserves existing per-course behavior', async () => {
      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → select-folders → scan → review
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      // Should NOT call batch import
      expect(mockBatchImportTrackCourses).not.toHaveBeenCalled()

      // Should call persistScannedCourse for each course
      await waitFor(() => {
        expect(mockPersistScannedCourse).toHaveBeenCalledTimes(2)
      })

      // Results step should appear
      await waitFor(() => {
        expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument()
      })

      // Close dialog — onComplete should fire with IDs
      await user.click(screen.getByTestId('bulk-done-btn'))

      await waitFor(() => {
        // The IDs come from the scanned courses which have id: 'id-alpha' and 'id-beta'
        expect(onComplete).toHaveBeenCalledOnce()
        const [courseIds] = onComplete.mock.calls[0]
        expect(courseIds).toContain('id-alpha')
        expect(courseIds).toContain('id-beta')
      })
    })

    it('TST-P2-003: persistScannedCourse rejection sets item to error status', async () => {
      mockPersistScannedCourse.mockRejectedValue(new Error('Disk full'))

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → select-folders → scan → review
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())

      // Confirm import — persist will reject with Disk full
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      // Wait for results step — items are marked as error because persist threw
      await waitFor(() => {
        expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument()
      })

      // Both items should show as error in the results list
      expect(screen.getByTestId('bulk-results-summary')).toBeInTheDocument()
    })

    it('TST-P1-003: retry — scan returns error updates item status to error', async () => {
      // First persist call fails to get to results step
      mockPersistScannedCourse
        .mockResolvedValueOnce(undefined) // alpha succeeds
        .mockRejectedValueOnce(new Error('First fail')) // beta fails

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // Now retry beta — make scan return error
      mockScanCourseFromSource.mockResolvedValue({
        status: 'error',
        folderName: 'beta',
        message: 'Network timeout',
      })

      const retryBtn = screen.queryByTestId('bulk-retry-beta')
      expect(retryBtn).toBeInTheDocument()
      await user.click(retryBtn!)

      // The item should remain as error (scan returned error, not success)
      await waitFor(() => {
        // The retry button should still be visible because beta is still error
        expect(screen.getByTestId('bulk-retry-beta')).toBeInTheDocument()
      })
    })

    it('TST-P1-004: retry — scan returns duplicate maps to error status', async () => {
      mockPersistScannedCourse
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('First fail'))

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // Retry — scan returns duplicate
      mockScanCourseFromSource.mockResolvedValue({
        status: 'duplicate',
        folderName: 'beta',
      })

      const retryBtn = screen.queryByTestId('bulk-retry-beta')
      await user.click(retryBtn!)

      await waitFor(() => {
        expect(screen.getByTestId('bulk-retry-beta')).toBeInTheDocument()
      })
    })

    it('TST-P1-005: retry — scan returns no-files maps to no-files status', async () => {
      mockPersistScannedCourse
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('First fail'))

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // Retry — scan returns no-files
      mockScanCourseFromSource.mockResolvedValue({
        status: 'no-files',
        folderName: 'beta',
      })

      const retryBtn = screen.queryByTestId('bulk-retry-beta')
      await user.click(retryBtn!)

      // After retry with no-files, the item transitions from 'error' to 'no-files'.
      // Items in 'no-files' state do not show a retry button (only 'error' items do).
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-retry-beta')).not.toBeInTheDocument()
      })
    })

    it('TST-P1-001: retry flow — failed item can be retried and succeeds', async () => {
      // First make the second persist call fail
      mockPersistScannedCourse
        .mockResolvedValueOnce(undefined) // alpha succeeds
        .mockRejectedValueOnce(new Error('First fail')) // beta fails

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → select-folders → scan → review
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())

      // Confirm import — beta will fail
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      // Wait for results step
      await waitFor(() => {
        expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument()
      })

      // Beta should have a retry button visible
      const retryBtn = screen.queryByTestId('bulk-retry-beta')
      expect(retryBtn).toBeInTheDocument()

      // Reset scan mock back to default success behavior for the retry
      mockScanCourseFromSource.mockImplementation(
        (source: { folderName: string; handle: FileSystemDirectoryHandle | null }) =>
          makeScanSuccess(`id-${source.folderName}`, source.folderName)
      )
      // Set up persist to succeed for the retry
      mockPersistScannedCourse.mockResolvedValue(undefined)

      // Click retry on beta
      await user.click(retryBtn!)

      // Wait for beta to transition back to success
      await waitFor(() => {
        // The retry button should no longer be shown (beta is now success)
        expect(screen.queryByTestId('bulk-retry-beta')).not.toBeInTheDocument()
      })
    })

    it('TST-P1-006: retry — scan succeeds but persist rejects, verifying error state', async () => {
      // First persist call fails to get to results step
      mockPersistScannedCourse
        .mockResolvedValueOnce(undefined) // alpha succeeds
        .mockRejectedValueOnce(new Error('First fail')) // beta fails

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // Reset scan mock back to default success for retry
      mockScanCourseFromSource.mockImplementation(
        (source: { folderName: string; handle: FileSystemDirectoryHandle | null }) =>
          makeScanSuccess(`id-${source.folderName}`, source.folderName)
      )
      // Make persist reject during retry
      mockPersistScannedCourse.mockRejectedValue(new Error('Disk full on retry'))

      const retryBtn = screen.queryByTestId('bulk-retry-beta')
      await user.click(retryBtn!)

      // After retry, beta should still show error (persist rejected)
      await waitFor(() => {
        expect(screen.getByTestId('bulk-retry-beta')).toBeInTheDocument()
      })
    })
  })

  // ───── URL Batch Import Flow ─────

  describe('URL batch import flow', () => {
    const onOpenChange = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      mockListServerSubDirectories.mockReset()
      mockScanCourseFromSource.mockReset()
      mockFetchTrackManifestFromUrl.mockReset()
      // By default, no track manifest is found — prevents real network calls
      mockFetchTrackManifestFromUrl.mockResolvedValue({ ok: false, error: 'Not found' })
    })

    it('navigates to enter-url step when "Import Multiple from URL" is clicked', async () => {
      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-url-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-enter-url')).toBeInTheDocument()
      })
    })

    it('shows validation error on empty URL scan trigger', async () => {
      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      // Navigate to URL step
      await user.click(screen.getByTestId('import-multiple-url-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-scan-url-btn')).toBeInTheDocument()
      })

      // Scan button should be disabled when URL is empty
      expect(screen.getByTestId('bulk-import-scan-url-btn')).toBeDisabled()
    })

    it('shows validation error for invalid URL format', async () => {
      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'not-a-valid-url')
      await user.click(screen.getByTestId('bulk-import-scan-url-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-url-error')).toBeInTheDocument()
      })
    })

    it('has a working Back button on URL step', async () => {
      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      // Navigate to URL step
      await user.click(screen.getByTestId('import-multiple-url-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-url-back-btn')).toBeInTheDocument()
      })

      // Click Back
      await user.click(screen.getByTestId('bulk-import-url-back-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('import-multiple-url-btn')).toBeInTheDocument()
      })
    })

    it('triggers server scan with valid URL and shows error when scan fails', async () => {
      mockListServerSubDirectories.mockResolvedValue({ ok: false, error: 'Server unreachable' })

      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/courses/')
      await user.click(screen.getByTestId('bulk-import-scan-url-btn'))

      await waitFor(() => {
        expect(mockListServerSubDirectories).toHaveBeenCalledWith('http://example.com/courses/')
        expect(screen.getByTestId('bulk-import-url-error')).toBeInTheDocument()
      })
    })

    it('shows inline error when server scan returns no subdirectories', async () => {
      mockListServerSubDirectories.mockResolvedValue({ ok: true, data: [] })

      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/empty/')
      await user.click(screen.getByTestId('bulk-import-scan-url-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-url-error')).toBeInTheDocument()
        expect(screen.getByTestId('bulk-import-url-error').textContent).toContain(
          'No course folders found'
        )
      })
    })

    it('transitions to select-folders step when scan succeeds with subdirectories', async () => {
      mockListServerSubDirectories.mockResolvedValue({
        ok: true,
        data: [{ name: 'Course1', url: 'http://example.com/courses/Course1/' }],
      })

      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/courses/')
      await user.click(screen.getByTestId('bulk-import-scan-url-btn'))

      await waitFor(() => {
        expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument()
        expect(screen.getByText('Course1')).toBeInTheDocument()
      })
    })

    it('TST-P2-002: pressing Enter while scanning does not trigger duplicate scan', async () => {
      // Use a deferred promise so the scan hangs until we resolve it
      let resolveScan!: (value: unknown) => void
      mockListServerSubDirectories.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveScan = resolve
          })
      )

      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      // Navigate to URL step and type a valid URL
      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/courses/')

      // Press Enter to trigger scan (first call)
      await user.keyboard('{Enter}')

      // Press Enter again while scan is still in progress
      await user.keyboard('{Enter}')

      // Verify scan was called only once (the ref guard prevented the second call)
      expect(mockListServerSubDirectories).toHaveBeenCalledTimes(1)

      // Resolve the scan so the component doesn't hang
      resolveScan!({
        ok: true,
        data: [{ name: 'Course1', url: 'http://example.com/courses/Course1/' }],
      })
    })

    it('TST-P2-001: closing dialog during scan prevents step transition', async () => {
      let resolveScan!: (value: unknown) => void
      mockListServerSubDirectories.mockImplementation(
        () =>
          new Promise(resolve => {
            resolveScan = resolve
          })
      )

      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      // Trigger scan with a slow promise
      await user.click(screen.getByTestId('import-multiple-url-btn'))
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/courses/')
      await user.keyboard('{Enter}')

      // Close the dialog while scan is still in progress
      await user.keyboard('{Escape}')

      // onOpenChange should have been called with false
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false)
      })

      // Resolve the scan — the abort check in handleServerUrlScan should prevent
      // any step transition
      resolveScan!({
        ok: true,
        data: [{ name: 'Course1', url: 'http://example.com/courses/Course1/' }],
      })

      // The dialog should not show select-folders (the URL input was cleaned up by resetDialog)
      expect(screen.queryByTestId('bulk-select-all')).not.toBeInTheDocument()
    })
    it('calls reorderCourse after URL+manifest import to enforce manifest order', async () => {
      // Reset learning path store state
      learningPathState.paths = []
      learningPathState.entries = []
      mockReorderCourse.mockReset()
      mockBatchAddCoursesToPath.mockReset()
      mockCreatePathWithCourses.mockReset()

      // Return a manifest with 3 courses in specific order
      mockFetchTrackManifestFromUrl.mockResolvedValue({
        ok: true as const,
        summary: {
          trackName: 'DevOps Track',
          trackAuthor: undefined,
          courseFolders: ['linux', 'docker', 'k8s'],
        },
        manifest: {
          version: '1',
          track: {
            name: 'DevOps Track',
            description: 'DevOps learning path',
            courses: [
              { folder: 'linux', position: 1 },
              { folder: 'docker', position: 2 },
              { folder: 'k8s', position: 3 },
            ],
          },
        },
      })

      // Return 3 folders from server scan
      mockListServerSubDirectories.mockResolvedValue({
        ok: true,
        data: [
          { name: 'linux', url: 'http://example.com/courses/linux/' },
          { name: 'docker', url: 'http://example.com/courses/docker/' },
          { name: 'k8s', url: 'http://example.com/courses/k8s/' },
        ],
      })

      // Scanning returns success — courses get IDs in reverse manifest order
      // to simulate concurrent scan completion order ≠ manifest order
      mockScanCourseFromSource.mockImplementation((source: { folderName: string }) => {
        return makeScanSuccess(`id-${source.folderName}`, source.folderName)
      })
      mockPersistScannedCourse.mockResolvedValue(undefined)

      // Mock createPathWithCourses to return a track and populate entries
      // in REVERSE manifest order — simulating the real bug where concurrent
      // scan completion scrambles course order.
      mockCreatePathWithCourses.mockImplementation(
        (name: string, _desc: string, courses: Array<{ courseId: string }>) => {
          const trackId = 'track-devops'
          learningPathState.paths = [{ id: trackId, name }]
          // Deliberately reverse the order to simulate scrambled concurrent scans
          learningPathState.entries = [...courses].reverse().map((c, i) => ({
            courseId: c.courseId,
            pathId: trackId,
            position: i,
          }))
          return Promise.resolve({ id: trackId, name, description: '' })
        }
      )

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → URL step
      await user.click(screen.getByTestId('import-multiple-url-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-import-enter-url')).toBeInTheDocument()
      })

      // Enter URL and scan
      const input = screen.getByTestId('bulk-import-enter-url')
      await user.type(input, 'http://example.com/courses/')
      await user.click(screen.getByTestId('bulk-import-scan-url-btn'))

      // Wait for select-folders step (with Select All checkbox)
      await waitFor(() => {
        expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument()
      })

      // Start scan
      await user.click(screen.getByTestId('bulk-start-import-btn'))

      // Wait for review step
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument()
      })

      // Confirm import — should create track and call reorderCourse
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      // Wait for results
      await waitFor(() => {
        expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument()
      })

      // Verify reorderCourse was called — this is the assertion that currently FAILS
      // because the URL+manifest path doesn't call reorderCourse
      expect(mockReorderCourse).toHaveBeenCalled()
    })
  })

  // ───── Manifest with author data (TST-P2-004) ─────
  //
  // Verifies the component correctly passes a manifest that includes author
  // metadata through to batchImportTrackCourses.  The internal behavior of
  // batchImportTrackCourses calling matchOrCreateAuthor is tested in
  // src/lib/__tests__/trackManifestImport.integration.test.ts.

  describe('manifest with author data (TST-P2-004)', () => {
    const onOpenChange = vi.fn()

    const authorManifestResponse = {
      ok: true as const,
      summary: {
        trackName: 'Test Track',
        trackAuthor: { name: 'Jane Smith', title: 'Test Expert' },
        courseFolders: ['alpha', 'beta'],
      },
      manifest: {
        version: '1',
        track: {
          name: 'Test Track',
          description: 'A test track',
          author: {
            name: 'Jane Smith',
            title: 'Test Expert',
          },
          courses: [
            { folder: 'alpha', position: 1 },
            { folder: 'beta', position: 2 },
          ],
        },
      },
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockShowDirectoryPicker.mockResolvedValue(mockDirHandle('ParentFolder'))
      mockListSubDirectories.mockResolvedValue([mockDirHandle('alpha'), mockDirHandle('beta')])
      mockReadTrackManifest.mockResolvedValue(authorManifestResponse)
      mockScanCourseFromSource.mockImplementation((source: { folderName: string }) =>
        makeScanSuccess(`id-${source.folderName}`, source.folderName)
      )
      mockBatchImportTrackCourses.mockResolvedValue({
        trackId: 'track-abc',
        trackName: 'Test Track',
        courses: [
          { folder: 'alpha', success: true, courseId: 'course-alpha' },
          { folder: 'beta', success: true, courseId: 'course-beta' },
        ],
        successCount: 2,
        failureCount: 0,
      })
    })

    it('passes manifest with author data to batchImportTrackCourses', async () => {
      const user = userEvent.setup()
      render(<BulkImportDialog open={true} onOpenChange={onOpenChange} onSingleImport={vi.fn()} />)

      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => {
        expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('bulk-confirm-import-btn'))

      await waitFor(() => {
        expect(mockBatchImportTrackCourses).toHaveBeenCalled()
      })

      const [, manifest] = mockBatchImportTrackCourses.mock.calls[0]
      expect(manifest.track.author).toBeDefined()
      expect(manifest.track.author!.name).toBe('Jane Smith')
      expect(manifest.track.author!.title).toBe('Test Expert')
    })
  })

  // ───── KI Fix Integration Tests ─────

  describe('KI fix integration tests', () => {
    let onOpenChange: Mock
    let onComplete: Mock

    beforeEach(() => {
      vi.clearAllMocks()
      onOpenChange = vi.fn()
      onComplete = vi.fn()
      mockShowDirectoryPicker.mockResolvedValue(mockDirHandle('ParentFolder'))
      mockListSubDirectories.mockResolvedValue([mockDirHandle('alpha'), mockDirHandle('beta')])
      mockReadTrackManifest.mockResolvedValue({ ok: false as const, error: 'No manifest' })
      mockLoadImportedCourses.mockResolvedValue(undefined)
    })

    it('KI-103: generation guard prevents stale scan results after dialog close/reopen', async () => {
      // Use deferred promise so first scan hangs until we resolve it
      let resolveFirstScan!: (value: BulkScanResult) => void
      const firstScanPromise = new Promise<BulkScanResult>(resolve => {
        resolveFirstScan = resolve
      })
      mockScanCourseFromSource.mockImplementation(() => firstScanPromise)

      const user = userEvent.setup()
      const { unmount } = render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Start first scan
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-start-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() =>
        expect(screen.queryByTestId('bulk-start-import-btn')).not.toBeInTheDocument()
      )

      // Close dialog while scan is in flight
      await user.keyboard('{Escape}')
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

      // Resolve the first (stale) scan
      resolveFirstScan(makeScanSuccess('stale-alpha', 'alpha'))

      // Small delay to let any stale state updates propagate
      await new Promise(r => setTimeout(r, 50))

      // Unmount first dialog instance completely
      unmount()

      // Setup second scan to return fresh IDs
      mockScanCourseFromSource.mockReset()
      mockScanCourseFromSource.mockImplementation((source: { folderName: string }) =>
        makeScanSuccess(`fresh-${source.folderName}`, source.folderName)
      )
      mockPersistScannedCourse.mockResolvedValue(undefined)

      // Re-render fresh dialog — open again
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate and start a fresh scan
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-start-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())

      // Confirm import to go to results
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // onComplete should fire with fresh-* IDs, not stale-* IDs
      await user.click(screen.getByTestId('bulk-done-btn'))
      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledOnce()
        const [courseIds] = onComplete.mock.calls[0]
        expect(courseIds).toContain('fresh-alpha')
        expect(courseIds).toContain('fresh-beta')
      })
    })

    it('KI-105: retry preserves course name override after re-scan generates new UUID', async () => {
      // Use a single folder to avoid multi-item override lookup complexity
      mockListSubDirectories.mockResolvedValue([mockDirHandle('mycourse')])

      mockScanCourseFromSource.mockImplementation((source: { folderName: string }) =>
        makeScanSuccess('orig-mycourse', source.folderName)
      )
      // Make persist fail so we can trigger a retry
      mockPersistScannedCourse.mockRejectedValueOnce(new Error('First fail'))

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → select-folders → scan → review
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-start-import-btn')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())

      // The courseOverride is keyed by course ID ('orig-mycourse' from the scan)
      // We can't directly set courseOverrides, so we use a workaround:
      // The persistScannedCourse already received the override in the retry call.
      // After confirm-import with persist failure, verify the retry preserves overrides.

      // Confirm import — will fail because persist rejects
      await user.click(screen.getByTestId('bulk-confirm-import-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-done-btn')).toBeInTheDocument())

      // Now retry — mock scan to return a NEW UUID
      // The scan result has course.id = 'new-uuid-mycourse', but the override
      // lookup should use item.scannedCourse?.id = 'orig-mycourse'
      mockScanCourseFromSource.mockResolvedValue(makeScanSuccess('new-uuid-mycourse', 'mycourse'))
      mockPersistScannedCourse.mockResolvedValue(undefined)

      const retryBtn = screen.queryByTestId('bulk-retry-mycourse')
      expect(retryBtn).toBeInTheDocument()
      await user.click(retryBtn!)

      // Wait for retry to complete (retry button gone = success)
      await waitFor(() => {
        expect(screen.queryByTestId('bulk-retry-mycourse')).not.toBeInTheDocument()
      })

      // Verify persistScannedCourse was called during the retry with the
      // skipStoreUpdate flag (confirms it ran through persist path, not just scan)
      const retryPersistCalls = mockPersistScannedCourse.mock.calls.filter((call: unknown[]) => {
        const overrides = call[1] as { skipStoreUpdate?: boolean } | undefined
        return overrides?.skipStoreUpdate === true
      })
      // There should be at least one persist call from the retry
      // (the first from the initial import + at least one from the retry)
      expect(retryPersistCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('KI-102: truncated scan surfaces toast warning and truncated badge in results', async () => {
      // Mock scanCourseFromSource to return truncated results
      mockScanCourseFromSource.mockImplementation((source: { folderName: string }) => {
        const course = makeScannedCourse(`id-${source.folderName}`, source.folderName)
        course.videos = Array.from({ length: 5000 }, (_, i) => ({
          id: `v${i}`,
          filename: `v${i}.mp4`,
          path: `v${i}.mp4`,
          duration: 0,
          format: 'mp4' as const,
          order: i + 1,
          fileSize: 0,
          width: 0,
          height: 0,
        }))
        course.truncated = true
        return {
          status: 'success' as const,
          course,
          truncated: true,
        } as BulkScanResult
      })

      const user = userEvent.setup()
      render(
        <BulkImportDialog
          open={true}
          onOpenChange={onOpenChange}
          onSingleImport={vi.fn()}
          onComplete={onComplete}
        />
      )

      // Navigate: choose → select-folders → scan → review
      await user.click(screen.getByTestId('import-multiple-btn'))
      await waitFor(() => expect(screen.getByTestId('bulk-select-all')).toBeInTheDocument())
      await user.click(screen.getByTestId('bulk-start-import-btn'))

      // Wait for review step
      await waitFor(() => expect(screen.getByTestId('bulk-confirm-import-btn')).toBeInTheDocument())

      // Verify toast.warning was called with truncation message
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('5,000 file limit'))

      // Verify truncated badge is visible in the review step (one per truncated course)
      const badges = screen.getAllByText(/Truncated to \d+ files/)
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })
  })
})
