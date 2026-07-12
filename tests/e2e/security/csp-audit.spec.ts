import { test, expect } from '@playwright/test'

/**
 * Security — CSP Audit (E2E)
 *
 * Automated detection of Content Security Policy violations across
 * key application routes. Uses Playwright's page.on('console') listener
 * to capture CSP violation messages reported by the browser.
 *
 * CSP violations appear as console errors containing:
 *   "Content Security Policy" or "Refused to connect to"
 *
 * Each test navigates a route and asserts zero CSP violations.
 * A failing test logs the violating domain for triage:
 *   - If legitimate: add the domain to the CSP connect-src in public/_headers
 *   - If unexpected: investigate the source of the blocked request
 */

// Routes to audit — covers all major feature areas
const AUDIT_ROUTES = [
  { name: 'landing', path: '/', needsAuth: false },
  { name: 'overview', path: '/overview', needsAuth: true },
  { name: 'courses', path: '/courses', needsAuth: true },
  { name: 'settings', path: '/settings', needsAuth: true },
  { name: 'library', path: '/library', needsAuth: true },
] as const

test.describe('Security — CSP Audit', () => {
  for (const route of AUDIT_ROUTES) {
    test(`no CSP violations on ${route.name} (${route.path})`, async ({ page }) => {
      const cspViolations: string[] = []

      // Capture CSP violation messages from the browser console
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (
            text.includes('Content Security Policy') ||
            text.includes('Refused to connect to') ||
            text.includes('Refused to load') ||
            text.includes('violates the following Content Security Policy')
          ) {
            cspViolations.push(text)
          }
        }
      })

      // Navigate and wait for the page to settle
      await page.goto(route.path)
      await page.waitForLoadState('domcontentloaded')

      // Wait for network to settle — CSP violations are often reported
      // after initial page load as lazy-loaded resources attempt to connect
      await page.waitForTimeout(3000)

      // Assert zero CSP violations
      if (cspViolations.length > 0) {
        const domainList = cspViolations
          .map(v => {
            const match = v.match(/connect to ['"]?([^'"]+)['"]?/)
            return match ? match[1] : v.slice(0, 120)
          })
          .join('\n  - ')
        throw new Error(
          `CSP violations detected on ${route.name} (${route.path}):\n  - ${domainList}\n\n` +
            `Action: Add legitimate domains to CSP connect-src in public/_headers, or investigate unexpected connections.`
        )
      }

      // Verify the page rendered (not blank / error page)
      await expect(page.locator('body')).toBeVisible()
    })
  }
})
