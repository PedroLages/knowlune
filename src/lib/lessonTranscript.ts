import type { TranscriptCue, YouTubeTranscriptRecord } from '@/data/types'
import { db } from '@/db/schema'
import { parseSRT, parseVTT } from '@/lib/captions'

export type LessonTranscriptSource = 'youtube' | 'local-caption' | 'whisper'

export interface ReadyLessonTranscript {
  status: 'ready'
  text: string
  cues: TranscriptCue[]
  fingerprint: string
  source: LessonTranscriptSource
  /** Storage key used for chapters and source-specific lookups. */
  videoId: string
}

export interface UnavailableLessonTranscript {
  status: 'missing' | 'processing' | 'error'
  reason: string
}

export type ResolvedLessonTranscript = ReadyLessonTranscript | UnavailableLessonTranscript

const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** Create a stable fingerprint used to invalidate derived lesson content. */
export async function fingerprintTranscript(text: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeText(text))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function toReadyTranscript(
  record: YouTubeTranscriptRecord,
  fallbackDuration: number
): Promise<ReadyLessonTranscript | null> {
  const text = normalizeText(record.fullText || record.cues.map(cue => cue.text).join(' '))
  if (!text) return null

  const cues = record.cues.length
    ? record.cues
    : [{ startTime: 0, endTime: Math.max(fallbackDuration, 1), text }]

  return {
    status: 'ready',
    text,
    cues,
    fingerprint: await fingerprintTranscript(text),
    source: record.source === 'whisper' ? 'whisper' : 'youtube',
    videoId: record.videoId,
  }
}

/**
 * Resolve a route lesson ID to the best transcript available for that lesson.
 *
 * Imported YouTube lessons use an internal lesson UUID while transcript rows use
 * the real YouTube video ID. Local captions and Whisper output are commonly
 * keyed by the internal lesson ID. This resolver handles both representations.
 */
export async function resolveLessonTranscript(
  courseId: string,
  lessonId: string
): Promise<ResolvedLessonTranscript> {
  try {
    const video = await db.importedVideos.get(lessonId)
    const youtubeVideoId = video?.courseId === courseId ? video.youtubeVideoId : undefined
    const candidateVideoIds = [...new Set([youtubeVideoId, lessonId].filter(Boolean))] as string[]
    const fallbackDuration = video?.duration ?? 300

    let processingReason: string | null = null
    let failureReason: string | null = null

    for (const videoId of candidateVideoIds) {
      const record = await db.youtubeTranscripts.get([courseId, videoId])
      if (!record) continue

      if (record.status === 'done') {
        const ready = await toReadyTranscript(record, fallbackDuration)
        if (ready) return ready
        failureReason = 'The stored transcript is empty.'
      } else if (record.status === 'pending' || record.status === 'fetching') {
        processingReason = 'The transcript is still being generated.'
      } else if (record.status === 'failed') {
        failureReason = record.failureReason || 'The transcript could not be generated.'
      }
    }

    for (const videoId of candidateVideoIds) {
      const caption = await db.videoCaptions.get([courseId, videoId])
      if (!caption) continue

      const cues = caption.format === 'srt' ? parseSRT(caption.content) : parseVTT(caption.content)
      const text = normalizeText(cues.map(cue => cue.text).join(' '))
      if (!text) {
        failureReason = 'The stored caption file could not be read.'
        continue
      }

      return {
        status: 'ready',
        text,
        cues,
        fingerprint: await fingerprintTranscript(text),
        source: 'local-caption',
        videoId,
      }
    }

    if (processingReason) return { status: 'processing', reason: processingReason }
    if (failureReason) return { status: 'error', reason: failureReason }

    return {
      status: 'missing',
      reason: 'No transcript is available for this lesson.',
    }
  } catch (error) {
    console.error('[LessonTranscript] Failed to resolve transcript:', error)
    return {
      status: 'error',
      reason: 'The transcript could not be loaded. Please try again.',
    }
  }
}
