/**
 * ATDD E2E tests for E18-S08: Display Quiz Availability Badges on Courses Page
 *
 * Tests quiz badge visibility and behavior in the lesson list (ModuleAccordion):
 * - Lesson with quiz → "Take Quiz" badge appears (muted style)
 * - Lesson without quiz → no badge
 * - Lesson with completed quiz → "Quiz: X%" badge in success color
 * - Clicking badge → navigates to quiz start screen
 *
 * QFR58: Courses page can display quiz availability badges per lesson
 * QFR61: System can associate quizzes with specific course lessons
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeAttempt, makeQuestion } from '../../support/fixtures/factories/quiz-factory'
import {
  createCourse,
  createLesson,
  createModule,
} from '../../support/fixtures/factories/course-factory'
import {
  seedIndexedDBStore,
  seedQuizzes,
  seedQuizAttempts,
  clearIndexedDBStore,
} from '../../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data (stable IDs for deterministic queries)
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e18s08'
const LESSON_WITH_QUIZ_ID = 'lesson-quiz-e18s08'
const LESSON_WITHOUT_QUIZ_ID = 'lesson-no-quiz-e18s08'
const QUIZ_ID = 'quiz-e18s08'

const lessonWithQuiz = createLesson({
  id: LESSON_WITH_QUIZ_ID,
  title: 'Lesson With Quiz',
  order: 1,
})

const lessonWithoutQuiz = createLesson({
  id: LESSON_WITHOUT_QUIZ_ID,
  title: 'Lesson Without Quiz',
  order: 2,
})

const testModule = createModule({
  id: 'module-e18s08',
  title: 'Test Module',
  lessons: [lessonWithQuiz, lessonWithoutQuiz],
})

const testCourse = createCourse({
  id: COURSE_ID,
  title: 'Quiz Badge Test Course',
  modules: [testModule],
  authorId: 'author-1',
})

const quiz = makeQuiz({
  id: QUIZ_ID,
  lessonId: LESSON_WITH_QUIZ_ID,
  title: 'E18-S08 Test Quiz',
  questions: [makeQuestion({ id: 'q1', order: 1 })],
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const completedAttempt = makeAttempt({
  id: 'attempt-e18s08',
  quizId: QUIZ_ID,
  percentage: 85,
  passed: true,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up page for tests: navigate to home (creates DB), seed course + quiz, then navigate to course detail. */
async function setupCourseDetail(
  page: import('@playwright/test').Page,
  { withAttempt = false } = {}
) {
  // Close sidebar so it doesn't overlay content on small viewports
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })

  // Navigate first so Dexie creates and migrates the DB
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Seed course, quiz, and optionally attempt using shared helpers (frame-accurate timing)
  await seedIndexedDBStore(page, 'ElearningDB', 'courses', [testCourse as Record<string, unknown>])
  await seedQuizzes(page, [quiz as Record<string, unknown>])
  if (withAttempt) {
    await seedQuizAttempts(page, [completedAttempt as Record<string, unknown>])
  }

  // Full navigation so main.tsx re-runs loadCourses() with fresh Zustand state
  await page.goto(`/courses/${COURSE_ID}`, { waitUntil: 'domcontentloaded' })

  // Expand the module accordion — use role+name to avoid matching description text
  await page.getByRole('button', { name: /Test Module/i }).click()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.afterEach(async ({ page }) => {
  await clearIndexedDBStore(page, 'ElearningDB', 'courses')
  await clearIndexedDBStore(page, 'ElearningDB', 'quizzes')
  await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
})

test('lesson with quiz shows "Take Quiz" badge', async ({ page }) => {
  await setupCourseDetail(page)

  const badge = page.getByTestId(`quiz-badge-${LESSON_WITH_QUIZ_ID}`)
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('Take Quiz')
})

test('lesson without quiz shows no badge', async ({ page }) => {
  await setupCourseDetail(page)

  const badge = page.getByTestId(`quiz-badge-${LESSON_WITHOUT_QUIZ_ID}`)
  await expect(badge).not.toBeAttached()
})

test('lesson with completed quiz shows score badge', async ({ page }) => {
  await setupCourseDetail(page, { withAttempt: true })

  const badge = page.getByTestId(`quiz-badge-${LESSON_WITH_QUIZ_ID}`)
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('Quiz: 85%')

  // AC3 requires success color on the score text
  const scoreText = page.getByTestId(`quiz-score-text-${LESSON_WITH_QUIZ_ID}`)
  await expect(scoreText).toHaveClass(/text-success/)
})

test('clicking quiz badge navigates to quiz start screen', async ({ page }) => {
  await setupCourseDetail(page)

  const badge = page.getByTestId(`quiz-badge-${LESSON_WITH_QUIZ_ID}`)
  await badge.click()

  await expect(page).toHaveURL(`/courses/${COURSE_ID}/lessons/${LESSON_WITH_QUIZ_ID}/quiz`)
})
