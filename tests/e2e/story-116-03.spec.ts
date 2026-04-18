/**
 * E116-S03: Library Shelf Integration — E2E smoke spec
 *
 * Proves the shelf primitives are wired into the Library route:
 * - At least two h2 shelf headings are visible ("Recently Added", "Continue Reading").
 * - Each shelf row exposes a horizontal scroller element.
 * - Each scroller contains ≥1 card (mock tile) rendered from static data.
 * - Navigating to /library produces no console errors on mount.
 *
 * Chromium-only smoke spec (follows existing `tests/e2e/` conventions).
 *
 * Plan: docs/plans/2026-04-18-003-feat-library-page-shelf-integration-plan.md
 */
import { test, expect } from '@playwright/test'

test.describe('Library shelf integration (E116-S03)', () => {
  test('renders two shelves with headings, scrollers, and cards', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/library')

    // AC-2: top-level shelves render as h2
    await expect(page.getByRole('heading', { level: 2, name: 'Recently Added' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Continue Reading' })).toBeVisible()

    // AC-9: at least two shelf-row scrollers
    const recentScroller = page.getByTestId('shelf-recently-added-scroller')
    const continueScroller = page.getByTestId('shelf-continue-reading-scroller')
    await expect(recentScroller).toBeVisible()
    await expect(continueScroller).toBeVisible()

    // AC-4: ≥1 card per row
    await expect(recentScroller.locator('[data-testid^="shelf-mock-tile-"]').first()).toBeVisible()
    await expect(continueScroller.locator('[data-testid^="shelf-mock-tile-"]').first()).toBeVisible()

    // AC-3: "See all" link present in each shelf heading
    await expect(page.getByRole('link', { name: 'See all' }).first()).toBeVisible()

    // AC-8: no console errors on mount
    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join('\n')}`).toEqual([])
  })
})
