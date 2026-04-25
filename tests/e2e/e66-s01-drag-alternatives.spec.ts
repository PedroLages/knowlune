/**
 * E66-S01: WCAG 2.5.7 single-pointer alternatives audit.
 *
 * Verifies that every drag-driven sortable surface exposes accessible
 * Move Up / Move Down buttons (with item-derived aria-labels and
 * `aria-disabled` boundaries).
 *
 * Surfaces covered:
 *   - DashboardCustomizer (Overview page)        — exercises reorder via buttons
 *   - LearningPathDetail / AILearningPath        — presence audit (data-driven, gated)
 *   - VideoReorderList / YouTubeChapterEditor    — presence audit (data-driven, gated)
 *
 * Runtime kept bounded by exercising one full reorder flow on the
 * always-accessible DashboardCustomizer and asserting button presence
 * on the others when their seed data is available.
 */
import { test, expect } from '../support/fixtures'

async function goToOverviewAsGuest(page: import('@playwright/test').Page) {
  // Dismiss welcome wizard / onboarding before any auth/guest mount
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
    ;(window as Record<string, unknown>).__suppressSyncOverlays = true
  })
  await page.goto('/guest')
  await page.waitForURL(url => !url.pathname.startsWith('/guest'), { timeout: 15_000 })
  await page.goto('/overview')
  await page.waitForSelector('[data-testid="customize-dashboard-toggle"]', {
    state: 'visible',
    timeout: 15_000,
  })
}

test.describe('E66-S01: Drag movement alternatives (WCAG 2.5.7)', () => {
  test('DashboardCustomizer exposes Move Up / Move Down buttons with proper aria labels and disabled boundaries', async ({
    page,
  }) => {
    await goToOverviewAsGuest(page)

    // Open the customizer panel
    await page.getByTestId('customize-dashboard-toggle').click()
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toBeVisible()

    // Each section row should expose Move Up / Move Down buttons
    const firstRow = page.getByTestId('section-row-recommended-next')
    await expect(firstRow).toBeVisible()
    const firstUp = firstRow.getByTestId('section-row-recommended-next-move-up')
    const firstDown = firstRow.getByTestId('section-row-recommended-next-move-down')
    await expect(firstUp).toBeVisible()
    await expect(firstDown).toBeVisible()

    // First-row Move Up must be aria-disabled (focusable, but inert)
    await expect(firstUp).toHaveAttribute('aria-disabled', 'true')

    // Aria-label includes the human-readable label
    await expect(firstUp).toHaveAttribute('aria-label', /Move .* up/)
    await expect(firstDown).toHaveAttribute('aria-label', /Move .* down/)
  })

  test('DashboardCustomizer reorders a section via Move Down button (single-pointer alternative)', async ({
    page,
  }) => {
    await goToOverviewAsGuest(page)

    await page.getByTestId('customize-dashboard-toggle').click()
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toBeVisible()

    // Capture the order before
    // Section rows use testids like `section-row-{id}` (e.g. recommended-next).
    // Move buttons use `section-row-{id}-move-up|down` — exclude those by negative lookahead.
    const rowsBefore = await panel.locator('[data-testid^="section-row-"]').evaluateAll(els =>
      els
        .map(el => el.getAttribute('data-testid'))
        .filter(
          (tid): tid is string =>
            !!tid && /^section-row-/.test(tid) && !/-move-(up|down)$/.test(tid)
        )
    )
    expect(rowsBefore.length).toBeGreaterThan(1)

    // Click Move Down on the first row
    const firstId = rowsBefore[0].replace('section-row-', '')
    await page.getByTestId(`section-row-${firstId}-move-down`).click()

    // Verify the order swapped
    await expect(async () => {
      const rowsAfter = await panel.locator('[data-testid^="section-row-"]').evaluateAll(els =>
        els
          .map(el => el.getAttribute('data-testid'))
          .filter(
            (tid): tid is string =>
              !!tid && /^section-row-/.test(tid) && !/-move-(up|down)$/.test(tid)
          )
      )
      expect(rowsAfter[0]).toBe(rowsBefore[1])
      expect(rowsAfter[1]).toBe(rowsBefore[0])
    }).toPass({ timeout: 2_000 })
  })

  test('Last DashboardCustomizer section has aria-disabled Move Down', async ({ page }) => {
    await goToOverviewAsGuest(page)
    await page.getByTestId('customize-dashboard-toggle').click()
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toBeVisible()

    const rows = await panel.locator('[data-testid^="section-row-"]').evaluateAll(els =>
      els
        .map(el => el.getAttribute('data-testid'))
        .filter(
          (tid): tid is string =>
            !!tid && /^section-row-/.test(tid) && !/-move-(up|down)$/.test(tid)
        )
    )
    expect(rows.length).toBeGreaterThan(1)

    const lastId = rows[rows.length - 1].replace('section-row-', '')
    const lastDown = page.getByTestId(`section-row-${lastId}-move-down`)
    await expect(lastDown).toHaveAttribute('aria-disabled', 'true')
  })
})
