/**
 * E66-S03: WCAG 2.4.11 Focus Not Obscured (Minimum) audit.
 *
 * For each public route at mobile viewport (where the fixed BottomNav is
 * visible), tab through every focusable element and assert no `:focus-visible`
 * element is FULLY contained within any `position: fixed` / `position: sticky`
 * element's bounding rect.
 *
 * "Fully contained" — not "any overlap" — to avoid flakiness around tooltips,
 * focus rings, and partial overlap that does not violate WCAG 2.4.11.
 */

import { test, expect, type Page } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'

type RouteSpec = { path: string; skip?: boolean; skipReason?: string }

const ROUTES: RouteSpec[] = [
  { path: '/' },
  { path: '/my-class' },
  { path: '/courses' },
  { path: '/reports' },
  { path: '/settings' },
]

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const MAX_TABS = 50

type ObscuredFinding = {
  route: string
  tabIndex: number
  focused: { selector: string; rect: DOMRectInit }
  obscuredBy: { selector: string; rect: DOMRectInit }
}

/** Run inside the browser: returns null if focus is fine, or an obscured finding. */
async function checkFocusObscured(page: Page): Promise<ObscuredFinding['focused'] extends infer _ ? Omit<ObscuredFinding, 'route' | 'tabIndex'> | null : never> {
  return await page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body || active === document.documentElement) {
      return null
    }
    const focusedRect = (active as Element).getBoundingClientRect()
    if (focusedRect.width === 0 || focusedRect.height === 0) return null

    // Find all fixed/sticky elements
    const allEls = Array.from(document.querySelectorAll<HTMLElement>('*'))
    for (const el of allEls) {
      if (el === active || el.contains(active)) continue
      const cs = window.getComputedStyle(el)
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if (parseFloat(cs.opacity) === 0) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue

      // Full containment: focused rect entirely inside fixed/sticky rect.
      const fullyContained =
        focusedRect.left >= r.left &&
        focusedRect.right <= r.right &&
        focusedRect.top >= r.top &&
        focusedRect.bottom <= r.bottom

      if (fullyContained) {
        const selector =
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : '') +
          (el.className && typeof el.className === 'string'
            ? `.${el.className.split(' ').filter(Boolean).slice(0, 2).join('.')}`
            : '')
        const focusedSelector =
          (active as HTMLElement).tagName.toLowerCase() +
          ((active as HTMLElement).id ? `#${(active as HTMLElement).id}` : '') +
          ((active as HTMLElement).getAttribute('aria-label')
            ? `[aria-label="${(active as HTMLElement).getAttribute('aria-label')}"]`
            : '')
        return {
          focused: {
            selector: focusedSelector,
            rect: {
              x: focusedRect.x,
              y: focusedRect.y,
              width: focusedRect.width,
              height: focusedRect.height,
            },
          },
          obscuredBy: {
            selector,
            rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          },
        }
      }
    }
    return null
  })
}

test.describe('WCAG 2.4.11 focus-not-obscured audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await dismissOnboarding(page)
  })

  for (const route of ROUTES) {
    test(`${route.path} (mobile ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height})`, async ({
      page,
    }) => {
      if (route.skip) {
        test.skip(true, route.skipReason || 'route excluded')
        return
      }

      await page.goto(route.path)
      await page.waitForLoadState('networkidle')

      const findings: ObscuredFinding[] = []

      // Reset focus to body so first Tab moves into the document.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press('Tab')
        const finding = await checkFocusObscured(page)
        if (finding) {
          findings.push({ route: route.path, tabIndex: i + 1, ...finding })
        }
        // Stop early if focus has wrapped back to body
        const stillFocused = await page.evaluate(
          () => document.activeElement && document.activeElement !== document.body
        )
        if (!stillFocused) break
      }

      if (findings.length > 0) {
        const report = findings
          .map(
            f =>
              `  Tab #${f.tabIndex}: ${f.focused.selector} obscured by ${f.obscuredBy.selector}`
          )
          .join('\n')
        // eslint-disable-next-line no-console
        console.log(`Focus-obscured violations on ${route.path}:\n${report}`)
      }

      expect(findings, `Focus-obscured violations on ${route.path}`).toEqual([])
    })
  }
})
