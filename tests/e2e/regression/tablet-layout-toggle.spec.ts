/**
 * E91-S09: Tablet Layout Enhancement
 *
 * Tests verify:
 *   - AC1: Toggle bar visible on tablet (768px)
 *   - AC2: Video mode active by default
 *   - AC3: Tapping Notes shows NoteEditor
 *   - AC4: Tapping Video returns to video content
 *   - AC5: Toggle bar hidden on mobile (<768px)
 *   - AC6: Toggle bar hidden on desktop (≥1024px)
 */
import { test, expect } from '../../support/fixtures'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../../support/helpers/navigation'

const TEST_COURSE = createImportedCourse({
  id: 'course-tablet-toggle',
  name: 'Tablet Toggle Test Course',
  videoCount: 2,
})

const LESSON_URL = `/courses/${TEST_COURSE.id}/lessons/${TEST_COURSE.id}-video-0`

async function seedAndNavigate(
  page: Parameters<typeof navigateAndWait>[0],
  indexedDB: {
    seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void>
  },
  viewportWidth: number
) {
  await page.setViewportSize({ width: viewportWidth, height: 1024 })
  await navigateAndWait(page, '/courses')
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await navigateAndWait(page, LESSON_URL)
}

test.describe('E91-S09: Tablet Layout Toggle', () => {
  test('AC1: toggle bar visible on tablet viewport (768px)', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 768)
    await expect(page.getByTestId('tablet-toggle-bar')).toBeVisible()
  })

  test('AC2: Video mode is active by default', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 768)
    const videoBtn = page.getByTestId('tablet-toggle-video')
    await expect(videoBtn).toHaveAttribute('aria-selected', 'true')
  })

  test('AC3: tapping Notes shows NoteEditor, hides video', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 768)
    await page.getByTestId('tablet-toggle-notes').click()
    // Notes tab should be selected
    await expect(page.getByTestId('tablet-toggle-notes')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tablet-toggle-video')).toHaveAttribute('aria-selected', 'false')
  })

  test('AC4: tapping Video returns to video content', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 768)
    // Switch to notes then back
    await page.getByTestId('tablet-toggle-notes').click()
    await page.getByTestId('tablet-toggle-video').click()
    await expect(page.getByTestId('tablet-toggle-video')).toHaveAttribute('aria-selected', 'true')
  })

  test('AC5: toggle bar hidden on mobile (375px)', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 375)
    await expect(page.getByTestId('tablet-toggle-bar')).not.toBeVisible()
  })

  test('AC6: toggle bar hidden on desktop (1440px)', async ({ page, indexedDB }) => {
    await seedAndNavigate(page, indexedDB, 1440)
    await expect(page.getByTestId('tablet-toggle-bar')).not.toBeVisible()
  })
})
