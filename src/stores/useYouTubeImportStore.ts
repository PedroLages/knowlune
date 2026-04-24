/**
 * YouTube Import Wizard Store
 *
 * Manages state for the 4-step YouTube import wizard:
 * Step 1: URL input — parse and validate YouTube URLs
 * Step 2: Metadata preview — fetch video metadata, allow removal
 * Step 3: Organize — group videos into chapters (E28-S06)
 * Step 4: Details — course name, description, tags, thumbnail, save (E28-S08)
 *
 * @see E28-S05 — Import Wizard Steps 1 & 2
 * @see E28-S06 — Rule-Based Video Grouping & Chapter Editor
 * @see E28-S08 — Import Wizard Step 4 (Course Details & Save)
 */

import { create } from 'zustand'

import type {
  YouTubeVideoCache,
  ImportedCourse,
  ImportedVideo,
  YouTubeCourseChapter,
  UnembeddableReason,
} from '@/data/types'
import type { YouTubeUrlParseResult } from '@/lib/youtubeUrlParser'
import type { VideoChapter } from '@/lib/youtubeRuleBasedGrouping'
import { db } from '@/db'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import type { SyncableRecord } from '@/lib/sync/syncableWrite'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'
import { probeEmbeddability } from '@/lib/youtubeEmbeddability'

// --- Types ---

export type YouTubeImportStep = 1 | 2 | 3 | 4

/** A parsed URL entry with its resolution choice (for video-in-playlist URLs) */
export interface YouTubeUrlEntry {
  parseResult: YouTubeUrlParseResult
  /** For video-in-playlist: user's choice */
  playlistChoice?: 'full-playlist' | 'single-video'
  /** Playlist item count (fetched when playlist detected) */
  playlistItemCount?: number
}

/** Video in the import list with metadata status */
export interface YouTubeImportVideo {
  videoId: string
  /** Metadata from YouTube API (null while loading) */
  metadata: YouTubeVideoCache | null
  /** Loading/error state */
  status: 'pending' | 'loading' | 'loaded' | 'error' | 'unavailable' | 'unembeddable'
  /** Reason the video can't be embedded (when status === 'unembeddable') */
  unembeddableReason?: UnembeddableReason
  /** Error message if status is 'error' */
  error?: string
  /** Whether the user has removed this video from the import list */
  removed: boolean
  /** User opted to save this unembeddable video as an external link only */
  saveAsLinkOnly?: boolean
}

export interface YouTubeImportState {
  // --- Step 1: URL Input ---
  /** Raw text input from the textarea */
  urlInput: string
  /** Parsed URL entries */
  parsedUrls: YouTubeUrlEntry[]
  /** Validation feedback message */
  feedbackMessage: string
  /** Feedback type for styling */
  feedbackType: 'success' | 'warning' | 'error' | 'none'

  // --- Step 2: Metadata Preview ---
  /** Videos to import (with metadata) */
  videos: YouTubeImportVideo[]
  /** Progress: how many metadata fetches completed */
  metadataFetchedCount: number
  /** Total videos to fetch metadata for */
  metadataTotal: number
  /** Whether metadata is currently being fetched */
  isFetchingMetadata: boolean

  // --- Step 3: Organize (E28-S06) ---
  /** Chapter structure for organizing videos */
  chapters: VideoChapter[]

  // --- Wizard Navigation ---
  currentStep: YouTubeImportStep
  /** Whether the wizard dialog is open */
  isOpen: boolean

  // --- Actions ---
  setUrlInput: (input: string) => void
  setParsedUrls: (urls: YouTubeUrlEntry[]) => void
  setFeedback: (message: string, type: 'success' | 'warning' | 'error' | 'none') => void
  setCurrentStep: (step: YouTubeImportStep) => void
  setIsOpen: (open: boolean) => void

  /** Add videos for metadata fetching (Step 1 → Step 2 transition) */
  setVideosForFetch: (videoIds: string[]) => void
  /** Update a single video's metadata */
  updateVideoMetadata: (videoId: string, update: Partial<YouTubeImportVideo>) => void
  /** Update metadata fetch progress */
  updateFetchProgress: (fetched: number, total: number) => void
  /** Set fetching state */
  setIsFetchingMetadata: (isFetching: boolean) => void
  /** Remove a video from the import list */
  removeVideo: (videoId: string) => void
  /** Apply a successful metadata fetch and classify embeddability.
   *  If `metadata.embeddable === false` → status flips to 'unembeddable'.
   *  If `metadata.embeddable === undefined` → runs an oEmbed probe; a definite
   *  negative result with a concrete reason flips status to 'unembeddable',
   *  otherwise status stays 'loaded' (fail-open). */
  applyLoadedMetadata: (videoId: string, metadata: YouTubeVideoCache) => Promise<void>
  /** Toggle the per-video "save as link only" flag for an unembeddable video */
  setSaveAsLinkOnly: (videoId: string, value: boolean) => void

  /** Set chapter structure (E28-S06) */
  setChapters: (chapters: VideoChapter[]) => void
  /** Update a single chapter */
  updateChapter: (chapterId: string, update: Partial<VideoChapter>) => void
  /** Add a new chapter */
  addChapter: (chapter: VideoChapter) => void
  /** Remove a chapter by ID */
  removeChapter: (chapterId: string) => void

  // --- Step 4: Course Details (E28-S08) ---
  /** Whether the course is currently being saved */
  isSaving: boolean
  /** Save error message */
  saveError: string | null

  /** Save the course to Dexie and return the new course ID */
  saveCourse: (opts: {
    name: string
    description: string
    tags: string[]
    selectedThumbnailVideoId: string | null
  }) => Promise<{ ok: true; courseId: string } | { ok: false; error: string; code?: string }>

  /** Reset the entire wizard state */
  reset: () => void

  // --- Computed ---
  /** Get active (non-removed) videos */
  getActiveVideos: () => YouTubeImportVideo[]
  /** Get count of valid URLs from Step 1 */
  getValidUrlCount: () => number
  /** Check if "Next" button should be enabled on Step 1 */
  canProceedFromStep1: () => boolean
  /** Get unavailable video count */
  getUnavailableCount: () => number
}

const initialState = {
  urlInput: '',
  parsedUrls: [],
  feedbackMessage: '',
  feedbackType: 'none' as const,
  videos: [],
  metadataFetchedCount: 0,
  metadataTotal: 0,
  isFetchingMetadata: false,
  chapters: [] as VideoChapter[],
  currentStep: 1 as YouTubeImportStep,
  isOpen: false,
  isSaving: false,
  saveError: null as string | null,
}

export const useYouTubeImportStore = create<YouTubeImportState>((set, get) => ({
  ...initialState,

  setUrlInput: input => set({ urlInput: input }),
  setParsedUrls: urls => set({ parsedUrls: urls }),
  setFeedback: (message, type) => set({ feedbackMessage: message, feedbackType: type }),
  setCurrentStep: step => set({ currentStep: step }),
  setIsOpen: open => {
    if (!open) {
      // Reset everything when dialog closes
      set({ ...initialState })
    } else {
      set({ isOpen: true })
    }
  },

  setVideosForFetch: videoIds => {
    const videos: YouTubeImportVideo[] = videoIds.map(id => ({
      videoId: id,
      metadata: null,
      status: 'pending',
      removed: false,
    }))
    set({
      videos,
      metadataFetchedCount: 0,
      metadataTotal: videoIds.length,
      isFetchingMetadata: true,
    })
  },

  updateVideoMetadata: (videoId, update) => {
    set(state => ({
      videos: state.videos.map(v => (v.videoId === videoId ? { ...v, ...update } : v)),
    }))
  },

  updateFetchProgress: (fetched, total) => {
    set({ metadataFetchedCount: fetched, metadataTotal: total })
  },

  setIsFetchingMetadata: isFetching => set({ isFetchingMetadata: isFetching }),

  removeVideo: videoId => {
    set(state => ({
      videos: state.videos.map(v => (v.videoId === videoId ? { ...v, removed: true } : v)),
    }))
  },

  applyLoadedMetadata: async (videoId, metadata) => {
    // Case 1: Data API told us definitively the video is not embeddable.
    if (metadata.embeddable === false) {
      set(state => ({
        videos: state.videos.map(v =>
          v.videoId === videoId
            ? {
                ...v,
                metadata,
                status: 'unembeddable',
                unembeddableReason: metadata.unembeddableReason,
              }
            : v
        ),
      }))
      return
    }

    // Case 2: Data API confirmed embeddable — no probe needed.
    if (metadata.embeddable === true) {
      set(state => ({
        videos: state.videos.map(v =>
          v.videoId === videoId ? { ...v, metadata, status: 'loaded' } : v
        ),
      }))
      return
    }

    // Case 3: Embeddable flag unknown (no API key, or older API response).
    // Seed row as loaded immediately and probe in the background. Only flip
    // to 'unembeddable' on a definite negative with a concrete reason —
    // `unknown` or probe rejection stays 'loaded' (fail-open safety net lives
    // at runtime, Unit 5).
    set(state => ({
      videos: state.videos.map(v =>
        v.videoId === videoId ? { ...v, metadata, status: 'loaded' } : v
      ),
    }))

    try {
      const probe = await probeEmbeddability(videoId)
      if (!probe.embeddable && probe.reason !== 'unknown') {
        set(state => ({
          videos: state.videos.map(v =>
            v.videoId === videoId
              ? {
                  ...v,
                  status: 'unembeddable',
                  unembeddableReason: probe.reason,
                }
              : v
          ),
        }))
      }
    } catch {
      // Fail-open — keep 'loaded'. Runtime fallback is the safety net.
    }
  },

  setSaveAsLinkOnly: (videoId, value) => {
    set(state => ({
      videos: state.videos.map(v => (v.videoId === videoId ? { ...v, saveAsLinkOnly: value } : v)),
    }))
  },

  // --- Step 3: Chapter management (E28-S06) ---

  setChapters: chapters => set({ chapters }),

  updateChapter: (chapterId, update) => {
    set(state => ({
      chapters: state.chapters.map(c => (c.id === chapterId ? { ...c, ...update } : c)),
    }))
  },

  addChapter: chapter => {
    set(state => ({ chapters: [...state.chapters, chapter] }))
  },

  removeChapter: chapterId => {
    set(state => ({
      chapters: state.chapters.filter(c => c.id !== chapterId),
    }))
  },

  // --- Step 4: Save Course (E28-S08) ---

  saveCourse: async ({ name, description, tags, selectedThumbnailVideoId }) => {
    // Guest cap: 1 course per guest session
    if (selectIsGuestMode(useAuthStore.getState())) {
      const guestSessionId = sessionStorage.getItem('knowlune-guest-id')
      const existing = await db.importedCourses
        .filter(r => r.userId === null && r.guestSessionId === guestSessionId)
        .count()
      if (existing >= 1) {
        return { ok: false, error: 'GUEST_CAP_EXCEEDED', code: 'GUEST_CAP_EXCEEDED' }
      }
    }

    const state = get()
    const activeVideos = state.getActiveVideos()
    // Include 'loaded' videos, plus 'unembeddable' videos the user opted to
    // keep as link-only (Unit 4 will persist the `embeddable: false` flag so
    // the lesson renders the fallback instead of attempting iframe embed).
    const loadedVideos = activeVideos.filter(
      v =>
        v.metadata &&
        (v.status === 'loaded' || (v.status === 'unembeddable' && v.saveAsLinkOnly === true))
    )

    if (loadedVideos.length === 0) {
      return { ok: false, error: 'No videos available to save' }
    }

    set({ isSaving: true, saveError: null })

    try {
      const courseId = crypto.randomUUID()
      const now = new Date().toISOString()

      // Derive YouTube-specific metadata from videos
      const firstVideo = loadedVideos[0].metadata!
      const playlistEntry = state.parsedUrls.find(
        e => e.parseResult.type === 'playlist' || e.playlistChoice === 'full-playlist'
      )
      const playlistId = playlistEntry?.parseResult.playlistId ?? undefined

      // Determine thumbnail URL
      let thumbnailUrl: string | undefined
      if (selectedThumbnailVideoId) {
        const thumbVideo = loadedVideos.find(v => v.videoId === selectedThumbnailVideoId)
        thumbnailUrl = thumbVideo?.metadata?.thumbnailUrl
      }
      if (!thumbnailUrl && loadedVideos.length > 0) {
        thumbnailUrl = firstVideo.thumbnailUrl
      }

      // Calculate totals
      const totalDuration = loadedVideos.reduce((sum, v) => sum + (v.metadata?.duration ?? 0), 0)

      // Build ImportedCourse record
      const course: ImportedCourse = {
        id: courseId,
        name: name.trim(),
        description: description.trim() || undefined,
        importedAt: now,
        category: 'youtube',
        tags: [...new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))].sort(),
        status: 'not-started',
        videoCount: loadedVideos.length,
        pdfCount: 0,
        directoryHandle: null, // YouTube courses don't use FS handles
        source: 'youtube',
        youtubePlaylistId: playlistId,
        youtubeChannelId: firstVideo.channelId,
        youtubeChannelTitle: firstVideo.channelTitle,
        youtubeThumbnailUrl: thumbnailUrl,
        totalDuration,
      }

      // Build ImportedVideo records
      const videoRecords: ImportedVideo[] = loadedVideos.map((v, index) => {
        const isUnembeddable = v.status === 'unembeddable' && v.saveAsLinkOnly === true
        return {
          id: crypto.randomUUID(),
          courseId,
          filename: v.metadata!.title,
          path: `youtube://${v.videoId}`,
          duration: v.metadata!.duration,
          format: 'mp4' as const, // YouTube serves as MP4 via IFrame API
          order: index,
          fileHandle: null, // YouTube videos don't use FS handles
          youtubeVideoId: v.videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          thumbnailUrl: v.metadata!.thumbnailUrl,
          description: v.metadata!.description,
          chapters: v.metadata!.chapters?.length ? v.metadata!.chapters : undefined,
          // Persist embeddability so the player skips the iframe attempt for
          // known-unembeddable videos and renders the fallback directly.
          embeddable: isUnembeddable ? false : true,
          unembeddableReason: isUnembeddable
            ? (v.unembeddableReason ?? v.metadata!.unembeddableReason ?? 'unknown')
            : undefined,
        }
      })

      // Build YouTubeCourseChapter records from chapter structure
      const chapterRecords: YouTubeCourseChapter[] = []
      let chapterOrder = 0
      for (const chapter of state.chapters) {
        for (const videoId of chapter.videoIds) {
          const videoMeta = loadedVideos.find(v => v.videoId === videoId)?.metadata
          if (!videoMeta) continue

          // If the video has YouTube auto-chapters, write each sub-chapter
          if (videoMeta.chapters && videoMeta.chapters.length > 0) {
            for (const subChapter of videoMeta.chapters) {
              chapterRecords.push({
                id: crypto.randomUUID(),
                courseId,
                videoId,
                title: `${chapter.title} — ${subChapter.title}`,
                startTime: subChapter.time,
                order: chapterOrder++,
              })
            }
          } else {
            // One chapter entry per video
            chapterRecords.push({
              id: crypto.randomUUID(),
              courseId,
              videoId,
              title: chapter.title,
              startTime: 0,
              order: chapterOrder++,
            })
          }
        }
      }

      // Write video cache entries with TTL
      const cacheRecords: YouTubeVideoCache[] = loadedVideos
        .filter(v => v.metadata)
        .map(v => ({
          ...v.metadata!,
          // Set TTL to 7 days from now
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }))

      // E94-S02: Use syncableWrite for importedCourses and importedVideos so they
      // produce sync queue entries. youtubeChapters and youtubeVideoCache are not
      // P2 sync tables — keep them as direct Dexie writes.
      await persistWithRetry(async () => {
        await syncableWrite('importedCourses', 'add', course as unknown as SyncableRecord)
        for (const video of videoRecords) {
          await syncableWrite('importedVideos', 'add', video as unknown as SyncableRecord)
        }
        if (chapterRecords.length > 0) {
          await db.youtubeChapters.bulkAdd(chapterRecords)
        }
        // Upsert cache records (they may already exist from metadata fetch)
        await db.youtubeVideoCache.bulkPut(cacheRecords)
      })

      set({ isSaving: false })
      return { ok: true, courseId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save course'
      set({ isSaving: false, saveError: message })
      return { ok: false, error: message }
    }
  },

  reset: () => set({ ...initialState }),

  getActiveVideos: () => get().videos.filter(v => !v.removed),
  getValidUrlCount: () => get().parsedUrls.filter(u => u.parseResult.valid).length,
  canProceedFromStep1: () => get().parsedUrls.some(u => u.parseResult.valid),
  getUnavailableCount: () =>
    get().videos.filter(v => !v.removed && v.status === 'unavailable').length,
}))
