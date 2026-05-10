/**
 * Unit tests for BulkImportDialog batch import flow (F-003).
 *
 * Tests the two distinct paths in handleConfirmImport:
 *   — Manifest present: routes to batchImportTrackCourses
 *   — No manifest:     preserves existing per-course persist loop
 *
 * @since E108-S01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkImportDialog } from '../BulkImportDialog'
import { toast } from 'sonner'
import type { BulkScanResult, ScannedCourse } from '@/lib/courseImport'
import type { BatchImportResult } from '@/lib/trackManifestImport'

// ───── Mocks ─────

const mockReadTrackManifest = vi.fn()
const mockBatchImportTrackCourses = vi.fn()
const mockShowDirectoryPicker = vi.fn()
const mockListSubDirectories = vi.fn()
const mockScanCourseFolderFromHandle = vi.fn()
const mockPersistScannedCourse = vi.fn()
const mockDetectAuthorFromFolderName = vi.fn()
const mockMatchOrCreateAuthor = vi.fn()

vi.mock('@/lib/trackManifestImport', () => ({
  readTrackManifest: (...args: unknown[]) => mockReadTrackManifest(...args),
  batchImportTrackCourses: (...args: unknown[]) => mockBatchImportTrackCourses(...args),
}))

vi.mock('@/lib/courseImport', () => ({
  scanCourseFolderFromHandle: (...args: unknown[]) => mockScanCourseFolderFromHandle(...args),
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
  let onComplete: any
  let onOpenChange: any

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
      mockListSubDirectories.mockResolvedValue([
        mockDirHandle('alpha'),
        mockDirHandle('beta'),
      ])
      mockReadTrackManifest.mockResolvedValue(mockManifestResponse)
      // Scanning still runs before the review step — make every folder scan successfully
      mockScanCourseFolderFromHandle.mockImplementation(
        (handle: FileSystemDirectoryHandle) => makeScanSuccess(`id-${handle.name}`, handle.name)
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
      mockListSubDirectories.mockResolvedValue([
        mockDirHandle('alpha'),
        mockDirHandle('beta'),
      ])
      mockReadTrackManifest.mockResolvedValue({ ok: false as const, error: 'No manifest' })
      mockScanCourseFolderFromHandle.mockImplementation(
        (handle: FileSystemDirectoryHandle) => makeScanSuccess(`id-${handle.name}`, handle.name)
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
  })
})
