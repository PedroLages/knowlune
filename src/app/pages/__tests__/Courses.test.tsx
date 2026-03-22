import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { Course, ImportedCourse } from '@/data/types'

// Controlled pre-seeded course store
const courseStoreState = {
  courses: [] as Course[],
}

vi.mock('@/stores/useCourseStore', () => ({
  useCourseStore: (selector: (state: typeof courseStoreState) => unknown) =>
    selector(courseStoreState),
}))

// Mock CourseCard to render a simple article with title h3
vi.mock('@/app/components/figma/CourseCard', () => ({
  CourseCard: ({ course }: { course: Course }) => (
    <article>
      <h3>{course.title}</h3>
    </article>
  ),
  categoryLabels: {
    'behavioral-analysis': 'Behavioral Analysis',
    'influence-authority': 'Influence & Authority',
    'confidence-mastery': 'Confidence & Mastery',
    'operative-training': 'Operative Training',
    'research-library': 'Research Library',
  },
}))

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
  }
})

const mockCourses: ImportedCourse[] = [
  {
    id: 'c1',
    name: 'Older Course',
    importedAt: '2026-01-01T00:00:00Z',
    category: 'general',
    tags: ['alpha'],
    status: 'active',
    videoCount: 3,
    pdfCount: 1,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
  {
    id: 'c2',
    name: 'Newer Course',
    importedAt: '2026-02-10T00:00:00Z',
    category: 'general',
    tags: ['beta'],
    status: 'active',
    videoCount: 7,
    pdfCount: 2,
    directoryHandle: {} as FileSystemDirectoryHandle,
  },
]

const storeState = {
  importedCourses: [] as ImportedCourse[],
  isImporting: false,
  importError: null as string | null,
  importProgress: null,
  thumbnailUrls: {} as Record<string, string>,
  autoAnalysisStatus: {} as Record<string, unknown>,
  addImportedCourse: vi.fn(),
  removeImportedCourse: vi.fn(),
  updateCourseTags: vi.fn(),
  updateCourseStatus: vi.fn(),
  getAllTags: () => [] as string[],
  loadImportedCourses: vi.fn(),
  loadThumbnailUrls: vi.fn(),
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
  setAutoAnalysisStatus: vi.fn(),
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}))

vi.mock('@/lib/courseImport', () => ({
  importCourseFromFolder: vi.fn(),
}))

vi.mock('@/lib/progress', () => ({
  getCourseCompletionPercent: () => 0,
  getProgress: () => ({
    lastWatchedLesson: null,
    completedLessons: [],
    videoPositions: {},
    pdfPages: {},
    notes: {},
  }),
}))

vi.mock('@/hooks/useCourseCardPreview', () => ({
  useCourseCardPreview: () => ({
    showPreview: false,
    videoReady: false,
    setVideoReady: vi.fn(),
    previewHandlers: { onMouseEnter: vi.fn(), onMouseLeave: vi.fn() },
    previewOpen: false,
    setPreviewOpen: vi.fn(),
    infoOpen: false,
    setInfoOpen: vi.fn(),
    guardNavigation: vi.fn(),
  }),
}))

vi.mock('@/hooks/useVideoFromHandle', () => ({
  useVideoFromHandle: () => ({ videoUrl: null, error: null }),
}))

vi.mock('@/db/schema', () => ({
  db: { importedVideos: { where: () => ({ toArray: () => Promise.resolve([]) }) } },
}))

vi.mock('@/app/components/figma/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}))

vi.mock('@/app/components/figma/ThumbnailPickerDialog', () => ({
  ThumbnailPickerDialog: () => null,
}))

vi.mock('@/app/components/figma/MomentumBadge', () => ({
  MomentumBadge: () => null,
}))

// Import component AFTER all mocks
import { Courses } from '../Courses'

function renderCourses() {
  return render(
    <MemoryRouter>
      <Courses />
    </MemoryRouter>
  )
}

describe('Courses page', () => {
  beforeEach(() => {
    storeState.importedCourses = []
    storeState.loadImportedCourses = vi.fn()
    courseStoreState.courses = []
  })

  describe('empty state', () => {
    it('displays empty state when no imported courses', () => {
      renderCourses()
      expect(screen.getByText('No imported courses yet.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import your first course/i })).toBeInTheDocument()
    })

    it('empty state is shown in the Import courses region', () => {
      const { container } = renderCourses()
      const emptyCard = container.querySelector('[role="region"][aria-label="Import courses"]')
      expect(emptyCard).toBeInTheDocument()
    })
  })

  describe('with imported courses', () => {
    beforeEach(() => {
      storeState.importedCourses = mockCourses
    })

    it('renders imported course cards', () => {
      renderCourses()
      expect(screen.getByText('Older Course')).toBeInTheDocument()
      expect(screen.getByText('Newer Course')).toBeInTheDocument()
    })

    it('sorts courses by most recently imported (newest first)', () => {
      renderCourses()
      const headings = screen.getAllByRole('heading', { level: 3 })
      const importedHeadings = headings.filter(
        h => h.textContent === 'Newer Course' || h.textContent === 'Older Course'
      )
      expect(importedHeadings[0]).toHaveTextContent('Newer Course')
      expect(importedHeadings[1]).toHaveTextContent('Older Course')
    })

    it('uses 4-column grid on imported courses section', () => {
      const { container } = renderCourses()
      const grid = container.querySelector('.lg\\:grid-cols-4')
      expect(grid).toBeInTheDocument()
    })
  })

  describe('status filtering', () => {
    const mixedCourses: ImportedCourse[] = [
      {
        id: 'active-1',
        name: 'Active Course',
        importedAt: '2026-02-01T00:00:00Z',
        category: 'general',
        tags: ['alpha'],
        status: 'active',
        videoCount: 3,
        pdfCount: 1,
        directoryHandle: {} as FileSystemDirectoryHandle,
      },
      {
        id: 'completed-1',
        name: 'Completed Course',
        importedAt: '2026-02-02T00:00:00Z',
        category: 'general',
        tags: ['beta'],
        status: 'completed',
        videoCount: 5,
        pdfCount: 2,
        directoryHandle: {} as FileSystemDirectoryHandle,
      },
      {
        id: 'paused-1',
        name: 'Paused Course',
        importedAt: '2026-02-03T00:00:00Z',
        category: 'general',
        tags: ['alpha'],
        status: 'paused',
        videoCount: 2,
        pdfCount: 0,
        directoryHandle: {} as FileSystemDirectoryHandle,
      },
    ]

    beforeEach(() => {
      storeState.importedCourses = mixedCourses
      storeState.getAllTags = () => ['alpha', 'beta']
    })

    it('renders status filter bar when imported courses exist', () => {
      renderCourses()
      expect(screen.getByTestId('status-filter-bar')).toBeInTheDocument()
    })

    it('shows all courses when no status filter is selected', () => {
      renderCourses()
      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.getByText('Completed Course')).toBeInTheDocument()
      expect(screen.getByText('Paused Course')).toBeInTheDocument()
    })

    it('filters courses by selected status', async () => {
      const user = userEvent.setup()
      renderCourses()

      const statusButtons = screen.getAllByTestId('status-filter-button')
      // Click the "Completed" filter (second button)
      await user.click(statusButtons[1])

      expect(screen.queryByText('Active Course')).not.toBeInTheDocument()
      expect(screen.getByText('Completed Course')).toBeInTheDocument()
      expect(screen.queryByText('Paused Course')).not.toBeInTheDocument()
    })

    it('shows clear button when status filter is active', async () => {
      const user = userEvent.setup()
      renderCourses()

      expect(screen.queryByTestId('clear-status-filters')).not.toBeInTheDocument()

      const statusButtons = screen.getAllByTestId('status-filter-button')
      await user.click(statusButtons[0])

      expect(screen.getByTestId('clear-status-filters')).toBeInTheDocument()
    })

    it('clears status filters when clear button is clicked', async () => {
      const user = userEvent.setup()
      renderCourses()

      const statusButtons = screen.getAllByTestId('status-filter-button')
      await user.click(statusButtons[0]) // Select Active

      expect(screen.queryByText('Completed Course')).not.toBeInTheDocument()

      await user.click(screen.getByTestId('clear-status-filters'))

      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.getByText('Completed Course')).toBeInTheDocument()
      expect(screen.getByText('Paused Course')).toBeInTheDocument()
    })

    it('uses aria-pressed on status filter buttons', () => {
      renderCourses()
      const statusButtons = screen.getAllByTestId('status-filter-button')
      statusButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed', 'false')
      })
    })
  })

  const coursesWithAiTags: ImportedCourse[] = [
    {
      id: 'ai-1',
      name: 'Python Basics',
      importedAt: '2026-01-01T00:00:00Z',
      category: '',
      tags: ['python', 'beginner'],
      status: 'active',
      videoCount: 5,
      pdfCount: 0,
      directoryHandle: {} as FileSystemDirectoryHandle,
    },
    {
      id: 'ai-2',
      name: 'Advanced Python',
      importedAt: '2026-01-02T00:00:00Z',
      category: '',
      tags: ['python', 'advanced'],
      status: 'active',
      videoCount: 8,
      pdfCount: 1,
      directoryHandle: {} as FileSystemDirectoryHandle,
    },
    {
      id: 'ai-3',
      name: 'Data Science',
      importedAt: '2026-01-03T00:00:00Z',
      category: '',
      tags: ['data science'],
      status: 'active',
      videoCount: 3,
      pdfCount: 0,
      directoryHandle: {} as FileSystemDirectoryHandle,
    },
  ]

  describe('unified filter chips (AC1-AC5)', () => {
    beforeEach(() => {
      storeState.importedCourses = coursesWithAiTags
    })

    it('renders a single ToggleGroup (not a separate TopicFilter)', () => {
      renderCourses()
      expect(screen.queryByTestId('topic-filter-bar')).not.toBeInTheDocument()
      expect(
        screen.getByRole('group', { name: /filter by category or topic/i })
      ).toBeInTheDocument()
    })

    it('shows "All Courses" chip selected by default (AC1)', () => {
      renderCourses()
      const chip = screen.getByRole('radio', { name: 'All Courses' })
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveAttribute('data-state', 'on')
    })

    it('shows AI tag chips from imported courses (AC1)', () => {
      renderCourses()
      expect(screen.getByRole('radio', { name: 'Python' })).toBeInTheDocument()
    })

    it('shows "Clear filters" button only when filter is active (AC4)', async () => {
      const user = userEvent.setup()
      renderCourses()

      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

      await user.click(screen.getByRole('radio', { name: 'Python' }))

      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })

    it('clears filter when "Clear filters" is clicked (AC4)', async () => {
      const user = userEvent.setup()
      renderCourses()

      await user.click(screen.getByRole('radio', { name: 'Python' }))

      expect(screen.getByRole('heading', { name: 'Python Basics' })).toBeInTheDocument()
      // "Data Science" appears as a chip label; check course card heading is hidden
      expect(screen.queryByRole('heading', { name: 'Data Science' })).not.toBeInTheDocument()

      await user.click(screen.getByText('Clear filters'))

      expect(screen.getByRole('heading', { name: 'Python Basics' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Data Science' })).toBeInTheDocument()
      // "All Courses" chip returns to active after clearing
      expect(screen.getByRole('radio', { name: 'All Courses' })).toHaveAttribute('data-state', 'on')
    })

    it('filters imported courses by AI tag (AC3)', async () => {
      const user = userEvent.setup()
      renderCourses()

      await user.click(screen.getByRole('radio', { name: 'Python' }))

      expect(screen.getByRole('heading', { name: 'Python Basics' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Advanced Python' })).toBeInTheDocument()
      // Course card heading hidden; chip label still in ToggleGroup
      expect(screen.queryByRole('heading', { name: 'Data Science' })).not.toBeInTheDocument()
    })

    it('filters pre-seeded courses by category when chip is selected (AC3)', async () => {
      const user = userEvent.setup()
      // Add a pre-seeded course with 'behavioral-analysis' category
      courseStoreState.courses = [
        {
          id: 'seed-ba-1',
          title: 'Behavioral Analysis Fundamentals',
          shortTitle: 'BA Fundamentals',
          description: 'Core behavioral analysis skills',
          category: 'behavioral-analysis',
          difficulty: 'intermediate',
          totalLessons: 5,
          totalVideos: 5,
          totalPDFs: 0,
          estimatedHours: 2,
          tags: [],
          modules: [],
          isSequential: false,
          basePath: '/test',
          instructorId: 'instructor-1',
        },
        {
          id: 'seed-op-1',
          title: 'Operative Training Course',
          shortTitle: 'Operative Training',
          description: 'Operative training basics',
          category: 'operative-training',
          difficulty: 'advanced',
          totalLessons: 8,
          totalVideos: 8,
          totalPDFs: 0,
          estimatedHours: 4,
          tags: [],
          modules: [],
          isSequential: false,
          basePath: '/test',
          instructorId: 'instructor-1',
        },
      ] as Course[]

      renderCourses()

      // Both pre-seeded courses visible initially
      expect(screen.getByRole('heading', { name: 'Behavioral Analysis Fundamentals' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Operative Training Course' })).toBeInTheDocument()

      // Click the 'Behavioral Analysis' chip (from pre-seeded category)
      await user.click(screen.getByRole('radio', { name: 'Behavioral Analysis' }))

      // Only behavioral-analysis course visible
      expect(screen.getByRole('heading', { name: 'Behavioral Analysis Fundamentals' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Operative Training Course' })).not.toBeInTheDocument()
    })

    it('updates filter chips when importedCourses store changes (AC5)', async () => {
      const { rerender } = renderCourses()

      // No neuroscience chip initially
      expect(screen.queryByRole('radio', { name: 'Neuroscience' })).not.toBeInTheDocument()

      // Simulate store update (as Zustand would trigger a re-render in production)
      act(() => {
        storeState.importedCourses = [
          {
            id: 'neuro-1',
            name: 'Neuroscience Basics',
            importedAt: '2026-03-01T00:00:00Z',
            category: '',
            tags: ['neuroscience'],
            status: 'active',
            videoCount: 5,
            pdfCount: 0,
            directoryHandle: {} as FileSystemDirectoryHandle,
          },
        ]
      })

      rerender(
        <MemoryRouter>
          <Courses />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'Neuroscience' })).toBeInTheDocument()
      })
    })
  })
})
