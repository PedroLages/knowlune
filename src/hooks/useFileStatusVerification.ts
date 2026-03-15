import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ImportedVideo, ImportedPdf } from '@/data/types'
import { verifyFileHandle, type FileStatus } from '@/lib/fileVerification'
import { TOAST_DURATION } from '@/lib/toastConfig'

type FileStatusMap = Map<string, FileStatus>

interface ContentItem {
  id: string
  filename: string
  fileHandle: FileSystemFileHandle | null | undefined
}

/**
 * Batch-verifies FileSystemHandle accessibility for all content items in a course.
 * Returns a Map<itemId, FileStatus> that updates as verification completes.
 * Fires a single aggregated toast when missing files are detected.
 */
export function useFileStatusVerification(
  videos: ImportedVideo[],
  pdfs: ImportedPdf[]
): FileStatusMap {
  const [statusMap, setStatusMap] = useState<FileStatusMap>(new Map())
  const toastFiredRef = useRef(false)

  useEffect(() => {
    const items: ContentItem[] = [
      ...videos.map(v => ({ id: v.id, filename: v.filename, fileHandle: v.fileHandle })),
      ...pdfs.map(p => ({ id: p.id, filename: p.filename, fileHandle: p.fileHandle })),
    ]

    if (items.length === 0) return

    let ignore = false
    toastFiredRef.current = false

    // Initialize all items as 'checking'
    const initial = new Map<string, FileStatus>()
    for (const item of items) {
      initial.set(item.id, 'checking')
    }
    setStatusMap(new Map(initial))

    async function verifyAll() {
      const results = await Promise.allSettled(
        items.map(async item => {
          const status = await verifyFileHandle(item.fileHandle)
          return { id: item.id, filename: item.filename, status }
        })
      )

      if (ignore) return

      const verified = new Map<string, FileStatus>()
      const missingFiles: string[] = []

      for (const result of results) {
        if (result.status === 'fulfilled') {
          verified.set(result.value.id, result.value.status)
          if (result.value.status === 'missing') {
            missingFiles.push(result.value.filename)
          }
        } else {
          // Settlement failure — treat as missing
          verified.set('unknown', 'missing')
        }
      }

      setStatusMap(verified)

      // Fire a single aggregated toast for missing files
      if (missingFiles.length > 0 && !toastFiredRef.current) {
        toastFiredRef.current = true
        const count = missingFiles.length
        toast.warning(
          `${count} ${count === 1 ? 'file' : 'files'} not found`,
          {
            description: missingFiles.join(', '),
            duration: TOAST_DURATION.LONG,
          }
        )
      }
    }

    verifyAll()

    return () => {
      ignore = true
    }
  }, [videos, pdfs])

  return statusMap
}
