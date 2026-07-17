import type { Page } from '@playwright/test'
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { makeQuestion, makeQuiz } from '../support/fixtures/factories/quiz-factory'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
  seedQuizzes,
} from '../support/helpers/seed-helpers'
import { navigateAndWait } from '../support/helpers/navigation'
import { FIXED_DATE } from '../utils/test-time'

const DB_NAME = 'ElearningDB'
const COURSE_ID = 'lesson-tools-reliability-course'
const FIRST_LESSON_ID = 'lesson-tools-first'
const SECOND_LESSON_ID = 'lesson-tools-second'

const course = createImportedCourse({
  id: COURSE_ID,
  name: 'Lesson Tools Reliability',
  videoCount: 2,
  pdfCount: 0,
})

const videos = [
  {
    id: FIRST_LESSON_ID,
    courseId: COURSE_ID,
    filename: '01-Reliable-Tools.mp4',
    path: '01-Reliable-Tools.mp4',
    duration: 300,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    serverUrl: '/lesson-tools-video.mp4',
  },
  {
    id: SECOND_LESSON_ID,
    courseId: COURSE_ID,
    filename: '02-Isolated-State.mp4',
    path: '02-Isolated-State.mp4',
    duration: 240,
    format: 'mp4',
    order: 1,
    fileHandle: null,
    serverUrl: '/lesson-tools-video.mp4',
  },
]

const caption = {
  courseId: COURSE_ID,
  videoId: FIRST_LESSON_ID,
  filename: '01-Reliable-Tools.vtt',
  content:
    'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nThis transcript is ready for reliable study tools.\n',
  format: 'vtt',
  createdAt: FIXED_DATE,
}

const olderQuestion = makeQuestion({
  id: 'older-question',
  text: 'This question belongs to the older quiz.',
})
const newestQuestion = makeQuestion({
  id: 'newest-question',
  text: 'This question belongs to the newest quiz.',
})
const quizzes = [
  makeQuiz({
    id: 'older-quiz',
    lessonId: FIRST_LESSON_ID,
    title: 'Older Lesson Quiz',
    questions: [olderQuestion],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    shuffleQuestions: false,
  }),
  makeQuiz({
    id: 'newest-quiz',
    lessonId: FIRST_LESSON_ID,
    title: 'Newest Lesson Quiz',
    questions: [newestQuestion],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    shuffleQuestions: false,
  }),
]

async function seedLessonTools(page: Page): Promise<void> {
  await navigateAndWait(page, '/courses')
  await seedImportedCourses(page, [course])
  await seedImportedVideos(page, videos)
  await seedIndexedDBStore(page, DB_NAME, 'videoCaptions', [caption])
  await seedQuizzes(page, quizzes)
}

async function openStudyTool(page: Page, name: string): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    await page.getByRole('tab', { name, exact: true }).click()
    return
  }

  await page.getByRole('combobox', { name: 'Study tool', exact: true }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

test.describe('Lesson tools reliability', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/lesson-tools-video.mp4', route =>
      route.fulfill({ status: 200, contentType: 'video/mp4', body: '' })
    )
    await seedLessonTools(page)
  })

  test('transcript-dependent controls agree on readiness across viewports', async ({ page }) => {
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${SECOND_LESSON_ID}`)

    await expect(page.getByText('Thinking Level')).toBeVisible()
    await expect(page.getByTestId('generate-quiz-button')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Generate Transcript First' })).toBeVisible()

    await page.getByRole('button', { name: 'Generate Transcript First' }).click()
    await expect(page.getByText('No transcript available')).toBeVisible()

    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}`)
    await openStudyTool(page, 'Transcript')
    await expect(page.getByText('This transcript is ready for reliable study tools.')).toBeVisible()

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
    expect(viewportFits).toBe(true)
  })

  test('the newest quiz version opens and completes the normal start flow', async ({ page }) => {
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}/quiz`)

    await expect(page.getByText('Newest Lesson Quiz')).toBeVisible()
    await expect(page.getByText('Older Lesson Quiz')).toHaveCount(0)
    await page.getByRole('button', { name: 'Start Quiz' }).click()
    await expect(page.getByText('This question belongs to the newest quiz.')).toBeVisible()
  })

  test('notes remain isolated to the lesson where they were saved', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Detailed editor interaction runs on desktop')
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}`)

    const firstEditor = page.getByRole('textbox', { name: 'Lesson notes editor' })
    await firstEditor.fill('A note that belongs only to the first lesson')
    await expect(page.getByTestId('note-autosave-indicator')).toContainText('Saved')

    const savedContent = await page.evaluate(async () => {
      const request = indexedDB.open('ElearningDB')
      return new Promise<string>((resolve, reject) => {
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('notes', 'readonly')
          const getAll = transaction.objectStore('notes').getAll()
          getAll.onsuccess = () => {
            database.close()
            resolve(String(getAll.result[0]?.content ?? ''))
          }
          getAll.onerror = () => reject(getAll.error)
        }
        request.onerror = () => reject(request.error)
      })
    })
    expect(savedContent).toContain('A note that belongs only to the first lesson')

    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${SECOND_LESSON_ID}`)
    const secondEditor = page.getByRole('textbox', { name: 'Lesson notes editor' })
    await expect(secondEditor).not.toContainText('A note that belongs only to the first lesson')

    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}`)
    await expect(page.getByRole('textbox', { name: 'Lesson notes editor' })).toContainText(
      'A note that belongs only to the first lesson'
    )
  })

  test('a bookmark can be deleted, restored, and deleted again', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Detailed undo interaction runs on desktop')
    await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${FIRST_LESSON_ID}`)
    await openStudyTool(page, 'Bookmarks')

    await page.getByTestId('add-bookmark-button').click()
    await expect(page.getByTestId('bookmark-entry')).toHaveCount(1)
    await page.getByRole('button', { name: 'Delete bookmark' }).click()
    await expect(page.getByTestId('bookmark-entry')).toHaveCount(0)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('bookmark-entry')).toHaveCount(1)
    await page.getByRole('button', { name: 'Delete bookmark' }).click()
    await expect(page.getByTestId('bookmark-entry')).toHaveCount(0)
  })
})
