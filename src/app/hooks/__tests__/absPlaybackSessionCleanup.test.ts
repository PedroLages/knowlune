import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ABS service so we can assert cleanup calls
vi.mock('@/services/AudiobookshelfService', () => {
  return {
    closePlaybackSession: vi.fn().mockResolvedValue({ ok: true }),
    // The hook imports these too; keep them defined to avoid module init failures.
    createPlaybackSession: vi.fn(),
    getStreamUrlFromSession: vi.fn(),
  }
})

// Provide a minimal Audio so useAudioPlayer can initialize in JSDOM
class MockAudio {
  paused = true
  currentTime = 0
  duration = 0
  readyState = 0
  playbackRate = 1
  src = ''
  addEventListener() {}
  removeEventListener() {}
  load() {}
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

describe('cleanupActiveAbsPlaybackSession', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)
  })

  it('does not call closePlaybackSession when no active session exists', async () => {
    const svc = await import('@/services/AudiobookshelfService')
    const { cleanupActiveAbsPlaybackSession } = await import('@/app/hooks/useAudioPlayer')

    cleanupActiveAbsPlaybackSession()

    expect(svc.closePlaybackSession).not.toHaveBeenCalled()
  })
})

