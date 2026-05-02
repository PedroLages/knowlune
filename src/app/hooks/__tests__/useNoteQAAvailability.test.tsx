import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteQAAvailability } from '../useNoteQAAvailability'
import { getNoteQAAvailability, type NoteQAAvailability } from '@/lib/aiConfiguration'

vi.mock('@/lib/aiConfiguration', () => ({
  getNoteQAAvailability: vi.fn(),
}))

const availableGemini: NoteQAAvailability = {
  available: true,
  provider: 'gemini',
  providerName: 'Google Gemini',
  model: 'gemini-3-flash-preview',
}

const missingAnthropic: NoteQAAvailability = {
  available: false,
  provider: 'anthropic',
  providerName: 'Anthropic',
  model: 'claude-haiku-4-5',
  reason: 'missing-provider-key',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useNoteQAAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns available when the noteQA provider has a readable key', async () => {
    vi.mocked(getNoteQAAvailability).mockResolvedValue(availableGemini)

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })
    expect(result.current.availability).toEqual(availableGemini)
  })

  it('returns unavailable with the helper reason', async () => {
    vi.mocked(getNoteQAAvailability).mockResolvedValue(missingAnthropic)

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable')
    })
    expect(result.current.availability).toEqual(missingAnthropic)
  })

  it('refreshes when AI configuration changes', async () => {
    vi.mocked(getNoteQAAvailability)
      .mockResolvedValueOnce(missingAnthropic)
      .mockResolvedValueOnce(availableGemini)

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable')
    })

    window.dispatchEvent(new CustomEvent('ai-configuration-updated'))

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })
    expect(result.current.availability).toEqual(availableGemini)
  })

  it('ignores stale async results after a newer refresh starts', async () => {
    const first = deferred<NoteQAAvailability>()
    const second = deferred<NoteQAAvailability>()
    vi.mocked(getNoteQAAvailability)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useNoteQAAvailability())

    window.dispatchEvent(new CustomEvent('ai-configuration-updated'))
    second.resolve(missingAnthropic)

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable')
    })

    first.resolve(availableGemini)

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(result.current.availability).toEqual(missingAnthropic)
  })

  it('maps helper failures to availability-check-failed', async () => {
    vi.mocked(getNoteQAAvailability).mockRejectedValue(new Error('storage read failed'))

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable')
    })
    expect(result.current.availability).toMatchObject({
      reason: 'availability-check-failed',
    })
  })

  it('does not refresh on unrelated storage keys', async () => {
    vi.mocked(getNoteQAAvailability).mockResolvedValue(availableGemini)

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    vi.mocked(getNoteQAAvailability).mockClear()
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'unrelated-key', storageArea: localStorage })
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(getNoteQAAvailability).not.toHaveBeenCalled()
  })

  it('refreshes when storage updates ai-configuration', async () => {
    vi.mocked(getNoteQAAvailability)
      .mockResolvedValueOnce(availableGemini)
      .mockResolvedValueOnce(missingAnthropic)

    const { result } = renderHook(() => useNoteQAAvailability())

    await waitFor(() => {
      expect(result.current.status).toBe('available')
    })

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'ai-configuration', storageArea: localStorage })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('unavailable')
    })
    expect(result.current.availability).toEqual(missingAnthropic)
  })
})
