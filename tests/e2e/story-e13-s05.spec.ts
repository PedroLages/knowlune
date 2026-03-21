/**
 * ATDD E2E tests for E13-S05: Randomize Question Order with Fisher-Yates Shuffle
 *
 * Tests quiz question randomization behavior:
 * - Shuffle enabled → questions appear in random order
 * - Retake → different order on each attempt
 * - Shuffle disabled → original order preserved
 *
 * AC1/AC2 mock Math.random to produce deterministic shuffles,
 * eliminating the 1/120 false-failure probability of random assertions.
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data — 5 questions to make randomization observable
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s05'
const LESSON_ID = 'test-lesson-e13s05'

const questions = Array.from({ length: 5 }, (_, i) =>
  makeQuestion({
    id: `q${i + 1}-e13s05`,
    order: i + 1,
    text: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    points: 1,
  })
)

const shuffledQuiz = makeQuiz({
  id: 'quiz-e13s05-shuffle',
  lessonId: LESSON_ID,
  title: 'Shuffle Test Quiz',
  description: 'A 5-question quiz for E13-S05 shuffle testing',
  questions,
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: true,
  shuffleAnswers: false,
})

const unshuffledQuiz = makeQuiz({
  id: 'quiz-e13s05-noshuffle',
  lessonId: 'test-lesson-e13s05-noshuffle',
  title: 'No Shuffle Test Quiz',
  description: 'A 5-question quiz with shuffle disabled',
  questions,
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Deterministic Math.random sequences for shuffle testing
// ---------------------------------------------------------------------------

// Fisher-Yates iterates i from 4→1, calling Math.random() once per iteration.
// Each call produces j = floor(random * (i + 1)) where j ∈ [0, i].
// Sequence A: [0.1, 0.9, 0.3, 0.7] → swaps (4,0)(3,2)(2,0)(1,1) → [5,2,4,3,1]
// Sequence B: [0.5, 0.4, 0.8, 0.2] → swaps (4,2)(3,1)(2,1)(1,0) → [4,3,1,5,2]
const RANDOM_SEQUENCE_A = [0.1, 0.9, 0.3, 0.7]
const RANDOM_SEQUENCE_B = [0.5, 0.4, 0.8, 0.2]

/**
 * Inject a deterministic Math.random via addInitScript.
 * The mock replaces Math.random with a sequence-based generator
 * that returns values from the provided array, then falls back
 * to the next sequence (for retake tests) or to 0.5.
 */
function mockMathRandom() {
  return (sequences: number[][]) => {
    let seqIndex = 0
    let callIndex = 0
    const originalRandom = Math.random.bind(Math)

    Math.random = () => {
      if (seqIndex < sequences.length) {
        const seq = sequences[seqIndex]
        if (callIndex < seq.length) {
          return seq[callIndex++]
        }
        // Sequence exhausted — move to next
        seqIndex++
        callIndex = 0
        if (seqIndex < sequences.length) {
          return sequences[seqIndex][callIndex++]
        }
      }
      // All sequences exhausted — fall back to real random for non-shuffle calls
      return originalRandom()
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the current question text via data-testid */
async function getCurrentQuestionText(page: import('@playwright/test').Page): Promise<string> {
  const el = page.getByTestId('question-text')
  await expect(el).toBeVisible()
  return (await el.textContent()) ?? ''
}

/** Collect the order of all questions by navigating through them */
async function collectQuestionOrder(
  page: import('@playwright/test').Page,
  count: number
): Promise<string[]> {
  const order: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await getCurrentQuestionText(page)
    order.push(text)
    if (i < count - 1) {
      await page.getByRole('button', { name: 'Next' }).click()
    }
  }
  return order
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E13-S05: Randomize Question Order', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed for tablet viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test('AC1: shuffle enabled → questions appear in deterministic shuffled order', async ({
    page,
  }) => {
    // Mock Math.random to produce a known shuffle: [5,2,4,3,1]
    await page.addInitScript(mockMathRandom(), [RANDOM_SEQUENCE_A])

    // Navigate to app first so IndexedDB schema is initialized, then seed quiz data
    await page.goto('/')
    await seedQuizzes(page, [shuffledQuiz as unknown as Record<string, unknown>])

    // Navigate directly to the quiz route
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)

    // Start the quiz
    await page.getByRole('button', { name: /start quiz/i }).click()

    const order = await collectQuestionOrder(page, 5)
    const originalOrder = questions.map(q => q.text)

    // Deterministic mock guarantees shuffled order differs from original
    expect(order).not.toEqual(originalOrder)
  })

  test('AC2: retake quiz → different order on each attempt', async ({ page }) => {
    // Mock Math.random with two different sequences — one per attempt
    await page.addInitScript(mockMathRandom(), [RANDOM_SEQUENCE_A, RANDOM_SEQUENCE_B])

    await page.goto('/')
    await seedQuizzes(page, [shuffledQuiz as unknown as Record<string, unknown>])

    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)

    // First attempt
    await page.getByRole('button', { name: /start quiz/i }).click()
    const firstOrder = await collectQuestionOrder(page, 5)

    // Answer all and submit to complete first attempt
    // Navigate back to first question to answer from there
    for (let i = 3; i >= 0; i--) {
      await page.getByRole('button', { name: 'Previous' }).click()
    }
    for (let i = 0; i < 5; i++) {
      await page.getByRole('radio', { name: 'A' }).click()
      if (i < 4) await page.getByRole('button', { name: 'Next' }).click()
    }
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Wait for results page
    await expect(page.getByRole('button', { name: /retake quiz/i })).toBeVisible()

    // Retake
    await page.getByRole('button', { name: /retake quiz/i }).click()

    // Wait for quiz to restart
    await expect(page.getByTestId('question-text')).toBeVisible()

    const secondOrder = await collectQuestionOrder(page, 5)

    // Deterministic mock: sequence A produces different order than sequence B
    expect(secondOrder).not.toEqual(firstOrder)
  })

  test('AC3: shuffle disabled → original order preserved', async ({ page }) => {
    await page.goto('/')
    await seedQuizzes(page, [unshuffledQuiz as unknown as Record<string, unknown>])

    await page.goto(`/courses/${COURSE_ID}/lessons/test-lesson-e13s05-noshuffle/quiz`)

    await page.getByRole('button', { name: /start quiz/i }).click()

    const order = await collectQuestionOrder(page, 5)
    const originalOrder = questions.map(q => q.text)

    expect(order).toEqual(originalOrder)
  })
})
