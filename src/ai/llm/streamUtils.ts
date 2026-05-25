/**
 * Stream utilities for LLM clients
 *
 * Provides helpers for collecting streaming LLM responses into complete strings.
 * Extracted from src/ai/youtube/courseStructurer.ts for reuse across features.
 */

import type { LLMStreamChunk } from './types'

/**
 * Collect all chunks from a streaming LLM completion into a single string,
 * with a timeout and abort signal.
 *
 * Accepts any async generator that yields objects with a `content` string,
 * compatible with `LLMStreamChunk`.
 *
 * @param stream - Async generator from `LLMClient.streamCompletion()`
 * @param timeoutMs - Maximum time to wait before rejecting with timeout error
 * @param signal - Optional AbortSignal for cancellation
 * @returns Complete response text
 * @throws {Error} On timeout, cancellation, or stream error
 */
export async function collectStreamWithTimeout(
  stream: AsyncGenerator<LLMStreamChunk, void, unknown>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let content = ''
    let done = false
    const timeoutId = setTimeout(() => {
      if (!done) {
        done = true
        reject(new Error('AI request timed out.'))
      }
    }, timeoutMs)

    const onAbort = () => {
      if (!done) {
        done = true
        clearTimeout(timeoutId)
        reject(new Error('AI request aborted.'))
      }
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    async function consume() {
      try {
        for await (const chunk of stream) {
          if (done) break
          content += chunk.content
        }
        if (!done) {
          done = true
          clearTimeout(timeoutId)
          resolve(content)
        }
      } catch (err) {
        if (!done) {
          done = true
          clearTimeout(timeoutId)
          reject(err)
        }
      } finally {
        signal?.removeEventListener('abort', onAbort)
      }
    }

    consume()
  })
}
