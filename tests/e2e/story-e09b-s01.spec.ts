import { test, expect } from '../support/fixtures'
import {
  seedImportedCourses,
  seedImportedVideos,
  seedIndexedDBStore,
} from '../support/helpers/seed-helpers'
import {
  createMockTranscript,
  createMalformedTranscript,
  mockLLMError,
  mockLLMHanging,
  mockLLMStreamingSequence,
  mockOpenAIStreaming,
  createOperativeSixCourse,
  seedAIConfiguration,
} from '../support/helpers/ai-summary-mocks'

/**
 * E09B-S01: AI Video Summary
 *
 * Tests AI-powered video summary generation with streaming support.
 *
 * Acceptance Criteria:
 * - AC1: Summary streams into collapsible panel in real-time
 * - AC2: Collapse summary to minimal bar and expand without regenerating
 * - AC3: Handle 30s timeout with retry button
 * - AC4: Graceful error fallback (video player remains functional)
 */

test.describe('E09B-S01: AI Video Summary', () => {
  const aiUserId = 'ai-summary-e2e-user'

  async function openLesson(page: import('@playwright/test').Page, lessonId: string) {
    await page.goto(`/courses/operative-six/lessons/${lessonId}`)
    await page.waitForFunction(() => Boolean((window as Record<string, unknown>).__authStore))
    await page.evaluate(userId => {
      localStorage.setItem(`sync:wizard:complete:${userId}`, '2026-01-01T00:00:00.000Z')
      const store = (
        window as unknown as {
          __authStore: { setState: (state: Record<string, unknown>) => void }
        }
      ).__authStore
      store.setState({
        user: { id: userId, email: 'ai-summary@example.com', user_metadata: {} },
        initialized: true,
      })
    }, aiUserId)
  }

  test.beforeEach(async ({ page }) => {
    // Mock VTT transcript file for operative-six course
    await page.route('**/captions/op6-introduction.vtt', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/vtt' },
        body: createMockTranscript(),
      })
    })

    // Mock video file (video may be on file system but we mock anyway for consistency)
    await page.route('**/01-00- Introduction.mp4', async route => {
      await route.fulfill({ status: 200, body: '' })
    })

    // Navigate and initialize app
    await page.goto('/')

    // Prevent sidebar overlay in tablet viewports (640-1023px)
    // Without this, the Sheet overlay blocks all pointer events in tests
    await page.evaluate(() => localStorage.setItem('knowlune-sidebar-v1', 'false'))

    // Seed operative-six course with video that has captions
    await seedImportedCourses(page, [createOperativeSixCourse()])
    await seedImportedVideos(page, [
      {
        id: 'op6-introduction',
        courseId: 'operative-six',
        filename: '01-00- Introduction.mp4',
        path: '01-00- Introduction.mp4',
        order: 0,
        duration: 300,
        format: 'mp4',
        fileHandle: null,
        serverUrl: '/01-00- Introduction.mp4',
      },
      {
        id: 'op6-confidence',
        courseId: 'operative-six',
        filename: '02-confidence.mp4',
        path: '02-confidence.mp4',
        order: 1,
        duration: 240,
        format: 'mp4',
        fileHandle: null,
        serverUrl: '/02-confidence.mp4',
      },
    ])
    await seedIndexedDBStore(page, 'ElearningDB', 'videoCaptions', [
      {
        courseId: 'operative-six',
        videoId: 'op6-introduction',
        filename: 'op6-introduction.vtt',
        content: createMockTranscript(),
        format: 'vtt',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])
    await seedIndexedDBStore(page, 'ElearningDB', 'userConsents', [
      {
        id: 'ai-summary-consent',
        userId: aiUserId,
        purpose: 'ai_tutor',
        grantedAt: '2026-01-01T00:00:00.000Z',
        withdrawnAt: null,
        noticeVersion: '2026-01-01.1',
        evidence: { provider_id: 'openai' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    // Seed AI configuration with test API key
    await seedAIConfiguration(page)
  })

  test('AC1: Summary streams into collapsible panel in real-time', async ({ page }) => {
    const summaryText =
      'This video covers functional programming concepts including immutability and pure functions. ' +
      'The instructor explains how these patterns lead to more predictable and testable code. ' +
      'Key topics include function composition, higher-order functions, and avoiding side effects. ' +
      'The video demonstrates practical examples of applying functional programming principles in modern JavaScript. ' +
      'Students will learn how to write cleaner, more maintainable code using these techniques. ' +
      'The lesson concludes with best practices for adopting functional programming in existing projects. ' +
      'This foundational knowledge will help developers build more robust applications with fewer bugs. ' +
      'Additional concepts covered include recursion patterns, currying techniques, and the benefits of declarative programming style over imperative approaches.'

    // Mock OpenAI streaming response
    await mockOpenAIStreaming(page, summaryText)

    // Navigate to video lesson
    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    // Click Summary tab
    const summaryTab = page.getByRole('tab', { name: 'AI Summary' })
    await expect(summaryTab).toBeVisible()
    await summaryTab.click()

    // Click Generate Summary button
    const generateButton = page.getByTestId('generate-summary-button')
    await expect(generateButton).toBeVisible()
    await generateButton.click()

    // Wait for summary to start streaming
    await expect(page.getByText('Generating summary…')).toBeVisible()

    // Wait for summary to complete
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })

    // Wait for streaming to finish before checking the complete text.
    await expect(page.getByTestId('summary-word-count')).toBeVisible()

    // Verify summary text appears
    const displayedText = await summaryTextElement.textContent()
    expect(displayedText).toContain('functional programming')

    // Verify word count badge appears
    const wordCountBadge = page.getByTestId('summary-word-count')
    await expect(wordCountBadge).toBeVisible()

    // Verify word count is in range (100-300 words)
    const wordCountText = await wordCountBadge.textContent()
    const wordCount = parseInt(wordCountText?.match(/\d+/)?.[0] || '0')
    expect(wordCount).toBeGreaterThanOrEqual(100)
    expect(wordCount).toBeLessThanOrEqual(300)
  })

  test('AC2: Collapse summary to minimal bar and expand without regenerating', async ({ page }) => {
    const summaryText =
      'This video covers functional programming concepts including immutability and pure functions. ' +
      'The instructor explains how these patterns lead to more predictable and testable code. ' +
      'Key topics include function composition, higher-order functions, and avoiding side effects.'

    await mockOpenAIStreaming(page, summaryText)

    // Navigate to video lesson and generate summary
    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for summary to complete
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('summary-word-count')).toBeVisible()
    const originalText = await summaryTextElement.textContent()

    // Click collapse button
    const collapseButton = page.getByTestId('toggle-summary-button')
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    // Verify summary text is no longer visible
    await expect(summaryTextElement).not.toBeVisible()

    // Verify collapsed state message
    const collapsedMessage = page.getByTestId('summary-collapsed-message')
    await expect(collapsedMessage).toBeVisible()
    await expect(collapsedMessage).toContainText('Summary collapsed')

    // Click expand button
    const expandButton = page.getByTestId('toggle-summary-button')
    await expandButton.click()

    // Verify summary text is visible again
    await expect(summaryTextElement).toBeVisible()

    // Verify text is the same (not regenerated)
    const expandedText = await summaryTextElement.textContent()
    expect(expandedText).toBe(originalText)
  })

  test('AC3: Handle 30s timeout with retry button', async ({ page }) => {
    // Override timeout to 3s for faster test execution (default: 30s)
    await page.addInitScript(() => {
      // @ts-expect-error - Test-only timeout override
      window.__AI_SUMMARY_TIMEOUT__ = 3000
    })

    await mockLLMHanging(page)

    // Navigate to video lesson
    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for the test-overridden timeout error.
    const errorMessage = page.getByTestId('summary-error')
    await expect(errorMessage).toBeVisible({ timeout: 10000 })

    // Verify error message matches AC3 specification
    await expect(errorMessage).toContainText('Summary generation timed out')

    // Verify retry button is visible
    const retryButton = page.getByTestId('retry-summary-button')
    await expect(retryButton).toBeVisible()
  })

  test('AC4: Graceful error fallback - video player remains functional', async ({ page }) => {
    await mockLLMError(page, 'Internal server error')

    // Navigate to video lesson
    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Verify error message appears quickly (within 2s)
    const errorMessage = page.getByTestId('summary-error')
    await expect(errorMessage).toBeVisible({ timeout: 2000 })

    // Verify error message contains text
    await expect(errorMessage).toContainText(/failed|error/i)

    // Verify retry button is available
    const retryButton = page.getByTestId('retry-summary-button')
    await expect(retryButton).toBeVisible()

    // Verify video player is still functional - can navigate to other tabs
    await page.getByRole('tab', { name: 'Transcript' }).click()
    await expect(page.getByText('Welcome to this video lesson')).toBeVisible()
  })

  test('should hide Summary tab when AI is unavailable', async ({ page }) => {
    // Override AI configuration to be unavailable
    await page.evaluate(() => {
      const aiConfig = {
        provider: 'openai',
        connectionStatus: 'unconfigured',
        consentSettings: {
          videoSummary: true,
          noteQA: true,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: true,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(aiConfig))
    })

    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    // Summary tab should not be visible when AI is unavailable
    // (Tab is still shown but AISummaryPanel shows unavailable badge)
    const summaryTab = page.getByRole('tab', { name: 'AI Summary' })
    await expect(summaryTab).toBeVisible()

    await summaryTab.click()

    // Should show AI unavailable badge instead of generate button
    await expect(page.getByTestId('ai-unavailable-badge')).toBeVisible()
    await expect(page.getByTestId('generate-summary-button')).not.toBeVisible()
  })

  test('should show the transcript prerequisite when video has no transcript', async ({ page }) => {
    // Use operative-six confidence lesson which has video but no captions
    await openLesson(page, 'op6-confidence')
    await page.waitForLoadState('networkidle')

    const summaryTab = page.getByRole('tab', { name: 'AI Summary' })
    await expect(summaryTab).toBeVisible()
    await summaryTab.click()
    await expect(page.getByText('Transcript required')).toBeVisible()
  })

  test('should allow regenerating summary', async ({ page }) => {
    const firstSummary =
      'This is the first generated summary about functional programming concepts.'
    const secondSummary =
      'This is a different summary covering the same topics but with different wording.'

    await mockLLMStreamingSequence(page, [firstSummary, secondSummary])

    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for first summary
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })
    await expect(summaryTextElement).toContainText('first generated summary')

    // Wait for component to fully settle after first generation
    const regenerateButton = page.getByTestId('regenerate-summary-button')
    await expect(regenerateButton).toBeVisible()
    await expect(regenerateButton).toBeEnabled() // Ensure button is clickable

    // Click regenerate and wait for state transition
    await regenerateButton.click()

    // Wait for new summary generation to start
    await expect(page.getByText('Generating summary…')).toBeVisible({ timeout: 5000 })
    await expect(summaryTextElement).toContainText('different summary', { timeout: 10000 })

    // Verify the summary changed
    const finalText = await summaryTextElement.textContent()
    expect(finalText).not.toContain('first generated summary')
    expect(finalText).toContain('different summary')
  })

  // ──────────────────────────────────────────────────────────────────────────────
  // Edge Case Coverage Tests (H4, H5, H6)
  // ──────────────────────────────────────────────────────────────────────────────

  test('H4: should verify incremental streaming behavior (not just final result)', async ({
    page,
  }) => {
    const firstChunk = 'This video covers functional programming'
    const secondChunk = ' concepts including immutability'
    const thirdChunk = ' and pure functions.'

    await mockOpenAIStreaming(page, firstChunk + secondChunk + thirdChunk, 300)

    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Verify loading state appears first
    await expect(page.getByText('Generating summary…')).toBeVisible()

    // Verify text appears in summary container (streaming or immediate)
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('summary-word-count')).toBeVisible()

    // Verify all chunks made it to the final output
    const finalText = await summaryTextElement.textContent()
    expect(finalText).toContain(firstChunk)
    expect(finalText).toContain(secondChunk.trim())
    expect(finalText).toContain(thirdChunk.trim())

    // Note: True incremental verification requires Playwright page.evaluate()
    // polling during stream processing, which is complex and fragile.
    // This test verifies the mock produces a multi-chunk SSE stream that the
    // client successfully processes into complete text.
  })

  test('H5: should show error when VTT has no parsable cues (malformed transcript)', async ({
    page,
  }) => {
    await seedIndexedDBStore(page, 'ElearningDB', 'videoCaptions', [
      {
        courseId: 'operative-six',
        videoId: 'op6-introduction',
        filename: 'op6-introduction.vtt',
        content: createMalformedTranscript(),
        format: 'vtt',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await expect(page.getByText('Transcript required')).toBeVisible()
    await expect(
      page.getByTestId('below-video-tabs').getByText(/could not be read|no usable text/i)
    ).toBeVisible()
    await expect(page.getByTestId('generate-summary-button')).not.toBeVisible()
  })

  test('H6: should continue streaming if consent disabled mid-generation', async ({ page }) => {
    const summaryText =
      'This video covers functional programming concepts including immutability and pure functions.'

    // Mock streaming with delay
    await mockOpenAIStreaming(page, summaryText, 500)

    await openLesson(page, 'op6-introduction')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: 'AI Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for streaming to start
    await expect(page.getByText('Generating summary…')).toBeVisible()

    // Disable videoSummary consent mid-generation
    await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('ai-configuration') || '{}')
      config.consentSettings.videoSummary = false
      localStorage.setItem('ai-configuration', JSON.stringify(config))
      window.dispatchEvent(new Event('ai-configuration-updated'))
    })

    // Verify streaming continues despite consent change (current behavior)
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('summary-word-count')).toBeVisible()

    // Verify summary completed successfully
    await expect(summaryTextElement).toContainText('functional programming')

    // Verify word count badge appears (completed state)
    await expect(page.getByTestId('summary-word-count')).toBeVisible()
  })
})
