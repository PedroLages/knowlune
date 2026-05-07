/**
 * DownloadButton — icon button for initiating/cancelling book downloads.
 *
 * Renders a state-aware button on BookDetailHero action row.
 * 7-state machine: remote | pending | downloading | paused | retrying | downloaded | failed
 *
 * @since offline-book-downloads (2026-05-07)
 */

import { useCallback } from 'react'
import { Download, CircleCheck, CircleAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { downloadManager } from '@/services/DownloadManager'
import { useDownloadState, useIsDownloaded } from '@/stores/useDownloadStore'
import type { Book } from '@/data/types'

interface DownloadButtonProps {
  book: Book
}

/** Gate: only show for remote books with supported formats. */
export function canDownload(book: Book): boolean {
  if (book.source.type === 'local' || book.source.type === 'fileHandle') return false
  // ABS audiobooks gated until resolveDownloadUrl verified (Phase 2)
  if (book.format === 'audiobook' && book.absServerId) return false
  return ['epub', 'pdf', 'audiobook'].includes(book.format)
}

export function DownloadButton({ book }: DownloadButtonProps) {
  const state = useDownloadState(book.id)
  const isDownloaded = useIsDownloaded(book.id)
  const status = state?.status ?? 'remote'

  const handleClick = useCallback(async () => {
    if (status === 'downloading' || status === 'retrying') {
      downloadManager.cancelDownload(book.id)
      return
    }
    try {
      await downloadManager.startDownload(book)
      toast.success(`Download complete — "${book.title}" available offline`)
    } catch (err) {
      toast.error((err as Error).message || 'Download failed')
    }
  }, [book.id, book.title, status])

  if (!canDownload(book)) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label={
        status === 'downloading'
          ? `Downloading: ${state?.progress ?? 0}%`
          : isDownloaded
            ? 'Available offline'
            : status === 'failed'
              ? 'Download failed — tap to retry'
              : 'Download for offline'
      }
    >
      {isDownloaded ? (
        <CircleCheck className="size-4 text-success" aria-hidden="true" />
      ) : status === 'downloading' || status === 'retrying' ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : status === 'failed' ? (
        <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}
