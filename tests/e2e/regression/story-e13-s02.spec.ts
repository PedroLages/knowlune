/**
 * ATDD E2E tests for E13-S02: Mark Questions for Review
 *
 * Tests the mark-for-review toggle and review summary:
 * - Toggle checkbox on/off; Bookmark indicator appears in question grid
 * - Review indicator persists when navigating away and back
 * - Multiple questions can be marked simultaneously
 * - Submit dialog shows marked-question list with jump links
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e13s02'
const LESSON_ID = 'test-lesson-e13s02'

const q1 = makeQuestion({
  id: 'q1-e13s02',
  order: 1,
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '6'],
  correctAnswer: '4',
  points: 1,
})

const q2 = makeQuestion({
  id: 'q2-e13s02',
  order: 2,
  text: 'What color is the sky?',
  options: ['Red', 'Green', 'Blue', 'Yellow'],
  correctAnswer: 'Blue',
  points: 1,
})

const q3 = makeQuestion({
  id: 'q3-e13s02',
  order: 3,
  text: 'How many sides does a triangle have?',
  options: ['2', '3', '4', '5'],
  correctAnswer: '3',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e13s02',
  lessonId: LESSON_ID,
  title: 'Mark For Review Test Quiz',
  description: 'A 3-question quiz for E13-S02 testing',
  questions: [q1, q2, q3],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedQuizData(page: import('@playwright/test').Page, quizData: unknown[]) {
  await page.evaluate(
    async ({ data, maxRetries, retryDelay }) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await new Promise<'ok' | 'store-missing'>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('quizzes')) {
              db.close()
              resolve('store-missing')
              return
            }
            const tx = db.transaction('quizzes', 'readwrite')
            const store = tx.objectStore('quizzes')
            for (const item of data) {
              store.put(item)
            }
            tx.oncomplete = () => {
              db.close()
              resolve('ok')
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
          request.onerror = () => reject(request.error)
        })
        if (result === 'ok') return
        await new Promise(r => setTimeout(r, retryDelay))
      }
      throw new Error('Store "quizzes" not found after retries')
    },
    { data: quizData, maxRetries: 10, retryDelay: 200 }
  )
}

async function navigateToQuiz(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page, [quiz])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
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

test.describe('E13-S02: Mark Questions for Review', () => {
  test('AC1+AC2: toggle on/off; grid shows bookmark indicator when marked', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // "Mark for Review" checkbox starts unchecked
    const checkbox = page.getByRole('checkbox', { name: /mark for review/i })
    await expect(checkbox).toBeVisible()
    await expect(checkbox).not.toBeChecked()

    // Mark Q1 for review
    await checkbox.click()
    await expect(checkbox).toBeChecked()

    // Q1 grid button aria-label now includes "marked for review"
    await expect(page.getByRole('button', { name: 'Question 1, marked for review' })).toBeVisible()

    // Unmark Q1 — indicator disappears
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Question 1' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Question 1, marked for review' })
    ).not.toBeVisible()
  })

  test('AC3: review indicator persists when navigating away and back', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Mark Q1 for review
    await page.getByRole('checkbox', { name: /mark for review/i }).click()
    await expect(page.getByRole('button', { name: 'Question 1, marked for review' })).toBeVisible()

    // Navigate to Q2
    await clickNext(page)

    // Q1 grid button still shows indicator
    await expect(page.getByRole('button', { name: 'Question 1, marked for review' })).toBeVisible()
    // Q2 checkbox should be unchecked (Q2 not marked)
    await expect(page.getByRole('checkbox', { name: /mark for review/i })).not.toBeChecked()

    // Navigate back to Q1
    await page.getByRole('button', { name: /previous/i }).click()

    // Q1 checkbox is still checked
    await expect(page.getByRole('checkbox', { name: /mark for review/i })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Question 1, marked for review' })).toBeVisible()
  })

  test('AC4: mark multiple questions; only marked ones show indicators', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Mark Q1
    await page.getByRole('checkbox', { name: /mark for review/i }).click()

    // Navigate to Q2, skip marking
    await clickNext(page)

    // Navigate to Q3, mark it
    await clickNext(page)
    await page.getByRole('checkbox', { name: /mark for review/i }).click()

    // Q1 and Q3 show indicators; Q2 does not
    await expect(page.getByRole('button', { name: 'Question 1, marked for review' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Question 2' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Question 2, marked for review' })
    ).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Question 3, marked for review' })).toBeVisible()
  })

  test('AC5: submit dialog shows review summary with jump links', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Answer Q1
    await answerQuestion(page, '4')

    // Navigate to Q2, mark it, skip answering
    await clickNext(page)
    await page.getByRole('checkbox', { name: /mark for review/i }).click()

    // Navigate to Q3 (last question), skip answering
    await clickNext(page)

    // Click Submit Quiz (triggers dialog since Q2, Q3 unanswered)
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Dialog should appear
    await expect(page.getByText(/unanswered question/i)).toBeVisible()

    // Review summary shows "1 question marked for review"
    await expect(page.getByText(/1 question marked for review/i)).toBeVisible()

    // Jump link to Q2 is shown
    const q2Link = page.getByRole('button', { name: 'Q2' })
    await expect(q2Link).toBeVisible()

    // Click Q2 link → dialog closes, navigated to Q2
    await q2Link.click()
    await expect(page.getByText(/color is the sky/i)).toBeVisible()
    // Dialog should be closed
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
  })

  test('AC5b: submit dialog does NOT show review summary when nothing marked', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Skip all questions without marking any
    await clickNext(page)
    await clickNext(page)

    // Submit on last question
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Dialog appears (unanswered questions)
    await expect(page.getByText(/unanswered question/i)).toBeVisible()

    // No review summary shown
    await expect(page.getByText(/marked for review/i)).not.toBeVisible()
  })
})
