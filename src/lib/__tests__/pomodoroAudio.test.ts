import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { playChime, previewSound, POMODORO_SOUNDS, type PomodoroSoundId } from '@/lib/pomodoroAudio'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockOscillator: Record<string, unknown>
let mockGain: Record<string, unknown>
let mockCtx: Record<string, unknown>
let lastAudioElement: { volume: number; play: ReturnType<typeof vi.fn> }

beforeEach(() => {
  mockOscillator = {
    connect: vi.fn(),
    type: 'sine',
    frequency: { value: 0, setValueAtTime: vi.fn() },
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }
  mockGain = {
    connect: vi.fn(),
    gain: { value: 0, exponentialRampToValueAtTime: vi.fn() },
  }
  mockCtx = {
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
    destination: {},
    currentTime: 0,
    close: vi.fn().mockResolvedValue(undefined),
  }

  // Use function keyword so `new` works
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function (this: Record<string, unknown>) {
      Object.assign(this, mockCtx)
    })
  )
  vi.stubGlobal(
    'Audio',
    vi.fn(function (this: Record<string, unknown>) {
      lastAudioElement = { volume: 1, play: vi.fn().mockResolvedValue(undefined) }
      Object.assign(this, lastAudioElement)
    })
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// POMODORO_SOUNDS
// ---------------------------------------------------------------------------

describe('POMODORO_SOUNDS', () => {
  it('has chime as first entry with null file', () => {
    expect(POMODORO_SOUNDS[0].id).toBe('chime')
    expect(POMODORO_SOUNDS[0].file).toBeNull()
  })

  it('all non-chime entries have file paths', () => {
    for (const sound of POMODORO_SOUNDS) {
      if (sound.id !== 'chime') {
        expect(sound.file).toBeTruthy()
        expect(sound.file).toContain('/sounds/pomodoro/')
      }
    }
  })

  it('has unique IDs', () => {
    const ids = POMODORO_SOUNDS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// playChime
// ---------------------------------------------------------------------------

describe('playChime', () => {
  it('does nothing when volume is 0', () => {
    playChime(0)
    expect(AudioContext).not.toHaveBeenCalled()
    expect(Audio).not.toHaveBeenCalled()
  })

  it('does nothing when volume is negative', () => {
    playChime(-1)
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('plays synthesized chime for default soundId', () => {
    playChime(0.5)
    expect(AudioContext).toHaveBeenCalled()
    expect(mockOscillator.connect).toHaveBeenCalled()
    expect(mockOscillator.start).toHaveBeenCalled()
  })

  it('plays synthesized chime for explicit "chime" soundId', () => {
    playChime(0.5, 'chime')
    expect(AudioContext).toHaveBeenCalled()
  })

  it('plays audio file for non-chime soundId', () => {
    playChime(0.5, 'alarm-clock')
    expect(Audio).toHaveBeenCalled()
    expect(lastAudioElement.play).toHaveBeenCalled()
  })

  it('clamps volume to [0, 1] range', () => {
    playChime(2.0, 'alarm-clock')
    expect(lastAudioElement.volume).toBe(1)
  })

  it('falls back to synth chime for unknown soundId', () => {
    playChime(0.5, 'nonexistent' as PomodoroSoundId)
    expect(AudioContext).toHaveBeenCalled()
  })

  it('does not throw when AudioContext fails', () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => {
        throw new Error('AudioContext unavailable')
      })
    )
    expect(() => playChime(0.5)).not.toThrow()
  })

  it('does not throw when Audio.play rejects', () => {
    vi.stubGlobal(
      'Audio',
      vi.fn(() => ({
        volume: 1,
        play: vi.fn().mockRejectedValue(new Error('Autoplay blocked')),
      }))
    )
    expect(() => playChime(0.5, 'alarm-clock')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// previewSound
// ---------------------------------------------------------------------------

describe('previewSound', () => {
  it('plays the specified sound', () => {
    previewSound('gentle-bell', 0.8)
    expect(Audio).toHaveBeenCalled()
    expect(lastAudioElement.play).toHaveBeenCalled()
  })

  it('uses default volume of 0.5', () => {
    previewSound('chime')
    expect(AudioContext).toHaveBeenCalled()
  })
})
