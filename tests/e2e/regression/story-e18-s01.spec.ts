/**
 * E18-S01: Implement Complete Keyboard Navigation
 *
 * Acceptance Criteria:
 * - AC1: Tab moves through interactive elements in logical order:
 *        answer options → MarkForReview → navigation buttons → question grid
 * - AC2: Question text container receives programmatic focus on question change
 *        (tabIndex={-1}, NOT reachable via Tab)
 * - AC3: RadioGroup — Tab to enter, Arrow Up/Down to change selection, Space to select
 * - AC4: Checkboxes — Tab to each independently, Space to toggle
 * - AC5: QuestionGrid — Arrow Left/Right moves focus, Enter jumps to that question
 * - AC6: Modal — Escape closes and returns focus to trigger, Tab trapped inside
 */

import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes, clearIndexedDBStore } from '../../support/helpers/seed-helpers'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e18s01'
const LESSON_ID = 'test-lesson-e18s01'

const q1 = makeQuestion({
  id: 'q1-e18s01',
  order: 1,
  type: 'multiple-choice',
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e18s01',
  order: 2,
  type: 'multiple-choice',
  text: 'Which planet is closest to the sun?',
  options: ['Mercury', 'Venus', 'Earth', 'Mars'],
  correctAnswer: 'Mercury',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-e18s01',
  order: 3,
  type: 'multiple-select',
  text: 'Which are primary colors?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: ['Red', 'Blue', 'Yellow'],
  points: 3,
})

const quiz = makeQuiz({
  id: 'quiz-e18s01',
  lessonId: LESSON_ID,
  title: 'E18-S01 Keyboard Navigation Quiz',
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
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz as unknown as Record<string, unknown>])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
  // Wait for Q1 to appear
  await expect(page.getByText(/question 1 of 3/i)).toBeVisible()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E18-S01: Complete Keyboard Navigation', () => {
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })
  test('AC2: Programmatic focus moves to question text on navigation', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // On Q1, question-focus-target should have received programmatic focus
    await expect(page.getByTestId('question-focus-target')).toBeFocused()

    // Navigate to Q2 via button click
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 2 of 3/i)).toBeVisible()

    // After question change, programmatic focus should move to question-focus-target
    await expect(page.getByTestId('question-focus-target')).toBeFocused()
  })

  test('AC2: Question text container is NOT reachable via Tab', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Use .focus() (programmatic) to avoid triggering onChange auto-advance to Next button
    const firstRadio = page.getByRole('radio').first()
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()

    // Shift+Tab back — should NOT land on question-focus-target (tabIndex={-1} skipped)
    await page.keyboard.press('Shift+Tab')
    const focusTarget = page.getByTestId('question-focus-target')
    await expect(focusTarget).not.toBeFocused()
  })

  test('AC1: Tab order — answer options precede MarkForReview, which precedes navigation', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Focus the first radio in the answer group as known start point
    const firstRadio = page.getByRole('radio').first()
    await firstRadio.focus()
    await expect(firstRadio).toBeFocused()

    // Tab once from radio group → MarkForReview checkbox
    // (The radio group acts as a single tab stop; Arrow keys navigate within it)
    await page.keyboard.press('Tab')
    const markForReviewCheckbox = page.getByRole('checkbox', { name: /mark for review/i })
    await expect(markForReviewCheckbox).toBeFocused()

    // Tab again → Next button (Previous is disabled on Q1, skipped)
    await page.keyboard.press('Tab')
    const nextBtn = page.getByRole('button', { name: /next/i })
    await expect(nextBtn).toBeFocused()

    // Tab again → QuestionGrid first button (roving tabindex — tabIndex=0 on Q1 button)
    await page.keyboard.press('Tab')
    const q1GridBtn = page.getByRole('toolbar', { name: /question grid/i }).getByRole('button', {
      name: 'Question 1',
    })
    await expect(q1GridBtn).toBeFocused()
  })

  test('AC5: QuestionGrid — Arrow Right/Left moves focus between question buttons', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const toolbar = page.getByRole('toolbar', { name: /question grid/i })

    // Click Q1 grid button to set focus into the toolbar
    await toolbar.getByRole('button', { name: 'Question 1' }).click()
    await expect(toolbar.getByRole('button', { name: 'Question 1' })).toBeFocused()

    // Arrow Right → focus moves to Q2 button
    await page.keyboard.press('ArrowRight')
    await expect(toolbar.getByRole('button', { name: 'Question 2' })).toBeFocused()

    // Arrow Right → focus moves to Q3 button
    await page.keyboard.press('ArrowRight')
    await expect(toolbar.getByRole('button', { name: 'Question 3' })).toBeFocused()

    // Arrow Right wraps to Q1
    await page.keyboard.press('ArrowRight')
    await expect(toolbar.getByRole('button', { name: 'Question 1' })).toBeFocused()

    // Arrow Left wraps back to Q3
    await page.keyboard.press('ArrowLeft')
    await expect(toolbar.getByRole('button', { name: 'Question 3' })).toBeFocused()
  })

  test('AC5: QuestionGrid — Enter jumps to focused question', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Currently on Q1
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible()

    const toolbar = page.getByRole('toolbar', { name: /question grid/i })

    // Click Q1 grid button to set focus, then arrow to Q3
    await toolbar.getByRole('button', { name: 'Question 1' }).click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(toolbar.getByRole('button', { name: 'Question 3' })).toBeFocused()

    // Press Enter → should jump to Q3
    await page.keyboard.press('Enter')
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()
  })

  test('AC5: QuestionGrid — only one button is in Tab order (roving tabindex)', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const toolbar = page.getByRole('toolbar', { name: /question grid/i })
    const buttons = toolbar.getByRole('button')

    // Q1 is current — Q1 button should have tabIndex=0, others tabIndex=-1
    await expect(buttons.nth(0)).toHaveAttribute('tabindex', '0')
    await expect(buttons.nth(1)).toHaveAttribute('tabindex', '-1')
    await expect(buttons.nth(2)).toHaveAttribute('tabindex', '-1')

    // Navigate to Q2 via Next button
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 2 of 3/i)).toBeVisible()

    // Now Q2 button should have tabIndex=0
    await expect(buttons.nth(0)).toHaveAttribute('tabindex', '-1')
    await expect(buttons.nth(1)).toHaveAttribute('tabindex', '0')
    await expect(buttons.nth(2)).toHaveAttribute('tabindex', '-1')
  })

  test('AC3: RadioGroup — Arrow keys navigate between radio buttons', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Tab from question-focus-target (programmatic focus) naturally enters RadioGroup
    await expect(page.getByTestId('question-focus-target')).toBeFocused()
    await page.keyboard.press('Tab')
    const firstRadio = page.getByRole('radio').first()
    await expect(firstRadio).toBeFocused()

    // Arrow Down → focus moves to second radio (roving tabindex within the group)
    await page.keyboard.press('ArrowDown')
    const secondRadio = page.getByRole('radio').nth(1)
    await expect(secondRadio).toBeFocused()

    // Arrow Down again → focus moves to third radio
    await page.keyboard.press('ArrowDown')
    const thirdRadio = page.getByRole('radio').nth(2)
    await expect(thirdRadio).toBeFocused()

    // Arrow Up → moves back to second radio
    await page.keyboard.press('ArrowUp')
    await expect(secondRadio).toBeFocused()
  })

  test('AC3: RadioGroup — Space selects the focused radio button', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Wait for programmatic focus to settle on question-focus-target before tabbing
    await expect(page.getByTestId('question-focus-target')).toBeFocused()

    // Tab to radio group, then Arrow Down to second option, then Space to select it
    await page.keyboard.press('Tab')
    await page.keyboard.press('ArrowDown')
    const secondRadio = page.getByRole('radio').nth(1)
    await expect(secondRadio).toBeFocused()

    // Space selects the focused radio
    await page.keyboard.press('Space')
    await expect(secondRadio).toBeChecked()
  })

  test('AC4: Multiple-select — Tab navigates to each checkbox independently', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to Q3 (multiple-select)
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()

    // Wait for programmatic focus to settle before sending keyboard events
    await expect(page.getByTestId('question-focus-target')).toBeFocused()

    // Tab into checkboxes — each checkbox is independently tabbable
    await page.keyboard.press('Tab')
    const firstCheckbox = page.getByRole('checkbox').first()
    await expect(firstCheckbox).toBeFocused()

    // Tab to second checkbox
    await page.keyboard.press('Tab')
    const secondCheckbox = page.getByRole('checkbox').nth(1)
    await expect(secondCheckbox).toBeFocused()
  })

  test('AC4: Multiple-select — Space toggles a checkbox', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to Q3 (multiple-select)
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()

    // Wait for programmatic focus to settle
    await expect(page.getByTestId('question-focus-target')).toBeFocused()

    // Tab to first checkbox, press Space to check it
    await page.keyboard.press('Tab')
    const firstCheckbox = page.getByRole('checkbox').first()
    await expect(firstCheckbox).toBeFocused()
    await expect(firstCheckbox).not.toBeChecked()

    await page.keyboard.press('Space')
    await expect(firstCheckbox).toBeChecked()

    // Space again toggles it off
    await page.keyboard.press('Space')
    await expect(firstCheckbox).not.toBeChecked()
  })

  test('AC6: AlertDialog — Escape closes dialog', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to last question (Q3) without answering Q1 or Q2
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/question 3 of 3/i)).toBeVisible()

    // Click Submit Quiz — should open confirmation dialog (unanswered questions)
    const submitBtn = page.getByRole('button', { name: /submit quiz/i })
    await submitBtn.click()

    // Dialog should be open
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Press Escape → dialog closes
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // Focus must return to the trigger (Submit Quiz button) — AC6 requirement
    await expect(submitBtn).toBeFocused()
  })

  test('AC6: AlertDialog — Tab cycles within dialog (focus trap)', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to last question without answering
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByRole('button', { name: /next/i }).click()

    // Open confirmation dialog
    await page.getByRole('button', { name: /submit quiz/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Tab several times — focus should stay inside dialog
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      // Verify focused element is inside the dialog
      const focusIsInDialog = await page.evaluate(() => {
        const activeEl = document.activeElement
        const dialogEl = document.querySelector('[role="alertdialog"]')
        return dialogEl?.contains(activeEl) ?? false
      })
      expect(focusIsInDialog).toBe(true)
    }
  })
})
