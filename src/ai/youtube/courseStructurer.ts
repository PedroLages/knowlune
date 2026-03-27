/**
 * AI-Powered Course Structuring
 *
 * Analyzes YouTube video metadata (titles, descriptions, tags, durations)
 * and proposes an intelligent chapter structure using pedagogical progression.
 *
 * Uses the existing `getLLMClient()` factory — works with any configured
 * provider (Ollama, OpenAI, Anthropic, etc.) following the BYOK philosophy.
 *
 * Premium feature — gated behind PremiumGate in the UI.
 *
 * Story: E28-S07
 * @see YouTubeImportDialog.tsx — consumer of this module
 * @see youtubeRuleBasedGrouping.ts — rule-based fallback (E28-S06)
 */

import { getLLMClient } from '@/ai/llm/factory'
import type { LLMMessage } from '@/ai/llm/types'
import type { VideoChapter } from '@/lib/youtubeRuleBasedGrouping'

// --- Types ---

/** Input video metadata for AI structuring */
export interface StructuringVideo {
  videoId: string
  title: string
  description?: string
  duration: number // seconds
  tags?: string[]
}

/** AI-proposed chapter with rationale */
export interface AIChapter {
  title: string
  videoIds: string[]
  rationale: string
}

/** Full AI course structure proposal */
export interface CourseStructureProposal {
  chapters: AIChapter[]
  suggestedCourseTitle?: string
  suggestedDescription?: string
  suggestedTags?: string[]
}

/** Result from structureCourseWithAI */
export type StructuringResult =
  | { ok: true; proposal: CourseStructureProposal }
  | { ok: false; error: string }

// --- Constants ---

/** Timeout for AI structuring request (30 seconds per AC) */
const AI_STRUCTURING_TIMEOUT_MS = 30_000

/** Minimum videos required for AI structuring (skip for fewer than 3) */
const MIN_VIDEOS_FOR_AI = 3

// --- System Prompt ---

const SYSTEM_PROMPT = `You are a course curriculum designer. Given a list of YouTube videos with their titles, descriptions, and durations, organize them into a logical chapter structure.

Rules:
1. Group related videos into chapters based on topic progression, not just keyword similarity.
2. Order chapters from foundational concepts to advanced topics when possible.
3. Each chapter should have 2-8 videos (avoid single-video chapters unless clearly standalone).
4. Give each chapter a clear, descriptive title.
5. Provide a brief rationale for each chapter explaining why those videos belong together.
6. Suggest an overall course title, description, and 2-5 topic tags.

Return valid JSON only with this exact structure:
{
  "chapters": [
    {
      "title": "Chapter Title",
      "videoIds": ["videoId1", "videoId2"],
      "rationale": "Why these videos are grouped together"
    }
  ],
  "suggestedCourseTitle": "Overall Course Title",
  "suggestedDescription": "1-2 sentence course description",
  "suggestedTags": ["tag1", "tag2"]
}`

// --- Core Function ---

/**
 * Structure a course using AI analysis of video metadata.
 *
 * Sends video metadata to the configured LLM provider and returns
 * a CourseStructureProposal with chapters, rationale, and suggestions.
 *
 * Skips AI for fewer than 3 videos (returns single-chapter fallback).
 *
 * @param videos - Video metadata to analyze
 * @param signal - Optional AbortSignal for cancellation
 * @returns StructuringResult with proposal or error message
 */
export async function structureCourseWithAI(
  videos: StructuringVideo[],
  signal?: AbortSignal
): Promise<StructuringResult> {
  // Skip AI for fewer than 3 videos
  if (videos.length < MIN_VIDEOS_FOR_AI) {
    return {
      ok: true,
      proposal: {
        chapters: [
          {
            title: 'All Videos',
            videoIds: videos.map(v => v.videoId),
            rationale: 'Single chapter — too few videos for AI structuring.',
          },
        ],
      },
    }
  }

  // Build user prompt with video metadata
  const userPrompt = buildUserPrompt(videos)

  try {
    const client = await getLLMClient()

    // Collect streamed response with timeout
    const fullResponse = await collectStreamWithTimeout(
      client.streamCompletion([
        { role: 'system', content: SYSTEM_PROMPT } as LLMMessage,
        { role: 'user', content: userPrompt } as LLMMessage,
      ]),
      AI_STRUCTURING_TIMEOUT_MS,
      signal
    )

    // Parse the response
    const proposal = parseAIResponse(fullResponse, videos)
    if (!proposal) {
      return { ok: false, error: 'AI returned an invalid response structure.' }
    }

    return { ok: true, proposal }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during AI structuring.'

    if (
      message.includes('abort') ||
      message.includes('AbortError') ||
      message.includes('timeout')
    ) {
      return { ok: false, error: 'AI structuring timed out.' }
    }

    return { ok: false, error: message }
  }
}

// --- Helpers ---

/**
 * Build a user prompt with video metadata for the LLM.
 * Truncates descriptions to avoid exceeding context window.
 */
function buildUserPrompt(videos: StructuringVideo[]): string {
  const videoList = videos
    .map((v, i) => {
      const desc = v.description ? truncate(v.description, 200) : ''
      const tags = v.tags?.length ? `Tags: ${v.tags.join(', ')}` : ''
      const duration = formatDurationForPrompt(v.duration)
      return `${i + 1}. [${v.videoId}] "${v.title}" (${duration})${desc ? `\n   Description: ${desc}` : ''}${tags ? `\n   ${tags}` : ''}`
    })
    .join('\n')

  return `Organize these ${videos.length} videos into chapters:\n\n${videoList}`
}

/**
 * Collect all chunks from a streaming completion into a single string,
 * with a timeout and abort signal.
 */
async function collectStreamWithTimeout(
  stream: AsyncGenerator<{ content: string }, void, unknown>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let content = ''
    let done = false
    const timeoutId = setTimeout(() => {
      if (!done) {
        done = true
        reject(new Error('AI structuring request timed out.'))
      }
    }, timeoutMs)

    const onAbort = () => {
      if (!done) {
        done = true
        clearTimeout(timeoutId)
        reject(new Error('AI structuring was cancelled.'))
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

/**
 * Parse AI response with defensive fallback chain.
 * Validates that all video IDs in the proposal exist in the input.
 */
export function parseAIResponse(
  content: string,
  videos: StructuringVideo[]
): CourseStructureProposal | null {
  const validVideoIds = new Set(videos.map(v => v.videoId))

  // Try parsing strategies
  const parsed = tryParseJSON(content)
  if (!parsed) return null

  // Validate chapters array
  if (!Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
    return null
  }

  // Validate and clean chapters
  const chapters: AIChapter[] = []
  const assignedVideoIds = new Set<string>()

  for (const ch of parsed.chapters) {
    if (!ch || typeof ch.title !== 'string') continue

    const videoIds = Array.isArray(ch.videoIds)
      ? ch.videoIds.filter(
          (id: unknown): id is string =>
            typeof id === 'string' && validVideoIds.has(id) && !assignedVideoIds.has(id)
        )
      : []

    if (videoIds.length === 0) continue

    for (const id of videoIds) {
      assignedVideoIds.add(id)
    }

    chapters.push({
      title: ch.title.trim(),
      videoIds,
      rationale: typeof ch.rationale === 'string' ? ch.rationale.trim() : '',
    })
  }

  if (chapters.length === 0) return null

  // Assign any unassigned videos to an "Other" chapter
  const unassigned = videos.map(v => v.videoId).filter(id => !assignedVideoIds.has(id))

  if (unassigned.length > 0) {
    chapters.push({
      title: 'Other Videos',
      videoIds: unassigned,
      rationale: 'Videos not assigned to a specific chapter by AI.',
    })
  }

  return {
    chapters,
    suggestedCourseTitle:
      typeof parsed.suggestedCourseTitle === 'string'
        ? parsed.suggestedCourseTitle.trim()
        : undefined,
    suggestedDescription:
      typeof parsed.suggestedDescription === 'string'
        ? parsed.suggestedDescription.trim()
        : undefined,
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .filter((t: unknown): t is string => typeof t === 'string')
          .map((t: string) => t.trim().toLowerCase())
          .slice(0, 5)
      : undefined,
  }
}

/**
 * Try to parse JSON with multiple fallback strategies.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParseJSON(content: string): any {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(content)
  } catch {
    // Fall through
  }

  // Strategy 2: Extract from code fences
  try {
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1])
    }
  } catch {
    // Fall through
  }

  // Strategy 3: Find JSON object with regex
  try {
    const braceMatch = content.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      return JSON.parse(braceMatch[0])
    }
  } catch {
    // Fall through
  }

  console.warn('[CourseStructurer] Could not parse AI response:', content.slice(0, 200))
  return null
}

/** Convert AI chapters to the VideoChapter format used by the editor */
export function aiChaptersToVideoChapters(
  aiChapters: AIChapter[]
): (VideoChapter & { rationale?: string })[] {
  return aiChapters.map((ch, idx) => ({
    id: `ai-chapter-${idx}`,
    title: ch.title,
    videoIds: ch.videoIds,
    source: 'ai' as const,
    rationale: ch.rationale,
  }))
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

function formatDurationForPrompt(seconds: number): string {
  if (seconds <= 0) return 'unknown duration'
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}
