/**
 * Transcript Context Extraction (E57-S01)
 *
 * Extracts transcript context for the tutor system prompt using one of
 * three strategies: full (< 2K tokens), chapter-based, or sliding window.
 *
 * Token estimation uses ~4 chars/token heuristic per architecture spec.
 */

import { db } from '@/db'
import type { TranscriptCue, YouTubeCourseChapter } from '@/data/types'
import type { TranscriptStrategy, TranscriptStatus } from './types'

/** Rough token estimation: ~4 characters per token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Format seconds as MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Maximum token count for "full" strategy */
const FULL_TOKEN_LIMIT = 2000

/** Window size in tokens for "window" strategy */
const WINDOW_TOKEN_SIZE = 512

export interface TranscriptContextResult {
  /** Transcript excerpt to inject into prompt */
  excerpt: string
  /** Strategy used */
  strategy: TranscriptStrategy
  /** Status info for TranscriptBadge */
  status: TranscriptStatus
  /** Chapter title (if chapter strategy) */
  chapterTitle?: string
  /** Time range header (if window strategy) */
  timeRange?: string
}

/**
 * Get transcript context for a lesson.
 *
 * @param courseId - Course ID
 * @param lessonId - Lesson/video ID (matches importedVideos.id)
 * @param videoPositionSeconds - Current video playback position
 * @returns Transcript context result with excerpt and strategy info
 */
export async function getTranscriptContext(
  courseId: string,
  lessonId: string,
  videoPositionSeconds: number = 0
): Promise<TranscriptContextResult> {
  // Look up the video to get youtubeVideoId
  const video = await db.importedVideos.get(lessonId)
  const youtubeVideoId = video?.youtubeVideoId

  // Try to find transcript record
  let transcript = null
  if (youtubeVideoId) {
    transcript = await db.youtubeTranscripts
      .where('[courseId+videoId]')
      .equals([courseId, youtubeVideoId])
      .first()
  }

  // No transcript available
  if (!transcript || transcript.status !== 'done' || !transcript.fullText) {
    return {
      excerpt: '',
      strategy: 'none',
      status: {
        available: false,
        strategy: 'none',
        label: 'General mode',
      },
    }
  }

  const fullText = transcript.fullText
  const cues = transcript.cues ?? []
  const tokenCount = estimateTokens(fullText)

  // Strategy 1: Full transcript (< 2K tokens)
  if (tokenCount <= FULL_TOKEN_LIMIT) {
    return {
      excerpt: fullText,
      strategy: 'full',
      status: {
        available: true,
        strategy: 'full',
        label: 'Transcript-grounded',
      },
    }
  }

  // Strategy 2: Chapter-based — check for YouTube chapters
  if (youtubeVideoId) {
    const chapters = await db.youtubeChapters
      .where('courseId')
      .equals(courseId)
      .sortBy('order')

    // Filter chapters for this specific video
    const videoChapters = chapters.filter(
      (ch: YouTubeCourseChapter) => ch.videoId === youtubeVideoId
    )

    if (videoChapters.length > 0) {
      const chapterExcerpt = extractChapterContext(
        cues,
        videoChapters,
        videoPositionSeconds
      )
      if (chapterExcerpt) {
        return {
          excerpt: chapterExcerpt.text,
          strategy: 'chapter',
          chapterTitle: chapterExcerpt.title,
          status: {
            available: true,
            strategy: 'chapter',
            label: 'Transcript-grounded',
          },
        }
      }
    }
  }

  // Strategy 3: Window around current video position
  const windowResult = extractWindowContext(cues, videoPositionSeconds)
  return {
    excerpt: windowResult.text,
    strategy: 'window',
    timeRange: windowResult.timeRange,
    status: {
      available: true,
      strategy: 'window',
      label: 'Transcript-grounded',
    },
  }
}

/**
 * Extract transcript text for the chapter containing the given timestamp.
 */
function extractChapterContext(
  cues: TranscriptCue[],
  chapters: YouTubeCourseChapter[],
  positionSeconds: number
): { text: string; title: string } | null {
  // Find the chapter containing the current position
  let matchedChapter: YouTubeCourseChapter | null = null
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const endTime = chapter.endTime ?? chapters[i + 1]?.startTime ?? Infinity
    if (positionSeconds >= chapter.startTime && positionSeconds < endTime) {
      matchedChapter = chapter
      break
    }
  }

  // Default to first chapter if no match (e.g. position 0)
  if (!matchedChapter) {
    matchedChapter = chapters[0]
  }

  if (!matchedChapter) return null

  const endTime =
    matchedChapter.endTime ??
    chapters[chapters.indexOf(matchedChapter) + 1]?.startTime ??
    Infinity

  // Collect cues within the chapter's time range
  const chapterCues = cues.filter(
    cue => cue.startTime >= matchedChapter!.startTime && cue.startTime < endTime
  )

  if (chapterCues.length === 0) return null

  const text = chapterCues.map(c => c.text).join(' ')
  return { text, title: matchedChapter.title }
}

/**
 * Extract a ~512-token window centered on the current video position.
 */
function extractWindowContext(
  cues: TranscriptCue[],
  positionSeconds: number
): { text: string; timeRange: string } {
  if (cues.length === 0) {
    return { text: '', timeRange: '' }
  }

  // Find the cue closest to the current position
  let closestIndex = 0
  let closestDist = Math.abs(cues[0].startTime - positionSeconds)
  for (let i = 1; i < cues.length; i++) {
    const dist = Math.abs(cues[i].startTime - positionSeconds)
    if (dist < closestDist) {
      closestDist = dist
      closestIndex = i
    }
  }

  // Expand outward from the closest cue until we hit the token budget
  let startIdx = closestIndex
  let endIdx = closestIndex
  let tokenCount = estimateTokens(cues[closestIndex].text)

  while (tokenCount < WINDOW_TOKEN_SIZE) {
    const canExpandLeft = startIdx > 0
    const canExpandRight = endIdx < cues.length - 1

    if (!canExpandLeft && !canExpandRight) break

    // Expand in the direction with more room, alternating
    if (canExpandLeft) {
      startIdx--
      tokenCount += estimateTokens(cues[startIdx].text)
    }
    if (canExpandRight && tokenCount < WINDOW_TOKEN_SIZE) {
      endIdx++
      tokenCount += estimateTokens(cues[endIdx].text)
    }
  }

  const windowCues = cues.slice(startIdx, endIdx + 1)
  const text = windowCues.map(c => c.text).join(' ')
  const timeRange = `[${formatTime(windowCues[0].startTime)} - ${formatTime(windowCues[windowCues.length - 1].endTime)}]`

  return { text, timeRange }
}
