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

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    let isCancelled = false
    let effectBlobUrl: string | null = null

    const resolveCoverUrl = async () => {
      // No cover URL
      if (!coverUrl) {
        if (!isCancelled) setResolvedUrl(null)
        return
      }

      // Guard: reject unrecognized protocols (ftp://, file://, javascript:, etc.)
      if (!/^(https?:|opfs:|opfs-cover:|data:image\/|\/)/.test(coverUrl)) {
        if (!isCancelled) setResolvedUrl(null)
        return
      }

      // External URL (http/https) or relative proxy path.
      //
      // In E2E we sometimes seed `.test` hostnames (e.g. abs-cover.test) and fulfill them via
      // Playwright routing. Some WebKit/Chromium environments can still fail to load those
      // URLs as <img src> resources. To keep cover rendering deterministic in dev/test,
      // we fetch and convert to a blob URL for `.test` hosts.
      if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
        const isTestHost = /\b\.test(?=[:/]|$)/.test(coverUrl)
        if (isTestHost && import.meta.env.DEV) {
          try {
            const res = await fetch(coverUrl)
            if (!res.ok) throw new Error('cover fetch failed')
            const blob = await res.blob()
            effectBlobUrl = URL.createObjectURL(blob)
            if (!isCancelled) setResolvedUrl(effectBlobUrl)
            return
          } catch {
            if (!isCancelled) setResolvedUrl(null)
            return
          }
        }

        if (!isCancelled) setResolvedUrl(coverUrl)
        return
      }

      if (coverUrl.startsWith('/')) {
        if (!isCancelled) setResolvedUrl(coverUrl)
        return
      }

      // Data URI - use directly (no blob URL lifecycle needed)
      if (coverUrl.startsWith('data:image/')) {
        if (!isCancelled) setResolvedUrl(coverUrl)
        return
      }

      // Custom storage protocol - resolve via OpfsStorageService
      // Both opfs:// and opfs-cover:// resolve to the same blob URL
      try {
        effectBlobUrl = await opfsStorageService.getCoverUrl(bookId)
        if (!isCancelled) {
          setResolvedUrl(effectBlobUrl)
        }
      } catch {
        // silent-catch-ok: Resolution failed - show no cover (not an error condition)
        if (!isCancelled) setResolvedUrl(null)
      }
    }

    resolveCoverUrl()

    // Cleanup: revoke this effect's blob URL when coverUrl changes or component unmounts.
    return () => {
      isCancelled = true
      if (effectBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(effectBlobUrl)
      }
    }
  }, [bookId, coverUrl])

  return resolvedUrl
}
