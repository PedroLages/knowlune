import { useState, useEffect } from 'react'

type Result = { blobUrl: string | null; error: string | null; loading: boolean }

export function useVideoFromHandle(handle: FileSystemFileHandle | null | undefined): Result {
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
            if (!cancelled) setState({ blobUrl: null, error: 'permission-denied', loading: false })
            return
          }
        }
        const file = await handle!.getFile()
        objectUrl = URL.createObjectURL(file)
        if (!cancelled) setState({ blobUrl: objectUrl, error: null, loading: false })
      } catch {
        if (!cancelled) setState({ blobUrl: null, error: 'file-not-found', loading: false })
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl) // AC-6: cleanup on unmount
    }
  }, [handle])

  return state
}
