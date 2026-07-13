/**
 * Tests for LocalVideoContent with resume dialog and position sync integration.
 *
 * @module LocalVideoContent.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalVideoContent } from '../LocalVideoContent'

// Mock DB
const mockProgressFirst = vi.fn()
const mockImportedVideoGet = vi.fn()
vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: {
      get: (...args: unknown[]) => mockImportedVideoGet(...args),
    },
    progress: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: mockProgressFirst,
        })),
      })),
    },
  },
}))

// Mock useVideoFromHandle
vi.mock('@/hooks/useVideoFromHandle', () => ({
  useVideoFromHandle: vi.fn(() => ({
    blobUrl: 'blob:mock-video-url',
    error: null,
    loading: false,
  })),
}))

// Mock useVideoPositionSync
vi.mock('@/app/hooks/useVideoPositionSync', () => ({
  useVideoPositionSync: vi.fn(),
}))

// Mock syncableWrite
const mockSyncableWrite = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: (...args: unknown[]) => mockSyncableWrite(...args),
}))

// Mock useCaptionLoader
vi.mock('@/app/hooks/useCaptionLoader', () => ({
  useCaptionLoader: vi.fn(() => ({
    userCaptions: null,
    handleLoadCaptions: vi.fn(),
  })),
}))

// Mock bookmark utilities
vi.mock('@/lib/bookmarks', () => ({
  addBookmark: vi.fn().mockResolvedValue(undefined),
  getLessonBookmarks: vi.fn().mockResolvedValue([]),
  formatBookmarkTimestamp: vi.fn(
    (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  ),
}))

// Mock videoStoryboard utilities
vi.mock('@/lib/videoStoryboard', () => ({
  loadVideoStoryboard: vi.fn().mockResolvedValue(undefined),
  generateStoryboard: vi.fn().mockResolvedValue(undefined),
  saveVideoStoryboard: vi.fn().mockResolvedValue(undefined),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const DEFAULT_PROPS = {
  courseId: 'course-1',
  lessonId: 'lesson-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProgressFirst.mockReset()
  mockImportedVideoGet.mockReset()
  mockImportedVideoGet.mockResolvedValue({
    id: 'lesson-1',
    courseId: 'course-1',
    filename: 'test.mp4',
    fileHandle: { kind: 'file', name: 'test.mp4' },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocalVideoContent server video seeking', () => {
  it('keeps seeking enabled without issuing a byte-range capability probe', async () => {
    const serverUrl = 'https://media.example/course/test.mp4'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    mockImportedVideoGet.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      filename: 'test.mp4',
      fileHandle: null,
      serverUrl,
    })
    mockProgressFirst.mockResolvedValue(undefined)

    const { container } = render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(container.querySelector('video')).toHaveAttribute('src', serverUrl)
    })

    expect(screen.getByRole('slider', { name: 'Video progress' })).toBeEnabled()
    expect(
      screen.queryByText(
        'Seeking is unavailable because this media server does not support byte ranges.'
      )
    ).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('LocalVideoContent resume dialog', () => {
  // --- Loading state ---

  it('shows loading spinner while position is being fetched from Dexie', async () => {
    // Keep the promise pending (never resolve it)
    mockProgressFirst.mockImplementation(() => new Promise(() => {}))

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    // Should show loading spinner while position is loading
    await waitFor(() => {
      expect(screen.getByTestId('local-video-wrapper')).toBeInTheDocument()
    })
  })

  it('renders VideoPlayer directly when Dexie read resolves to "no saved position"', async () => {
    mockProgressFirst.mockResolvedValue(undefined)

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })
  })

  it('renders VideoPlayer directly when Dexie read throws (graceful degradation)', async () => {
    mockProgressFirst.mockRejectedValue(new Error('DB error'))

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })
  })

  // --- Dialog shows when saved position exists ---

  it('shows resume dialog when saved position > 5 seconds and completion < 95%', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByText('Resume video?')).toBeInTheDocument()
    })

    // Should show the formatted time (button text)
    expect(screen.getByText('Resume from 1:00')).toBeInTheDocument()
    // Should have both buttons
    expect(screen.getByText('Start from Beginning')).toBeInTheDocument()
  })

  // --- Dialog NOT shown in edge cases ---

  it('does NOT show resume dialog when saved position <= 5 seconds', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 3,
      completionPercentage: 2,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })

    expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
  })

  it('does NOT show resume dialog when completionPercentage >= 95', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 114,
      completionPercentage: 95,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })

    expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
  })

  it('does NOT show resume dialog when autoplay is true', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} autoplay={true} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })

    expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
  })

  // --- Dialog actions ---

  it('renders VideoPlayer when "Resume from X:XX" is clicked', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Resume video?')).toBeInTheDocument()
    })

    // Click "Resume from 1:00"
    await userEvent.click(screen.getByText(/Resume from 1:00/))

    // Dialog should close and VideoPlayer should render
    await waitFor(() => {
      expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
  })

  it('writes tombstone record when "Start from Beginning" is clicked', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByText('Resume video?')).toBeInTheDocument()
    })

    // Click "Start from Beginning"
    await userEvent.click(screen.getByText('Start from Beginning'))

    // Should write tombstone
    expect(mockSyncableWrite).toHaveBeenCalledWith('progress', 'put', {
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 0,
      completionPercentage: 0,
      durationSeconds: 0,
    })

    // Dialog should close and VideoPlayer should render
    await waitFor(() => {
      expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
  })

  it('preserves position record when dialog is dismissed (Escape/outside click)', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    render(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByText('Resume video?')).toBeInTheDocument()
    })

    // Close dialog by clicking the close (X) button
    const closeButton = screen.getByRole('button', { name: 'Close' })
    await userEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
    })

    // Position record should be preserved (not deleted)
    expect(mockSyncableWrite).not.toHaveBeenCalled()

    // VideoPlayer should render
    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })
  })

  // --- Dialog only shown once per session ---

  it('only shows dialog once per lesson session (ref guard)', async () => {
    mockProgressFirst.mockResolvedValue({
      courseId: 'course-1',
      videoId: 'lesson-1',
      currentTime: 60,
      completionPercentage: 50,
    })

    const { rerender } = render(<LocalVideoContent {...DEFAULT_PROPS} />)

    // Dialog should appear on initial render
    await waitFor(() => {
      expect(screen.getByText('Resume video?')).toBeInTheDocument()
    })

    // Click "Start from Beginning" to dismiss
    await userEvent.click(screen.getByText('Start from Beginning'))

    await waitFor(() => {
      expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
    })

    // Rerender with same props — dialog should NOT reappear
    // (hasShownResumeDialog ref is reset on courseId/lessonId change only)
    rerender(<LocalVideoContent {...DEFAULT_PROPS} />)

    await waitFor(() => {
      expect(screen.getByTestId('player-controls-overlay')).toBeInTheDocument()
    })

    expect(screen.queryByText('Resume video?')).not.toBeInTheDocument()
  })
})
