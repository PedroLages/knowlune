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
      // F010: Capture after null guard into typed const — avoids repeated ! assertions
      const fileHandle = handle as FileSystemFileHandle
      setState({ blobUrl: null, error: null, loading: true })
      try {
        const permission = await fileHandle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          const result = await fileHandle.requestPermission({ mode: 'read' })
          if (result !== 'granted') {
            console.warn('[useVideoFromHandle] Permission denied — user declined file access')
            if (!cancelled) setState({ blobUrl: null, error: 'permission-denied', loading: false })
            return
          }
        }
        const file = await fileHandle.getFile()
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
      // F012: Blob URL is revoked immediately on cleanup — the consuming component
      // guards against stale URL usage by returning null when blobUrl is falsey,
      // which unmounts VideoPlayer before the URL is revoked. The guard ordering
      // (showRecoveryOverlay before loading skeleton) ensures the recovery spinner
      // persists across mount/unmount during blob URL regeneration.
      if (objectUrl) URL.revokeObjectURL(objectUrl) // AC-6: cleanup on unmount
    }
  }, [handle, retryKey])

  return state
}
