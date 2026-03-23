/**
 * ATDD E2E tests for E18-S05: Integrate Quiz Completion with Study Streaks
 *
 * Tests that quiz submission logs study activity to the streak system:
 * - AC1: Completing a quiz updates the streak (study log entry created)
 * - AC2: Multiple quizzes on the same day are idempotent (deduplicated by date)
 * - AC3: Streak calendar on Overview shows today as active after quiz
 * - AC4: Streak logging failure does not block quiz submission
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e18s05'
const LESSON_ID = 'test-lesson-e18s05'

const q1 = makeQuestion({
  id: 'q1-e18s05',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e18s05',
  lessonId: LESSON_ID,
  title: 'Streak Integration Test Quiz',
  description: 'Single-question quiz for E18-S05 testing',
  questions: [q1],
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

async function completeQuiz(page: import('@playwright/test').Page, answer = 'Paris') {
  await page.getByRole('button', { name: /start quiz/i }).click()
  await page.getByRole('radio', { name: answer }).click()
  await page.getByRole('button', { name: /submit quiz/i }).click()
  // Wait for results page to confirm submission succeeded
  await expect(page).toHaveURL(/\/quiz\/results/, { timeout: 10_000 })
}

/** Read the study-log from localStorage and return quiz_complete entries for today */
async function getTodayQuizEntries(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('study-log')
    if (!raw) return []
    const log = JSON.parse(raw) as Array<{ type: string; timestamp: string }>
    const today = new Intl.DateTimeFormat('sv-SE').format(new Date()) // YYYY-MM-DD local
    return log.filter(
      a => a.type === 'quiz_complete' && a.timestamp.startsWith(today.substring(0, 10))
    )
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E18-S05: Quiz Completion → Study Streak Integration', () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('study-log')
      localStorage.removeItem('study-longest-streak')
      localStorage.removeItem('study-streak-pause')
    })
  })

  test('AC1: completing a quiz logs a quiz_complete action to the study log', async ({ page }) => {
    await navigateToQuiz(page)
    await completeQuiz(page)

    const quizEntries = await getTodayQuizEntries(page)
    expect(quizEntries).toHaveLength(1)
    expect(quizEntries[0].type).toBe('quiz_complete')
  })

  test('AC3: streak calendar on Overview shows today as active after quiz', async ({ page }) => {
    await navigateToQuiz(page)
    await completeQuiz(page)

    // Navigate to Overview where StudyStreakCalendar lives
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Streak counter should be at least 1 (quiz counts as study activity today)
    // The streak counter is the large number next to the flame icon
    const streakText = page.locator('[data-testid="current-streak-value"]')
    await expect(streakText).toBeVisible({ timeout: 5_000 })
    const streakValue = await streakText.textContent()
    expect(Number(streakValue)).toBeGreaterThanOrEqual(1)
  })

  test('AC2: submitting multiple quizzes on the same day is idempotent (streak = 1)', async ({
    page,
  }) => {
    await navigateToQuiz(page)
    await completeQuiz(page)

    // Navigate back and complete the same quiz again (retake)
    await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      waitUntil: 'domcontentloaded',
    })
    await completeQuiz(page)

    // Two quiz_complete entries in the log (one per submission)
    const quizEntries = await getTodayQuizEntries(page)
    expect(quizEntries).toHaveLength(2)

    // But streak is still 1 — deduplicated by date in studyDaysFromLog
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const streakText = page.locator('[data-testid="current-streak-value"]')
    await expect(streakText).toBeVisible({ timeout: 5_000 })
    expect(Number(await streakText.textContent())).toBe(1)
  })
})
