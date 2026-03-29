/**
 * E2E Tests: Notifications Page (E58-S01)
 *
 * Tests the full-page notifications view including:
 * - Page renders notification list (AC1)
 * - "View all" button navigates from NotificationCenter (AC2)
 * - Type and read status filters (AC3)
 * - Mark-as-read and dismiss actions (AC4, AC5)
 * - Empty state (AC6)
 * - Accessibility (AC7)
 */
import { test, expect, type Page } from '@playwright/test'
import { seedIndexedDBStore, clearIndexedDBStore } from '../support/helpers/seed-helpers'
import { TIMEOUTS } from '../utils/constants'
import { addHours } from '../utils/test-time'

const DB_NAME = 'ElearningDB'
const STORE_NAME = 'notifications'

// Test notification data using FIXED_DATE for deterministic timestamps
function createTestNotifications() {
  return [
    {
      id: 'notif-001',
      type: 'course-complete',
      title: 'Course Completed',
      message: 'You finished "Introduction to TypeScript"',
      createdAt: addHours(-1),
      readAt: null,
      dismissedAt: null,
      actionUrl: '/courses/ts-101',
      metadata: {},
    },
    {
      id: 'notif-002',
      type: 'streak-milestone',
      title: '7-Day Streak',
      message: 'Amazing! You studied for 7 days in a row.',
      createdAt: addHours(-3),
      readAt: addHours(-2),
      dismissedAt: null,
      actionUrl: undefined,
      metadata: {},
    },
    {
      id: 'notif-003',
      type: 'import-finished',
      title: 'Import Complete',
      message: 'Your course "React Patterns" has been imported successfully.',
      createdAt: addHours(-5),
      readAt: null,
      dismissedAt: null,
      actionUrl: '/imported-courses/react-patterns',
      metadata: {},
    },
    {
      id: 'notif-004',
      type: 'achievement-unlocked',
      title: 'Achievement Unlocked',
      message: 'You earned "First Steps" badge!',
      createdAt: addHours(-8),
      readAt: null,
      dismissedAt: null,
      actionUrl: undefined,
      metadata: {},
    },
    {
      id: 'notif-005',
      type: 'review-due',
      title: 'Review Due',
      message: 'Time to review "Data Structures" — spaced repetition reminder.',
      createdAt: addHours(-12),
      readAt: addHours(-10),
      dismissedAt: null,
      actionUrl: '/review',
      metadata: {},
    },
  ]
}

async function seedNotifications(page: Page) {
  const notifications = createTestNotifications()
  await seedIndexedDBStore(page, DB_NAME, STORE_NAME, notifications)
}

async function clearNotifications(page: Page) {
  await clearIndexedDBStore(page, DB_NAME, STORE_NAME)
}

async function navigateToNotifications(page: Page) {
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({
    timeout: TIMEOUTS.NETWORK,
  })
}

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trigger Dexie DB creation, then seed
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await seedNotifications(page)
  })

  test.afterEach(async ({ page }) => {
    await clearNotifications(page)
  })

  test('AC1: renders notification list sorted newest-first', async ({ page }) => {
    await navigateToNotifications(page)

    const list = page.getByTestId('notifications-list')
    await expect(list).toBeVisible({ timeout: TIMEOUTS.LONG })

    const items = page.getByTestId('notification-item')
    await expect(items).toHaveCount(5)

    // First notification should be newest (notif-001: Course Completed)
    const firstItem = items.first()
    await expect(firstItem).toContainText('Course Completed')

    // Last should be oldest (notif-005: Review Due)
    const lastItem = items.last()
    await expect(lastItem).toContainText('Review Due')
  })

  test('AC2: "View all" button navigates from NotificationCenter', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Open notification center popover
    const bellButton = page.getByRole('button', { name: /notifications/i })
    await bellButton.click()

    // Click "View all notifications"
    const viewAllButton = page.getByRole('button', { name: /view all notifications/i })
    await expect(viewAllButton).toBeVisible({ timeout: TIMEOUTS.MEDIUM })
    await viewAllButton.click()

    // Should navigate to /notifications
    await expect(page).toHaveURL(/\/notifications/)
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({
      timeout: TIMEOUTS.NETWORK,
    })
  })

  test('AC3: filter by read status', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Filter to unread only
    await page.getByRole('button', { name: /filter by unread/i }).click()

    // Should show 3 unread notifications (notif-001, notif-003, notif-004)
    await expect(page.getByTestId('notification-item')).toHaveCount(3)

    // Filter to read only
    await page.getByRole('button', { name: /filter by read/i }).click()

    // Should show 2 read notifications (notif-002, notif-005)
    await expect(page.getByTestId('notification-item')).toHaveCount(2)

    // Back to all
    await page.getByRole('button', { name: /filter by all/i }).click()
    await expect(page.getByTestId('notification-item')).toHaveCount(5)
  })

  test('AC3: filter by notification type', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Filter to course-complete type
    await page.getByRole('button', { name: /filter by course complete/i }).click()
    await expect(page.getByTestId('notification-item')).toHaveCount(1)
    await expect(page.getByTestId('notification-item').first()).toContainText('Course Completed')

    // Filter to streak-milestone type
    await page.getByRole('button', { name: /filter by streak milestone/i }).click()
    await expect(page.getByTestId('notification-item')).toHaveCount(1)
    await expect(page.getByTestId('notification-item').first()).toContainText('7-Day Streak')

    // Show all types
    await page.getByRole('button', { name: /show all notification types/i }).click()
    await expect(page.getByTestId('notification-item')).toHaveCount(5)
  })

  test('AC4: mark individual notification as read', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // First item (Course Completed) should be unread
    const firstItem = page.getByTestId('notification-item').first()
    await expect(firstItem).toHaveAttribute('data-read', 'false')

    // Click mark-as-read on first item
    const markReadBtn = firstItem.getByRole('button', { name: /mark.*as read/i })
    await markReadBtn.click()

    // Should now be read
    await expect(firstItem).toHaveAttribute('data-read', 'true')
  })

  test('AC4: mark all notifications as read', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Click "Mark all as read"
    const markAllBtn = page.getByRole('button', { name: /mark all notifications as read/i })
    await markAllBtn.click()

    // All items should be read now
    const items = page.getByTestId('notification-item')
    for (let i = 0; i < 5; i++) {
      await expect(items.nth(i)).toHaveAttribute('data-read', 'true')
    }

    // "Mark all as read" button should disappear (no more unread)
    await expect(markAllBtn).not.toBeVisible()
  })

  test('AC5: dismiss a notification', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Dismiss the first notification
    const firstItem = page.getByTestId('notification-item').first()
    const dismissBtn = firstItem.getByRole('button', { name: /dismiss/i })
    await dismissBtn.click()

    // Should have 4 notifications remaining
    await expect(page.getByTestId('notification-item')).toHaveCount(4)
  })

  test('AC6: shows empty state when no notifications', async ({ page }) => {
    // Clear all notifications first
    await clearNotifications(page)
    await navigateToNotifications(page)

    const emptyState = page.getByTestId('notifications-empty')
    await expect(emptyState).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(emptyState).toContainText('No notifications yet')
  })

  test('AC6: shows filtered empty state when filters match nothing', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Filter to read + course-complete (only notif-001 is course-complete but unread)
    await page.getByRole('button', { name: /filter by read/i }).click()
    await page.getByRole('button', { name: /filter by course complete/i }).click()

    // Should show filtered empty state
    const emptyFiltered = page.getByTestId('notifications-empty-filtered')
    await expect(emptyFiltered).toBeVisible()
    await expect(emptyFiltered).toContainText('No matching notifications')
  })

  test('AC7: keyboard accessible', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Tab to filter buttons
    await page.keyboard.press('Tab')

    // Filters should have aria-pressed attribute
    const unreadFilter = page.getByRole('button', { name: /filter by unread/i })
    await expect(unreadFilter).toHaveAttribute('aria-pressed', 'false')

    // Interactive elements have aria-labels
    const markAllBtn = page.getByRole('button', { name: /mark all notifications as read/i })
    await expect(markAllBtn).toBeVisible()
  })

  test('AC7: ARIA live region announces actions', async ({ page }) => {
    await navigateToNotifications(page)

    await expect(page.getByTestId('notification-item')).toHaveCount(5, {
      timeout: TIMEOUTS.LONG,
    })

    // Mark all as read and verify live announcement
    await page.getByRole('button', { name: /mark all notifications as read/i }).click()

    const liveRegion = page.locator('[aria-live="polite"]')
    await expect(liveRegion).toContainText('All notifications marked as read')
  })
})
