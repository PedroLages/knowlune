import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import type { LearningPath } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

function makePath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: 'path-1',
    name: 'Test Path',
    description: 'A test learning path',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    isAIGenerated: false,
    ...overrides,
  }
}

function makeProgress(overrides: Partial<PathProgressSummary> = {}): PathProgressSummary {
  return {
    completionPct: 0,
    completedLessons: 0,
    totalLessons: 10,
    completedCourses: 0,
    totalCourses: 5,
    estimatedRemainingHours: 20,
    courseProgress: new Map(),
    ...overrides,
  }
}

function renderHero(props: Partial<Parameters<typeof PathHeroBanner>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PathHeroBanner
        path={makePath()}
        courseCount={3}
        completedCount={1}
        pathProgress={makeProgress()}
        thumbnailUrls={{}}
        currentCourseId={null}
        firstCourseId={null}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('PathHeroBanner', () => {
  it('renders path title and description', () => {
    renderHero({
      path: makePath({ name: 'React Mastery', description: 'Learn React from scratch' }),
    })
    expect(screen.getByText('React Mastery')).toBeInTheDocument()
    expect(screen.getByText('Learn React from scratch')).toBeInTheDocument()
  })

  it('renders back link to learning paths', () => {
    renderHero()
    const link = screen.getByText('Back to Learning Paths')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/learning-paths')
  })

  it('renders course count in metadata', () => {
    renderHero({ courseCount: 5 })
    expect(screen.getByText('5 courses')).toBeInTheDocument()
  })

  it('renders singular course text when count is 1', () => {
    renderHero({ courseCount: 1 })
    expect(screen.getByText('1 course')).toBeInTheDocument()
  })

  it('renders difficulty label when provided', () => {
    renderHero({ path: makePath({ difficultyLabel: 'Intermediate' }) })
    expect(screen.getByText('Intermediate')).toBeInTheDocument()
  })

  it('does not render difficulty badge when no label', () => {
    renderHero({ path: makePath({ difficultyLabel: undefined }) })
    expect(document.querySelector('.tracking-widest')).not.toBeInTheDocument()
  })

  it('shows "Start Learning" CTA when progress is 0%', () => {
    renderHero({
      pathProgress: makeProgress({ completionPct: 0 }),
      firstCourseId: 'course-1',
    })
    expect(screen.getByText('Start Learning')).toBeInTheDocument()
  })

  it('shows "Continue Learning" CTA when progress > 0%', () => {
    renderHero({
      pathProgress: makeProgress({ completionPct: 25 }),
      currentCourseId: 'course-2',
    })
    expect(screen.getByText('Continue Learning')).toBeInTheDocument()
  })

  it('CTA links to current course when in progress', () => {
    renderHero({
      pathProgress: makeProgress({ completionPct: 50 }),
      currentCourseId: 'course-current',
    })
    const link = screen.getByText('Continue Learning').closest('a')
    expect(link).toHaveAttribute('href', '/courses/course-current')
  })

  it('CTA links to first course when not started', () => {
    renderHero({
      pathProgress: makeProgress({ completionPct: 0 }),
      firstCourseId: 'course-first',
    })
    const link = screen.getByText('Start Learning').closest('a')
    expect(link).toHaveAttribute('href', '/courses/course-first')
  })

  it('hides CTA when no courses exist', () => {
    renderHero({ courseCount: 0, firstCourseId: null, currentCourseId: null })
    expect(screen.queryByText('Start Learning')).not.toBeInTheDocument()
    expect(screen.queryByText('Continue Learning')).not.toBeInTheDocument()
  })

  it('renders avatar stack from thumbnail URLs', () => {
    const { container } = renderHero({
      thumbnailUrls: { 'c1': 'https://example.com/1.jpg', 'c2': 'https://example.com/2.jpg' },
      courseCount: 2,
    })
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
  })

  it('renders placeholder icon when no thumbnails', () => {
    renderHero({ thumbnailUrls: {}, courseCount: 3 })
    // Should show BookOpen placeholder
    expect(document.querySelector('.lucide-book-open')).toBeInTheDocument()
  })

  it('renders overflow count for more than 4 courses', () => {
    renderHero({
      thumbnailUrls: {
        'c1': 'https://example.com/1.jpg',
        'c2': 'https://example.com/2.jpg',
        'c3': 'https://example.com/3.jpg',
        'c4': 'https://example.com/4.jpg',
      },
      courseCount: 7,
    })
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('renders completed count text', () => {
    renderHero({ courseCount: 5, completedCount: 2 })
    expect(screen.getByText('2 of 5 completed')).toBeInTheDocument()
  })

  it('renders empty state gracefully with 0 courses', () => {
    renderHero({ courseCount: 0, completedCount: 0 })
    expect(screen.getByText('0 courses')).toBeInTheDocument()
    expect(screen.queryByText(/completed/)).not.toBeInTheDocument()
  })

  it('renders dropdown menu when onEdit or onDelete provided', () => {
    const onEdit = () => {}
    renderHero({ onEdit })
    expect(screen.getByLabelText('Actions for Test Path')).toBeInTheDocument()
  })

  it('does not render dropdown when no actions provided', () => {
    renderHero()
    expect(screen.queryByLabelText('Actions for Test Path')).not.toBeInTheDocument()
  })

  it('renders estimated hours when available', () => {
    renderHero({ path: makePath({ estimatedHours: 40 }) })
    expect(screen.getByText(/3 courses · ~40h/)).toBeInTheDocument()
  })
})
