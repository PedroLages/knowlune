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
    if (!handle) {
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
      setState(prev => ({ ...prev, loading: true }))
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
        // silent-catch-ok — error state rendered by consuming component; console.warn emitted for developer debugging
        console.warn('[useVideoFromHandle] Error accessing file:', err)
        if (!cancelled) setState(prev => ({ ...prev, error: 'file-not-found', loading: false }))
      }
    }

    load()

    return () => {
      cancelled = true
      // On genuine unmount (no dependency change), clean up the active URL.
      // We defer to a macrotask: if a new effect has started by then (dep
      // change), its load() will handle URL lifecycle. If not, we're truly
      // unmounting and should release the blob memory.
      const urlAtCleanup = activeUrlRef.current
      if (urlAtCleanup) {
        setTimeout(() => {
          if (activeUrlRef.current === urlAtCleanup) {
            URL.revokeObjectURL(urlAtCleanup)
            activeUrlRef.current = null
          }
        }, 0)
      }
    }
  }, [handle, retryKey])

  return state
}
