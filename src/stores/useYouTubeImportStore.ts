/**
 * YouTube Import Wizard Store
 *
 * Manages state for the 4-step YouTube import wizard:
 * Step 1: URL input — parse and validate YouTube URLs
 * Step 2: Metadata preview — fetch video metadata, allow removal
 * Step 3: Organize — group videos into chapters (E28-S06)
 * Step 4: Details (future — E28-S08)
 *
 * @see E28-S05 — Import Wizard Steps 1 & 2
 * @see E28-S06 — Rule-Based Video Grouping & Chapter Editor
 */

import { create } from 'zustand'

import type { YouTubeVideoCache } from '@/data/types'
import type { YouTubeUrlParseResult } from '@/lib/youtubeUrlParser'
import type { VideoChapter } from '@/lib/youtubeRuleBasedGrouping'

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
  status: 'pending' | 'loading' | 'loaded' | 'error' | 'unavailable'
  /** Error message if status is 'error' */
  error?: string
  /** Whether the user has removed this video from the import list */
  removed: boolean
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

  /** Set chapter structure (E28-S06) */
  setChapters: (chapters: VideoChapter[]) => void
  /** Update a single chapter */
  updateChapter: (chapterId: string, update: Partial<VideoChapter>) => void
  /** Add a new chapter */
  addChapter: (chapter: VideoChapter) => void
  /** Remove a chapter by ID */
  removeChapter: (chapterId: string) => void

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
}

export const useYouTubeImportStore = create<YouTubeImportState>((set, get) => ({
  ...initialState,

  setUrlInput: (input) => set({ urlInput: input }),
  setParsedUrls: (urls) => set({ parsedUrls: urls }),
  setFeedback: (message, type) => set({ feedbackMessage: message, feedbackType: type }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setIsOpen: (open) => {
    if (!open) {
      // Reset everything when dialog closes
      set({ ...initialState })
    } else {
      set({ isOpen: true })
    }
  },

  setVideosForFetch: (videoIds) => {
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
      videos: state.videos.map(v =>
        v.videoId === videoId ? { ...v, ...update } : v
      ),
    }))
  },

  updateFetchProgress: (fetched, total) => {
    set({ metadataFetchedCount: fetched, metadataTotal: total })
  },

  setIsFetchingMetadata: (isFetching) => set({ isFetchingMetadata: isFetching }),

  removeVideo: (videoId) => {
    set(state => ({
      videos: state.videos.map(v =>
        v.videoId === videoId ? { ...v, removed: true } : v
      ),
    }))
  },

  // --- Step 3: Chapter management (E28-S06) ---

  setChapters: (chapters) => set({ chapters }),

  updateChapter: (chapterId, update) => {
    set(state => ({
      chapters: state.chapters.map(c =>
        c.id === chapterId ? { ...c, ...update } : c
      ),
    }))
  },

  addChapter: (chapter) => {
    set(state => ({ chapters: [...state.chapters, chapter] }))
  },

  removeChapter: (chapterId) => {
    set(state => ({
      chapters: state.chapters.filter(c => c.id !== chapterId),
    }))
  },

  reset: () => set({ ...initialState }),

  getActiveVideos: () => get().videos.filter(v => !v.removed),
  getValidUrlCount: () => get().parsedUrls.filter(u => u.parseResult.valid).length,
  canProceedFromStep1: () => get().parsedUrls.some(u => u.parseResult.valid),
  getUnavailableCount: () => get().videos.filter(v => !v.removed && v.status === 'unavailable').length,
}))
