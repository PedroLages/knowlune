/**
 * AI Summary E2E Test Mocking Helpers
 *
 * Shared utilities for mocking OpenAI/Anthropic streaming APIs and VTT transcripts.
 */

import type { Page } from '@playwright/test'

/**
 * Creates a mock VTT transcript for testing
 */
export function createMockTranscript(): string {
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
 * Creates a malformed VTT transcript (valid structure but no parsable cues)
 */
export function createMalformedTranscript(): string {
  return `WEBVTT

NOTE This is a note, not a cue

STYLE
::cue {
  background-image: linear-gradient(to bottom, dimgray, lightgray);
}

NOTE Another note, still no actual cues with timestamps`
}

/**
 * Mocks OpenAI streaming response
 *
 * @param page - Playwright page instance
 * @param summaryText - Full summary text to stream (will be split into word chunks)
 * @param delayMs - Minimum delay for "Generating summary..." state to be observable in Playwright (default: 200ms)
 */
export async function mockOpenAIStreaming(page: Page, summaryText: string, delayMs = 200) {
  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const chunks = summaryText.split(' ')
    let responseBody = ''

    for (const chunk of chunks) {
      responseBody += `data: ${JSON.stringify({
        choices: [{ delta: { content: chunk + ' ' } }],
      })}\n\n`
    }
    responseBody += 'data: [DONE]\n\n'

    // Simulate streaming with delay to allow UI state transitions to be observable
    await new Promise(resolve => setTimeout(resolve, delayMs))

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: responseBody,
    })
  })
}

/**
 * Creates default operative-six course structure for AI summary tests
 *
 * @param videoWithCaption - Lesson ID that should have captions (default: 'op6-introduction')
 * @param videoWithoutCaption - Lesson ID that should NOT have captions (default: 'op6-confidence')
 */
export function createOperativeSixCourse(
  videoWithCaption = 'op6-introduction',
  videoWithoutCaption = 'op6-confidence'
) {
  return {
    id: 'operative-six',
    name: 'The Operative Six',
    tags: ['security', 'profiling'],
    status: 'ready' as const,
    modules: [
      {
        id: 'op6-module-1',
        title: 'Foundations',
        order: 1,
        lessons: [
          {
            id: videoWithCaption,
            title: 'Introduction',
            order: 1,
            resources: [
              {
                type: 'video',
                src: '/path/to/01-00- Introduction.mp4',
                metadata: {
                  captions: [
                    {
                      src: '/captions/op6-introduction.vtt',
                      srclang: 'en',
                      label: 'English',
                    },
                  ],
                },
              },
            ],
          },
          {
            id: videoWithoutCaption,
            title: 'Confidence',
            order: 2,
            resources: [
              {
                type: 'video',
                src: '/path/to/02-confidence.mp4',
                // No captions for this video (used in test for missing transcript)
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Seeds AI configuration with test API key
 *
 * Note: _testApiKey only works in DEV mode (import.meta.env.DEV = true)
 * Tests mock API endpoints so keys never reach real servers
 */
export async function seedAIConfiguration(
  page: Page,
  options: {
    provider?: 'openai' | 'anthropic'
    apiKey?: string
    videoSummaryConsent?: boolean
  } = {}
) {
  const {
    provider = 'openai',
    apiKey = 'sk-test-key-for-e2e',
    videoSummaryConsent = true,
  } = options

  await page.evaluate(
    ({ provider, apiKey, videoSummaryConsent }) => {
      const aiConfig = {
        provider,
        connectionStatus: 'connected',
        _testApiKey: apiKey, // Test-only field (type-safe, DEV mode only)
        consentSettings: {
          videoSummary: videoSummaryConsent,
          noteQA: true,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: true,
        },
      }
      localStorage.setItem('ai-configuration', JSON.stringify(aiConfig))
    },
    { provider, apiKey, videoSummaryConsent }
  )
}
