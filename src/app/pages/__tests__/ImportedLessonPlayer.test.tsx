import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ImportedCourse, ImportedVideo } from '@/data/types'
import { ImportedLessonPlayer } from '../ImportedLessonPlayer'

const mockCourse: ImportedCourse = {
  id: 'course-1',
  name: 'React Fundamentals',
  importedAt: '2026-01-15T10:00:00Z',
  category: 'general',
  tags: [],
  status: 'active',
  videoCount: 2,
  pdfCount: 0,
  directoryHandle: {} as FileSystemDirectoryHandle,
}

const mockVideo: ImportedVideo = {
  id: 'v1',
  courseId: 'course-1',
  filename: '01-Introduction.mp4',
  path: '/01-Introduction.mp4',
  duration: 320,
  format: 'mp4',
  order: 0,
  fileHandle: null as unknown as FileSystemFileHandle, // null → triggers error state
}

const storeState = {
  importedCourses: [mockCourse] as ImportedCourse[],
  isImporting: false,
  importError: null as string | null,
  importProgress: null,
  addImportedCourse: vi.fn(),
  removeImportedCourse: vi.fn(),
  updateCourseTags: vi.fn(),
  updateCourseStatus: vi.fn(),
  getAllTags: () => [] as string[],
  loadImportedCourses: vi.fn(),
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}))

let mockVideoRecord: ImportedVideo | null | undefined = mockVideo

vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: {
      get: vi.fn(() => Promise.resolve(mockVideoRecord)),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/hooks/useVideoFromHandle', () => ({
  useVideoFromHandle: vi.fn(() => ({ blobUrl: null, error: 'file-not-found', loading: false })),
}))

vi.mock('@/app/components/figma/VideoPlayer', () => ({
  VideoPlayer: ({ src, title }: { src: string; title: string }) => (
    <div data-testid="video-player-container">
      <span data-testid="vp-src">{src}</span>
      <span data-testid="vp-title">{title}</span>
    </div>
  ),
}))

function renderPlayer(courseId = 'course-1', lessonId = 'v1') {
  return render(
    <MemoryRouter initialEntries={[`/courses/${courseId}/lessons/${lessonId}`]}>
      <Routes>
        <Route path="/courses/:courseId/lessons/:lessonId" element={<ImportedLessonPlayer />} />
        <Route path="/courses/:courseId" element={<div>Course Detail</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ImportedLessonPlayer', () => {
  beforeEach(() => {
    mockVideoRecord = mockVideo
    storeState.importedCourses = [mockCourse]
  })

  it('renders lesson player content container', async () => {
    renderPlayer()
    expect(await screen.findByTestId('lesson-player-content')).toBeInTheDocument()
  })

  it('shows video filename in header', async () => {
    renderPlayer()
    expect(await screen.findByTestId('lesson-header-title')).toHaveTextContent(
      '01-Introduction.mp4'
    )
  })

  it('shows course name in header', async () => {
    renderPlayer()
    expect(await screen.findByTestId('lesson-header-course')).toHaveTextContent(
      'React Fundamentals'
    )
  })

  it('shows error state when file handle is null (AC-2)', async () => {
    renderPlayer()
    expect(await screen.findByTestId('lesson-error-state')).toBeInTheDocument()
  })

  it('error state contains "Video file not found" message', async () => {
    renderPlayer()
    await screen.findByTestId('lesson-error-state')
    expect(screen.getByText(/video file not found/i)).toBeInTheDocument()
  })

  it('"Locate File" button is visible in error state', async () => {
    renderPlayer()
    await screen.findByTestId('lesson-error-state')
    expect(screen.getByRole('button', { name: /locate file/i })).toBeInTheDocument()
  })

  it('"Back to Course" link is visible in error state', async () => {
    renderPlayer()
    const errorState = await screen.findByTestId('lesson-error-state')
    const backLink = errorState.querySelector('a[href*="courses/course-1"]')
    expect(backLink).toBeInTheDocument()
  })

  it('renders video player when blobUrl is available', async () => {
    const { useVideoFromHandle } = await import('@/hooks/useVideoFromHandle')
    vi.mocked(useVideoFromHandle).mockReturnValue({
      blobUrl: 'blob:test-url',
      error: null,
      loading: false,
    })

    renderPlayer()
    expect(await screen.findByTestId('video-player-container')).toBeInTheDocument()
    expect(screen.getByTestId('vp-src')).toHaveTextContent('blob:test-url')
  })

  it('shows not found state when video record is null', async () => {
    mockVideoRecord = null
    renderPlayer()
    expect(await screen.findByText('Video not found.')).toBeInTheDocument()
  })
})
