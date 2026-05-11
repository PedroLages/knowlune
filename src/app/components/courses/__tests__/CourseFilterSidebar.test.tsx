import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseFilterSidebar } from '@/app/components/courses/CourseFilterSidebar'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'

// Mock the stores
const mockSetFilter = vi.fn()
const mockClearFilter = vi.fn()
const mockIsAnyFilterActive = vi.fn().mockReturnValue(false)
const mockSelectedTags: string[] = []

vi.mock('@/stores/useCourseFilterStore', () => ({
  useCourseFilterStore: (selector: any) => {
    const state = {
      source: 'all',
      showTrackCourses: false,
      selectedTags: mockSelectedTags,
      selectedStatuses: [],
      setFilter: mockSetFilter,
      clearFilter: mockClearFilter,
      isAnyFilterActive: mockIsAnyFilterActive,
    }
    return selector(state)
  },
}))

const mockEntries: { courseId: string; courseType: string }[] = []

vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: (selector: any) => {
    const state = {
      entries: mockEntries,
    }
    return selector(state)
  },
}))

// Mock media query for desktop by default — use vi.fn() so mobile tests can override
vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}))

// Mock the UI components that use Radix primitives
vi.mock('@/app/components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children, side, className }: any) => (
    <div data-testid="sheet-content" data-side={side} className={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children, className }: any) => (
    <div data-testid="sheet-header" className={className}>
      {children}
    </div>
  ),
  SheetTitle: ({ children }: any) => <div data-testid="sheet-title">{children}</div>,
}))

vi.mock('@/app/components/ui/drawer', () => ({
  Drawer: ({ children, open }: any) => open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: any) => <div data-testid="drawer-content">{children}</div>,
  DrawerHeader: ({ children }: any) => <div data-testid="drawer-header">{children}</div>,
  DrawerTitle: ({ children }: any) => <div data-testid="drawer-title">{children}</div>,
}))

vi.mock('@/app/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange }: any) => (
    <div data-testid="radio-group" data-value={value}>
      {children}
      <button data-testid="mock-radio-all" onClick={() => onValueChange('all')}>Set All</button>
      <button data-testid="mock-radio-youtube" onClick={() => onValueChange('youtube')}>Set YouTube</button>
    </div>
  ),
  RadioGroupItem: ({ value }: any) => <div data-testid={`radio-item-${value}`} />,
}))

vi.mock('@/app/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, 'aria-label': ariaLabel }: any) => (
    <button
      data-testid="mock-switch"
      aria-label={ariaLabel}
      data-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    />
  ),
}))

vi.mock('@/app/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, className }: any) => (
    <div
      data-testid="mock-checkbox"
      data-checked={checked}
      className={className}
      onClick={() => onCheckedChange(!checked)}
    />
  ),
}))

vi.mock('@/app/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

const createMockCourses = (tags: string[][]) =>
  tags.map((courseTags, i) => ({
    id: `course-${i}`,
    name: `Course ${i}`,
    tags: courseTags,
    source: 'local' as const,
    status: 'active' as const,
    importedAt: new Date().toISOString(),
    category: 'test',
    videoCount: 0,
    pdfCount: 0,
    directoryHandle: null,
  }))

describe('CourseFilterSidebar', () => {
  beforeEach(() => {
    mockSetFilter.mockClear()
    mockClearFilter.mockClear()
    mockIsAnyFilterActive.mockReturnValue(false)
    mockEntries.length = 0
    mockSelectedTags.length = 0
  })

  it('renders source section with All Courses and YouTube options', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react'], ['vue']])}
      />
    )

    expect(screen.getByText('All Courses')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
  })

  it('renders tags section when courses have tags', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react'], ['vue']])}
      />
    )

    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('vue')).toBeInTheDocument()
  })

  it('does not render tags section when no courses have tags', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([[]])}
      />
    )

    expect(screen.getByText(/No tags available/i)).toBeInTheDocument()
  })

  it('selecting YouTube calls setFilter with source youtube', async () => {
    const user = userEvent.setup()
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    // Find the radio-group and click the mock YouTube button
    await user.click(screen.getByTestId('mock-radio-youtube'))
    expect(mockSetFilter).toHaveBeenCalledWith('source', 'youtube')
  })

  it('shows learning tracks section when tracks exist', () => {
    mockEntries.push({ courseId: 'course-1', courseType: 'imported' })

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByText('Learning Tracks')).toBeInTheDocument()
    expect(screen.getByText('Include courses in tracks')).toBeInTheDocument()
  })

  it('hides learning tracks section when no tracks exist', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.queryByText('Learning Tracks')).not.toBeInTheDocument()
  })

  it('toggling track switch calls setFilter with showTrackCourses', async () => {
    mockEntries.push({ courseId: 'course-1', courseType: 'imported' })

    const user = userEvent.setup()
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    await user.click(screen.getByTestId('mock-switch'))
    expect(mockSetFilter).toHaveBeenCalledWith('showTrackCourses', true)
  })

  it('shows Clear All button when filters are active', () => {
    mockSelectedTags.push('react')

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByText('Clear All')).toBeInTheDocument()
  })

  it('does not show Clear All button when no filters are active', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.queryByText('Clear All')).not.toBeInTheDocument()
  })

  it('Clear All calls clearFilter for source, showTrackCourses, and selectedTags', async () => {
    mockSelectedTags.push('react')

    const user = userEvent.setup()
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    await user.click(screen.getByText('Clear All'))
    expect(mockClearFilter).toHaveBeenCalledWith('source')
    expect(mockClearFilter).toHaveBeenCalledWith('showTrackCourses')
    expect(mockClearFilter).toHaveBeenCalledWith('selectedTags')
  })

  it('displays tag count next to each tag', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react'], ['react'], ['vue']])}
      />
    )

    // react appears in 2 courses, vue in 1
    const reactCounts = screen.getAllByText('2')
    expect(reactCounts.length).toBeGreaterThanOrEqual(1)
    const vueCounts = screen.getAllByText('1')
    expect(vueCounts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows track count badge with correct number', () => {
    mockEntries.push(
      { courseId: 'course-1', courseType: 'imported' },
      { courseId: 'course-2', courseType: 'imported' }
    )

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders title as Filters', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('shows show less/more button when more than 12 tags exist', () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => [`tag-${i}`])
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses(manyTags)}
      />
    )

    expect(screen.getByText('+3 more')).toBeInTheDocument()
  })

  it('includes selected tags outside the top 12 in the visible tag list', () => {
    // Create 15 courses each with a unique tag — tags get sorted by count (all 1)
    // then alphabetically. Tag-0 through tag-11 are the top 12 alphabetically.
    const manyTags = Array.from({ length: 15 }, (_, i) => [`tag-${i}`])
    // Select a tag near the end (tag-14) that sorts outside the top 12
    mockSelectedTags.push('tag-13')

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses(manyTags)}
      />
    )

    // The selected tag should be present in the rendered list
    expect(screen.getByText('tag-13')).toBeInTheDocument()
  })
})

describe('mobile (Drawer)', () => {
  beforeEach(() => {
    vi.mocked(useMediaQuery).mockReturnValue(true)
    mockIsAnyFilterActive.mockReturnValue(false)
    mockEntries.length = 0
  })

  it('renders Drawer instead of Sheet on mobile', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react'], ['vue']])}
      />
    )

    // Drawer should render instead of Sheet
    expect(screen.getByTestId('drawer')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument()
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument()
  })

  it('renders all three filter sections inside Drawer', () => {
    mockEntries.push({ courseId: 'course-1', courseType: 'imported' })

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    // All filter sections should render
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Learning Tracks')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
  })

  it('renders Filters title in Drawer header', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('shows Clear All button when filters are active in Drawer', () => {
    mockSelectedTags.push('react')

    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.getByTestId('sidebar-clear-all-filters')).toBeInTheDocument()
  })

  it('does not show Clear All button when no filters are active in Drawer', () => {
    render(
      <CourseFilterSidebar
        open={true}
        onOpenChange={() => {}}
        availableCourses={createMockCourses([['react']])}
      />
    )

    expect(screen.queryByTestId('sidebar-clear-all-filters')).not.toBeInTheDocument()
  })
})
