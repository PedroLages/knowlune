import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import type { ImportedCourse } from '@/data/types'

// Mock useParams to return a fixed courseId — keep MemoryRouter real
vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useParams: vi.fn(() => ({ courseId: 'course-1' })),
  }
})

// Mock motion to avoid snapshot drift
vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
  }
})

// Mock the course adapter
const mockCourse: ImportedCourse = {
  id: 'course-1',
  name: 'Test Course',
  importedAt: '2026-01-01T00:00:00Z',
  category: 'general',
  tags: ['test'],
  status: 'active',
  videoCount: 3,
  pdfCount: 1,
  directoryHandle: {} as FileSystemDirectoryHandle,
}

const mockAdapter = {
  getCourse: () => mockCourse,
  getCapabilities: () => ({ supportsChapters: false, supportsPdfs: true, requiresNetwork: false }),
  getAuthorInfo: () => null,
}

vi.mock('@/hooks/useCourseAdapter', () => ({
  useCourseAdapter: () => ({
    adapter: mockAdapter,
    loading: false,
    error: null,
  }),
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector?: any) =>
    selector
      ? selector({ authors: [], loadAuthors: vi.fn() })
      : { authors: [], loadAuthors: vi.fn() },
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: any) =>
      selector
        ? selector({
            importedCourses: [mockCourse],
            updateCourseStatus: vi.fn(),
          })
        : { importedCourses: [mockCourse], updateCourseStatus: vi.fn() },
    { getState: () => ({ updateCourseStatus: vi.fn() }) }
  ),
}))

vi.mock('@/hooks/useLazyStore', () => ({
  useLazyStore: vi.fn(),
}))

vi.mock('@/lib/searchFrecency', () => ({
  recordVisit: vi.fn(),
}))

vi.mock('@/lib/progress', () => ({
  getLastWatchedLesson: () => Promise.resolve(null),
  getFirstLesson: () => Promise.resolve({ lessonId: 'v1', lessonTitle: 'First Lesson' }),
}))

vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      where: () => ({ equals: () => ({ sortBy: () => Promise.resolve([]) }) }),
    },
    importedPdfs: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }),
    },
    youtubeChapters: {
      where: () => ({ equals: () => ({ sortBy: () => Promise.resolve([]) }) }),
    },
    progress: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }),
    },
  },
}))

vi.mock('@/app/components/figma/StudyScheduleEditor', () => ({
  StudyScheduleEditor: () => null,
}))

// Import after all mocks are set up
// Import after all mocks are set up (vi.mock hoisted)
import { CourseOverview } from '@/app/pages/CourseOverview'

function renderOverview() {
  return render(
    <MotionConfig reducedMotion="always">
      <MemoryRouter initialEntries={['/courses/course-1']}>
        <CourseOverview />
      </MemoryRouter>
    </MotionConfig>
  )
}

describe('CourseOverview Syllabus section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Syllabus heading after loading completes', async () => {
    renderOverview()

    // Wait for the async content loading to resolve (Dexie queries)
    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })
  })

  it('does not render lesson count in the Syllabus heading when there are no videos', async () => {
    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    // The Syllabus heading only shows a lesson count when videos.length > 0
    // The "0 of 0 lessons" text in the sidebar is a separate element — not affected
    const syllabusHeading = screen.getByText('Syllabus').closest('div')
    expect(syllabusHeading?.querySelector('.text-muted-foreground')).toBeNull()
  })

  it('renders the page with testid for the root container after loading', async () => {
    renderOverview()

    await waitFor(() => {
      expect(screen.getByTestId('course-overview-page')).toBeInTheDocument()
    })
  })

  it('does not render Complete Course button when course has no videos', async () => {
    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    // Button only shows when videos.length > 0
    expect(screen.queryByTestId('course-overview-complete-course')).not.toBeInTheDocument()
  })
})
