/**
 * YouTube Transcript Pipeline — Tier 1 (youtube-transcript)
 *
 * Fetches transcripts via the Vite middleware endpoint (`POST /api/youtube/transcript`)
 * which uses the `youtube-transcript` npm package server-side to bypass CORS.
 *
 * Transcripts are stored in the `youtubeTranscripts` Dexie table with:
 * - Timestamped cues for click-to-seek
 * - Concatenated fullText for search indexing
 * - Per-video status tracking (pending → fetching → done | failed)
 *
 * Tier 2 (yt-dlp) and Tier 3 (Whisper) are handled in Story 23.11.
 */

import type { TranscriptCue, YouTubeTranscriptRecord } from '@/data/types'
import { db } from '@/db/schema'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type TranscriptResult =
  | { ok: true; record: YouTubeTranscriptRecord }
  | { ok: false; code: string; message: string }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSCRIPT_ENDPOINT = '/api/youtube/transcript'

/** Maximum time to wait for a single transcript fetch (ms) — NFR71: 2s target */
const FETCH_TIMEOUT = 5_000

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

interface TranscriptResponse {
  cues: TranscriptCue[]
  language: string
}

interface TranscriptError {
  error: string
  code: string
}

/**
 * Fetch a transcript for a single YouTube video via the server-side proxy.
 * Returns a Result discriminated union for explicit error handling.
 */
export async function fetchTranscript(
  courseId: string,
  videoId: string,
  lang?: string
): Promise<TranscriptResult> {
  try {
    const response = await fetch(TRANSCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, lang }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
        code: 'fetch-error',
      })) as TranscriptError

      // Store failure record in Dexie
      const failureRecord: YouTubeTranscriptRecord = {
        courseId,
        videoId,
        language: lang || '',
        cues: [],
        fullText: '',
        source: 'youtube-transcript',
        status: 'failed',
        failureReason: errorData.code,
        fetchedAt: new Date().toISOString(),
      }
      await db.youtubeTranscripts.put(failureRecord)

      return { ok: false, code: errorData.code, message: errorData.error }
    }

    const data = await response.json() as TranscriptResponse

    const fullText = data.cues.map(c => c.text).join(' ')

    const record: YouTubeTranscriptRecord = {
      courseId,
      videoId,
      language: data.language,
      cues: data.cues,
      fullText,
      source: 'youtube-transcript',
      status: 'done',
      fetchedAt: new Date().toISOString(),
    }

    await db.youtubeTranscripts.put(record)

    return { ok: true, record }
  } catch (error) {
    const err = error as Error
    const code = err.name === 'AbortError' || err.name === 'TimeoutError'
      ? 'timeout'
      : 'network-error'

    // Store failure record
    const failureRecord: YouTubeTranscriptRecord = {
      courseId,
      videoId,
      language: lang || '',
      cues: [],
      fullText: '',
      source: 'youtube-transcript',
      status: 'failed',
      failureReason: code,
      fetchedAt: new Date().toISOString(),
    }
    await db.youtubeTranscripts.put(failureRecord)

    return { ok: false, code, message: err.message }
  }
}

// ---------------------------------------------------------------------------
// Batch fetch with progress tracking
// ---------------------------------------------------------------------------

export interface BatchProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
  current?: string // videoId currently being fetched
}

export type BatchProgressCallback = (progress: BatchProgress) => void

/**
 * Batch-fetch transcripts for multiple videos.
 * Runs sequentially to avoid overwhelming the proxy/YouTube.
 * Calls `onProgress` after each video completes.
 */
export async function fetchTranscriptsBatch(
  courseId: string,
  videoIds: string[],
  onProgress?: BatchProgressCallback,
  lang?: string
): Promise<TranscriptResult[]> {
  const results: TranscriptResult[] = []
  const progress: BatchProgress = {
    total: videoIds.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
  }

  // Mark all videos as pending first
  for (const videoId of videoIds) {
    const existing = await db.youtubeTranscripts.get([courseId, videoId])
    if (!existing || existing.status === 'failed') {
      await db.youtubeTranscripts.put({
        courseId,
        videoId,
        language: lang || '',
        cues: [],
        fullText: '',
        source: 'youtube-transcript',
        status: 'pending',
        fetchedAt: new Date().toISOString(),
      })
    }
  }

  for (const videoId of videoIds) {
    // Skip already-done transcripts
    const existing = await db.youtubeTranscripts.get([courseId, videoId])
    if (existing?.status === 'done') {
      progress.completed++
      progress.succeeded++
      results.push({ ok: true, record: existing })
      onProgress?.(progress)
      continue
    }

    // Mark as fetching
    await db.youtubeTranscripts.update([courseId, videoId], { status: 'fetching' })
    progress.current = videoId
    onProgress?.({ ...progress })

    const result = await fetchTranscript(courseId, videoId, lang)
    results.push(result)

    progress.completed++
    if (result.ok) {
      progress.succeeded++
    } else {
      progress.failed++
    }
    onProgress?.({ ...progress })
  }

  return results
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Get a stored transcript for a specific video in a course.
 * Returns undefined if not yet fetched.
 */
export async function getTranscript(
  courseId: string,
  videoId: string
): Promise<YouTubeTranscriptRecord | undefined> {
  return db.youtubeTranscripts.get([courseId, videoId])
}

/**
 * Get all transcripts for a course.
 */
export async function getCourseTranscripts(
  courseId: string
): Promise<YouTubeTranscriptRecord[]> {
  return db.youtubeTranscripts.where('courseId').equals(courseId).toArray()
}

/**
 * Search transcripts by full text within a course.
 * Returns matching records with the search term highlighted in context.
 */
export async function searchTranscripts(
  courseId: string,
  query: string
): Promise<YouTubeTranscriptRecord[]> {
  const all = await getCourseTranscripts(courseId)
  const lowerQuery = query.toLowerCase()
  return all.filter(
    record => record.status === 'done' && record.fullText.toLowerCase().includes(lowerQuery)
  )
}
