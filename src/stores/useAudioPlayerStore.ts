/**
 * useAudioPlayerStore — persistent Zustand store for audiobook playback state.
 *
 * Enables the mini-player (E87-S05) to access playback state across pages.
 * The store holds serializable state; the HTMLAudioElement is managed in
 * useAudioPlayer hook (not stored here).
 *
 * @module useAudioPlayerStore
 * @since E87-S02
 */
import { create } from 'zustand'

interface AudioPlayerState {
  /** ID of the currently active audiobook (null = no active book) */
  currentBookId: string | null
  /** 0-based index of the currently playing chapter */
  currentChapterIndex: number
  /** Current playback position in seconds within the chapter */
  currentTime: number
  /** Playback rate: 1.0 = normal, 1.5 = 1.5× speed, etc. */
  playbackRate: number
  /** Whether audio is currently playing */
  isPlaying: boolean

  setCurrentBook: (bookId: string) => void
  setCurrentChapterIndex: (index: number) => void
  setCurrentTime: (time: number) => void
  setPlaybackRate: (rate: number) => void
  setIsPlaying: (playing: boolean) => void
  reset: () => void
}

export const useAudioPlayerStore = create<AudioPlayerState>(set => ({
  currentBookId: null,
  currentChapterIndex: 0,
  currentTime: 0,
  playbackRate: 1.0,
  isPlaying: false,

  setCurrentBook: (bookId) => set({ currentBookId: bookId }),
  setCurrentChapterIndex: (index) => set({ currentChapterIndex: index }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  reset: () =>
    set({
      currentBookId: null,
      currentChapterIndex: 0,
      currentTime: 0,
      playbackRate: 1.0,
      isPlaying: false,
    }),
}))
