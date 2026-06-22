/**
 * Google Drive upload for Knowlune backup JSON.
 *
 * Provides a single upload function that:
 * - Uses multipart upload to Drive API
 * - Gets token via S02 token helper (getDriveToken / refreshDriveToken)
 * - Maps errors for clear user feedback
 * - Retries on 401 (token refresh) and network failure
 */
import { getDriveToken, refreshDriveToken } from '@/lib/googleDriveToken'

// ── Error types ──────────────────────────────────────────────

export class DriveQuotaError extends Error {
  constructor() {
    super('Your Google Drive is full.')
    this.name = 'DriveQuotaError'
  }
}

export class DrivePermissionError extends Error {
  constructor() {
    super('Reconnect Google')
    this.name = 'DrivePermissionError'
  }
}

export class DriveNetworkError extends Error {
  constructor() {
    super('Upload failed. Try again?')
    this.name = 'DriveNetworkError'
  }
}

// ── Types ────────────────────────────────────────────────────

export interface DriveUploadResult {
  fileId: string
  webViewLink: string
}

// ── Multipart upload constants ───────────────────────────────

const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const BOUNDARY = '-------knowlune-backup-boundary'

// ── Internals ────────────────────────────────────────────────

/**
 * Build a multipart/related body for a Drive file upload.
 *
 * Part 1: metadata JSON (name, mimeType)
 * Part 2: raw file content
 */
function buildMultipartBody(name: string, content: string): string {
  const metadata = JSON.stringify({
    name,
    mimeType: 'application/json',
  })

  const parts = [
    `--${BOUNDARY}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${BOUNDARY}`,
    'Content-Type: application/json',
    '',
    content,
    `--${BOUNDARY}--`,
  ]

  return parts.join('\r\n')
}

/**
 * Map a Drive API HTTP error to our error types.
 */
function mapDriveError(status: number, body: unknown): Error {
  if (status === 401) {
    // 401 is handled by the caller with a refresh+retry; fall through
    return new Error('Unauthorized — token refresh attempted')
  }

  if (status === 403) {
    const message =
      typeof body === 'object' && body !== null
        ? String((body as Record<string, unknown>).message ?? '')
        : String(body ?? '')

    if (
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('storage') ||
      message.toLowerCase().includes('insufficient')
    ) {
      return new DriveQuotaError()
    }

    // Permission errors: user revoked scope, workspace policy, etc.
    return new DrivePermissionError()
  }

  // Fallback: generic HTTP error message
  const message =
    typeof body === 'object' && body !== null
      ? String((body as Record<string, unknown>).message ?? `HTTP ${status}`)
      : `HTTP ${status}`

  return new Error(message)
}

/**
 * Sleep helper for backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute the raw multipart POST with the given token.
 */
async function executeUpload(token: string, body: string, signal?: AbortSignal): Promise<Response> {
  return fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
    },
    body,
    signal,
  })
}

// ── Public API ───────────────────────────────────────────────

/**
 * Upload a backup JSON blob to the user's Google Drive root folder.
 *
 * - Uses multipart upload (suitable for files < 5 MB).
 * - Retries once on 401 after refreshing the token.
 * - Retries once on network failure after 1 s backoff.
 * - Throws typed errors for known failure modes.
 *
 * @param blob     The JSON blob to upload.
 * @param filename The display name in Drive (e.g. "knowlune-backup-2026-06-21.knowlune.json")
 * @param signal   Optional AbortSignal to cancel the request.
 * @returns        `{ fileId, webViewLink }` from the Drive API response.
 */
/**
 * Attempt a single upload with the current token, returning the response.
 * Throws DriveNetworkError on network failure.
 */
async function attemptUpload(token: string, body: string, signal?: AbortSignal): Promise<Response> {
  try {
    return await executeUpload(token, body, signal)
  } catch {
    throw new DriveNetworkError()
  }
}

export async function uploadBackupToDrive(
  blob: Blob,
  filename: string,
  signal?: AbortSignal
): Promise<DriveUploadResult> {
  const content = await blob.text()

  // 1. Get the initial token
  let token = await getDriveToken()
  if (!token) {
    throw new DrivePermissionError()
  }

  // 2. Build the multipart body
  const body = buildMultipartBody(filename, content)

  // 3. Upload with network-failure retry (1 s backoff)
  let response: Response
  try {
    response = await attemptUpload(token, body, signal)
  } catch (firstError) {
    // Single retry after 1 s backoff
    await sleep(1000)
    try {
      response = await attemptUpload(token, body, signal)
    } catch {
      // Second failure — surface the original error
      throw firstError
    }
  }

  // 4. Handle 401: refresh and retry once
  if (response.status === 401) {
    token = await refreshDriveToken()
    if (!token) {
      throw new DrivePermissionError()
    }
    response = await attemptUpload(token, body, signal)
  }

  // 5. Handle non-OK responses
  if (!response.ok) {
    let responseBody: unknown
    try {
      responseBody = await response.json()
    } catch {
      responseBody = null
    }
    throw mapDriveError(response.status, responseBody)
  }

  // 6. Map Drive API response (id → fileId) to our type
  const apiResponse = (await response.json()) as {
    id: string
    webViewLink: string
  }
  return {
    fileId: apiResponse.id,
    webViewLink: apiResponse.webViewLink,
  }
}
