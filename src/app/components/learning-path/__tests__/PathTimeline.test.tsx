import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PathTimeline } from '@/app/components/learning-path/PathTimeline'
import type { LearningPathEntry, PathCourseInfo, ImportedVideo } from '@/data/types'
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

  it('calls onCourseClick when action button is clicked', () => {
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
    fireEvent.click(screen.getByText('Start Module'))
    expect(onCourseClick).toHaveBeenCalledWith('c1')
  })

  it('locked card is not interactive', () => {
    const entries = [
      makeEntry({ courseId: 'c1', position: 1 }),
      makeEntry({ courseId: 'c2', position: 2 }),
    ]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 0 })],
      ['c2', makeCourseInfo({ completionPct: 0 })],
    ])
    const onCourseClick = vi.fn()
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
        onCourseClick={onCourseClick}
      />
    )
    // Second entry is locked — should not have role="button"
    const listItems = screen.getAllByRole('listitem')
    const lockedItem = listItems[1]
    expect(lockedItem.querySelector('[role="button"]')).toBeNull()
    expect(lockedItem.querySelector('[tabindex]')).toBeNull()
  })

  it('locked badge shows Lock icon', () => {
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
    // Second entry badge should contain "Locked" with a Lock icon
    const lockedBadges = screen.getAllByText('Locked')
    expect(lockedBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('Completed badge shows checkmark icon and Up Next badge shows pulsing dot', () => {
    const entries = [
      makeEntry({ courseId: 'c1', position: 1 }),
      makeEntry({ courseId: 'c2', position: 2 }),
    ]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 100 })],
      ['c2', makeCourseInfo({ completionPct: 45 })],
    ])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Up Next')).toBeInTheDocument()
  })

  it('displays description, video count, and duration when available', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      [
        'c1',
        makeCourseInfo({
          completionPct: 0,
          description: 'Learn the basics of React',
          videoCount: 5,
          totalDuration: 7200,
        }),
      ],
    ])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.getByText('Learn the basics of React')).toBeInTheDocument()
    expect(screen.getByText(/5 lessons/)).toBeInTheDocument()
  })

  it('hides stats row when values are zero or missing', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 0, videoCount: 0, totalDuration: 0 })],
    ])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
      />
    )
    expect(screen.queryByText(/lessons/)).toBeNull()
  })

  it('up-next module expands by default showing lesson rows', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 45, videoCount: 2 })],
    ])
    const videos = new Map([
      [
        'c1',
        [
          { id: 'v1', courseId: 'c1', filename: 'Intro.mp4', duration: 120, order: 1 },
          { id: 'v2', courseId: 'c1', filename: 'Setup.mp4', duration: 180, order: 2 },
        ] as ImportedVideo[],
      ],
    ])
    render(
      <MemoryRouter>
        <PathTimeline
          {...defaultProps}
          entries={entries}
          courseInfoMap={infoMap}
          videosByCourse={videos}
        />
      </MemoryRouter>
    )
    // Lesson rows should be visible (expanded by default for in-progress)
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('Setup')).toBeInTheDocument()
  })

  it('shows subsection headings when lessonGroups has multiple titled groups', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 45, videoCount: 2 })],
    ])
    const v1 = {
      id: 'v1',
      courseId: 'c1',
      filename: 'a.mp4',
      duration: 60,
      order: 0,
      path: '',
      format: 'mp4' as const,
      fileHandle: null,
    }
    const v2 = {
      id: 'v2',
      courseId: 'c1',
      filename: 'b.mp4',
      duration: 60,
      order: 1,
      path: '',
      format: 'mp4' as const,
      fileHandle: null,
    }
    const lessonGroups = new Map([
      [
        'c1',
        [
          { title: 'Module A', videos: [v1], pdfs: [] },
          { title: 'Module B', videos: [v2], pdfs: [] },
        ],
      ],
    ])
    render(
      <MemoryRouter>
        <PathTimeline
          {...defaultProps}
          entries={entries}
          courseInfoMap={infoMap}
          lessonGroupsByCourse={lessonGroups}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Module A')).toBeInTheDocument()
    expect(screen.getByText('Module B')).toBeInTheDocument()
  })

  it('hides inner subsection heading for a single untitled lesson group', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 45, videoCount: 1 })],
    ])
    const v1 = {
      id: 'v1',
      courseId: 'c1',
      filename: 'solo.mp4',
      duration: 60,
      order: 0,
      path: '',
      format: 'mp4' as const,
      fileHandle: null,
    }
    const lessonGroups = new Map([['c1', [{ title: '', videos: [v1], pdfs: [] }]]])
    render(
      <MemoryRouter>
        <PathTimeline
          {...defaultProps}
          entries={entries}
          courseInfoMap={infoMap}
          lessonGroupsByCourse={lessonGroups}
        />
      </MemoryRouter>
    )
    expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument()
    expect(screen.getByText('solo')).toBeInTheDocument()
  })

  it('completed module can be toggled open to show lesson rows', () => {
    const entries = [makeEntry({ courseId: 'c1' })]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ completionPct: 100, videoCount: 1 })],
    ])
    const videos = new Map([
      [
        'c1',
        [
          { id: 'v1', courseId: 'c1', filename: 'Recap.mp4', duration: 90, order: 1 },
        ] as ImportedVideo[],
      ],
    ])
    render(
      <MemoryRouter>
        <PathTimeline
          {...defaultProps}
          entries={entries}
          courseInfoMap={infoMap}
          videosByCourse={videos}
        />
      </MemoryRouter>
    )
    // Completed module starts collapsed — lesson not visible
    expect(screen.queryByText('Recap')).toBeNull()
    // Click the card header to expand
    fireEvent.click(screen.getByText('Test Course'))
    expect(screen.getByText('Recap')).toBeInTheDocument()
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

  it('skipCourseId excludes the matching entry from rendering', () => {
    const entries = [
      makeEntry({ courseId: 'c1', position: 1 }),
      makeEntry({ courseId: 'c2', position: 2 }),
      makeEntry({ courseId: 'c3', position: 3 }),
    ]
    const infoMap = new Map([
      ['c1', makeCourseInfo({ name: 'Course One' })],
      ['c2', makeCourseInfo({ name: 'Course Two' })],
      ['c3', makeCourseInfo({ name: 'Course Three' })],
    ])
    render(
      <PathTimeline
        {...defaultProps}
        entries={entries}
        courseInfoMap={infoMap}
        skipCourseId="c2"
      />
    )
    expect(screen.getByText('Course One')).toBeInTheDocument()
    expect(screen.queryByText('Course Two')).not.toBeInTheDocument()
    expect(screen.getByText('Course Three')).toBeInTheDocument()
  })
})
