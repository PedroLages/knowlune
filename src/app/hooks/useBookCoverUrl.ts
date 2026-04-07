/**
 * React hook to resolve book cover URLs to displayable blob URLs.
 *
 * Handles custom storage protocol identifiers:
 * - `opfs-cover://bookId` → resolves via OpfsStorageService.getCoverUrl()
 * - `opfs://path` → resolves via OpfsStorageService.getCoverUrl()
 * - http(s):// URLs → passed through unchanged (external covers)
 * - undefined/null → returns null (no cover)
 *
 * Automatically manages object URL lifecycle:
 * - Creates blob URL on mount or when coverUrl changes
 * - Revokes blob URL on unmount to prevent memory leaks
 *
 * @module useBookCoverUrl
 * @since E107-S01
 */

import { useEffect, useState, useRef } from 'react'
import { opfsStorageService } from '@/services/OpfsStorageService'

interface UseBookCoverUrlOptions {
  /** Book ID for cover resolution (required for opfs:// and opfs-cover:// URLs) */
  bookId: string
  /** Cover URL from book record (may be opfs://, opfs-cover://, http://, or undefined) */
  coverUrl: string | undefined
}

/**
 * Resolve a book's cover URL to a displayable blob URL.
 *
 * @example
 * ```tsx
 * const coverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
 *
 * if (coverUrl) {
 *   return <img src={coverUrl} alt="Cover" />
 * }
 * return <div className="placeholder">No cover</div>
 * ```
 */
export function useBookCoverUrl({ bookId, coverUrl }: UseBookCoverUrlOptions): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const previousUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const resolveCoverUrl = async () => {
      // No cover URL
      if (!coverUrl) {
        if (!isCancelled) setResolvedUrl(null)
        return
      }

      // External URL (http/https) - use directly
      if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
        if (!isCancelled) setResolvedUrl(coverUrl)
        return
      }

      // Custom storage protocol - resolve via OpfsStorageService
      // Both opfs:// and opfs-cover:// resolve to the same blob URL
      try {
        const url = await opfsStorageService.getCoverUrl(bookId)
        if (!isCancelled) {
          setResolvedUrl(url)
          previousUrlRef.current = url
        }
      } catch {
        // silent-catch-ok: Resolution failed - show no cover (not an error condition)
        if (!isCancelled) setResolvedUrl(null)
      }
    }

    resolveCoverUrl()

    // Cleanup: revoke previous blob URL when coverUrl changes or component unmounts
    return () => {
      isCancelled = true
      if (previousUrlRef.current && previousUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previousUrlRef.current)
        previousUrlRef.current = null
      }
    }
  }, [bookId, coverUrl])

  return resolvedUrl
}
