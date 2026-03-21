/**
 * E11-S06: Per-Course Study Reminders — ATDD Tests
 *
 * Verifies:
 *   - AC1: Configure per-course reminder with day/time selection
 *   - AC3: Independence from streak reminders
 *   - AC4: Notification permission prompt and graceful handling
 *   - AC5: Edit and disable reminders
 *   - AC6: Multi-course reminder overview
 */
import { test, expect } from '../../support/fixtures'
import { goToSettings } from '../../support/helpers/navigation'
import {
  seedImportedCourses,
  seedIndexedDBStore,
  clearIndexedDBStore,
} from '../../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../../utils/test-time'

/**
 * Helper: create an ImportedCourse record for seeding.
 */
function createImportedCourse(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? 'course-test'
  return {
    id,
    name: overrides.name ?? `Test Course ${id}`,
    importedAt: FIXED_DATE,
    category: 'technology',
    tags: ['test'],
    status: 'active',
    videoCount: 5,
    pdfCount: 1,
    ...overrides,
  }
}

/**
 * Helper: seed two courses into IndexedDB for multi-course tests.
 */
async function seedTwoCourses(page: import('@playwright/test').Page) {
  const courseA = createImportedCourse({
    id: 'course-a',
    name: 'TypeScript Fundamentals',
  })
  const courseB = createImportedCourse({
    id: 'course-b',
    name: 'React Patterns',
  })
  await seedImportedCourses(page, [courseA, courseB])
}

/**
 * Helper: seed course reminders into IndexedDB (courseReminders store).
 */
async function seedCourseReminders(
  page: import('@playwright/test').Page,
  reminders: Record<string, unknown>[]
) {
  await seedIndexedDBStore(page, 'ElearningDB', 'courseReminders', reminders)
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
    await clearIndexedDBStore(page, 'ElearningDB', 'courseReminders')
    await seedTwoCourses(page)
    await page.reload()
    await page.waitForLoadState('load')
  })

  test('AC1: configure per-course reminder with day and time selection', async ({ page }) => {
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

    // Select days of the week (pill toggles — use click, not check)
    const daySelector = page.getByTestId('course-reminder-day-selector')
    await expect(daySelector).toBeVisible()
    await daySelector.getByRole('checkbox', { name: /monday/i }).click()
    await daySelector.getByRole('checkbox', { name: /wednesday/i }).click()
    await daySelector.getByRole('checkbox', { name: /friday/i }).click()

    // Set a time
    const timeInput = page.getByTestId('course-reminder-time-input')
    await expect(timeInput).toBeVisible()
    await timeInput.fill('09:00')

    // Save the reminder
    const saveBtn = page.getByRole('button', { name: /save.*reminder/i })
    await saveBtn.click()

    // Verify the reminder appears in the list
    const reminderItem = courseRemindersSection.getByText(/typescript fundamentals/i)
    await expect(reminderItem).toBeVisible()
    await expect(courseRemindersSection.getByText(/mon.*wed.*fri/i)).toBeVisible()
    await expect(courseRemindersSection.getByText(/09:00/i)).toBeVisible()

    // Verify persistence survives page reload (Dexie round-trip)
    await page.reload()
    await page.waitForLoadState('load')
    await goToSettings(page)
    const reloadedSection = page.getByTestId('course-reminders-section')
    await expect(reloadedSection.getByText(/typescript fundamentals/i)).toBeVisible()
    await expect(reloadedSection.getByText(/mon.*wed.*fri/i)).toBeVisible()
    await expect(reloadedSection.getByText(/09:00/i)).toBeVisible()
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
    const streakToggle = streakReminders.getByRole('switch', { name: /enable.*reminders/i })
    await expect(streakToggle).toBeChecked()

    // Per-course section should have its own controls
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

    // Continue configuring the reminder anyway (AC4: save regardless)
    const continueBtn = page.getByRole('button', { name: /continue.*without/i })
    await expect(continueBtn).toBeVisible()
    await continueBtn.click()

    // Fill out and save a reminder despite denied permissions
    const courseSelect = page.getByTestId('course-reminder-course-select')
    await expect(courseSelect).toBeVisible()
    await courseSelect.click()
    await page.getByRole('option', { name: /typescript fundamentals/i }).click()

    const daySelector = page.getByTestId('course-reminder-day-selector')
    await daySelector.getByRole('checkbox', { name: /tuesday/i }).click()
    await daySelector.getByRole('checkbox', { name: /thursday/i }).click()

    const timeInput = page.getByTestId('course-reminder-time-input')
    await timeInput.fill('10:00')

    await page.getByRole('button', { name: /save.*reminder/i }).click()

    // Verify the reminder was persisted despite permission denial
    const courseRemindersAfter = page.getByTestId('course-reminders-section')
    await expect(courseRemindersAfter.getByText(/typescript fundamentals/i)).toBeVisible()
    await expect(courseRemindersAfter.getByText(/10:00/i)).toBeVisible()
  })

  test('AC5: edit and disable an existing per-course reminder', async ({ page }) => {
    // Seed a pre-existing course reminder in IndexedDB
    await seedCourseReminders(page, [
      {
        id: 'reminder-1',
        courseId: 'course-a',
        courseName: 'TypeScript Fundamentals',
        days: ['monday', 'wednesday', 'friday'],
        time: '09:00',
        enabled: true,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])
    await page.reload()
    await page.waitForLoadState('load')

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

    // Uncheck Monday (click to toggle off)
    const daySelector = page.getByTestId('course-reminder-day-selector')
    await daySelector.getByRole('checkbox', { name: /monday/i }).click()

    // Save changes
    await page.getByRole('button', { name: /save.*reminder/i }).click()

    // Verify updated values
    await expect(reminderRow.getByText(/14:30/i)).toBeVisible()
    // Monday should no longer appear in schedule summary
    await expect(reminderRow.getByText(/wed.*fri/i)).toBeVisible()

    // Disable the reminder entirely
    const enableToggle = reminderRow.getByRole('switch', { name: /enable/i })
    await enableToggle.click()
    await expect(enableToggle).not.toBeChecked()
  })

  test('AC6: multi-course reminder overview lists all reminders by course', async ({ page }) => {
    // Seed multiple course reminders in IndexedDB
    await seedCourseReminders(page, [
      {
        id: 'reminder-1',
        courseId: 'course-a',
        courseName: 'TypeScript Fundamentals',
        days: ['monday', 'wednesday', 'friday'],
        time: '09:00',
        enabled: true,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: 'reminder-2',
        courseId: 'course-b',
        courseName: 'React Patterns',
        days: ['tuesday', 'thursday'],
        time: '18:00',
        enabled: false,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ])
    await page.reload()
    await page.waitForLoadState('load')

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
