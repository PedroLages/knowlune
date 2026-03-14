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

import type { AIProviderId } from './aiConfiguration'
import { sanitizeAIRequestPayload } from './aiConfiguration'
import type { TranscriptCue } from '@/data/types'

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
// AI Provider Configuration
// ---------------------------------------------------------------------------

interface ProviderConfig {
  endpoint: string
  headers: (apiKey: string) => Record<string, string>
  buildPayload: (transcript: string) => unknown
  parseStreamChunk: (line: string) => string | null
}

const PROVIDER_CONFIGS: Record<AIProviderId, ProviderConfig> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
    buildPayload: (transcript: string) => {
      const sanitized = sanitizeAIRequestPayload(transcript)
      return {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that summarizes educational video content. Provide concise, informative summaries that capture key concepts and main takeaways.',
          },
          {
            role: 'user',
            content: `Summarize the following video transcript in 100-300 words. Focus on key concepts and main takeaways:\n\n${sanitized.content}`,
          },
        ],
        stream: true,
        max_tokens: 500,
      }
    },
    parseStreamChunk: (line: string): string | null => {
      if (!line.startsWith('data: ')) return null
      const data = line.slice(6).trim()
      if (data === '[DONE]') return null

      try {
        const parsed = JSON.parse(data)
        return parsed.choices?.[0]?.delta?.content || null
      } catch {
        return null
      }
    },
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey: string) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    buildPayload: (transcript: string) => {
      const sanitized = sanitizeAIRequestPayload(transcript)
      return {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        stream: true,
        messages: [
          {
            role: 'user',
            content: `Summarize the following video transcript in 100-300 words. Focus on key concepts and main takeaways:\n\n${sanitized.content}`,
          },
        ],
      }
    },
    parseStreamChunk: (line: string): string | null => {
      if (!line.startsWith('data: ')) return null
      const data = line.slice(6).trim()

      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          return parsed.delta.text
        }
        return null
      } catch {
        return null
      }
    },
  },
}

// ---------------------------------------------------------------------------
// Streaming AI Summary Generation
// ---------------------------------------------------------------------------

/**
 * Generates AI video summary with real-time streaming
 *
 * @param transcript - Full transcript text to summarize
 * @param provider - AI provider ID
 * @param apiKey - Decrypted API key
 * @param externalSignal - Optional external AbortSignal for cancellation (e.g., component unmount)
 * @yields Text chunks as they arrive from AI provider
 * @throws Error on timeout (>30s), API errors, network failures, or cancellation
 *
 * @example
 * const controller = new AbortController()
 * const generator = generateVideoSummary(transcript, 'openai', apiKey, controller.signal)
 * for await (const chunk of generator) {
 *   setSummaryText(prev => prev + chunk)
 * }
 */
export async function* generateVideoSummary(
  transcript: string,
  provider: AIProviderId,
  apiKey: string,
  externalSignal?: AbortSignal
): AsyncGenerator<string, void, undefined> {
  const config = PROVIDER_CONFIGS[provider]
  if (!config) {
    throw new Error(`Unsupported AI provider: ${provider}`)
  }

  // Create AbortController for timeout (AC3 requirement: 30s, test-overridable)
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), getTimeout())

  // Link external signal to internal controller (for unmount cancellation)
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => abortController.abort(), { once: true })
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: config.headers(apiKey),
      body: JSON.stringify(config.buildPayload(transcript)),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error')
      throw new Error(`AI provider error (${response.status}): ${errorBody}`)
    }

    if (!response.body) {
      throw new Error('Response body is null - streaming not supported')
    }

    // Parse SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        const chunk = config.parseStreamChunk(line)
        if (chunk) {
          yield chunk
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Differentiate external abort (unmount) from timeout abort
      if (externalSignal?.aborted) {
        // Component unmounted - preserve original AbortError for caller to handle
        throw error
      }
      // Internal timeout fired - wrap with user-friendly message
      throw new Error('Summary generation timed out. Please try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
