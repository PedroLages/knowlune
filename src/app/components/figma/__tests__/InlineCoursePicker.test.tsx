import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InlineCoursePicker, suggestNameFromTags } from '../InlineCoursePicker'
import type { ImportedCourse } from '@/data/types'

// --- Mocks ---

const mockImportedCourses: Partial<ImportedCourse>[] = [
  {
    id: 'c1',
    name: 'React Fundamentals',
    tags: ['react', 'frontend', 'video'],
    authorId: 'a1',
  },
  {
    id: 'c2',
    name: 'Node.js Advanced',
    tags: ['node', 'backend', 'course'],
    authorId: 'a2',
  },
  {
    id: 'c3',
    name: 'TypeScript Basics',
    tags: ['typescript', 'frontend', 'book'],
    authorId: 'a1',
  },
]

const mockAuthors = [
  { id: 'a1', name: 'Alice' },
  { id: 'a2', name: 'Bob' },
]

let mockEntries: Array<{ courseId: string; pathId: string }> = []

const storeState = {
  importedCourses: mockImportedCourses,
  thumbnailUrls: {},
}

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { importedCourses: mockImportedCourses, thumbnailUrls: {} }
      return selector ? selector(state) : state
    },
    { getState: () => storeState }
  ),
}))

const authorStoreState = { authors: mockAuthors }

vi.mock('@/stores/useAuthorStore', () => ({
  useAuthorStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { authors: mockAuthors }
      return selector ? selector(state) : state
    },
    { getState: () => authorStoreState }
  ),
}))

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { entries: mockEntries }
      return selector ? selector(state) : state
    },
    { getState: () => ({ entries: mockEntries }) }
  ),
}))

// --- suggestNameFromTags ---

describe('suggestNameFromTags', () => {
  it('should return "Untitled Path" for empty selection', () => {
    expect(suggestNameFromTags([], mockImportedCourses as ImportedCourse[])).toBe('Untitled Path')
  })

  it('should suggest name from topic tag (short tag)', () => {
    const result = suggestNameFromTags(
      [
        {
          id: 'c1',
          name: 'React Fundamentals',
          type: 'imported',
          authorName: 'Alice',
          thumbnailUrl: undefined,
          tags: ['react', 'frontend', 'video'],
        },
      ],
      mockImportedCourses as ImportedCourse[]
    )
    expect(result).toBe('React Fundamentals')
  })

  it('should suggest name from topic tag (longer tag)', () => {
    const result = suggestNameFromTags(
      [
        {
          id: 'c2',
          name: 'Node.js Advanced',
          type: 'imported',
          authorName: 'Bob',
          thumbnailUrl: undefined,
          tags: ['node', 'backend', 'course'],
        },
      ],
      mockImportedCourses as ImportedCourse[]
    )
    expect(result).toBe('Node Fundamentals')
  })

  it('should skip format/type tags', () => {
    const result = suggestNameFromTags(
      [
        {
          id: 'c1',
          name: 'Test Course',
          type: 'imported',
          authorName: undefined,
          thumbnailUrl: undefined,
          tags: ['video', 'book', 'course'],
        },
      ],
      mockImportedCourses as ImportedCourse[]
    )
    expect(result).toBe('Untitled Path')
  })
})

// --- InlineCoursePicker ---

describe('InlineCoursePicker', () => {
  beforeEach(() => {
    mockEntries = []
  })

  describe('multiSelect mode', () => {
    it('should render checkboxes for each course', () => {
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={[]}
          onSelectionChange={vi.fn()}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(3)
    })

    it('should show selected courses count', () => {
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={['c1', 'c2']}
          onSelectionChange={vi.fn()}
        />
      )

      expect(screen.getByTestId('selected-count')).toHaveTextContent('2 courses selected')
    })

    it('should call onSelectionChange when checkbox toggled', () => {
      const onSelectionChange = vi.fn()
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={[]}
          onSelectionChange={onSelectionChange}
        />
      )

      fireEvent.click(screen.getByTestId('checkbox-c1'))
      expect(onSelectionChange).toHaveBeenCalledWith(['c1'])
    })

    it('should call onAdd with all selected courses on confirm', () => {
      const onAdd = vi.fn()
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={onAdd}
          selectedCourseIds={['c1', 'c2']}
          onSelectionChange={vi.fn()}
        />
      )

      fireEvent.click(screen.getByTestId('confirm-multi-select'))
      expect(onAdd).toHaveBeenCalledWith([
        { courseId: 'c1', courseType: 'imported' },
        { courseId: 'c2', courseType: 'imported' },
      ])
    })

    it('should disable confirm when no courses selected', () => {
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={[]}
          onSelectionChange={vi.fn()}
        />
      )

      expect(screen.queryByTestId('confirm-multi-select')).not.toBeInTheDocument()
    })
  })

  describe('singleSelect mode', () => {
    it('should render Add buttons per course', () => {
      render(
        <InlineCoursePicker mode="singleSelect" excludeCourseIds={new Set()} onAdd={vi.fn()} />
      )

      const addButtons = screen.getAllByRole('button', { name: /Add/i })
      expect(addButtons).toHaveLength(3)
    })

    it('should call onAdd with single course on click', () => {
      const onAdd = vi.fn()
      render(<InlineCoursePicker mode="singleSelect" excludeCourseIds={new Set()} onAdd={onAdd} />)

      fireEvent.click(screen.getByRole('button', { name: 'Add React Fundamentals' }))
      expect(onAdd).toHaveBeenCalledWith([{ courseId: 'c1', courseType: 'imported' }])
    })
  })

  describe('search', () => {
    it('should filter courses by name', () => {
      render(
        <InlineCoursePicker mode="singleSelect" excludeCourseIds={new Set()} onAdd={vi.fn()} />
      )

      fireEvent.change(screen.getByLabelText('Search courses'), {
        target: { value: 'React' },
      })

      expect(screen.getByText('React Fundamentals')).toBeInTheDocument()
      expect(screen.queryByText('Node.js Advanced')).not.toBeInTheDocument()
    })

    it('should show no results message when search has no matches', () => {
      render(
        <InlineCoursePicker mode="singleSelect" excludeCourseIds={new Set()} onAdd={vi.fn()} />
      )

      fireEvent.change(screen.getByLabelText('Search courses'), {
        target: { value: 'zzzzz' },
      })

      expect(screen.getByTestId('no-results')).toBeInTheDocument()
    })
  })

  describe('excluded courses', () => {
    it('should show all excluded message when all courses excluded', () => {
      render(
        <InlineCoursePicker
          mode="singleSelect"
          excludeCourseIds={new Set(['c1', 'c2', 'c3'])}
          onAdd={vi.fn()}
        />
      )

      expect(screen.getByTestId('all-excluded')).toBeInTheDocument()
    })
  })

  describe('Recently Imported', () => {
    it('should show Recently Imported section with unassigned courses', () => {
      // c1 is assigned to a path
      mockEntries = [{ courseId: 'c1', pathId: 'p1' }]

      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={[]}
          onSelectionChange={vi.fn()}
          showRecentlyImported
        />
      )

      expect(screen.getByTestId('recently-imported-section')).toBeInTheDocument()
      // c2 and c3 are unassigned, c1 is assigned
      expect(
        within(screen.getByTestId('recently-imported-section')).queryByText('React Fundamentals')
      ).not.toBeInTheDocument()
    })
  })

  describe('Import action', () => {
    it('should render import action button when showImportAction is true', () => {
      const onImportCourse = vi.fn()
      render(
        <InlineCoursePicker
          mode="singleSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          showImportAction
          onImportCourse={onImportCourse}
        />
      )

      const importBtn = screen.getByTestId('import-course-action')
      expect(importBtn).toBeInTheDocument()
      fireEvent.click(importBtn)
      expect(onImportCourse).toHaveBeenCalled()
    })
  })

  describe('Suggested Next', () => {
    it('should show placeholder when showSuggestedNext is true', () => {
      render(
        <InlineCoursePicker
          mode="singleSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          showSuggestedNext
        />
      )

      expect(screen.getByTestId('suggested-next-placeholder')).toBeInTheDocument()
    })

    it('should not show placeholder by default', () => {
      render(
        <InlineCoursePicker mode="singleSelect" excludeCourseIds={new Set()} onAdd={vi.fn()} />
      )

      expect(screen.queryByTestId('suggested-next-placeholder')).not.toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('should render skeleton when loading is true', () => {
      render(
        <InlineCoursePicker
          mode="singleSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          loading
        />
      )

      expect(screen.getByLabelText('Loading courses')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have aria-live region for selected count', () => {
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={['c1']}
          onSelectionChange={vi.fn()}
        />
      )

      const countEl = screen.getByTestId('selected-count')
      expect(countEl).toHaveAttribute('aria-live', 'polite')
      expect(countEl).toHaveAttribute('role', 'status')
    })

    it('selected checkbox row should have proper aria-label', () => {
      render(
        <InlineCoursePicker
          mode="multiSelect"
          excludeCourseIds={new Set()}
          onAdd={vi.fn()}
          selectedCourseIds={[]}
          onSelectionChange={vi.fn()}
        />
      )

      expect(screen.getByLabelText('Select React Fundamentals')).toBeInTheDocument()
    })
  })
})
