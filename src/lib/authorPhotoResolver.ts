/**
 * Resolves a FileSystemFileHandle for an author photo to an object URL.
 *
 * Used by the author store to convert persisted file handles into
 * displayable URLs. Handles permission re-requests gracefully since
 * file handles may lose permission between sessions.
 *
 * @module
 */

/** Cache of resolved object URLs to avoid re-reading the same file handle. */
const resolvedUrls = new Map<FileSystemFileHandle, string>()

/**
 * Resolves a FileSystemFileHandle to a blob object URL for display.
 *
 * - Returns cached URL if previously resolved
 * - Requests read permission if needed (File System Access API)
 * - Returns null on any failure (permission denied, file moved, etc.)
 *
 * @param handle - The file handle to resolve
 * @returns Object URL string, or null if resolution fails
 */
export async function resolvePhotoHandle(handle: FileSystemFileHandle): Promise<string | null> {
  // Return cached URL if available
  const cached = resolvedUrls.get(handle)
  if (cached) return cached

  try {
    // Check/request permission (may have been revoked between sessions)
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission !== 'granted') {
      // Don't request permission during load — would show a popup
      // The user will need to re-import or manually grant access
      return null
    }

    const file = await handle.getFile()
    const url = URL.createObjectURL(file)
    resolvedUrls.set(handle, url)
    return url
  } catch (error) {
    // File may have been moved, deleted, or permission revoked
    console.warn('[AuthorPhoto] Failed to resolve photo handle:', error)
    return null
  }
}

/**
 * Revokes a previously resolved object URL and clears it from cache.
 * Call this when an author is deleted or photo is changed to avoid memory leaks.
 */
export function revokePhotoUrl(handle: FileSystemFileHandle): void {
  const url = resolvedUrls.get(handle)
  if (url) {
    URL.revokeObjectURL(url)
    resolvedUrls.delete(handle)
  }
}

/**
 * Clears all cached photo URLs. Useful during cleanup/logout.
 */
export function clearPhotoCache(): void {
  for (const url of resolvedUrls.values()) {
    URL.revokeObjectURL(url)
  }
  resolvedUrls.clear()
}
