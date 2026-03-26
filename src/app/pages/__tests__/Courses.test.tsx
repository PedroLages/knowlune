import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { ImportedCourse } from '@/data/types'

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
  autoAnalysisStatus: {} as Record<string, string>,
  addImportedCourse: vi.fn(),
  removeImportedCourse: vi.fn(),
  updateCourseTags: vi.fn(),
  updateCourseStatus: vi.fn(),
  updateCourseDetails: vi.fn().mockResolvedValue(true),
  getAllTags: () => [] as string[],
  getTagsWithCounts: () => [] as { tag: string; count: number }[],
  loadImportedCourses: vi.fn(),
  setImporting: vi.fn(),
  setImportError: vi.fn(),
  setImportProgress: vi.fn(),
  renameTagGlobally: vi.fn().mockResolvedValue(undefined),
  deleteTagGlobally: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (state: typeof storeState) => unknown) =>
      selector ? selector(storeState) : storeState,
    {
      getState: () => storeState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

// Mock dialog components to avoid deep dependency trees (usePathPlacementSuggestion, useLearningPathStore)
vi.mock('@/app/components/figma/ImportWizardDialog', () => ({
  ImportWizardDialog: () => null,
}))

vi.mock('@/app/components/figma/BulkImportDialog', () => ({
  BulkImportDialog: () => null,
}))

vi.mock('@/app/components/figma/YouTubeImportDialog', () => ({
  YouTubeImportDialog: () => null,
}))

vi.mock('@/app/components/figma/TagManagementPanel', () => ({
  TagManagementPanel: () => null,
}))

vi.mock('@/lib/courseImport', () => ({
  importCourseFromFolder: vi.fn(),
}))

// Pre-seeded course mock data for Sample Courses section tests
const mockPreSeededCourses = [
  {
    id: 'authority',
    title: 'Authority',
    shortTitle: 'Authority',
    description: 'Influence',
    category: 'influence-authority',
    difficulty: 'intermediate',
    totalLessons: 10,
    totalVideos: 8,
    totalPDFs: 2,
    estimatedHours: 5,
    tags: ['influence'],
    coverImage: undefined,
    modules: [],
    isSequential: false,
    basePath: '/courses/authority',
    authorId: 'chase-hughes',
  },
]

const courseStoreState = {
  courses: [] as typeof mockPreSeededCourses,
  isLoaded: false,
  loadCourses: vi.fn(),
}

vi.mock('@/stores/useCourseStore', () => ({
  useCourseStore: (selector: (state: typeof courseStoreState) => unknown) =>
    selector(courseStoreState),
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
  db: {
    importedVideos: { where: () => ({ toArray: () => Promise.resolve([]) }) },
    studySessions: { toArray: () => Promise.resolve([]) },
  },
}))

vi.mock('@/db', () => ({
  db: {
    importedVideos: { where: () => ({ toArray: () => Promise.resolve([]) }) },
    studySessions: { toArray: () => Promise.resolve([]) },
  },
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

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authors: [],
      loadAuthors: vi.fn(),
    }),
}))

vi.mock('@/lib/authors', () => ({
  getAuthorForCourse: () => undefined,
  getAuthorForImportedCourse: () => undefined,
  getAvatarSrc: () => ({ src: '' }),
  getInitials: (name: string) =>
    name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase(),
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
    localStorage.clear()
  })

  describe('empty state', () => {
    it('displays global empty state when no courses at all', () => {
      renderCourses()
      expect(screen.getByText('No courses yet')).toBeInTheDocument()
      expect(screen.getByText(/Import a course folder/)).toBeInTheDocument()
    })

    it('global empty state has correct test id', () => {
      renderCourses()
      expect(screen.getByTestId('courses-empty-state')).toBeInTheDocument()
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

    it('combines status and topic filters (AC-2.2 — proves AND-semantics)', async () => {
      // Strengthen fixture: add course that matches ONE dimension but not both
      const strongFixture: ImportedCourse[] = [
        ...mixedCourses,
        {
          id: 'active-2',
          name: 'Active Beta Course', // Active status + beta tag
          importedAt: '2026-02-04T00:00:00Z',
          category: 'general',
          tags: ['beta'],
          status: 'active',
          videoCount: 4,
          pdfCount: 1,
          directoryHandle: {} as FileSystemDirectoryHandle,
        },
      ]
      storeState.importedCourses = strongFixture
      storeState.getAllTags = () => ['alpha', 'beta']

      const user = userEvent.setup()
      renderCourses()

      // Select "Active" status filter
      const statusButtons = screen.getAllByTestId('status-filter-button')
      await user.click(statusButtons[0])

      // Should show both Active courses (Active Course + Active Beta Course)
      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.getByText('Active Beta Course')).toBeInTheDocument()
      expect(screen.queryByText('Completed Course')).not.toBeInTheDocument()

      // Now ALSO select "alpha" topic filter (AND-condition)
      const topicButtons = screen.getAllByTestId('topic-filter-button')
      const alphaButton = topicButtons.find(b => b.textContent?.includes('alpha'))
      if (alphaButton) await user.click(alphaButton)

      // Should ONLY show Active Course (active + alpha)
      // Active Beta Course should be hidden (active + beta, missing alpha)
      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.queryByText('Active Beta Course')).not.toBeInTheDocument()
      expect(screen.queryByText('Paused Course')).not.toBeInTheDocument()
    })

    it('uses aria-pressed on status filter buttons', () => {
      renderCourses()
      const statusButtons = screen.getAllByTestId('status-filter-button')
      statusButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed', 'false')
      })
    })
  })

  describe('momentum sort for imported courses (E1C-S05)', () => {
    beforeEach(() => {
      storeState.importedCourses = mockCourses
    })

    it('renders sort dropdown in filter bar', () => {
      renderCourses()
      expect(screen.getByTestId('sort-select')).toBeInTheDocument()
    })

    it('defaults to "Most Recent" sort (newest importedAt first)', () => {
      renderCourses()
      const headings = screen.getAllByRole('heading', { level: 3 })
      const importedHeadings = headings.filter(
        h => h.textContent === 'Newer Course' || h.textContent === 'Older Course'
      )
      expect(importedHeadings[0]).toHaveTextContent('Newer Course')
      expect(importedHeadings[1]).toHaveTextContent('Older Course')
    })

    it('sort dropdown has accessible label', () => {
      renderCourses()
      expect(screen.getByLabelText('Sort courses')).toBeInTheDocument()
    })
  })

  describe('sample courses section', () => {
    beforeEach(() => {
      courseStoreState.courses = mockPreSeededCourses
      localStorage.clear()
    })

    it('renders "Sample Courses (N)" heading with count', () => {
      renderCourses()
      expect(screen.getByRole('heading', { name: /sample courses \(1\)/i })).toBeInTheDocument()
    })

    it('renders the sample-courses-section container', () => {
      renderCourses()
      expect(screen.getByTestId('sample-courses-section')).toBeInTheDocument()
    })

    it('sample courses grid is visible by default when no imported courses', () => {
      renderCourses()
      expect(screen.getByTestId('sample-courses-grid')).toBeInTheDocument()
    })

    it('toggle button has correct aria-label when expanded', () => {
      renderCourses()
      const toggle = screen.getByTestId('sample-courses-toggle')
      expect(toggle).toHaveAttribute('aria-label', 'Collapse sample courses')
    })

    it('sample courses section is not shown when allCourses is empty', () => {
      courseStoreState.courses = []
      renderCourses()
      expect(screen.queryByTestId('sample-courses-section')).not.toBeInTheDocument()
    })

    it('reads collapse state from localStorage on mount and starts collapsed', () => {
      // Need imported courses so auto-expand effect (importedCourses.length === 0 → expand) doesn't fire
      storeState.importedCourses = mockCourses
      localStorage.setItem('knowlune:sample-courses-collapsed', 'true')
      renderCourses()
      // Grid should not be present when collapsed
      expect(screen.queryByTestId('sample-courses-grid')).not.toBeInTheDocument()
    })

    it('persists collapse state to localStorage when toggled', async () => {
      // Need imported courses so auto-expand effect (importedCourses.length === 0 → expand) doesn't undo the toggle
      storeState.importedCourses = mockCourses
      // Pre-set localStorage so auto-collapse effect doesn't also write on mount
      localStorage.setItem('knowlune:sample-courses-collapsed', 'false')
      const user = userEvent.setup()
      renderCourses()
      // Starts expanded (grid visible)
      expect(screen.getByTestId('sample-courses-grid')).toBeInTheDocument()
      // Click toggle to collapse
      await user.click(screen.getByTestId('sample-courses-toggle'))
      expect(localStorage.getItem('knowlune:sample-courses-collapsed')).toBe('true')
    })
  })
})
