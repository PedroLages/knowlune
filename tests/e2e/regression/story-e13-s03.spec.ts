/**
 * ATDD E2E tests for E13-S03: Pause and Resume Quiz
 *
 * Tests auto-save and resume flow:
 * - Quiz progress auto-saves to per-quiz localStorage key on every answer
 * - "Resume Quiz" button appears with answer count when per-quiz progress
 *   exists but Zustand store is empty (simulating browser restart)
 * - Clicking Resume restores exact question and all answers
 * - Within same session, quiz auto-resumes directly (Zustand rehydration)
 * - Completed quizzes do NOT show resume option
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion, makeProgress } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s03'
const LESSON_ID = 'test-lesson-e13s03'
const QUIZ_ID = 'quiz-e13s03'

const q1 = makeQuestion({
  id: 'q1-e13s03',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e13s03',
  order: 2,
  text: 'What color is the sky?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: 'Blue',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-e13s03',
  order: 3,
  text: 'How many sides does a triangle have?',
  options: ['2', '3', '4', '5'],
  correctAnswer: '3',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Pause Resume Test Quiz',
  description: 'A 3-question quiz for E13-S03 testing',
  questions: [q1, q2, q3],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToQuiz(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

/** Seed per-quiz localStorage with saved progress, simulating a browser restart
 *  where Zustand store is empty but per-quiz backup survived. */
async function seedSavedProgress(
  page: import('@playwright/test').Page,
  progress: ReturnType<typeof makeProgress>
) {
  await page.addInitScript(
    ({ quizId, progressData }) => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
      localStorage.setItem(`quiz-progress-${quizId}`, JSON.stringify(progressData))
      // Ensure Zustand store is empty (simulates browser restart)
      localStorage.removeItem('levelup-quiz-store')
    },
    { quizId: QUIZ_ID, progressData: progress }
  )
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /next/i }).click()
}

async function answerQuestion(page: import('@playwright/test').Page, optionText: string) {
  await page.getByRole('radio', { name: optionText }).click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E13-S03: Pause and Resume Quiz', () => {
  // Clean up quiz-specific localStorage keys to prevent state bleeding between tests
  test.afterEach(async ({ page }) => {
    await page.evaluate(quizId => {
      localStorage.removeItem(`quiz-progress-${quizId}`)
      localStorage.removeItem('levelup-quiz-store')
    }, QUIZ_ID)
  })

  test('AC1: quiz progress auto-saves to per-quiz localStorage on every answer', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await answerQuestion(page, '4')

    // Verify per-quiz localStorage was written by the subscribe listener
    const progressRaw = await page.evaluate(
      (quizId: string) => localStorage.getItem(`quiz-progress-${quizId}`),
      QUIZ_ID
    )
    expect(progressRaw).not.toBeNull()
    const progress = JSON.parse(progressRaw!)
    expect(progress.quizId).toBe(QUIZ_ID)
    expect(progress.answers['q1-e13s03']).toBe('4')

    // Answer Q2 and verify update
    await clickNext(page)
    await answerQuestion(page, 'Blue')

    const progressRaw2 = await page.evaluate(
      (quizId: string) => localStorage.getItem(`quiz-progress-${quizId}`),
      QUIZ_ID
    )
    const progress2 = JSON.parse(progressRaw2!)
    expect(progress2.answers['q2-e13s03']).toBe('Blue')
    expect(Object.keys(progress2.answers)).toHaveLength(2)
  })

  test('AC1+AC3: navigating away preserves progress via auto-save (same session)', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1 and Q2, advance to Q3
    await answerQuestion(page, '4')
    await clickNext(page)
    await answerQuestion(page, 'Blue')
    await clickNext(page)

    // Navigate away (Quiz component unmounts, Zustand persist saves)
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Return to quiz — Zustand rehydrates, quiz auto-resumes at Q3
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should be on Q3 (auto-resumed, no start screen)
    await expect(page.getByText(/how many sides/i)).toBeVisible()

    // Navigate back to Q1 — answer should be restored
    await page.getByRole('button', { name: /previous/i }).click()
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByRole('radio', { name: '4' })).toBeChecked()
  })

  test('AC2: Resume button appears when per-quiz progress exists (new session)', async ({
    page,
  }) => {
    // Simulate browser restart: seed per-quiz localStorage with progress,
    // but no Zustand store state (cleared in seedSavedProgress)
    const savedProgress = makeProgress(QUIZ_ID, {
      currentQuestionIndex: 2,
      answers: { 'q1-e13s03': '4', 'q2-e13s03': 'Blue' },
      questionOrder: [q1.id, q2.id, q3.id],
    })
    await seedSavedProgress(page, savedProgress)

    // Navigate to quiz
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz])
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should see Resume button with answer count
    const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
    await expect(resumeBtn).toBeVisible()
    await expect(resumeBtn).toContainText(/2 of 3 answered/i)

    // Click Resume — should load at Q3 (currentQuestionIndex: 2)
    await resumeBtn.click()
    await expect(page.getByText(/how many sides/i)).toBeVisible()

    // Navigate back to Q1 — answer should be restored
    await page.getByRole('button', { name: /previous/i }).click()
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByRole('radio', { name: '4' })).toBeChecked()
  })

  test('AC5: completed quiz does NOT show Resume button', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer all questions
    await answerQuestion(page, '4')
    await clickNext(page)
    await answerQuestion(page, 'Blue')
    await clickNext(page)
    await answerQuestion(page, '3')

    // Submit quiz — all questions answered, no marked-for-review, so dialog should NOT appear
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Assert the confirmation dialog was NOT triggered (direct submit path)
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Wait for results page (navigation happens after successful submit)
    await page.waitForURL(/\/quiz\/results/, { timeout: 10000 })

    // Navigate back to quiz URL
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Should NOT see Resume button
    await expect(page.getByRole('button', { name: /resume quiz/i })).not.toBeVisible()

    // Should see Start Quiz
    await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible()
  })

  test('AC4: timed quiz timer state preserved across navigation', async ({ page }) => {
    // Create a timed quiz (10 minutes = 600 seconds)
    const timedQuiz = makeQuiz({
      id: QUIZ_ID,
      lessonId: LESSON_ID,
      title: 'Timed Pause Resume Quiz',
      description: 'A timed quiz for AC4 timer restoration testing',
      questions: [q1, q2, q3],
      passingScore: 70,
      allowRetakes: true,
      shuffleQuestions: false,
      shuffleAnswers: false,
      timeLimit: 10, // 10 minutes
    })

    // Seed and navigate
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [timedQuiz])
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Start the quiz
    await startQuiz(page)

    // Timer should be visible and showing ~10:00
    // The timer span uses font-mono class and aria-hidden="true"
    const timerSpan = page.locator('span.font-mono[aria-hidden="true"]')
    await expect(timerSpan).toBeVisible()
    const initialTime = await timerSpan.textContent()
    expect(initialTime).toMatch(/^\d{2}:\d{2}$/)
    // Should start at 10:00 or 09:59 (timer may tick once before we read)
    expect(initialTime === '10:00' || initialTime === '09:59').toBe(true)

    // Answer Q1 to create progress
    await answerQuestion(page, '4')

    // Wait for timer to tick down at least 2 seconds
    await expect(timerSpan).not.toHaveText('10:00')
    await expect(timerSpan).not.toHaveText('09:59')

    // Record the timer value before navigating away
    const timeBeforeNav = await timerSpan.textContent()
    expect(timeBeforeNav).toMatch(/^\d{2}:\d{2}$/)
    expect(timeBeforeNav).not.toBe('10:00')
    expect(timeBeforeNav).not.toBe('00:00')

    // Trigger visibilitychange to force QuizHeader to sync timer to Zustand store.
    // The store subscriber then persists currentProgress (including timeRemaining)
    // to quiz-progress-{quizId} in localStorage. Without this, page.goto() would
    // cause a full page load before React cleanup effects can fire.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Verify the timer was synced to per-quiz localStorage before navigating
    const savedProgress = await page.evaluate(
      quizId => localStorage.getItem(`quiz-progress-${quizId}`),
      QUIZ_ID
    )
    expect(savedProgress).not.toBeNull()
    const parsed = JSON.parse(savedProgress!)
    expect(parsed.timeRemaining).toBeDefined()
    expect(parsed.timeRemaining).toBeLessThan(10) // less than original 10 minutes

    // Navigate away (full page load — destroys React tree)
    await page.goto(`/courses/${COURSE_ID}`, { waitUntil: 'domcontentloaded' })

    // Navigate back to quiz
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Zustand rehydrates — quiz auto-resumes (same session, no Resume button needed)
    // Timer should be visible again
    const resumedTimer = page.locator('span.font-mono[aria-hidden="true"]')
    await expect(resumedTimer).toBeVisible()

    const resumedTime = await resumedTimer.textContent()
    expect(resumedTime).toMatch(/^\d{2}:\d{2}$/)

    // Timer should NOT be reset to 10:00 — it was restored from saved state
    expect(resumedTime).not.toBe('10:00')

    // Timer should not be 00:00 — paused time did not count
    expect(resumedTime).not.toBe('00:00')

    // The resumed time should be ≤ the time before navigation
    // (could be slightly less due to unmount sync timing, but not more)
    const [beforeMin, beforeSec] = timeBeforeNav!.split(':').map(Number)
    const [resumeMin, resumeSec] = resumedTime!.split(':').map(Number)
    const beforeTotal = beforeMin * 60 + beforeSec
    const resumeTotal = resumeMin * 60 + resumeSec
    expect(resumeTotal).toBeLessThanOrEqual(beforeTotal)
    expect(resumeTotal).toBeGreaterThan(0)
  })

  test('AC2-a11y: Resume button has autoFocus and shows answer count', async ({ page }) => {
    // Seed per-quiz progress (simulate browser restart)
    const savedProgress = makeProgress(QUIZ_ID, {
      currentQuestionIndex: 0,
      answers: { 'q1-e13s03': '4' },
      questionOrder: [q1.id, q2.id, q3.id],
    })
    await seedSavedProgress(page, savedProgress)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz])
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })

    // Resume button should be visible with answer count
    const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
    await expect(resumeBtn).toBeVisible()
    await expect(resumeBtn).toContainText(/1 of 3 answered/i)

    // Resume button should have focus (autoFocus)
    await expect(resumeBtn).toBeFocused()
  })
})
