/**
 * E2E tests for E18-S11: Track Quiz Progress in Content Completion
 *
 * Verifies the integration between quiz submission and content progress update:
 * - Passing a quiz marks the associated lesson as 'completed' in contentProgress IDB store
 * - Failing a quiz does NOT mark the lesson as completed
 *
 * Note: Core store integration (unit-tested in useQuizStore.crossStore.test.ts) was
 * implemented in E12-S03-AC5. These tests verify the end-to-end IDB persistence.
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e18s11'
const LESSON_ID = 'test-lesson-e18s11'

const q1 = makeQuestion({
  id: 'q1-e18s11',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e18s11',
  lessonId: LESSON_ID,
  title: 'Content Progress Test Quiz',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const testCourse = {
  id: COURSE_ID,
  title: 'Content Progress Test Course',
  shortTitle: 'CPT',
  description: 'A test course for E18-S11 content progress integration',
  category: 'research-library',
  difficulty: 'beginner',
  totalLessons: 1,
  totalVideos: 1,
  totalPDFs: 0,
  estimatedHours: 1,
  tags: [],
  modules: [
    {
      id: 'mod-e18s11',
      title: 'Module 1',
      description: 'Test module',
      order: 0,
      lessons: [
        {
          id: LESSON_ID,
          title: 'Lesson 1',
          description: 'Test lesson',
          order: 0,
          resources: [],
          keyTopics: [],
          duration: '10:00',
        },
      ],
    },
  ],
  isSequential: false,
  basePath: `/courses/${COURSE_ID}`,
  authorId: 'author-1',
}

// ---------------------------------------------------------------------------
// Helper: read a contentProgress record from IndexedDB by compound key
// ---------------------------------------------------------------------------

async function getContentProgressEntry(
  page: import('@playwright/test').Page,
  courseId: string,
  itemId: string
): Promise<{ courseId: string; itemId: string; status: string } | null> {
  return page.evaluate(
    async ({ courseId, itemId }) => {
      return new Promise<{ courseId: string; itemId: string; status: string } | null>(
        (resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => {
            const db = request.result
            if (!db.objectStoreNames.contains('contentProgress')) {
              db.close()
              resolve(null)
              return
            }
            const tx = db.transaction('contentProgress', 'readonly')
            const store = tx.objectStore('contentProgress')
            // Compound PK: [courseId+itemId] maps to array key in IDB
            const req = store.get([courseId, itemId])
            req.onsuccess = () => {
              db.close()
              resolve((req.result as { courseId: string; itemId: string; status: string }) ?? null)
            }
            req.onerror = () => {
              db.close()
              reject(req.error)
            }
          }
          request.onerror = () => reject(request.error)
        }
      )
    },
    { courseId, itemId }
  )
}

// ---------------------------------------------------------------------------
// Helper: navigate to quiz page with seeded data
// ---------------------------------------------------------------------------

async function setupAndNavigateToQuiz(page: import('@playwright/test').Page) {
  // Collapse sidebar to prevent overlay blocking button clicks on tablet viewport
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })

  // Navigate first so Dexie initialises the database and all object stores
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed quiz and the owning course (submitQuiz fetches course for module cascade)
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
  await seedIndexedDBStore(page, 'ElearningDB', 'courses', [testCourse])

  // Navigate to quiz page
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E18-S11: Quiz Progress → Content Completion', () => {
  test('AC1: passing quiz marks lesson as completed in contentProgress', async ({ page }) => {
    await setupAndNavigateToQuiz(page)

    // Start quiz
    await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible()
    await page.getByRole('button', { name: /start quiz/i }).click()

    // Answer correctly (100% >= 70 passing score → passed)
    await page.getByRole('radio', { name: 'Paris' }).click()
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Wait for results page — confirms submitQuiz completed
    await expect(page).toHaveURL(/\/quiz\/results/)

    // Verify contentProgress IDB entry was created with 'completed' status
    const entry = await getContentProgressEntry(page, COURSE_ID, LESSON_ID)
    expect(entry).not.toBeNull()
    expect(entry?.status).toBe('completed')
  })

  test('AC2: failing quiz does NOT mark lesson as completed', async ({ page }) => {
    await setupAndNavigateToQuiz(page)

    // Start quiz
    await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible()
    await page.getByRole('button', { name: /start quiz/i }).click()

    // Answer incorrectly (0% < 70 passing score → not passed)
    await page.getByRole('radio', { name: 'London' }).click()
    await page.getByRole('button', { name: /submit quiz/i }).click()

    // Wait for results page
    await expect(page).toHaveURL(/\/quiz\/results/)

    // contentProgress entry should not exist (or not be 'completed')
    const entry = await getContentProgressEntry(page, COURSE_ID, LESSON_ID)
    const status = entry?.status ?? 'not-started'
    expect(status).not.toBe('completed')
  })
})
