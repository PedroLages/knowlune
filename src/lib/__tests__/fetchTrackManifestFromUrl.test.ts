/**
 * Tests for fetchTrackManifestFromUrl (E133-S01).
 *
 * Covers 7+ execution branches:
 *   1. Successful fetch + valid manifest
 *   2. 404 response → ok:false with 'Not found'
 *   3. Non-200 response → ok:false with status code
 *   4. Invalid JSON → ok:false
 *   5. Manifest parse error → ok:false with error details
 *   6. Network error / unreachable → ok:false
 *   7. Timeout → ok:false with timeout message
 *
 * @since CE-2026-06-28
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchTrackManifestFromUrl } from '../trackManifestImport'

const VALID_MANIFEST_JSON = {
  version: '1.0',
  track: {
    name: 'Test Track',
    description: 'A test track',
    courses: [
      { folder: 'alpha', position: 1 },
      { folder: 'beta', position: 2 },
    ],
  },
}

describe('fetchTrackManifestFromUrl', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // Branch 1: Successful fetch + valid manifest
  it('returns ok:true with summary and manifest on success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(VALID_MANIFEST_JSON),
    } as Response)

    const result = await fetchTrackManifestFromUrl('http://example.com/courses/')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.summary.trackName).toBe('Test Track')
      expect(result.manifest.track.courses).toHaveLength(2)
    }
  })

  // Branch 2: 404 response
  it('returns ok:false with "Not found" on 404', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const result = await fetchTrackManifestFromUrl('http://example.com/courses/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Not found')
    }
  })

  // Branch 3: Non-200 response
  it('returns ok:false with status code on 500', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    const result = await fetchTrackManifestFromUrl('http://example.com/courses/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('500')
    }
  })

  // Branch 4: Invalid JSON (SyntaxError)
  it('returns ok:false on malformed JSON', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    } as Response)

    const result = await fetchTrackManifestFromUrl('http://example.com/courses/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('JSON')
    }
  })

  // Branch 5: Manifest parse error (valid JSON but invalid schema)
  it('returns ok:false with parse error details for invalid manifest schema', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ version: '1.0', track: { name: 'No Courses' } }),
    } as Response)

    const result = await fetchTrackManifestFromUrl('http://example.com/courses/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid track-manifest.json')
    }
  })

  // Branch 6: Network error (TypeError)
  it('returns ok:false on network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await fetchTrackManifestFromUrl('http://unreachable.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Failed to fetch track-manifest.json')
    }
  })

  // Branch 7: Timeout (AbortError)
  it('returns ok:false on timeout', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new DOMException('The operation was aborted', 'AbortError')
    )

    const result = await fetchTrackManifestFromUrl('http://slow.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timed out')
    }
  })

  // Branch 7b: Arbitrary error (fallback catch)
  it('returns ok:false on arbitrary Error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('DNS resolution failed'))

    const result = await fetchTrackManifestFromUrl('http://broken.example/')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Failed to fetch track-manifest.json')
    }
  })
})
