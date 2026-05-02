import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  VirtualizedCoursesList,
  VIRTUALIZATION_THRESHOLD,
} from '@/app/components/courses/VirtualizedCoursesList'

interface FixtureCourse {
  id: string
  title: string
}

function makeCourses(n: number): FixtureCourse[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `course-${i}`,
    title: `Course ${i}`,
  }))
}

const renderRow = (course: FixtureCourse) => (
  <div data-testid={`row-${course.id}`}>{course.title}</div>
)

describe('VirtualizedCoursesList (E99-S05)', () => {
  it('exports VIRTUALIZATION_THRESHOLD as 30', () => {
    expect(VIRTUALIZATION_THRESHOLD).toBe(30)
  })

  describe('bypass below threshold', () => {
    it('renders all list rows in a plain <ul> when courses.length < 30', () => {
      const courses = makeCourses(5)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      const list = screen.getByRole('list', { name: '5 courses' })
      expect(list.tagName).toBe('UL')
      expect(within(list).getAllByRole('listitem')).toHaveLength(5)
      expect(screen.getByTestId('row-course-0')).toBeInTheDocument()
      expect(screen.getByTestId('row-course-4')).toBeInTheDocument()
    })

    it('renders all grid cards in a plain grid when below threshold', () => {
      const courses = makeCourses(10)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="grid"
          gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          renderItem={renderRow}
        />
      )

      const list = screen.getByRole('list', { name: '10 courses' })
      expect(list.tagName).toBe('DIV')
      expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    })

    it('uses singular "course" label when count is 1', () => {
      render(
        <VirtualizedCoursesList
          courses={makeCourses(1)}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      expect(screen.getByRole('list', { name: '1 course' })).toBeInTheDocument()
    })

    it('exactly 29 courses still bypasses', () => {
      render(
        <VirtualizedCoursesList
          courses={makeCourses(29)}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      // All 29 rows in DOM
      expect(screen.getAllByRole('listitem')).toHaveLength(29)
    })
  })

  describe('virtualization at or above threshold', () => {
    it('exactly 30 courses activates virtualized list mode', () => {
      const courses = makeCourses(30)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      // The container is a focusable scroll container with role=list
      const container = screen.getByRole('list', { name: '30 courses' })
      expect(container.tagName).toBe('DIV')
      // tabIndex is set on the container for focus rescue
      expect(container.getAttribute('tabindex')).toBe('-1')
    })

    it('100 courses in list mode does not mount all rows (only visible window)', () => {
      const courses = makeCourses(100)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      // jsdom has no real scroll viewport, so virtualizer renders zero or a
      // tiny window — the invariant we care about is "<<100", which proves
      // virtualization is active rather than a plain map.
      const items = screen.queryAllByRole('listitem')
      expect(items.length).toBeLessThan(100)
      // Total scroll height is set on the inner spacer (rows * estimate).
      const list = screen.getByRole('list', { name: '100 courses' })
      const spacer = list.querySelector('.relative.w-full') as HTMLElement | null
      expect(spacer).not.toBeNull()
      expect(spacer?.style.height).toBe('7200px') // 100 * 72
    })

    it('grid mode at threshold delegates to VirtualizedGrid with ARIA wrapper', () => {
      const courses = makeCourses(50)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="grid"
          gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          renderItem={renderRow}
        />
      )

      // Outer ARIA wrapper announces total
      expect(screen.getByRole('list', { name: '50 courses' })).toBeInTheDocument()
    })

    it('renders empty container when courses array is empty', () => {
      // Empty arrays bypass via the threshold path
      render(
        <VirtualizedCoursesList
          courses={[]}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      const list = screen.getByRole('list', { name: '0 courses' })
      expect(list).toBeInTheDocument()
      expect(within(list).queryAllByRole('listitem')).toHaveLength(0)
    })
  })

  describe('ARIA semantics', () => {
    it('each rendered row carries aria-posinset and aria-setsize', () => {
      const courses = makeCourses(5)
      render(
        <VirtualizedCoursesList
          courses={courses}
          viewMode="list"
          renderItem={renderRow}
        />
      )

      const items = screen.getAllByRole('listitem')
      expect(items[0]).toHaveAttribute('aria-posinset', '1')
      expect(items[0]).toHaveAttribute('aria-setsize', '5')
      expect(items[4]).toHaveAttribute('aria-posinset', '5')
    })
  })
})
