/**
 * Unit tests for useAudioPlayerStore — audiobook playback state.
 *
 * Tests setters, reset, and state transitions.
 *
 * @since E106-S01
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAudioPlayerStore } from '@/stores/useAudioPlayerStore'

beforeEach(() => {
  // Reset to initial state before each test
  useAudioPlayerStore.setState({
    currentBookId: null,
    currentChapterIndex: 0,
    currentTime: 0,
    playbackRate: 1.0,
    isPlaying: false,
  })
})

describe('initial state', () => {
  it('starts with null currentBookId and defaults', () => {
    const state = useAudioPlayerStore.getState()
    expect(state.currentBookId).toBeNull()
    expect(state.currentChapterIndex).toBe(0)
    expect(state.currentTime).toBe(0)
    expect(state.playbackRate).toBe(1.0)
    expect(state.isPlaying).toBe(false)
  })
})

describe('setCurrentBook', () => {
  it('sets currentBookId', () => {
    useAudioPlayerStore.getState().setCurrentBook('book-1')
    expect(useAudioPlayerStore.getState().currentBookId).toBe('book-1')
  })

  it('replaces existing book', () => {
    useAudioPlayerStore.getState().setCurrentBook('book-1')
    useAudioPlayerStore.getState().setCurrentBook('book-2')
    expect(useAudioPlayerStore.getState().currentBookId).toBe('book-2')
  })
})

describe('setCurrentChapterIndex', () => {
  it('updates chapter index', () => {
    useAudioPlayerStore.getState().setCurrentChapterIndex(5)
    expect(useAudioPlayerStore.getState().currentChapterIndex).toBe(5)
  })

  it('allows zero index', () => {
    useAudioPlayerStore.getState().setCurrentChapterIndex(3)
    useAudioPlayerStore.getState().setCurrentChapterIndex(0)
    expect(useAudioPlayerStore.getState().currentChapterIndex).toBe(0)
  })
})

describe('setCurrentTime', () => {
  it('updates current time', () => {
    useAudioPlayerStore.getState().setCurrentTime(120.5)
    expect(useAudioPlayerStore.getState().currentTime).toBe(120.5)
  })

  it('handles zero time', () => {
    useAudioPlayerStore.getState().setCurrentTime(300)
    useAudioPlayerStore.getState().setCurrentTime(0)
    expect(useAudioPlayerStore.getState().currentTime).toBe(0)
  })
})

describe('setPlaybackRate', () => {
  it('sets custom playback rate', () => {
    useAudioPlayerStore.getState().setPlaybackRate(1.5)
    expect(useAudioPlayerStore.getState().playbackRate).toBe(1.5)
  })

  it('handles 2x speed', () => {
    useAudioPlayerStore.getState().setPlaybackRate(2.0)
    expect(useAudioPlayerStore.getState().playbackRate).toBe(2.0)
  })

  it('handles slow speed', () => {
    useAudioPlayerStore.getState().setPlaybackRate(0.5)
    expect(useAudioPlayerStore.getState().playbackRate).toBe(0.5)
  })
})

describe('setIsPlaying', () => {
  it('sets playing state to true', () => {
    useAudioPlayerStore.getState().setIsPlaying(true)
    expect(useAudioPlayerStore.getState().isPlaying).toBe(true)
  })

  it('sets playing state to false', () => {
    useAudioPlayerStore.getState().setIsPlaying(true)
    useAudioPlayerStore.getState().setIsPlaying(false)
    expect(useAudioPlayerStore.getState().isPlaying).toBe(false)
  })
})

describe('reset', () => {
  it('resets all state to initial values', () => {
    // Set non-default values
    const store = useAudioPlayerStore.getState()
    store.setCurrentBook('book-1')
    store.setCurrentChapterIndex(3)
    store.setCurrentTime(180)
    store.setPlaybackRate(1.5)
    store.setIsPlaying(true)

    // Verify non-default
    expect(useAudioPlayerStore.getState().currentBookId).toBe('book-1')

    // Reset
    useAudioPlayerStore.getState().reset()

    const state = useAudioPlayerStore.getState()
    expect(state.currentBookId).toBeNull()
    expect(state.currentChapterIndex).toBe(0)
    expect(state.currentTime).toBe(0)
    expect(state.playbackRate).toBe(1.0)
    expect(state.isPlaying).toBe(false)
  })
})
