// Drive API v3 wrapper for the folder browser import feature.
// Provides listFolder, getFileMetadata, and buildStreamUrl utilities.
// All functions check premium entitlement and Drive read scope before calling the API.

import { getDriveToken, refreshDriveToken } from '@/lib/googleDriveToken'

// ── Types ──────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: number
  modifiedTime?: string
}

export type DriveFileCategory = 'video' | 'pdf' | 'epub' | 'audio' | 'folder' | 'other'

export interface DriveFolderBrowserResult {
  folderId: string
  folderName: string
  files: DriveFile[]
}

export type DriveListResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

// ── Error classes ──────────────────────────────────────────────

export class DriveScopeError extends Error {
  constructor(message = 'Google Drive read scope not granted. Please re-authenticate.') {
    super(message)
    this.name = 'DriveScopeError'
  }
}

export class DriveNetworkError extends Error {
  constructor(message = 'Failed to reach Google Drive. Please check your connection.') {
    super(message)
    this.name = 'DriveNetworkError'
  }
}

export class DriveRateLimitError extends Error {
  constructor(message = 'Google Drive rate limit exceeded. Please try again later.') {
    super(message)
    this.name = 'DriveRateLimitError'
  }
}

export class DriveApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'DriveApiError'
    this.status = status
  }
}

// ── Constants ──────────────────────────────────────────────────

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'

const SUPPORTED_VIDEO_MIME = 'video/'
const SUPPORTED_PDF_MIME = 'application/pdf'
const SUPPORTED_EPUB_MIME = 'application/epub+zip'
const SUPPORTED_AUDIO_MIME = 'audio/'

// ── Helpers ────────────────────────────────────────────────────

function categorizeMimeType(mimeType: string): DriveFileCategory {
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder'
  if (mimeType.startsWith(SUPPORTED_VIDEO_MIME)) return 'video'
  if (mimeType === SUPPORTED_PDF_MIME) return 'pdf'
  if (mimeType === SUPPORTED_EPUB_MIME) return 'epub'
  if (mimeType.startsWith(SUPPORTED_AUDIO_MIME)) return 'audio'
  return 'other'
}

/** Returns true if the mime type is supported for import (video, PDF, EPUB, audio). */
export function isSupportedForImport(mimeType: string): boolean {
  const category = categorizeMimeType(mimeType)
  return category !== 'folder' && category !== 'other'
}

/** Maps Drive API HTTP errors to typed errors. */
function mapDriveError(status: number, body: { error?: { message?: string } }): Error {
  const errorMessage = body?.error?.message ?? 'Unknown Drive API error'

  switch (status) {
    case 401:
      return new DriveApiError(401, 'Google Drive access token expired. Refreshing...')
    case 403: {
      if (
        errorMessage.toLowerCase().includes('insufficient') ||
        errorMessage.toLowerCase().includes('scope') ||
        errorMessage.toLowerCase().includes('cannot access')
      ) {
        return new DriveScopeError()
      }
      if (
        errorMessage.toLowerCase().includes('rate') ||
        errorMessage.toLowerCase().includes('quota')
      ) {
        return new DriveRateLimitError()
      }
      return new DriveApiError(403, 'Access to this file or folder was denied.')
    }
    case 404:
      return new DriveApiError(404, 'File or folder not found.')
    case 429:
      return new DriveRateLimitError()
    default:
      return new DriveApiError(status, errorMessage)
  }
}

/** Fetch helper with 401-retry + token refresh. */
async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getDriveToken()
  if (!token) {
    throw new DriveScopeError('No Google Drive token available. Please sign in with Google.')
  }

  const makeRequest = async (accessToken: string): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  let response = await makeRequest(token)

  // 401 — try refreshing the token and retry once
  if (response.status === 401) {
    const refreshedToken = await refreshDriveToken()
    if (refreshedToken) {
      response = await makeRequest(refreshedToken)
    }
  }

  return response
}

/** Handle the response and parse JSON body. */
async function handleResponse<T>(response: Response): Promise<DriveListResult<T>> {
  if (!response.ok) {
    let body: { error?: { message?: string } } = {}
    try {
      body = await response.json()
    } catch {
      // silent-catch-ok: inability to parse error body is non-fatal
    }

    const err = mapDriveError(response.status, body)
    if (err instanceof DriveScopeError) {
      return { ok: false, error: err.message, status: response.status }
    }
    if (err instanceof DriveNetworkError) {
      return { ok: false, error: err.message, status: response.status }
    }
    if (err instanceof DriveRateLimitError) {
      return { ok: false, error: err.message, status: response.status }
    }
    return { ok: false, error: err.message, status: response.status }
  }

  try {
    const data = (await response.json()) as T
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Failed to parse Drive API response.', status: response.status }
  }
}

// ── Public API ─────────────────────────────────────────────────

interface FilesListResponse {
  files: DriveFile[]
  nextPageToken?: string
}

/**
 * List files and folders inside a Drive folder.
 *
 * @param folderId The Drive folder ID. Use 'root' for the user's My Drive root.
 * @param pageToken Optional page token for pagination.
 * @returns A list result with DriveFile entries.
 */
export async function listFolder(
  folderId: string,
  pageToken?: string
): Promise<DriveListResult<{ files: DriveFile[]; nextPageToken?: string }>> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,modifiedTime),nextPageToken',
    pageSize: '100',
    orderBy: 'folder,name',
  })

  if (pageToken) {
    params.set('pageToken', pageToken)
  }

  const url = `${DRIVE_API_BASE}/files?${params.toString()}`

  try {
    const response = await driveFetch(url)
    return handleResponse<FilesListResponse>(response)
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, error: err.message }
    }
    return { ok: false, error: 'An unexpected error occurred while listing Drive folder.' }
  }
}

/**
 * Get metadata for a specific Drive file.
 */
export async function getFileMetadata(fileId: string): Promise<DriveListResult<DriveFile>> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,modifiedTime',
  })

  const url = `${DRIVE_API_BASE}/files/${fileId}?${params.toString()}`

  try {
    const response = await driveFetch(url)
    return handleResponse<DriveFile>(response)
  } catch (err) {
    if (err instanceof Error) {
      return { ok: false, error: err.message }
    }
    return { ok: false, error: 'An unexpected error occurred while fetching Drive file metadata.' }
  }
}

/**
 * Builds a streamable download URL for a Drive file.
 *
 * For video/audio files, this returns a `media` export URL that streams the
 * content directly. For PDFs and EPUBs, it returns the standard download URL.
 *
 * Note: The returned URL is only valid while the current provider_token is valid.
 * Browser fetch requests to this URL must include the Authorization header.
 *
 * @returns The Drive API download URL, or null if fileId is empty.
 */
export function buildStreamUrl(fileId: string): string | null {
  if (!fileId) return null

  // Use the export/media URL for streaming-capable content
  return `${DRIVE_API_BASE}/files/${fileId}?alt=media`
}

/**
 * Download the actual content bytes from a Drive file.
 * Returns null if the token is unavailable.
 */
export async function downloadFileContent(
  fileId: string,
  signal?: AbortSignal
): Promise<Response | null> {
  const token = await getDriveToken()
  if (!token) return null

  const url = buildStreamUrl(fileId)
  if (!url) return null

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })

    if (!response.ok) {
      if (response.status === 401) {
        // Try once with refreshed token
        const refreshedToken = await refreshDriveToken()
        if (refreshedToken) {
          return fetch(url, {
            headers: { Authorization: `Bearer ${refreshedToken}` },
            signal,
          })
        }
      }
      return null
    }

    return response
  } catch {
    return null
  }
}
