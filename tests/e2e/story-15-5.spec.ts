/**
 * ATDD E2E tests for E15-S05: Display Performance Summary After Quiz
 *
 * Tests the performance summary displayed after quiz completion:
 * - Overall score (percentage and points)
 * - Question correctness breakdown
 * - Topic-based strengths and growth areas
 * - Encouraging messages based on score ranges
 * - Graceful fallback when questions have no topic tags
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e15s05'
const LESSON_ID = 'test-lesson-e15s05'

// Questions WITH topic tags (mixed performance scenario)
const topicQuestions = [
  makeQuestion({
    id: 'q1-arrays',
    order: 1,
    text: 'What does Array.push() return?',
    options: ['New length', 'The array', 'undefined', 'The element'],
    correctAnswer: 'New length',
    topic: 'Arrays',
  }),
  makeQuestion({
    id: 'q2-arrays',
    order: 2,
    text: 'Array.pop() removes from?',
    options: ['End', 'Start', 'Middle', 'Random'],
    correctAnswer: 'End',
    topic: 'Arrays',
  }),
  makeQuestion({
    id: 'q3-functions',
    order: 3,
    text: 'What is a closure?',
    options: ['Inner function accessing outer scope', 'A loop', 'A class', 'An object'],
    correctAnswer: 'Inner function accessing outer scope',
    topic: 'Functions',
  }),
  makeQuestion({
    id: 'q4-functions',
    order: 4,
    text: 'Arrow functions bind?',
    options: ['Lexical this', 'Dynamic this', 'No this', 'Global this'],
    correctAnswer: 'Lexical this',
    topic: 'Functions',
  }),
  makeQuestion({
    id: 'q5-objects',
    order: 5,
    text: 'Object.keys() returns?',
    options: ['Array of keys', 'Array of values', 'Object', 'Map'],
    correctAnswer: 'Array of keys',
    topic: 'Objects',
  }),
]

const mixedPerformanceQuiz = makeQuiz({
  id: 'quiz-e15s05-mixed',
  lessonId: LESSON_ID,
  title: 'JavaScript Fundamentals',
  description: 'A 5-question quiz with topic tags for E15-S05 testing',
  questions: topicQuestions,
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// Questions WITHOUT topic tags (fallback scenario)
const noTopicQuestions = [
  makeQuestion({
    id: 'q1-general',
    order: 1,
    text: 'What is 2 + 2?',
    options: ['4', '3', '5', '6'],
    correctAnswer: '4',
  }),
  makeQuestion({
    id: 'q2-general',
    order: 2,
    text: 'What is 3 * 3?',
    options: ['9', '6', '12', '8'],
    correctAnswer: '9',
  }),
  makeQuestion({
    id: 'q3-general',
    order: 3,
    text: 'What is 10 / 2?',
    options: ['5', '4', '6', '3'],
    correctAnswer: '5',
  }),
]

const noTopicQuiz = makeQuiz({
  id: 'quiz-e15s05-notopic',
  lessonId: LESSON_ID,
  title: 'Basic Math Quiz',
  description: 'Questions without topic tags',
  questions: noTopicQuestions,
  passingScore: 70,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to quiz page with seeded data and sidebar closed */
async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quizToSeed: Record<string, unknown>,
) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quizToSeed])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

/** Start the quiz from the start screen */
async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

/** Answer current question by clicking option text */
async function answerQuestion(page: import('@playwright/test').Page, optionText: string) {
  await page.getByRole('radio', { name: optionText }).click()
}

/** Click Next button */
async function clickNext(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /next/i }).click()
}

/** Click Submit Quiz button */
async function clickSubmit(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /submit quiz/i }).click()
}

/** Confirm submission if dialog appears */
async function confirmSubmit(page: import('@playwright/test').Page) {
  const confirmBtn = page.getByRole('button', { name: /submit anyway/i })
  if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmBtn.click()
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E15-S05: Performance Summary After Quiz', () => {
  test.describe('AC1: Overall score and correctness breakdown', () => {
    test('displays overall score percentage and points after quiz completion', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Answer all 5 questions (get 3 right: Arrays + Objects correct, Functions wrong)
      await answerQuestion(page, 'New length') // q1 Arrays ✓
      await clickNext(page)
      await answerQuestion(page, 'End') // q2 Arrays ✓
      await clickNext(page)
      await answerQuestion(page, 'A loop') // q3 Functions ✗
      await clickNext(page)
      await answerQuestion(page, 'Dynamic this') // q4 Functions ✗
      await clickNext(page)
      await answerQuestion(page, 'Array of keys') // q5 Objects ✓

      await clickSubmit(page)
      await confirmSubmit(page)

      // Should show score percentage (3/5 = 60%)
      await expect(page.getByText('60%')).toBeVisible()

      // Should show correctness breakdown
      await expect(page.getByText(/3 correct/)).toBeVisible()
      await expect(page.getByText(/2 incorrect/)).toBeVisible()
    })
  })

  test.describe('AC2: Topic-based strengths and growth areas', () => {
    test('groups performance by topic with percentage per topic', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Answer: Arrays 2/2 (100%), Functions 0/2 (0%), Objects 1/1 (100%)
      await answerQuestion(page, 'New length') // q1 Arrays ✓
      await clickNext(page)
      await answerQuestion(page, 'End') // q2 Arrays ✓
      await clickNext(page)
      await answerQuestion(page, 'A loop') // q3 Functions ✗
      await clickNext(page)
      await answerQuestion(page, 'Dynamic this') // q4 Functions ✗
      await clickNext(page)
      await answerQuestion(page, 'Array of keys') // q5 Objects ✓

      await clickSubmit(page)
      await confirmSubmit(page)

      // Strengths section should show Arrays and Objects
      await expect(page.getByRole('heading', { name: /your strengths/i })).toBeVisible()
      await expect(page.getByText(/Arrays.*100%|100%.*Arrays/)).toBeVisible()
      await expect(page.getByText(/Objects.*100%|100%.*Objects/)).toBeVisible()

      // Growth areas should show Functions
      await expect(page.getByRole('heading', { name: /growth opportunities/i })).toBeVisible()
      await expect(page.getByText(/Functions.*0%|0%.*Functions/)).toBeVisible()
    })
  })

  test.describe('AC3: No topic tags — General fallback', () => {
    test('hides strengths/growth sections when all questions are General topic', async ({
      page,
    }) => {
      await navigateToQuiz(page, noTopicQuiz)
      await startQuiz(page)

      // Answer all correctly
      await answerQuestion(page, '4')
      await clickNext(page)
      await answerQuestion(page, '9')
      await clickNext(page)
      await answerQuestion(page, '5')

      await clickSubmit(page)
      await confirmSubmit(page)

      // Score should still show
      await expect(
        page.getByTestId('main-scroll-container').getByText('100%'),
      ).toBeVisible()

      // Strengths/growth sections should NOT be visible
      await expect(page.getByText(/your strengths/i)).not.toBeVisible()
      await expect(page.getByText(/growth opportunities/i)).not.toBeVisible()
    })
  })

  test.describe('AC4: Encouraging messages', () => {
    test('shows excellent message for ≥90% score', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Answer all 5 correctly (100%)
      await answerQuestion(page, 'New length')
      await clickNext(page)
      await answerQuestion(page, 'End')
      await clickNext(page)
      await answerQuestion(page, 'Inner function accessing outer scope')
      await clickNext(page)
      await answerQuestion(page, 'Lexical this')
      await clickNext(page)
      await answerQuestion(page, 'Array of keys')

      await clickSubmit(page)
      await confirmSubmit(page)

      await expect(page.getByText(/mastered this material/i)).toBeVisible()
    })

    test('shows encouraging message for 50-69% score', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Answer 3/5 correctly (60%)
      await answerQuestion(page, 'New length') // ✓
      await clickNext(page)
      await answerQuestion(page, 'End') // ✓
      await clickNext(page)
      await answerQuestion(page, 'A loop') // ✗
      await clickNext(page)
      await answerQuestion(page, 'Dynamic this') // ✗
      await clickNext(page)
      await answerQuestion(page, 'Array of keys') // ✓

      await clickSubmit(page)
      await confirmSubmit(page)

      await expect(page.getByText(/good effort/i)).toBeVisible()
    })
  })

  test.describe('AC5: Growth area suggestions', () => {
    test('suggests specific questions to review for growth areas', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Get Functions wrong (questions 3 & 4)
      await answerQuestion(page, 'New length') // q1 ✓
      await clickNext(page)
      await answerQuestion(page, 'End') // q2 ✓
      await clickNext(page)
      await answerQuestion(page, 'A loop') // q3 ✗
      await clickNext(page)
      await answerQuestion(page, 'Dynamic this') // q4 ✗
      await clickNext(page)
      await answerQuestion(page, 'Array of keys') // q5 ✓

      await clickSubmit(page)
      await confirmSubmit(page)

      // Growth area should suggest reviewing specific questions
      await expect(page.getByText(/review questions.*3.*4/i)).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('headings have proper hierarchy and lists use semantic markup', async ({ page }) => {
      await navigateToQuiz(page, mixedPerformanceQuiz)
      await startQuiz(page)

      // Answer with mixed results to trigger both sections
      await answerQuestion(page, 'New length')
      await clickNext(page)
      await answerQuestion(page, 'End')
      await clickNext(page)
      await answerQuestion(page, 'A loop')
      await clickNext(page)
      await answerQuestion(page, 'Dynamic this')
      await clickNext(page)
      await answerQuestion(page, 'Array of keys')

      await clickSubmit(page)
      await confirmSubmit(page)

      // Strengths and growth areas should use proper heading elements
      const strengthsHeading = page.getByRole('heading', { name: /strengths/i })
      await expect(strengthsHeading).toBeVisible()

      const growthHeading = page.getByRole('heading', { name: /growth/i })
      await expect(growthHeading).toBeVisible()

      // Topics should be in list elements
      const lists = page.locator('[data-testid="performance-insights"] ul')
      await expect(lists.first()).toBeVisible()
    })
  })
})
