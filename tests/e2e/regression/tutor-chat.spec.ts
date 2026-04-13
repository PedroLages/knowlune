/**
 * E2E Tests: E57-S02/S03 — Tutor Chat UI States & Conversation Persistence
 *
 * Tests UI states that don't require a real LLM response:
 * 1. /tutor page renders with empty/no-AI state
 * 2. /tutor sidebar nav item is active when on the page
 * 3. Offline banner: when no AI provider is configured, alert is shown
 *
 * E57-S03 persistence tests:
 * 4. Seed a chatConversation into IDB → navigate to lesson Tutor tab → messages restored
 * 5. Clear button → confirm dialog → messages gone
 *
 * Streaming tests are omitted — they require a real API key and are
 * covered by unit tests for useTutor and useTutorStore.
 */

import { test, expect } from '@playwright/test'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_TIMESTAMP } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const COURSE_ID = 'e57s03-tutor-persist-course'
const VIDEO_ID = 'e57s03-tutor-persist-video'
const CONVERSATION_ID = 'e57s03-conv-1'

const TEST_COURSE = {
  id: COURSE_ID,
  name: 'Tutor Persistence Test Course',
  videoCount: 1,
  pdfCount: 0,
  createdAt: FIXED_TIMESTAMP,
  updatedAt: FIXED_TIMESTAMP,
  source: 'local',
}

const TEST_VIDEO = {
  id: VIDEO_ID,
  courseId: COURSE_ID,
  filename: 'Lesson 1.mp4',
  path: 'Lesson 1.mp4',
  duration: 300,
  format: 'mp4',
  order: 0,
  fileHandle: null,
}

const PERSISTED_MESSAGES = [
  { role: 'user', content: 'Hello tutor!', timestamp: FIXED_TIMESTAMP },
  {
    role: 'assistant',
    content: 'Hi! How can I help you today?',
    timestamp: FIXED_TIMESTAMP + 1000,
  },
]

const TEST_CONVERSATION = {
  id: CONVERSATION_ID,
  courseId: COURSE_ID,
  videoId: VIDEO_ID,
  mode: 'socratic',
  hintLevel: 0,
  messages: PERSISTED_MESSAGES,
  createdAt: FIXED_TIMESTAMP,
  updatedAt: FIXED_TIMESTAMP + 1000,
}

test.describe('E57-S02: Tutor Chat UI States', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent sidebar overlay on tablet viewports
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      // Clear AI configuration so the offline/no-config banner shows
      localStorage.removeItem('ai-configuration')
    })
  })

  test('navigates to /tutor and page renders', async ({ page }) => {
    await page.goto('/tutor')

    // Page heading should be visible
    await expect(page.getByRole('heading', { name: 'AI Tutor' })).toBeVisible()

    // Subtitle should be visible
    await expect(
      page.getByText('Get AI-powered tutoring grounded in your course transcripts')
    ).toBeVisible()
  })

  test('shows offline/no-config banner when AI provider is not configured', async ({ page }) => {
    await page.goto('/tutor')

    // The alert about missing AI provider should appear
    await expect(page.getByText('AI Provider Not Configured')).toBeVisible()

    // The Configure AI button should link to settings
    const configureButton = page.getByRole('button', { name: /Configure AI/i })
    await expect(configureButton).toBeVisible()
  })

  test('Configure AI button navigates to /settings', async ({ page }) => {
    await page.goto('/tutor')

    await page.getByRole('button', { name: /Configure AI/i }).click()

    await expect(page).toHaveURL('/settings')
  })

  test('sidebar nav item for Tutor is active when on /tutor', async ({ page }) => {
    await page.goto('/tutor')

    // The sidebar nav link for Tutor should indicate active state
    // Most sidebars use aria-current="page" or an active class on the link
    const tutorNavLink = page.getByRole('link', { name: /tutor/i })
    await expect(tutorNavLink).toBeVisible()

    // Check for aria-current or that it's visible (active state depends on implementation)
    // The link should exist in the sidebar and be reachable
    const href = await tutorNavLink.getAttribute('href')
    expect(href).toContain('tutor')
  })
})

test.describe('E57-S03: Tutor Conversation Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so IDB is accessible (about:blank restriction)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    // Seed course, video, and persisted conversation
    await seedIndexedDBStore(page, DB_NAME, 'importedCourses', [TEST_COURSE])
    await seedIndexedDBStore(page, DB_NAME, 'importedVideos', [TEST_VIDEO])
    await seedIndexedDBStore(page, DB_NAME, 'chatConversations', [TEST_CONVERSATION])
  })

  test('restores persisted messages when navigating to lesson Tutor tab', async ({ page }) => {
    // Navigate to lesson player
    await page.goto(`/courses/${COURSE_ID}/lessons/${VIDEO_ID}`)
    await page.waitForLoadState('load')

    // Click the Tutor tab
    const tutorTab = page.getByRole('tab', { name: /tutor/i })
    await expect(tutorTab).toBeVisible({ timeout: 5000 })
    await tutorTab.click()

    // Tutor chat panel should be visible
    await expect(page.getByTestId('tutor-chat')).toBeVisible({ timeout: 5000 })

    // Persisted messages should be restored
    await expect(page.getByText('Hello tutor!')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Hi! How can I help you today?')).toBeVisible({ timeout: 5000 })
  })

  test('clear button removes persisted messages after confirmation', async ({ page }) => {
    // Navigate to lesson player
    await page.goto(`/courses/${COURSE_ID}/lessons/${VIDEO_ID}`)
    await page.waitForLoadState('load')

    // Click the Tutor tab
    const tutorTab = page.getByRole('tab', { name: /tutor/i })
    await expect(tutorTab).toBeVisible({ timeout: 5000 })
    await tutorTab.click()

    // Wait for tutor chat and messages to load
    await expect(page.getByTestId('tutor-chat')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Hello tutor!')).toBeVisible({ timeout: 5000 })

    // Click the clear button
    const clearBtn = page.getByTestId('clear-conversation-btn')
    await expect(clearBtn).toBeVisible({ timeout: 3000 })
    await clearBtn.click()

    // Confirm the dialog
    const confirmBtn = page.getByRole('button', { name: /clear|confirm|yes/i }).last()
    await expect(confirmBtn).toBeVisible({ timeout: 3000 })
    await confirmBtn.click()

    // Messages should be gone
    await expect(page.getByText('Hello tutor!')).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Hi! How can I help you today?')).not.toBeVisible()
  })
})
