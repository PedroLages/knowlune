/**
 * E66-S02: WCAG 2.5.8 Target Size (Minimum) audit.
 *
 * Visits every public route on desktop and mobile viewports, collects every
 * in-scope interactive element rect, and asserts there are zero target-size
 * violations after the fixes in this story.
 *
 * Violation = element below 24x24 CSS px AND lacking the spacing exception
 * (>= 24 px clear space to the nearest interactive neighbor).
 *
 * Excluded by collection-time predicate: hidden elements, inline links inside
 * paragraphs, native <select> chrome.
 */

import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import {
  collectInteractiveRects,
  findViolations,
  type Violation,
} from './target-size-helpers'

type RouteSpec = {
  path: string
  /** Skip route if it requires auth that we can't seed deterministically yet. */
  skip?: boolean
  skipReason?: string
}

const ROUTES: RouteSpec[] = [
  { path: '/' },
  { path: '/my-class' },
  { path: '/courses' },
  { path: '/authors' },
  { path: '/reports' },
  { path: '/settings' },
  { path: '/learning-paths' },
  { path: '/notes' },
  { path: '/challenges' },
  { path: '/login' },
  // Quiz / Flashcards / Course detail / Author profile / Path detail require
  // seeded fixture content + an active session. Covered by their own e2e
  // specs; out of scope for the cross-cutting audit until we can land on
  // them deterministically.
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
] as const

function formatViolation(v: Violation): string {
  const label = v.ariaLabel ? ` aria-label="${v.ariaLabel}"` : ''
  const text = v.text ? ` text="${v.text}"` : ''
  return `${v.selector}${label}${text} size=${v.width.toFixed(1)}x${v.height.toFixed(1)} nearest=${v.nearestNeighborDistance.toFixed(1)}px`
}

test.describe('WCAG 2.5.8 target-size audit', () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page)
  })

  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const title = `${route.path} (${viewport.name} ${viewport.width}x${viewport.height})`

      test(title, async ({ page }) => {
        if (route.skip) {
          test.skip(true, route.skipReason || 'route excluded')
          return
        }

        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await page.goto(route.path)
        await page.waitForLoadState('networkidle')

        const rects = await collectInteractiveRects(page)
        const violations = findViolations(rects)

        if (violations.length > 0) {
          // Print readable report; failure message attaches the same.
          const report = violations.map(formatViolation).join('\n  ')
          // eslint-disable-next-line no-console
          console.log(`Target size violations on ${title}:\n  ${report}`)
        }

        expect(violations, `Target size violations on ${title}`).toEqual([])
      })
    }
  }
})
