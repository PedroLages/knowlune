/**
 * useTts — rate/voice change should resume from current position, not restart the page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createRef } from 'react'
import type { Rendition } from 'epubjs'
import { useTts } from '../useTts'
import type { TtsOptions } from '@/services/TtsService'

const speakMock = vi.fn()
const stopMock = vi.fn()
const pauseMock = vi.fn()
const resumeMock = vi.fn()

const speechSynthStub = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

vi.mock('@/services/TtsService', () => ({
  ttsService: {
    isTtsAvailable: () => true,
    getVoices: () => [],
    speak: (...args: unknown[]) => speakMock(...args),
    stop: () => stopMock(),
    pause: () => pauseMock(),
    resume: () => resumeMock(),
  },
}))

function mockRenditionWithText(text: string): Rendition {
  const doc = {
    body: { textContent: text },
    querySelector: vi.fn(() => null),
    getElementById: vi.fn(() => null),
    head: { appendChild: vi.fn() },
    createTreeWalker: () => ({ nextNode: () => null }),
    createElement: vi.fn(() => ({ className: '', scrollIntoView: vi.fn() })),
    createRange: vi.fn(() => ({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      surroundContents: vi.fn(),
    })),
  }
  return {
    getContents: () => [{ document: doc }],
    next: vi.fn().mockResolvedValue(undefined),
  } as unknown as Rendition
}

describe('useTts', () => {
  beforeEach(() => {
    speakMock.mockReset()
    stopMock.mockReset()
    pauseMock.mockReset()
    resumeMock.mockReset()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: speechSynthStub,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('startTts speaks full page text from offset 0', () => {
    const ref = createRef<Rendition | null>()
    ref.current = mockRenditionWithText('Alpha beta gamma.')

    const { result } = renderHook(() => useTts(ref))

    act(() => {
      result.current.startTts()
    })

    expect(speakMock).toHaveBeenCalledTimes(1)
    expect(speakMock.mock.calls[0][0]).toBe('Alpha beta gamma.')
    const opts = speakMock.mock.calls[0][1] as TtsOptions
    expect(opts.rate).toBe(1)
  })

  it('setTtsRate while playing speaks remainder after last word boundary, not full page', () => {
    const ref = createRef<Rendition | null>()
    ref.current = mockRenditionWithText('Hello world today.')

    const { result } = renderHook(() => useTts(ref))

    act(() => {
      result.current.startTts()
    })

    const firstOpts = speakMock.mock.calls[0][1] as TtsOptions
    // Simulate chunk start offset in spoken string (no DOM — avoids highlightWord)
    act(() => {
      firstOpts.onChunkStart?.(0, 3, 6)
    })

    speakMock.mockClear()

    act(() => {
      result.current.setTtsRate(1.5)
    })

    expect(stopMock).toHaveBeenCalled()
    expect(speakMock).toHaveBeenCalledTimes(1)
    const remainder = speakMock.mock.calls[0][0] as string
    expect(remainder).toBe('world today.')
    expect((speakMock.mock.calls[0][1] as TtsOptions).rate).toBe(1.5)
  })

  it('setTtsVoiceURI while playing speaks remainder from resume position', () => {
    const ref = createRef<Rendition | null>()
    ref.current = mockRenditionWithText('One two three.')

    const { result } = renderHook(() => useTts(ref))

    act(() => {
      result.current.startTts()
    })

    const firstOpts = speakMock.mock.calls[0][1] as TtsOptions
    act(() => {
      firstOpts.onChunkStart?.(0, 2, 4)
    })

    speakMock.mockClear()

    act(() => {
      result.current.setTtsVoiceURI('urn:voice:test')
    })

    expect(speakMock).toHaveBeenCalledTimes(1)
    expect(speakMock.mock.calls[0][0] as string).toBe('two three.')
    expect((speakMock.mock.calls[0][1] as TtsOptions).voiceURI).toBe('urn:voice:test')
  })

  it('setTtsRate with no remainder stops playback', () => {
    const ref = createRef<Rendition | null>()
    ref.current = mockRenditionWithText('Hi')

    const { result } = renderHook(() => useTts(ref))

    act(() => {
      result.current.startTts()
    })

    const firstOpts = speakMock.mock.calls[0][1] as TtsOptions
    act(() => {
      firstOpts.onChunkStart?.(0, 1, 2)
    })

    speakMock.mockClear()

    act(() => {
      result.current.setTtsRate(2)
    })

    // Resume index past end → empty slice → stopTts, no new speak
    expect(speakMock).not.toHaveBeenCalled()
    expect(result.current.isTtsPlaying).toBe(false)
  })
})
