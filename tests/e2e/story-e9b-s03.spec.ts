import { test, expect } from '@playwright/test'
import { seedImportedCourses } from '../support/helpers/indexeddb-seed'

/**
 * E9B-S03: AI Learning Path Generation
 *
 * Tests AI-powered learning path generation that orders courses by prerequisites.
 *
 * Acceptance Criteria:
 * - AC1: Show "Generate Learning Path" button when 2+ courses exist
 * - AC2: Display ordered course list with justifications after generation
 * - AC3: Allow drag-and-drop reordering with visual indicators for manual changes
 * - AC4: Regenerate path with confirmation dialog warning about overrides
 * - AC5: Show empty state message when < 2 courses
 * - AC6: Handle AI provider unavailability with retry option (2s timeout)
 */

test.describe('E9B-S03: AI Learning Path Generation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and initialize app
    await page.goto('/')

    // Prevent sidebar overlay in tablet viewports (640-1023px)
    await page.evaluate(() => localStorage.setItem('eduvi-sidebar-v1', 'false'))
  })

  test('AC1: Show Generate Learning Path button when 2+ courses exist', async ({ page }) => {
    // Seed 3 courses
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'completed',
        topics: ['Programming', 'Python'],
      },
      {
        id: 'python-web-dev',
        title: 'Python Web Development',
        status: 'in-progress',
        topics: ['Programming', 'Python', 'Web Development'],
      },
      {
        id: 'advanced-python',
        title: 'Advanced Python Techniques',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Navigate to AI Learning Path section
    // TODO: Replace with actual route once implemented
    await page.goto('/ai-learning-path')
    await page.waitForLoadState('networkidle')

    // Verify Generate Learning Path button is visible and enabled
    const generateButton = page.getByTestId('generate-learning-path-button')
    await expect(generateButton).toBeVisible()
    await expect(generateButton).toBeEnabled()
  })

  test('AC2: Display ordered course list with justifications after generation', async ({ page }) => {
    // Seed 3 courses
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
      {
        id: 'python-web-dev',
        title: 'Python Web Development',
        status: 'not-started',
        topics: ['Programming', 'Python', 'Web Development'],
      },
      {
        id: 'advanced-python',
        title: 'Advanced Python Techniques',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Mock AI provider response (ordered list with justifications)
    await page.route('**/api/ai/generate-learning-path', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learningPath: [
            {
              courseId: 'intro-to-python',
              position: 1,
              justification:
                'Foundational course covering Python basics - prerequisite for all other courses',
            },
            {
              courseId: 'python-web-dev',
              position: 2,
              justification: 'Applies Python fundamentals to web development - requires intro knowledge',
            },
            {
              courseId: 'advanced-python',
              position: 3,
              justification: 'Advanced concepts building on intermediate Python skills',
            },
          ],
        }),
      })
    })

    // Navigate to AI Learning Path section
    await page.goto('/ai-learning-path')
    await page.waitForLoadState('networkidle')

    // Click Generate Learning Path button
    const generateButton = page.getByTestId('generate-learning-path-button')
    await generateButton.click()

    // Wait for loading state
    await expect(page.getByText('Generating learning path...')).toBeVisible()

    // Verify ordered course list appears
    const learningPathList = page.getByTestId('learning-path-list')
    await expect(learningPathList).toBeVisible({ timeout: 10000 })

    // Verify course order
    const courseItems = learningPathList.locator('[data-testid^="learning-path-course-"]')
    await expect(courseItems).toHaveCount(3)

    // Verify first course is "Introduction to Python"
    const firstCourse = courseItems.nth(0)
    await expect(firstCourse).toContainText('Introduction to Python')

    // Verify justification text is displayed
    const firstJustification = firstCourse.getByTestId('course-justification')
    await expect(firstJustification).toContainText('Foundational course')
  })

  test('AC3: Allow drag-and-drop reordering with visual indicators', async ({ page }) => {
    // Seed 3 courses
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
      {
        id: 'python-web-dev',
        title: 'Python Web Development',
        status: 'not-started',
        topics: ['Programming', 'Python', 'Web Development'],
      },
      {
        id: 'advanced-python',
        title: 'Advanced Python Techniques',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Mock AI provider response
    await page.route('**/api/ai/generate-learning-path', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          learningPath: [
            { courseId: 'intro-to-python', position: 1, justification: 'Intro course' },
            { courseId: 'python-web-dev', position: 2, justification: 'Web dev course' },
            { courseId: 'advanced-python', position: 3, justification: 'Advanced course' },
          ],
        }),
      })
    })

    // Navigate and generate path
    await page.goto('/ai-learning-path')
    await page.getByTestId('generate-learning-path-button').click()
    await expect(page.getByTestId('learning-path-list')).toBeVisible({ timeout: 10000 })

    // Drag third course to first position
    const learningPathList = page.getByTestId('learning-path-list')
    const thirdCourse = learningPathList.locator('[data-testid="learning-path-course-2"]')
    const firstCourse = learningPathList.locator('[data-testid="learning-path-course-0"]')

    // Perform drag and drop
    await thirdCourse.dragTo(firstCourse)

    // Verify course has moved to first position
    const reorderedFirstCourse = learningPathList.locator('[data-testid="learning-path-course-0"]')
    await expect(reorderedFirstCourse).toContainText('Advanced Python')

    // Verify visual indicator shows manual override (e.g., badge or icon)
    const manualOverrideBadge = reorderedFirstCourse.getByTestId('manual-override-indicator')
    await expect(manualOverrideBadge).toBeVisible()
    await expect(manualOverrideBadge).toContainText('Manual')

    // Verify custom sequence is persisted (reload page)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify order is still custom after reload
    const persistedFirstCourse = learningPathList.locator('[data-testid="learning-path-course-0"]')
    await expect(persistedFirstCourse).toContainText('Advanced Python')
  })

  test('AC4: Regenerate path with confirmation dialog', async ({ page }) => {
    // Seed 3 courses
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
      {
        id: 'python-web-dev',
        title: 'Python Web Development',
        status: 'not-started',
        topics: ['Programming', 'Python', 'Web Development'],
      },
      {
        id: 'advanced-python',
        title: 'Advanced Python Techniques',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Mock AI provider response
    await page.route('**/api/ai/generate-learning-path', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          learningPath: [
            { courseId: 'intro-to-python', position: 1, justification: 'Intro' },
            { courseId: 'python-web-dev', position: 2, justification: 'Web' },
            { courseId: 'advanced-python', position: 3, justification: 'Advanced' },
          ],
        }),
      })
    })

    // Navigate, generate, and manually reorder
    await page.goto('/ai-learning-path')
    await page.getByTestId('generate-learning-path-button').click()
    await expect(page.getByTestId('learning-path-list')).toBeVisible({ timeout: 10000 })

    // Simulate manual reordering (drag course)
    const learningPathList = page.getByTestId('learning-path-list')
    const thirdCourse = learningPathList.locator('[data-testid="learning-path-course-2"]')
    const firstCourse = learningPathList.locator('[data-testid="learning-path-course-0"]')
    await thirdCourse.dragTo(firstCourse)

    // Click Regenerate button
    const regenerateButton = page.getByTestId('regenerate-learning-path-button')
    await expect(regenerateButton).toBeVisible()
    await regenerateButton.click()

    // Verify confirmation dialog appears
    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible()

    // Verify warning message about overrides
    await expect(confirmDialog).toContainText('manual overrides will be replaced')

    // Confirm regeneration
    const confirmButton = confirmDialog.getByRole('button', { name: /confirm|continue/i })
    await confirmButton.click()

    // Verify loading state
    await expect(page.getByText('Generating learning path...')).toBeVisible()

    // Verify fresh ordering is displayed (back to AI-suggested order)
    await expect(learningPathList).toBeVisible({ timeout: 10000 })
    const newFirstCourse = learningPathList.locator('[data-testid="learning-path-course-0"]')
    await expect(newFirstCourse).toContainText('Introduction to Python')

    // Verify manual override indicator is gone
    const manualBadge = newFirstCourse.getByTestId('manual-override-indicator')
    await expect(manualBadge).not.toBeVisible()
  })

  test('AC5: Show empty state when fewer than 2 courses', async ({ page }) => {
    // Seed only 1 course
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Navigate to AI Learning Path section
    await page.goto('/ai-learning-path')
    await page.waitForLoadState('networkidle')

    // Verify empty state message is displayed
    const emptyStateMessage = page.getByTestId('learning-path-empty-state')
    await expect(emptyStateMessage).toBeVisible()
    await expect(emptyStateMessage).toContainText('at least 2 courses are needed')

    // Verify Generate Learning Path button is disabled
    const generateButton = page.getByTestId('generate-learning-path-button')
    await expect(generateButton).toBeVisible()
    await expect(generateButton).toBeDisabled()
  })

  test('AC6: Handle AI provider unavailability with retry', async ({ page }) => {
    // Seed 3 courses
    await seedImportedCourses(page, [
      {
        id: 'intro-to-python',
        title: 'Introduction to Python',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
      {
        id: 'python-web-dev',
        title: 'Python Web Development',
        status: 'not-started',
        topics: ['Programming', 'Python', 'Web Development'],
      },
      {
        id: 'advanced-python',
        title: 'Advanced Python Techniques',
        status: 'not-started',
        topics: ['Programming', 'Python'],
      },
    ])

    // Mock AI provider timeout/failure
    await page.route('**/api/ai/generate-learning-path', async route => {
      // Delay response by 3 seconds (beyond 2s timeout)
      await new Promise(resolve => setTimeout(resolve, 3000))
      await route.abort('timedout')
    })

    // Navigate to AI Learning Path section
    await page.goto('/ai-learning-path')
    await page.waitForLoadState('networkidle')

    // Click Generate Learning Path button
    const generateButton = page.getByTestId('generate-learning-path-button')
    await generateButton.click()

    // Verify "AI unavailable" status appears within 2 seconds
    const errorStatus = page.getByTestId('ai-unavailable-status')
    await expect(errorStatus).toBeVisible({ timeout: 2500 })
    await expect(errorStatus).toContainText('AI unavailable')

    // Verify retry button is present
    const retryButton = page.getByTestId('retry-learning-path-button')
    await expect(retryButton).toBeVisible()

    // Verify page functionality is not disrupted (navigation still works)
    const pageTitle = page.getByRole('heading', { name: /learning path/i })
    await expect(pageTitle).toBeVisible()

    // Verify generate button is still enabled for retry
    await expect(generateButton).toBeEnabled()
  })
})
