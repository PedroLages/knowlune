/**
 * E12-S04: Create Quiz Route and QuizPage Component
 *
 * Acceptance criteria:
 * - AC1: Navigate to quiz URL → see start screen with title, description, metadata badges
 * - AC2: Click "Start Quiz" → quiz header shows progress, timer if timed
 * - AC3: Resume in-progress quiz → see "Resume Quiz (X of Y answered)" button
 * - AC4: Invalid quiz URL → see error message with course link
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion, makeProgress } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../../support/helpers/indexeddb-seed'

// Routing placeholder — quiz lookup uses LESSON_ID, not COURSE_ID
const COURSE_ID = 'course-001'
const LESSON_ID = 'lesson-001'
const QUIZ_URL = `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`

test.describe('E12-S04: Quiz Route and QuizPage', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed to avoid tablet layout overlay blocking interactions
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    // Navigate to app first so Dexie initialises the database
    await page.goto('/')
  })

  test.describe('AC1: Quiz start screen', () => {
    test('shows quiz title, description, and metadata badges', async ({ page, indexedDB }) => {
      const questions = Array.from({ length: 12 }, (_, i) =>
        makeQuestion({ id: `q-${i}`, order: i + 1, text: `Question ${i + 1}` })
      )
      const quiz = makeQuiz({
        id: 'quiz-001',
        lessonId: LESSON_ID,
        title: 'JavaScript Fundamentals Quiz',
        description: 'Test your knowledge of JS basics',
        questions,
        timeLimit: 30,
        passingScore: 70,
      })

      await indexedDB.clearStore('quizzes')
      await seedQuizzes(page, [quiz])

      await page.goto(QUIZ_URL)

      // Title and description
      await expect(
        page.getByRole('heading', { name: 'JavaScript Fundamentals Quiz' })
      ).toBeVisible()
      await expect(page.getByText('Test your knowledge of JS basics')).toBeVisible()

      // Metadata badges
      await expect(page.getByText(/12 questions/i)).toBeVisible()
      await expect(page.getByText(/30 min/i)).toBeVisible()
      await expect(page.getByText(/70% to pass/i)).toBeVisible()

      // Start Quiz button visible, no questions yet
      await expect(page.getByRole('button', { name: /start quiz/i })).toBeVisible()
      await expect(page.getByText(/question 1 of/i)).not.toBeVisible()
    })

    test('shows "Untimed" badge when quiz has no time limit', async ({ page, indexedDB }) => {
      const quiz = makeQuiz({
        id: 'quiz-002',
        lessonId: LESSON_ID,
        timeLimit: null,
      })

      await indexedDB.clearStore('quizzes')
      await seedQuizzes(page, [quiz])

      await page.goto(QUIZ_URL)

      await expect(page.getByText(/untimed/i)).toBeVisible()
    })
  })

  test.describe('AC2: Start Quiz', () => {
    test('clicking Start Quiz shows quiz header with progress', async ({ page, indexedDB }) => {
      const questions = Array.from({ length: 5 }, (_, i) =>
        makeQuestion({ id: `q-${i}`, order: i + 1, text: `Question ${i + 1}` })
      )
      const quiz = makeQuiz({
        id: 'quiz-003',
        lessonId: LESSON_ID,
        title: 'My Quiz',
        questions,
        timeLimit: null,
      })

      await indexedDB.clearStore('quizzes')
      await seedQuizzes(page, [quiz])

      await page.goto(QUIZ_URL)
      await page.getByRole('button', { name: /start quiz/i }).click()

      // Header shows progress text and progress bar
      await expect(page.getByText(/question 1 of 5/i)).toBeVisible()
      await expect(page.getByRole('progressbar')).toBeVisible()
    })

    test('timer counts down in MM:SS format for timed quiz', async ({ page, indexedDB }) => {
      const quiz = makeQuiz({
        id: 'quiz-004',
        lessonId: LESSON_ID,
        timeLimit: 10, // 10 minutes
      })

      await indexedDB.clearStore('quizzes')
      await seedQuizzes(page, [quiz])

      await page.goto(QUIZ_URL)
      await page.getByRole('button', { name: /start quiz/i }).click()

      // Timer starts at 10:00 for a 10-minute quiz (verifies minutes→seconds conversion)
      await expect(page.getByText('10:00')).toBeVisible()
    })
  })

  test.describe('AC3: Resume in-progress quiz', () => {
    const QUIZ_ID = 'quiz-005'

    test.afterEach(async ({ page }) => {
      await page.evaluate(id => localStorage.removeItem(`quiz-progress-${id}`), QUIZ_ID)
    })

    test('shows Resume Quiz button with answered count from localStorage', async ({
      page,
      indexedDB,
    }) => {
      const questions = Array.from({ length: 12 }, (_, i) =>
        makeQuestion({ id: `q-${i}`, order: i + 1, text: `Question ${i + 1}` })
      )
      const quiz = makeQuiz({
        id: QUIZ_ID,
        lessonId: LESSON_ID,
        questions,
      })

      const progress = makeProgress(QUIZ_ID, {
        quizId: QUIZ_ID,
        currentQuestionIndex: 4,
        answers: { 'q-0': 'A', 'q-1': 'B', 'q-2': 'A', 'q-3': 'C', 'q-4': 'A' },
        questionOrder: questions.map(q => q.id),
      })

      await indexedDB.clearStore('quizzes')
      await seedQuizzes(page, [quiz])
      await page.addInitScript(
        ({ progress }) => {
          localStorage.setItem('quiz-progress-quiz-005', JSON.stringify(progress))
        },
        { progress }
      )

      await page.goto(QUIZ_URL)

      // Resume button with answered count displayed
      const resumeBtn = page.getByRole('button', { name: /resume quiz/i })
      await expect(resumeBtn).toBeVisible()
      await expect(resumeBtn).toContainText(/5 of \d+ answered/i)

      // Click Resume and verify position is restored
      await resumeBtn.click()
      await expect(page.getByText(/question 5 of \d+/i)).toBeVisible()
    })
  })

  test.describe('AC4: Error state for missing quiz', () => {
    // No seeding: Dexie lookup returns undefined for an unknown lessonId, triggering the error state
    test('shows error message and course link when quiz not found', async ({ page }) => {
      await page.goto(`/courses/nonexistent-course/lessons/nonexistent-lesson/quiz`)

      await expect(page.getByText(/no quiz found/i)).toBeVisible()

      // Link back to course — use name to avoid matching the sidebar "Courses" nav link
      const courseLink = page.getByRole('link', { name: /back to course/i })
      await expect(courseLink).toBeVisible()
    })
  })
})
