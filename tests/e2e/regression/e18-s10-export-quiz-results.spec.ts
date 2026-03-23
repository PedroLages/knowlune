/**
 * E18-S10: Export Quiz Results (QFR47)
 *
 * Acceptance Criteria:
 *   AC1 — Export button visible in Reports section when quiz attempts exist
 *   AC2 — CSV export downloads a zip with quiz-attempts.csv and quiz-questions.csv
 *   AC3 — PDF export downloads a .pdf file (with summary stats in content)
 *   AC4 — Export button disabled with tooltip when no quiz attempts exist
 */

import { test, expect } from '@playwright/test'
import { seedQuizzes, seedQuizAttempts, seedNotes } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

// A minimal note that triggers hasActivity (studyNotes > 0) in Reports.tsx,
// making the analytics section visible without any quiz attempts.
const SEED_NOTE = {
  id: 'note-export-test',
  courseId: 'course-export-test',
  videoId: 'lesson-export-test',
  content: '<p>Test note for export</p>',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: [],
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TEST_QUIZ = {
  id: 'quiz-export-test',
  lessonId: 'lesson-export-test',
  title: 'Test Export Quiz',
  description: 'A quiz for export testing',
  questions: [
    {
      id: 'q1',
      order: 1,
      type: 'multiple-choice',
      text: 'What is the capital of France?',
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
      correctAnswer: 'Paris',
      explanation: 'Paris is the capital of France.',
      points: 1,
    },
    {
      id: 'q2',
      order: 2,
      type: 'true-false',
      text: 'The Earth is flat.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'The Earth is approximately spherical.',
      points: 1,
    },
  ],
  timeLimit: null,
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const TEST_ATTEMPT = {
  id: 'attempt-export-test',
  quizId: 'quiz-export-test',
  answers: [
    {
      questionId: 'q1',
      userAnswer: 'Paris',
      isCorrect: true,
      pointsEarned: 1,
      pointsPossible: 1,
    },
    {
      questionId: 'q2',
      userAnswer: 'False',
      isCorrect: true,
      pointsEarned: 1,
      pointsPossible: 1,
    },
  ],
  score: 2,
  percentage: 100,
  passed: true,
  timeSpent: 125000,
  completedAt: FIXED_DATE,
  startedAt: FIXED_DATE,
  timerAccommodation: 'standard',
}

// ---------------------------------------------------------------------------
// AC4: Disabled state (no attempts)
// ---------------------------------------------------------------------------

test.describe('AC4 — disabled export when no quiz attempts', () => {
  test('export button is disabled with tooltip when no attempts', async ({ page }) => {
    // Seed a note so hasActivity=true (studyNotes > 0) and the Reports analytics
    // section shows, but no quiz attempts so the export button stays disabled.
    await page.goto('/reports')
    await seedNotes(page, [SEED_NOTE])
    await page.reload()
    await page.waitForLoadState('networkidle')

    // The export card should be visible
    const exportCard = page.getByTestId('quiz-export-card')
    await expect(exportCard).toBeVisible()

    // The button should have aria-disabled
    const exportButton = page.getByTestId('quiz-export-button')
    await expect(exportButton).toBeVisible()
    await expect(exportButton).toHaveAttribute('aria-disabled', 'true')

    // Tooltip appears on hover of the span wrapper
    const tooltipTrigger = exportCard.locator('span[tabindex="0"]')
    await tooltipTrigger.hover()

    // Tooltip text should be visible (use first() — Radix renders tooltip content twice in DOM)
    await expect(page.getByText('Complete a quiz to enable export').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC1: Export button visible when attempts exist
// ---------------------------------------------------------------------------

test.describe('AC1 — export button enabled when quiz attempts exist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports')
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_ATTEMPT])
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('export button is visible and enabled when attempts exist', async ({ page }) => {
    const exportCard = page.getByTestId('quiz-export-card')
    await expect(exportCard).toBeVisible()

    const exportButton = page.getByTestId('quiz-export-button')
    await expect(exportButton).toBeVisible()
    await expect(exportButton).not.toHaveAttribute('aria-disabled', 'true')
    await expect(exportButton).not.toBeDisabled()
  })

  test('shows attempt and quiz count summary', async ({ page }) => {
    const exportCard = page.getByTestId('quiz-export-card')
    // Should mention "1 attempt" and "1 quiz"
    await expect(exportCard).toContainText('1 attempt')
    await expect(exportCard).toContainText('1 quiz')
  })
})

// ---------------------------------------------------------------------------
// AC2: CSV export downloads zip with correct files
// ---------------------------------------------------------------------------

test.describe('AC2 — CSV export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports')
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_ATTEMPT])
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('CSV export triggers zip download', async ({ page }) => {
    // Start listening for download before clicking
    const downloadPromise = page.waitForEvent('download')

    // Open dropdown and select CSV
    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-csv').click()

    const download = await downloadPromise

    // Verify filename pattern
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^knowlune-quiz-results-\d{4}-\d{2}-\d{2}\.zip$/)
  })

  test('CSV zip contains both expected files', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')

    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-csv').click()

    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()

    if (downloadPath) {
      const JSZip = (await import('jszip')).default
      const fs = await import('fs/promises')
      const zipBuffer = await fs.readFile(downloadPath)
      const zip = await JSZip.loadAsync(zipBuffer)

      // Both CSV files must exist
      expect(zip.files['quiz-attempts.csv']).toBeTruthy()
      expect(zip.files['quiz-questions.csv']).toBeTruthy()

      // Verify attempts CSV contains quiz data
      const attemptsCsv = await zip.files['quiz-attempts.csv'].async('string')
      expect(attemptsCsv).toContain('Test Export Quiz')
      expect(attemptsCsv).toContain('Pass')
      expect(attemptsCsv).toContain('100.0')

      // Verify questions CSV contains question data
      const questionsCsv = await zip.files['quiz-questions.csv'].async('string')
      expect(questionsCsv).toContain('What is the capital of France?')
      expect(questionsCsv).toContain('Correct')
    }
  })

  test('shows success toast after CSV export', async ({ page }) => {
    // Suppress download dialog
    page.on('download', () => {})

    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-csv').click()

    await expect(page.getByText('Quiz results (CSV) exported')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: PDF export downloads .pdf file
// ---------------------------------------------------------------------------

test.describe('AC3 — PDF export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports')
    await seedQuizzes(page, [TEST_QUIZ])
    await seedQuizAttempts(page, [TEST_ATTEMPT])
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('PDF export triggers .pdf download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')

    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-pdf').click()

    const download = await downloadPromise

    // Verify filename pattern
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^knowlune-quiz-results-\d{4}-\d{2}-\d{2}\.pdf$/)
  })

  test('PDF file is non-empty and starts with PDF header', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download')

    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-pdf').click()

    const download = await downloadPromise
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()

    if (downloadPath) {
      const fs = await import('fs/promises')
      const buffer = await fs.readFile(downloadPath)
      // PDF files start with "%PDF"
      expect(buffer.subarray(0, 4).toString()).toBe('%PDF')
    }
  })

  test('shows success toast after PDF export', async ({ page }) => {
    page.on('download', () => {})

    await page.getByTestId('quiz-export-button').click()
    await page.getByTestId('quiz-export-pdf').click()

    await expect(page.getByText('Quiz results (PDF) exported')).toBeVisible()
  })
})
