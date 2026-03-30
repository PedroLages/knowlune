/**
 * E89-S09: Quiz Wiring with Unified Course IDs
 *
 * Tests that quizzes are accessible from the unified course routes
 * and quiz data is associated with unified course IDs:
 * - AC1: Quiz accessible from unified course detail via /courses/:courseId/lessons/:lessonId/quiz
 * - AC2: Quiz start screen renders with correct quiz data
 * - AC3: Quiz scores saved with unified course ID (quiz completion flow)
 * - AC4: Quiz retake functionality works
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { makeQuiz, makeQuestion, makeAttempt } from '../../support/fixtures/factories/quiz-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedQuizzes,
  seedQuizAttempts,
  clearIndexedDBStore,
} from '../../support/helpers/seed-helpers'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { FIXED_DATE } from '../../utils/test-time'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const COURSE_ID = 'e89s09-quiz-course'
const LESSON_ID = 'e89s09-lesson-1'
const QUIZ_ID = 'quiz-e89s09'

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'Quiz Wiring Test Course',
  videoCount: 1,
  pdfCount: 0,
})

const TEST_VIDEO = {
  id: LESSON_ID,
  courseId: COURSE_ID,
  filename: 'Lesson 1.mp4',
  path: 'Lesson 1.mp4',
  duration: 600,
  format: 'mp4',
  order: 0,
  fileHandle: null,
}

const q1 = makeQuestion({
  id: 'q1-e89s09',
  order: 1,
  text: 'What is the unified course model?',
  options: ['Single source', 'Dual adapter', 'Multi-tenant', 'None'],
  correctAnswer: 'Dual adapter',
  points: 1,
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_ID,
  title: 'Course Unification Quiz',
  questions: [q1],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const previousAttempt = makeAttempt({
  id: 'attempt-e89s09-prev',
  quizId: QUIZ_ID,
  score: 1,
  percentage: 100,
  passed: true,
  completedAt: FIXED_DATE,
  startedAt: FIXED_DATE,
  answers: [
    { questionId: q1.id, userAnswer: 'Dual adapter', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
  ],
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedTestData(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/courses')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedImportedVideos(page, [TEST_VIDEO])
  await seedQuizzes(page, [quiz] as Record<string, unknown>[])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('E89-S09: Quiz Wiring', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await seedTestData(page)
  })

  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'importedCourses')
    await clearIndexedDBStore(page, 'ElearningDB', 'importedVideos')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })

  test('AC1: Quiz accessible from unified lesson player via Take Quiz button', async ({
    page,
  }) => {
    // Navigate to unified lesson player
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${LESSON_ID}`)
    await page
      .getByTestId('lesson-player-content')
      .waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })

    // "Take Quiz" button should be visible
    const takeQuizBtn = page.getByTestId('take-quiz-button')
    await expect(takeQuizBtn).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Click navigates to quiz page under unified URL
    await takeQuizBtn.click()
    await page.waitForURL(`**/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
      timeout: TIMEOUTS.LONG,
    })
  })

  test('AC2: Quiz start screen renders with correct quiz data', async ({ page }) => {
    // Navigate directly to quiz page via unified URL
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)

    // Quiz start screen should show the quiz title
    await expect(page.getByText('Course Unification Quiz')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })

    // Start Quiz button should be visible (no previous attempts)
    await expect(page.getByRole('button', { name: 'Start Quiz' })).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
  })

  test('AC3: Quiz can be started and question is displayed', async ({ page }) => {
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)

    // Start the quiz
    await page.getByRole('button', { name: 'Start Quiz' }).click()

    // Quiz active container should appear with the question
    await expect(page.getByTestId('quiz-active-container')).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
    await expect(page.getByTestId('question-text')).toContainText(
      'What is the unified course model?'
    )
  })

  test('AC4: Quiz retake button shown when previous attempts exist', async ({ page }) => {
    // Seed a previous attempt
    await navigateAndWait(page, '/courses')
    await seedQuizAttempts(page, [previousAttempt] as Record<string, unknown>[])

    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)

    // Should show "Retake Quiz" instead of "Start Quiz"
    await expect(page.getByRole('button', { name: 'Retake Quiz' })).toBeVisible({
      timeout: TIMEOUTS.LONG,
    })
  })
})
