import { test, expect } from '@playwright/test'

test('Week 4 - Progress Chart visualization', async ({ page }) => {
  await page.goto('/')

  // Add comprehensive test data with varied activity across 14 days
  await page.evaluate(() => {
    const now = new Date()

    // Helper to create date N days ago
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

    // Course progress data
    const progress = {
      'operative-six': {
        courseId: 'operative-six',
        completedLessons: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5'],
        lastWatchedLesson: 'lesson-5',
        notes: {
          'lesson-1': 'Foundation concepts',
          'lesson-3': 'Key patterns',
        },
        startedAt: daysAgo(13).toISOString(),
        lastAccessedAt: now.toISOString(),
      },
      '6mx': {
        courseId: '6mx',
        completedLessons: ['lesson-1', 'lesson-2', 'lesson-3'],
        lastWatchedLesson: 'lesson-4',
        notes: {
          'lesson-2': 'Important review',
        },
        startedAt: daysAgo(10).toISOString(),
        lastAccessedAt: daysAgo(1).toISOString(),
      },
    }

    // Study log with varied activity across 14 days
    const studyLog = [
      // Today (5 actions)
      {
        type: 'lesson_complete',
        courseId: 'operative-six',
        lessonId: 'lesson-5',
        timestamp: now.toISOString(),
      },
      {
        type: 'video_progress',
        courseId: 'operative-six',
        lessonId: 'lesson-5',
        timestamp: now.toISOString(),
      },
      {
        type: 'note_saved',
        courseId: 'operative-six',
        lessonId: 'lesson-3',
        timestamp: now.toISOString(),
      },
      {
        type: 'video_progress',
        courseId: '6mx',
        lessonId: 'lesson-4',
        timestamp: now.toISOString(),
      },
      { type: 'note_saved', courseId: '6mx', lessonId: 'lesson-2', timestamp: now.toISOString() },

      // 1 day ago (3 actions)
      {
        type: 'lesson_complete',
        courseId: 'operative-six',
        lessonId: 'lesson-4',
        timestamp: daysAgo(1).toISOString(),
      },
      {
        type: 'video_progress',
        courseId: 'operative-six',
        lessonId: 'lesson-4',
        timestamp: daysAgo(1).toISOString(),
      },
      {
        type: 'lesson_complete',
        courseId: '6mx',
        lessonId: 'lesson-3',
        timestamp: daysAgo(1).toISOString(),
      },

      // 4 days ago (6 actions - peak day)
      {
        type: 'lesson_complete',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(4).toISOString(),
      },
      {
        type: 'video_progress',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(4).toISOString(),
      },
      { type: 'course_started', courseId: 'operative-six', timestamp: daysAgo(4).toISOString() },
      {
        type: 'lesson_complete',
        courseId: '6mx',
        lessonId: 'lesson-1',
        timestamp: daysAgo(4).toISOString(),
      },
      {
        type: 'video_progress',
        courseId: '6mx',
        lessonId: 'lesson-1',
        timestamp: daysAgo(4).toISOString(),
      },
      { type: 'course_started', courseId: '6mx', timestamp: daysAgo(4).toISOString() },

      // 7 days ago (4 actions)
      {
        type: 'video_progress',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(7).toISOString(),
      },
      {
        type: 'note_saved',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(7).toISOString(),
      },
      {
        type: 'video_progress',
        courseId: '6mx',
        lessonId: 'lesson-1',
        timestamp: daysAgo(7).toISOString(),
      },
      {
        type: 'note_saved',
        courseId: '6mx',
        lessonId: 'lesson-1',
        timestamp: daysAgo(7).toISOString(),
      },

      // 13 days ago (4 actions)
      {
        type: 'video_progress',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(13).toISOString(),
      },
      {
        type: 'note_saved',
        courseId: 'operative-six',
        lessonId: 'lesson-1',
        timestamp: daysAgo(13).toISOString(),
      },
      { type: 'course_started', courseId: 'operative-six', timestamp: daysAgo(13).toISOString() },
      {
        type: 'video_progress',
        courseId: '6mx',
        lessonId: 'lesson-1',
        timestamp: daysAgo(13).toISOString(),
      },
    ]

    localStorage.setItem('course-progress', JSON.stringify(progress))
    localStorage.setItem('study-log', JSON.stringify(studyLog))
  })

  await page.reload()

  // Wait for the chart to render by checking for key elements
  const chartTitle = page.getByText('Learning Activity')
  await expect(chartTitle).toBeVisible()

  const chartDescription = page.getByText('Your study activity over the last 14 days')
  await expect(chartDescription).toBeVisible()

  // Verify the chart rendered (Recharts wrapper exists)
  const chartWrapper = page.locator('.recharts-wrapper').first()
  await expect(chartWrapper).toBeVisible()

  // Verify chart has SVG bars rendered (confirms data is displayed)
  const chartBars = page.locator('.recharts-bar-rectangle')
  await expect(chartBars.first()).toBeVisible()
})
