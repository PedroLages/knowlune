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
  await page.addInitScript(
    ({ text, delay }) => {
      const words = text.split(' ')
      ;(window as unknown as Record<string, unknown>).__mockLLMClient = {
        getProviderId: () => 'openai',
        async *streamCompletion() {
          for (const word of words) {
            await new Promise(resolve => setTimeout(resolve, delay / words.length))
            yield { content: `${word} ` }
          }
          yield { content: '', finishReason: 'stop' as const }
        },
      }
    },
    { text: summaryText, delay: delayMs }
  )
}

/** Injects deterministic responses for consecutive summary generations. */
export async function mockLLMStreamingSequence(page: Page, summaryTexts: string[], delayMs = 200) {
  await page.addInitScript(
    ({ texts, delay }) => {
      let callIndex = 0
      ;(window as unknown as Record<string, unknown>).__mockLLMClient = {
        getProviderId: () => 'openai',
        async *streamCompletion() {
          const text = texts[Math.min(callIndex, texts.length - 1)] ?? ''
          callIndex += 1
          const words = text.split(' ')
          for (const word of words) {
            await new Promise(resolve => setTimeout(resolve, delay / Math.max(words.length, 1)))
            yield { content: `${word} ` }
          }
          yield { content: '', finishReason: 'stop' as const }
        },
      }
    },
    { texts: summaryTexts, delay: delayMs }
  )
}

/** Injects a provider failure without calling a real AI endpoint. */
export async function mockLLMError(page: Page, message: string) {
  await page.addInitScript(errorMessage => {
    ;(window as unknown as Record<string, unknown>).__mockLLMClient = {
      getProviderId: () => 'openai',
      async *streamCompletion() {
        yield { content: '' }
        throw new Error(errorMessage)
      },
    }
  }, message)
}

/** Injects a stream that remains pending until the summary timeout cancels it. */
export async function mockLLMHanging(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as Record<string, unknown>).__mockLLMClient = {
      getProviderId: () => 'openai',
      async *streamCompletion() {
        await new Promise(() => undefined)
        yield { content: 'unreachable' }
      },
    }
  })
}

/**
 * Creates default operative-six course structure for AI summary tests
 *
 * @param videoWithCaption - Lesson ID that should have captions (default: 'op6-introduction')
 * @param videoWithoutCaption - Lesson ID that should NOT have captions (default: 'op6-confidence')
 */
export function createOperativeSixCourse(
  _videoWithCaption = 'op6-introduction',
  _videoWithoutCaption = 'op6-confidence'
) {
  return {
    id: 'operative-six',
    name: 'The Operative Six',
    importedAt: '2026-01-01T00:00:00.000Z',
    category: 'Development',
    tags: ['security', 'profiling'],
    status: 'active' as const,
    videoCount: 2,
    pdfCount: 0,
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
        featureModels: {
          videoSummary: { provider: 'openai', model: 'gpt-4o-mini' },
        },
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
