/**
 * YouTube Transcript Pipeline — Tiered Fallback
 *
 * Fetches transcripts through a 3-tier fallback chain:
 *   Tier 1: youtube-transcript (server-side via Vite middleware)
 *   Tier 2: yt-dlp subtitles (user's self-hosted server, SSRF-validated)
 *   Tier 3: Whisper transcription (user's faster-whisper container, SSRF-validated)
 *
 * Tier 2 & 3 are Premium features requiring user-provided infrastructure
 * configured via Settings → YouTube → yt-dlp / Whisper URLs.
 *
 * Transcripts are stored in the `youtubeTranscripts` Dexie table with:
 * - Timestamped cues for click-to-seek
 * - Concatenated fullText for search indexing
 * - Per-video status tracking (pending → fetching → done | failed | unavailable)
 * - Source tracking ('youtube-transcript' | 'ytdlp' | 'whisper')
 */

import type { TranscriptCue, YouTubeTranscriptRecord } from '@/data/types'
import { db } from '@/db/schema'
import { getYouTubeConfiguration } from '@/lib/youtubeConfiguration'
import { parseVTT } from '@/lib/captions'

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
const YTDLP_SUBTITLES_ENDPOINT = '/api/youtube/ytdlp/subtitles'
const WHISPER_TRANSCRIBE_ENDPOINT = '/api/youtube/whisper/transcribe'
const YTDLP_METADATA_ENDPOINT = '/api/youtube/ytdlp/metadata'

/** Maximum time to wait for Tier 1 transcript fetch (ms) — NFR71: 2s target */
const TIER1_TIMEOUT = 5_000

/** Maximum time to wait for Tier 2 yt-dlp subtitle fetch (ms) */
const TIER2_TIMEOUT = 15_000

/** Maximum time to wait for Tier 3 Whisper transcription (ms) — FR118: 60s target */
const TIER3_TIMEOUT = 60_000

/** Tier 1 failure codes that trigger Tier 2 fallback */
const TIER2_FALLBACK_CODES = new Set([
  'no-captions-available',
  'captions-disabled',
  'language-not-available',
])

// ---------------------------------------------------------------------------
// Tier 1: youtube-transcript (core fetch)
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
 * Tier 1: Fetch transcript via youtube-transcript npm package (server-side proxy).
 */
async function fetchTier1(videoId: string, lang?: string): Promise<TranscriptResult> {
  const response = await fetch(TRANSCRIPT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, lang }),
    signal: AbortSignal.timeout(TIER1_TIMEOUT),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: `HTTP ${response.status}`,
      code: 'fetch-error',
    }))) as TranscriptError
    return { ok: false, code: errorData.code, message: errorData.error }
  }

  const data = (await response.json()) as TranscriptResponse
  const fullText = data.cues.map(c => c.text).join(' ')

  return {
    ok: true,
    record: {
      courseId: '', // filled by caller
      videoId,
      language: data.language,
      cues: data.cues,
      fullText,
      source: 'youtube-transcript',
      status: 'done',
      fetchedAt: new Date().toISOString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Tier 2: yt-dlp subtitles (user's self-hosted server)
// ---------------------------------------------------------------------------

interface YtDlpSubtitlesResponse {
  vtt: string
  language: string
}

/**
 * Tier 2: Fetch subtitles via user's self-hosted yt-dlp server.
 * Requires `ytDlpServerUrl` configured in Settings.
 */
async function fetchTier2(
  videoId: string,
  ytDlpServerUrl: string,
  lang?: string
): Promise<TranscriptResult> {
  const response = await fetch(YTDLP_SUBTITLES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, serverUrl: ytDlpServerUrl, lang }),
    signal: AbortSignal.timeout(TIER2_TIMEOUT),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: `HTTP ${response.status}`,
      code: 'ytdlp-fetch-error',
    }))) as TranscriptError
    return { ok: false, code: errorData.code, message: errorData.error }
  }

  const data = (await response.json()) as YtDlpSubtitlesResponse
  const cues = parseVTT(data.vtt)
  const fullText = cues.map(c => c.text).join(' ')

  return {
    ok: true,
    record: {
      courseId: '', // filled by caller
      videoId,
      language: data.language || lang || 'en',
      cues,
      fullText,
      source: 'yt-dlp',
      status: 'done',
      fetchedAt: new Date().toISOString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Tier 3: Whisper transcription (user's faster-whisper container)
// ---------------------------------------------------------------------------

interface WhisperTranscribeResponse {
  vtt: string
  language: string
  duration?: number
}

/**
 * Tier 3: Transcribe via user's faster-whisper Docker container.
 * Requires `whisperEndpointUrl` configured in Settings.
 */
async function fetchTier3(
  videoId: string,
  whisperEndpointUrl: string,
  lang?: string
): Promise<TranscriptResult> {
  const response = await fetch(WHISPER_TRANSCRIBE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, serverUrl: whisperEndpointUrl, lang }),
    signal: AbortSignal.timeout(TIER3_TIMEOUT),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: `HTTP ${response.status}`,
      code: 'whisper-fetch-error',
    }))) as TranscriptError
    return { ok: false, code: errorData.code, message: errorData.error }
  }

  const data = (await response.json()) as WhisperTranscribeResponse
  const cues = parseVTT(data.vtt)
  const fullText = cues.map(c => c.text).join(' ')

  return {
    ok: true,
    record: {
      courseId: '', // filled by caller
      videoId,
      language: data.language || lang || 'en',
      cues,
      fullText,
      source: 'whisper',
      status: 'done',
      fetchedAt: new Date().toISOString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Core fetch with tiered fallback
// ---------------------------------------------------------------------------

/**
 * Fetch a transcript for a single YouTube video through the tiered fallback chain.
 *
 * Chain: Tier 1 (youtube-transcript) → Tier 2 (yt-dlp) → Tier 3 (Whisper)
 *
 * Unconfigured tiers are silently skipped (no error thrown).
 * When all configured tiers fail, the video is marked `status: 'unavailable'`.
 */
export async function fetchTranscript(
  courseId: string,
  videoId: string,
  lang?: string
): Promise<TranscriptResult> {
  const config = getYouTubeConfiguration()

  // --- Tier 1: youtube-transcript ---
  try {
    const tier1 = await fetchTier1(videoId, lang)
    if (tier1.ok) {
      tier1.record.courseId = courseId
      await db.youtubeTranscripts.put(tier1.record)
      return tier1
    }

    // Only fall back to Tier 2 for specific caption-unavailable errors
    if (!TIER2_FALLBACK_CODES.has(tier1.code)) {
      // Non-fallbackable error (network, timeout, rate-limit) — store as failed
      const failureRecord = makeFailureRecord(
        courseId,
        videoId,
        lang,
        'youtube-transcript',
        tier1.code
      )
      await db.youtubeTranscripts.put(failureRecord)
      return tier1
    }

    // Continue to Tier 2...
  } catch (error) {
    const err = error as Error
    const code =
      err.name === 'AbortError' || err.name === 'TimeoutError' ? 'timeout' : 'network-error'

    // Network/timeout errors don't trigger fallback — infrastructure issue, not missing captions
    const failureRecord = makeFailureRecord(courseId, videoId, lang, 'youtube-transcript', code)
    await db.youtubeTranscripts.put(failureRecord)
    return { ok: false, code, message: err.message }
  }

  // --- Tier 2: yt-dlp subtitles (if configured) ---
  if (config.ytDlpServerUrl) {
    try {
      const tier2 = await fetchTier2(videoId, config.ytDlpServerUrl, lang)
      if (tier2.ok) {
        tier2.record.courseId = courseId
        await db.youtubeTranscripts.put(tier2.record)
        return tier2
      }
      // Tier 2 failed — continue to Tier 3...
    } catch {
      // Tier 2 threw — continue to Tier 3 silently
    }
  }

  // --- Tier 3: Whisper transcription (if configured) ---
  if (config.whisperEndpointUrl) {
    try {
      const tier3 = await fetchTier3(videoId, config.whisperEndpointUrl, lang)
      if (tier3.ok) {
        tier3.record.courseId = courseId
        await db.youtubeTranscripts.put(tier3.record)
        return tier3
      }
      // Tier 3 failed — fall through to unavailable
    } catch {
      // Tier 3 threw — fall through to unavailable silently
    }
  }

  // --- All tiers exhausted — mark as unavailable ---
  const unavailableRecord: YouTubeTranscriptRecord = {
    courseId,
    videoId,
    language: lang || '',
    cues: [],
    fullText: '',
    source: 'youtube-transcript',
    status: 'unavailable',
    failureReason: 'all-tiers-exhausted',
    fetchedAt: new Date().toISOString(),
  }
  await db.youtubeTranscripts.put(unavailableRecord)

  return {
    ok: false,
    code: 'all-tiers-exhausted',
    message: 'No transcript source available for this video',
  }
}

// ---------------------------------------------------------------------------
// yt-dlp metadata enrichment
// ---------------------------------------------------------------------------

export interface YtDlpMetadata {
  title?: string
  description?: string
  chapters?: Array<{ title: string; startTime: number; endTime: number }>
  duration?: number
  uploadDate?: string
}

/**
 * Fetch enriched metadata from user's yt-dlp server.
 * Returns chapter markers and cleaned descriptions.
 *
 * Returns null if yt-dlp is not configured.
 */
export async function fetchYtDlpMetadata(videoId: string): Promise<YtDlpMetadata | null> {
  const config = getYouTubeConfiguration()
  if (!config.ytDlpServerUrl) return null

  try {
    const response = await fetch(YTDLP_METADATA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, serverUrl: config.ytDlpServerUrl }),
      signal: AbortSignal.timeout(TIER2_TIMEOUT),
    })

    if (!response.ok) return null

    return (await response.json()) as YtDlpMetadata
  } catch {
    return null
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
  currentTier?: 'tier1' | 'tier2' | 'tier3' // which tier is active
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
export async function getCourseTranscripts(courseId: string): Promise<YouTubeTranscriptRecord[]> {
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeFailureRecord(
  courseId: string,
  videoId: string,
  lang: string | undefined,
  source: YouTubeTranscriptRecord['source'],
  failureReason: string
): YouTubeTranscriptRecord {
  return {
    courseId,
    videoId,
    language: lang || '',
    cues: [],
    fullText: '',
    source,
    status: 'failed',
    failureReason,
    fetchedAt: new Date().toISOString(),
  }
}
