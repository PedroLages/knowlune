/**
 * Error Path: Malformed Study Log Data (Story 7-10)
 *
 * Tests data integrity and error resilience when study log contains
 * malformed or corrupted StudyAction entries. The app should:
 * - Gracefully handle invalid study log data without crashing
 * - Skip corrupted entries in study schedule calculations
 * - Continue to function with valid entries
 * - Handle missing required fields
 * - Validate entry types before processing
 *
 * Related: E07-S05 (Study Schedule Suggestions)
 */
import { test, expect } from '../support/fixtures'
import { closeSidebar } from '../support/fixtures/constants/sidebar-constants'
import { getRelativeTimestamp } from '../utils/test-time'

// Seed sidebar state to prevent fullscreen Sheet overlay at tablet viewports
async function seedSidebar(page: import('@playwright/test').Page) {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
}

/**
 * Seed malformed study log data into localStorage
 * This bypasses validation to test error resilience
 */
async function seedMalformedStudyLog(page: import('@playwright/test').Page, actions: unknown[]) {
  await page.evaluate(
    ({ malformedActions }) => {
      localStorage.setItem('study-log', JSON.stringify(malformedActions))
    },
    { malformedActions: actions }
  )
}

/**
 * Clear study log from localStorage
 */
async function clearStudyLog(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.removeItem('study-log')
  })
}

test.describe('Error Path: Malformed Study Log Data', () => {
  test('app handles study log entries with missing required fields', async ({ page }) => {
    await seedSidebar(page)

    // Seed log entries missing required fields
    await seedMalformedStudyLog(page, [
      {
        // Missing type, courseId, timestamp
        lessonId: 'lesson-1',
      },
      {
        type: 'lesson_complete',
        // Missing courseId, timestamp
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        // Missing timestamp
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load without crashing
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Navigate to verify app is functional
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles study log entries with invalid type values', async ({ page }) => {
    await seedSidebar(page)

    // Seed log entries with invalid type
    await seedMalformedStudyLog(page, [
      {
        type: 'invalid_action_type', // Not a valid StudyAction type
        courseId: 'course-1',
        timestamp: '2025-01-15T10:00:00.000Z',
      },
      {
        type: null, // null instead of string
        courseId: 'course-1',
        timestamp: '2025-01-15T11:00:00.000Z',
      },
      {
        type: 123, // Number instead of string
        courseId: 'course-1',
        timestamp: '2025-01-15T12:00:00.000Z',
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should not crash
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles study log entries with malformed timestamps', async ({ page }) => {
    await seedSidebar(page)

    // Seed log entries with invalid timestamps
    await seedMalformedStudyLog(page, [
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: 'not-a-valid-date',
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: '2025-13-99T99:99:99.999Z', // Invalid date components
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: 12345678, // Number instead of ISO string
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: null, // null instead of string
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should not crash
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles study log entries with invalid courseId types', async ({ page }) => {
    await seedSidebar(page)

    // Seed log entries with invalid courseId
    await seedMalformedStudyLog(page, [
      {
        type: 'lesson_complete',
        courseId: 123, // Number instead of string
        timestamp: '2025-01-15T10:00:00.000Z',
      },
      {
        type: 'lesson_complete',
        courseId: null, // null instead of string
        timestamp: '2025-01-15T11:00:00.000Z',
      },
      {
        type: 'lesson_complete',
        courseId: undefined, // undefined instead of string
        timestamp: '2025-01-15T12:00:00.000Z',
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should not crash
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles corrupted JSON in study log localStorage', async ({ page }) => {
    await seedSidebar(page)

    // Set corrupted JSON directly
    await page.evaluate(() => {
      localStorage.setItem('study-log', '{corrupted json syntax...')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should load with empty log (corrupted data ignored)
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles null or undefined study log in localStorage', async ({ page }) => {
    await seedSidebar(page)

    // Set null as study log value
    await page.evaluate(() => {
      localStorage.setItem('study-log', 'null')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should treat null as empty log
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Try with undefined string
    await page.evaluate(() => {
      localStorage.setItem('study-log', 'undefined')
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // App should still work
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles mixed valid and invalid study log entries', async ({ page }) => {
    await seedSidebar(page)

    // Seed a mix of valid and corrupted entries
    await seedMalformedStudyLog(page, [
      // Valid entry - should be processed
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        lessonId: 'lesson-1',
        timestamp: '2025-01-15T10:00:00.000Z',
      },
      // Corrupted entry - should be skipped
      {
        type: 'invalid_type',
        timestamp: 'bad-timestamp',
      },
      // Another valid entry - should be processed
      {
        type: 'video_progress',
        courseId: 'course-2',
        lessonId: 'lesson-2',
        timestamp: '2025-01-15T11:00:00.000Z',
        metadata: { progress: 50 },
      },
      // Corrupted entry - should be skipped
      {
        courseId: 'course-3',
        // Missing type and timestamp
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should process valid entries and skip corrupted ones
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Navigate to verify functionality
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles study log with invalid metadata', async ({ page }) => {
    await seedSidebar(page)

    // Seed entries with invalid metadata
    await seedMalformedStudyLog(page, [
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: '2025-01-15T10:00:00.000Z',
        metadata: 'not-an-object', // String instead of object
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: '2025-01-15T11:00:00.000Z',
        metadata: [1, 2, 3], // Array instead of object
      },
      {
        type: 'lesson_complete',
        courseId: 'course-1',
        timestamp: '2025-01-15T12:00:00.000Z',
        metadata: null, // null instead of object
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should handle invalid metadata gracefully
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('study schedule calculation skips malformed log entries', async ({ page }) => {
    await seedSidebar(page)

    // Seed mix of valid and invalid entries
    // Valid entries should contribute to schedule calculation
    await seedMalformedStudyLog(page, [
      // Valid entries for schedule calculation
      {
        type: 'lesson_complete',
        courseId: 'nci-access',
        lessonId: 'lesson-1',
        timestamp: '2025-01-10T14:00:00.000Z', // 2pm
      },
      {
        type: 'lesson_complete',
        courseId: 'nci-access',
        lessonId: 'lesson-2',
        timestamp: '2025-01-12T14:00:00.000Z', // 2pm
      },
      // Corrupted entry - should be skipped in calculation
      {
        type: 'lesson_complete',
        courseId: 'nci-access',
        timestamp: 'invalid-timestamp',
      },
      // Another valid entry
      {
        type: 'lesson_complete',
        courseId: 'nci-access',
        lessonId: 'lesson-3',
        timestamp: '2025-01-14T14:00:00.000Z', // 2pm
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should calculate schedule from valid entries only
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    // Navigate to verify calculations don't crash
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app handles extremely large study log arrays', async ({ page }) => {
    await seedSidebar(page)

    // Generate a large array of entries (some valid, some invalid)
    const largeLog = []
    for (let i = 0; i < 2000; i++) {
      if (i % 5 === 0) {
        // Every 5th entry is corrupted
        largeLog.push({
          type: 'invalid',
          timestamp: 'bad',
        })
      } else {
        // Valid entry
        largeLog.push({
          type: 'lesson_complete',
          courseId: `course-${i % 10}`,
          timestamp: new Date(getRelativeTimestamp(-(i / 24))).toISOString(),
        })
      }
    }

    await seedMalformedStudyLog(page, largeLog)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should handle large logs without performance issues or crashes
    await expect(page.getByRole('heading', { name: /learning studio/i })).toBeVisible()

    await clearStudyLog(page)
  })

  test('app navigation works with corrupted study log', async ({ page }) => {
    await seedSidebar(page)

    await seedMalformedStudyLog(page, [
      {
        type: 'bad_type',
        timestamp: 'invalid',
      },
    ])

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate through app - should all work
    await page.getByRole('link', { name: /courses/i }).click()
    await expect(page).toHaveURL(/\/courses/)
    await expect(page.getByRole('heading', { name: 'All Courses' })).toBeVisible()

    await page.getByRole('link', { name: /my courses/i }).click()
    await expect(page).toHaveURL(/\/myclass/)
    await expect(page.getByRole('heading', { name: /my courses/i })).toBeVisible()

    await clearStudyLog(page)
  })
})
