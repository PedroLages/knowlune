import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'
import type { FileStatus } from '@/lib/fileVerification'
import { ImportedCourseDetail } from '../ImportedCourseDetail'

// Mock file verification to return all items as 'available' by default
const mockStatusMap = new Map<string, FileStatus>()
vi.mock('@/hooks/useFileStatusVerification', () => ({
  useFileStatusVerification: () => mockStatusMap,
}))

const mockCourse: ImportedCourse = {
  id: 'course-1',
  name: 'React Fundamentals',
  importedAt: '2026-01-15T10:00:00Z',
  category: 'general',
  tags: [],
  status: 'active',
  videoCount: 2,
  pdfCount: 1,
  directoryHandle: {} as FileSystemDirectoryHandle,
}

const mockVideos: ImportedVideo[] = [
  {
    id: 'v1',
    courseId: 'course-1',
    filename: '01-Introduction.mp4',
    path: '/01-Introduction.mp4',
    duration: 320,
    format: 'mp4',
    order: 0,
    fileHandle: {} as FileSystemFileHandle,
  },
  {
    id: 'v2',
    courseId: 'course-1',
    filename: '02-Components.mp4',
    path: '/02-Components.mp4',
    duration: 0,
    format: 'mp4',
    order: 1,
    fileHandle: {} as FileSystemFileHandle,
  },
]

const mockPdfs: ImportedPdf[] = [
  {
    id: 'p1',
    courseId: 'course-1',
    filename: 'slides.pdf',
    path: '/slides.pdf',
    pageCount: 12,
    fileHandle: {} as FileSystemFileHandle,
  },
]

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

let mockDbShouldReject = false
vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: {
      where: () => ({
        equals: () => ({
          sortBy: () =>
            mockDbShouldReject
              ? Promise.reject(new Error('IndexedDB read failed'))
              : Promise.resolve(mockVideos),
        }),
      }),
    },
    importedPdfs: {
      where: () => ({
        equals: () => ({
          toArray: () =>
            mockDbShouldReject
              ? Promise.reject(new Error('IndexedDB read failed'))
              : Promise.resolve(mockPdfs),
        }),
      }),
    },
  },
}))

function renderDetail(courseId = 'course-1') {
  return render(
    <MemoryRouter initialEntries={[`/imported-courses/${courseId}`]}>
      <Routes>
        <Route path="/imported-courses/:courseId" element={<ImportedCourseDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ImportedCourseDetail', () => {
  beforeEach(() => {
    storeState.importedCourses = [mockCourse]
    mockDbShouldReject = false
    // Default: all files available
    mockStatusMap.clear()
    mockStatusMap.set('v1', 'available')
    mockStatusMap.set('v2', 'available')
    mockStatusMap.set('p1', 'available')
  })

  it('renders page with course title', () => {
    renderDetail()
    expect(screen.getByTestId('imported-course-detail')).toBeInTheDocument()
    expect(screen.getByTestId('course-detail-title')).toHaveTextContent('React Fundamentals')
  })

  it('renders video items with correct testids', async () => {
    renderDetail()
    const v1 = await screen.findByTestId('course-content-item-video-v1')
    const v2 = await screen.findByTestId('course-content-item-video-v2')
    expect(v1).toHaveTextContent('01-Introduction.mp4')
    expect(v2).toHaveTextContent('02-Components.mp4')
  })

  it('renders PDF items with correct testids', async () => {
    renderDetail()
    const p1 = await screen.findByTestId('course-content-item-pdf-p1')
    expect(p1).toHaveTextContent('slides.pdf')
  })

  it('renders content type icons', async () => {
    renderDetail()
    const icons = await screen.findAllByTestId('content-type-icon')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('formats video duration correctly (320s → "5:20")', async () => {
    renderDetail()
    expect(await screen.findByText('5:20')).toBeInTheDocument()
  })

  it('video items link to lesson player route when available', async () => {
    renderDetail()
    const v1 = await screen.findByTestId('course-content-item-video-v1')
    const link = v1.querySelector('a')
    expect(link).toHaveAttribute('href', '/imported-courses/course-1/lessons/v1')
  })

  it('missing files show badge and are not clickable', async () => {
    mockStatusMap.set('v1', 'missing')
    renderDetail()
    const badge = await screen.findByTestId('file-not-found-badge-v1')
    expect(badge).toHaveTextContent('File not found')
    const v1 = screen.getByTestId('course-content-item-video-v1')
    expect(v1.querySelector('a')).toBeNull()
  })

  it('shows "Back to Courses" link', () => {
    renderDetail()
    expect(screen.getByRole('link', { name: /back to courses/i })).toHaveAttribute(
      'href',
      '/courses'
    )
  })

  it('shows not found message when course does not exist', () => {
    storeState.importedCourses = []
    renderDetail('unknown-id')
    expect(screen.getByText('Course not found.')).toBeInTheDocument()
  })

  it('renders course content list container', async () => {
    renderDetail()
    expect(screen.getByTestId('course-content-list')).toBeInTheDocument()
  })

  // AC3: Mixed available + missing state
  it('available items remain clickable when sibling items are missing', async () => {
    mockStatusMap.set('v1', 'available')
    mockStatusMap.set('v2', 'missing')
    renderDetail()

    const v1 = await screen.findByTestId('course-content-item-video-v1')
    expect(v1.querySelector('a')).toHaveAttribute('href', '/imported-courses/course-1/lessons/v1')

    const v2 = screen.getByTestId('course-content-item-video-v2')
    expect(v2.querySelector('a')).toBeNull()
    expect(screen.getByTestId('file-not-found-badge-v2')).toBeInTheDocument()
  })

  // AC4: Recovery — badge removed when status changes to available
  it('badge removed when file status changes to available', async () => {
    mockStatusMap.set('v1', 'missing')
    const { unmount } = renderDetail()
    expect(await screen.findByTestId('file-not-found-badge-v1')).toBeInTheDocument()
    unmount()

    mockStatusMap.set('v1', 'available')
    renderDetail()
    await screen.findByTestId('course-content-item-video-v1')
    expect(screen.queryByTestId('file-not-found-badge-v1')).toBeNull()
  })

  // Permission-denied state
  // Note: Design spec (1-5-detect-missing-or-relocated-files.md:94) states permission-denied
  // items should be "Clickable — triggers re-permission prompt", but current implementation
  // renders them as non-clickable (same as missing). This is a known deviation flagged in
  // design review — permission re-auth flow deferred to a future story.
  it('permission-denied files show permission badge and are not clickable', async () => {
    mockStatusMap.set('v1', 'permission-denied')
    renderDetail()

    const badge = await screen.findByTestId('file-permission-badge-v1')
    expect(badge).toHaveTextContent('Permission needed')
    const v1 = screen.getByTestId('course-content-item-video-v1')
    expect(v1.querySelector('a')).toBeNull()
  })

  it('shows error message when Dexie query fails', async () => {
    mockDbShouldReject = true
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderDetail()
    expect(await screen.findByTestId('course-load-error')).toBeInTheDocument()
    expect(screen.getByText('Failed to load course content.')).toBeInTheDocument()
  })
})
