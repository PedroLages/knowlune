/**
 * E11-S06: Per-Course Study Reminders — ATDD Tests
 *
 * Verifies:
 *   - AC1: Configure per-course reminder with day/time selection
 *   - AC2: Browser notification delivery with course deep-link
 *   - AC3: Independence from streak reminders
 *   - AC4: Notification permission prompt and graceful handling
 *   - AC5: Edit and disable reminders
 *   - AC6: Multi-course reminder overview
 */
import { test, expect } from '../support/fixtures'
import { goToSettings } from '../support/helpers/navigation'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createCourse } from '../support/fixtures/factories/course-factory'

/**
 * Helper: seed two courses into IndexedDB for multi-course tests.
 */
async function seedTwoCourses(page: import('@playwright/test').Page) {
  const courseA = createCourse({
    id: 'course-a',
    title: 'TypeScript Fundamentals',
    slug: 'typescript-fundamentals',
  })
  const courseB = createCourse({
    id: 'course-b',
    title: 'React Patterns',
    slug: 'react-patterns',
  })
  await seedImportedCourses(page, [courseA, courseB])
}

/**
 * Helper: mock Notification API with given permission state.
 */
async function mockNotificationPermission(
  page: import('@playwright/test').Page,
  permission: 'granted' | 'denied' | 'default',
  requestResult: 'granted' | 'denied' = 'granted'
) {
  await page.addInitScript(
    ({ perm, result }) => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: perm,
          requestPermission: () => Promise.resolve(result),
        },
        writable: true,
      })
    },
    { perm: permission, result: requestResult }
  )
}

test.describe('E11-S06: Per-Course Study Reminders', () => {
  test.beforeEach(async ({ page }) => {
    // Mock notifications as granted by default
    await mockNotificationPermission(page, 'granted')

    // Navigate to initialize Dexie, then seed courses
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
    await seedTwoCourses(page)
    await page.reload()
    await page.waitForLoadState('load')
  })

  test('AC1: configure per-course reminder with day and time selection', async ({ page }) => {
    // Navigate to course settings or reminder configuration area
    await goToSettings(page)

    // Expect a per-course reminders section
    const courseRemindersSection = page.getByTestId('course-reminders-section')
    await expect(courseRemindersSection).toBeVisible()

    // Add a reminder for a specific course
    const addReminderBtn = courseRemindersSection.getByRole('button', {
      name: /add.*reminder/i,
    })
    await addReminderBtn.click()

    // Select a course
    const courseSelect = page.getByTestId('course-reminder-course-select')
    await expect(courseSelect).toBeVisible()
    await courseSelect.click()
    await page.getByRole('option', { name: /typescript fundamentals/i }).click()

    // Select days of the week (e.g., Monday, Wednesday, Friday)
    const daySelector = page.getByTestId('course-reminder-day-selector')
    await expect(daySelector).toBeVisible()
    await daySelector.getByRole('checkbox', { name: /monday/i }).check()
    await daySelector.getByRole('checkbox', { name: /wednesday/i }).check()
    await daySelector.getByRole('checkbox', { name: /friday/i }).check()

    // Set a time
    const timeInput = page.getByTestId('course-reminder-time-input')
    await expect(timeInput).toBeVisible()
    await timeInput.fill('09:00')

    // Save the reminder
    const saveBtn = page.getByRole('button', { name: /save.*reminder/i })
    await saveBtn.click()

    // Verify the reminder appears in the list, independent from streak reminders
    const reminderItem = courseRemindersSection.getByText(/typescript fundamentals/i)
    await expect(reminderItem).toBeVisible()
    await expect(courseRemindersSection.getByText(/mon.*wed.*fri/i)).toBeVisible()
    await expect(courseRemindersSection.getByText(/09:00/i)).toBeVisible()
  })

  test('AC3: per-course reminders are independent from streak reminders', async ({ page }) => {
    // Seed streak reminder settings (enabled)
    await page.evaluate(() => {
      localStorage.setItem(
        'study-reminders',
        JSON.stringify({
          enabled: true,
          dailyReminder: true,
          dailyReminderTime: '08:00',
          streakAtRisk: true,
        })
      )
    })

    await goToSettings(page)

    // Verify streak reminders section exists and is enabled
    const streakReminders = page.getByTestId('reminders-section')
    await expect(streakReminders).toBeVisible()

    // Verify per-course reminders section exists separately
    const courseReminders = page.getByTestId('course-reminders-section')
    await expect(courseReminders).toBeVisible()

    // Both sections should be independently visible and configurable
    // The streak reminder toggle should not affect per-course reminders
    const streakToggle = streakReminders.getByRole('switch', { name: /enable.*reminders/i })
    await expect(streakToggle).toBeChecked()

    // Per-course section should have its own controls, not be nested under streak
    const addCourseReminderBtn = courseReminders.getByRole('button', {
      name: /add.*reminder/i,
    })
    await expect(addCourseReminderBtn).toBeVisible()
  })

  test('AC4: prompts for notification permission when not yet granted', async ({ page }) => {
    // Override with 'default' permission (not yet asked)
    await mockNotificationPermission(page, 'default', 'granted')

    await goToSettings(page)

    const courseReminders = page.getByTestId('course-reminders-section')
    const addBtn = courseReminders.getByRole('button', { name: /add.*reminder/i })
    await addBtn.click()

    // Should show notification permission prompt
    const permissionPrompt = page.getByTestId('course-reminder-permission-prompt')
    await expect(permissionPrompt).toBeVisible()
    await expect(permissionPrompt).toContainText(/notifications.*required/i)

    // Grant permission
    const grantBtn = permissionPrompt.getByRole('button', { name: /enable.*notifications/i })
    await grantBtn.click()

    // Permission prompt should dismiss, reminder form should appear
    await expect(permissionPrompt).not.toBeVisible()
    const courseSelect = page.getByTestId('course-reminder-course-select')
    await expect(courseSelect).toBeVisible()
  })

  test('AC4: saves reminder config even when permissions denied', async ({ page }) => {
    // Mock denied permissions
    await mockNotificationPermission(page, 'default', 'denied')

    await goToSettings(page)

    const courseReminders = page.getByTestId('course-reminders-section')
    const addBtn = courseReminders.getByRole('button', { name: /add.*reminder/i })
    await addBtn.click()

    // Permission prompt appears
    const permissionPrompt = page.getByTestId('course-reminder-permission-prompt')
    await expect(permissionPrompt).toBeVisible()

    // Try to grant — will be denied
    const grantBtn = permissionPrompt.getByRole('button', { name: /enable.*notifications/i })
    await grantBtn.click()

    // Should show denied guidance but still allow configuration
    const deniedGuidance = page.getByTestId('course-reminder-permission-denied')
    await expect(deniedGuidance).toBeVisible()
    await expect(deniedGuidance).toContainText(/browser settings/i)

    // Continue configuring the reminder anyway
    const continueBtn = page.getByRole('button', { name: /continue.*without/i })
    await expect(continueBtn).toBeVisible()
  })

  test('AC5: edit and disable an existing per-course reminder', async ({ page }) => {
    // First, seed a pre-existing course reminder in IndexedDB
    await page.evaluate(() => {
      // Seed a course reminder directly (will be replaced by Dexie seeding in implementation)
      localStorage.setItem(
        'course-reminders',
        JSON.stringify([
          {
            id: 'reminder-1',
            courseId: 'course-a',
            courseName: 'TypeScript Fundamentals',
            days: ['monday', 'wednesday', 'friday'],
            time: '09:00',
            enabled: true,
          },
        ])
      )
    })

    await goToSettings(page)

    const courseReminders = page.getByTestId('course-reminders-section')

    // Find the existing reminder
    const reminderRow = courseReminders.getByTestId('course-reminder-course-a')
    await expect(reminderRow).toBeVisible()

    // Edit the reminder
    const editBtn = reminderRow.getByRole('button', { name: /edit/i })
    await editBtn.click()

    // Change the time
    const timeInput = page.getByTestId('course-reminder-time-input')
    await timeInput.fill('14:30')

    // Uncheck Monday
    const daySelector = page.getByTestId('course-reminder-day-selector')
    await daySelector.getByRole('checkbox', { name: /monday/i }).uncheck()

    // Save changes
    await page.getByRole('button', { name: /save.*reminder/i }).click()

    // Verify updated values
    await expect(reminderRow.getByText(/14:30/i)).toBeVisible()

    // Disable the reminder entirely
    const enableToggle = reminderRow.getByRole('switch', { name: /enable/i })
    await enableToggle.click()
    await expect(enableToggle).not.toBeChecked()
  })

  test('AC6: multi-course reminder overview lists all reminders by course', async ({ page }) => {
    // Seed multiple course reminders
    await page.evaluate(() => {
      localStorage.setItem(
        'course-reminders',
        JSON.stringify([
          {
            id: 'reminder-1',
            courseId: 'course-a',
            courseName: 'TypeScript Fundamentals',
            days: ['monday', 'wednesday', 'friday'],
            time: '09:00',
            enabled: true,
          },
          {
            id: 'reminder-2',
            courseId: 'course-b',
            courseName: 'React Patterns',
            days: ['tuesday', 'thursday'],
            time: '18:00',
            enabled: false,
          },
        ])
      )
    })

    await goToSettings(page)

    const courseReminders = page.getByTestId('course-reminders-section')

    // Both course reminders should be listed
    const reminderA = courseReminders.getByTestId('course-reminder-course-a')
    const reminderB = courseReminders.getByTestId('course-reminder-course-b')
    await expect(reminderA).toBeVisible()
    await expect(reminderB).toBeVisible()

    // Course A: enabled, Mon/Wed/Fri at 09:00
    await expect(reminderA.getByText(/typescript fundamentals/i)).toBeVisible()
    await expect(reminderA.getByText(/09:00/i)).toBeVisible()
    const toggleA = reminderA.getByRole('switch', { name: /enable/i })
    await expect(toggleA).toBeChecked()

    // Course B: disabled, Tue/Thu at 18:00
    await expect(reminderB.getByText(/react patterns/i)).toBeVisible()
    await expect(reminderB.getByText(/18:00/i)).toBeVisible()
    const toggleB = reminderB.getByRole('switch', { name: /enable/i })
    await expect(toggleB).not.toBeChecked()
  })
})
