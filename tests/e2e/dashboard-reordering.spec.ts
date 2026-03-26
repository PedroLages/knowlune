/**
 * E21-S06: Smart Dashboard Reordering E2E tests.
 *
 * Validates:
 *   - Customize layout toggle opens/closes the panel
 *   - Pin/unpin sections moves them to top
 *   - Reset to default restores original order
 *   - Section order persists across page reloads
 *   - Sections render in the configured order
 */
import { test, expect } from '../support/fixtures'
import { goToOverview } from '../support/helpers/navigation'
import { FIXED_DATE } from '../utils/test-time'

const DEFAULT_SECTION_ORDER = [
  'section-recommended-next',
  'section-metrics-strip',
  'section-engagement-zone',
  'section-study-history',
  'section-study-schedule',
  'section-insight-action',
  'section-course-gallery',
]

test.describe('Dashboard Reordering (E21-S06)', () => {
  test('should show customize layout button on overview', async ({ page }) => {
    await goToOverview(page)

    const toggle = page.getByTestId('customize-dashboard-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveText('Customize Layout')
  })

  test('should open and close the customizer panel', async ({ page }) => {
    await goToOverview(page)

    const toggle = page.getByTestId('customize-dashboard-toggle')
    await toggle.click()

    // Panel should be open
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toBeVisible()
    await expect(toggle).toHaveText('Close')

    // Reset button should NOT be visible when not manually ordered
    await expect(page.getByTestId('reset-dashboard-order')).not.toBeVisible()

    // Close the panel
    await toggle.click()
    await expect(panel).not.toBeVisible()
  })

  test('should display all section rows in customizer', async ({ page }) => {
    await goToOverview(page)

    await page.getByTestId('customize-dashboard-toggle').click()

    // Verify all 7 section rows exist
    for (const sectionTestId of DEFAULT_SECTION_ORDER) {
      const sectionId = sectionTestId.replace('section-', '')
      await expect(page.getByTestId(`section-row-${sectionId}`)).toBeVisible()
    }
  })

  test('should pin a section to the top', async ({ page }) => {
    await goToOverview(page)

    await page.getByTestId('customize-dashboard-toggle').click()

    // Pin "Study History" section
    await page.getByTestId('pin-study-history').click()

    // The section row should show "Pinned" badge
    const sectionRow = page.getByTestId('section-row-study-history')
    await expect(sectionRow.getByText('Pinned')).toBeVisible()

    // Close customizer and verify section order on page
    await page.getByTestId('customize-dashboard-toggle').click()

    // Study History should now be the first reorderable section
    const sections = page.locator('[data-testid^="section-"]')
    const firstSectionTestId = await sections.first().getAttribute('data-testid')
    expect(firstSectionTestId).toBe('section-study-history')
  })

  test('should unpin a previously pinned section', async ({ page, localStorage }) => {
    await page.goto('/')
    // Pre-seed pinned state
    await localStorage.seed('dashboard-section-order', {
      order: [
        'study-history',
        'recommended-next',
        'metrics-strip',
        'engagement-zone',
        'study-schedule',
        'insight-action',
        'course-gallery',
      ],
      pinnedSections: ['study-history'],
      isManuallyOrdered: false,
    })
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    await page.getByTestId('customize-dashboard-toggle').click()

    // Verify it's pinned
    const sectionRow = page.getByTestId('section-row-study-history')
    await expect(sectionRow.getByText('Pinned')).toBeVisible()

    // Unpin it
    await page.getByTestId('pin-study-history').click()

    // Pinned badge should be gone
    await expect(sectionRow.getByText('Pinned')).not.toBeVisible()
  })

  test('should reset to default order', async ({ page, localStorage }) => {
    await page.goto('/')
    // Pre-seed a custom order
    await localStorage.seed('dashboard-section-order', {
      order: [
        'course-gallery',
        'insight-action',
        'study-schedule',
        'study-history',
        'engagement-zone',
        'metrics-strip',
        'recommended-next',
      ],
      pinnedSections: ['course-gallery'],
      isManuallyOrdered: true,
    })
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    await page.getByTestId('customize-dashboard-toggle').click()
    await page.getByTestId('reset-dashboard-order').click()

    // Close customizer
    await page.getByTestId('customize-dashboard-toggle').click()

    // Verify default section order is restored
    const sections = page.locator('[data-testid^="section-"]')
    const count = await sections.count()
    expect(count).toBe(7)

    const testIds: string[] = []
    for (let i = 0; i < count; i++) {
      const testId = await sections.nth(i).getAttribute('data-testid')
      if (testId) testIds.push(testId)
    }
    expect(testIds).toEqual(DEFAULT_SECTION_ORDER)
  })

  test('should persist section order across page reload', async ({ page, localStorage }) => {
    await page.goto('/')
    // Pre-seed a custom order
    const customOrder = [
      'course-gallery',
      'recommended-next',
      'metrics-strip',
      'engagement-zone',
      'study-history',
      'study-schedule',
      'insight-action',
    ]
    await localStorage.seed('dashboard-section-order', {
      order: customOrder,
      pinnedSections: ['course-gallery'],
      isManuallyOrdered: true,
    })
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Verify sections render in the seeded custom order
    const sections = page.locator('[data-testid^="section-"]')
    const firstSection = await sections.first().getAttribute('data-testid')
    expect(firstSection).toBe('section-course-gallery')
  })

  test('should render all default sections on fresh load', async ({ page }) => {
    await goToOverview(page)

    for (const sectionTestId of DEFAULT_SECTION_ORDER) {
      await expect(page.getByTestId(sectionTestId)).toBeAttached()
    }
  })

  test('AC2: should auto-reorder sections based on seeded relevance stats', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed interaction stats with high relevance for course-gallery and insight-action
    // so they should sort above sections with zero interactions
    const now = FIXED_DATE
    await localStorage.seed('dashboard-section-stats', {
      'recommended-next': { views: 0, timeSpentMs: 0, lastAccessedAt: '' },
      'metrics-strip': { views: 0, timeSpentMs: 0, lastAccessedAt: '' },
      'engagement-zone': { views: 0, timeSpentMs: 0, lastAccessedAt: '' },
      'study-history': { views: 0, timeSpentMs: 0, lastAccessedAt: '' },
      'study-schedule': { views: 0, timeSpentMs: 0, lastAccessedAt: '' },
      'insight-action': { views: 50, timeSpentMs: 600000, lastAccessedAt: now },
      'course-gallery': { views: 100, timeSpentMs: 1200000, lastAccessedAt: now },
    })

    // Ensure no manual order is set (auto-reorder should kick in)
    await localStorage.seed('dashboard-section-order', {
      order: [
        'recommended-next',
        'metrics-strip',
        'engagement-zone',
        'study-history',
        'study-schedule',
        'insight-action',
        'course-gallery',
      ],
      pinnedSections: [],
      isManuallyOrdered: false,
    })

    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Gather rendered section order
    const sections = page.locator('[data-testid^="section-"]')
    const count = await sections.count()
    const testIds: string[] = []
    for (let i = 0; i < count; i++) {
      const testId = await sections.nth(i).getAttribute('data-testid')
      if (testId) testIds.push(testId)
    }

    // course-gallery and insight-action should be in top positions (before zero-interaction sections)
    const courseGalleryIdx = testIds.indexOf('section-course-gallery')
    const insightActionIdx = testIds.indexOf('section-insight-action')
    const studyHistoryIdx = testIds.indexOf('section-study-history')

    expect(courseGalleryIdx).toBeLessThan(studyHistoryIdx)
    expect(insightActionIdx).toBeLessThan(studyHistoryIdx)
    // course-gallery has higher stats, should come before insight-action
    expect(courseGalleryIdx).toBeLessThan(insightActionIdx)
  })

  test('AC3: should render sections in manually-specified order from localStorage', async ({
    page,
    localStorage,
  }) => {
    await page.goto('/')

    // Seed a specific manual order
    const manualOrder = [
      'course-gallery',
      'study-schedule',
      'insight-action',
      'engagement-zone',
      'study-history',
      'metrics-strip',
      'recommended-next',
    ] as const

    await localStorage.seed('dashboard-section-order', {
      order: [...manualOrder],
      pinnedSections: [],
      isManuallyOrdered: true,
    })

    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    // Verify sections render in the exact manually-specified order
    const sections = page.locator('[data-testid^="section-"]')
    const count = await sections.count()
    expect(count).toBe(7)

    const testIds: string[] = []
    for (let i = 0; i < count; i++) {
      const testId = await sections.nth(i).getAttribute('data-testid')
      if (testId) testIds.push(testId)
    }

    const expectedOrder = manualOrder.map(id => `section-${id}`)
    expect(testIds).toEqual(expectedOrder)
  })

  test('should show reset button only when manually ordered', async ({ page, localStorage }) => {
    await page.goto('/')
    // Seed a manual order
    await localStorage.seed('dashboard-section-order', {
      order: [
        'course-gallery',
        'recommended-next',
        'metrics-strip',
        'engagement-zone',
        'study-history',
        'study-schedule',
        'insight-action',
      ],
      pinnedSections: [],
      isManuallyOrdered: true,
    })
    await page.reload()
    await page.waitForSelector('[data-testid="stats-grid"]', { state: 'visible', timeout: 10000 })

    await page.getByTestId('customize-dashboard-toggle').click()

    // Reset button should be visible when manually ordered
    await expect(page.getByTestId('reset-dashboard-order')).toBeVisible()
  })

  test('customizer panel should be keyboard accessible', async ({ page }) => {
    await goToOverview(page)

    // The toggle button should have correct aria attributes
    const toggle = page.getByTestId('customize-dashboard-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // Panel should have role="region" with aria-label
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toHaveAttribute('role', 'region')
    await expect(panel).toHaveAttribute('aria-label', 'Dashboard section order')
  })

  test('AC6: keyboard drag handles are focusable with correct ARIA and live region exists', async ({
    page,
  }) => {
    // Seed wizard completion before navigation to prevent overlay blocking
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
    await goToOverview(page)

    // Open customizer
    await page.getByTestId('customize-dashboard-toggle').click()
    const panel = page.locator('#dashboard-customizer-panel')
    await expect(panel).toBeVisible()

    // Verify @dnd-kit injects an ARIA live region for screen reader announcements
    const liveRegion = page.locator('[aria-live="assertive"][role="status"]')
    await expect(liveRegion).toBeAttached()

    // Verify drag handles have correct ARIA labels and are keyboard-focusable
    const firstHandle = page.getByLabel('Drag to reorder Recommended Next')
    await expect(firstHandle).toBeVisible()

    // Drag handle is a native <button> — should be keyboard-focusable
    await firstHandle.focus()
    await expect(firstHandle).toBeFocused()

    // Verify @dnd-kit sets aria-roledescription="sortable" on sortable items
    const sortableItem = page.getByTestId('section-row-recommended-next')
    await expect(sortableItem).toHaveAttribute('aria-roledescription', 'sortable')

    // Verify all drag handles exist with descriptive ARIA labels (9 sections total)
    const handles = panel.locator('button[aria-label^="Drag to reorder"]')
    await expect(handles).toHaveCount(9)
  })
})
