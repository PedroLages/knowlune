/**
 * useDriveFileUrl — Creates a blob URL from a Google Drive file reference.
 *
 * Mirrors the same lifecycle contract as useVideoFromHandle:
 * - A blob URL is never revoked while it remains the active `blobUrl` in state.
 * - Old URLs are revoked atomically inside setState, at the exact moment a new
 *   URL replaces them, so the consuming <video> element never sees a revoked src.
 *
 * @see E77b-S03
 */

import { useState, useEffect, useRef } from 'react'
import { resolveFileUrl } from '@/lib/driveFileAccessService'
import type { DriveFileRef } from '@/data/types'

type Result = { blobUrl: string | null; error: string | null; loading: boolean }

function revokePreviousBlobUrl(prev: { blobUrl: string | null }): void {
  if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
}

/**
 * Hook to resolve a Drive file reference into a playable blob URL.
 *
 * @param driveFileRef The Drive file reference, or null when the lesson is not
 *                     Drive-sourced, or undefined while the lesson is loading.
 * @param retryKey     Increment to force re-resolution (e.g. for error recovery).
 *
 * Returns { blobUrl, error, loading } matching the useVideoFromHandle contract.
 */
export function useDriveFileUrl(
  driveFileRef: DriveFileRef | null | undefined,
  retryKey?: number
): Result {
  const [state, setState] = useState<Result>({ blobUrl: null, error: null, loading: false })
  const activeUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (driveFileRef === undefined) {
      // Not yet known if this is a Drive source (lesson still loading from Dexie).
      setState(prev => {
        revokePreviousBlobUrl(prev)
        return { blobUrl: null, loading: true, error: null }
      })
      activeUrlRef.current = null
      return
    }

    if (driveFileRef === null) {
      // Explicitly not a Drive source — remain inactive.
      setState(prev => {
        revokePreviousBlobUrl(prev)
        return { blobUrl: null, error: null, loading: false }
      })
      activeUrlRef.current = null
      return
    }

    // driveFileRef is present — resolve it
    let cancelled = false

    async function load() {
      // Keep the previous blobUrl alive during load — never nullify it,
      // so the <video> element always has a valid src.
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        // Guard: driveFileRef is confirmed non-null/non-undefined at this point
        const { fileId } = driveFileRef as DriveFileRef
        const url = await resolveFileUrl(fileId)

        if (!cancelled) {
          activeUrlRef.current = url
          // Atomically swap: revoke the OLD URL only when the NEW one is ready.
          setState(prev => {
            if (prev.blobUrl) {
              URL.revokeObjectURL(prev.blobUrl)
            }
            return { blobUrl: url, error: null, loading: false }
          })
        } else {
          // This load was cancelled — clean up the URL we created
          URL.revokeObjectURL(url)
        }
      } catch (err) {
          // silent-catch-ok — error is surfaced to caller via state.error
          if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          console.warn('[useDriveFileUrl] Drive file resolution failed:', message)
          setState(prev => {
            revokePreviousBlobUrl(prev)
            return { blobUrl: null, error: message, loading: false }
          })
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [driveFileRef, retryKey])

  // Separate empty-deps effect: cleanup only runs on genuine unmount.
  // On unmount both cleanups fire (main effect sets cancelled=true, this
  // one revokes the active URL). On dependency change only the main
  // effect's cleanup fires — this effect does not re-run.
  // The macrotask defer is Strict Mode safe: the second mount will set
  // a new activeUrlRef before the first mount's timeout fires.
  useEffect(() => {
    return () => {
      const url = activeUrlRef.current
      if (url) {
        setTimeout(() => {
          if (activeUrlRef.current === url) {
            URL.revokeObjectURL(url)
            activeUrlRef.current = null
          }
        }, 0)
      }
    }
  }, [])

  return state
}
