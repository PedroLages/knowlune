/**
 * Unit Tests: youtubeEmbeddability.ts
 *
 * Covers status → reason mapping, network-failure fail-safe, and in-memory
 * cache dedup for the oEmbed embeddability probe.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  probeEmbeddability,
  clearEmbeddabilityCache,
} from '@/lib/youtubeEmbeddability'

describe('youtubeEmbeddability', () => {
  beforeEach(() => {
    clearEmbeddabilityCache()
    vi.restoreAllMocks()
  })

  it('returns embeddable: true on HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    )

    const result = await probeEmbeddability('abc123DEF_-')
    expect(result).toEqual({ embeddable: true })
  })

  it('returns embedding-disabled on HTTP 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    )

    const result = await probeEmbeddability('blocked1234')
    expect(result).toEqual({ embeddable: false, reason: 'embedding-disabled' })
  })

  it('returns deleted-or-private on HTTP 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    const result = await probeEmbeddability('missing1234')
    expect(result).toEqual({ embeddable: false, reason: 'deleted-or-private' })
  })

  it('returns reason: unknown for non-2xx/401/404 responses (e.g. 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500 })
    )

    const result = await probeEmbeddability('servererr01')
    expect(result).toEqual({ embeddable: false, reason: 'unknown' })
  })

  it('returns reason: unknown when fetch rejects (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const result = await probeEmbeddability('netfail0001')
    expect(result).toEqual({ embeddable: false, reason: 'unknown' })
  })

  it('dedupes repeat calls for the same videoId (fetch called once)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))

    const first = await probeEmbeddability('cachetest01')
    const second = await probeEmbeddability('cachetest01')

    expect(first).toEqual({ embeddable: true })
    expect(second).toEqual({ embeddable: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('caches network-failure results so a second call does not re-fetch', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'))

    const first = await probeEmbeddability('netcache001')
    const second = await probeEmbeddability('netcache001')

    expect(first).toEqual({ embeddable: false, reason: 'unknown' })
    expect(second).toEqual({ embeddable: false, reason: 'unknown' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('caches per videoId (different IDs → separate fetches)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))

    await probeEmbeddability('idone000001')
    await probeEmbeddability('idtwo000002')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
