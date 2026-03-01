import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'
import { ImportedCourseDetail } from '../ImportedCourseDetail'

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

vi.mock('@/db/schema', () => ({
  db: {
    importedVideos: {
      where: () => ({
        equals: () => ({
          sortBy: () => Promise.resolve(mockVideos),
        }),
      }),
    },
    importedPdfs: {
      where: () => ({
        equals: () => ({
          toArray: () => Promise.resolve(mockPdfs),
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
  })

  it('renders page with course title', () => {
    renderDetail()
    expect(screen.getByTestId('imported-course-detail')).toBeInTheDocument()
    expect(screen.getByTestId('course-detail-title')).toHaveTextContent('React Fundamentals')
  })

  it('renders video items with correct testids', async () => {
    renderDetail()
    const videoItems = await screen.findAllByTestId('course-content-item-video')
    expect(videoItems).toHaveLength(2)
    expect(videoItems[0]).toHaveTextContent('01-Introduction.mp4')
    expect(videoItems[1]).toHaveTextContent('02-Components.mp4')
  })

  it('renders PDF items with correct testids', async () => {
    renderDetail()
    const pdfItems = await screen.findAllByTestId('course-content-item-pdf')
    expect(pdfItems).toHaveLength(1)
    expect(pdfItems[0]).toHaveTextContent('slides.pdf')
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

  it('video items link to lesson player route', async () => {
    renderDetail()
    const videoItems = await screen.findAllByTestId('course-content-item-video')
    const link = videoItems[0].querySelector('a')
    expect(link).toHaveAttribute('href', '/imported-courses/course-1/lessons/v1')
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
})
