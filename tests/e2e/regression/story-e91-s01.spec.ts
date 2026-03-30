/**
 * E2E tests for E91-S01: Start/Continue CTA + Last Position Resume
 *
 * Validates CTA button behavior on the unified course detail page:
 * - Fresh course shows "Start Course"
 * - Course with progress shows "Continue Learning"
 * - Completed course shows "Review Course"
 * - CTA navigates to correct lesson URL
 * - Works for both local and YouTube courses
 */

import { test, expect } from '@playwright/test'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
} from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const TEST_COURSE_ID = 'e91-test-course-local'
const TEST_YOUTUBE_COURSE_ID = 'e91-test-course-youtube'
const VIDEO_1_ID = 'e91-video-1'
const VIDEO_2_ID = 'e91-video-2'
const VIDEO_3_ID = 'e91-video-3'

function makeLocalCourse(id: string = TEST_COURSE_ID) {
  return {
    id,
    name: 'Test Course for CTA',
    importedAt: FIXED_DATE,
    category: 'Development',
    tags: ['test'],
    status: 'active',
    videoCount: 3,
    pdfCount: 0,
  }
}

function makeYouTubeCourse() {
  return {
    id: TEST_YOUTUBE_COURSE_ID,
    name: 'YouTube CTA Test Course',
    importedAt: FIXED_DATE,
    category: 'Development',
    tags: ['youtube'],
    status: 'active',
    videoCount: 2,
    pdfCount: 0,
    source: 'youtube',
    youtubePlaylistId: 'PLtest123',
    youtubeChannelTitle: 'Test Channel',
  }
}

function makeVideos(courseId: string = TEST_COURSE_ID) {
  return [
    {
      id: VIDEO_1_ID,
      courseId,
      filename: 'Lesson 1 - Introduction',
      order: 0,
      duration: 600,
      path: '/videos/lesson1.mp4',
      format: 'mp4',
    },
    {
      id: VIDEO_2_ID,
      courseId,
      filename: 'Lesson 2 - Basics',
      order: 1,
      duration: 900,
      path: '/videos/lesson2.mp4',
      format: 'mp4',
    },
    {
      id: VIDEO_3_ID,
      courseId,
      filename: 'Lesson 3 - Advanced',
      order: 2,
      duration: 1200,
      path: '/videos/lesson3.mp4',
      format: 'mp4',
    },
  ]
}

test.describe('E91-S01: Course CTA Button', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to avoid about:blank SecurityError
    await page.goto('/')
    // Seed sidebar closed to prevent overlay blocking
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
  })

  test('AC1: Fresh course shows "Start Course" button linking to first lesson', async ({
    page,
  }) => {
    await seedImportedCourses(page, [makeLocalCourse()])
    await seedImportedVideos(page, makeVideos())

    await page.goto(`/courses/${TEST_COURSE_ID}`)

    const ctaButton = page.getByTestId('course-cta-button')
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toContainText('Start Course')

    // Click navigates to first lesson
    await ctaButton.click()
    await expect(page).toHaveURL(new RegExp(`/courses/${TEST_COURSE_ID}/lessons/${VIDEO_1_ID}`))
  })

  test('AC2: Course with progress shows "Continue Learning" with lesson title', async ({
    page,
  }) => {
    await seedImportedCourses(page, [makeLocalCourse()])
    await seedImportedVideos(page, makeVideos())

    // Seed progress for video 2 (partially watched)
    await seedIndexedDBStore(page, DB_NAME, 'progress', [
      {
        courseId: TEST_COURSE_ID,
        videoId: VIDEO_2_ID,
        currentTime: 300,
        completionPercentage: 50,
      },
    ])

    await page.goto(`/courses/${TEST_COURSE_ID}`)

    const ctaButton = page.getByTestId('course-cta-button')
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toContainText('Continue Learning')
    await expect(ctaButton).toContainText('Lesson 2')

    // Click navigates to the last-watched lesson
    await ctaButton.click()
    await expect(page).toHaveURL(new RegExp(`/courses/${TEST_COURSE_ID}/lessons/${VIDEO_2_ID}`))
  })

  test('AC3: Completed course shows "Review Course" button', async ({ page }) => {
    await seedImportedCourses(page, [makeLocalCourse()])
    await seedImportedVideos(page, makeVideos())

    // Seed all videos as completed (>=90%)
    await seedIndexedDBStore(page, DB_NAME, 'progress', [
      {
        courseId: TEST_COURSE_ID,
        videoId: VIDEO_1_ID,
        currentTime: 600,
        completionPercentage: 100,
      },
      {
        courseId: TEST_COURSE_ID,
        videoId: VIDEO_2_ID,
        currentTime: 900,
        completionPercentage: 95,
      },
      {
        courseId: TEST_COURSE_ID,
        videoId: VIDEO_3_ID,
        currentTime: 1200,
        completionPercentage: 100,
      },
    ])

    await page.goto(`/courses/${TEST_COURSE_ID}`)

    const ctaButton = page.getByTestId('course-cta-button')
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toContainText('Review Course')
  })

  test('AC5: CTA works for YouTube courses', async ({ page }) => {
    await seedImportedCourses(page, [makeYouTubeCourse()])
    await seedImportedVideos(page, [
      {
        id: 'yt-vid-1',
        courseId: TEST_YOUTUBE_COURSE_ID,
        filename: 'YouTube Lesson 1',
        order: 0,
        duration: 600,
        path: '',
        format: 'mp4',
      },
      {
        id: 'yt-vid-2',
        courseId: TEST_YOUTUBE_COURSE_ID,
        filename: 'YouTube Lesson 2',
        order: 1,
        duration: 900,
        path: '',
        format: 'mp4',
      },
    ])

    await page.goto(`/courses/${TEST_YOUTUBE_COURSE_ID}`)

    const ctaButton = page.getByTestId('course-cta-button')
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toContainText('Start Course')
  })

  test('AC6: CTA button uses brand variant styling', async ({ page }) => {
    await seedImportedCourses(page, [makeLocalCourse()])
    await seedImportedVideos(page, makeVideos())

    await page.goto(`/courses/${TEST_COURSE_ID}`)

    const ctaButton = page.getByTestId('course-cta-button')
    await expect(ctaButton).toBeVisible()

    // Verify the button has brand variant (data attribute or CSS class check)
    // The Button component with variant="brand" adds specific styling
    // Verify the button has brand variant styling (bg-brand class)
    await expect(ctaButton).toHaveClass(/bg-brand/)
  })
})
