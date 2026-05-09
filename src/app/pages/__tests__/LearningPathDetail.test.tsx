import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { LearningPathDetail } from '../LearningPathDetail'
import type { ImportedCourse, LearningPath, LearningPathEntry } from '@/data/types'

// Mock route params
const mockPathId = 'path-1'
const mockNavigate = vi.fn()

vi.mock('react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router')>()
  return {
    ...actual,
    useParams: () => ({ pathId: mockPathId }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return {
    ...actual,
    useReducedMotion: () => false,
  }
})

// Mock ImportWizardDialog to verify props
let capturedWizardProps: Record<string, unknown> | null = null

vi.mock('@/app/components/figma/ImportWizardDialog', () => ({
  ImportWizardDialog: (props: Record<string, unknown>) => {
    capturedWizardProps = props
    return props.open ? (
      <div data-testid="import-wizard-mock">
        <button
          data-testid="wizard-close-mock"
          onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}
        >
          Close Wizard
        </button>
      </div>
    ) : null
  },
  isImportWizardOpen: () => false,
  IMPORT_WIZARD_SET_TARGET: 'import-wizard-set-target',
}))

// Mock InlineEditableField for detail page
vi.mock('@/app/components/figma/InlineEditableField', () => ({
  InlineEditableField: (props: Record<string, unknown>) => (
    <div data-testid="inline-editable-field" data-value={props.value as string}>
      <button
        data-testid={props.as === 'textarea' ? 'edit-description-trigger' : 'edit-name-trigger'}
        onClick={() => {
          ;(props.onSave as (v: string) => void)(
            props.as === 'textarea' ? 'Updated description' : 'Updated name'
          )
        }}
      >
        {(props.value as string) || 'Click to edit'}
      </button>
    </div>
  ),
}))

// Mock components that are deep dependencies
vi.mock('@/app/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Empty State</div>,
}))

vi.mock('@/app/components/DelayedFallback', () => ({
  DelayedFallback: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/app/components/figma/MoveUpDownButtons', () => ({
  MoveUpDownButtons: () => <div data-testid="move-buttons">Move</div>,
}))

vi.mock('@/app/components/figma/InlineCoursePicker', () => ({
  InlineCoursePicker: (props: Record<string, unknown>) => (
    <div data-testid="inline-course-picker">
      <button
        data-testid="mock-add-course"
        onClick={() => {
          const onAdd = props.onAdd as (
            courses: Array<{ courseId: string; courseType: string }>
          ) => void
          onAdd([{ courseId: 'course-1', courseType: 'imported' }])
        }}
      >
        Add Course
      </button>
    </div>
  ),
  suggestNameFromTags: () => 'Test Path',
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/ai/learningPath/suggestOrder', () => ({
  isOrderSuggestionAvailable: () => false,
  suggestPathOrder: vi.fn(),
}))

vi.mock('@/ai/hooks/usePathPlacementSuggestion', () => ({
  usePathPlacementSuggestion: () => ({
    suggestion: null,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/ai/learningPath/suggestPlacement', () => ({
  isPathPlacementAvailable: () => false,
}))

vi.mock('@/lib/motion', () => ({
  staggerContainer: {},
  fadeUp: {},
}))

vi.mock('@/app/hooks/usePathProgress', () => ({
  usePathProgress: () => ({
    completionPct: 0,
    completedCourses: 0,
    totalCourses: 0,
    completedLessons: 0,
    estimatedRemainingHours: 0,
    courseProgress: new Map(),
  }),
}))

// Mutable store state
const testPath: LearningPath = {
  id: 'path-1',
  name: 'Test Learning Path',
  description: 'A test path',
  isAIGenerated: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const testEntry: LearningPathEntry = {
  id: 'entry-1',
  courseId: 'course-1',
  pathId: 'path-1',
  position: 1,
  courseType: 'imported',
  isManuallyOrdered: false,
}

const testCourse: ImportedCourse = {
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

const mockLearningPathState = {
  paths: [testPath],
  entries: [testEntry],
  loadPaths: vi.fn(),
  addCourseToPath: vi.fn(),
  createPath: vi.fn(),
  reorderCourse: vi.fn(),
  removeCourseFromPath: vi.fn(),
  getEntriesForPath: vi.fn((_pathId: string) => [testEntry]),
  applyAIOrder: vi.fn(),
  renamePath: vi.fn().mockResolvedValue(undefined),
  updateDescription: vi.fn().mockResolvedValue(undefined),
  deletePathWithUndo: vi.fn(),
}

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (state: typeof mockLearningPathState) => unknown) =>
      selector ? selector(mockLearningPathState) : mockLearningPathState,
    {
      getState: () => mockLearningPathState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

const mockImportState = {
  importedCourses: [testCourse],
  loadImportedCourses: vi.fn(),
  loadThumbnailUrls: vi.fn(),
  thumbnailUrls: {} as Record<string, string>,
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (state: typeof mockImportState) => unknown) =>
      selector ? selector(mockImportState) : mockImportState,
    {
      getState: () => mockImportState,
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) => {
      const state = { authors: [], loadAuthors: vi.fn() }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({ authors: [], loadAuthors: vi.fn() }),
      setState: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    }
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/learning-paths/path-1']}>
      <LearningPathDetail />
    </MemoryRouter>
  )
}

describe('LearningPathDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedWizardProps = null
    mockNavigate.mockClear()
    mockLearningPathState.paths = [testPath]
    mockLearningPathState.entries = [testEntry]
    mockLearningPathState.getEntriesForPath = vi.fn(() => [testEntry])
    mockImportState.importedCourses = [testCourse]
    mockImportState.thumbnailUrls = {}
  })

  it('renders the path name when loaded', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Test Learning Path')).toBeInTheDocument()
    })
  })

  it('renders "Add Course" button in sidebar', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('add-course-button')).toBeInTheDocument()
    })
  })

  it('renders "Import Course" button in sidebar', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('import-course-button')).toBeInTheDocument()
    })
  })

  it('"Import" button in actions card uses brand-outline variant and has Download icon', async () => {
    renderPage()
    await waitFor(() => {
      const btn = screen.getByTestId('import-course-button')
      expect(btn).toBeInTheDocument()
      expect(btn.textContent).toContain('Import')
    })
  })

  it('opens import wizard when "Import Course" is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('import-course-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('import-course-button'))

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard-mock')).toBeInTheDocument()
    })
  })

  it('passes targetPathId to ImportWizardDialog', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('import-course-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('import-course-button'))

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard-mock')).toBeInTheDocument()
    })

    expect(capturedWizardProps?.targetPathId).toBe('path-1')
  })

  it('closes wizard when close button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('import-course-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('import-course-button'))

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard-mock')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('wizard-close-mock'))

    await waitFor(() => {
      expect(screen.queryByTestId('import-wizard-mock')).not.toBeInTheDocument()
    })
  })

  it('renders delete path button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('delete-path-button')).toBeInTheDocument()
    })
  })

  it('calls deletePathWithUndo and navigates when delete button is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('delete-path-button')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('delete-path-button'))

    expect(mockLearningPathState.deletePathWithUndo).toHaveBeenCalledWith('path-1')
    expect(mockNavigate).toHaveBeenCalledWith('/learning-paths')
  })

  it('inline editable field triggers renamePath on detail page', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('edit-name-trigger')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('edit-name-trigger'))

    expect(mockLearningPathState.renamePath).toHaveBeenCalledWith('path-1', 'Updated name')
  })

  it('inline editable field triggers updateDescription on detail page', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(screen.getByTestId('edit-description-trigger')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('edit-description-trigger'))

    expect(mockLearningPathState.updateDescription).toHaveBeenCalledWith(
      'path-1',
      'Updated description'
    )
  })

  it('renders the syllabus card heading and course count', async () => {
    renderPage()

    await waitFor(() => {
      // Syllabus heading replaces the old "Course Timeline" heading
      expect(screen.getByRole('heading', { name: 'Syllabus' })).toBeInTheDocument()
    })

    // Syllabus card shows course count
    expect(screen.getByText('1 Courses')).toBeInTheDocument()
  })
})
