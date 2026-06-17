import { useState, useEffect } from 'react'

type Result = { blobUrl: string | null; error: string | null; loading: boolean }

export function useVideoFromHandle(
  handle: FileSystemFileHandle | null | undefined,
  retryKey?: number
): Result {
  const [state, setState] = useState<Result>({ blobUrl: null, error: null, loading: false })

  useEffect(() => {
    if (!handle) {
      setState({ blobUrl: null, error: 'file-not-found', loading: false })
      return
    }

    let objectUrl: string | null = null
    let cancelled = false

    async function load() {
      setState({ blobUrl: null, error: null, loading: true })
      try {
        const permission = await handle!.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          const result = await handle!.requestPermission({ mode: 'read' })
          if (result !== 'granted') {
            console.warn('[useVideoFromHandle] Permission denied — user declined file access')
            if (!cancelled) setState({ blobUrl: null, error: 'permission-denied', loading: false })
            return
          }
        }
        const file = await handle!.getFile()
        objectUrl = URL.createObjectURL(file)
        if (!cancelled) setState({ blobUrl: objectUrl, error: null, loading: false })
      } catch (err) {
        // silent-catch-ok — error state rendered by consuming component; console.warn emitted for developer debugging
        console.warn('[useVideoFromHandle] Error accessing file:', err)
        if (!cancelled) setState({ blobUrl: null, error: 'file-not-found', loading: false })
      }
    }

    load()

    return () => {
      cancelled = true
      // F009: Blob URL revoke is intentionally immediate on cleanup — LocalVideoContent's
      // `if (!blobUrl) return null` guard handles the VideoPlayer unmount during
      // retry/transition, so there is no stale URL being consumed. The null return
      // ensures VideoPlayer unmounts before the URL is revoked.
      if (objectUrl) URL.revokeObjectURL(objectUrl) // AC-6: cleanup on unmount
    }
  }, [handle, retryKey])

  return state
}
