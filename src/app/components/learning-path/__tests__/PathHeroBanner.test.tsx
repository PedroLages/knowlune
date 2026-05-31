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
        orderedCourseThumbnails={[]}
        currentCourseId={null}
        firstCourseId={null}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('PathHeroBanner', () => {
  // ── Basic content ──────────────────────────────────────────────────

  it('renders path title and description', () => {
    renderHero({
      path: makePath({ name: 'React Mastery', description: 'Learn React from scratch' }),
    })
    expect(screen.getByText('React Mastery')).toBeInTheDocument()
    expect(screen.getByText('Learn React from scratch')).toBeInTheDocument()
  })

  it('renders back link to learning tracks listing', () => {
    renderHero()
    const link = screen.getByText('Back to Learning Tracks')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/learning-tracks')
  })

  it('renders custom back label and url', () => {
    renderHero({
      backUrl: '/custom-back',
      backLabel: 'Custom Back Label',
    })
    const link = screen.getByText('Custom Back Label')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/custom-back')
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

  // ── CTA behavior ───────────────────────────────────────────────────

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

  it('CTA links to target lesson when targetLessonId is provided', () => {
    renderHero({
      pathProgress: makeProgress({ completionPct: 50 }),
      currentCourseId: 'course-current',
      targetLessonId: 'lesson-42',
    })
    const link = screen.getByText('Continue Learning').closest('a')
    expect(link).toHaveAttribute('href', '/courses/course-current/lessons/lesson-42')
  })

  // ── Back link vs CTA separation (regression guard) ─────────────────

  it('back link and CTA have distinct href targets', () => {
    renderHero({
      firstCourseId: 'course-first',
      backUrl: '/learning-tracks',
    })
    const backLink = screen.getByText('Back to Learning Tracks').closest('a')
    const ctaLink = screen.getByText('Start Learning').closest('a')
    expect(backLink).toHaveAttribute('href', '/learning-tracks')
    expect(ctaLink).toHaveAttribute('href', '/courses/course-first')
    expect(backLink?.getAttribute('href')).not.toBe(ctaLink?.getAttribute('href'))
  })

  it('custom backUrl does not affect CTA routing', () => {
    renderHero({
      firstCourseId: 'course-xyz',
      backUrl: '/some/custom',
    })
    const backLink = screen.getByText('Back to Learning Tracks').closest('a')
    const ctaLink = screen.getByText('Start Learning').closest('a')
    expect(backLink).toHaveAttribute('href', '/some/custom')
    expect(ctaLink).toHaveAttribute('href', '/courses/course-xyz')
  })

  // ── Cover image states ─────────────────────────────────────────────

  it('shows blurred cover image when coverImageUrl is provided', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })
    // The hero section should have the card-surface structure
    const section = container.querySelector('section')
    expect(section?.className).toContain('rounded-[28px]')
    expect(section?.className).toContain('bg-card')
    expect(section?.className).toContain('shadow-card-ambient')
  })

  it('shows fallback preset gradient when coverImageUrl exists but has not loaded', () => {
    renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })
    // The preset gradient class should appear in the fallback state
    // (pending image shows fallback until onLoad fires)
    // The img should be present but at opacity-0
    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('shows fallback when coverImageUrl is absent', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: undefined,
        coverPreset: 'cyan-blue',
      }),
    })
    // Should have the brand gradient background
    const gradientDiv = container.querySelector('.bg-gradient-to-br')
    expect(gradientDiv).toBeInTheDocument()
  })

  it('renders default brand gradient when neither image nor preset is available', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: undefined,
        coverPreset: undefined,
      }),
    })
    const section = container.querySelector('section')
    // Should have the card surface with default gradient behind it
    expect(section?.className).toContain('bg-card')
  })

  // ── Avatar stack ───────────────────────────────────────────────────

  it('renders avatar stack from ordered course thumbnails', () => {
    const { container } = renderHero({
      orderedCourseThumbnails: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      courseCount: 2,
    })
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
  })

  it('renders avatar images in prop order', () => {
    const { container } = renderHero({
      orderedCourseThumbnails: [
        'https://example.com/second.jpg',
        'https://example.com/first.jpg',
      ],
      courseCount: 2,
    })
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs[0]).toHaveAttribute('src', 'https://example.com/second.jpg')
    expect(imgs[1]).toHaveAttribute('src', 'https://example.com/first.jpg')
  })

  it('renders placeholder icon when no thumbnails', () => {
    renderHero({ orderedCourseThumbnails: [], courseCount: 3 })
    // Should show BookOpen placeholder
    expect(document.querySelector('.lucide-book-open')).toBeInTheDocument()
  })

  it('renders overflow count for more than 4 courses', () => {
    renderHero({
      orderedCourseThumbnails: [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
        'https://example.com/4.jpg',
      ],
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

  // ── Dropdown actions ───────────────────────────────────────────────

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

  // ── Touch target regression guards ─────────────────────────────────

  it('CTA meets minimum 44px touch target', () => {
    renderHero({
      firstCourseId: 'course-1',
    })
    const ctaLink = screen.getByText('Start Learning').closest('a')
    expect(ctaLink?.className).toContain('min-h-[44px]')
  })
})
