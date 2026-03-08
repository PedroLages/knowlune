/**
 * E04-S04: View Study Session History
 *
 * Tests session history display with filters, empty states, and expandable details.
 *
 * ATDD Approach:
 *   - Tests written BEFORE implementation (RED phase)
 *   - Map directly to acceptance criteria
 *   - Will fail until SessionHistory page is built
 */
import { test, expect } from '../../support/fixtures'
import { getRelativeDate, getRelativeTimestamp } from '../../utils/test-time'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

/** Reusable helper to seed study sessions into IndexedDB */
async function seedStudySessions(
  page: import('@playwright/test').Page,
  sessions: Record<string, unknown>[]
) {
  await page.evaluate(
    async ({ dbName, storeName, data }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(storeName, 'readwrite')
          const store = tx.objectStore(storeName)
          for (const item of data) {
            store.put(item)
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: 'ElearningDB', storeName: 'studySessions', data: sessions }
  )
}

test.describe('E04-S04: View Study Session History', () => {
  test.beforeEach(async ({ page, indexedDB }) => {
    // Seed sidebar state to prevent tablet overlay blocking interactions
    await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
    // Clear study sessions before each test for isolation
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await indexedDB.clearStore('studySessions')
  })

  /**
   * AC 1: Display sessions in reverse chronological order
   * Given a user has logged study sessions
   * When they navigate to the session history view
   * Then sessions are displayed in reverse chronological order (most recent first)
   * And each entry shows: date, duration, course title, content summary
   */
  test('should display study sessions in reverse chronological order', async ({ page }) => {
    const sessions = [
      {
        id: 'session-1',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(-7)).setHours(10, 0, 0, 0),
        endTime: new Date(getRelativeDate(-7)).setHours(11, 30, 0, 0),
        duration: 5400, // 90 minutes in seconds
        contentSummary: 'Introduction to Hooks, useState Basics',
      },
      {
        id: 'session-2',
        courseId: 'course-b',
        courseTitle: 'TypeScript Deep Dive',
        startTime: new Date(getRelativeDate(-6)).setHours(14, 0, 0, 0),
        endTime: new Date(getRelativeDate(-6)).setHours(15, 15, 0, 0),
        duration: 4500, // 75 minutes in seconds
        contentSummary: 'Advanced Types, Generics',
      },
      {
        id: 'session-3',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(-5)).setHours(9, 0, 0, 0),
        endTime: new Date(getRelativeDate(-5)).setHours(10, 0, 0, 0),
        duration: 3600, // 60 minutes in seconds
        contentSummary: 'useEffect, Custom Hooks',
      },
    ]

    await seedStudySessions(page, sessions)

    // Navigate to session history page
    await page.goto('/session-history')

    // Verify page loaded
    await expect(page.getByRole('heading', { name: 'Study Session History' })).toBeVisible()

    // Verify sessions are in reverse chronological order (most recent first)
    const sessionEntries = page.locator('[data-testid="session-entry"]')
    await expect(sessionEntries).toHaveCount(3)

    // First entry should be the most recent (5 days ago)
    const firstEntry = sessionEntries.first()
    await expect(firstEntry).toContainText('React Fundamentals')
    await expect(firstEntry).toContainText('1h 0m') // 60 minutes
    await expect(firstEntry).toContainText('useEffect, Custom Hooks')
    // Verify date is displayed (AC1 requires date on each entry)
    const expectedRecentDate = new Date(getRelativeDate(-5)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    await expect(firstEntry.locator('[data-testid="session-date"]')).toContainText(expectedRecentDate)

    // Last entry should be oldest (7 days ago)
    const lastEntry = sessionEntries.last()
    await expect(lastEntry).toContainText('React Fundamentals')
    await expect(lastEntry).toContainText('1h 30m') // 90 minutes
    await expect(lastEntry).toContainText('Introduction to Hooks, useState Basics')
    const expectedOldDate = new Date(getRelativeDate(-7)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    await expect(lastEntry.locator('[data-testid="session-date"]')).toContainText(expectedOldDate)
  })

  /**
   * AC 2: Filter sessions by course
   * Given a user is viewing the session history
   * When they select a course filter
   * Then only sessions for the selected course are displayed
   * And the filter selection persists until cleared
   */
  test('should filter sessions by selected course', async ({ page }) => {
    const sessions = [
      {
        id: 'session-1',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(-7)).setHours(10, 0, 0, 0),
        endTime: new Date(getRelativeDate(-7)).setHours(11, 30, 0, 0),
        duration: 5400,
        contentSummary: 'Introduction to Hooks',
      },
      {
        id: 'session-2',
        courseId: 'course-b',
        courseTitle: 'TypeScript Deep Dive',
        startTime: new Date(getRelativeDate(-6)).setHours(14, 0, 0, 0),
        endTime: new Date(getRelativeDate(-6)).setHours(15, 15, 0, 0),
        duration: 4500,
        contentSummary: 'Advanced Types',
      },
    ]

    await seedStudySessions(page, sessions)

    await page.goto('/session-history')

    // Verify all sessions are visible initially
    await expect(page.locator('[data-testid="session-entry"]')).toHaveCount(2)

    // Select course filter
    await page.getByLabel('Filter by course').selectOption('course-a')

    // Verify only React Fundamentals sessions are visible
    const sessionEntries = page.locator('[data-testid="session-entry"]')
    await expect(sessionEntries).toHaveCount(1)
    await expect(sessionEntries.first()).toContainText('React Fundamentals')

    // Clear filter (now "Clear filters" clears all)
    await page.getByRole('button', { name: 'Clear filters' }).click()

    // Verify all sessions are visible again
    await expect(page.locator('[data-testid="session-entry"]')).toHaveCount(2)
  })

  /**
   * AC 3: Filter sessions by date range
   * Given a user is viewing the session history
   * When they select a date range filter
   * Then only sessions within the selected start and end dates are displayed
   * And both course and date range filters can be applied simultaneously
   */
  test('should filter sessions by date range', async ({ page }) => {
    const sessions = [
      {
        id: 'session-1',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(-8)).setHours(10, 0, 0, 0),
        endTime: new Date(getRelativeDate(-8)).setHours(11, 0, 0, 0),
        duration: 3600,
        contentSummary: 'Old session',
      },
      {
        id: 'session-2',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(-6)).setHours(14, 0, 0, 0),
        endTime: new Date(getRelativeDate(-6)).setHours(15, 0, 0, 0),
        duration: 3600,
        contentSummary: 'Recent session',
      },
      {
        id: 'session-3',
        courseId: 'course-b',
        courseTitle: 'TypeScript Deep Dive',
        startTime: new Date(getRelativeDate(-5)).setHours(9, 0, 0, 0),
        endTime: new Date(getRelativeDate(-5)).setHours(10, 0, 0, 0),
        duration: 3600,
        contentSummary: 'Latest session',
      },
    ]

    await seedStudySessions(page, sessions)

    await page.goto('/session-history')

    // Verify all sessions are visible initially
    await expect(page.locator('[data-testid="session-entry"]')).toHaveCount(3)

    // Select date range: 6 days ago to 5 days ago
    const startDate = getRelativeDate(-6).split('T')[0]
    const endDate = getRelativeDate(-5).split('T')[0]
    await page.getByLabel('Start date').fill(startDate)
    await page.getByLabel('End date').fill(endDate)

    // Verify only sessions within date range are visible
    const sessionEntries = page.locator('[data-testid="session-entry"]')
    await expect(sessionEntries).toHaveCount(2)
    await expect(sessionEntries.first()).toContainText('Latest session')
    await expect(sessionEntries.last()).toContainText('Recent session')

    // Apply simultaneous course filter
    await page.getByLabel('Filter by course').selectOption('course-a')

    // Verify only React sessions within date range are visible
    await expect(page.locator('[data-testid="session-entry"]')).toHaveCount(1)
    await expect(sessionEntries.first()).toContainText('React Fundamentals')
    await expect(sessionEntries.first()).toContainText('Recent session')
  })

  /**
   * AC 4: Display empty state when no sessions exist
   * Given a user has no study sessions recorded
   * When they navigate to the session history view
   * Then an empty state is displayed with a message encouraging them to start learning
   * And a call-to-action links to the Courses page
   */
  test('should display empty state when no sessions exist', async ({ page }) => {
    await page.goto('/session-history')

    // Verify empty state is displayed
    await expect(page.getByRole('heading', { name: 'No Study Sessions Yet' })).toBeVisible()
    await expect(page.getByText(/Start learning to see your study history/i)).toBeVisible()

    // Verify CTA links to Courses page
    const ctaLink = page.getByRole('link', { name: 'Browse Courses' })
    await expect(ctaLink).toBeVisible()
    await expect(ctaLink).toHaveAttribute('href', '/courses')
  })

  /**
   * AC 5: Virtualize or paginate large session lists
   * Given a user has many study sessions
   * When the session history list exceeds the viewport
   * Then the list is virtualized or paginated to maintain smooth scrolling performance
   */
  test('should handle large session lists with pagination', async ({ page }) => {
    // Seed 50 study sessions (> PAGE_SIZE of 20)
    const sessions = Array.from({ length: 50 }, (_, i) => {
      const dayOffset = -50 + i // Start from 50 days ago, increment each day
      return {
        id: `session-${i}`,
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(getRelativeDate(dayOffset)).setHours(10, 0, 0, 0),
        endTime: new Date(getRelativeDate(dayOffset)).setHours(11, 0, 0, 0),
        duration: 3600,
        contentSummary: `Session ${i}`,
      }
    })

    await seedStudySessions(page, sessions)

    await page.goto('/session-history')

    // Verify page loaded
    await expect(page.getByRole('heading', { name: 'Study Session History' })).toBeVisible()

    // Verify DOM is bounded: only PAGE_SIZE (20) of 50 entries rendered initially
    const sessionEntries = page.locator('[data-testid="session-entry"]')
    await expect(sessionEntries).toHaveCount(20)

    // Verify "Show more" button is visible
    const showMoreButton = page.getByRole('button', { name: 'Show more' })
    await expect(showMoreButton).toBeVisible()

    // Click "Show more" to load next page
    await showMoreButton.click()

    // Verify count increased to 40
    await expect(sessionEntries).toHaveCount(40)

    // Click "Show more" again to load remaining 10
    await showMoreButton.click()

    // Verify all 50 entries now visible and "Show more" is gone
    await expect(sessionEntries).toHaveCount(50)
    await expect(showMoreButton).not.toBeVisible()
  })

  /**
   * AC 6: Expand session entry to show details
   * Given a user is viewing a session entry
   * When they click or tap on the entry
   * Then an expanded view shows additional details: exact start and end times,
   * individual content items with timestamps, and a link to resume that course
   */
  test('should expand session entry to show detailed information', async ({ page }) => {
    const sessionDate = getRelativeDate(-5)
    const sessions = [
      {
        id: 'session-1',
        courseId: 'course-a',
        courseTitle: 'React Fundamentals',
        startTime: new Date(sessionDate).setHours(10, 0, 0, 0),
        endTime: new Date(sessionDate).setHours(11, 30, 0, 0),
        duration: 5400,
        contentSummary: 'Introduction to Hooks, useState Basics',
        contentItems: [
          {
            id: 'lesson-1',
            title: 'Introduction to Hooks',
            timestamp: new Date(sessionDate).setHours(10, 0, 0, 0),
          },
          {
            id: 'lesson-2',
            title: 'useState Basics',
            timestamp: new Date(sessionDate).setHours(10, 45, 0, 0),
          },
        ],
      },
    ]

    await seedStudySessions(page, sessions)

    await page.goto('/session-history')

    // Click on session entry to expand
    const sessionEntry = page.locator('[data-testid="session-entry"]').first()
    await sessionEntry.locator('button').click()

    // Verify expanded details are visible using data-testid (locale-safe)
    await expect(page.locator('[data-testid="session-start-time"]')).toBeVisible()
    await expect(page.locator('[data-testid="session-end-time"]')).toBeVisible()

    // Verify content items
    await expect(page.getByText('Introduction to Hooks')).toBeVisible()
    await expect(page.getByText('useState Basics')).toBeVisible()

    // Verify resume course link
    const resumeLink = page.getByRole('link', { name: 'Resume Course' })
    await expect(resumeLink).toBeVisible()
    await expect(resumeLink).toHaveAttribute('href', /\/courses\/course-a/)

    // Verify clicking again collapses the entry
    await sessionEntry.locator('button').click()
    await expect(page.locator('[data-testid="session-start-time"]')).not.toBeVisible()
  })
})
