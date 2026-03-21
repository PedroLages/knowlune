/**
 * ATDD E2E tests for E15-S01: Display Countdown Timer with Accuracy
 *
 * Tests countdown timer during timed quizzes:
 * - AC1: Timer displays in MM:SS format and counts down every second
 * - AC2: Timer stays accurate after tab switch (no setInterval drift)
 * - AC3: Color transitions at 25% (amber) and 10% (red) thresholds
 * - AC4: Auto-submit on expiry with "Time's up!" message
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

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

    // Wait ~3 seconds and verify timer has decreased
    await page.waitForTimeout(3500)

    const laterText = await timer.textContent()
    expect(laterText).not.toBe(initialText)

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

    // Simulate tab becoming hidden then visible after ~5 seconds
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(5000)

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Allow one tick for state update
    await page.waitForTimeout(1200)

    const afterSwitchText = await timer.textContent()
    const afterSwitchSeconds = parseTime(afterSwitchText)

    // Timer should have decreased by approximately 6-7 seconds (5s hidden + overhead)
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
    // Use a very short quiz to test color transitions via clock manipulation
    // We'll use page.clock to fast-forward time
    await navigateToQuiz(page, timedQuiz.id)
    await startQuiz(page)

    const timer = page.getByRole('timer')

    // Initially, timer should have default text color (not amber, not red)
    await expect(timer).toBeVisible()

    // Fast-forward clock to ~25% remaining (11.25 min elapsed of 15 min = 3:45 remaining)
    // We manipulate Date.now() to simulate elapsed time
    await page.evaluate(() => {
      const offset = 11.25 * 60 * 1000 // 11.25 minutes in ms
      const originalNow = Date.now
      ;(Date as { now: () => number }).now = () => originalNow() + offset
    })

    // Trigger visibility change to force recalculation
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(1200)

    // Timer should have warning (amber) color — check for text-warning class
    await expect(timer).toHaveClass(/warning/)

    // Fast-forward to ~10% remaining (13.5 min elapsed of 15 min = 1:30 remaining)
    await page.evaluate(() => {
      const offset = 13.5 * 60 * 1000
      const originalNow = Date.now
      ;(Date as { now: () => number }).now = () => originalNow() + offset
    })

    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(1200)

    // Timer should have urgent (red) color — check for text-destructive class
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

    // Fast-forward past the 1-minute time limit
    await page.evaluate(() => {
      const offset = 61 * 1000 // 61 seconds — past the 1-minute limit
      const originalNow = Date.now
      ;(Date as { now: () => number }).now = () => originalNow() + offset
    })

    // Trigger visibility change to force recalculation
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Wait for expiry handling
    await page.waitForTimeout(2000)

    // Should see "Time's up!" message
    await expect(page.getByText(/time'?s up/i)).toBeVisible()

    // Quiz should be auto-submitted — score/results should be visible
    await expect(page.getByText(/submitted/i).or(page.getByText(/score/i))).toBeVisible()
  })

  test('AC4: unanswered questions score 0 points on auto-submit', async ({ page }) => {
    await navigateToQuiz(page, shortTimedQuiz.id)
    await startQuiz(page)

    // Don't answer any questions — let timer expire
    await page.evaluate(() => {
      const offset = 61 * 1000
      const originalNow = Date.now
      ;(Date as { now: () => number }).now = () => originalNow() + offset
    })

    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(2000)

    // Score should be 0% since no questions were answered
    await expect(page.getByText(/0%/).or(page.getByText(/0 of/i))).toBeVisible()
  })
})
