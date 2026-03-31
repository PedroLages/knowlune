/**
 * E91-S10: Course Hero Overview Page
 *
 * Tests the /courses/:courseId/overview route with hero section,
 * stats row, curriculum accordion, CTA card, and responsive layout.
 */
import { test, expect } from '../../support/fixtures'
import { FIXED_DATE } from '../../utils/test-time'
import { seedImportedCourses, seedImportedVideos, seedImportedPdfs } from '../../support/helpers/indexeddb-seed'
import { navigateAndWait } from '../../support/helpers/navigation'

const COURSE_ID = 'e91-s10-test-course'
const VIDEO_1_ID = 'e91-s10-video-1'
const VIDEO_2_ID = 'e91-s10-video-2'
const PDF_ID = 'e91-s10-pdf-1'

const TEST_COURSE = {
  id: COURSE_ID,
  name: 'Test Overview Course',
  description: 'A course about testing overview pages.',
  importedAt: FIXED_DATE,
  category: 'Development',
  tags: ['testing', 'e2e', 'playwright'],
  status: 'active',
  videoCount: 2,
  pdfCount: 1,
}

const TEST_VIDEOS = [
  {
    id: VIDEO_1_ID,
    courseId: COURSE_ID,
    filename: 'intro-to-testing.mp4',
    path: 'Module 1/intro-to-testing.mp4',
    order: 0,
    duration: 3720, // 1:02:00
    fileSize: 100000,
  },
  {
    id: VIDEO_2_ID,
    courseId: COURSE_ID,
    filename: 'advanced-patterns.mp4',
    path: 'Module 1/advanced-patterns.mp4',
    order: 1,
    duration: 1800, // 30:00
    fileSize: 80000,
  },
]

const TEST_PDFS = [
  {
    id: PDF_ID,
    courseId: COURSE_ID,
    filename: 'cheatsheet.pdf',
    path: 'Module 1/cheatsheet.pdf',
    order: 2,
    pageCount: 5,
  },
]

async function seedTestData(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await seedImportedPdfs(page, TEST_PDFS)
}

test.describe('Course Overview Page (E91-S10)', () => {
  test('renders hero section with course title', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    await expect(page.getByTestId('course-overview-page')).toBeVisible()
    await expect(page.getByTestId('course-overview-hero')).toBeVisible()
    await expect(page.getByTestId('course-overview-title')).toHaveText('Test Overview Course')
  })

  test('displays stats row with correct counts', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    const stats = page.getByTestId('course-overview-stats')
    await expect(stats).toBeVisible()

    // Duration stat (3720 + 1800 = 5520s = 1:32:00)
    await expect(stats.getByText('1:32:00')).toBeVisible()
    // Total lessons (2 videos + 1 pdf = 3)
    await expect(stats.getByText('3', { exact: true })).toBeVisible()
    // Videos count
    await expect(stats.getByText('2', { exact: true })).toBeVisible()
    // PDFs count
    await expect(stats.getByText('1', { exact: true })).toBeVisible()
  })

  test('shows description in about section', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    await expect(page.getByTestId('course-overview-description')).toHaveText(
      'A course about testing overview pages.'
    )
  })

  test('shows tags in What You\'ll Learn section', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    const tagsList = page.getByTestId('course-overview-tags')
    await expect(tagsList).toBeVisible()
    await expect(tagsList.getByText('Testing')).toBeVisible()
    await expect(tagsList.getByText('E2e')).toBeVisible()
  })

  test('shows curriculum accordion with lessons', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    const curriculum = page.getByTestId('course-overview-curriculum')
    await expect(curriculum).toBeVisible()

    // First group should be auto-expanded
    await expect(page.getByTestId(`curriculum-lesson-${VIDEO_1_ID}`)).toBeVisible()
    await expect(page.getByText('intro-to-testing')).toBeVisible()
  })

  test('CTA card shows Start Course for unstarted course', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}/overview`)

    const cta = page.getByTestId('course-overview-cta')
    await expect(cta).toBeVisible()
    await expect(cta.getByText('Start Course')).toBeVisible()
  })

  test('hides about section when no description', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedImportedCourses(page, [{ ...TEST_COURSE, id: 'no-desc', description: undefined }])
    await seedImportedVideos(page, TEST_VIDEOS.map(v => ({ ...v, courseId: 'no-desc' })))
    await navigateAndWait(page, '/courses/no-desc/overview')

    await expect(page.getByTestId('course-overview-page')).toBeVisible()
    await expect(page.getByTestId('course-overview-description')).not.toBeVisible()
  })

  test('View Overview button on course detail page', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}`)

    const overviewBtn = page.getByTestId('view-overview-button')
    await expect(overviewBtn).toBeVisible()
    await overviewBtn.click()
    await page.waitForURL(`**/courses/${COURSE_ID}/overview`)
    await expect(page.getByTestId('course-overview-page')).toBeVisible()
  })

  test('total duration shown in CourseHeader when videos have duration', async ({ page }) => {
    await seedTestData(page)
    await navigateAndWait(page, `/courses/${COURSE_ID}`)

    await expect(page.getByTestId('course-total-duration')).toBeVisible()
    await expect(page.getByTestId('course-total-duration')).toContainText('1:32:00 total')
  })

  test('total duration hidden when all videos have zero duration', async ({ page }) => {
    await navigateAndWait(page, '/')
    await seedImportedCourses(page, [{ ...TEST_COURSE, id: 'zero-dur' }])
    await seedImportedVideos(page, TEST_VIDEOS.map(v => ({ ...v, courseId: 'zero-dur', duration: 0 })))
    await navigateAndWait(page, '/courses/zero-dur')

    await expect(page.getByTestId('course-total-duration')).not.toBeVisible()
  })
})
