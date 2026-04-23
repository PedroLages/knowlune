/**
 * Export bundle types and client helper — E119-S05
 *
 * Provides:
 *   - TypeScript types for the export manifest and too-large response
 *   - `callExportDataFunction()` — calls the `export-data` Edge Function
 *     and returns either a ZIP blob + manifest or a too-large signal
 *
 * The Edge Function itself lives in supabase/functions/export-data/index.ts.
 * This module is frontend-only and must not be imported by Deno Edge Functions.
 */

import { supabase } from '@/lib/auth/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Manifest embedded in the ZIP's README.md and surfaced to the UI for display. */
export interface ExportManifest {
  exportedAt: string
  noticeVersion: string
  schemaVersion: number
  /** Per-table row counts: key is Supabase table name, value is row count */
  tables: Record<string, number>
  /** Per-bucket object counts: key is bucket name, value is object count */
  buckets: Record<string, number>
  contactEmail: string
}

/** Returned when the user's data exceeds the 500 MB streaming threshold. */
export interface ExportTooLargeResponse {
  status: 'too-large'
  route: 'async'
}

/** Successful export response. */
export interface ExportSuccessResponse {
  zipBlob: Blob
}

/** Union of all possible callExportDataFunction outcomes. */
export type ExportDataResponse = ExportSuccessResponse | ExportTooLargeResponse

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function isTooLarge(body: unknown): body is ExportTooLargeResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as Record<string, unknown>).status === 'too-large'
  )
}

// ---------------------------------------------------------------------------
// Client function
// ---------------------------------------------------------------------------

/**
 * Call the `export-data` Edge Function with the user's Supabase access token.
 *
 * - On HTTP 200: resolves with `{ zipBlob }` (the ZIP archive as a Blob)
 * - On JSON response with `status: 'too-large'`: resolves with `{ status: 'too-large', route: 'async' }`
 * - On HTTP error or network failure: throws an Error with a descriptive message
 *
 * @param accessToken - The current Supabase session `access_token`
 */
export async function callExportDataFunction(
  accessToken: string
): Promise<ExportDataResponse> {
  if (!supabase) {
    throw new Error('Supabase not configured — cannot call export-data function')
  }

  // Derive the Edge Function URL from the Supabase URL
  // e.g. https://xyz.supabase.co → https://xyz.supabase.co/functions/v1/export-data
  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
  if (!supabaseUrl) {
    throw new Error('Cannot determine Supabase URL for export-data function')
  }
  const functionUrl = `${supabaseUrl}/functions/v1/export-data`

  let response: Response
  try {
    response = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Network error calling export-data function: ${message}`)
  }

  // Handle too-large: the Edge Function returns 200 JSON with status:'too-large'
  // or a non-200 JSON body
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!response.ok || contentType.includes('application/json')) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new Error(`export-data function returned ${response.status} with non-JSON body`)
    }

    if (isTooLarge(body)) {
      return body
    }

    const errorMsg =
      typeof body === 'object' && body !== null && 'error' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).error)
        : `HTTP ${response.status}`

    throw new Error(`export-data function error: ${errorMsg}`)
  }

  // Successful ZIP response
  const zipBlob = await response.blob()
  return { zipBlob }
}
