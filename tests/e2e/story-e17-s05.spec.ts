/**
 * ATDD E2E tests for E17-S05: Identify Learning Trajectory Patterns
 *
 * Tests that the ImprovementChart component displays trajectory patterns:
 * - AC1: Chart appears after 3+ quiz attempts with pattern label
 * - AC2: Confidence percentage is displayed
 * - AC3: Accessible aria-label describes the trajectory
 * - AC4: Chart does not appear with fewer than 3 attempts
 * - AC5: Complete quiz 5 times with improving scores → see chart + pattern label
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion, makeAttempt, makeCorrectAnswer, makeWrongAnswer } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes, seedQuizAttempts } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e17s05'
const LESSON_ID = 'test-lesson-e17s05'

const q1 = makeQuestion({
  id: 'q1-e17s05',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e17s05',
  lessonId: LESSON_ID,
  title: 'Trajectory Test Quiz',
  description: 'Single-question quiz for E17-S05 testing',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

/** Build an attempt with a specific score for seeding */
function buildAttempt(index: number, percentage: number) {
  const isCorrect = percentage >= 50
  return {
    ...makeAttempt({
      id: `attempt-e17s05-${index}`,
      quizId: 'quiz-e17s05',
      percentage,
      score: isCorrect ? 1 : 0,
      passed: percentage >= 70,
      completedAt: new Date(new Date(FIXED_DATE).getTime() - (10 - index) * 86400000).toISOString(),
      startedAt: new Date(new Date(FIXED_DATE).getTime() - (10 - index) * 86400000 - 60000).toISOString(),
      answers: [
        isCorrect
          ? makeCorrectAnswer('q1-e17s05')
          : makeWrongAnswer('q1-e17s05'),
      ],
    }),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupPage(page: import('@playwright/test').Page) {
  await page.addInitScript(fixedDate => {
    const OriginalDate = Date
    class MockDate extends OriginalDate {
      constructor(...args: ConstructorParameters<typeof OriginalDate>) {
        if (args.length === 0) {
          super(fixedDate)
        } else {
          // @ts-expect-error spread
          super(...args)
        }
      }
      static now() {
        return new OriginalDate(fixedDate).getTime()
      }
    }
    // @ts-expect-error mock
    globalThis.Date = MockDate
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  }, FIXED_DATE)
}

async function navigateToResults(page: import('@playwright/test').Page) {
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
  // Handle both "Start Quiz" and "Retake Quiz" buttons
  await page.getByRole('button', { name: /start quiz|retake quiz/i }).click()
  await page.getByRole('radio', { name: 'Paris' }).click()
  await page.getByRole('button', { name: /submit quiz/i }).click()
  await expect(page).toHaveURL(/\/quiz\/results/, { timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E17-S05: Learning Trajectory Patterns', () => {
  test('AC5: chart appears with pattern label after 5 improving attempts', async ({ page }) => {
    await setupPage(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

    // Seed 4 prior attempts with improving scores (20, 40, 60, 80)
    const priorAttempts = [
      buildAttempt(1, 20),
      buildAttempt(2, 40),
      buildAttempt(3, 60),
      buildAttempt(4, 80),
    ]
    await seedQuizAttempts(page, priorAttempts as unknown as Record<string, unknown>[])

    // Complete 5th attempt (100%) to reach results page
    await navigateToResults(page)

    // Wait for the improvement chart to appear
    const chart = page.getByTestId('improvement-chart')
    await expect(chart).toBeVisible({ timeout: 10_000 })

    // Pattern label should indicate consistent improvement (linear)
    const patternBadge = page.getByTestId('trajectory-pattern')
    await expect(patternBadge).toBeVisible()
    await expect(patternBadge).toHaveText(/consistent improvement|accelerating mastery/i)
  })

  test('AC2: confidence percentage is displayed', async ({ page }) => {
    await setupPage(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

    const priorAttempts = [
      buildAttempt(1, 20),
      buildAttempt(2, 40),
      buildAttempt(3, 60),
    ]
    await seedQuizAttempts(page, priorAttempts as unknown as Record<string, unknown>[])

    await navigateToResults(page)

    const confidence = page.getByTestId('trajectory-confidence')
    await expect(confidence).toBeVisible({ timeout: 10_000 })
    await expect(confidence).toHaveText(/\d+% confidence/)
  })

  test('AC3: section has accessible aria-label describing trajectory', async ({ page }) => {
    await setupPage(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

    const priorAttempts = [
      buildAttempt(1, 20),
      buildAttempt(2, 40),
      buildAttempt(3, 60),
    ]
    await seedQuizAttempts(page, priorAttempts as unknown as Record<string, unknown>[])

    await navigateToResults(page)

    const chart = page.getByTestId('improvement-chart')
    await expect(chart).toBeVisible({ timeout: 10_000 })

    const ariaLabel = await chart.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel).toContain('Learning trajectory')
    expect(ariaLabel).toContain('confidence')
  })

  test('AC4: chart does NOT appear with fewer than 3 attempts', async ({ page }) => {
    await setupPage(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

    // Only 1 prior attempt — completing the quiz makes 2 total
    const priorAttempts = [buildAttempt(1, 50)]
    await seedQuizAttempts(page, priorAttempts as unknown as Record<string, unknown>[])

    await navigateToResults(page)

    // Score trajectory should appear (needs 2+), but improvement chart should NOT
    const chart = page.getByTestId('improvement-chart')
    await expect(chart).not.toBeVisible({ timeout: 3_000 })
  })
})
