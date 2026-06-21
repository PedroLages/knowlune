import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import type { ImportedCourse, ImportedVideo, VideoProgress } from '@/data/types'

// Mutable state that hoisted vi.mock can reference
const { mockVideos, mockProgressRecords } = vi.hoisted(() => ({
  mockVideos: [] as ImportedVideo[],
  mockProgressRecords: [] as VideoProgress[],
}))

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
      where: () => ({ equals: () => ({ sortBy: () => Promise.resolve(mockVideos) }) }),
    },
    importedPdfs: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }),
    },
    youtubeChapters: {
      where: () => ({ equals: () => ({ sortBy: () => Promise.resolve([]) }) }),
    },
    progress: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve(mockProgressRecords) }) }),
    },
  },
}))

vi.mock('@/app/components/figma/StudyScheduleEditor', () => ({
  StudyScheduleEditor: () => null,
}))

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

// ---- Test data helpers ----

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  const id = overrides.id ?? 'v1'
  const title = overrides.title ?? 'Test Video'
  return {
    id,
    courseId: 'course-1',
    filename: `${title.toLowerCase().replace(/\s+/g, '-')}.mp4`,
    path: overrides.path ?? `/videos/${id}.mp4`,
    duration: 600,
    format: 'mp4',
    order: overrides.order ?? 0,
    fileHandle: null,
    title,
    moduleTitle: overrides.moduleTitle ?? '',
    ...overrides,
  }
}

function makeProgress(videoId: string, completionPercentage: number): VideoProgress {
  return { courseId: 'course-1', videoId, currentTime: 0, completionPercentage }
}

function seedTestData(videos: ImportedVideo[], progress: VideoProgress[] = []) {
  mockVideos.length = 0
  mockVideos.push(...videos)
  mockProgressRecords.length = 0
  mockProgressRecords.push(...progress)
}

// ---- Tests ----

describe('CourseOverview Syllabus section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVideos.length = 0
    mockProgressRecords.length = 0
  })

  it('renders Syllabus heading after loading completes', async () => {
    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })
  })

  it('does not render lesson count in the Syllabus heading when there are no videos', async () => {
    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

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

    expect(screen.queryByTestId('course-overview-complete-course')).not.toBeInTheDocument()
  })
})

describe('CourseOverview Syllabus — module EntryActionButton states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVideos.length = 0
    mockProgressRecords.length = 0
  })

  it('shows "Start Module" button on an in-progress (active) module', async () => {
    seedTestData(
      [
        makeVideo({ id: 'v1', order: 0, title: 'Intro', path: 'Getting Started/intro.mp4' }),
        makeVideo({ id: 'v2', order: 1, title: 'Setup', path: 'Getting Started/setup.mp4' }),
      ],
      []
    )

    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    expect(screen.getByText('Start Module')).toBeInTheDocument()
  })

  it('shows "Review" button on a completed module', async () => {
    seedTestData(
      [
        makeVideo({ id: 'v1', order: 0, title: 'Intro', path: 'Getting Started/intro.mp4' }),
        makeVideo({ id: 'v2', order: 1, title: 'Setup', path: 'Getting Started/setup.mp4' }),
      ],
      [makeProgress('v1', 100), makeProgress('v2', 95)]
    )

    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('shows Start Module on both incomplete modules (nonlinear access)', async () => {
    seedTestData(
      [
        makeVideo({ id: 'v1', order: 0, title: 'Intro', path: 'Module 1/intro.mp4' }),
        makeVideo({ id: 'v2', order: 1, title: 'Setup', path: 'Module 2/setup.mp4' }),
      ],
      []
    )

    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    // Both modules are incomplete → both have Start Module (no locking)
    const startButtons = screen.getAllByText('Start Module')
    expect(startButtons).toHaveLength(2)
  })

  it('shows "Up Next" badge on first incomplete module and "Open" badge on later modules', async () => {
    seedTestData(
      [
        makeVideo({ id: 'v1', order: 0, title: 'Intro', path: 'Module 1/intro.mp4' }),
        makeVideo({ id: 'v2', order: 1, title: 'Setup', path: 'Module 2/setup.mp4' }),
      ],
      []
    )

    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    // First incomplete module shows Up Next
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    // Later incomplete module shows Open (not Locked)
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.queryByText('Locked')).not.toBeInTheDocument()
  })

  it('renders module number and folder-based group title on module cards', async () => {
    seedTestData([
      makeVideo({ id: 'v1', order: 0, title: 'Intro Video', path: 'Getting Started/intro.mp4' }),
    ])

    renderOverview()

    await waitFor(() => {
      expect(screen.getByText('Syllabus')).toBeInTheDocument()
    })

    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('Module 1')).toBeInTheDocument()
  })
})
