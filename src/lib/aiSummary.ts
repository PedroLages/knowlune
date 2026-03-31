/**
 * AI Video Summary Generation Service
 *
 * Provides streaming AI-powered video summarization from transcript text.
 * Supports OpenAI and Anthropic providers with SSE (Server-Sent Events) streaming.
 *
 * Security:
 * - Uses encrypted API keys from aiConfiguration
 * - Sanitizes payloads (no PII or metadata)
 * - 30-second timeout on AI requests
 */

import { sanitizeAIRequestPayload } from './aiConfiguration'
import type { TranscriptCue } from '@/data/types'
import { withModelFallback } from '@/ai/llm/factory'
import type { LLMMessage } from '@/ai/llm/types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * AI request timeout in milliseconds (AC3 requirement: 30s)
 * Can be overridden for E2E tests via window.__AI_SUMMARY_TIMEOUT__
 */
const getTimeout = (): number => {
  // @ts-expect-error - Test-only global variable for E2E timeout control
  return typeof window !== 'undefined' && window.__AI_SUMMARY_TIMEOUT__
    ? // @ts-expect-error - Test-only global variable accessed from window object
      window.__AI_SUMMARY_TIMEOUT__
    : 30000
}

// ---------------------------------------------------------------------------
// VTT Parser (extracted from TranscriptPanel for reuse)
// ---------------------------------------------------------------------------

function parseTime(t: string): number {
  const parts = t.replace(',', '.').split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
}

function parseVTT(text: string): TranscriptCue[] {
  const blocks = text.trim().split(/\n\n+/)
  const cues: TranscriptCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timestampLine = lines.find(l => l.includes('-->'))
    if (!timestampLine) continue

    const match = timestampLine.match(
      /(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)/
    )
    if (!match) continue

    const startTime = parseTime(match[1])
    const endTime = parseTime(match[2])

    const tsIdx = lines.indexOf(timestampLine)
    const textLines = lines.slice(tsIdx + 1).filter(l => l.trim())
    if (!textLines.length) continue

    cues.push({ startTime, endTime, text: textLines.join(' ') })
  }

  return cues
}

// ---------------------------------------------------------------------------
// Transcript Fetching
// ---------------------------------------------------------------------------

/**
 * Fetches and parses VTT transcript file into plain text
 *
 * @param src - URL to VTT file
 * @returns Full transcript text (space-separated cue text)
 * @throws Error if fetch fails or VTT is malformed
 */
export async function fetchAndParseTranscript(src: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(src, { signal })
  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status} ${response.statusText}`)
  }

  const vttText = await response.text()
  const cues = parseVTT(vttText)

  if (cues.length === 0) {
    throw new Error('Transcript contains no parsable cues')
  }

  // Join all cue text into single string for AI processing
  return cues.map(cue => cue.text).join(' ')
}

// ---------------------------------------------------------------------------
// Summary Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Builds the messages array for the summary prompt.
 * All providers use the same unified message format through the proxy.
 */
function buildSummaryMessages(transcript: string): LLMMessage[] {
  const sanitized = sanitizeAIRequestPayload(transcript)
  return [
    {
      role: 'system' as const,
      content:
        'You are a helpful assistant that summarizes educational video content. Provide concise, informative summaries that capture key concepts and main takeaways.',
    },
    {
      role: 'user' as const,
      content: `Summarize the following video transcript in 100-300 words. Focus on key concepts and main takeaways:\n\n${sanitized.content}`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Streaming AI Summary Generation
// ---------------------------------------------------------------------------

/**
 * Generates AI video summary with real-time streaming via getLLMClient.
 *
 * Uses the per-feature model resolution cascade (user override → feature default
 * → global provider default) via getLLMClient('videoSummary').
 *
 * If the configured model returns a 403/model-not-found error, falls back to
 * the provider's default model and logs a warning (AC8).
 *
 * @param transcript - Full transcript text to summarize
 * @param externalSignal - Optional external AbortSignal for cancellation (e.g., component unmount)
 * @yields Text chunks as they arrive from AI provider
 * @throws Error on timeout (>30s), API errors, network failures, or cancellation
 *
 * @example
 * const controller = new AbortController()
 * const generator = generateVideoSummary(transcript, controller.signal)
 * for await (const chunk of generator) {
 *   setSummaryText(prev => prev + chunk)
 * }
 */
export async function* generateVideoSummary(
  transcript: string,
  externalSignal?: AbortSignal
): AsyncGenerator<string, void, undefined> {
  const messages = buildSummaryMessages(transcript)

  // Create AbortController for timeout (AC3 requirement: 30s, test-overridable)
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), getTimeout())

  // Link external signal to internal controller (for unmount cancellation)
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => abortController.abort(), { once: true })
  }

  try {
    // Use feature-aware LLM client with automatic model fallback (AC8)
    for await (const chunk of withModelFallback('videoSummary', messages)) {
      yield chunk
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw error
      }
      throw new Error('Summary generation timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
