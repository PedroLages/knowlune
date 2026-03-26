/**
 * Zustand store for YouTube transcript pipeline state.
 *
 * Tracks per-video transcript fetch status and provides batch progress
 * for the course import wizard's "Fetching transcripts... 12 of 20" indicator.
 */

import { create } from 'zustand'
import type { YouTubeTranscriptRecord } from '@/data/types'
import {
  fetchTranscriptsBatch,
  getTranscript,
  getCourseTranscripts,
  type BatchProgress,
} from '@/lib/youtubeTranscriptPipeline'

type TranscriptStatus = 'pending' | 'fetching' | 'done' | 'failed' | 'unavailable'

interface VideoTranscriptState {
  status: TranscriptStatus
  failureReason?: string
}

interface YouTubeTranscriptStoreState {
  /** Per-video status map: `${courseId}:${videoId}` → state */
  videoStates: Record<string, VideoTranscriptState>

  /** Current batch progress (null when no batch is running) */
  batchProgress: BatchProgress | null

  /** Whether a batch fetch is currently in progress */
  isFetching: boolean

  /** Fetch transcripts for a batch of videos in the background */
  fetchBatch: (courseId: string, videoIds: string[], lang?: string) => Promise<void>

  /** Get status for a specific video */
  getVideoStatus: (courseId: string, videoId: string) => TranscriptStatus | undefined

  /** Load transcript states from Dexie for a course */
  loadCourseStates: (courseId: string) => Promise<void>

  /** Get a single transcript record from Dexie */
  getTranscript: (courseId: string, videoId: string) => Promise<YouTubeTranscriptRecord | undefined>

  /** Reset store state */
  reset: () => void
}

function makeKey(courseId: string, videoId: string): string {
  return `${courseId}:${videoId}`
}

export const useYouTubeTranscriptStore = create<YouTubeTranscriptStoreState>((set, get) => ({
  videoStates: {},
  batchProgress: null,
  isFetching: false,

  fetchBatch: async (courseId, videoIds, lang) => {
    if (get().isFetching) return // Prevent concurrent batches

    set({ isFetching: true })

    // Initialize all as pending
    const states: Record<string, VideoTranscriptState> = { ...get().videoStates }
    for (const videoId of videoIds) {
      states[makeKey(courseId, videoId)] = { status: 'pending' }
    }
    set({ videoStates: states })

    await fetchTranscriptsBatch(
      courseId,
      videoIds,
      (progress) => {
        set({ batchProgress: { ...progress } })

        // Update individual video states based on progress
        if (progress.current) {
          const key = makeKey(courseId, progress.current)
          const updatedStates = { ...get().videoStates }
          updatedStates[key] = { status: 'fetching' }
          set({ videoStates: updatedStates })
        }
      },
      lang
    )

    // Reload final states from Dexie
    await get().loadCourseStates(courseId)

    set({ isFetching: false, batchProgress: null })
  },

  getVideoStatus: (courseId, videoId) => {
    return get().videoStates[makeKey(courseId, videoId)]?.status
  },

  loadCourseStates: async (courseId) => {
    const records = await getCourseTranscripts(courseId)
    const states: Record<string, VideoTranscriptState> = { ...get().videoStates }

    for (const record of records) {
      const key = makeKey(courseId, record.videoId)
      states[key] = {
        status: record.status,
        failureReason: record.failureReason,
      }
    }

    set({ videoStates: states })
  },

  getTranscript: async (courseId, videoId) => {
    return getTranscript(courseId, videoId)
  },

  reset: () => {
    set({ videoStates: {}, batchProgress: null, isFetching: false })
  },
}))
