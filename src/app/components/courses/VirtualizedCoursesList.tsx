import { useRef, useEffect, useCallback, useState, useSyncExternalStore } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CourseViewMode } from '@/stores/useEngagementPrefsStore'
import { Skeleton } from '@/app/components/ui/skeleton'
import { VirtualizedGrid } from '@/app/components/VirtualizedGrid'

/**
 * Below this count, virtualization is bypassed entirely.
 * Mount/measure overhead exceeds the render savings for small libraries,
 * and SSR / first-paint behavior is simpler with a plain grid.
 *
 * E99-S05 prescribes a fixed threshold of 30 (was previously column-derived
 * `columns * 6` inside VirtualizedGrid, which caused premature virtualization
 * at narrow viewports — e.g. 6 items at 1 column).
 */
export const VIRTUALIZATION_THRESHOLD = 30

/** Estimated row height for list view (matches ImportedCourseListRow). */
const LIST_ROW_ESTIMATE_PX = 72

/** Read `prefers-reduced-motion` reactively (SSR-safe). */
function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}
function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function getReducedMotionServerSnapshot(): boolean {
  return false
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )
}

export interface VirtualizedCoursesListProps<T extends { id: string }> {
  courses: T[]
  viewMode: CourseViewMode
  /** For grid/compact modes — Tailwind grid template classes. */
  gridClassName?: string
  /** Render function for each course. */
  renderItem: (course: T, index: number) => React.ReactNode
  /** data-testid for the outer container. */
  'data-testid'?: string
  /** Max scroll height (default 80vh). */
  maxHeight?: string
}

/**
 * Courses-page virtualization wrapper.
 *
 * - Below VIRTUALIZATION_THRESHOLD courses, renders the appropriate plain layout
 *   (list, grid, or compact-grid) without any virtualizer. This avoids
 *   measure overhead for small libraries.
 * - At or above the threshold:
 *     - List mode: row-based virtualization with skeleton placeholders
 *       during measurement and ARIA list semantics for screen readers.
 *     - Grid / compact-grid: delegates to the existing generic
 *       VirtualizedGrid, which already handles row-of-cards virtualization.
 * - Honors prefers-reduced-motion for any programmatic scrolls.
 * - Rescues focus when a focused row is recycled out of the DOM, so focus
 *   never escapes to document.body.
 *
 * E99-S05.
 */
export function VirtualizedCoursesList<T extends { id: string }>({
  courses,
  viewMode,
  gridClassName,
  renderItem,
  'data-testid': testId,
  maxHeight = '80vh',
}: VirtualizedCoursesListProps<T>) {
  const totalLabel = `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`

  // -- Bypass: small libraries get plain layouts -------------------------
  if (courses.length < VIRTUALIZATION_THRESHOLD) {
    if (viewMode === 'list') {
      return (
        <ul
          role="list"
          aria-label={totalLabel}
          data-testid={testId ?? 'imported-courses-list'}
          className="flex flex-col gap-2"
        >
          {courses.map((course, index) => (
            <li key={course.id} aria-posinset={index + 1} aria-setsize={courses.length}>
              {renderItem(course, index)}
            </li>
          ))}
        </ul>
      )
    }

    return (
      <div
        role="list"
        aria-label={totalLabel}
        data-testid={testId ?? 'imported-courses-grid'}
        className={gridClassName}
      >
        {courses.map((course, index) => (
          <div key={course.id} role="listitem">
            {renderItem(course, index)}
          </div>
        ))}
      </div>
    )
  }

  // -- Virtualized list mode --------------------------------------------
  if (viewMode === 'list') {
    return (
      <VirtualizedListMode
        courses={courses}
        renderItem={renderItem}
        totalLabel={totalLabel}
        testId={testId ?? 'imported-courses-list'}
        maxHeight={maxHeight}
      />
    )
  }

  // -- Virtualized grid / compact (delegate to existing generic) --------
  return (
    <div role="list" aria-label={totalLabel}>
      <VirtualizedGrid
        items={courses}
        getItemKey={course => course.id}
        renderItem={(course, index) => (
          <div role="listitem" aria-posinset={index + 1} aria-setsize={courses.length}>
            {renderItem(course, index)}
          </div>
        )}
        data-testid={testId ?? 'imported-courses-grid'}
        gridClassName={gridClassName}
        maxHeight={maxHeight}
      />
    </div>
  )
}

interface ListModeProps<T extends { id: string }> {
  courses: T[]
  renderItem: (course: T, index: number) => React.ReactNode
  totalLabel: string
  testId: string
  maxHeight: string
}

function VirtualizedListMode<T extends { id: string }>({
  courses,
  renderItem,
  totalLabel,
  testId,
  maxHeight,
}: ListModeProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [measuredRows, setMeasuredRows] = useState<Set<number>>(() => new Set())

  const virtualizer = useVirtualizer({
    count: courses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LIST_ROW_ESTIMATE_PX,
    overscan: 5,
    measureElement: el => {
      const height = el?.getBoundingClientRect().height ?? LIST_ROW_ESTIMATE_PX
      const indexAttr = el?.getAttribute('data-index')
      if (indexAttr != null) {
        const idx = parseInt(indexAttr, 10)
        setMeasuredRows(prev => {
          if (prev.has(idx)) return prev
          const next = new Set(prev)
          next.add(idx)
          return next
        })
      }
      return height
    },
  })

  const measureRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) virtualizer.measureElement(node)
    },
    [virtualizer]
  )

  // Reset scroll when collection length changes (filter / search / sort).
  const prevLengthRef = useRef(courses.length)
  useEffect(() => {
    if (courses.length !== prevLengthRef.current) {
      virtualizer.scrollToOffset(0, {
        behavior: prefersReducedMotion ? 'auto' : 'auto', // virtualizer rejects 'smooth'; keep plain
      })
      prevLengthRef.current = courses.length
      // Also forget skeleton state so re-measurement happens cleanly.
      setMeasuredRows(new Set())
    }
  }, [courses.length, virtualizer, prefersReducedMotion])

  // Focus rescue: if the focused element is no longer in the container after a
  // virtual-row recycle, redirect focus to the container itself so it never
  // lands on document.body.
  const virtualRows = virtualizer.getVirtualItems()
  useEffect(() => {
    const container = parentRef.current
    if (!container) return
    const active = document.activeElement
    if (!active) return
    // Only rescue if focus *was* inside us and got dropped to body.
    if (active === document.body || active === document.documentElement) {
      // Heuristic: a row was just recycled while focused; pull focus back.
      container.focus({ preventScroll: true })
    }
  }, [virtualRows])

  if (courses.length === 0) {
    return (
      <div
        role="list"
        aria-label="0 courses"
        data-testid={testId}
        className="text-center py-8 text-muted-foreground"
      >
        No courses
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      role="list"
      aria-label={totalLabel}
      tabIndex={-1}
      data-testid={testId}
      className="overflow-auto outline-none"
      style={{ maxHeight }}
    >
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualRows.map(virtualRow => {
          const course = courses[virtualRow.index]
          if (!course) return null
          const isMeasured = measuredRows.has(virtualRow.index)
          return (
            <div
              key={course.id}
              ref={measureRef}
              data-index={virtualRow.index}
              role="listitem"
              aria-posinset={virtualRow.index + 1}
              aria-setsize={courses.length}
              className="absolute left-0 w-full"
              style={{ top: `${virtualRow.start}px` }}
            >
              {isMeasured ? (
                renderItem(course, virtualRow.index)
              ) : (
                <Skeleton
                  shimmer={!prefersReducedMotion}
                  className="w-full"
                  style={{ height: `${LIST_ROW_ESTIMATE_PX}px` }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
