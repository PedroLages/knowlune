/**
 * Drive File Access Service — resolves playable URLs for Drive-sourced lesson files.
 *
 * Cache hit → blob URL from OPFS (instant offline playback).
 * Cache miss + online → stream from Drive, cache to OPFS, return blob URL.
 * Cache miss + offline → throw DriveFileOfflineError.
 *
 * @see E77b-S03
 */

import { getDriveToken, refreshDriveToken } from '@/lib/googleDriveToken'
import { buildStreamUrl } from '@/lib/googleDriveFileService'

const OPFS_ROOT = 'knowlune'
const CACHE_DIR = 'drive-cache'

// ── Error classes ───────────────────────────────────────────────

/**
 * Thrown when trying to play a Drive file that is not cached and the
 * user is offline. The caller should surface this as a connectivity error.
 */
export class DriveFileOfflineError extends Error {
  constructor(
    message = 'Cannot play this file while offline. Connect to the internet and try again.'
  ) {
    super(message)
    this.name = 'DriveFileOfflineError'
  }
}

/**
 * Thrown when the Drive file is not found or the user lacks access.
 */
export class DriveFileNotFoundError extends Error {
  constructor(message = 'This file could not be found or accessed on Google Drive.') {
    super(message)
    this.name = 'DriveFileNotFoundError'
  }
}

// ── OPFS cache helpers ──────────────────────────────────────────

/** Check whether OPFS is available in this browser. */
function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  )
}

/** Get a handle to the drive-cache directory, creating it if needed. */
async function getCacheDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  const knowluneDir = await root.getDirectoryHandle(OPFS_ROOT, { create: true })
  return knowluneDir.getDirectoryHandle(CACHE_DIR, { create: true })
}

/**
 * Check if the OPFS cache contains a valid (non-empty) entry for the given fileId.
 * If found, creates and returns a blob URL. Otherwise returns null.
 */
async function getFromOpfsCache(fileId: string): Promise<string | null> {
  if (!isOpfsAvailable()) return null

  try {
    const cacheDir = await getCacheDir()
    const fileHandle = await cacheDir.getFileHandle(fileId)
    const file = await fileHandle.getFile()
    if (file.size > 0) {
      return URL.createObjectURL(file)
    }
    return null
  } catch {
    // File handle not found or OPFS not available
    return null
  }
}

/**
 * Write the body of a Response to the OPFS cache.
 * This is designed to run in the background (fire-and-forget).
 */
async function writeToOpfsCache(fileId: string, response: Response): Promise<void> {
  if (!isOpfsAvailable()) return

  try {
    const cacheDir = await getCacheDir()

    // Remove any existing cache entry so we start fresh
    try {
      await cacheDir.removeEntry(fileId)
    } catch {
      // Entry may not exist
    }

    const fileHandle = await cacheDir.getFileHandle(fileId, { create: true })
    const writable = await fileHandle.createWritable()

    const reader = response.body!.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        await writable.write(value)
      }
    } finally {
      reader.releaseLock()
    }

    await writable.close()
  } catch (err) {
    // Non-fatal: the caller already has a blob URL from the in-memory fetch.
    // Logging for debugging cache write failures.
    console.warn('[driveFileAccessService] OPFS cache write failed:', err)
  }
}

/**
 * Remove a cached file from OPFS.
 */
async function deleteFromOpfsCache(fileId: string): Promise<void> {
  if (!isOpfsAvailable()) return

  try {
    const cacheDir = await getCacheDir()
    await cacheDir.removeEntry(fileId)
  } catch {
    // Entry may not exist
  }
}

// ── Drive fetch helpers ──────────────────────────────────────────

/**
 * Fetch a file from Google Drive, handling 401 token refresh transparently.
 * Returns the response with a readable body for streaming.
 *
 * @throws DriveFileNotFoundError if the file is 404
 * @throws Error for other non-OK responses
 */
async function driveFileFetch(url: string): Promise<Response> {
  let token = await getDriveToken()
  if (!token) {
    throw new DriveFileNotFoundError(
      'No Drive authentication available. Please sign in with Google.'
    )
  }

  const makeRequest = async (accessToken: string): Promise<Response> =>
    fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

  let response = await makeRequest(token)

  // Token refresh on 401
  if (response.status === 401) {
    const refreshedToken = await refreshDriveToken()
    if (refreshedToken) {
      token = refreshedToken
      response = await makeRequest(refreshedToken)
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new DriveFileNotFoundError()
    }
    throw new Error(`Drive download failed: ${response.status} ${response.statusText}`)
  }

  return response
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Resolve a playable blob URL for a Drive-sourced file.
 *
 * Resolution order:
 * 1. OPFS cache hit → return cached blob URL immediately.
 * 2. Cache miss + online → stream from Drive, cache to OPFS in background, return blob URL.
 * 3. Cache miss + offline → throw DriveFileOfflineError.
 *
 * The returned blob URL must be revoked by the caller when no longer needed.
 *
 * @param fileId Google Drive file ID (from DriveFileRef)
 * @returns A blob: URL that can be set as a video/audio source
 * @throws DriveFileOfflineError, DriveFileNotFoundError
 */
export async function resolveFileUrl(fileId: string): Promise<string> {
  // 1. Check OPFS cache first
  const cachedUrl = await getFromOpfsCache(fileId)
  if (cachedUrl) return cachedUrl

  // 2. Check online status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new DriveFileOfflineError()
  }

  // 3. Build the Drive download URL
  const downloadUrl = buildStreamUrl(fileId)
  if (!downloadUrl) {
    throw new Error('Could not build download URL for Drive file')
  }

  // 4. Fetch from Drive with 401 refresh
  const response = await driveFileFetch(downloadUrl)

  // 5. Tee the stream: one branch for OPFS cache, one for blob creation
  const [streamForCache, streamForBlob] = response.body!.tee()

  // Write to OPFS cache in the background (fire-and-forget)
  const cacheResponse = new Response(streamForCache, {
    headers: response.headers,
  })
  writeToOpfsCache(fileId, cacheResponse).catch(err => {
    console.warn('[driveFileAccessService] Background cache write failed:', err)
  })

  // Create a blob URL from the other stream branch
  const blob = await new Response(streamForBlob).blob()
  return URL.createObjectURL(blob)
}

/**
 * Clear the OPFS cache for one or all Drive files.
 *
 * @param fileId Optional Drive file ID. If omitted, clears all Drive cache entries.
 */
export async function clearDriveCache(fileId?: string): Promise<void> {
  if (fileId) {
    await deleteFromOpfsCache(fileId)
  } else {
    // Clear all Drive cache entries by removing and recreating the directory
    if (!isOpfsAvailable()) return
    try {
      const root = await navigator.storage.getDirectory()
      const knowluneDir = await root.getDirectoryHandle(OPFS_ROOT, { create: false })
      await knowluneDir.removeEntry(CACHE_DIR, { recursive: true })
    } catch {
      // Directory may not exist
    }
  }
}
