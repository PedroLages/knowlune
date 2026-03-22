/**
 * Mock Worker helpers for E2E tests
 *
 * Injects a deterministic MockWorker before page navigation to prevent
 * Transformers.js from loading real models in E2E tests. All worker
 * responses are immediate and predictable.
 *
 * Usage:
 *   await mockEmbeddingWorker(page)
 *   await page.goto('/notes')
 */

import type { Page } from '@playwright/test'

export interface MockEmbeddingWorkerOptions {
  /** Whether to return empty search results (for testing "no notes found" scenario) */
  emptyResults?: boolean
}

export async function mockEmbeddingWorker(
  page: Page,
  options: MockEmbeddingWorkerOptions = {}
): Promise<void> {
  await page.addInitScript((opts: MockEmbeddingWorkerOptions) => {
    class MockWorker extends EventTarget {
      constructor(
        public url: string | URL,
        public options?: WorkerOptions
      ) {
        super()
      }

      postMessage(message: unknown): void {
        const req = message as { requestId: string; type: string; payload: unknown }
        setTimeout(() => {
          let responseData: unknown

          if (req.type === 'embed') {
            const payload = req.payload as { texts: string[] }
            responseData = {
              requestId: req.requestId,
              type: 'success',
              result: { embeddings: payload.texts.map(() => new Float32Array(384).fill(0.1)) },
            }
          } else if (req.type === 'load-index') {
            responseData = { requestId: req.requestId, type: 'success', result: undefined }
          } else if (req.type === 'search') {
            const payload = req.payload as { topK?: number }
            responseData = {
              requestId: req.requestId,
              type: 'success',
              result: {
                results: opts.emptyResults
                  ? []
                  : Array.from({ length: payload.topK ?? 5 }, (_, i) => ({
                      noteId: `note-${i + 1}`,
                      score: 0.95 - i * 0.05,
                    })),
              },
            }
          } else {
            responseData = {
              requestId: req.requestId,
              type: 'error',
              error: `Mock Worker: unknown type ${(req as { type: string }).type}`,
            }
          }

          this.dispatchEvent(new MessageEvent('message', { data: responseData }))
        }, 10)
      }

      terminate(): void {
        /* no-op */
      }
    }

    ;(window as unknown as Record<string, unknown>)['Worker'] = MockWorker
  }, options)
}
