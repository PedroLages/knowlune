/**
 * File handle verification utilities for detecting missing or relocated files.
 * Extracted from the pattern in useVideoFromHandle.ts.
 *
 * @see src/hooks/useVideoFromHandle.ts — original permission + getFile pattern
 */

export type FileStatus = 'checking' | 'available' | 'missing' | 'permission-denied'

/**
 * Verifies whether a FileSystemFileHandle is still accessible.
 * Returns the current status without prompting for re-authorization.
 */
export async function verifyFileHandle(
  handle: FileSystemFileHandle | null | undefined
): Promise<FileStatus> {
  if (!handle) return 'missing'

  try {
    const permission = await handle.queryPermission({ mode: 'read' })
    if (permission !== 'granted') {
      return 'permission-denied'
    }
    await handle.getFile()
    return 'available'
  } catch {
    return 'missing'
  }
}
