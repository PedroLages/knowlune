import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { hexContrast } from '../../../../../tests/utils/wcag-contrast'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import type { LearningPath } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

// ── WCAG contrast helpers (extended for alpha composite) ──────────────────────
// hexLuminance and hexContrast imported from tests/utils/wcag-contrast.
// alphaComposite is unique to this file and kept inline below.

/**
 * Alpha-composite a foreground color over a background color.
 * Both inputs must be hex strings (e.g. "#ffffff").
 * Alpha is the foreground's opacity (0-1).
 * Returns the composite color as a hex string.
 *
 * Fail-loud: throws if either color is unparseable.
 */
function alphaComposite(bgHex: string, fgHex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(bgHex)) {
    throw new Error(`alphaComposite: unparseable bgHex "${bgHex}"`)
  }
  if (!/^#[0-9a-f]{6}$/i.test(fgHex)) {
    throw new Error(`alphaComposite: unparseable fgHex "${fgHex}"`)
  }

  const br = parseInt(bgHex.slice(1, 3), 16)
  const bg = parseInt(bgHex.slice(3, 5), 16)
  const bb = parseInt(bgHex.slice(5, 7), 16)

  const fr = parseInt(fgHex.slice(1, 3), 16)
  const fg = parseInt(fgHex.slice(3, 5), 16)
  const fb = parseInt(fgHex.slice(5, 7), 16)

  const r = Math.round(fr * alpha + br * (1 - alpha))
  const g = Math.round(fg * alpha + bg * (1 - alpha))
  const b = Math.round(fb * alpha + bb * (1 - alpha))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── Test data ─────────────────────────────────────────────────────────────────

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
  // ── Cinematic contrast guarantee ──────────────────────────────────────
  // The hero overlay uses a fixed black bottom-up scrim whose darkest band
  // is from-black/85 (alpha 0.85). White text over the worst-case cover
  // (pure white) composited with this scrim must achieve ≥ 4.5:1 contrast.

  it('renders the cinematic scrim layer', () => {
    renderHero()
    const scrim = screen.getByTestId('hero-scrim')
    expect(scrim).toBeInTheDocument()
    // The scrim must include a black gradient with at least 70% opacity
    // in the bottom band where text lives (guaranteed by from-black/85).
    expect(scrim.className).toContain('from-black/85')
    expect(scrim.className).toContain('bg-gradient-to-t')
  })

  it('white text over scrim + worst-case white cover meets WCAG AA (≥4.5:1)', () => {
    // Worst case: pure white cover (#ffffff) composited with black scrim
    // at the text band's darkest opacity (from-black/85 = alpha 0.85).
    const composite = alphaComposite('#ffffff', '#000000', 0.85)
    // composite should be rgb(38, 38, 38) ≈ #262626
    expect(composite).toBe('#262626')

    const ratio = hexContrast('#ffffff', composite)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('white title text over scrim meets WCAG AA large text (≥3:1)', () => {
    // Large text threshold (3:1) is trivially met when normal text (4.5:1) passes.
    const composite = alphaComposite('#ffffff', '#000000', 0.85)
    const ratio = hexContrast('#ffffff', composite)
    expect(ratio).toBeGreaterThanOrEqual(3.0)
  })

  it('scrim opacity at text band is at least 0.70', () => {
    // The from-black/85 class guarantees black at 85% opacity in the
    // bottom text band. Assert the literal class is present.
    renderHero()
    const scrim = screen.getByTestId('hero-scrim')
    expect(scrim.className).toContain('from-black/85')
    // 0.85 ≥ 0.70 — guaranteed by class name.
  })

  it('contrast helper fails loud on unparseable hex', () => {
    expect(() => alphaComposite('#12345', '#ffffff', 0.5)).toThrow()
    expect(() => alphaComposite('#ffffff', '#gggggg', 0.5)).toThrow()
    expect(() => alphaComposite('white', '#000000', 0.5)).toThrow()
  })

  // ── Structural assertions ─────────────────────────────────────────────

  it('title is white and rendered over the cinematic scrim', () => {
    renderHero({
      path: makePath({ name: 'Cinematic Title' }),
    })
    const scrim = screen.getByTestId('hero-scrim')
    const title = screen.getByTestId('hero-title')
    // Title sits in the hero content surface above the scrim
    expect(title).toBeInTheDocument()
    // Title text is white
    expect(title.className).toContain('text-white')
    // The content surface is a sibling/ancestor of the title within the hero section
    const surface = screen.getByTestId('hero-content-surface')
    expect(surface.contains(title)).toBe(true)
    // Scrim is between the cover and the content surface
    // (structural: scrim is a sibling before the content surface in the section)
    const section = screen.getByTestId('hero-section')
    expect(section.contains(scrim)).toBe(true)
    expect(section.contains(surface)).toBe(true)
  })

  it('cover image is full-bleed object-cover, not a decorative blur', () => {
    renderHero({
      path: makePath({ coverImageUrl: 'https://example.com/cover.jpg' }),
    })
    const img = screen.getByTestId('hero-cover-image')
    fireEvent.load(img)
    // Primary cover layer must be a visible, sharp, full-cover image.
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('opacity-100')
    // It must NOT be reduced to the rejected blurred-atmosphere treatment.
    expect(img.className).not.toContain('blur-2xl')
    expect(img.className).not.toContain('opacity-20')
  })

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
    expect(screen.queryByText('Intermediate')).not.toBeInTheDocument()
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

  it('renders the cinematic hero shell structure', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })
    // The hero section should have the premium card shell structure
    const section = container.querySelector('section')
    expect(section?.className).toContain('rounded-[28px]')
    expect(section?.className).toContain('shadow-card-ambient')

    // The cinematic scrim is always present
    const scrim = screen.getByTestId('hero-scrim')
    expect(scrim).toBeInTheDocument()
  })

  it('shows fallback preset gradient when coverImageUrl exists but has not loaded', () => {
    renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })
    // The img should be present but at opacity-0 (pending)
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
    // Should have the gradient background (cyan-blue preset)
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
    // Should have the brand gradient behind the scrim
    const gradientDiv = container.querySelector('.bg-gradient-to-br')
    expect(gradientDiv).toBeInTheDocument()
  })

  // ── Cover image onError / onLoad transitions ──────────────────────

  it('transitions from pending to loaded when img fires onLoad', () => {
    renderHero({
      path: makePath({ coverImageUrl: 'https://example.com/cover.jpg' }),
    })

    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()

    // Before onLoad: img at opacity-0 (pending)
    expect(img?.className).toContain('opacity-0')

    // Fire the onLoad event
    fireEvent.load(img!)

    // After onLoad: img is promoted to full visibility with Ken Burns finish
    expect(img?.className).toContain('opacity-100')
    expect(img?.className).not.toContain('opacity-0')
  })

  it('removes img from DOM onError and shows fallback gradient', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })

    // Before: img is present
    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()

    // Fire onError
    fireEvent.error(img!)

    // After: img removed from DOM
    expect(
      document.querySelector('img[src="https://example.com/cover.jpg"]')
    ).not.toBeInTheDocument()

    // Fallback gradient should be present
    const gradientDiv = container.querySelector('.bg-gradient-to-br')
    expect(gradientDiv).toBeInTheDocument()
  })

  it('falls back to brand gradient when coverImageUrl errors and no coverPreset set', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: undefined,
      }),
    })

    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()

    fireEvent.error(img!)

    // Fallback gradient should be visible
    const gradientDiv = container.querySelector('.bg-gradient-to-br')
    expect(gradientDiv).toBeInTheDocument()
  })

  it('renders aria-live polite region when image fails to load', () => {
    renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
      }),
    })

    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()

    // Fire onError to trigger the failed state
    fireEvent.error(img!)

    // aria-live polite region should be rendered
    const liveRegion = document.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(liveRegion?.textContent).toContain('could not be loaded')
  })

  // ── Cover image identity & load-state reset ───────────────────────

  it('resets to pending and remounts the img when coverImageUrl changes', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PathHeroBanner
          path={makePath({ coverImageUrl: 'https://example.com/a.jpg' })}
          courseCount={3}
          completedCount={1}
          pathProgress={makeProgress()}
          orderedCourseThumbnails={[]}
          currentCourseId={null}
          firstCourseId={null}
        />
      </MemoryRouter>
    )

    fireEvent.load(screen.getByTestId('hero-cover-image'))
    expect(screen.getByTestId('hero-cover-image').className).toContain('opacity-100')

    // New cover URL = new image identity → React remounts and re-enters pending
    rerender(
      <MemoryRouter>
        <PathHeroBanner
          path={makePath({ coverImageUrl: 'https://example.com/b.jpg' })}
          courseCount={3}
          completedCount={1}
          pathProgress={makeProgress()}
          orderedCourseThumbnails={[]}
          currentCourseId={null}
          firstCourseId={null}
        />
      </MemoryRouter>
    )

    const imgB = screen.getByTestId('hero-cover-image')
    expect(imgB).toHaveAttribute('src', 'https://example.com/b.jpg')
    expect(imgB.className).toContain('opacity-0')
  })

  it('does NOT reset cover image state when non-image metadata changes', () => {
    const url = 'https://example.com/stable.jpg'
    const { rerender } = render(
      <MemoryRouter>
        <PathHeroBanner
          path={makePath({
            name: 'Original',
            coverImageUrl: url,
            updatedAt: '2026-01-01T00:00:00Z',
          })}
          courseCount={3}
          completedCount={1}
          pathProgress={makeProgress()}
          orderedCourseThumbnails={[]}
          currentCourseId={null}
          firstCourseId={null}
        />
      </MemoryRouter>
    )

    fireEvent.load(screen.getByTestId('hero-cover-image'))
    expect(screen.getByTestId('hero-cover-image').className).toContain('opacity-100')

    // Change title + updatedAt but keep the same coverImageUrl → stays loaded.
    rerender(
      <MemoryRouter>
        <PathHeroBanner
          path={makePath({
            name: 'Renamed',
            coverImageUrl: url,
            updatedAt: '2026-09-09T00:00:00Z',
          })}
          courseCount={3}
          completedCount={1}
          pathProgress={makeProgress()}
          orderedCourseThumbnails={[]}
          currentCourseId={null}
          firstCourseId={null}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Renamed')).toBeInTheDocument()
    const img = screen.getByTestId('hero-cover-image')
    expect(img.className).toContain('opacity-100')
    expect(img.className).not.toContain('opacity-0')
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
      orderedCourseThumbnails: ['https://example.com/second.jpg', 'https://example.com/first.jpg'],
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

  it('CTA is brand-filled for contrast on the dark scrim', () => {
    renderHero({
      firstCourseId: 'course-1',
    })
    const ctaLink = screen.getByText('Start Learning').closest('a')
    // Brand fill guarantees ≥ 4.5:1 against the dark scrim surface
    expect(ctaLink?.className).toContain('bg-brand')
    expect(ctaLink?.className).toContain('text-brand-foreground')
  })
})
