import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PathTimeline } from '@/app/components/learning-path/PathTimeline'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'
import type { GapResolution } from '@/app/components/learning-path/PathTimeline'

function makeEntry(overrides: Partial<LearningPathEntry> = {}): LearningPathEntry {
  return {
    id: `entry-${Math.random()}`,
    pathId: 'path-1',
    courseId: 'course-1',
    courseType: 'catalog',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

function makeCourseInfo(overrides: Partial<PathCourseInfo> = {}): PathCourseInfo {
  return {
    name: 'Test Course',
    type: 'catalog',
    authorName: 'Test Author',
    completionPct: 0,
    ...overrides,
  }
}

describe('PathTimeline', () => {
  const defaultProps = {
    courseInfoMap: new Map<string, PathCourseInfo>(),
    thumbnailUrls: {} as Record<string, string>,
    gapEntries: [] as LearningPathEntry[],
    onGapResolve: vi.fn() as (resolution: GapResolution) => void,
    onCourseClick: vi.fn() as (courseId: string) => void,
    autoScrollToCurrent: false,
    loadingResolve: new Set<string>(),
  }

  it('renders nothing when entries is empty', () => {
    const { container } = render(<PathTimeline {...defaultProps} entries={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders timeline entries with course names', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([['c1', makeCourseInfo({ name: 'Course Alpha' })]])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.getByText('Course Alpha')).toBeInTheDocument()
  })

  it('shows Locked badge for unstarted entries after the first', () => {
    const entries = [
      makeEntry({ courseId: 'c1', position: 1 }),
      makeEntry({ courseId: 'c2', position: 2 }),
    ]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 0 })],
      ['c2', makeCourseInfo({ completionPct: 0 })],
    ])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    // First entry defaults to Up Next; second entry shows Locked
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getAllByText('Locked').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Up Next badge for in-progress entries', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([['c1', makeCourseInfo({ completionPct: 45 })]])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.getByText('Up Next')).toBeInTheDocument()
  })

  it('shows Completed badge for finished entries', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([['c1', makeCourseInfo({ completionPct: 100 })]])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('calls onCourseClick when a course entry is clicked', () => {
    const onCourseClick = vi.fn()
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([['c1', makeCourseInfo({ name: 'Clickable' })]])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
        onCourseClick={onCourseClick}
      />
    )
    fireEvent.click(screen.getByText('Clickable'))
    expect(onCourseClick).toHaveBeenCalledWith('c1')
  })

  it('renders gap entries with resolve buttons', () => {
    const gapEntry = makeEntry({ id: 'gap-1', courseId: '', justification: 'Missing course' })
    render(
      <PathTimeline
        {...defaultProps}
        entries={[gapEntry]}
        gapEntries={[gapEntry]}
      />
    )
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.getByText('Replace')).toBeInTheDocument()
  })

  it('calls onGapResolve when gap resolve button is clicked', () => {
    const onGapResolve = vi.fn()
    const gapEntry = makeEntry({ id: 'gap-1', courseId: '', justification: 'Missing course' })
    render(
      <PathTimeline
        {...defaultProps}
        entries={[gapEntry]}
        gapEntries={[gapEntry]}
        onGapResolve={onGapResolve}
      />
    )
    fireEvent.click(screen.getByText('Import'))
    expect(onGapResolve).toHaveBeenCalledWith({ entryId: 'gap-1', type: 'import' })
  })

  it('handles entries without course info gracefully', () => {
    const entries = [makeEntry({ courseId: 'unknown' })]
    render(<PathTimeline {...defaultProps} entries={entries} />)
    expect(screen.getByText('Unknown Course')).toBeInTheDocument()
  })
})
