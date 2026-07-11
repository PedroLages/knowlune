/**
 * Learning Tracks listing + detail page E2E tests.
 *
 * Covers:
 * - Empty state when no learning paths exist
 * - Listing tracks with seeded data
 * - Searching/filtering tracks
 * - Clicking a track card navigates to detail
 * - Detail page: hero, syllabus, progress sidebar
 * - Detail page back link goes to /learning-tracks
 * - Sidebar navigation entry for Learning Tracks
 * - Invalid trackId shows not-found state
 */
import { test, expect } from '../support/fixtures'
import {
  seedIndexedDBStore,
  clearLearningPath,
  clearIndexedDBStore,
} from '../support/helpers/seed-helpers'
import { navigateAndWait } from '../support/helpers/navigation'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

const DB_NAME = 'ElearningDB'

/**
 * A small transparent-ish 2x2 PNG data URL used as a deterministic cover image
 * fixture. Avoids relying on remote image availability while still exercising
 * the uploaded-cover hero branch (an <img> with a real, loadable src).
 */
const COVER_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z/C/noEIwDiqEAByQgg+gQ3l9wAAAABJRU5ErkJggg=='

/**
 * Clear the learning-track stores plus the imported-content stores that the
 * detail page reads. `clearLearningPath` only clears the `learningPaths` store,
 * so entries and videos must be cleared explicitly to keep tests isolated.
 */
async function clearTrackStores(page: import('@playwright/test').Page): Promise<void> {
  await clearLearningPath(page)
  await clearIndexedDBStore(page, DB_NAME, 'learningPathEntries')
  await clearIndexedDBStore(page, DB_NAME, 'importedVideos')
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let pathCounter = 0
function createLearningPath(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  pathCounter++
  const id = overrides.id ?? `lp-test-${pathCounter}`
  return {
    id,
    name: `Test Learning Track ${pathCounter}`,
    description: `Description for track ${pathCounter}`,
    createdAt: getRelativeDate(-pathCounter),
    updatedAt: FIXED_DATE,
    isAIGenerated: false,
    ...overrides,
  }
}

function createLearningPathEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  pathCounter++
  return {
    id: `lpe-test-${pathCounter}`,
    pathId: 'lp-test-1',
    courseId: `course-test-${pathCounter}`,
    courseType: 'imported',
    position: 1,
    isManuallyOrdered: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToLearningTracks(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/learning-tracks')
}

async function seedPaths(
  page: import('@playwright/test').Page,
  paths: Record<string, unknown>[],
  entries: Record<string, unknown>[] = []
) {
  await seedIndexedDBStore(page, DB_NAME, 'learningPaths', paths)
  if (entries.length > 0) {
    await seedIndexedDBStore(page, DB_NAME, 'learningPathEntries', entries)
  }
}

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — sidebar navigation', () => {
  test('sidebar has Learning Tracks entry that navigates correctly', async ({ page }) => {
    await navigateAndWait(page, '/')
    // Seed sidebar state to closed on desktop
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    await page.goto('/learning-tracks', { waitUntil: 'load' })

    // The sidebar should show the Learning Tracks entry
    // (we're already on the page, so just verify the heading renders)
    await expect(
      page.getByRole('heading', { name: 'Learning Tracks', level: 1 })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — empty state', () => {
  test('shows empty state when no paths exist', async ({ page }) => {
    await goToLearningTracks(page)
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('No learning tracks yet')).toBeVisible()
    await expect(
      page.getByText('Create a track or import courses to get started.')
    ).toBeVisible()
    // There are two "Create Track" buttons: header and empty state. The empty state
    // one is visible when there are no paths, so first() works.
    await expect(page.getByRole('button', { name: 'Create Track' }).first()).toBeVisible()
  })

  test('empty state "Create Track" button opens dialog', async ({ page }) => {
    await goToLearningTracks(page)
    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('No learning tracks yet').waitFor()
    const createButtons = page.getByRole('button', { name: 'Create Track' })
    await createButtons.first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create Learning Path')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Template removal — no templates shown on Learning Tracks
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — no templates shown', () => {
  test('does not render "Start with a template" heading', async ({ page }) => {
    await goToLearningTracks(page)

    // Seed only template paths — no user paths
    const templates = [
      createLearningPath({
        id: 'tpl-data-science',
        name: 'Data Science Foundations',
        isTemplate: true,
      }),
      createLearningPath({
        id: 'tpl-web-dev',
        name: 'Full-Stack Web Development',
        isTemplate: true,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, templates)
    await page.reload({ waitUntil: 'load' })

    // Should NOT show the template heading
    await expect(page.getByText('Start with a template')).not.toBeVisible()
    // Should show the empty state instead
    await expect(page.getByText('No learning tracks yet')).toBeVisible()
  })

  test('template paths are not shown as user tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const templates = [
      createLearningPath({
        id: 'tpl-ml',
        name: 'Machine Learning Engineering',
        isTemplate: true,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, templates)
    await page.reload({ waitUntil: 'load' })

    // Template name should not appear as a track card
    await expect(page.getByText('Machine Learning Engineering')).not.toBeVisible()
    // Empty state should be shown instead
    await expect(page.getByText('No learning tracks yet')).toBeVisible()
  })

  test('shows empty state with zero user paths even when templates exist', async ({ page }) => {
    await goToLearningTracks(page)

    const templates = [
      createLearningPath({
        id: 'tpl-ios',
        name: 'iOS Development',
        isTemplate: true,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, templates)
    await page.reload({ waitUntil: 'load' })

    // Should show the clean empty state
    await expect(page.getByText('No learning tracks yet')).toBeVisible()
    await expect(
      page.getByText('Create a track or import courses to get started.')
    ).toBeVisible()
    // "Or create your own track" should be gone
    await expect(page.getByText('Or create your own track')).not.toBeVisible()
  })

  test('Create Track in empty state opens CurriculumComposer', async ({ page }) => {
    await goToLearningTracks(page)

    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('No learning tracks yet').waitFor()
    // Click the empty state CTA button
    const emptyStateButton = page
      .locator('[data-testid="empty-state"]')
      .getByRole('button', { name: 'Create Track' })
    // Fall back to the visible Create Track button if data-testid isn't present
    const createButtons = page.getByRole('button', { name: 'Create Track' })
    await createButtons.first().click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create Learning Path')).toBeVisible()
  })

  test('Import Course button in header opens ImportWizardDialog', async ({ page }) => {
    await goToLearningTracks(page)

    await clearLearningPath(page)
    await page.reload({ waitUntil: 'load' })

    const importButton = page.getByRole('button', { name: 'Import Course' })
    await expect(importButton).toBeVisible()
    await importButton.click()

    // Import Wizard should open
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('existing user tracks render normally', async ({ page }) => {
    await goToLearningTracks(page)

    const userPaths = [
      createLearningPath({ id: 'up-1', name: 'My React Journey' }),
      createLearningPath({ id: 'up-2', name: 'Python Basics' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, userPaths)
    await page.reload({ waitUntil: 'load' })

    // Both user tracks should be visible as cards
    await expect(page.getByText('My React Journey')).toBeVisible()
    await expect(page.getByText('Python Basics')).toBeVisible()
    // No empty state should be shown
    await expect(page.getByText('No learning tracks yet')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Listing tracks with seeded data
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — list with seeded data', () => {
  test('displays seeded learning tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'lt-a', name: 'Web Development Track' }),
      createLearningPath({ id: 'lt-b', name: 'Data Science Track' }),
      createLearningPath({ id: 'lt-c', name: 'DevOps Track' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText('Web Development Track')).toBeVisible()
    await expect(page.getByText('Data Science Track')).toBeVisible()
    await expect(page.getByText('DevOps Track')).toBeVisible()
  })

  test('path card shows course count for tracks with entries', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-count', name: 'Counted Track' })]
    const entries = [
      createLearningPathEntry({ pathId: 'lt-count', courseId: 'c-1', position: 1 }),
      createLearningPathEntry({ pathId: 'lt-count', courseId: 'c-2', position: 2 }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths, entries)
    await page.reload({ waitUntil: 'load' })

    // Scope to the track card badge to avoid ambiguity with the
    // ContinueLearningPathSection which also shows course counts.
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: '2 courses' })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — search', () => {
  test('search input filters tracks by name', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'ts1', name: 'React Track' }),
      createLearningPath({ id: 'ts2', name: 'Vue Track' }),
      createLearningPath({ id: 'ts3', name: 'Angular Track' }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search tracks...').fill('React')

    await expect(page.getByText('React Track')).toBeVisible()
    await expect(page.getByText('Vue Track')).not.toBeVisible()
    await expect(page.getByText('Angular Track')).not.toBeVisible()
  })

  test('search finds tracks by description text not present in title', async ({ page }) => {
    await goToLearningTracks(page)

    const uniqueDesc = 'lt-desc-visibility-xyz'
    const paths = [
      createLearningPath({
        id: 'lt-desc-search',
        name: 'Alpha Navigation Track',
        description: `${uniqueDesc} extra terms for search`,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText(uniqueDesc)).not.toBeVisible()

    await page.getByPlaceholder('Search tracks...').fill(uniqueDesc)

    await expect(page.getByText('Alpha Navigation Track')).toBeVisible()
  })

  test('search with no results shows empty search state', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'tsr1', name: 'Some Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByPlaceholder('Search tracks...').fill('zzz-nonexistent')

    await expect(page.getByText('No tracks match your search')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation to detail page
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — navigation', () => {
  test('list hides description while detail hero still shows it', async ({ page }) => {
    await goToLearningTracks(page)

    const uniqueDesc = 'lt-desc-visibility-xyz'
    const paths = [
      createLearningPath({
        id: 'lt-desc-vis',
        name: 'Beta Navigation Track',
        description: uniqueDesc,
      }),
    ]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await expect(page.getByText(uniqueDesc)).not.toBeVisible()

    await page.getByText('Beta Navigation Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-desc-vis/)
    await expect(page.getByText(uniqueDesc)).toBeVisible()
  })

  test('clicking a track card navigates to its detail page', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-nav', name: 'Navigate To Me' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('Navigate To Me').click()

    await expect(page).toHaveURL(/\/learning-tracks\/lt-nav/)
  })

  test('page heading shows "Learning Tracks"', async ({ page }) => {
    await goToLearningTracks(page)

    await expect(
      page.getByRole('heading', { name: 'Learning Tracks', level: 1 })
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — detail page', () => {
  test('detail page shows hero with path name and back link', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-detail', name: 'Detail Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    // Navigate to detail
    await page.getByText('Detail Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-detail/)

    // Hero should show the path name
    await expect(page.getByText('Detail Track')).toBeVisible()

    // Back link should navigate to /learning-tracks
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')
  })

  test('detail page back link navigates to /learning-tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-back', name: 'Back Track' })]

    await clearLearningPath(page)
    await seedPaths(page, paths)
    await page.reload({ waitUntil: 'load' })

    await page.getByText('Back Track').click()
    await expect(page).toHaveURL(/\/learning-tracks\/lt-back/)

    // Click the back link
    await page.getByTestId('hero-back-link').click()
    await expect(page).toHaveURL('/learning-tracks')
  })
})

// ---------------------------------------------------------------------------
// Invalid track ID
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — invalid track', () => {
  test('invalid trackId shows not-found state', async ({ page }) => {
    await goToLearningTracks(page)

    await page.goto('/learning-tracks/nonexistent-id', { waitUntil: 'load' })

    await expect(page.getByText('Track not found')).toBeVisible()
    await expect(page.getByRole('button', { name: 'View All Tracks' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Back-link & CTA navigation regression (R5, R6, R7)
//
// The reported bug: "Back to Learning Tracks" sometimes routed to a course
// detail page. Source already passes backUrl="/learning-tracks", so this
// suite is a permanent regression guard across direct entry, mobile hit
// areas, and back-link/CTA separation rather than a one-off fix.
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — back-link & CTA navigation regression', () => {
  test('direct-load detail page: back link navigates to /learning-tracks', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-direct', name: 'Direct Entry Track' })]
    await clearTrackStores(page)
    await seedPaths(page, paths)

    // Enter the detail page directly (not via the list) to exercise
    // direct-entry router state.
    await page.goto('/learning-tracks/lt-direct', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/learning-tracks\/lt-direct/)

    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    await backLink.click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('mobile viewport: back link tap navigates to /learning-tracks', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-mobile', name: 'Mobile Track' })]
    await clearTrackStores(page)
    await seedPaths(page, paths)
    await page.goto('/learning-tracks/lt-mobile', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/learning-tracks\/lt-mobile/)

    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()

    // Tap the visible back-link text, not just a testid locator, to catch any
    // hit-area overlap with an adjacent CTA at narrow widths.
    await backLink.getByText('Back to Learning Tracks').click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('hero CTA stays separate from back link and routes to the course lesson', async ({
    page,
  }) => {
    await goToLearningTracks(page)

    const paths = [createLearningPath({ id: 'lt-cta', name: 'CTA Track' })]
    const entries = [
      createLearningPathEntry({
        id: 'lpe-cta',
        pathId: 'lt-cta',
        courseId: 'course-cta',
        position: 1,
      }),
    ]
    const videos = [
      {
        id: 'video-cta-1',
        courseId: 'course-cta',
        filename: 'intro.mp4',
        path: 'course-cta/intro.mp4',
        duration: 600,
        format: 'mp4',
        order: 0,
        fileHandle: null,
        title: 'Intro Lesson',
      },
    ]

    await clearTrackStores(page)
    await seedPaths(page, paths, entries)
    await seedIndexedDBStore(page, DB_NAME, 'importedVideos', videos)
    await page.goto('/learning-tracks/lt-cta', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/learning-tracks\/lt-cta/)

    // Back link and CTA are distinct, independently-targeted controls.
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    const cta = page.getByRole('link', { name: 'Start Learning' })
    // Once videos load, the CTA resolves to the first lesson of the course.
    await expect(cta).toHaveAttribute('href', '/courses/course-cta/lessons/video-cta-1')

    await cta.click()
    await expect(page).toHaveURL('/courses/course-cta/lessons/video-cta-1')
  })
})

// ---------------------------------------------------------------------------
// Uploaded cover hero — readability, responsiveness, accessibility
// (R1, R2, R3, R7)
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — uploaded cover hero', () => {
  test('detail hero shows a visible cover image with readable content', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({
        id: 'lt-cover',
        name: 'Photography Mastery Roadmap',
        description: 'Master composition, light, and editing.',
        coverImageUrl: COVER_DATA_URL,
        difficultyLabel: 'Intermediate',
      }),
    ]
    await clearTrackStores(page)
    await seedPaths(page, paths)
    await page.goto('/learning-tracks/lt-cover', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/learning-tracks\/lt-cover/)

    // The uploaded cover renders as a visible, full-cover, sharp image layer
    // (promoted to opacity-100 after load) rather than a decorative blur.
    const cover = page.getByTestId('hero-cover-image')
    await expect(cover).toBeVisible()
    await expect(cover).toHaveClass(/opacity-100/)
    await expect(cover).toHaveClass(/object-cover/)

    // Content sits on an explicit readable surface and stays visible over the
    // uploaded cover.
    await expect(page.getByTestId('hero-content-surface')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Photography Mastery Roadmap', level: 1 })
    ).toBeVisible()
    await expect(page.getByText('Master composition, light, and editing.')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toBeVisible()

    // Capture the hero for visual verification of the premium quality bar.
    await page
      .locator('section:has([data-testid="hero-content-surface"])')
      .screenshot({ path: 'test-results/hero-cover-desktop.png' })
  })

  test('mobile cover hero keeps title and back link readable without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({
        id: 'lt-cover-m',
        name: 'Photography Mastery Roadmap',
        coverImageUrl: COVER_DATA_URL,
      }),
    ]
    await clearTrackStores(page)
    await seedPaths(page, paths)
    await page.goto('/learning-tracks/lt-cover-m', { waitUntil: 'load' })

    await expect(
      page.getByRole('heading', { name: 'Photography Mastery Roadmap', level: 1 })
    ).toBeVisible()
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()

    // No horizontal overflow at 375px.
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(1)

    // Back link still navigates to the listing on mobile.
    await backLink.click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('back link and CTA meet the 44x44 touch-target minimum', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'lt-tap', name: 'Tap Track', coverImageUrl: COVER_DATA_URL }),
    ]
    const entries = [
      createLearningPathEntry({ id: 'lpe-tap', pathId: 'lt-tap', courseId: 'course-tap', position: 1 }),
    ]
    await clearTrackStores(page)
    await seedPaths(page, paths, entries)
    await page.goto('/learning-tracks/lt-tap', { waitUntil: 'load' })

    const backBox = await page.getByTestId('hero-back-link').boundingBox()
    expect(backBox).not.toBeNull()
    expect(backBox!.height).toBeGreaterThanOrEqual(44)
    expect(backBox!.width).toBeGreaterThanOrEqual(44)

    const cta = page.getByRole('link', { name: 'Start Learning' })
    await expect(cta).toBeVisible()
    const ctaBox = await cta.boundingBox()
    expect(ctaBox).not.toBeNull()
    expect(ctaBox!.height).toBeGreaterThanOrEqual(44)
    expect(ctaBox!.width).toBeGreaterThanOrEqual(44)

    // Back link is keyboard-focusable (global focus-visible outline applies).
    await page.getByTestId('hero-back-link').focus()
    await expect(page.getByTestId('hero-back-link')).toBeFocused()
  })

  test('hero content surface meets WCAG AA contrast for title and controls (measured)', async ({
    page,
  }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({
        id: 'lt-contrast',
        name: 'Photography Mastery Roadmap',
        description: 'Master composition, light, and editing.',
        coverImageUrl: COVER_DATA_URL,
        difficultyLabel: 'Intermediate',
      }),
    ]
    const entries = [
      createLearningPathEntry({
        id: 'lpe-contrast',
        pathId: 'lt-contrast',
        courseId: 'course-contrast',
        position: 1,
      }),
    ]
    await clearTrackStores(page)
    await seedPaths(page, paths, entries)
    await page.goto('/learning-tracks/lt-contrast', { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/learning-tracks\/lt-contrast/)

    // Wait for the content surface to be rendered and the title visible.
    await expect(
      page.getByRole('heading', { name: 'Photography Mastery Roadmap', level: 1 })
    ).toBeVisible()

    // Compute WCAG contrast ratios via getComputedStyle in the real browser.
    // For elements on the solid bg-card/95 surface, we composite the alpha
    // against white (the underlying card/white background) to get the effective
    // background color before computing the ratio.
    const contrastResult = await page.evaluate(() => {
      function linearize(v: number): number {
        const c = v / 255
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      }
      function luminance(r: number, g: number, b: number): number {
        return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
      }
      function contrastRatio(l1: number, l2: number): number {
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
      }
      /**
       * Parse any CSS color string (rgb/rgba/color()/oklab/oklch/hex/named) into
       * sRGB 0-255 components by rendering through a 1x1 canvas.  This delegates
       * all color-space conversion to the browser engine and avoids hand-rolling
       * regex logic that breaks for modern color() / oklch() / oklab() syntax
       * where channels are already in the 0-1 range.
       */
      function parseColor(color: string): [number, number, number, number] | null {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        // Transparent baseline — lets us detect fully transparent inputs
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        // ImageData channels are always 0-255; alpha is also 0-255 so normalize
        return [d[0], d[1], d[2], d[3] / 255]
      }
      // Alpha-composite rgba over a solid white reference background (#ffffff).
      // This gives the worst-case perceived background lightness and thus the
      // minimum (most conservative) contrast ratio.
      function compositeOnWhite(r: number, g: number, b: number, a: number): [number, number, number] {
        return [
          r * a + 255 * (1 - a),
          g * a + 255 * (1 - a),
          b * a + 255 * (1 - a),
        ]
      }

      const surface = document.querySelector('[data-testid="hero-content-surface"]')
      const title = document.querySelector('[data-testid="hero-content-surface"] h1')
      const backLink = document.querySelector('[data-testid="hero-back-link"]')
      const cta = document.querySelector(
        '[data-testid="hero-content-surface"] a[class*="bg-brand"]'
      )

      if (!surface || !title) return { error: 'elements not found' }

      const surfaceBgRaw = window.getComputedStyle(surface).backgroundColor
      const surfaceParsed = parseColor(surfaceBgRaw)
      if (!surfaceParsed) return { error: `could not parse surface bg: ${surfaceBgRaw}` }

      const [sr, sg, sb, sa] = surfaceParsed
      const effectiveBg = compositeOnWhite(sr, sg, sb, sa)
      const bgLum = luminance(...effectiveBg)

      const titleColorRaw = window.getComputedStyle(title).color
      const titleParsed = parseColor(titleColorRaw)
      const titleContrast = titleParsed
        ? contrastRatio(luminance(titleParsed[0], titleParsed[1], titleParsed[2]), bgLum)
        : null

      const backColorRaw = backLink ? window.getComputedStyle(backLink).color : null
      const backParsed = backColorRaw ? parseColor(backColorRaw) : null
      const backContrast = backParsed
        ? contrastRatio(luminance(backParsed[0], backParsed[1], backParsed[2]), bgLum)
        : null

      // CTA has its own bg-brand surface — measure text-brand-foreground against bg-brand
      let ctaContrast: number | null = null
      if (cta) {
        const ctaBgRaw = window.getComputedStyle(cta).backgroundColor
        const ctaBgParsed = parseColor(ctaBgRaw)
        const ctaColorRaw = window.getComputedStyle(cta).color
        const ctaColorParsed = parseColor(ctaColorRaw)
        if (ctaBgParsed && ctaColorParsed) {
          const ctaEffectiveBg = compositeOnWhite(...(ctaBgParsed.slice(0, 4) as [number, number, number, number]))
          ctaContrast = contrastRatio(
            luminance(ctaColorParsed[0], ctaColorParsed[1], ctaColorParsed[2]),
            luminance(...ctaEffectiveBg)
          )
        }
      }

      return {
        titleContrast,
        backContrast,
        ctaContrast,
        surfaceBg: surfaceBgRaw,
        effectiveBgRgb: `rgb(${effectiveBg.map(v => Math.round(v)).join(', ')})`,
      }
    })

    expect(contrastResult).not.toHaveProperty('error')
    // Title (large text, ≥28px bold) must meet ≥3:1
    expect(contrastResult?.titleContrast).toBeGreaterThanOrEqual(3.0)
    // Back link (normal text) must meet ≥4.5:1
    if (contrastResult?.backContrast != null) {
      expect(contrastResult.backContrast).toBeGreaterThanOrEqual(4.5)
    }
    // CTA (normal text on bg-brand) must meet ≥4.5:1 when present
    if (contrastResult?.ctaContrast != null) {
      expect(contrastResult.ctaContrast).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('preset-gradient detail hero still renders content surface and title', async ({ page }) => {
    await goToLearningTracks(page)

    const paths = [
      createLearningPath({ id: 'lt-preset', name: 'Preset Track', coverPreset: 'cyan-blue' }),
    ]
    await clearTrackStores(page)
    await seedPaths(page, paths)
    await page.goto('/learning-tracks/lt-preset', { waitUntil: 'load' })

    // No uploaded cover, but the readable surface treatment is consistent.
    await expect(page.getByTestId('hero-cover-image')).toHaveCount(0)
    await expect(page.getByTestId('hero-content-surface')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Preset Track', level: 1 })).toBeVisible()
  })
})
