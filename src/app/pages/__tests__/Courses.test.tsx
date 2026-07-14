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
  removeImportedCourses: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/lib/progress', () => ({
  getImportedCourseCompletionPercent: () => Promise.resolve(0),
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

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authors: [],
      loadAuthors: vi.fn(),
    }),
}))

vi.mock('@/app/components/figma/HeaderSearchButton', () => ({
  HeaderSearchButton: ({ scope }: { scope: string }) => (
    <button data-testid={`header-search-btn-${scope}`}>Search</button>
  ),
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
import { useCourseFilterStore } from '@/stores/useCourseFilterStore'

function renderCourses() {
  return render(
    <MemoryRouter>
      <Courses />
    </MemoryRouter>
  )
}

describe('Courses page', () => {
  function getStatusFilterButton(label: 'Not Started' | 'In Progress' | 'Completed' | 'Paused') {
    const buttons = screen.getAllByTestId('status-filter-button')
    const match = buttons.find(b => b.textContent?.includes(label))
    if (!match) {
      throw new Error(`Status filter button not found for label: ${label}`)
    }
    return match
  }

  beforeEach(() => {
    storeState.importedCourses = []
    storeState.loadImportedCourses = vi.fn()
    localStorage.clear()
    useCourseFilterStore.getState().clearAllFilters()
    sessionStorage.clear()
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

      await user.click(getStatusFilterButton('Completed'))

      expect(screen.queryByText('Active Course')).not.toBeInTheDocument()
      expect(screen.getByText('Completed Course')).toBeInTheDocument()
      expect(screen.queryByText('Paused Course')).not.toBeInTheDocument()
    })

    it('shows clear-all when status filter is active (summary row; no duplicate Clear beside pills)', async () => {
      const user = userEvent.setup()
      renderCourses()

      expect(screen.queryByTestId('clear-all-filters')).not.toBeInTheDocument()

      await user.click(getStatusFilterButton('Not Started'))

      expect(screen.getByTestId('clear-all-filters')).toBeInTheDocument()
    })

    it('clears status filters when Clear all is clicked', async () => {
      const user = userEvent.setup()
      renderCourses()

      await user.click(getStatusFilterButton('In Progress'))

      expect(screen.queryByText('Completed Course')).not.toBeInTheDocument()

      await user.click(screen.getByTestId('clear-all-filters'))

      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.getByText('Completed Course')).toBeInTheDocument()
      expect(screen.getByText('Paused Course')).toBeInTheDocument()
    })

    it('status filter correctly isolates courses by status (AC-2.2)', async () => {
      // Strengthen fixture: add a second active course
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

      await user.click(getStatusFilterButton('In Progress'))

      // Should show both Active courses (Active Course + Active Beta Course)
      expect(screen.getByText('Active Course')).toBeInTheDocument()
      expect(screen.getByText('Active Beta Course')).toBeInTheDocument()
      // Non-active courses should be hidden
      expect(screen.queryByText('Completed Course')).not.toBeInTheDocument()
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

    it('defaults to recently imported sort (newest importedAt first)', () => {
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

  describe('advanced filtering', () => {
    beforeEach(() => {
      storeState.importedCourses = [
        {
          ...mockCourses[0],
          id: 'local-beginner',
          name: 'Local Beginner Course',
          source: 'local',
          difficulty: 'beginner',
          category: 'Development',
          authorId: 'author-1',
          tags: ['frontend'],
        },
        {
          ...mockCourses[1],
          id: 'server-advanced',
          name: 'Server Advanced Course',
          source: 'server',
          difficulty: 'advanced',
          category: 'Design',
          authorId: 'author-2',
          tags: ['ux'],
        },
      ]
    })

    it('combines source, difficulty, category, author, and tag dimensions', () => {
      const filters = useCourseFilterStore.getState()
      filters.setFilter('source', 'server')
      filters.setFilter('selectedDifficulties', ['advanced'])
      filters.setFilter('selectedCategories', ['Design'])
      filters.setFilter('selectedAuthorIds', ['author-2'])
      filters.setFilter('selectedTags', ['ux'])

      renderCourses()

      expect(screen.getByText('Server Advanced Course')).toBeInTheDocument()
      expect(screen.queryByText('Local Beginner Course')).not.toBeInTheDocument()
      expect(screen.getByTestId('filtered-course-count')).toHaveTextContent('1 shown')
    })
  })

  describe('selection mode', () => {
    beforeEach(() => {
      storeState.importedCourses = mockCourses
      vi.clearAllMocks()
    })

    it('clicking "Select" enters selection mode and shows action bar', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      expect(screen.getByTestId('selection-action-bar')).toBeInTheDocument()
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0 selected')
    })

    it('exits selection mode and shows control bar when "Cancel" is clicked', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      expect(screen.getByTestId('selection-action-bar')).toBeInTheDocument()
      await user.click(screen.getByTestId('cancel-selection-btn'))
      expect(screen.queryByTestId('selection-action-bar')).not.toBeInTheDocument()
    })

    it('"Select All" selects all filtered courses', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      await user.click(screen.getByTestId('select-all-btn'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2 selected')
    })

    it('"Deselect All" clears selection', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      await user.click(screen.getByTestId('select-all-btn'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2 selected')
      await user.click(screen.getByTestId('deselect-all-btn'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0 selected')
    })

    it('"Delete Selected" is disabled while deletion is in progress (BULK-002)', async () => {
      const user = userEvent.setup()

      // Create a deferred promise so isDeleting stays true
      const deferred = new Promise<void>(() => {})
      storeState.removeImportedCourses = vi.fn().mockReturnValue(deferred)

      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      await user.click(screen.getByTestId('select-all-btn'))

      const deleteBtn = screen.getByTestId('delete-selected-btn')
      expect(deleteBtn).toBeEnabled()

      await user.click(deleteBtn)

      // Button should be disabled and show loading state while deletion is in progress
      expect(deleteBtn).toBeDisabled()
      expect(screen.getByText('Deleting…')).toBeInTheDocument()
    })

    it('"Delete Selected" is disabled when nothing is selected', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      const deleteBtn = screen.getByTestId('delete-selected-btn')
      expect(deleteBtn).toBeDisabled()
    })

    it('pressing Escape exits selection mode and clears selection', async () => {
      const user = userEvent.setup()
      renderCourses()
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      await user.click(screen.getByTestId('select-all-btn'))
      expect(screen.getByTestId('selection-action-bar')).toBeInTheDocument()
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2 selected')
      await user.keyboard('{Escape}')
      expect(screen.queryByTestId('selection-action-bar')).not.toBeInTheDocument()
      // Re-enter selection mode to verify selection was cleared
      await user.click(screen.getByTestId('course-options-menu-btn'))
      await user.click(screen.getByTestId('enter-selection-mode-btn'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0 selected')
    })
  })
})
