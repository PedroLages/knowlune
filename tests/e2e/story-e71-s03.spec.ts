/**
 * E71-S03: Knowledge Map Integration — Suggested Actions Panel E2E tests
 *
 * Tests the SuggestedActionsPanel integration on the Knowledge Map page.
 * Validates panel visibility, action card rendering, CTA navigation,
 * empty state, and responsive layout.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import {
  seedImportedCourses,
  seedQuizzes,
  seedQuizAttempts,
  seedContentProgress,
  seedStudySessions,
  seedIndexedDBStore,
} from '../support/helpers/indexeddb-seed'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

// ── Seed Data ──────────────────────────────────────────────────

const COURSE_ID = 'course-comm-101'

const DECLINING_COURSE = {
  id: COURSE_ID,
  title: 'Communication Skills',
  category: 'Communication',
  tags: ['body-language', 'public-speaking'],
  author: 'Test Author',
  source: 'test',
  importedAt: FIXED_DATE,
  totalLessons: 5,
  thumbnailUrl: '',
}

const QUIZ = {
  id: 'quiz-1',
  lessonId: 'lesson-1',
  title: 'Body Language Quiz',
  questions: [
    { id: 'q1', topic: 'Body Language', text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'q2', topic: 'Body Language', text: 'Q2', options: ['a', 'b'], correctIndex: 1 },
    { id: 'q3', topic: 'Body Language', text: 'Q3', options: ['a', 'b'], correctIndex: 0 },
    { id: 'q4', topic: 'Body Language', text: 'Q4', options: ['a', 'b'], correctIndex: 1 },
  ],
}

const QUIZ_ATTEMPT_LOW = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  completedAt: getRelativeDate(-30),
  answers: [
    { questionId: 'q1', selectedIndex: 1, isCorrect: false },
    { questionId: 'q2', selectedIndex: 0, isCorrect: false },
    { questionId: 'q3', selectedIndex: 0, isCorrect: true },
    { questionId: 'q4', selectedIndex: 0, isCorrect: false },
  ],
  score: 25,
}

const CONTENT_PROGRESS = {
  id: `${COURSE_ID}::lesson-1`,
  courseId: COURSE_ID,
  itemId: 'lesson-1',
  status: 'in-progress',
  progress: 30,
  updatedAt: getRelativeDate(-30),
}

const SESSION_OLD = {
  id: 'session-1',
  courseId: COURSE_ID,
  startTime: getRelativeDate(-30),
  endTime: getRelativeDate(-30),
  durationSeconds: 1800,
}

const FLASHCARD_WEAK = {
  id: 'fc-1',
  courseId: COURSE_ID,
  front: 'What is open body language?',
  back: 'Arms uncrossed, facing speaker',
  stability: 2,
  difficulty: 0.5,
  last_review: getRelativeDate(-20),
  due: getRelativeDate(-10),
  reps: 1,
  lapses: 1,
  state: 1,
}

// ── Strong course data for empty state test ────────────────────

const STRONG_COURSE = {
  id: 'course-strong',
  title: 'Advanced Math',
  category: 'Mathematics',
  tags: ['calculus'],
  author: 'Test Author',
  source: 'test',
  importedAt: FIXED_DATE,
  totalLessons: 3,
  thumbnailUrl: '',
}

const STRONG_QUIZ = {
  id: 'quiz-strong',
  lessonId: 'lesson-strong-1',
  title: 'Calculus Quiz',
  questions: [
    { id: 'qs1', topic: 'Calculus', text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'qs2', topic: 'Calculus', text: 'Q2', options: ['a', 'b'], correctIndex: 1 },
  ],
}

const STRONG_ATTEMPT = {
  id: 'attempt-strong',
  quizId: 'quiz-strong',
  completedAt: getRelativeDate(-1),
  answers: [
    { questionId: 'qs1', selectedIndex: 0, isCorrect: true },
    { questionId: 'qs2', selectedIndex: 1, isCorrect: true },
  ],
  score: 100,
}

const STRONG_PROGRESS = {
  id: 'course-strong::lesson-strong-1',
  courseId: 'course-strong',
  itemId: 'lesson-strong-1',
  status: 'completed',
  progress: 100,
  updatedAt: getRelativeDate(-1),
}

const STRONG_SESSION = {
  id: 'session-strong',
  courseId: 'course-strong',
  startTime: getRelativeDate(-1),
  endTime: getRelativeDate(-1),
  durationSeconds: 3600,
}

// ── Helpers ────────────────────────────────────────────────────

async function seedDecliningTopics(page: import('@playwright/test').Page) {
  await seedImportedCourses(page, [DECLINING_COURSE])
  await seedQuizzes(page, [QUIZ])
  await seedQuizAttempts(page, [QUIZ_ATTEMPT_LOW])
  await seedContentProgress(page, [CONTENT_PROGRESS])
  await seedStudySessions(page, [SESSION_OLD])
  await seedIndexedDBStore(page, 'ElearningDB', 'flashcards', [FLASHCARD_WEAK])
}

async function seedStrongTopicsOnly(page: import('@playwright/test').Page) {
  await seedImportedCourses(page, [STRONG_COURSE])
  await seedQuizzes(page, [STRONG_QUIZ])
  await seedQuizAttempts(page, [STRONG_ATTEMPT])
  await seedContentProgress(page, [STRONG_PROGRESS])
  await seedStudySessions(page, [STRONG_SESSION])
}

// ── Tests ──────────────────────────────────────────────────────

test.describe('E71-S03: Knowledge Map Suggested Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock date in browser for deterministic score computation
    await page.addInitScript(`{
      const FIXED = ${new Date(FIXED_DATE).getTime()};
      const OrigDate = Date;
      class MockDate extends OrigDate {
        constructor(...args) {
          if (args.length === 0) super(FIXED);
          else super(...args);
        }
        static now() { return FIXED; }
      }
      globalThis.Date = MockDate;
    }`)
    await page.goto('/')
    await dismissOnboarding(page)
  })

  test('AC-11: Panel visible with action cards when declining topics are seeded', async ({
    page,
  }) => {
    await seedDecliningTopics(page)
    await page.goto('/knowledge-map')

    const panel = page.getByTestId('suggested-actions-panel')
    await expect(panel).toBeVisible()

    // At least one action card should be rendered
    const cards = page.getByTestId('action-card')
    await expect(cards.first()).toBeVisible()
  })

  test('AC-12: CTA button navigates to expected route', async ({ page }) => {
    await seedDecliningTopics(page)
    await page.goto('/knowledge-map')

    const panel = page.getByTestId('suggested-actions-panel')
    await expect(panel).toBeVisible()

    // Click the first CTA button (Start Review / Take Quiz / Watch Lesson)
    const ctaButton = panel
      .getByTestId('action-card')
      .first()
      .getByRole('link', { name: /start review|take quiz|watch lesson/i })
    await expect(ctaButton).toBeVisible()
    await ctaButton.click()

    // URL should change to a flashcards, quiz, or courses route
    await expect(page).toHaveURL(/\/(flashcards|quiz|courses)/)
  })

  test('AC-4: Empty state when all topics are strong', async ({ page }) => {
    await seedStrongTopicsOnly(page)
    await page.goto('/knowledge-map')

    const panel = page.getByTestId('suggested-actions-panel')
    await expect(panel).toBeVisible()

    // Empty state message
    await expect(panel.getByText('All topics looking strong!')).toBeVisible()
  })

  test('AC-2/3: Responsive layout — desktop sidebar vs mobile inline', async ({ page }) => {
    await seedDecliningTopics(page)

    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/knowledge-map')
    const panel = page.getByTestId('suggested-actions-panel')
    await expect(panel).toBeVisible()

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/knowledge-map')
    // Panel should still be visible on mobile (rendered inline above topic list)
    await expect(page.getByTestId('suggested-actions-panel')).toBeVisible()
  })
})
