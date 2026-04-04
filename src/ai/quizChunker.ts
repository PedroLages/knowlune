/**
 * Transcript Chunker for Quiz Generation
 *
 * Splits lesson transcripts into chunks suitable for quiz question generation.
 * Two strategies:
 *   1. Chapter-based: Uses YouTube chapters from `youtubeChapters` table
 *   2. Fixed time window: Falls back to 5-minute windows when no chapters exist
 *
 * Each chunk targets 500-1,500 words for optimal LLM question generation.
 *
 * @module
 */

import { db } from '@/db/schema'
import type { TranscriptCue, YouTubeCourseChapter } from '@/data/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A transcript chunk ready for quiz generation */
export interface TranscriptChunk {
  /** The text content of this chunk */
  text: string
  /** Topic/title for this chunk (chapter title or "Part N") */
  topic: string
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Target minimum words per chunk */
const MIN_WORDS = 500

/** Target maximum words per chunk */
const MAX_WORDS = 1500

/** Fixed time window in seconds (5 minutes) for fallback chunking */
const FIXED_WINDOW_SECONDS = 300

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Chunk a lesson transcript for quiz generation.
 *
 * Looks up the transcript from `youtubeTranscripts` and chapters from
 * `youtubeChapters`. If chapters exist, splits by chapter boundaries.
 * Otherwise falls back to fixed 5-minute time windows.
 *
 * @param lessonId - The videoId of the lesson (YouTube video ID)
 * @param courseId - The course ID containing this lesson
 * @returns Array of transcript chunks, or empty array if no transcript found
 */
export async function chunkTranscript(
  lessonId: string,
  courseId: string
): Promise<TranscriptChunk[]> {
  // Fetch transcript
  const transcript = await db.youtubeTranscripts
    .where('[courseId+videoId]')
    .equals([courseId, lessonId])
    .first()

  if (!transcript || transcript.status !== 'done' || !transcript.cues?.length) {
    console.warn('[QuizChunker] No valid transcript found for', lessonId)
    return []
  }

  // Fetch chapters for this course/video
  const chapters = await db.youtubeChapters
    .where('courseId')
    .equals(courseId)
    .sortBy('order')

  // Filter chapters to only those matching this video
  const videoChapters = chapters.filter(ch => ch.videoId === lessonId)

  if (videoChapters.length > 0) {
    return chunkByChapters(transcript.cues, videoChapters)
  }

  return chunkByTimeWindow(transcript.cues)
}

// ---------------------------------------------------------------------------
// Chapter-based chunking
// ---------------------------------------------------------------------------

/**
 * Split transcript cues by chapter boundaries.
 * Merges small chapters to meet minimum word count.
 */
function chunkByChapters(
  cues: TranscriptCue[],
  chapters: YouTubeCourseChapter[]
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = []

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const nextChapter = chapters[i + 1]

    const startTime = chapter.startTime
    const endTime = chapter.endTime ?? nextChapter?.startTime ?? Infinity

    const chapterCues = cues.filter(
      cue => cue.startTime >= startTime && cue.startTime < endTime
    )

    const text = chapterCues.map(c => c.text).join(' ').trim()
    if (!text) continue

    const wordCount = countWords(text)

    // If chunk is too small, try to merge with the previous chunk
    if (wordCount < MIN_WORDS && chunks.length > 0) {
      const prev = chunks[chunks.length - 1]
      const mergedText = `${prev.text} ${text}`
      if (countWords(mergedText) <= MAX_WORDS) {
        prev.text = mergedText
        prev.topic = `${prev.topic} & ${chapter.title}`
        prev.endTime = endTime === Infinity ? chapterCues[chapterCues.length - 1]?.endTime ?? startTime : endTime
        continue
      }
    }

    // If chunk is too large, split it
    if (wordCount > MAX_WORDS) {
      const subChunks = splitLargeChunk(chapterCues, chapter.title, startTime, endTime)
      chunks.push(...subChunks)
    } else {
      chunks.push({
        text,
        topic: chapter.title,
        startTime,
        endTime: endTime === Infinity ? chapterCues[chapterCues.length - 1]?.endTime ?? startTime : endTime,
      })
    }
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Fixed time window chunking
// ---------------------------------------------------------------------------

/**
 * Split transcript cues into fixed 5-minute windows.
 * Each window targets 500-1,500 words.
 */
function chunkByTimeWindow(cues: TranscriptCue[]): TranscriptChunk[] {
  if (cues.length === 0) return []

  const chunks: TranscriptChunk[] = []
  const totalDuration = cues[cues.length - 1].endTime
  let windowStart = 0
  let partNumber = 1

  while (windowStart < totalDuration) {
    const windowEnd = windowStart + FIXED_WINDOW_SECONDS

    const windowCues = cues.filter(
      cue => cue.startTime >= windowStart && cue.startTime < windowEnd
    )

    const text = windowCues.map(c => c.text).join(' ').trim()

    if (text && countWords(text) >= MIN_WORDS / 2) {
      // Accept chunks with at least half the minimum (250 words) to avoid losing content
      chunks.push({
        text,
        topic: `Part ${partNumber}`,
        startTime: windowStart,
        endTime: windowEnd,
      })
      partNumber++
    } else if (text && chunks.length > 0) {
      // Merge small window into previous chunk
      const prev = chunks[chunks.length - 1]
      prev.text = `${prev.text} ${text}`
      prev.endTime = windowEnd
    } else if (text) {
      // First window too small, still create it
      chunks.push({
        text,
        topic: `Part ${partNumber}`,
        startTime: windowStart,
        endTime: windowEnd,
      })
      partNumber++
    }

    windowStart = windowEnd
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a large chunk (>MAX_WORDS) into smaller sub-chunks.
 */
function splitLargeChunk(
  cues: TranscriptCue[],
  topic: string,
  _startTime: number,
  _endTime: number
): TranscriptChunk[] {
  const subChunks: TranscriptChunk[] = []
  let currentCues: TranscriptCue[] = []
  let currentWordCount = 0
  let partNum = 1

  for (const cue of cues) {
    const cueWords = countWords(cue.text)
    if (currentWordCount + cueWords > MAX_WORDS && currentCues.length > 0) {
      subChunks.push({
        text: currentCues.map(c => c.text).join(' ').trim(),
        topic: `${topic} (Part ${partNum})`,
        startTime: currentCues[0].startTime,
        endTime: currentCues[currentCues.length - 1].endTime,
      })
      partNum++
      currentCues = []
      currentWordCount = 0
    }
    currentCues.push(cue)
    currentWordCount += cueWords
  }

  if (currentCues.length > 0) {
    subChunks.push({
      text: currentCues.map(c => c.text).join(' ').trim(),
      topic: partNum > 1 ? `${topic} (Part ${partNum})` : topic,
      startTime: currentCues[0].startTime,
      endTime: currentCues[currentCues.length - 1].endTime,
    })
  }

  return subChunks
}

/** Count words in a string */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
