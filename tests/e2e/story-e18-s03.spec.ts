/**
 * ATDD E2E tests for E18-S03: Ensure Semantic HTML and Proper ARIA Attributes
 *
 * Tests quiz components for:
 * - AC1: Fieldset/legend wrapping radio groups, label associations
 * - AC2: Heading hierarchy (h1 > h2), nav landmark, main/section landmarks
 * - AC3: ARIA roles for dynamic content (role="status", role="alert")
 * - AC4: Descriptive accessible names, aria-label on icon-only buttons
 * - AC5: role="timer" with aria-live="off", role="progressbar" with aria-value*
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../support/helpers/seed-helpers'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e18s03'
const LESSON_ID = 'test-lesson-e18s03'

const q1 = makeQuestion({
  id: 'q1-e18s03',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e18s03',
  order: 2,
  text: 'Which planet is closest to the sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctAnswer: 'Mercury',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e18s03',
  lessonId: LESSON_ID,
  title: 'Accessibility Test Quiz',
  description: 'A quiz for E18-S03 semantic HTML testing',
  questions: [q1, q2],
  passingScore: 50,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: 300, // 5 minutes — needed for AC5 timer tests
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToQuiz(
  page: import('@playwright/test').Page,
  quizData: unknown[] = [quiz],
  lessonId: string = LESSON_ID
) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, quizData as Record<string, unknown>[])
  await page.goto(`/courses/${COURSE_ID}/lessons/${lessonId}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

// ---------------------------------------------------------------------------
// AC1: Semantic form controls — fieldset, legend, labels
// ---------------------------------------------------------------------------

test.describe('AC1: Semantic form controls', () => {
  test('radio groups are wrapped in fieldset with legend', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Fieldset should be visible (it is the visible form group wrapper)
    const fieldset = page.locator('fieldset').first()
    await expect(fieldset).toBeVisible()

    // Legend is sr-only and empty — its presence satisfies semantic HTML; accessible name
    // comes from aria-labelledby on the fieldset pointing to the visible question text div
    const legend = fieldset.locator('legend')
    await expect(legend).toBeAttached()
  })

  test('all radio inputs have associated labels', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Each option should be accessible via getByRole('radio') with its name
    for (const option of q1.options!) {
      const radio = page.getByRole('radio', { name: option })
      await expect(radio).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// AC2: Heading hierarchy and landmark structure
// ---------------------------------------------------------------------------

test.describe('AC2: Heading hierarchy and landmarks', () => {
  test('h1 for quiz title is present', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // h1 should be the quiz title
    const h1 = page.locator('h1')
    await expect(h1).toContainText(quiz.title)
  })

  test('sr-only h2 for current question is present', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // h2 is sr-only — check it's in the DOM (toBeAttached doesn't require visibility)
    const h2 = page.locator('h2')
    await expect(h2).toBeAttached()
    await expect(h2).toContainText('Question 1')
  })

  test('nav landmark wraps question navigation', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // QuizNavigation renders <nav aria-label="Quiz navigation">
    const nav = page.getByRole('navigation', { name: /quiz navigation/i })
    await expect(nav).toBeVisible()
  })

  test('section landmarks exist for quiz header and question area', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Layout.tsx provides the outer <main> — quiz uses <section> for sub-regions
    const main = page.getByRole('main')
    await expect(main).toBeVisible()

    // Section for quiz header (progress bar, timer)
    const headerSection = page.locator('section[aria-label="Quiz header"]')
    await expect(headerSection).toBeVisible()

    // Section for question area
    const questionSection = page.locator('section[aria-label="Question area"]')
    await expect(questionSection).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: ARIA roles for dynamic content
// ---------------------------------------------------------------------------

test.describe('AC3: ARIA roles for dynamic content', () => {
  test('feedback area uses role="status" with aria-atomic after answering', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer a question to trigger the AnswerFeedback component
    await page.getByRole('radio', { name: q1.options![0] }).click()

    // AnswerFeedback renders role="status" aria-live="polite" aria-atomic="true"
    const feedback = page.locator('[data-testid="answer-feedback"]')
    await expect(feedback).toBeVisible()
    await expect(feedback).toHaveAttribute('role', 'status')
    await expect(feedback).toHaveAttribute('aria-live', 'polite')
    await expect(feedback).toHaveAttribute('aria-atomic', 'true')
  })
})

// ---------------------------------------------------------------------------
// AC4: Descriptive accessible names on navigation controls
// ---------------------------------------------------------------------------

test.describe('AC4: Accessible names on controls', () => {
  test('Previous button has aria-label="Previous question"', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const prevBtn = page.getByRole('button', { name: 'Previous question' })
    await expect(prevBtn).toBeAttached()
  })

  test('Next button has aria-label="Next question"', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const nextBtn = page.getByRole('button', { name: 'Next question' })
    await expect(nextBtn).toBeVisible()
  })

  test('all quiz buttons have non-empty accessible names', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Scope to the quiz card — AC4 is about quiz controls, not page-level layout buttons
    const quizContainer = page.locator('[data-testid="quiz-active-container"]')
    const buttons = quizContainer.getByRole('button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label')
      const textContent = await buttons.nth(i).textContent()
      const accessibleName = (ariaLabel ?? textContent ?? '').trim()
      expect(accessibleName.length, `Button ${i + 1} of ${count} has no accessible name`).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// AC5: Timer and progress ARIA attributes
// ---------------------------------------------------------------------------

test.describe('AC5: Timer and progress indicators', () => {
  test('countdown uses role="timer" with aria-live="off"', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const timer = page.locator('[role="timer"]')
    await expect(timer).toBeVisible()
    await expect(timer).toHaveAttribute('aria-live', 'off')
    await expect(timer).toHaveAttribute('aria-label', /time remaining/i)
  })

  test('sr-only progressbar uses question-count values (1-based)', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // The sr-only progressbar uses 1-based question count (not percentage)
    // Distinguished by aria-valuemin="1" (the visual Progress uses aria-valuemin="0")
    const srProgressbar = page.locator('[role="progressbar"][aria-valuemin="1"]')
    await expect(srProgressbar).toBeAttached()
    await expect(srProgressbar).toHaveAttribute('aria-valuenow', '1')
    await expect(srProgressbar).toHaveAttribute('aria-valuemax', String(quiz.questions.length))
    await expect(srProgressbar).toHaveAttribute('aria-label', /quiz progress/i)
  })
})
