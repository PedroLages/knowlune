import { useState, useEffect, useRef } from 'react'

type Result = { blobUrl: string | null; error: string | null; loading: boolean }

/**
 * Creates a blob URL from a FileSystemFileHandle for local video playback.
 *
 * Lifecycle guarantee: a blob URL is **never** revoked while it remains the
 * active `blobUrl` in state. Old URLs are only revoked atomically inside a
 * `setState` updater, at the exact moment a new URL replaces them — so the
 * consuming `<video>` element never sees a revoked `src`.
 */
export function useVideoFromHandle(
  handle: FileSystemFileHandle | null | undefined,
  retryKey?: number
): Result {
  const [state, setState] = useState<Result>({ blobUrl: null, error: null, loading: false })
  // Track the active URL so we can clean it up on genuine unmount
  const activeUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (handle === undefined) {
      // Handle not yet available (e.g., Dexie still loading the video record).
      // Show loading state instead of error — the handle may become valid soon.
      // Clean up any previous blob URL since the consuming component shows a
      // skeleton (not the video) while loading is true.
      setState(prev => {
        if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
        return { blobUrl: null, loading: true, error: null }
      })
      return
    }

    if (handle === null) {
      // Handle explicitly null — the video record exists but has no
      // file handle. Show the file-not-found error so the user can
      // locate or reimport the file.
      setState(prev => {
        if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
        return { blobUrl: null, error: 'file-not-found', loading: false }
      })
      return
    }

    let cancelled = false

    async function load() {
      // F010: Capture after null guard into typed const — avoids repeated ! assertions
      const fileHandle = handle as FileSystemFileHandle
      // Keep the previous blobUrl alive during load — never nullify it,
      // so the <video> element always has a valid src.
      // Clear any stale error from a previous intermediate state so the
      // consuming component doesn't flash an error during this load attempt.
      setState(prev => ({ ...prev, loading: true, error: null }))
      try {
        const permission = await fileHandle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          const result = await fileHandle.requestPermission({ mode: 'read' })
          if (result !== 'granted') {
            console.warn('[useVideoFromHandle] Permission denied — user declined file access')
            if (!cancelled) {
              setState(prev => {
                if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl)
                return { blobUrl: null, error: 'permission-denied', loading: false }
              })
            }
            return
          }
        }
        const file = await fileHandle.getFile()
        const newUrl = URL.createObjectURL(file)
        if (!cancelled) {
          activeUrlRef.current = newUrl
          // Atomically swap: revoke the OLD URL only when the NEW one is
          // confirmed and about to be stored. The updater runs synchronously
          // inside setState, so the <video> element never observes a gap.
          setState(prev => {
            if (prev.blobUrl && prev.blobUrl !== newUrl) {
              URL.revokeObjectURL(prev.blobUrl)
            }
            return { blobUrl: newUrl, error: null, loading: false }
          })
        } else {
          // This load was cancelled by a dependency change — clean up the
          // URL we just created since it will never be used.
          URL.revokeObjectURL(newUrl)
        }
      } catch (err) {
        // silent-catch-ok — error state rendered by consuming component (LocalVideoContent
        // shows "Video file not found" UI). Log details for diagnosis (Unraid remount,
        // permission expiry, file moved, etc.).
        const message = err instanceof Error ? err.message : String(err)
        const name = err instanceof DOMException ? `DOMException(${err.name})` : (err instanceof Error ? err.name : 'Unknown')
        console.warn(`[useVideoFromHandle] ${name}: ${message}`, err)
        if (!cancelled) setState(prev => ({ ...prev, error: 'file-not-found', loading: false }))
      }
    }

    load()

    return () => {
      cancelled = true
      // On dependency change, the new effect's load() will atomically revoke
      // the old URL inside the setState updater when the new URL is ready.
      // On genuine unmount, the empty-deps useEffect below handles cleanup.
    }
  }, [handle, retryKey])

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
