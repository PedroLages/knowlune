import { test, expect } from '../support/fixtures'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { createDexieNote } from '../support/fixtures/factories/note-factory'

/**
 * E11-S05: Interleaved Review Mode
 *
 * ATDD failing tests — RED phase. These map 1:1 to acceptance criteria.
 *
 * AC1: Notes from multiple courses surfaced in mixed sequence weighted by topic similarity + time since last review
 * AC2: Card-flip interface (prompt front, content back)
 * AC3: 3-grade rating system (Hard/Good/Easy) updates review interval
 * AC4: Single-course fallback with informational message
 * AC5: Session summary on completion
 */

test.describe('E11-S05: Interleaved Review Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Prevent sidebar overlay in tablet viewports
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))

    // Seed two courses with notes for interleaved review
    const course1 = createImportedCourse({
      id: 'course-1',
      title: 'JavaScript Fundamentals',
      topic: 'programming',
    })
    const course2 = createImportedCourse({
      id: 'course-2',
      title: 'React Patterns',
      topic: 'programming',
    })
    await seedImportedCourses(page, [course1, course2])

    // Seed notes across both courses for review
    // Note: exact seeding will be refined during implementation
    // when the review data model is finalized
  })

  test('AC1: Notes from multiple courses are surfaced in a mixed sequence', async ({
    page,
  }) => {
    // Navigate to interleaved review mode
    // Expect notes from both courses appear in the review queue
    // Expect sequence is weighted (longer gaps / related topics first)
    test.fail() // RED — not yet implemented
  })

  test('AC2: Card-flip interface shows prompt on front, content on back', async ({
    page,
  }) => {
    // Start interleaved review
    // Expect card displays prompt (front)
    // Click/tap to flip
    // Expect card reveals content (back)
    test.fail() // RED — not yet implemented
  })

  test('AC3: Rating with Hard/Good/Easy updates review interval', async ({ page }) => {
    // Start interleaved review, flip a card
    // Expect 3 rating buttons visible: Hard, Good, Easy
    // Click a rating
    // Expect review interval and retention prediction updated
    test.fail() // RED — not yet implemented
  })

  test('AC4: Single-course fallback shows informational message', async ({ page }) => {
    // Seed only one course with notes
    // Activate interleaved review
    // Expect message: "interleaved review works best with multiple courses"
    // Expect options: proceed with single-course review OR return to standard queue
    test.fail() // RED — not yet implemented
  })

  test('AC5: Session summary displayed on completion', async ({ page }) => {
    // Complete all queued notes (or end session early)
    // Expect summary: total notes reviewed, ratings distribution,
    //   courses covered, estimated retention improvement
    test.fail() // RED — not yet implemented
  })
})
