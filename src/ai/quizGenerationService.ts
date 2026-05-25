/**
 * Quiz Generation Service
 *
 * Orchestrates the 4-stage pipeline: Chunk -> Generate -> Validate -> Store
 *
 * Uses the multi-provider LLM client factory (`getLLMClient`) for AI calls,
 * supporting any configured provider (OpenAI, Anthropic, Ollama, etc.).
 *
 * Pipeline:
 *   1. Check cache (transcriptHash match -> return existing quiz)
 *   2. Chunk transcript (chapters or fixed 5-minute windows)
 *   3. Generate questions per chunk via LLM
 *      - For Ollama: preserves native /api/chat endpoint with `format` schema
 *        enforcement (local models rely on this for valid structured output)
 *      - For cloud providers: uses streaming LLM client with JSON fallback parsing
 *   4. Validate with Zod, retry failures up to 2 times
 *   5. Store quiz in Dexie with auto-generated metadata
 *
 * @module
 */

import { db } from '@/db/schema'
import { getOllamaServerUrl, getOllamaSelectedModel } from '@/lib/aiConfiguration'
import { resolveFeatureModel } from '@/lib/aiConfiguration'
import type { FeatureModelConfig } from '@/lib/aiConfiguration'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { chunkTranscript, type TranscriptChunk } from './quizChunker'
import {
  buildQuizPrompt,
  QuizResponseSchema,
  QUIZ_RESPONSE_SCHEMA,
  type BloomsLevel,
  type GeneratedQuestion,
} from './quizPrompts'
import { runQualityControl } from './quizQualityControl'
import type { Quiz, Question } from '@/types/quiz'
import { getLLMClient, assertAIFeatureConsent } from '@/ai/llm/factory'
import type { LLMClient } from '@/ai/llm/client'
import type { LLMMessage } from '@/ai/llm/types'
import { collectStreamWithTimeout } from '@/ai/llm/streamUtils'
import { LLMError } from '@/ai/llm/types'
import { ConsentError } from '@/ai/lib/ConsentError'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for quiz generation */
export interface QuizGenerationOptions {
  /** Bloom's taxonomy level (default: 'remember') */
  bloomsLevel?: BloomsLevel
  /** Number of questions per chunk (3-5, default: 4) */
  questionsPerChunk?: number
  /** Optional AbortSignal for cancellation */
  signal?: AbortSignal
  /** Force regeneration even if cached quiz exists */
  regenerate?: boolean
}

/** Result of quiz generation */
export interface QuizGenerationResult {
  /** The generated or cached quiz, or null on failure */
  quiz: Quiz | null
  /** Whether the quiz was returned from cache */
  cached: boolean
  /** Error message if generation failed */
  error?: string
  /** Number of chunks processed */
  chunksProcessed?: number
  /** Number of chunks that failed validation */
  chunksFailed?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for each LLM call (30 seconds — quiz generation is heavier than tagging) */
const GENERATION_TIMEOUT_MS = 30_000

/** Maximum retry attempts for failed LLM validation */
const MAX_RETRIES = 2

/** Log prefix for console warnings */
const LOG_PREFIX = '[QuizGeneration]'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a quiz for a lesson from its transcript.
 *
 * Checks cache first (by transcriptHash), then runs the full pipeline.
 * Never throws — returns a result object with error info on failure.
 *
 * @param lessonId - YouTube video ID of the lesson
 * @param courseId - Course ID containing this lesson
 * @param options - Generation options (bloom's level, question count)
 * @returns Quiz generation result
 */
export async function generateQuizForLesson(
  lessonId: string,
  courseId: string,
  options: QuizGenerationOptions = {}
): Promise<QuizGenerationResult> {
  const { bloomsLevel = 'remember', questionsPerChunk = 4, signal, regenerate = false } = options
  const startTime = Date.now()

  // E96-S03: Track AI usage (fire-and-forget).
  // `AIFeatureType` enum does not yet have a distinct 'quiz_generation' entry
  // and we intentionally do not extend the enum in this story (would require
  // a Supabase schema change). Using the closest-fit feature ('knowledge_gaps')
  // and tagging granularity via `metadata.subFeature` per plan M1.
  const emitTracking = (status: 'success' | 'error', extra: Record<string, unknown> = {}): void => {
    trackAIUsage('knowledge_gaps', {
      courseId,
      durationMs: Date.now() - startTime,
      status,
      metadata: { subFeature: 'quiz_generation', lessonId, bloomsLevel, ...extra },
    }).catch(() => {
      // silent-catch-ok: analytics must never disrupt AI features
    })
  }

  // Resolve feature model and assert consent
  let resolved: FeatureModelConfig
  let client: LLMClient

  try {
    resolved = resolveFeatureModel('quizGeneration')
    await assertAIFeatureConsent('quizGeneration', resolved)
    client = await getLLMClient('quizGeneration', { resolved })
  } catch (error) {
    if (error instanceof ConsentError) {
      return { quiz: null, cached: false, error: 'Quiz generation unavailable. AI features must be enabled in Settings.' }
    }
    if (error instanceof ProviderReconsentError) {
      return { quiz: null, cached: false, error: 'Provider consent required. Please review your AI provider settings.' }
    }
    if (error instanceof LLMError && error.code === 'AUTH_ERROR') {
      return { quiz: null, cached: false, error: 'AI provider not configured for quiz generation.' }
    }
    emitTracking('error', { errorCode: 'ai_setup_failed' })
    return { quiz: null, cached: false, error: 'AI provider not configured for quiz generation.' }
  }

  // Fetch transcript for hash computation
  const transcript = await db.youtubeTranscripts
    .where('[courseId+videoId]')
    .equals([courseId, lessonId])
    .first()

  if (!transcript || transcript.status !== 'done' || !transcript.fullText) {
    emitTracking('error', { errorCode: 'no_transcript' })
    return { quiz: null, cached: false, error: 'No valid transcript available' }
  }

  // Compute transcript hash for cache lookup
  const transcriptHash = await computeSHA256(transcript.fullText)

  // Cache check: look for existing quiz with matching transcriptHash (skip on regenerate)
  if (!regenerate) {
    const existingQuiz = await findCachedQuiz(lessonId, transcriptHash)
    if (existingQuiz) {
      return { quiz: existingQuiz, cached: true }
    }
  }

  // Stage 1: Chunk transcript
  const chunks = await chunkTranscript(lessonId, courseId)
  if (chunks.length === 0) {
    emitTracking('error', { errorCode: 'no_chunks' })
    return { quiz: null, cached: false, error: 'Transcript produced no chunks' }
  }

  // Stage 2-3: Generate and validate questions for each chunk
  const allQuestions: Question[] = []
  let chunksFailed = 0

  for (const chunk of chunks) {
    if (signal?.aborted) {
      emitTracking('error', { errorCode: 'cancelled' })
      return { quiz: null, cached: false, error: 'Generation cancelled' }
    }

    const questions = await generateQuestionsForChunk(
      client,
      resolved,
      chunk,
      bloomsLevel,
      questionsPerChunk,
      signal
    )

    if (questions) {
      // Map generated questions to full Question objects
      const mapped = questions.map((q, idx) => mapToQuestion(q, allQuestions.length + idx + 1))
      allQuestions.push(...mapped)
    } else {
      chunksFailed++
    }
  }

  if (allQuestions.length === 0) {
    emitTracking('error', {
      errorCode: 'all_chunks_failed',
      chunksProcessed: chunks.length,
      chunksFailed,
    })
    return {
      quiz: null,
      cached: false,
      error: 'All chunks failed question generation',
      chunksProcessed: chunks.length,
      chunksFailed,
    }
  }

  // Stage 4: Store quiz
  const modelId = `${resolved.provider}/${resolved.model}`
  const quiz = buildQuiz(lessonId, allQuestions, transcriptHash, bloomsLevel, modelId)

  try {
    // E96-S02: route through syncableWrite so the generated quiz is enqueued
    // for Supabase upload. `quizzes` registry entry uses LWW conflict strategy.
    await syncableWrite('quizzes', 'put', quiz as unknown as SyncableRecord)
  } catch (err) {
    console.warn(LOG_PREFIX, 'Failed to store quiz:', (err as Error).message)
    emitTracking('error', {
      errorCode: 'storage_failed',
      chunksProcessed: chunks.length,
      chunksFailed,
    })
    return {
      quiz,
      cached: false,
      error: `Quiz generated but storage failed: ${(err as Error).message}`,
      chunksProcessed: chunks.length,
      chunksFailed,
    }
  }

  emitTracking('success', {
    chunksProcessed: chunks.length,
    chunksFailed,
    questionCount: allQuestions.length,
  })

  return {
    quiz,
    cached: false,
    chunksProcessed: chunks.length,
    chunksFailed,
  }
}

// ---------------------------------------------------------------------------
// Question Generation + Validation
// ---------------------------------------------------------------------------

/**
 * Generate, validate, and QC questions for a single transcript chunk.
 * Retries up to MAX_RETRIES times on validation or QC failure.
 *
 * Provider-aware: For Ollama, uses the native /api/chat endpoint with
 * `format: QUIZ_RESPONSE_SCHEMA` for structured output enforcement.
 * For cloud providers, uses the streaming LLM client with prompt-based
 * JSON instruction and parseAndValidate() fallback parsing.
 *
 * Pipeline per attempt:
 * 1. Call LLM for raw questions (provider-aware path)
 * 2. Parse + Zod validate
 * 3. Run deterministic QC (duplicate detection, answer uniqueness, grounding)
 * 4. If QC rejects all questions, retry; otherwise return valid subset
 */
async function generateQuestionsForChunk(
  client: LLMClient,
  resolved: FeatureModelConfig,
  chunk: TranscriptChunk,
  bloomsLevel: BloomsLevel,
  questionCount: number,
  signal?: AbortSignal
): Promise<GeneratedQuestion[] | null> {
  const { systemPrompt, userPrompt } = buildQuizPrompt(chunk, bloomsLevel, questionCount)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let content: string | null

    if (resolved.provider === 'ollama') {
      content = await callOllamaNativeForQuizChunk(resolved, systemPrompt, userPrompt, signal)
    } else {
      content = await callLLMForQuizChunk(client, systemPrompt, userPrompt, signal)
    }

    if (!content) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          LOG_PREFIX,
          `Chunk "${chunk.topic}" attempt ${attempt + 1} returned no content, retrying...`
        )
        continue
      }
      return null
    }

    const parsed = parseAndValidate(content)
    if (!parsed) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          LOG_PREFIX,
          `Chunk "${chunk.topic}" attempt ${attempt + 1} failed validation, retrying...`
        )
      }
      continue
    }

    // Run QC pipeline on validated questions
    const qcResult = runQualityControl(parsed, chunk.text)

    if (qcResult.validQuestions.length > 0) {
      return qcResult.validQuestions
    }

    // All questions rejected by QC — retry if attempts remain
    if (qcResult.retryNeeded && attempt < MAX_RETRIES) {
      console.warn(
        LOG_PREFIX,
        `Chunk "${chunk.topic}" attempt ${attempt + 1} failed QC, retrying...`
      )
      continue
    }

    return null
  }

  console.warn(LOG_PREFIX, `Chunk "${chunk.topic}" failed after ${MAX_RETRIES + 1} attempts`)
  return null
}

/**
 * Call the streaming LLM client for a quiz chunk and collect the response.
 *
 * Uses `client.streamCompletion()` to send the prompts and
 * `collectStreamWithTimeout()` to gather the full response.
 * Returns null on any failure (never throws).
 */
async function callLLMForQuizChunk(
  client: LLMClient,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) {
    console.warn(LOG_PREFIX, 'Request already aborted')
    return null
  }

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const stream = client.streamCompletion(messages)
    const content = await collectStreamWithTimeout(stream, GENERATION_TIMEOUT_MS, signal)
    return content || null
  } catch (error) {
    if ((error as Error).name === 'AbortError' || signal?.aborted) {
      console.warn(LOG_PREFIX, 'Request timed out or was cancelled')
    } else {
      console.warn(LOG_PREFIX, 'LLM call failed:', (error as Error).message)
    }
    return null
  }
}

/**
 * Call Ollama's native /api/chat endpoint for a quiz chunk.
 *
 * Uses the `format: QUIZ_RESPONSE_SCHEMA` parameter for structured JSON output
 * enforcement, which local Ollama models (especially llama3.2) rely on for
 * valid structured output. Cloud providers use prompt-based JSON instruction
 * instead (via callLLMForQuizChunk).
 *
 * Returns null on any failure (never throws).
 */
async function callOllamaNativeForQuizChunk(
  resolved: FeatureModelConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (signal?.aborted) {
    console.warn(LOG_PREFIX, 'Request already aborted')
    return null
  }

  const serverUrl = getOllamaServerUrl()
  if (!serverUrl) {
    console.warn(LOG_PREFIX, 'Ollama server URL not configured')
    return null
  }

  const model = resolved.model || getOllamaSelectedModel() || 'llama3.2'
  const normalizedUrl = serverUrl.replace(/\/+$/, '')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const response = await fetch(`${normalizedUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        format: QUIZ_RESPONSE_SCHEMA,
        stream: false,
        options: { temperature: 0.3, num_predict: 4000 },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(LOG_PREFIX, `Ollama returned ${response.status}`)
      return null
    }

    const data = (await response.json()) as {
      message?: { content?: string }
    }

    return data.message?.content ?? null
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(LOG_PREFIX, 'Request timed out or was cancelled')
    } else {
      console.warn(LOG_PREFIX, 'Failed:', (error as Error).message)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Parse LLM response content and validate against QuizResponseSchema.
 */
function parseAndValidate(content: string): GeneratedQuestion[] | null {
  try {
    const json = JSON.parse(content)
    const result = QuizResponseSchema.safeParse(json)
    if (result.success) {
      return result.data.questions
    }
    console.warn(LOG_PREFIX, 'Validation failed:', result.error.issues.slice(0, 3))
    return null
  } catch {
    // Try extracting JSON from markdown fences
    try {
      const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (fenceMatch) {
        const json = JSON.parse(fenceMatch[1])
        const result = QuizResponseSchema.safeParse(json)
        if (result.success) return result.data.questions
      }
    } catch {
      // Fall through
    }

    console.warn(LOG_PREFIX, 'Could not parse response as JSON')
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 */
async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Look up a cached quiz by lessonId and transcriptHash.
 */
async function findCachedQuiz(lessonId: string, transcriptHash: string): Promise<Quiz | null> {
  const quizzes = await db.quizzes.where('lessonId').equals(lessonId).toArray()

  // Find one with matching transcriptHash
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const match = quizzes.find((q: any) => q.transcriptHash === transcriptHash)
  return (match as Quiz | undefined) ?? null
}

/**
 * Map a generated question to a full Question object.
 */
function mapToQuestion(generated: GeneratedQuestion, order: number): Question {
  return {
    id: crypto.randomUUID(),
    order,
    type: generated.type,
    text: generated.text,
    options: generated.options,
    correctAnswer: generated.correctAnswer,
    explanation: generated.explanation,
    points: 1,
    topic: generated.bloomsLevel,
  }
}

/**
 * Build a complete Quiz object ready for Dexie storage.
 */
function buildQuiz(
  lessonId: string,
  questions: Question[],
  transcriptHash: string,
  bloomsLevel: BloomsLevel,
  modelId: string
): Quiz {
  const now = new Date().toISOString()

  // The Quiz type from types/quiz.ts. We add extra fields for auto-generation metadata.
  // Dexie stores all fields even if not in the Zod schema.
  const quiz: Quiz & {
    source: string
    transcriptHash: string
    bloomsLevel: string
    generatedAt: string
    modelId: string
  } = {
    id: crypto.randomUUID(),
    lessonId,
    title: `Auto-Generated Quiz`,
    description: `Quiz generated from lesson transcript at ${bloomsLevel} level`,
    questions,
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: true,
    shuffleAnswers: true,
    createdAt: now,
    updatedAt: now,
    // Auto-generation metadata (AC: 4)
    source: 'auto-generated',
    transcriptHash,
    bloomsLevel,
    generatedAt: now,
    modelId,
  }

  return quiz as Quiz
}
