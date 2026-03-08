/**
 * E07-S01: Momentum Score Calculation & Display
 *
 * Tests the momentum badge indicator on course cards and the "Sort by Momentum"
 * option in the courses library.
 */
import { test, expect } from '../../support/fixtures'
import { goToCourses } from '../../support/helpers/navigation'
import { seedStudySessions } from '../../support/helpers/indexeddb-seed'
import { FIXED_DATE, addMinutes, getRelativeDateWithMinutes } from '../../utils/test-time'
import { closeSidebar } from '@/tests/support/fixtures/constants/sidebar-constants'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
}

// Mock Date.now() to return FIXED_TIMESTAMP for deterministic momentum calculations
async function mockDateNow(page: import('@playwright/test').Page) {
  await page.addInitScript(({ fixedTimestamp }) => {
    const originalNow = Date.now
    Date.now = () => fixedTimestamp
    // Preserve original for debugging
    // @ts-expect-error - Store original
    Date._originalNow = originalNow
  }, { fixedTimestamp: new Date(FIXED_DATE).getTime() })
}

const STORE_NAME = 'studySessions'

/** Helper to select a value from a shadcn/Radix Select by data-testid */
async function selectSortOption(page: import('@playwright/test').Page, value: string) {
  const trigger = page.getByTestId('sort-select')
  await trigger.click()
  // Radix Select renders items in a portal with role="option"
  await page.getByRole('option', { name: value }).click()
}

test.describe('E07-S01: Momentum Score Display', () => {
  test('momentum badges appear on courses with study sessions', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    // Navigate first so Dexie creates the DB
    await goToCourses(page)

    // Seed a study session so at least one course has score > 0
    await seedStudySessions(page, [
      {
        id: 'test-badge-vis-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
    ])

    // Reload to pick up seeded data
    await goToCourses(page)

    // Wait for async momentum load and badge render via Playwright auto-retry
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Clean up
    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum badge has correct tier label text', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    // Seed session for badge to appear
    await seedStudySessions(page, [
      {
        id: 'test-tier-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
    ])

    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const text = await firstBadge.textContent()
    expect(['Hot', 'Warm', 'Cold'].some(t => text?.includes(t))).toBe(true)

    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum badge has accessible aria-label', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    await seedStudySessions(page, [
      {
        id: 'test-aria-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
        idleTime: 0,
        videosWatched: [],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
    ])

    await goToCourses(page)

    const firstBadge = page.getByTestId('momentum-badge').first()
    await expect(firstBadge).toBeVisible()

    const ariaLabel = await firstBadge.getAttribute('aria-label')
    expect(ariaLabel).toMatch(/^Momentum: (Hot|Warm|Cold) \(\d+\)$/)

    await indexedDB.clearStore(STORE_NAME)
  })

  test('sort by momentum option is present in courses page', async ({ page }) => {
    await seedSidebar(page)
    await mockDateNow(page)
    await goToCourses(page)

    const trigger = page.getByTestId('sort-select')
    await expect(trigger).toBeVisible()

    // Default value should show "Most Recent"
    await expect(trigger).toHaveText(/Most Recent/)

    // Open and check both options exist
    await trigger.click()
    await expect(page.getByRole('option', { name: 'Most Recent' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Sort by Momentum' })).toBeVisible()

    // Close by pressing Escape
    await page.keyboard.press('Escape')
  })

  test('selecting sort by momentum reorders the course list', async ({ page, indexedDB }) => {
    await seedSidebar(page)
    await mockDateNow(page)

    // Navigate first so Dexie creates the DB and stores
    await goToCourses(page)

    // Build study session records
    const highMomentumSessions = Array.from({ length: 8 }, (_, i) => ({
      id: `test-high-${i}`,
      courseId: 'nci-access',
      contentItemId: `lesson-${i}`,
      startTime: getRelativeDateWithMinutes(-i, 0),
      endTime: getRelativeDateWithMinutes(-i, 30),
      duration: 1800,
      idleTime: 0,
      videosWatched: [`video-${i}`],
      lastActivity: getRelativeDateWithMinutes(-i, 30),
      sessionType: 'video' as const,
    }))

    const lowMomentumSessions = [
      {
        id: 'test-low-0',
        courseId: 'authority',
        contentItemId: 'lesson-0',
        startTime: getRelativeDateWithMinutes(-6, 0),
        endTime: getRelativeDateWithMinutes(-6, 10),
        duration: 600,
        idleTime: 0,
        videosWatched: ['video-0'],
        lastActivity: getRelativeDateWithMinutes(-6, 10),
        sessionType: 'video' as const,
      },
    ]

    await seedStudySessions(page, [...highMomentumSessions, ...lowMomentumSessions])

    // Reload so the Courses page re-reads studySessions from IndexedDB
    await goToCourses(page)

    // Switch to momentum sort via shadcn Select
    await selectSortOption(page, 'Sort by Momentum')

    // Wait for badges to re-render after sort
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Extract momentum scores from aria-labels: "Momentum: Hot|Warm|Cold (N)"
    const badges = page.getByTestId('momentum-badge')
    const ariaLabels = await badges.evaluateAll(els =>
      els.map(el => el.getAttribute('aria-label') ?? '')
    )
    const scores = ariaLabels.map(label => {
      const match = label.match(/\((\d+)\)$/)
      return match ? Number(match[1]) : 0
    })

    // Verify monotonically non-increasing order
    expect(scores.length).toBeGreaterThanOrEqual(2)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }

    // The highest-scored course should be nci-access (seeded with 8 recent sessions)
    expect(scores[0]).toBeGreaterThan(0)

    // Clean up seeded study sessions
    await indexedDB.clearStore(STORE_NAME)
  })

  test('momentum score updates reactively after study-log-updated event', async ({
    page,
    indexedDB,
  }) => {
    await seedSidebar(page)
    await mockDateNow(page)

    // Navigate to create DB, then seed one session
    await goToCourses(page)

    await seedStudySessions(page, [
      {
        id: 'test-reactive-0',
        courseId: 'nci-access',
        contentItemId: 'lesson-0',
        startTime: getRelativeDateWithMinutes(-3, 0),
        endTime: getRelativeDateWithMinutes(-3, 10),
        duration: 600,
        idleTime: 0,
        videosWatched: [],
        lastActivity: getRelativeDateWithMinutes(-3, 10),
        sessionType: 'video',
      },
    ])

    // Reload to pick up initial session
    await goToCourses(page)
    await expect(page.getByTestId('momentum-badge').first()).toBeVisible()

    // Capture initial score
    const initialLabel = await page.getByTestId('momentum-badge').first().getAttribute('aria-label')
    const initialMatch = initialLabel?.match(/\((\d+)\)$/)
    const initialScore = initialMatch ? Number(initialMatch[1]) : 0

    // Seed a very recent session directly into IndexedDB (simulating endSession persistence)
    await seedStudySessions(page, [
      {
        id: 'test-reactive-1',
        courseId: 'nci-access',
        contentItemId: 'lesson-1',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
        idleTime: 0,
        videosWatched: ['video-1'],
        lastActivity: addMinutes(30),
        sessionType: 'video',
      },
    ])

    // Dispatch the event that endSession() now fires — no page reload
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('study-log-updated'))
    })

    // Wait for the score to update (Playwright auto-retry)
    await expect(page.getByTestId('momentum-badge').first()).toHaveAttribute(
      'aria-label',
      /Momentum: (Hot|Warm|Cold) \(\d+\)/
    )

    // Verify score increased
    const updatedLabel = await page.getByTestId('momentum-badge').first().getAttribute('aria-label')
    const updatedMatch = updatedLabel?.match(/\((\d+)\)$/)
    const updatedScore = updatedMatch ? Number(updatedMatch[1]) : 0

    expect(updatedScore).toBeGreaterThan(initialScore)

    // Clean up
    await indexedDB.clearStore(STORE_NAME)
  })
})
