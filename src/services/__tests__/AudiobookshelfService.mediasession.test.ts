/**
 * Unit tests for MediaSession integration in AudiobookshelfService.
 *
 * Mocks navigator.mediaSession to verify:
 * - setMediaSession populates metadata correctly
 * - setMediaSession registers all required action handlers
 * - clearMediaSession unregisters all handlers (sets to null)
 * - clearMediaSession clears metadata
 * - Both functions no-op gracefully when mediaSession is unavailable
 *
 * @since E120-S02
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  setMediaSession,
  clearMediaSession,
  type MediaTrack,
  type MediaSessionHandlers,
} from '@/services/AudiobookshelfService'

// ── Helpers ────────────────────────────────────────────────────────────────

const SAMPLE_TRACK: MediaTrack = {
  title: 'Chapter 1',
  author: 'Jane Austen',
  bookTitle: 'Pride and Prejudice',
  coverUrl: 'https://example.com/cover.png',
}

function buildMockMediaSession() {
  const handlers: Record<string, MediaSessionActionHandler | null> = {}
  return {
    metadata: null as MediaMetadata | null,
    setActionHandler: vi.fn(function (action: string, handler: MediaSessionActionHandler | null) {
      handlers[action] = handler
    }),
    _handlers: handlers,
  }
}

/** Constructable MediaMetadata mock — arrow functions can't be used with new. */
function mockMediaMetadata(this: MediaMetadata, init: MediaMetadataInit) {
  Object.assign(this, init)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('setMediaSession', () => {
  let mockSession: ReturnType<typeof buildMockMediaSession>

  beforeEach(() => {
    mockSession = buildMockMediaSession()
    Object.defineProperty(navigator, 'mediaSession', {
      value: mockSession,
      configurable: true,
      writable: true,
    })
    global.MediaMetadata = vi.fn(mockMediaMetadata) as unknown as typeof MediaMetadata
  })

  it('sets metadata with track info', () => {
    setMediaSession(SAMPLE_TRACK)

    expect(MediaMetadata).toHaveBeenCalledWith({
      title: 'Chapter 1',
      artist: 'Jane Austen',
      album: 'Pride and Prejudice',
      artwork: [{ src: 'https://example.com/cover.png', sizes: '512x512', type: 'image/png' }],
    })
    expect(mockSession.metadata).toBeDefined()
    expect(mockSession.metadata).not.toBeNull()
  })

  it('registers action handler for play', () => {
    const handlers: MediaSessionHandlers = { play: vi.fn() }
    setMediaSession(SAMPLE_TRACK, handlers)

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('play', handlers.play)
  })

  it('registers action handler for pause', () => {
    const handlers: MediaSessionHandlers = { pause: vi.fn() }
    setMediaSession(SAMPLE_TRACK, handlers)

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('pause', handlers.pause)
  })

  it('registers action handler for seekbackward', () => {
    const seekBackward = vi.fn()
    setMediaSession(SAMPLE_TRACK, { seekBackward })

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekbackward', seekBackward)
  })

  it('registers action handler for seekforward', () => {
    const seekForward = vi.fn()
    setMediaSession(SAMPLE_TRACK, { seekForward })

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekforward', seekForward)
  })

  it('registers action handler for previoustrack', () => {
    const previousTrack = vi.fn()
    setMediaSession(SAMPLE_TRACK, { previousTrack })

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('previoustrack', previousTrack)
  })

  it('registers action handler for nexttrack', () => {
    const nextTrack = vi.fn()
    setMediaSession(SAMPLE_TRACK, { nextTrack })

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('nexttrack', nextTrack)
  })

  it('registers action handler for seekto', () => {
    const seekTo = vi.fn()
    setMediaSession(SAMPLE_TRACK, { seekTo })

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekto', seekTo)
  })

  it('registers null for omitted handlers', () => {
    setMediaSession(SAMPLE_TRACK, {})

    expect(mockSession.setActionHandler).toHaveBeenCalledWith('play', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('pause', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekbackward', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekforward', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('previoustrack', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('nexttrack', null)
    expect(mockSession.setActionHandler).toHaveBeenCalledWith('seekto', null)
  })

  it('updates metadata when called with a different track', () => {
    setMediaSession(SAMPLE_TRACK)
    const updatedTrack: MediaTrack = {
      title: 'Chapter 2',
      author: 'Jane Austen',
      bookTitle: 'Pride and Prejudice',
      coverUrl: 'https://example.com/cover2.png',
    }
    setMediaSession(updatedTrack)

    expect(MediaMetadata).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Chapter 2' })
    )
  })

  it('no-ops when mediaSession is unavailable', () => {
    // Set to undefined so !navigator.mediaSession is true
    Object.defineProperty(navigator, 'mediaSession', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    expect(() => setMediaSession(SAMPLE_TRACK)).not.toThrow()
  })
})

describe('clearMediaSession', () => {
  let mockSession: ReturnType<typeof buildMockMediaSession>

  beforeEach(() => {
    mockSession = buildMockMediaSession()
    Object.defineProperty(navigator, 'mediaSession', {
      value: mockSession,
      configurable: true,
      writable: true,
    })
    global.MediaMetadata = vi.fn(mockMediaMetadata) as unknown as typeof MediaMetadata
  })

  it('clears metadata', () => {
    setMediaSession(SAMPLE_TRACK)
    clearMediaSession()

    expect(mockSession.metadata).toBeNull()
  })

  it('unregisters play handler (sets to null)', () => {
    setMediaSession(SAMPLE_TRACK, { play: vi.fn() })
    clearMediaSession()

    // The last call to setActionHandler('play', ...) after clearMediaSession must be null
    const lastPlayCall = [...mockSession.setActionHandler.mock.calls]
      .reverse()
      .find(([action]) => action === 'play')
    expect(lastPlayCall?.[1]).toBeNull()
  })

  it('unregisters all 7 action handlers', () => {
    setMediaSession(SAMPLE_TRACK, {
      play: vi.fn(),
      pause: vi.fn(),
      seekBackward: vi.fn(),
      seekForward: vi.fn(),
      previousTrack: vi.fn(),
      nextTrack: vi.fn(),
      seekTo: vi.fn(),
    })
    clearMediaSession()

    const actions = [
      'play',
      'pause',
      'seekbackward',
      'seekforward',
      'previoustrack',
      'nexttrack',
      'seekto',
    ]
    for (const action of actions) {
      const lastCall = [...mockSession.setActionHandler.mock.calls]
        .reverse()
        .find(([a]) => a === action)
      expect(lastCall?.[1], `handler for "${action}" should be null after clearMediaSession`).toBeNull()
    }
  })

  it('no-ops when mediaSession is unavailable', () => {
    Object.defineProperty(navigator, 'mediaSession', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    expect(() => clearMediaSession()).not.toThrow()
  })
})
