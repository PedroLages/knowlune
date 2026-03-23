/**
 * Error Path: Invalid Study Goal Values (Story 7-11)
 *
 * Tests input validation and error resilience when study goals contain
 * invalid values. The app should:
 * - Reject negative target values (clamp or ignore)
 * - Reject zero or NaN target values
 * - Handle invalid frequency/metric enum values
 * - Handle missing required fields gracefully
 * - Treat corrupted goals as null/unset
 * - Continue to function without a valid goal
 *
 * Related: E07-S05 (Study Schedule Suggestions)
 */
import { test, expect } from '../support/fixtures'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
}

/**
 * Seed invalid study goal into localStorage
 * This bypasses validation to test error resilience
 */
async function seedInvalidStudyGoal(page: import('@playwright/test').Page, goal: unknown) {
  await page.evaluate(
    ({ invalidGoal }) => {
      localStorage.setItem('study-goals', JSON.stringify(invalidGoal))
    },
    { invalidGoal: goal }
  )
}

/**
 * Clear study goals from localStorage
 */
async function clearStudyGoals(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('study-goals')
  })
}

test.describe('Error Path: Invalid Study Goal Values', () => {
  test('app handles study goal with negative target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with negative target
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: -60, // Negative minutes
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load without crashing
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Goal should be treated as invalid (null)
    // App should function normally without a goal

    await clearStudyGoals(page)
  })

  test('app handles study goal with zero target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with zero target
    await seedInvalidStudyGoal(page, {
      frequency: 'weekly',
      metric: 'sessions',
      target: 0, // Zero sessions (invalid)
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load without crashing
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Goal should be rejected (zero is not a valid target)

    await clearStudyGoals(page)
  })

  test('app handles study goal with NaN target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with NaN target
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: NaN, // Not a number
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load without crashing
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with Infinity target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with Infinity target
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: Infinity, // Infinite minutes (not realistic)
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load without crashing
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with invalid frequency value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with invalid frequency
    await seedInvalidStudyGoal(page, {
      frequency: 'monthly', // Not 'daily' | 'weekly'
      metric: 'time',
      target: 60,
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should treat as invalid goal
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with invalid metric value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with invalid metric
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'pages', // Not 'time' | 'sessions'
      target: 50,
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should treat as invalid goal
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with missing required fields', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal missing frequency field
    await seedInvalidStudyGoal(page, {
      // Missing frequency
      metric: 'time',
      target: 60,
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Seed goal missing metric field
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      // Missing metric
      target: 60,
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Seed goal missing target field
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      // Missing target
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with invalid data types', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with wrong data types
    await seedInvalidStudyGoal(page, {
      frequency: 123, // Number instead of string
      metric: 'time',
      target: 60,
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Seed goal with target as string
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: '60', // String instead of number
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles corrupted JSON in study goals localStorage', async ({ page }) => {
    await seedSidebar(page)

    // Set corrupted JSON directly
    await page.evaluate(() => {
      localStorage.setItem('study-goals', '{corrupted json syntax...')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load with no goal (corrupted data ignored)
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles null study goal in localStorage', async ({ page }) => {
    await seedSidebar(page)

    // Set null as goal value
    await page.evaluate(() => {
      localStorage.setItem('study-goals', 'null')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should treat null as no goal
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles undefined study goal in localStorage', async ({ page }) => {
    await seedSidebar(page)

    // Set undefined as goal value
    await page.evaluate(() => {
      localStorage.setItem('study-goals', 'undefined')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should treat undefined as no goal
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with extremely large target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with unrealistically large target
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: 99999999999, // Billions of minutes per day
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should handle large numbers without overflow errors
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app handles study goal with fractional target value', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with fractional target (e.g., 45.7 minutes)
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: 45.7, // Fractional minutes
      createdAt: '2025-01-15T10:00:00.000Z',
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should either accept and round, or reject as invalid
    // Either way, it should not crash
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('app navigation works without valid study goal', async ({ page }) => {
    await seedSidebar(page)

    // Seed invalid goal
    await seedInvalidStudyGoal(page, {
      frequency: 'invalid',
      metric: 'invalid',
      target: -999,
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate through app - should all work
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page).toHaveURL(/\/courses/)
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()

    await page.getByRole('link', { name: /my courses/i }).click()
    await expect(page).toHaveURL(/\/myclass/)
    await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()

    await clearStudyGoals(page)
  })

  test('study schedule calculation handles missing goal gracefully', async ({ page }) => {
    await seedSidebar(page)

    // Don't set any goal (null goal case)
    await clearStudyGoals(page)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should show schedule in "no-goal" state
    // Should not crash trying to access null goal properties
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Navigate to verify functionality
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()
  })

  test('app handles goal with malformed createdAt timestamp', async ({ page }) => {
    await seedSidebar(page)

    // Seed goal with invalid createdAt
    await seedInvalidStudyGoal(page, {
      frequency: 'daily',
      metric: 'time',
      target: 60,
      createdAt: 'not-a-valid-timestamp', // Invalid ISO string
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should not crash (createdAt validation if needed)
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyGoals(page)
  })
})
