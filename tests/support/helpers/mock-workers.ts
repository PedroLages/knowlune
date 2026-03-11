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

export async function mockEmbeddingWorker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class MockWorker extends EventTarget {
      constructor(public url: string | URL, public options?: WorkerOptions) {
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
              result: { embeddings: payload.texts.map(() => new Float32Array(384)) },
            }
          } else if (req.type === 'load-index') {
            responseData = { requestId: req.requestId, type: 'success', result: undefined }
          } else if (req.type === 'search') {
            const payload = req.payload as { topK?: number }
            responseData = {
              requestId: req.requestId,
              type: 'success',
              result: {
                results: Array.from({ length: payload.topK ?? 5 }, (_, i) => ({
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

      terminate(): void { /* no-op */ }
    }

    ;(window as unknown as Record<string, unknown>)['Worker'] = MockWorker
  })
}
