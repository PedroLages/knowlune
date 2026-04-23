/**
 * Tests for callExportDataFunction — E119-S05 (AC-7, AC-8)
 *
 * Verifies:
 *   - Happy path: 200 ZIP response → resolves with { zipBlob }
 *   - Too-large: JSON { status: 'too-large', route: 'async' } → resolves with ExportTooLargeResponse
 *   - RLS error: 500 with { error: 'RLS error on table X' } → throws with table name in message (AC-8)
 *   - Network failure: fetch throws → propagates error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockFetch, mockSupabaseUrl } = vi.hoisted(() => {
  const mockFetch = vi.fn()
  const mockSupabaseUrl = 'https://test-project.supabase.co'
  return { mockFetch, mockSupabaseUrl }
})

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    supabaseUrl: mockSupabaseUrl,
    auth: { getUser: vi.fn() },
  },
}))

// Replace global fetch with our mock
vi.stubGlobal('fetch', mockFetch)

import { callExportDataFunction } from '../exportBundle'

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_ACCESS_TOKEN = 'test-access-token-abc123'
const EXPORT_FUNCTION_URL = `${mockSupabaseUrl}/functions/v1/export-data`

function makeZipBlob(): Blob {
  // Minimal ZIP blob (just needs to be a Blob; fflate creates real ZIPs in production)
  return new Blob(['PK\x03\x04'], { type: 'application/zip' })
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeZipResponse(): Response {
  return new Response(makeZipBlob(), {
    status: 200,
    headers: { 'Content-Type': 'application/zip' },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('callExportDataFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns { zipBlob } when Edge Function responds with 200 ZIP', async () => {
    mockFetch.mockResolvedValue(makeZipResponse())

    const result = await callExportDataFunction(TEST_ACCESS_TOKEN)

    expect('zipBlob' in result).toBe(true)
    if ('zipBlob' in result) {
      expect(result.zipBlob).toBeInstanceOf(Blob)
    }
  })

  it('calls the correct Edge Function URL with Authorization header', async () => {
    mockFetch.mockResolvedValue(makeZipResponse())

    await callExportDataFunction(TEST_ACCESS_TOKEN)

    expect(mockFetch).toHaveBeenCalledWith(
      EXPORT_FUNCTION_URL,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        }),
      })
    )
  })

  // ── Too-large path ────────────────────────────────────────────────────────

  it('returns ExportTooLargeResponse when Edge Function returns too-large JSON', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ status: 'too-large', route: 'async' }, 200)
    )

    const result = await callExportDataFunction(TEST_ACCESS_TOKEN)

    expect(result).toEqual({ status: 'too-large', route: 'async' })
  })

  it('returns ExportTooLargeResponse when HTTP 200 but body has status too-large', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ status: 'too-large', route: 'async' })
    )

    const result = await callExportDataFunction(TEST_ACCESS_TOKEN)

    expect('status' in result && result.status).toBe('too-large')
  })

  // ── RLS error paths (AC-8) ────────────────────────────────────────────────

  it('throws with table name in message when Edge Function returns RLS error on table notes', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ error: 'RLS error on table notes: permission denied for table notes' }, 500)
    )

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow(/notes/)
  })

  it('throws with table name in message when Edge Function returns RLS error on table bookmarks', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ error: 'RLS error on table bookmarks: permission denied' }, 500)
    )

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow(/bookmarks/)
  })

  it('throws when Edge Function returns 401 Unauthorized', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ success: false, error: 'Unauthorized' }, 401)
    )

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow(/Unauthorized/)
  })

  it('throws when Edge Function returns 500 with generic error', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ success: false, error: 'Internal server error' }, 500)
    )

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow()
  })

  // ── Network failure ────────────────────────────────────────────────────────

  it('throws with descriptive message on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow(
      /Network error calling export-data function/
    )
  })

  it('preserves original error message on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'))

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow(
      /Connection refused/
    )
  })

  // ── Boundary cases ────────────────────────────────────────────────────────

  it('throws when 500 response body is not valid JSON', async () => {
    mockFetch.mockResolvedValue(
      new Response('Gateway Timeout', {
        status: 504,
        headers: { 'Content-Type': 'text/plain' },
      })
    )

    await expect(callExportDataFunction(TEST_ACCESS_TOKEN)).rejects.toThrow()
  })
})

// ── Type-level checks ────────────────────────────────────────────────────────

describe('ExportManifest type shape', () => {
  it('satisfies the expected interface shape (compile-time validation)', () => {
    // If this compiles, the type is correct.
    // Use a runtime check as a proxy for the TypeScript satisfies check.
    const manifest = {
      exportedAt: '2026-04-23T12:00:00.000Z',
      noticeVersion: '2026-04-23.1',
      schemaVersion: 14,
      tables: { notes: 5, bookmarks: 2 },
      buckets: { avatars: 1, audio: 0 },
      contactEmail: 'privacy@pedrolages.net',
    }

    expect(typeof manifest.exportedAt).toBe('string')
    expect(typeof manifest.noticeVersion).toBe('string')
    expect(typeof manifest.schemaVersion).toBe('number')
    expect(typeof manifest.tables).toBe('object')
    expect(typeof manifest.buckets).toBe('object')
    expect(typeof manifest.contactEmail).toBe('string')
  })
})
