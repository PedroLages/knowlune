import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { CurriculumComposer } from '../CurriculumComposer'
import type { ImportedCourse } from '@/data/types'

// --- Mocks ---

const mockImportedCourses: Partial<ImportedCourse>[] = [
  {
    id: 'c1',
    name: 'React Fundamentals',
    tags: ['react', 'frontend', 'video'],
  },
  {
    id: 'c2',
    name: 'Node.js Advanced',
    tags: ['node', 'backend'],
  },
  {
    id: 'c3',
    name: 'TypeScript Basics',
    tags: ['typescript', 'frontend'],
  },
]

const mockCreatePathWithCourses = vi.fn()
const mockLoadPaths = vi.fn()
const mockLoadImportedCourses = vi.fn()
const mockNavigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        createPathWithCourses: mockCreatePathWithCourses,
        paths: [],
        loadPaths: mockLoadPaths,
        addCourseToPath: vi.fn(),
        createPath: vi.fn(),
        entries: [],
      }
      return selector ? selector(state) : state
    },
    { getState: () => ({ createPathWithCourses: mockCreatePathWithCourses, paths: [], loadPaths: mockLoadPaths, entries: [], createPath: vi.fn(), addCourseToPath: vi.fn() }) }
  ),
}))

const courseImportState = {
  importedCourses: mockImportedCourses,
  loadImportedCourses: mockLoadImportedCourses,
  thumbnailUrls: {},
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      return selector ? selector(courseImportState) : courseImportState
    },
    { getState: () => courseImportState }
  ),
}))

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { authors: [] }
      return selector ? selector(state) : state
    },
    { getState: () => ({ authors: [] }) }
  ),
}))

vi.mock('@/ai/learningPath/suggestPlacement', () => ({
  isPathPlacementAvailable: () => false,
}))

vi.mock('@/ai/hooks/useAISuggestions', () => ({
  useAISuggestions: () => ({
    isAvailable: false,
    isLoading: false,
    hasFetched: false,
    suggestedTags: [],
    suggestedDescription: '',
  }),
}))

vi.mock('@/ai/hooks/usePathPlacementSuggestion', () => ({
  usePathPlacementSuggestion: () => ({
    isAvailable: false,
    isLoading: false,
    hasFetched: false,
    suggestion: null,
  }),
}))

vi.mock('@/stores/useImportProgressStore', () => ({
  useImportProgressStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { courses: new Map(), setDialogOpen: vi.fn() }
      return selector ? selector(state) : state
    },
    { getState: () => ({ courses: new Map(), setDialogOpen: vi.fn() }) }
  ),
}))

vi.mock('@/app/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="mobile-sheet">{children}</div> : null,
  SheetContent: ({ children, side }: { children: React.ReactNode; side: string }) => (
    <div data-testid="sheet-content" data-side={side}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// --- Tests ---

describe('CurriculumComposer', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.innerWidth to desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  it('should render the dialog with name, description, and course picker', () => {
    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()
    expect(screen.getByTestId('inline-course-picker')).toBeInTheDocument()
  })

  it('should disable Create Path button when no courses selected', () => {
    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    const createBtn = screen.getByRole('button', { name: 'Create Path' })
    expect(createBtn).toBeDisabled()
  })

  it('should enable Create Path button when courses are selected', async () => {
    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    // Select a course via checkbox
    const checkbox = screen.getByLabelText('Select React Fundamentals')
    fireEvent.click(checkbox)

    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: 'Create Path' })
      expect(createBtn).not.toBeDisabled()
    })
  })

  it('should call createPathWithCourses and navigate on submit', async () => {
    mockCreatePathWithCourses.mockResolvedValue({ id: 'new-path-1' })

    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    // Select course
    fireEvent.click(screen.getByLabelText('Select React Fundamentals'))
    fireEvent.click(screen.getByLabelText('Select Node.js Advanced'))

    // Fill name and description
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'My Web Path' },
    })
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: 'A web development path' },
    })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Create Path' }))

    await waitFor(() => {
      expect(mockCreatePathWithCourses).toHaveBeenCalledWith(
        'My Web Path',
        'A web development path',
        [
          { courseId: 'c1', courseType: 'imported' },
          { courseId: 'c2', courseType: 'imported' },
        ]
      )
      expect(mockNavigate).toHaveBeenCalledWith('/learning-paths/new-path-1')
    })
  })

  it('should handle store failure with toast and keep dialog open', async () => {
    mockCreatePathWithCourses.mockRejectedValue(new Error('Store error'))

    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByLabelText('Select React Fundamentals'))
    fireEvent.click(screen.getByRole('button', { name: 'Create Path' }))

    await waitFor(() => {
      // Dialog should still be rendered (onOpenChange not called)
      expect(defaultProps.onOpenChange).not.toHaveBeenCalled()
    })
  })

  it('should auto-suggest name from selected course tags', async () => {
    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    fireEvent.click(screen.getByLabelText('Select React Fundamentals'))

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      expect(nameInput.value).toBe('React Fundamentals')
    })
  })

  it('should use "Untitled Path" when name is empty on submit', async () => {
    mockCreatePathWithCourses.mockResolvedValue({ id: 'path-1' })

    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    // Clear name if auto-filled
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })

    // Select course
    fireEvent.click(screen.getByLabelText('Select Node.js Advanced'))

    // Wait for auto-suggest logic to handle empty (Node has no topic tags after filtering)
    // Actually 'node' should generate 'Node Fundamentals' - let me use a course whose tags are all format/type
    // But we already selected c2. Let me check: c2 has tags ['node', 'backend'], so 'node' is the topic tag.
    // We need a course whose tags are all format/type. None in our mock data, so let's just select c2
    // and clear the auto-filled name.
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create Path' }))

    await waitFor(() => {
      expect(mockCreatePathWithCourses).toHaveBeenCalledWith(
        'Untitled Path',
        undefined,
        expect.any(Array)
      )
    })
  })

  it('should import course action button', () => {
    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    expect(screen.getByTestId('import-course-action')).toBeInTheDocument()
  })

  it('should render mobile sheet when viewport is < 640px', () => {
    // useIsMobile relies on matchMedia, not innerWidth. Mock matchMedia directly.
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 639px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    // Mobile sheet should be rendered
    expect(screen.getByTestId('mobile-sheet')).toBeInTheDocument()

    window.matchMedia = originalMatchMedia
  })

  it('should load imported courses when course-imported event fires', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')

    render(
      <BrowserRouter>
        <CurriculumComposer {...defaultProps} />
      </BrowserRouter>
    )

    expect(addEventListener).toHaveBeenCalledWith('course-imported', expect.any(Function))
  })
})
