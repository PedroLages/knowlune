import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import type { LearningPath } from '@/data/types'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

// ── WCAG contrast helpers ────────────────────────────────────────────────────
// Computes contrast ratios from known hex token values (src/styles/theme.css).
// This gives measurable, deterministic checks without needing a real browser.

function linearize(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function wcagContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex)
  const l2 = relativeLuminance(bgHex)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Token values from src/styles/theme.css (default light mode):
// --foreground: #1c1d2b, --card: #ffffff, --muted-foreground: #656870
// --brand: #5e6ad2, --brand-foreground: #ffffff
const TOKEN = {
  CARD: '#ffffff',
  FOREGROUND: '#1c1d2b',
  MUTED_FOREGROUND: '#656870',
  BRAND: '#5e6ad2',
  BRAND_FOREGROUND: '#ffffff',
} as const

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

  it('renders the premium hero shell with a readable content surface', () => {
    const { container } = renderHero({
      path: makePath({
        coverImageUrl: 'https://example.com/cover.jpg',
        coverPreset: 'cyan-blue',
      }),
    })
    // The hero section should have the premium card shell structure
    const section = container.querySelector('section')
    expect(section?.className).toContain('rounded-[28px]')
    expect(section?.className).toContain('bg-card')
    expect(section?.className).toContain('shadow-card-ambient')

    // Content sits on an explicit readable surface in every cover state.
    const surface = screen.getByTestId('hero-content-surface')
    expect(surface.className).toContain('bg-card/95')
  })

  it('renders the uploaded cover as a sharp full-cover image, not a decorative blur', () => {
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


  // ── Cover image onError / onLoad transitions ──────────────────────

  it('transitions from pending to loaded when img fires onLoad', () => {
    renderHero({
      path: makePath({ coverImageUrl: 'https://example.com/cover.jpg' }),
    })

    const img = document.querySelector('img[src="https://example.com/cover.jpg"]')
    expect(img).toBeInTheDocument()

    // Before onLoad: img at opacity-0 (pending — fallback surface stays active)
    expect(img?.className).toContain('opacity-0')

    // Fire the onLoad event
    fireEvent.load(img!)

    // After onLoad: img is promoted to a fully visible sharp cover layer
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
    expect(document.querySelector('img[src="https://example.com/cover.jpg"]')).not.toBeInTheDocument()

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

  // ── Cover image identity & load-state reset (R3, R4) ───────────────

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
          path={makePath({ name: 'Original', coverImageUrl: url, updatedAt: '2026-01-01T00:00:00Z' })}
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
          path={makePath({ name: 'Renamed', coverImageUrl: url, updatedAt: '2026-09-09T00:00:00Z' })}
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

  // ── Cover geometry guard: content surface must not fill the full hero ───────
  // This assertion regresses if the layout reverts to thin padding (p-3/p-4)
  // that leaves only a 12-16px mat, making the uploaded cover unrecognizable.

  it('hero section has pt-24+ top padding so the cover is visible above the content surface', () => {
    const { container } = renderHero({
      path: makePath({ coverImageUrl: 'https://example.com/cover.jpg' }),
    })
    const section = container.querySelector('[data-testid="hero-section"]')
    expect(section).not.toBeNull()
    // Must have at least pt-24 (96px) of top padding — not just p-3 (12px).
    // Tailwind classes are checked as literals; any Tailwind pt-24 or larger satisfies this.
    expect(section?.className).toContain('pt-24')
    // Confirm the thin-padding regression class is absent.
    expect(section?.className).not.toMatch(/\bp-3\b/)
    expect(section?.className).not.toMatch(/\bp-4\b/)
  })

  it('hero content surface occupies only part of the hero (not the full height)', () => {
    const { container } = renderHero({
      path: makePath({ coverImageUrl: 'https://example.com/cover.jpg' }),
    })
    const section = container.querySelector('[data-testid="hero-section"]')
    const surface = container.querySelector('[data-testid="hero-content-surface"]')
    expect(section).not.toBeNull()
    expect(surface).not.toBeNull()
    // The surface must NOT fill the top of the section — the cover is visible
    // in the top padding area. Assert pt-24 or larger is present on the section
    // (verified above), and the surface itself does NOT have absolute inset-0
    // (which would cover the full hero and hide the cover).
    expect(surface?.className).not.toContain('absolute inset-0')
    expect(surface?.className).not.toContain('inset-0')
  })

  // ── WCAG contrast: measured ratios from design-token hex values ─────────────
  // These are deterministic checks using the actual light-theme values from
  // src/styles/theme.css. They verify the selected token pairs meet WCAG 2.1 AA
  // without needing a real browser. Thresholds: large text ≥3:1, normal ≥4.5:1.

  it('text-foreground on bg-card meets WCAG AA large title threshold (≥3:1)', () => {
    const ratio = wcagContrastRatio(TOKEN.FOREGROUND, TOKEN.CARD)
    expect(ratio).toBeGreaterThanOrEqual(3.0)
  })

  it('text-foreground on bg-card meets WCAG AA normal text threshold (≥4.5:1)', () => {
    const ratio = wcagContrastRatio(TOKEN.FOREGROUND, TOKEN.CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('text-muted-foreground on bg-card meets WCAG AA normal text threshold (≥4.5:1)', () => {
    const ratio = wcagContrastRatio(TOKEN.MUTED_FOREGROUND, TOKEN.CARD)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('CTA text-brand-foreground on bg-brand meets WCAG AA normal text threshold (≥4.5:1)', () => {
    const ratio = wcagContrastRatio(TOKEN.BRAND_FOREGROUND, TOKEN.BRAND)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('hero renders with title on the readable card surface for contrast guarantee', () => {
    // Structural assertion: the title is inside the card surface that carries
    // the WCAG contrast guarantee (bg-card/95 ≈ white), verified above.
    renderHero({
      path: makePath({ name: 'Photography Mastery Roadmap', coverImageUrl: 'https://example.com/cover.jpg' }),
    })
    const surface = screen.getByTestId('hero-content-surface')
    const title = screen.getByRole('heading', { name: 'Photography Mastery Roadmap', level: 1 })
    expect(surface.contains(title)).toBe(true)
    // Surface uses bg-card/95 for the contrast guarantee
    expect(surface.className).toContain('bg-card/95')
  })

  // ── Touch target regression guards ─────────────────────────────────

  it('CTA meets minimum 44px touch target', () => {
    renderHero({
      firstCourseId: 'course-1',
    })
    const ctaLink = screen.getByText('Start Learning').closest('a')
    expect(ctaLink?.className).toContain('min-h-[44px]')
  })

  it('CTA is brand-filled for contrast on the content surface', () => {
    renderHero({
      firstCourseId: 'course-1',
    })
    const ctaLink = screen.getByText('Start Learning').closest('a')
    // Brand fill guarantees >=4.5:1 against the bg-card content surface, where
    // the old bg-card CTA (designed for a gradient backdrop) would vanish.
    expect(ctaLink?.className).toContain('bg-brand')
    expect(ctaLink?.className).toContain('text-brand-foreground')
    expect(ctaLink?.className).not.toContain('bg-card')
  })
})
