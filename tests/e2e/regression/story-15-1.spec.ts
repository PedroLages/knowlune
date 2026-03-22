/**
 * ATDD E2E tests for E15-S01: Display Countdown Timer with Accuracy
 *
 * Tests countdown timer during timed quizzes:
 * - AC1: Timer displays in MM:SS format and counts down every second
 * - AC2: Timer stays accurate after tab switch (no setInterval drift)
 * - AC3: Color transitions at 25% (amber) and 10% (red) thresholds
 * - AC4: Auto-submit on expiry with "Time's up!" message
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'

// ---------------------------------------------------------------------------
// Test data — timed quiz with 2 questions, 15-minute time limit
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s01'
const LESSON_ID = 'test-lesson-e15s01'

const q1 = makeQuestion({
  id: 'q1-timer-test',
  order: 1,
  type: 'multiple-choice',
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-timer-test',
  order: 2,
  type: 'multiple-choice',
  text: 'What is 3 + 3?',
  options: ['5', '6', '7', '8'],
  correctAnswer: '6',
  points: 1,
})

const timedQuiz = makeQuiz({
  id: 'quiz-e15s01-timed',
  lessonId: LESSON_ID,
  title: 'Timed Quiz',
  description: 'A timed quiz for E15-S01 timer tests',
  questions: [q1, q2],
  timeLimit: 15, // 15 minutes
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// Short timer quiz for expiry testing (1 minute)
const shortTimedQuiz = makeQuiz({
  id: 'quiz-e15s01-short',
  lessonId: LESSON_ID,
  title: 'Short Timed Quiz',
  description: 'A short timed quiz for expiry testing',
  questions: [q1],
  timeLimit: 1, // 1 minute — short enough to test expiry
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedQuizData(
  page: import('@playwright/test').Page,
  quiz: ReturnType<typeof makeQuiz>
) {
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
}

async function navigateToQuiz(page: import('@playwright/test').Page, quizId: string) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page, quizId === shortTimedQuiz.id ? shortTimedQuiz : timedQuiz)
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

/**
 * Save the real Date.now reference before any overrides.
 * Call after page load but before shiftDateNow() — captures the
 * un-shifted Date.now so subsequent shifts use absolute offsets.
 */
async function saveRealDateNow(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__realDateNow = Date.now
  })
}

/**
 * Override Date.now() to shift time forward by the given offset.
 * Uses the saved real Date.now reference to avoid stacking offsets.
 */
async function shiftDateNow(page: import('@playwright/test').Page, offsetMs: number) {
  await page.evaluate(offset => {
    const realNow = (window as unknown as Record<string, () => number>).__realDateNow
    ;(Date as { now: () => number }).now = () => realNow() + offset
  }, offsetMs)
}

/**
 * Trigger visibilitychange event to force timer recalculation.
 */
async function triggerVisibilityChange(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

// Clean up IndexedDB between tests to prevent data leakage
test.afterEach(async ({ page }) => {
  await page.evaluate(() => indexedDB.deleteDatabase('ElearningDB'))
})

// ---------------------------------------------------------------------------
// AC1: Timer displays in MM:SS format and counts down
// ---------------------------------------------------------------------------

test.describe('E15-S01: Countdown Timer Display', () => {
  test('AC1: shows countdown timer in MM:SS format when quiz starts', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    // Timer should be visible with role="timer"
    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Should display initial time in MM:SS format (15:00 or close to it)
    await expect(timer).toHaveText(/^\d{1,2}:\d{2}$/)

    // Timer should show approximately 15:00 at start
    const timerText = await timer.textContent()
    expect(timerText).toMatch(/^1[45]:\d{2}$/) // 14:59 or 15:00
  })

  test('AC1: timer counts down every second', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    const initialText = await timer.textContent()

    // Poll until timer text changes (auto-retries for up to 5s)
    await expect
      .poll(() => timer.textContent(), { timeout: 5000, message: 'Timer should count down' })
      .not.toBe(initialText)

    const laterText = await timer.textContent()

    // Parse times and verify decrease
    const parseTime = (t: string | null) => {
      if (!t) return 0
      const [min, sec] = t.split(':').map(Number)
      return min * 60 + sec
    }

    const initialSeconds = parseTime(initialText)
    const laterSeconds = parseTime(laterText)
    expect(initialSeconds - laterSeconds).toBeGreaterThanOrEqual(2)
    expect(initialSeconds - laterSeconds).toBeLessThanOrEqual(5)
  })

  test('AC1: timer has accessible role and label', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()
    await expect(timer).toHaveAttribute('aria-label', /time remaining/i)
  })
})

// ---------------------------------------------------------------------------
// AC2: Timer accuracy after tab switch (no setInterval drift)
// ---------------------------------------------------------------------------

test.describe('E15-S01: Timer Accuracy', () => {
  test('AC2: timer reflects actual elapsed time after tab switch', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    const initialText = await timer.textContent()

    const parseTime = (t: string | null) => {
      if (!t) return 0
      const [min, sec] = t.split(':').map(Number)
      return min * 60 + sec
    }

    const initialSeconds = parseTime(initialText)

    // Save real Date.now, then shift forward 7 seconds to simulate tab-away
    await saveRealDateNow(page)
    await shiftDateNow(page, 7000)

    // Simulate tab hidden → visible cycle to trigger timer recalculation
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Wait for timer to reflect the shifted time (auto-retries)
    await expect
      .poll(() => timer.textContent().then(t => parseTime(t)), {
        timeout: 5000,
        message: 'Timer should reflect elapsed time after tab switch',
      })
      .toBeLessThanOrEqual(initialSeconds - 5)

    const afterSwitchText = await timer.textContent()
    const afterSwitchSeconds = parseTime(afterSwitchText)

    // Timer should have decreased by approximately 7 seconds
    const elapsed = initialSeconds - afterSwitchSeconds
    expect(elapsed).toBeGreaterThanOrEqual(5)
    expect(elapsed).toBeLessThanOrEqual(10)
  })
})

// ---------------------------------------------------------------------------
// AC3: Color transitions at warning thresholds
// ---------------------------------------------------------------------------

test.describe('E15-S01: Timer Color Transitions', () => {
  test('AC3: timer shows amber at 25% and red at 10% remaining', async ({ page }) => {
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Save real Date.now before any overrides
    await saveRealDateNow(page)

    // Fast-forward clock to ~25% remaining (11.25 min elapsed of 15 min = 3:45 remaining)
    await shiftDateNow(page, 11.25 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Timer should have warning (amber) color — expect auto-retries until class appears
    await expect(timer).toHaveClass(/warning/)

    // Fast-forward to ~10% remaining (13.5 min elapsed of 15 min = 1:30 remaining)
    // Uses same real Date.now reference — no stacking
    await shiftDateNow(page, 13.5 * 60 * 1000)
    await triggerVisibilityChange(page)

    // Timer should have urgent (red) color — expect auto-retries until class appears
    await expect(timer).toHaveClass(/destructive/)
  })
})

// ---------------------------------------------------------------------------
// AC4: Auto-submit on timer expiry
// ---------------------------------------------------------------------------

test.describe('E15-S01: Timer Expiry', () => {
  test('AC4: quiz auto-submits when timer reaches zero', async ({ page }) => {
    await navigateToQuiz(page, shortTimedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Save real Date.now then fast-forward past the 1-minute limit
    await saveRealDateNow(page)
    await shiftDateNow(page, 61 * 1000)
    await triggerVisibilityChange(page)

    // Should see "Time's up!" toast message (auto-retries until visible)
    await expect(page.getByText(/time'?s up/i)).toBeVisible()

    // Quiz should be auto-submitted — results page heading visible
    await expect(page.getByRole('heading', { name: /results/i })).toBeVisible()
  })

  test('AC4: unanswered questions score 0 points on auto-submit', async ({ page }) => {
    await navigateToQuiz(page, shortTimedQuiz.id)
    await startQuiz(page)

    // Wait for timer to initialize before overriding Date.now
    // Otherwise the hook captures the shifted time and the offset is nullified
    const timer = page.getByRole('timer')
    await expect(timer).toBeVisible()

    // Don't answer any questions — let timer expire
    await saveRealDateNow(page)
    await shiftDateNow(page, 61 * 1000)
    await triggerVisibilityChange(page)

    // Should land on results page (auto-retries until visible)
    await expect(page.getByRole('heading', { name: /results/i })).toBeVisible()

    // Score should be 0% — verify via the visible score paragraph
    // (exclude the sr-only element which also contains this text)
    await expect(page.locator('p').filter({ hasText: '0 of 1 correct' })).toBeVisible()
  })
})
