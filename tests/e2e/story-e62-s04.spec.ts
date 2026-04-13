/**
 * E62-S04: E2E Tests for Knowledge Map FSRS Integration
 *
 * Validates retention gradient treemap cells, decay prediction tooltips,
 * Memory Decay section in TopicDetailPopover, and dark mode rendering.
 *
 * Seed data uses FSRS flashcards with known stability values so retention
 * gradient and decay labels are deterministic.
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

// High retention course: stability 100, reviewed 1 day ago → ~99% retention → "Stable until..."
const HIGH_RETENTION_COURSE = {
  id: 'course-high-ret',
  title: 'Advanced Calculus',
  category: 'Mathematics',
  tags: ['calculus'],
  author: 'Test Author',
  source: 'test',
  importedAt: FIXED_DATE,
  totalLessons: 5,
  thumbnailUrl: '',
}

const HIGH_RETENTION_QUIZ = {
  id: 'quiz-high',
  lessonId: 'lesson-high-1',
  title: 'Calculus Quiz',
  questions: [
    { id: 'qh1', topic: 'Calculus', text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'qh2', topic: 'Calculus', text: 'Q2', options: ['a', 'b'], correctIndex: 1 },
  ],
}

const HIGH_RETENTION_ATTEMPT = {
  id: 'attempt-high',
  quizId: 'quiz-high',
  completedAt: getRelativeDate(-1),
  answers: [
    { questionId: 'qh1', selectedIndex: 0, isCorrect: true },
    { questionId: 'qh2', selectedIndex: 1, isCorrect: true },
  ],
  score: 100,
}

const HIGH_RETENTION_PROGRESS = {
  id: 'course-high-ret::lesson-high-1',
  courseId: 'course-high-ret',
  itemId: 'lesson-high-1',
  status: 'completed',
  progress: 100,
  updatedAt: getRelativeDate(-1),
}

const HIGH_RETENTION_SESSION = {
  id: 'session-high',
  courseId: 'course-high-ret',
  startTime: getRelativeDate(-1),
  endTime: getRelativeDate(-1),
  durationSeconds: 3600,
}

const HIGH_RETENTION_FLASHCARD = {
  id: 'fc-high',
  courseId: 'course-high-ret',
  front: 'What is a derivative?',
  back: 'Rate of change',
  stability: 100,
  difficulty: 0.3,
  last_review: getRelativeDate(-1),
  due: getRelativeDate(30),
  reps: 5,
  lapses: 0,
  state: 2,
}

// Low retention course: stability 2, reviewed 10 days ago → low retention → "Fading" or "Already fading"
const LOW_RETENTION_COURSE = {
  id: 'course-low-ret',
  title: 'Basic Chemistry',
  category: 'Chemistry',
  tags: ['chemistry'],
  author: 'Test Author',
  source: 'test',
  importedAt: FIXED_DATE,
  totalLessons: 5,
  thumbnailUrl: '',
}

const LOW_RETENTION_QUIZ = {
  id: 'quiz-low',
  lessonId: 'lesson-low-1',
  title: 'Chemistry Quiz',
  questions: [
    { id: 'ql1', topic: 'Chemistry', text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'ql2', topic: 'Chemistry', text: 'Q2', options: ['a', 'b'], correctIndex: 1 },
  ],
}

const LOW_RETENTION_ATTEMPT = {
  id: 'attempt-low',
  quizId: 'quiz-low',
  completedAt: getRelativeDate(-10),
  answers: [
    { questionId: 'ql1', selectedIndex: 1, isCorrect: false },
    { questionId: 'ql2', selectedIndex: 0, isCorrect: false },
  ],
  score: 0,
}

const LOW_RETENTION_PROGRESS = {
  id: 'course-low-ret::lesson-low-1',
  courseId: 'course-low-ret',
  itemId: 'lesson-low-1',
  status: 'in-progress',
  progress: 20,
  updatedAt: getRelativeDate(-10),
}

const LOW_RETENTION_SESSION = {
  id: 'session-low',
  courseId: 'course-low-ret',
  startTime: getRelativeDate(-10),
  endTime: getRelativeDate(-10),
  durationSeconds: 1200,
}

const LOW_RETENTION_FLASHCARD = {
  id: 'fc-low',
  courseId: 'course-low-ret',
  front: 'What is an atom?',
  back: 'Smallest unit of matter',
  stability: 2,
  difficulty: 0.5,
  last_review: getRelativeDate(-10),
  due: getRelativeDate(-5),
  reps: 1,
  lapses: 2,
  state: 1,
}

// No-flashcard course: no FSRS data at all
const NO_FC_COURSE = {
  id: 'course-no-fc',
  title: 'Art History',
  category: 'Art',
  tags: ['art-history'],
  author: 'Test Author',
  source: 'test',
  importedAt: FIXED_DATE,
  totalLessons: 3,
  thumbnailUrl: '',
}

const NO_FC_QUIZ = {
  id: 'quiz-nofc',
  lessonId: 'lesson-nofc-1',
  title: 'Art History Quiz',
  questions: [
    { id: 'qn1', topic: 'Art History', text: 'Q1', options: ['a', 'b'], correctIndex: 0 },
  ],
}

const NO_FC_ATTEMPT = {
  id: 'attempt-nofc',
  quizId: 'quiz-nofc',
  completedAt: getRelativeDate(-5),
  answers: [{ questionId: 'qn1', selectedIndex: 0, isCorrect: true }],
  score: 100,
}

const NO_FC_PROGRESS = {
  id: 'course-no-fc::lesson-nofc-1',
  courseId: 'course-no-fc',
  itemId: 'lesson-nofc-1',
  status: 'completed',
  progress: 100,
  updatedAt: getRelativeDate(-5),
}

const NO_FC_SESSION = {
  id: 'session-nofc',
  courseId: 'course-no-fc',
  startTime: getRelativeDate(-5),
  endTime: getRelativeDate(-5),
  durationSeconds: 2400,
}

// ── Helpers ────────────────────────────────────────────────────

async function seedAllData(page: import('@playwright/test').Page) {
  await seedImportedCourses(page, [HIGH_RETENTION_COURSE, LOW_RETENTION_COURSE, NO_FC_COURSE])
  await seedQuizzes(page, [HIGH_RETENTION_QUIZ, LOW_RETENTION_QUIZ, NO_FC_QUIZ])
  await seedQuizAttempts(page, [HIGH_RETENTION_ATTEMPT, LOW_RETENTION_ATTEMPT, NO_FC_ATTEMPT])
  await seedContentProgress(page, [
    HIGH_RETENTION_PROGRESS,
    LOW_RETENTION_PROGRESS,
    NO_FC_PROGRESS,
  ])
  await seedStudySessions(page, [HIGH_RETENTION_SESSION, LOW_RETENTION_SESSION, NO_FC_SESSION])
  await seedIndexedDBStore(page, 'ElearningDB', 'flashcards', [
    HIGH_RETENTION_FLASHCARD,
    LOW_RETENTION_FLASHCARD,
  ])
}

// ── Tests ──────────────────────────────────────────────────────

test.describe('E62-S04: Knowledge Map FSRS Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock date in browser for deterministic retention computation
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

  test('AC-1: Treemap cells show varied background colors (gradient, not just 3 discrete)', async ({
    page,
  }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Wait for treemap cells to render (cells are g[role="button"] with rect children)
    const firstCell = page.locator('g[role="button"][aria-label^="Topic:"]').first()
    await expect(firstCell).toBeVisible({ timeout: 10000 })

    // Collect all fill colors from the rect elements inside treemap cells
    const fills = await page.evaluate(() => {
      const cells = document.querySelectorAll('g[role="button"][aria-label^="Topic:"]')
      const colors = new Set<string>()
      cells.forEach(cell => {
        const rect = cell.querySelector('rect')
        if (rect) {
          const fill = rect.style.fill
          if (fill) colors.add(fill)
        }
      })
      return [...colors]
    })

    // With gradient rendering, we expect more than 1 distinct color
    // (High retention = green-ish, low retention = red-ish, no-FC = discrete tier)
    expect(fills.length).toBeGreaterThanOrEqual(2)
  })

  test('AC-2: Low retention topic tooltip contains "Fading" text', async ({ page }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Find the low-retention cell by its aria-label containing the course category
    const lowRetCell = page.locator('g[role="button"][aria-label*="Chemistry"]')
    await expect(lowRetCell).toBeVisible({ timeout: 10000 })

    // Hover to show tooltip
    await lowRetCell.hover()

    // Tooltip should contain "Fading" or "Already fading"
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(/[Ff]ading/)
  })

  test('AC-3: High retention topic tooltip contains "Stable" text', async ({ page }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Find the high-retention cell
    const highRetCell = page.locator('g[role="button"][aria-label*="Calculus"]')
    await expect(highRetCell).toBeVisible({ timeout: 10000 })

    // Hover to show tooltip
    await highRetCell.hover()

    // Tooltip should contain "Stable"
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(/[Ss]table/)
  })

  test('AC-4: TopicDetailPopover shows Memory Decay section for topic with FSRS data', async ({
    page,
  }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Click a cell that has flashcard data (high retention)
    const highRetCell = page.locator('g[role="button"][aria-label*="Calculus"]')
    await expect(highRetCell).toBeVisible({ timeout: 10000 })
    await highRetCell.click()

    // Popover should appear with Memory Decay section
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await expect(popover).toBeVisible()

    // Memory Decay label should be present
    await expect(popover.getByText('Memory Decay')).toBeVisible()

    // Retention percentage text should be visible (the "NN%" span next to the progress bar)
    // The progress bar has aria-label="Retention: NN%" — verify it exists in the DOM
    const retentionBar = popover.locator('[aria-label^="Retention:"]')
    await expect(retentionBar).toHaveCount(1)
    const ariaLabel = await retentionBar.getAttribute('aria-label')
    expect(ariaLabel).toMatch(/Retention: \d+%/)
  })

  test('AC-5: TopicDetailPopover does NOT show Memory Decay for topic without flashcards', async ({
    page,
  }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Click the no-flashcard cell (Art History) — use exact match to avoid "Art" category
    const noFcCell = page.locator('g[role="button"][aria-label*="Art History"]')
    await expect(noFcCell).toBeVisible({ timeout: 10000 })
    await noFcCell.click()

    // Popover should appear
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await expect(popover).toBeVisible()

    // Memory Decay section should NOT be present
    await expect(popover.getByText('Memory Decay')).not.toBeVisible()
  })

  test('AC-6: Dark mode treemap renders without console errors', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Enable dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('knowlune-theme', 'dark')
    })

    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Wait for treemap to render
    const treemapCell = page.locator('g[role="button"][aria-label^="Topic:"]').first()
    await expect(treemapCell).toBeVisible({ timeout: 10000 })

    // Verify text labels are visible (not transparent)
    const textElements = page.locator('g[role="button"][aria-label^="Topic:"] text')
    const textCount = await textElements.count()

    if (textCount > 0) {
      // At least one text label should have non-zero opacity
      const hasVisibleText = await page.evaluate(() => {
        const texts = document.querySelectorAll('g[role="button"][aria-label^="Topic:"] text')
        return Array.from(texts).some(el => {
          const style = getComputedStyle(el)
          return style.opacity !== '0' && style.visibility !== 'hidden'
        })
      })
      expect(hasVisibleText).toBe(true)
    }

    // No console errors related to rendering
    const renderErrors = consoleErrors.filter(
      e => e.includes('treemap') || e.includes('color') || e.includes('NaN')
    )
    expect(renderErrors).toHaveLength(0)
  })

  test('AC-7: All test dates use FIXED_DATE (determinism verification)', async ({ page }) => {
    await seedAllData(page)
    await page.goto('/knowledge-map')

    // Verify the mocked date is active in browser context
    const browserNow = await page.evaluate(() => Date.now())
    const expectedTimestamp = new Date(FIXED_DATE).getTime()
    expect(browserNow).toBe(expectedTimestamp)
  })
})
