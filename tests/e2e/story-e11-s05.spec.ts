import { test, expect } from '../support/fixtures'
import {
  seedImportedCourses,
  seedNotes,
  seedReviewRecords,
} from '../support/helpers/indexeddb-seed'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { createDexieNote } from '../support/fixtures/factories/note-factory'
import { createDueReviewRecord } from '../support/fixtures/factories/review-factory'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

/**
 * E11-S05: Interleaved Review Mode
 *
 * Tests map 1:1 to acceptance criteria.
 *
 * AC1: Notes from multiple courses surfaced in mixed sequence
 * AC2: Card-flip interface (prompt front, content back)
 * AC3: 3-grade rating (Hard/Good/Easy) updates review interval
 * AC4: Single-course fallback with informational message
 * AC5: Session summary on completion
 */

// Shared test data
const course1 = createImportedCourse({
  id: 'course-1',
  name: 'JavaScript Fundamentals',
  tags: ['javascript', 'programming'],
})
const course2 = createImportedCourse({
  id: 'course-2',
  name: 'React Patterns',
  tags: ['react', 'programming'],
})

const note1 = createDexieNote({
  id: 'note-1',
  courseId: 'course-1',
  videoId: 'video-1',
  content: 'Closures capture variables from their outer scope. This is fundamental to JavaScript.',
  tags: ['javascript', 'closures'],
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})
const note2 = createDexieNote({
  id: 'note-2',
  courseId: 'course-2',
  videoId: 'video-2',
  content:
    'React hooks let you use state in function components. useState is the most common hook.',
  tags: ['react', 'hooks'],
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})
const note3 = createDexieNote({
  id: 'note-3',
  courseId: 'course-1',
  videoId: 'video-3',
  content: 'Promises represent async operations. Async/await provides cleaner syntax for promises.',
  tags: ['javascript', 'async'],
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
})

const review1 = createDueReviewRecord({
  id: 'review-1',
  noteId: 'note-1',
  reviewedAt: getRelativeDate(-5),
  nextReviewAt: getRelativeDate(-1),
  interval: 4,
})
const review2 = createDueReviewRecord({
  id: 'review-2',
  noteId: 'note-2',
  reviewedAt: getRelativeDate(-3),
  nextReviewAt: getRelativeDate(-1),
  interval: 2,
})
const review3 = createDueReviewRecord({
  id: 'review-3',
  noteId: 'note-3',
  reviewedAt: getRelativeDate(-7),
  nextReviewAt: getRelativeDate(-2),
  interval: 5,
})

async function seedMultiCourseData(page: import('@playwright/test').Page) {
  await seedImportedCourses(page, [course1, course2])
  await seedNotes(page, [note1, note2, note3])
  await seedReviewRecords(page, [review1, review2, review3])
}

test.describe('E11-S05: Interleaved Review Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to initialise the app and database
    await page.goto('/')
    // Prevent sidebar overlay in tablet viewports
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
  })

  test('AC1: Notes from multiple courses are surfaced in a mixed sequence', async ({ page }) => {
    await seedMultiCourseData(page)
    await page.goto('/review/interleaved')

    // Wait for the review page to load and start session
    await expect(page.getByTestId('interleaved-review')).toBeVisible()
    await expect(page.getByTestId('interleaved-progress')).toBeVisible()

    // Verify first card shows a course name from our seeded data
    const firstCourseName = page.getByTestId('interleaved-course-name').first()
    await expect(firstCourseName).toBeVisible()

    // The progress should show "1 / 3" (3 notes total)
    await expect(page.getByTestId('interleaved-progress')).toContainText('1 / 3')
  })

  test('AC2: Card-flip interface shows prompt on front, content on back', async ({ page }) => {
    await seedMultiCourseData(page)
    await page.goto('/review/interleaved')

    // Front face should be visible
    const front = page.getByTestId('interleaved-card-front')
    await expect(front).toBeVisible()

    // Rating buttons should NOT be visible before flip
    await expect(page.getByTestId('rating-buttons')).not.toBeVisible()

    // Flip the card
    await front.click()

    // Back face should be visible with rating buttons
    // Wait for the flip animation
    await expect(page.getByTestId('rating-buttons')).toBeVisible({ timeout: 2000 })
  })

  test('AC3: Rating with Hard/Good/Easy updates and advances card', async ({ page }) => {
    await seedMultiCourseData(page)
    await page.goto('/review/interleaved')

    // Flip the first card
    await page.getByTestId('interleaved-card-front').click()

    // Wait for flip animation, then find the rating buttons
    const ratingButtons = page.getByTestId('rating-buttons')
    await expect(ratingButtons).toBeVisible({ timeout: 2000 })

    // All three rating buttons should be present
    await expect(ratingButtons.getByRole('button', { name: /Hard/i })).toBeVisible()
    await expect(ratingButtons.getByRole('button', { name: /Good/i })).toBeVisible()
    await expect(ratingButtons.getByRole('button', { name: /Easy/i })).toBeVisible()

    // Rate as "Good"
    await ratingButtons.getByRole('button', { name: /Good/i }).click()

    // Should advance to next card — progress should update
    await expect(page.getByTestId('interleaved-progress')).toContainText('2 / 3')

    // Front face of next card should be visible again (not flipped)
    await expect(page.getByTestId('interleaved-card-front')).toBeVisible()
  })

  test('AC4: Single-course fallback shows informational message', async ({ page }) => {
    // Seed only ONE course with notes
    const singleNote = createDexieNote({
      id: 'note-single',
      courseId: 'course-1',
      videoId: 'video-single',
      content: 'Single course test note.',
      tags: ['javascript'],
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })
    const singleReview = createDueReviewRecord({
      id: 'review-single',
      noteId: 'note-single',
    })

    await seedImportedCourses(page, [course1])
    await seedNotes(page, [singleNote])
    await seedReviewRecords(page, [singleReview])

    await page.goto('/review/interleaved')

    // Should show the single-course AlertDialog
    const dialog = page.getByTestId('single-course-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Single Course Detected')

    // Should have two action buttons
    await expect(dialog.getByRole('button', { name: /Continue Anyway/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Return to Review Queue/i })).toBeVisible()

    // Click "Continue Anyway" to proceed
    await dialog.getByRole('button', { name: /Continue Anyway/i }).click()

    // Should now be in review mode
    await expect(page.getByTestId('interleaved-progress')).toBeVisible()
  })

  test('AC5: Session summary displayed on completion', async ({ page }) => {
    // Seed 2 notes for a quick session
    await seedImportedCourses(page, [course1, course2])
    await seedNotes(page, [note1, note2])
    await seedReviewRecords(page, [review1, review2])

    await page.goto('/review/interleaved')

    // Wait for session to start
    await expect(page.getByTestId('interleaved-progress')).toBeVisible()

    // Rate first card
    await page.getByTestId('interleaved-card-front').click()
    await expect(page.getByTestId('rating-buttons')).toBeVisible({ timeout: 2000 })
    await page.getByTestId('rating-buttons').getByRole('button', { name: /Good/i }).click()

    // Wait for second card front to appear
    await expect(page.getByTestId('interleaved-card-front')).toBeVisible({ timeout: 2000 })

    // Rate second card
    await page.getByTestId('interleaved-card-front').click()
    await expect(page.getByTestId('rating-buttons')).toBeVisible({ timeout: 2000 })
    await page.getByTestId('rating-buttons').getByRole('button', { name: /Easy/i }).click()

    // Summary should appear
    const summary = page.getByTestId('interleaved-summary')
    await expect(summary).toBeVisible({ timeout: 5000 })

    // Verify summary content
    await expect(page.getByTestId('summary-total-reviewed')).toHaveText('2')
    await expect(page.getByTestId('summary-courses-covered')).toHaveText('2')

    // Action buttons should be visible
    await expect(summary.getByRole('button', { name: /Review More/i })).toBeVisible()
    await expect(summary.getByRole('button', { name: /Back to Queue/i })).toBeVisible()
  })
})
