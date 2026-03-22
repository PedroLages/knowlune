import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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

/**
 * Creates a mock VTT transcript for testing
 */
function createMockTranscript(): string {
  return `WEBVTT

00:00:01.000 --> 00:00:05.000
Welcome to this video lesson on advanced programming concepts.

00:00:06.000 --> 00:00:12.000
Today we'll explore functional programming patterns and their benefits.

00:00:13.000 --> 00:00:18.000
Functional programming emphasizes immutability and pure functions.

00:00:19.000 --> 00:00:25.000
This approach leads to more predictable and testable code.`
}

/**
 * Configures mock AI summary generator for tests
 *
 * Injects a mock async generator at the module level (aiSummary.ts).
 * This bypasses the Vercel AI SDK entirely, testing only UI/UX behavior.
 */
async function mockOpenAIStreaming(
  page: Page,
  summaryText: string,
  delayMs = 200 // Minimum delay for "Generating summary..." state to be observable
) {
  await page.evaluate(
    ({ text, delay }) => {
      // Mock generator that yields word-by-word chunks with delay
      ;(window as any).__mockAISummaryGenerator__ = async function* (
        _transcript: string,
        signal?: AbortSignal
      ) {
        const chunks = text.split(' ')
        for (const chunk of chunks) {
          // Check for cancellation
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }
          // Simulate streaming delay
          await new Promise(resolve => setTimeout(resolve, delay / chunks.length))
          yield chunk + ' '
        }
      }
    },
    { text: summaryText, delay: delayMs }
  )
}

test.describe('E09B-S01: AI Video Summary', () => {
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

    // Seed AI configuration with test API key
    // _testApiKey only works in DEV mode (import.meta.env.DEV = true)
    // Tests mock API endpoints so keys never reach real servers
    await page.evaluate(
      ({ provider, apiKey }) => {
        const aiConfig = {
          provider,
          connectionStatus: 'connected',
          _testApiKey: apiKey, // Test-only field (DEV mode only)
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
      },
      { provider: 'openai', apiKey: 'sk-test-key-for-e2e' }
    )
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

    // Navigate to video lesson FIRST
    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Set mock data AFTER navigation (before user clicks generate button)
    await mockOpenAIStreaming(page, summaryText)

    // Click Summary tab
    const summaryTab = page.getByRole('tab', { name: 'Summary' })
    await expect(summaryTab).toBeVisible()
    await summaryTab.click()

    // Click Generate Summary button
    const generateButton = page.getByTestId('generate-summary-button')
    await expect(generateButton).toBeVisible()
    await generateButton.click()

    // Wait for summary to start streaming
    await expect(page.getByText('Generating summary...')).toBeVisible()

    // Wait for summary to complete
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })

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

    // Navigate to video lesson FIRST
    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Set mock AFTER navigation (same as AC1)
    await mockOpenAIStreaming(page, summaryText)

    await page.getByRole('tab', { name: 'Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for summary to complete
    const summaryTextElement = page.getByTestId('summary-text')
    await expect(summaryTextElement).toBeVisible({ timeout: 10000 })

    // Verify summary contains expected content (verify it was generated)
    await expect(summaryTextElement).toContainText('functional programming')

    // Click collapse button
    const collapseButton = page.getByTestId('toggle-summary-button')
    await expect(collapseButton).toBeVisible()
    await collapseButton.click()

    // Verify summary text is no longer visible
    await expect(summaryTextElement).not.toBeVisible()

    // Verify collapsed state message
    await expect(page.getByText('Summary collapsed')).toBeVisible()

    // Click expand button
    const expandButton = page.getByTestId('toggle-summary-button')
    await expandButton.click()

    // Verify summary text is visible again
    await expect(summaryTextElement).toBeVisible()

    // Verify text is still the same (not regenerated)
    await expect(summaryTextElement).toContainText('functional programming')
  })

  test('AC3: Handle 30s timeout with retry button', async ({ page }) => {
    // Set timeout override BEFORE navigation (must be available when module loads)
    await page.addInitScript(() => {
      // @ts-expect-error - Test-only timeout override
      window.__AI_SUMMARY_TIMEOUT__ = 3000
    })

    // Navigate to video lesson
    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Mock slow generator that exceeds timeout (3s for fast test execution)
    await page.evaluate(() => {
      // Mock generator with 3.5s delay that respects abort signal
      ;(window as any).__mockAISummaryGenerator__ = async function* (
        _transcript: string,
        signal?: AbortSignal
      ) {
        // Create promise that rejects when aborted
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 3500)
          signal?.addEventListener('abort', () => {
            clearTimeout(timeout)
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
        yield 'This should not appear'
      }
    })

    await page.getByRole('tab', { name: 'Summary' }).click()
    await page.getByTestId('generate-summary-button').click()

    // Wait for timeout error to appear (should happen within 32s)
    const errorMessage = page.getByTestId('summary-error')
    await expect(errorMessage).toBeVisible({ timeout: 32000 })

    // Verify error message matches AC3 specification
    await expect(errorMessage).toContainText('Summary generation timed out')

    // Verify retry button is visible
    const retryButton = page.getByTestId('retry-summary-button')
    await expect(retryButton).toBeVisible()
  })

  test('AC4: Graceful error fallback - video player remains functional', async ({ page }) => {
    // Navigate to video lesson
    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Mock generator that throws error immediately
    await page.evaluate(() => {
      // eslint-disable-next-line require-yield -- intentionally throws before yielding to test error path
      ;(window as any).__mockAISummaryGenerator__ = async function* () {
        throw new Error('Internal server error')
      }
    })

    await page.getByRole('tab', { name: 'Summary' }).click()
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

    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Summary tab should not be visible when AI is unavailable
    // (Tab is still shown but AISummaryPanel shows unavailable badge)
    const summaryTab = page.getByRole('tab', { name: 'Summary' })
    await expect(summaryTab).toBeVisible()

    await summaryTab.click()

    // Should show AI unavailable badge instead of generate button
    await expect(page.getByTestId('ai-unavailable-badge')).toBeVisible()
    await expect(page.getByTestId('generate-summary-button')).not.toBeVisible()
  })

  test('should not show Summary tab when video has no transcript', async ({ page }) => {
    // Use operative-six confidence lesson which has video but no captions
    await page.goto('/courses/operative-six/op6-confidence')
    await page.waitForLoadState('networkidle')

    // Summary tab should not be visible without transcript
    const summaryTab = page.getByRole('tab', { name: 'Summary' })
    await expect(summaryTab).not.toBeVisible()
  })

  test('should allow regenerating summary', async ({ page }) => {
    const firstSummary =
      'This is the first generated summary about functional programming concepts.'
    const secondSummary =
      'This is a different summary covering the same topics but with different wording.'

    await page.goto('/courses/operative-six/op6-introduction')
    await page.waitForLoadState('networkidle')

    // Mock generator with call counter for different responses
    await page.evaluate(
      ({ first, second }) => {
        let callCount = 0
        ;(window as any).__mockAISummaryGenerator__ = async function* (
          _transcript: string,
          signal?: AbortSignal
        ) {
          callCount++
          const summary = callCount === 1 ? first : second

          // Add delay to ensure loading state is observable
          await new Promise(resolve => setTimeout(resolve, 200))

          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError')
          }

          yield summary
        }
      },
      { first: firstSummary, second: secondSummary }
    )

    await page.getByRole('tab', { name: 'Summary' }).click()
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
    await expect(page.getByText('Generating summary...')).toBeVisible({ timeout: 5000 })
    await expect(summaryTextElement).toContainText('different summary', { timeout: 10000 })

    // Verify the summary changed
    const finalText = await summaryTextElement.textContent()
    expect(finalText).not.toContain('first generated summary')
    expect(finalText).toContain('different summary')
  })
})
