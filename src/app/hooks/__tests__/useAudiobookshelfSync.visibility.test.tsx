/**
 * Throttled visibility refresh for ABS bulk progress (plan U4).
 *
 * @see useAudiobookshelfSync.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAudiobookshelfSync } from '@/app/hooks/useAudiobookshelfSync'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import * as AudiobookshelfService from '@/services/AudiobookshelfService'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import type { AudiobookshelfServer } from '@/data/types'

vi.mock('@/lib/credentials/absApiKeyResolver', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/credentials/absApiKeyResolver')>()
  return {
    ...actual,
    getAbsApiKey: vi.fn(),
  }
})

const SERVER: AudiobookshelfServer = {
  id: 'vis-srv',
  name: 'Vis ABS',
  url: 'https://abs.vis.test',
  libraryIds: ['lib-1'],
  status: 'connected',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('useAudiobookshelfSync — visibility progress pull', () => {
  beforeEach(() => {
    vi.spyOn(AudiobookshelfService, 'fetchAllProgress').mockResolvedValue({ ok: true, data: [] })
    vi.mocked(getAbsApiKey).mockResolvedValue('api-key')
    useAudiobookshelfStore.setState({ servers: [SERVER], isLoaded: true })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      writable: true,
      value: 'visible',
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    useAudiobookshelfStore.setState({ servers: [], isLoaded: false })
  })

  it('calls fetchAllProgress once when visibility fires twice within throttle window', async () => {
    renderHook(() => useAudiobookshelfSync())

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(AudiobookshelfService.fetchAllProgress).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
    })
    expect(AudiobookshelfService.fetchAllProgress).toHaveBeenCalledTimes(1)
  })

  it('calls fetchAllProgress again after throttle interval elapses', async () => {
    renderHook(() => useAudiobookshelfSync())

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(AudiobookshelfService.fetchAllProgress).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.setSystemTime(new Date('2026-06-01T12:00:31.000Z'))
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(AudiobookshelfService.fetchAllProgress).toHaveBeenCalledTimes(2)
  })

  it('does not call fetchAllProgress when no API key is available', async () => {
    vi.mocked(getAbsApiKey).mockResolvedValue(null)
    renderHook(() => useAudiobookshelfSync())

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(AudiobookshelfService.fetchAllProgress).not.toHaveBeenCalled()
  })
})
