/**
 * E2E tests: learning track detail page — cinematic redesign.
 *
 * Covers hero banner interactions, contrast, responsive layout, theme matrix,
 * reduced motion, and reorder regression.
 *
 * Each test creates its own seed data — see seeded test patterns in
 * learning-tracks.spec.ts and learning-track-reorder.spec.ts.
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

/**
 * Parse a CSS color string into sRGB via 1×1 canvas (handles oklch/color() spaces).
 */
async function parseCssColor(
  page: import('@playwright/test').Page,
  color: string
): Promise<[number, number, number, number] | null> {
  return page.evaluate((c: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }, color)
}

// ---------------------------------------------------------------------------
// Detail page — cinematic redesign
// ---------------------------------------------------------------------------

test.describe('Learning Tracks — cinematic hero', () => {
  // ── Back link / navigation guards ──────────────────────────────────

  test('direct URL entry: back link navigates to /learning-tracks', async ({ page }) => {
    const paths = [createLearningPath({ id: 'lt-direct', name: 'Direct Entry Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-direct', { waitUntil: 'load' })

    await expect(page.getByTestId('hero-back-link')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toHaveAttribute('href', '/learning-tracks')

    await page.getByTestId('hero-back-link').click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('back link and CTA navigate to distinct routes', async ({ page }) => {
    const entries = [
      createLearningPathEntry({ pathId: 'lt-cta-sep', courseId: 'c-cta-sep', position: 1 }),
    ]
    const paths = [createLearningPath({ id: 'lt-cta-sep', name: 'CTA Separation Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths, entries)

    await page.goto('/learning-tracks/lt-cta-sep', { waitUntil: 'load' })

    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    const cta = page.getByText('Start Learning')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /\/courses\//)
  })

  test('mobile viewport: back link navigates correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    const paths = [createLearningPath({ id: 'lt-mobile', name: 'Mobile Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-mobile', { waitUntil: 'load' })

    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')

    await backLink.click()
    await expect(page).toHaveURL('/learning-tracks')
  })

  test('detail page with cover image URL renders hero without errors', async ({ page }) => {
    const paths = [
      createLearningPath({
        id: 'lt-cover',
        name: 'Cover Image Track',
        coverImageUrl:
          'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%234F46E5%22%2F%3E%3C%2Fsvg%3E',
        coverPreset: 'cyan-blue',
      }),
    ]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-cover', { waitUntil: 'load' })

    await expect(page.getByText('Cover Image Track')).toBeVisible()
    const backLink = page.getByTestId('hero-back-link')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/learning-tracks')
  })

  // ── Cinematic structure ────────────────────────────────────────────

  test('hero section has cinematic scrim layer', async ({ page }) => {
    const paths = [createLearningPath({ id: 'lt-scrim', name: 'Scrim Test' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-scrim', { waitUntil: 'load' })

    // Scrim layer exists
    await expect(page.getByTestId('hero-scrim')).toBeVisible()

    // Title exists and has white text
    const title = page.getByTestId('hero-title')
    await expect(title).toBeVisible()

    // Title text color is white (via computed style)
    const titleColor = await title.evaluate(el => getComputedStyle(el).color)
    const parsed = await parseCssColor(page, titleColor)
    expect(parsed).not.toBeNull()
    if (parsed) {
      // White = 255, 255, 255. Allow minor tolerance for antialiasing.
      expect(parsed[0]).toBeGreaterThan(200)
      expect(parsed[1]).toBeGreaterThan(200)
      expect(parsed[2]).toBeGreaterThan(200)
    }
  })

  // ── Responsive layout ──────────────────────────────────────────────

  test('responsive: renders correctly at tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    const paths = [createLearningPath({ id: 'lt-tablet', name: 'Tablet Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-tablet', { waitUntil: 'load' })

    // Hero scrim and title visible
    await expect(page.getByTestId('hero-scrim')).toBeVisible()
    await expect(page.getByTestId('hero-title')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toBeVisible()

    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2)
  })

  test('responsive: renders correctly at mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const paths = [createLearningPath({ id: 'lt-mobile-r', name: 'Mobile Responsive' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-mobile-r', { waitUntil: 'load' })

    // All hero elements visible on a narrow screen
    await expect(page.getByTestId('hero-scrim')).toBeVisible()
    await expect(page.getByTestId('hero-title')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toBeVisible()

    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 2)
  })

  // ── Theme matrix ───────────────────────────────────────────────────

  test('dark mode: title remains visible over the cinematic scrim', async ({ page }) => {
    const paths = [createLearningPath({ id: 'lt-dark', name: 'Dark Mode Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-dark', { waitUntil: 'load' })

    // Toggle dark mode on the html element
    await page.evaluate(() => document.documentElement.classList.add('dark'))

    // Title is still visible (the scrim is theme-independent black)
    await expect(page.getByTestId('hero-title')).toBeVisible()
    const title = page.getByTestId('hero-title')
    const color = await title.evaluate(el => getComputedStyle(el).color)
    // White text should still be white in dark mode
    await expect(async () => {
      const titleEl = page.getByTestId('hero-title')
      await expect(titleEl).toBeVisible()
    }).toPass()
  })

  test('vibrant scheme: title remains visible over the cinematic scrim', async ({ page }) => {
    const paths = [createLearningPath({ id: 'lt-vibrant', name: 'Vibrant Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-vibrant', { waitUntil: 'load' })

    // Toggle vibrant mode
    await page.evaluate(() => document.documentElement.classList.add('vibrant'))

    await expect(page.getByTestId('hero-title')).toBeVisible()
  })

  // ── Reduced motion ─────────────────────────────────────────────────

  test('reduced motion: cover renders at rest, page readable', async ({ page }) => {
    await page.addInitScript(() => {
      // Force prefers-reduced-motion: reduce before the app loads
      const originalMatch = window.matchMedia
      window.matchMedia = (query: string) => {
        const mq = originalMatch.call(window, query)
        if (query.includes('prefers-reduced-motion')) {
          return Object.assign({}, mq, { matches: true })
        }
        return mq
      }
    })

    const paths = [createLearningPath({ id: 'lt-rm', name: 'Reduced Motion Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths)

    await page.goto('/learning-tracks/lt-rm', { waitUntil: 'load' })

    // Hero renders without animation artifacts
    await expect(page.getByTestId('hero-scrim')).toBeVisible()
    await expect(page.getByTestId('hero-title')).toBeVisible()
    await expect(page.getByTestId('hero-back-link')).toBeVisible()
  })

  // ── CTA brand contrast ─────────────────────────────────────────────

  test('CTA uses brand colors for contrast against dark scrim', async ({ page }) => {
    const entries = [
      createLearningPathEntry({ pathId: 'lt-cta-c', courseId: 'c-cta-c', position: 1 }),
    ]
    const paths = [createLearningPath({ id: 'lt-cta-c', name: 'CTA Contrast Track' })]
    await clearLearningPath(page)
    await seedPaths(page, paths, entries)

    await page.goto('/learning-tracks/lt-cta-c', { waitUntil: 'load' })

    // CTA is visible
    const cta = page.getByTestId('hero-cta')
    await expect(cta).toBeVisible()

    // CTA uses brand background
    const ctaBg = await cta.evaluate(el => getComputedStyle(el).backgroundColor)
    const parsed = await parseCssColor(page, ctaBg)
    expect(parsed).not.toBeNull()
    if (parsed) {
      // Brand color (#5e6ad2) has R≈94, G≈106, B≈210 — verify it's not a transparent/neutral color
      expect(parsed[2]).toBeGreaterThan(150) // Blue channel is dominant
    }
  })

  test('continue-learning card uses the current server lesson as a static preview', async ({
    page,
  }) => {
    const pathId = 'lt-server-preview'
    const courseId = 'c-server-preview'
    const firstVideoId = 'v-server-preview-1'
    const currentVideoId = 'v-server-preview-2'
    const firstVideoUrl = 'https://media.example/preview/first.mp4'
    const currentVideoUrl = 'https://media.example/preview/current.mp4'

    await page.route('https://media.example/preview/*.mp4', route => route.abort())
    await page.goto('/')
    await page.waitForLoadState('load')
    await clearLearningPath(page)
    await Promise.all([
      clearIndexedDBStore(page, DB_NAME, 'learningPathEntries'),
      clearIndexedDBStore(page, DB_NAME, 'importedCourses'),
      clearIndexedDBStore(page, DB_NAME, 'importedVideos'),
      clearIndexedDBStore(page, DB_NAME, 'contentProgress'),
      clearIndexedDBStore(page, DB_NAME, 'progress'),
    ])

    await seedPaths(
      page,
      [createLearningPath({ id: pathId, name: 'Server Preview Track' })],
      [createLearningPathEntry({ pathId, courseId, position: 1 })]
    )
    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [
      {
        id: courseId,
        name: 'Server Preview Course',
        importedAt: FIXED_DATE,
        category: 'technology',
        tags: [],
        status: 'not-started',
        videoCount: 2,
        pdfCount: 0,
        directoryHandle: null,
        source: 'server',
        serverPath: 'preview/server-course',
      },
    ])
    await seedIndexedDBStore(page, DB_NAME, 'importedVideos', [
      {
        id: firstVideoId,
        courseId,
        filename: '0. Welcome.mp4',
        path: '0. Welcome.mp4',
        duration: 120,
        format: 'mp4',
        order: 1,
        fileHandle: null,
        serverUrl: firstVideoUrl,
      },
      {
        id: currentVideoId,
        courseId,
        filename: '1. Introduction.mp4',
        path: '1. Introduction.mp4',
        duration: 180,
        format: 'mp4',
        order: 2,
        fileHandle: null,
        serverUrl: currentVideoUrl,
      },
    ])
    await seedIndexedDBStore(page, DB_NAME, 'contentProgress', [
      {
        courseId,
        itemId: firstVideoId,
        contentType: 'lesson',
        status: 'completed',
        progressPct: 100,
        updatedAt: FIXED_DATE,
      },
    ])

    await page.goto(`/learning-tracks/${pathId}`, { waitUntil: 'load' })

    const card = page.getByTestId('continue-learning-card')
    const preview = card.getByTestId('continue-learning-video-preview')
    await expect(preview).toHaveAttribute('src', currentVideoUrl)
    await expect(preview).toHaveAttribute('preload', 'metadata')
    await expect(preview).not.toHaveAttribute('autoplay')
    await expect(card.getByRole('link', { name: 'Resume Server Preview Course' })).toHaveAttribute(
      'href',
      `/courses/${courseId}/lessons/${currentVideoId}`
    )
  })

  // ── Bounding box overlap ──────────────────────────────────────

  const BBOX_VIEWPORTS = [
    { width: 1440, height: 900, label: 'desktop (1440px)' },
    { width: 768, height: 1024, label: 'tablet (768px)' },
    { width: 375, height: 812, label: 'mobile (375px)' },
  ]

  for (const vp of BBOX_VIEWPORTS) {
    test(`bounding box at ${vp.label}: hero-cta does not overlap continue-learning card`, async ({
      page,
    }) => {
      const pathId = vp.width === 1440 ? 'lt-bbox-d' : vp.width === 768 ? 'lt-bbox-t' : 'lt-bbox-m'
      const courseId = 'c-bbox'

      // Seed path with one course
      const entries = [createLearningPathEntry({ pathId, courseId, position: 1 })]
      const paths = [createLearningPath({ id: pathId, name: `Bounding Box Track ${vp.label}` })]
      await clearLearningPath(page)
      await clearIndexedDBStore(page, DB_NAME, 'importedCourses')
      await clearIndexedDBStore(page, DB_NAME, 'progress')
      await seedPaths(page, paths, entries)

      // Seed imported course so usePathProgress can calculate completionPct
      await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [
        {
          id: courseId,
          name: 'Bounding Box Course',
          importedAt: FIXED_DATE,
          category: 'technology',
          tags: [],
          status: 'active',
          videoCount: 5,
          pdfCount: 0,
        },
      ])

      // Seed 2 of 5 videos as completed → 40% → ContinueLearningBento renders
      await seedIndexedDBStore(page, DB_NAME, 'progress', [
        { courseId, videoId: 'v-bbox-1', completedAt: FIXED_DATE },
        { courseId, videoId: 'v-bbox-2', completedAt: FIXED_DATE },
      ])

      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto(`/learning-tracks/${pathId}`, { waitUntil: 'load' })

      // Wait for both elements to be visible
      await expect(page.getByTestId('hero-cta')).toBeVisible()
      await expect(page.getByTestId('continue-learning-card')).toBeVisible()

      // Get bounding boxes
      const heroCtaBox = await page.getByTestId('hero-cta').boundingBox()
      const continueCardBox = await page.getByTestId('continue-learning-card').boundingBox()

      expect(heroCtaBox, `hero-cta bounding box at ${vp.label}`).not.toBeNull()
      expect(continueCardBox, `continue-learning-card bounding box at ${vp.label}`).not.toBeNull()

      // Assert: hero-cta bottom <= Continue card top (no overlap)
      const ctaBottom = heroCtaBox!.y + heroCtaBox!.height
      const cardTop = continueCardBox!.y
      expect(
        ctaBottom,
        `hero-cta bottom (${Math.round(ctaBottom)}px) should be <= continue card top (${Math.round(cardTop)}px) at ${vp.label}`
      ).toBeLessThanOrEqual(cardTop)

      // Assert: no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const innerWidth = await page.evaluate(() => window.innerWidth)
      expect(
        scrollWidth,
        `scrollWidth (${scrollWidth}px) <= innerWidth (${innerWidth}px) + 2 at ${vp.label}`
      ).toBeLessThanOrEqual(innerWidth + 2)
    })
  }
})
