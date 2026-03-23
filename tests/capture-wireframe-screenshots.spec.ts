/**
 * Capture screenshots of every Knowlune page for use as Stitch 2.0 reference images.
 *
 * Usage:
 *   npx playwright test scripts/capture-wireframe-screenshots.ts --project=chromium
 *
 * Output: screenshots/stitch/ directory with one PNG per page at 1440x900 desktop resolution.
 *
 * Prerequisites: Dev server running on localhost:5173 (or let Playwright start it via config).
 */
import { test } from '@playwright/test'

const OUTPUT_DIR = 'screenshots/stitch'

// All routes to screenshot, with human-readable filenames
const PAGES: { name: string; path: string; waitFor?: string; setup?: string }[] = [
  // ── Main Pages ──────────────────────────────────────────
  { name: '01-overview', path: '/' },
  { name: '02-my-class', path: '/my-class' },
  { name: '03-courses', path: '/courses' },
  { name: '04-authors', path: '/authors' },
  { name: '05-reports', path: '/reports' },
  { name: '06-settings', path: '/settings' },

  // ── Sub-Pages ───────────────────────────────────────────
  {
    name: '07-course-detail',
    path: '/courses/operative-six',
    waitFor: '[data-testid="course-detail"], h1',
  },
  {
    name: '08-lesson-player',
    path: '/courses/operative-six/op6-introduction-video',
    waitFor: '[data-testid="video-player-container"], [data-testid="lesson-player"]',
  },
  {
    name: '09-author-profile',
    path: '/authors/chase-hughes',
    waitFor: 'h1',
  },
  { name: '10-notes', path: '/notes' },
  {
    name: '11-notes-bookmarks',
    path: '/notes?tab=bookmarks',
    waitFor: '[role="tabpanel"]',
  },
  { name: '12-challenges', path: '/challenges' },
  { name: '13-review-queue', path: '/review' },
  { name: '14-retention-dashboard', path: '/retention' },
  { name: '15-ai-learning-path', path: '/ai-learning-path' },
  { name: '16-knowledge-gaps', path: '/knowledge-gaps' },
  { name: '17-session-history', path: '/session-history' },
  { name: '18-interleaved-review', path: '/review/interleaved' },
]

test.describe('Stitch 2.0 Wireframe Screenshots', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  })

  for (const page of PAGES) {
    test(`capture ${page.name}`, async ({ page: pw }) => {
      // Collapse sidebar to show more content area
      await pw.addInitScript(() => {
        localStorage.setItem('knowlune-sidebar-v1', 'false')
      })

      await pw.goto(page.path, { waitUntil: 'networkidle' })

      // Wait for lazy-loaded content
      if (page.waitFor) {
        await pw
          .locator(page.waitFor)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {
            /* page may not have this element, continue */
          })
      }

      // Give animations/charts a moment to render
      await pw.waitForTimeout(1500)

      await pw.screenshot({
        path: `${OUTPUT_DIR}/${page.name}.png`,
        fullPage: true,
      })
    })
  }
})
