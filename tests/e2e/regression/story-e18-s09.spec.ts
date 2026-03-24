/**
 * E2E tests for E18-S09: Configure Quiz Preferences in Settings
 *
 * Covers:
 * - AC1: Quiz Preferences section visible in Settings with all 3 controls
 * - AC2: Preferences persisted to localStorage with confirmation toast
 * - AC3: Quiz initialization reads saved preferences as defaults
 * - AC4: Defaults are used when no preferences configured
 */
import { test, expect } from '../../support/fixtures'
import { makeQuiz, makeQuestion } from '../../support/fixtures/factories/quiz-factory'
import { seedQuizzes } from '../../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_KEY = 'levelup-quiz-preferences'
const COURSE_ID = 'test-course-e18s09'
const LESSON_ID = 'test-lesson-e18s09'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const question = makeQuestion({
  id: 'q1-e18s09',
  order: 1,
  text: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctAnswer: 'Paris',
  explanation: 'Paris is the capital of France.',
  points: 1,
})

const timedQuiz = makeQuiz({
  id: 'quiz-e18s09-timed',
  lessonId: LESSON_ID,
  title: 'E18-S09 Timed Quiz',
  questions: [question],
  timeLimit: 10, // 10 minutes — with 150% = 15 min badge
  shuffleQuestions: false,
  shuffleAnswers: false,
})

const untimedQuiz = makeQuiz({
  id: 'quiz-e18s09-untimed',
  lessonId: LESSON_ID,
  title: 'E18-S09 Untimed Quiz',
  questions: [question],
  timeLimit: null,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to settings page with sidebar closed */
async function goToSettings(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
}

/** Navigate to quiz start screen with seeded quiz data */
async function goToQuiz(
  page: import('@playwright/test').Page,
  quiz: typeof timedQuiz,
  prefsJson?: string
) {
  await page.addInitScript(
    ({ sidebarKey, prefsKey, prefs }) => {
      localStorage.setItem(sidebarKey, 'false')
      if (prefs) localStorage.setItem(prefsKey, prefs)
    },
    { sidebarKey: 'knowlune-sidebar-v1', prefsKey: PREFS_KEY, prefs: prefsJson ?? null }
  )

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizzes(page, [quiz] as Record<string, unknown>[])
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

// ---------------------------------------------------------------------------
// Tests — Settings page
// ---------------------------------------------------------------------------

test.describe('E18-S09: Quiz Preferences in Settings', () => {
  // AC1: Quiz Preferences section visibility
  test('settings page shows Quiz Preferences section with all three controls', async ({ page }) => {
    await goToSettings(page)

    // Section is visible
    const section = page.getByTestId('quiz-preferences-section')
    await expect(section).toBeVisible()

    // Section title
    await expect(section.getByText('Quiz Preferences')).toBeVisible()

    // Timer RadioGroup
    await expect(section.getByTestId('timer-accommodation-group')).toBeVisible()

    // Feedback toggle
    await expect(section.getByTestId('immediate-feedback-toggle')).toBeVisible()

    // Shuffle toggle
    await expect(section.getByTestId('shuffle-questions-toggle')).toBeVisible()
  })

  // AC4: Defaults when no preferences configured
  test('settings page shows correct default values', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('quiz-preferences-section')

    // 1x (standard) timer should be selected — use ARIA role instead of CSS class
    await expect(section.getByRole('radio', { name: /1x — Standard timing/i })).toBeChecked()

    // Feedback and shuffle toggles should be off
    const feedbackToggle = section.getByTestId('immediate-feedback-toggle')
    const shuffleToggle = section.getByTestId('shuffle-questions-toggle')
    await expect(feedbackToggle).not.toBeChecked()
    await expect(shuffleToggle).not.toBeChecked()
  })

  // AC2: Persist timer preference with toast
  test('selecting timer option persists preference and shows toast', async ({ page }) => {
    await goToSettings(page)

    // Click "1.5x" timer option
    await page.getByTestId('timer-option-150%').click()

    // Toast should appear
    await expect(page.getByText('Quiz preferences saved')).toBeVisible()

    // Reload — preference should be restored
    await page.reload({ waitUntil: 'domcontentloaded' })

    const section = page.getByTestId('quiz-preferences-section')
    await expect(section.getByRole('radio', { name: /1\.5x — Extended time/i })).toBeChecked()
  })

  // AC2: Persist toggle preferences with toast
  test('toggling feedback and shuffle persists preferences and shows toast', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('quiz-preferences-section')

    // Toggle immediate feedback on
    await section.getByTestId('immediate-feedback-toggle').click()
    await expect(page.getByText('Quiz preferences saved')).toBeVisible()

    // Toggle shuffle on
    await section.getByTestId('shuffle-questions-toggle').click()
    await expect(page.getByText('Quiz preferences saved').first()).toBeVisible()

    // Reload — both should still be on
    await page.reload({ waitUntil: 'domcontentloaded' })

    const sectionAfter = page.getByTestId('quiz-preferences-section')
    await expect(sectionAfter.getByTestId('immediate-feedback-toggle')).toBeChecked()
    await expect(sectionAfter.getByTestId('shuffle-questions-toggle')).toBeChecked()
  })

  // AC2: All three timer options can be selected
  test('can switch between all three timer options', async ({ page }) => {
    await goToSettings(page)

    const section = page.getByTestId('quiz-preferences-section')

    await page.getByTestId('timer-option-200%').click()
    await expect(section.getByRole('radio', { name: /2x — Maximum extension/i })).toBeChecked()

    await page.getByTestId('timer-option-150%').click()
    await expect(section.getByRole('radio', { name: /1\.5x — Extended time/i })).toBeChecked()

    await page.getByTestId('timer-option-standard').click()
    await expect(section.getByRole('radio', { name: /1x — Standard timing/i })).toBeChecked()
  })
})

// ---------------------------------------------------------------------------
// Tests — Quiz integration
// ---------------------------------------------------------------------------

test.describe('E18-S09: Quiz reads preferences as defaults', () => {
  // AC3: Quiz reads timer accommodation preference as default
  test('quiz start screen reflects saved timer preference (150% → 15 min badge)', async ({
    page,
  }) => {
    const prefs = JSON.stringify({
      timerAccommodation: '150%',
      showImmediateFeedback: false,
      shuffleQuestions: false,
    })

    await goToQuiz(page, timedQuiz, prefs)

    // Start screen time badge should reflect 150% of 10 min = 15 min
    await expect(page.getByText('15 min')).toBeVisible()
  })

  // AC3: Quiz reads timer accommodation preference (standard = 10 min)
  test('quiz start screen uses standard timing when preference is standard', async ({ page }) => {
    await goToQuiz(page, timedQuiz)

    // Standard timing: 10 min (no multiplication)
    await expect(page.getByText('10 min')).toBeVisible()
  })

  // AC3: Quiz shows immediate feedback when preference is on
  test('answer feedback visible when showImmediateFeedback preference is true', async ({
    page,
  }) => {
    const prefs = JSON.stringify({
      timerAccommodation: 'standard',
      showImmediateFeedback: true,
      shuffleQuestions: false,
    })

    await goToQuiz(page, untimedQuiz, prefs)

    // Start the quiz
    await page.getByRole('button', { name: /start quiz/i }).click()

    // Answer the question
    await page.getByRole('radio', { name: 'Paris' }).click()

    // AnswerFeedback should be visible
    await expect(page.getByTestId('answer-feedback')).toBeVisible()
  })

  // AC4: No feedback when preference is off (default)
  test('answer feedback hidden when showImmediateFeedback is false (default)', async ({ page }) => {
    // No prefs set — default showImmediateFeedback: false
    await goToQuiz(page, untimedQuiz)

    // Start the quiz
    await page.getByRole('button', { name: /start quiz/i }).click()

    // Answer the question
    await page.getByRole('radio', { name: 'Paris' }).click()

    // AnswerFeedback should NOT be visible
    await expect(page.getByTestId('answer-feedback')).not.toBeVisible()
  })

  // AC3: Per-quiz override via Accessibility Accommodations modal
  test('per-quiz override changes timer from saved 150% (15 min) to 200% (20 min)', async ({
    page,
  }) => {
    const prefs = JSON.stringify({
      timerAccommodation: '150%',
      showImmediateFeedback: false,
      shuffleQuestions: false,
    })

    await goToQuiz(page, timedQuiz, prefs)

    // Start screen should initially reflect saved 150% preference → 15 min
    await expect(page.getByText('15 min')).toBeVisible()

    // Open the per-quiz Accessibility Accommodations modal
    await page.getByRole('button', { name: /accessibility accommodations/i }).click()

    // Modal should be visible with "Timer Accommodations" heading
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Timer Accommodations')).toBeVisible()

    // The 150% option should be pre-selected (matching saved preference)
    await expect(dialog.getByRole('radio', { name: /150% extended time/i })).toBeChecked()

    // Select 200% extended time
    await dialog.getByRole('radio', { name: /200% extended time/i }).click()
    await expect(dialog.getByRole('radio', { name: /200% extended time/i })).toBeChecked()

    // Save the per-quiz override
    await dialog.getByRole('button', { name: /save/i }).click()

    // Modal should close
    await expect(dialog).not.toBeVisible()

    // Start screen time badge should now show 200% of 10 min = 20 min
    await expect(page.getByText('20 min')).toBeVisible()
    await expect(page.getByText('15 min')).not.toBeVisible()
  })
})
