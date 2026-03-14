/**
 * Mock LLM Client for E2E tests
 *
 * Provides a deterministic, instant-response LLM client that can be injected
 * into the browser context via page.addInitScript().
 *
 * Usage:
 *   await mockLLMClient(page, {
 *     response: 'React hooks are functions that let you use state...'
 *   })
 *   await page.goto('/notes/chat')
 */

import type { Page } from '@playwright/test'

export interface MockLLMClientOptions {
  /**
   * The response text to stream back
   * If not provided, uses a default response about React hooks
   */
  response?: string

  /**
   * Delay between chunks in milliseconds
   * Default: 10ms for fast test execution
   */
  chunkDelay?: number

  /**
   * Chunk size (characters per chunk)
   * Default: 20 characters
   */
  chunkSize?: number

  /**
   * Whether to simulate an error
   * Default: false
   */
  simulateError?: boolean

  /**
   * Error message if simulateError is true
   */
  errorMessage?: string
}

const DEFAULT_RESPONSE = `React hooks are functions that let you use state and other React features in functional components. The most commonly used hooks are useState for managing state and useEffect for side effects like data fetching.`

/**
 * Inject a mock LLM client into the browser context
 *
 * This overrides the getLLMClient factory function to return a deterministic
 * mock client instead of making real API calls.
 *
 * @param page - Playwright Page instance
 * @param options - Mock configuration options
 */
export async function mockLLMClient(page: Page, options: MockLLMClientOptions = {}): Promise<void> {
  const {
    response = DEFAULT_RESPONSE,
    chunkDelay = 10,
    chunkSize = 20,
    simulateError = false,
    errorMessage = 'Mock LLM error',
  } = options

  await page.addInitScript(
    ({ response, chunkDelay, chunkSize, simulateError, errorMessage }) => {
      // MockLLMClient class injected into browser context
      class MockLLMClient {
        getProviderId(): string {
          return 'mock-provider'
        }

        async *streamCompletion(): AsyncGenerator<
          { content: string; finishReason?: 'stop' | 'length' | 'error' },
          void,
          unknown
        > {
          if (simulateError) {
            yield { content: '', finishReason: 'error' as const }
            throw new Error(errorMessage)
          }

          // Stream response in chunks
          let sentChars = 0
          while (sentChars < response.length) {
            const chunk = response.slice(sentChars, sentChars + chunkSize)
            yield { content: chunk }
            sentChars += chunkSize

            // Delay between chunks for realistic streaming
            if (sentChars < response.length) {
              await new Promise(resolve => setTimeout(resolve, chunkDelay))
            }
          }

          // Final chunk with finishReason
          yield { content: '', finishReason: 'stop' as const }
        }
      }

      // Inject mock client via window.__mockLLMClient
      // The getLLMClient factory checks for this in test environments
      ;(window as unknown as { __mockLLMClient: MockLLMClient }).__mockLLMClient =
        new MockLLMClient()
    },
    { response, chunkDelay, chunkSize, simulateError, errorMessage }
  )
}

/**
 * Mock LLM client configured to simulate an error
 *
 * @param page - Playwright Page instance
 * @param errorMessage - Custom error message
 */
export async function mockLLMClientError(page: Page, errorMessage?: string): Promise<void> {
  await mockLLMClient(page, {
    simulateError: true,
    errorMessage,
  })
}
