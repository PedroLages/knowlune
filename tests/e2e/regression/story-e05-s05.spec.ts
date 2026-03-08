import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
/**
 * E05-S05: Study Reminders & Notifications — ATDD Tests
 *
 * Verifies:
 *   - AC1: Notification permission request on first toggle
 *   - AC2: Daily reminder time configuration + persistence
 *   - AC3: Streak-at-risk reminder toggle
 *   - AC6: Disable reminders cancels all scheduled notifications
 *   - AC7: Streak-at-risk suppressed when streak is paused
 */
import { test, expect } from '../../support/fixtures'
import { goToSettings } from '../../support/helpers/navigation'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

test.describe('Study Reminders & Notifications (E05-S05)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed to prevent overlay at smaller viewports
    await page.goto('/')
    await page.evaluate((sidebarState) => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    }, closeSidebar())
  })

  test('AC1: should show notification permission prompt when enabling reminders', async ({
    page,
  }) => {
    // Mock Notification.permission as 'default' → requestPermission resolves 'granted'
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: () => Promise.resolve('granted'),
        },
        writable: true,
      })
    })

    await goToSettings(page)

    // Expect a reminders section to exist
    const remindersSection = page.getByTestId('reminders-section')
    await expect(remindersSection).toBeVisible()

    // Toggle reminders on
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })
    await expect(reminderToggle).toBeVisible()
    await reminderToggle.click()

    // Should show permission state feedback (granted)
    const permissionFeedback = remindersSection.getByTestId('notification-permission-status')
    await expect(permissionFeedback).toBeVisible()
    await expect(permissionFeedback).toContainText(/notifications enabled/i)
  })

  test('AC1: should show guidance when notification permission is denied', async ({ page }) => {
    // Mock Notification.permission as 'denied'
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
          requestPermission: () => Promise.resolve('denied'),
        },
        writable: true,
      })
    })

    await goToSettings(page)

    const remindersSection = page.getByTestId('reminders-section')
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })
    await reminderToggle.click()

    // Should show helpful message about enabling notifications in browser settings
    const deniedMessage = remindersSection.getByTestId('permission-denied-guidance')
    await expect(deniedMessage).toBeVisible()
    await expect(deniedMessage).toContainText(/browser settings/i)
  })

  test('AC2: should allow selecting daily reminder time and persist it', async ({ page }) => {
    // Mock Notification.permission as 'granted'
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: () => Promise.resolve('granted'),
        },
        writable: true,
      })
    })

    await goToSettings(page)

    const remindersSection = page.getByTestId('reminders-section')

    // Enable reminders
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })
    await reminderToggle.click()

    // Daily reminder config should appear
    const dailyReminderToggle = remindersSection.getByRole('switch', {
      name: /daily.*reminder/i,
    })
    await expect(dailyReminderToggle).toBeVisible()
    await dailyReminderToggle.click()

    // Time picker should be visible
    const timePicker = remindersSection.getByTestId('reminder-time-picker')
    await expect(timePicker).toBeVisible()

    // Change the time and verify persistence
    const timeInput = timePicker.locator('input[type="time"]')
    await timeInput.fill('14:30')

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('study-reminders')
      return raw ? JSON.parse(raw) : null
    })
    expect(stored).not.toBeNull()
    expect(stored.dailyReminderTime).toBe('14:30')
  })

  test('AC3: should allow enabling streak-at-risk reminder', async ({ page }) => {
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: () => Promise.resolve('granted'),
        },
        writable: true,
      })
    })

    await goToSettings(page)

    const remindersSection = page.getByTestId('reminders-section')
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })
    await reminderToggle.click()

    // Streak-at-risk toggle should be visible
    const streakAtRiskToggle = remindersSection.getByRole('switch', {
      name: /streak.*risk/i,
    })
    await expect(streakAtRiskToggle).toBeVisible()
    await streakAtRiskToggle.click()

    // Should show description about 22-hour monitoring
    const description = remindersSection.getByText(/22.*hour/i)
    await expect(description).toBeVisible()
  })

  test('AC6: should cancel all reminders when toggling off', async ({ page }) => {
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: () => Promise.resolve('granted'),
        },
        writable: true,
      })
    })

    await goToSettings(page)

    const remindersSection = page.getByTestId('reminders-section')
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })

    // Enable reminders and verify enabled state persisted
    await reminderToggle.click()
    const enabledState = await page.evaluate(() => {
      const raw = localStorage.getItem('study-reminders')
      return raw ? JSON.parse(raw) : null
    })
    expect(enabledState?.enabled).toBe(true)

    // Disable reminders
    await reminderToggle.click()

    // Configuration options should be hidden (element must not exist in DOM)
    await expect(
      remindersSection.getByRole('switch', { name: /daily.*reminder/i })
    ).not.toBeVisible()

    // Verify disabled state is persisted in localStorage
    const disabledState = await page.evaluate(() => {
      const raw = localStorage.getItem('study-reminders')
      return raw ? JSON.parse(raw) : null
    })
    expect(disabledState?.enabled).toBe(false)

    // Verify toggle state survives reload
    await page.reload()
    await goToSettings(page)

    const toggleAfterReload = page
      .getByTestId('reminders-section')
      .getByRole('switch', { name: /enable.*reminders/i })
    await expect(toggleAfterReload).not.toBeChecked()
  })

  test('AC7: should suppress streak-at-risk when streak is paused', async ({ page }) => {
    // Seed Notification mock via addInitScript (runs before page load)
    await page.addInitScript((sidebarState) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'granted',
          requestPermission: () => Promise.resolve('granted'),
        },
        writable: true,
      })
    })

    // Seed pause data before navigating so the component reads isPaused = true on mount
    await page.goto('/')
    await page.evaluate(() => {
      Object.entries(sidebarState).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      }, closeSidebar())
      localStorage.setItem(
        'study-streak-pause',
        JSON.stringify({
          enabled: true,
          startDate: FIXED_DATE,
          days: 2,
        })
      )
    })

    await goToSettings(page)

    const remindersSection = page.getByTestId('reminders-section')
    const reminderToggle = remindersSection.getByRole('switch', { name: /enable.*reminders/i })
    await reminderToggle.click()

    // Streak-at-risk toggle should be disabled when paused
    const streakAtRiskToggle = remindersSection.getByRole('switch', {
      name: /streak.*risk/i,
    })
    await expect(streakAtRiskToggle).toBeDisabled()

    // Should show paused indicator
    const isPausedIndicator = remindersSection.getByText(/paused/i)
    await expect(isPausedIndicator).toBeVisible()
  })
})
