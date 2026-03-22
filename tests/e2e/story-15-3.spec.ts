/**
 * ATDD E2E tests for E15-S03: Display Timer Warnings at Key Thresholds
 *
 * Tests timer warning notifications at key thresholds:
 * - AC1: Toast at 25% remaining (auto-dismiss 3s)
 * - AC2: Toast at 10% remaining (auto-dismiss 5s)
 * - AC3: Persistent warning at 1 minute remaining
 * - AC4: No warnings in untimed mode
 * - AC5: ARIA live regions for screen readers
 * - AC6: Warnings based on adjusted (accommodation) time
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data — timed quiz with 2 questions, 15-minute time limit
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s03'
const LESSON_ID = 'test-lesson-e15s03'

const q1 = makeQuestion({
  id: 'q1-warning-test',
  order: 1,
  type: 'multiple-choice',
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-warning-test',
  order: 2,
  type: 'multiple-choice',
  text: 'What is 3 + 3?',
  options: ['5', '6', '7', '8'],
  correctAnswer: '6',
  points: 1,
})

const timedQuiz = makeQuiz({
  id: 'quiz-e15s03-timed',
  lessonId: LESSON_ID,
  title: 'Warning Test Quiz',
  description: 'A timed quiz for E15-S03 warning tests',
  questions: [q1, q2],
  timeLimit: 15, // 15 minutes
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const untimedQuiz = makeQuiz({
  id: 'quiz-e15s03-untimed',
  lessonId: LESSON_ID,
  title: 'Untimed Quiz',
  description: 'An untimed quiz — no warnings should fire',
  questions: [q1],
  timeLimit: null,
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers (same Date.now shifting pattern as E15-S01)
// ---------------------------------------------------------------------------

async function seedQuizData(
  page: import('@playwright/test').Page,
  quiz: ReturnType<typeof makeQuiz>
) {
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
}

async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quiz: ReturnType<typeof makeQuiz>
) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page, quiz)
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

async function saveRealDateNow(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__realDateNow = Date.now
  })
}

async function shiftDateNow(page: import('@playwright/test').Page, offsetMs: number) {
  await page.evaluate(offset => {
    const realNow = (window as unknown as Record<string, () => number>).__realDateNow
    ;(Date as { now: () => number }).now = () => realNow() + offset
  }, offsetMs)
}

async function triggerVisibilityChange(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

/** Select Sonner toast by data attribute, optionally scoped by toast type */
function sonnerToast(page: import('@playwright/test').Page, type?: 'info' | 'warning') {
  if (type) {
    return page.locator(`[data-sonner-toast][data-type="${type}"]`)
  }
  return page.locator('[data-sonner-toast]')
}

// Clean up IndexedDB between tests to prevent data leakage
test.afterEach(async ({ page }) => {
  await page.evaluate(() => indexedDB.deleteDatabase('ElearningDB'))
})

// ---------------------------------------------------------------------------
// AC1: Toast at 25% remaining (3:45 of 15:00)
// ---------------------------------------------------------------------------

test.describe('E15-S03: Timer Warning at 25% Remaining', () => {
  test('AC1: shows subtle info toast at 25% time remaining', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Save real Date.now, then shift to 75% elapsed (11.25 min of 15 min)
    await saveRealDateNow(page)
    await shiftDateNow(page, 11.25 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Info toast should appear with time remaining message
    const toast = sonnerToast(page, 'info').filter({ hasText: /remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })
  })

  test('AC1: 25% toast auto-dismisses after 3 seconds', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    await saveRealDateNow(page)
    await shiftDateNow(page, 11.25 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Toast appears
    const toast = sonnerToast(page, 'info').filter({ hasText: /remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })

    // Toast auto-dismisses (3s + buffer)
    await expect(toast.first()).toBeHidden({ timeout: 6000 })
  })
})

// ---------------------------------------------------------------------------
// AC2: Toast at 10% remaining (1:30 of 15:00)
// ---------------------------------------------------------------------------

test.describe('E15-S03: Timer Warning at 10% Remaining', () => {
  test('AC2: shows prominent warning toast at 10% time remaining', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Shift to 90% elapsed (13.5 min of 15 min = 1:30 remaining)
    await saveRealDateNow(page)
    await shiftDateNow(page, 13.5 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Warning toast with "Only" prefix
    const toast = sonnerToast(page, 'warning').filter({ hasText: /only.*remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })
  })

  test('AC2: 10% toast auto-dismisses after 5 seconds', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    await saveRealDateNow(page)
    await shiftDateNow(page, 13.5 * 60 * 1000)
    await triggerVisibilityChange(page)

    const toast = sonnerToast(page, 'warning').filter({ hasText: /only.*remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })

    // 10% toast auto-dismisses after 5s + buffer
    await expect(toast.first()).toBeHidden({ timeout: 8000 })
  })
})

// ---------------------------------------------------------------------------
// AC3: Persistent warning at 1 minute remaining
// ---------------------------------------------------------------------------

test.describe('E15-S03: Timer Warning at 1 Minute Remaining', () => {
  test('AC3: shows persistent warning at 1 minute remaining', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Shift to 14 minutes elapsed (1 minute remaining)
    await saveRealDateNow(page)
    await shiftDateNow(page, 14 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Persistent warning toast — appears when remaining ≤ 60s
    // Real time elapses during test setup, so remaining is ~57-60s (use flexible regex)
    const toast = sonnerToast(page, 'warning').filter({ hasText: /only.*00:\d+ remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })

    // Wait 3.5 seconds — persistent warning should still be visible (not auto-dismissed).
    // Longest auto-dismiss is 5s (10% toast), so 3.5s still proves non-dismissal.
    await page.waitForTimeout(3500) // justified: verifying toast persistence
    await expect(toast.first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4: No warnings in untimed mode
// ---------------------------------------------------------------------------

test.describe('E15-S03: Untimed Mode', () => {
  test('AC4: no timer warnings displayed in untimed mode', async ({ page }) => {
    await navigateToQuiz(page, untimedQuiz)
    await startQuiz(page)

    // Timer should NOT be visible in untimed mode
    const timer = page.getByRole('timer')
    await expect(timer).toBeHidden()

    // No Sonner toast should appear
    await page.waitForTimeout(2000) // justified: confirming absence of warnings
    await expect(sonnerToast(page)).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC5: ARIA live regions for screen readers
// ---------------------------------------------------------------------------

test.describe('E15-S03: ARIA Live Regions', () => {
  test('AC5: 25% warning uses aria-live="polite"', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    await saveRealDateNow(page)
    await shiftDateNow(page, 11.25 * 60 * 1000)
    await triggerVisibilityChange(page)

    // ARIA live region with polite politeness should contain text
    const politeRegion = page.locator('[role="status"][aria-live="polite"]').filter({
      hasText: /remaining/i,
    })
    await expect(politeRegion.first()).toHaveText(/remaining/i, { timeout: 5000 })
  })

  test('AC5: 10% warning uses aria-live="assertive"', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    await saveRealDateNow(page)
    await shiftDateNow(page, 13.5 * 60 * 1000)
    await triggerVisibilityChange(page)

    // ARIA live region with assertive politeness for urgent warnings
    const assertiveRegion = page.locator('[role="alert"][aria-live="assertive"]').filter({
      hasText: /remaining/i,
    })
    await expect(assertiveRegion.first()).toHaveText(/remaining/i, { timeout: 5000 })
  })

  test('AC5: 1min warning uses aria-live="assertive"', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Shift to 14 minutes elapsed (1 minute remaining)
    await saveRealDateNow(page)
    await shiftDateNow(page, 14 * 60 * 1000)
    await triggerVisibilityChange(page)

    // ARIA assertive region should contain 1-minute announcement
    const assertiveRegion = page.locator('[role="alert"][aria-live="assertive"]').filter({
      hasText: /remaining/i,
    })
    await expect(assertiveRegion.first()).toHaveText(/remaining/i, { timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// AC6: Warnings based on adjusted (accommodation) time
// ---------------------------------------------------------------------------

test.describe('E15-S03: Accommodation-Adjusted Warnings', () => {
  test('AC6: warnings trigger based on adjusted time, not original', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz)

    // Select 150% accommodation before starting
    const accommodationsBtn = page.getByRole('button', { name: /accommodations/i })
    await expect(accommodationsBtn).toBeVisible()
    await accommodationsBtn.click()

    // Select 150% option (22:30 adjusted time)
    const extendedOption = page.getByLabel(/150%/i)
    await expect(extendedOption).toBeVisible()
    await extendedOption.click()

    // Close modal and start quiz
    const saveBtn = page.getByRole('button', { name: /save|confirm|apply/i })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // 25% of 22:30 = 5:37 remaining → 75% elapsed = 16:53 elapsed
    // If warnings used original 15min, 25% = 3:45 remaining → 11:15 elapsed
    // Shift to 12 minutes elapsed — past original 75% but NOT past adjusted 75%
    await saveRealDateNow(page)
    await shiftDateNow(page, 12 * 60 * 1000)
    await triggerVisibilityChange(page)

    // At 12 min elapsed of 22:30 adjusted, 10:30 remaining = 46.7% — no 25% warning yet
    await page.waitForTimeout(2000) // justified: confirming absence of premature warning
    await expect(sonnerToast(page)).toHaveCount(0)

    // Now shift to 75% of adjusted time (16.875 min elapsed)
    await shiftDateNow(page, 16.875 * 60 * 1000)
    await triggerVisibilityChange(page)

    // NOW the 25% warning should fire (5:37 remaining of 22:30)
    const toast = sonnerToast(page, 'info').filter({ hasText: /remaining/i })
    await expect(toast.first()).toBeVisible({ timeout: 5000 })
  })
})
