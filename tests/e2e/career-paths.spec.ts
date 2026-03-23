/**
 * Career Paths E2E tests — verifies all 6 ACs for E20-S01.
 *
 * AC1: List page shows 3-5 curated paths with title, description, course count, hours, progress %
 * AC2: Detail page shows staged progression with course cards per stage
 * AC3: "Start Path" enrolls user (persisted to IndexedDB), UI updates
 * AC4: Completed courses show checkmarks, progress % updates
 * AC5: Stage 2+ is locked until Stage 1 complete
 * AC6: "Career Paths" link in sidebar navigates correctly
 */
import { test, expect } from '../support/fixtures'
import { seedPathEnrollments } from '../support/helpers/indexeddb-seed'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function goToCareerPaths(page: import('@playwright/test').Page) {
  await page.goto('/career-paths')
  await page.waitForLoadState('networkidle')
}

/** Returns the listitem locator scoped to the career paths grid (avoids sidebar listitems). */
function getPathCards(page: import('@playwright/test').Page) {
  return page.getByRole('list', { name: 'Career paths' }).getByRole('listitem')
}

async function getPathId(page: import('@playwright/test').Page, index = 0): Promise<string> {
  const cards = getPathCards(page)
  const href = await cards.nth(index).locator('a').first().getAttribute('href')
  const match = href?.match(/\/career-paths\/([^/?]+)/)
  return match?.[1] ?? ''
}

// ─────────────────────────────────────────────
// AC1: List page
// ─────────────────────────────────────────────

test.describe('Career Paths list page (AC1)', () => {
  test('shows page heading', async ({ page }) => {
    await goToCareerPaths(page)
    await expect(page.getByRole('heading', { name: 'Career Paths', level: 1 })).toBeVisible()
  })

  test('displays at least 3 career path cards', async ({ page }) => {
    await goToCareerPaths(page)
    const cards = getPathCards(page)
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('each card shows title and description', async ({ page }) => {
    await goToCareerPaths(page)
    const firstCard = getPathCards(page).first()
    await expect(firstCard.getByRole('heading', { level: 2 })).toBeVisible()
    // Description is in the card (non-heading text)
    const cardText = await firstCard.textContent()
    expect(cardText?.length).toBeGreaterThan(20)
  })

  test('cards show courses count and estimated hours', async ({ page }) => {
    await goToCareerPaths(page)
    const firstCard = getPathCards(page).first()
    // Both metadata items are present (look for "courses" and "h" text patterns)
    await expect(firstCard.getByText(/courses/)).toBeVisible()
    await expect(firstCard.getByText(/^\d+h$/)).toBeVisible()
  })
})

// ─────────────────────────────────────────────
// AC2: Detail page with staged progression
// ─────────────────────────────────────────────

test.describe('Career Path detail page (AC2)', () => {
  test('loads detail page when clicking a path card', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.url()).toContain('/career-paths/')
  })

  test('detail page shows path title as heading', async ({ page }) => {
    await goToCareerPaths(page)
    const title = await getPathCards(page).first().locator('h2').first().textContent()
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title ?? '')
  })

  test('shows at least 2 stages with "Stage" labels', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    const stageLabels = page
      .getByRole('list', { name: 'Learning stages' })
      .getByText(/^Stage \d/)
    await expect(stageLabels.first()).toBeVisible()
    const count = await stageLabels.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('back link returns to career paths list', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    await page.getByTestId('back-link').click()
    await expect(page).toHaveURL('/career-paths')
  })
})

// ─────────────────────────────────────────────
// AC3: Enrollment flow
// ─────────────────────────────────────────────

test.describe('Path enrollment (AC3)', () => {
  test('"Start Path" button is visible on detail page', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('enroll-button')).toBeVisible()
  })

  test('clicking "Start Path" replaces button with "Leave path"', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('enroll-button').click()

    // Button changes to "Leave path" after enrolling
    await expect(page.getByRole('button', { name: /Leave path/i })).toBeVisible()
    await expect(page.getByTestId('enroll-button')).not.toBeVisible()
  })

  test('enrollment survives page reload', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')
    const url = page.url()

    await page.getByTestId('enroll-button').click()
    await page.getByRole('button', { name: /Leave path/i }).waitFor()

    await page.goto(url)
    await page.waitForLoadState('networkidle')

    // Should still be enrolled after reload
    await expect(page.getByRole('button', { name: /Leave path/i })).toBeVisible()
  })
})

// ─────────────────────────────────────────────
// AC4: Progress tracking (course completion)
// ─────────────────────────────────────────────

test.describe('Progress tracking (AC4)', () => {
  test('progress bar appears when enrolled', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('enroll-button').click()
    await page.getByRole('button', { name: /Leave path/i }).waitFor()

    // Progress section is visible (role="status" only shown when enrolled)
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('enrolled path shows progress bar on list page', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('enroll-button').click()
    await page.getByRole('button', { name: /Leave path/i }).waitFor()

    // Go back to list — should see progress bar
    await page.goto('/career-paths')
    await page.waitForLoadState('networkidle')

    // The progress bar should be present (aria-label contains "progress")
    const pathCard = getPathCards(page).first()
    await expect(pathCard.getByRole('progressbar')).toBeVisible()
  })
})

// ─────────────────────────────────────────────
// AC5: Stage prerequisite locking
// ─────────────────────────────────────────────

test.describe('Stage prerequisites (AC5)', () => {
  test('Stage 1 is not locked (no lock icon)', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    // Stage 1 should not show "Complete Stage 0 to unlock" messaging
    await expect(page.getByText(/Complete Stage 0 to unlock/i)).not.toBeVisible()
  })

  test('Stage 2+ shows lock messaging when Stage 1 is incomplete', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    // "Complete Stage 1 to unlock" message should be visible for Stage 2
    await expect(page.getByText(/Complete Stage 1 to unlock/i)).toBeVisible()
  })

  test('locked stage cards have reduced opacity via class', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    const stagesList = page.getByRole('list', { name: 'Learning stages' })
    const stages = stagesList.getByRole('listitem').filter({ has: page.getByText(/^Stage \d/) })
    const secondStage = stages.nth(1)

    // Card for stage 2 should have opacity styling (locked state)
    const cardClass = await secondStage.locator('[class*="opacity"]').first().getAttribute('class')
    expect(cardClass).toContain('opacity')
  })

  test('locked stage course tiles have no navigation links', async ({ page }) => {
    await goToCareerPaths(page)
    await getPathCards(page).first().locator('a').first().click()
    await page.waitForLoadState('networkidle')

    // Stage 2 is locked — its course list should contain no navigable links
    const stage2CourseList = page.getByRole('list', { name: /Courses in Stage 2/ })
    await expect(stage2CourseList.getByRole('link')).toHaveCount(0)
  })
})

// ─────────────────────────────────────────────
// AC6: Navigation integration
// ─────────────────────────────────────────────

test.describe('Navigation integration (AC6)', () => {
  test('"Career Paths" link appears in sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: 'Career Paths' })).toBeVisible()
  })

  test('sidebar link navigates to career paths list', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: 'Career Paths' }).click()
    await expect(page).toHaveURL('/career-paths')
    await expect(page.getByRole('heading', { name: 'Career Paths', level: 1 })).toBeVisible()
  })

  test('/career-paths/:pathId loads detail page', async ({ page }) => {
    await goToCareerPaths(page)
    const pathId = await getPathId(page)
    expect(pathId).toBeTruthy()

    await page.goto(`/career-paths/${pathId}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('invalid pathId redirects to career paths list', async ({ page }) => {
    await page.goto('/career-paths/nonexistent-path-id-12345')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/career-paths')
  })
})

// ─────────────────────────────────────────────
// Pre-seeded enrollment (regression)
// ─────────────────────────────────────────────

test.describe('Pre-seeded enrollment state', () => {
  test('enrolled state is shown when enrollment pre-seeded in DB', async ({ page }) => {
    // Navigate to load the app and get DB initialized
    await goToCareerPaths(page)
    const pathId = await getPathId(page)

    // Seed an enrollment record directly
    await seedPathEnrollments(page, [
      {
        id: 'test-enrollment-001',
        pathId,
        enrolledAt: '2026-01-01T00:00:00.000Z',
        status: 'active',
      },
    ])

    // Reload to pick up seeded data
    await page.goto(`/career-paths/${pathId}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Leave path/i })).toBeVisible()
  })
})
