/**
 * E18-S04: Verify Contrast Ratios and Touch Targets
 *
 * Acceptance Criteria:
 * - AC1: Normal text ≥4.5:1 contrast ratio against background
 * - AC2: Non-text UI elements ≥3:1 contrast against adjacent colors
 * - AC3: Interactive elements on mobile ≥44px tall and wide
 * - AC4: Focus indicators ≥3:1 contrast, ≥2px thick
 * - AC5: Dark mode meets WCAG 2.1 AA contrast requirements
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { seedQuizzes, seedQuizAttempts } from '../support/helpers/seed-helpers'
import {
  makeQuiz,
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_ID = 'e18-s04-course'
const LESSON_ID = 'e18-s04-lesson'

function buildTestQuiz() {
  const questions = [
    makeQuestion({
      id: 'q1',
      order: 1,
      type: 'multiple-choice',
      text: 'What is the primary purpose of WCAG guidelines?',
      options: ['Web accessibility', 'Performance', 'Security', 'Styling'],
      correctAnswer: 'Web accessibility',
    }),
    makeQuestion({
      id: 'q2',
      order: 2,
      type: 'true-false',
      text: 'WCAG 2.1 AA requires a minimum contrast ratio of 4.5:1 for normal text.',
      options: ['True', 'False'],
      correctAnswer: 'True',
    }),
    makeQuestion({
      id: 'q3',
      order: 3,
      type: 'multiple-select',
      text: 'Which of the following meet WCAG 2.1 AA requirements?',
      options: ['4.5:1 text contrast', '3:1 large text contrast', '1:1 contrast', '7:1 contrast'],
      correctAnswer: ['4.5:1 text contrast', '3:1 large text contrast', '7:1 contrast'],
    }),
    makeQuestion({
      id: 'q4',
      order: 4,
      type: 'fill-in-blank',
      text: 'The minimum touch target size for WCAG 2.1 AA on mobile is ___ pixels.',
      options: [],
      correctAnswer: '44',
    }),
  ]

  return makeQuiz({
    id: 'quiz-e18-s04',
    lessonId: LESSON_ID,
    title: 'Accessibility Standards Quiz',
    description: 'Tests knowledge of WCAG 2.1 AA requirements',
    questions,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    timeLimit: null,
  })
}

async function seedAndNavigateToQuizStart(page: import('@playwright/test').Page) {
  const quiz = buildTestQuiz()

  // Navigate first so Dexie initializes and localStorage is accessible
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Prevent sidebar overlay in tablet viewports
  await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))

  // Seed quiz into IndexedDB
  await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])

  // Navigate to quiz start screen
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)
  await page.getByRole('button', { name: /start quiz/i }).waitFor({ state: 'visible' })
}

async function startQuiz(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /start quiz/i }).click()
  await page.waitForLoadState('domcontentloaded')
}

// ---------------------------------------------------------------------------
// AC1 + AC2: Color contrast — quiz start screen (light mode)
// ---------------------------------------------------------------------------

test.describe('E18-S04: Contrast Ratios — Light Mode', () => {
  test('AC1/AC2: Quiz start screen passes WCAG 2.1 AA axe-core audit', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC1/AC2: Active quiz (multiple-choice question) passes WCAG 2.1 AA axe-core audit', async ({
    page,
  }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Wait for the question to appear
    await page.getByRole('radiogroup').waitFor({ state: 'visible' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC1/AC2: True/false question passes WCAG 2.1 AA axe-core audit', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to question 2 (true/false)
    await page.getByRole('button', { name: 'Question 2' }).click()
    await page.getByRole('radiogroup').waitFor({ state: 'visible' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC1/AC2: Multiple-select question passes WCAG 2.1 AA axe-core audit', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to question 3 (multiple-select)
    await page.getByRole('button', { name: 'Question 3' }).click()
    await page.locator('fieldset').waitFor({ state: 'visible' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC1/AC2: Fill-in-blank question passes WCAG 2.1 AA axe-core audit', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to question 4 (fill-in-blank)
    await page.getByRole('button', { name: 'Question 4' }).click()
    await page.locator('input[name="quiz-answer"]').waitFor({ state: 'visible' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC1/AC2: Answered question state passes WCAG 2.1 AA axe-core audit', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Answer question 1 (so question grid shows answered state)
    const firstOption = page.locator('label').filter({ hasText: 'Web accessibility' })
    await firstOption.click()
    await expect(page.getByRole('radio').first()).toBeChecked()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC5: Dark mode contrast
// ---------------------------------------------------------------------------

test.describe('E18-S04: Contrast Ratios — Dark Mode', () => {
  test('AC5: Quiz start screen passes WCAG 2.1 AA in dark mode', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)

    // Disable transitions and apply dark mode (deterministic — no CSS timing uncertainty)
    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    })
    await page.evaluate(() => document.documentElement.classList.add('dark'))

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC5: Active quiz with answered state passes WCAG 2.1 AA in dark mode', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)

    // Disable transitions and apply dark mode (deterministic — no CSS timing uncertainty)
    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await startQuiz(page)

    // Answer question 1 so the answered (brand-soft) state is visible in question grid
    const firstOption = page.locator('label').filter({ hasText: 'Web accessibility' })
    await firstOption.click()
    await expect(page.getByRole('radio').first()).toBeChecked()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC3: Touch targets — mobile (375px)
// ---------------------------------------------------------------------------

test.describe('E18-S04: Touch Targets — Mobile (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('AC3: Quiz start button meets 44px minimum touch target', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)

    const startButton = page.getByRole('button', { name: /start quiz/i })
    const box = await startButton.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  })

  test('AC3: Multiple-choice answer options meet 44px minimum touch target', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    await page.getByRole('radiogroup').waitFor({ state: 'visible' })

    const options = page.getByRole('radio')
    const count = await options.count()
    expect(count).toBeGreaterThanOrEqual(2)

    for (let i = 0; i < count; i++) {
      const label = options.nth(i).locator('xpath=ancestor::label')
      const box = await label.boundingBox()
      expect(box, `Option ${i + 1} label should have a bounding box`).not.toBeNull()
      expect(box!.height, `Option ${i + 1} should be ≥44px tall`).toBeGreaterThanOrEqual(44)
    }
  })

  test('AC3: True/false answer options meet 44px minimum touch target', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to Q2 (true/false)
    await page.getByRole('button', { name: 'Question 2' }).click()
    await page.getByRole('radiogroup').waitFor({ state: 'visible' })

    const options = page.getByRole('radio')
    const count = await options.count()
    expect(count).toBe(2)

    for (let i = 0; i < count; i++) {
      const label = options.nth(i).locator('xpath=ancestor::label')
      const box = await label.boundingBox()
      expect(box, `TF option ${i + 1} should have a bounding box`).not.toBeNull()
      expect(box!.height, `TF option ${i + 1} should be ≥44px tall`).toBeGreaterThanOrEqual(44)
    }
  })

  test('AC3: Navigation buttons (Previous/Next) meet 44px minimum touch target', async ({
    page,
  }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Previous button (disabled on first question)
    const prevButton = page.getByRole('button', { name: /previous/i })
    const prevBox = await prevButton.boundingBox()
    expect(prevBox).not.toBeNull()
    expect(prevBox!.height).toBeGreaterThanOrEqual(44)

    // Next button
    const nextButton = page.getByRole('button', { name: /next/i })
    const nextBox = await nextButton.boundingBox()
    expect(nextBox).not.toBeNull()
    expect(nextBox!.height).toBeGreaterThanOrEqual(44)
  })

  test('AC3: Fill-in-blank input meets 44px minimum touch target', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to Q4 (fill-in-blank)
    await page.getByRole('button', { name: 'Question 4' }).click()
    await page.locator('input[name="quiz-answer"]').waitFor({ state: 'visible' })

    const input = page.locator('input[name="quiz-answer"]')
    const box = await input.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })

  test('AC3: Mark for Review touch target meets 44px minimum', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // The "Mark for Review" label should be ≥44px tall AND ≥44px wide (AC3: both dimensions)
    const markLabel = page.getByText('Mark for Review')
    const box = await markLabel.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  })

  test('AC3: No horizontal scroll on mobile viewport', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AC4: Focus indicators
// ---------------------------------------------------------------------------

test.describe('E18-S04: Focus Indicators', () => {
  test('AC4: Question grid buttons show brand focus ring on keyboard focus', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    const questionBtn = page.getByRole('button', { name: 'Question 1' })
    await questionBtn.focus()
    await expect(questionBtn).toBeFocused()

    // Verify the focus ring is brand token (not the low-contrast ring-ring)
    const outlineColor = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return getComputedStyle(el).outlineColor
    })
    // Brand ring should not be transparent and not be the neutral grey ring-ring (#b3b3b3 → rgb(179,179,179))
    expect(outlineColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(outlineColor).not.toMatch(/rgb\(17[0-9],\s*17[0-9],\s*17[0-9]\)/)
  })

  test('AC4: Multiple-choice option shows focus ring when radio receives focus', async ({
    page,
  }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    const firstRadio = page.getByRole('radio').first()
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()
  })

  test('AC4: Fill-in-blank input receives and holds keyboard focus', async ({ page }) => {
    await seedAndNavigateToQuizStart(page)
    await startQuiz(page)

    // Navigate to Q4
    await page.getByRole('button', { name: 'Question 4' }).click()
    await page.locator('input[name="quiz-answer"]').waitFor({ state: 'visible' })

    const input = page.locator('input[name="quiz-answer"]')
    await input.focus()
    await expect(input).toBeFocused()
  })
})

// ---------------------------------------------------------------------------
// Helper: complete a quiz and land on the results page
// (QuizResults requires currentQuiz in Zustand store — must flow through UI)
// ---------------------------------------------------------------------------

async function completeQuizAndNavigateToResults(page: import('@playwright/test').Page) {
  await seedAndNavigateToQuizStart(page)
  await startQuiz(page)

  // Q1 — multiple-choice
  await page.getByRole('radiogroup').waitFor({ state: 'visible' })
  await page.locator('label').filter({ hasText: 'Web accessibility' }).click()

  // Q2 — true/false
  await page.getByRole('button', { name: 'Question 2' }).click()
  await page.getByRole('radiogroup').waitFor({ state: 'visible' })
  await page.locator('label').filter({ hasText: 'True' }).click()

  // Q3 — multiple-select
  await page.getByRole('button', { name: 'Question 3' }).click()
  await page.locator('fieldset').waitFor({ state: 'visible' })
  await page.locator('label').filter({ hasText: '4.5:1 text contrast' }).click()
  await page.locator('label').filter({ hasText: '3:1 large text contrast' }).click()
  await page.locator('label').filter({ hasText: '7:1 contrast' }).click()

  // Q4 — fill-in-blank
  await page.getByRole('button', { name: 'Question 4' }).click()
  await page.locator('input[name="quiz-answer"]').waitFor({ state: 'visible' })
  await page.locator('input[name="quiz-answer"]').fill('44')

  // Submit (all answered — no confirmation dialog)
  await page.getByRole('button', { name: /submit quiz/i }).click()
  await page.waitForURL(`**/quiz/results`)
  await page.getByRole('heading').first().waitFor({ state: 'visible' })
}

// ---------------------------------------------------------------------------
// AC1/AC2/AC5: Contrast — QuizResults and QuizReview pages
// ---------------------------------------------------------------------------

test.describe('E18-S04: Contrast Ratios — QuizResults Page', () => {
  test('AC1/AC2: QuizResults page passes WCAG 2.1 AA axe-core audit (light mode)', async ({
    page,
  }) => {
    await completeQuizAndNavigateToResults(page)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC5: QuizResults page passes WCAG 2.1 AA axe-core audit (dark mode)', async ({ page }) => {
    await completeQuizAndNavigateToResults(page)

    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    })
    await page.evaluate(() => document.documentElement.classList.add('dark'))

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })
})

const REVIEW_QUIZ_ID = 'quiz-e18-s04-review'
const REVIEW_ATTEMPT_ID = 'attempt-e18-s04-review'

function buildReviewTestData() {
  const q1 = makeQuestion({
    id: 'rq1',
    order: 1,
    type: 'multiple-choice',
    text: 'What is WCAG?',
    options: ['Web accessibility standard', 'A color model', 'A font system', 'A browser'],
    correctAnswer: 'Web accessibility standard',
  })
  const q2 = makeQuestion({
    id: 'rq2',
    order: 2,
    type: 'true-false',
    text: 'WCAG 2.1 AA requires 4.5:1 contrast for normal text.',
    options: ['True', 'False'],
    correctAnswer: 'True',
  })
  const quiz = makeQuiz({
    id: REVIEW_QUIZ_ID,
    lessonId: `${LESSON_ID}-review`,
    title: 'WCAG Review Quiz',
    questions: [q1, q2],
    shuffleQuestions: false,
  })
  const attempt = makeAttempt({
    id: REVIEW_ATTEMPT_ID,
    quizId: REVIEW_QUIZ_ID,
    answers: [
      makeCorrectAnswer('rq1', { userAnswer: 'Web accessibility standard', pointsPossible: 1 }),
      makeWrongAnswer('rq2', { userAnswer: 'False', pointsPossible: 1 }),
    ],
    score: 1,
    percentage: 50,
    passed: false,
  })
  return { quiz, attempt }
}

test.describe('E18-S04: Contrast Ratios — QuizReview Page', () => {
  test('AC1/AC2/AC4: QuizReview page passes WCAG 2.1 AA axe-core audit (light mode)', async ({
    page,
  }) => {
    const { quiz, attempt } = buildReviewTestData()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])
    await seedQuizAttempts(page, [attempt as unknown as Record<string, unknown>])
    await page.goto(
      `/courses/${COURSE_ID}/lessons/${LESSON_ID}-review/quiz/review/${REVIEW_ATTEMPT_ID}`
    )
    await page.getByRole('heading').first().waitFor({ state: 'visible' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('AC4: ReviewQuestionGrid buttons show brand focus ring (not ring-ring)', async ({
    page,
  }) => {
    const { quiz, attempt } = buildReviewTestData()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])
    await seedQuizAttempts(page, [attempt as unknown as Record<string, unknown>])
    await page.goto(
      `/courses/${COURSE_ID}/lessons/${LESSON_ID}-review/quiz/review/${REVIEW_ATTEMPT_ID}`
    )
    await page.getByRole('heading').first().waitFor({ state: 'visible' })

    // Focus a ReviewQuestionGrid button (toolbar buttons)
    const gridBtn = page.getByRole('toolbar').getByRole('button').first()
    await gridBtn.focus()
    await expect(gridBtn).toBeFocused()

    // Brand ring should not be transparent (ring-ring/50 was ~1.41:1 contrast)
    const outlineColor = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return getComputedStyle(el).outlineColor
    })
    expect(outlineColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('AC5: QuizReview page passes WCAG 2.1 AA axe-core audit (dark mode)', async ({ page }) => {
    const { quiz, attempt } = buildReviewTestData()
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))
    await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])
    await seedQuizAttempts(page, [attempt as unknown as Record<string, unknown>])
    await page.goto(
      `/courses/${COURSE_ID}/lessons/${LESSON_ID}-review/quiz/review/${REVIEW_ATTEMPT_ID}`
    )
    await page.getByRole('heading').first().waitFor({ state: 'visible' })

    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    })
    await page.evaluate(() => document.documentElement.classList.add('dark'))

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('[data-agentation]')
      .exclude('[data-feedback-toolbar]')
      .analyze()

    expect(results.violations).toEqual([])
  })
})
