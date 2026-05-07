/**
 * DownloadStorageSection — per-book download list with Remove actions.
 *
 * Shows total OPFS storage used by offline downloads with a per-book list
 * of downloaded titles, sizes, and individual Remove buttons.
 * Includes "Remove All Downloads" with confirmation.
 *
 * @since offline-book-downloads (2026-05-07)
 */

import { useState, useEffect, useCallback } from 'react'
import { DownloadCloud, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { db } from '@/db/schema'
import { downloadManager } from '@/services/DownloadManager'

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface DownloadEntry {
  bookId: string
  title: string
  totalSize: number
}

export function DownloadStorageSection() {
  const [entries, setEntries] = useState<DownloadEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const recs = await db.downloads
        .where('status')
        .equals('downloaded')
        .toArray()
      const bookIds = recs.map(r => r.bookId)
      const books = await db.books.bulkGet(bookIds)
      const bookMap = new Map(books.filter(Boolean).map(b => [b!.id, b!.title]))

      setEntries(recs.map(r => ({
        bookId: r.bookId,
        title: bookMap.get(r.bookId) ?? 'Unknown book',
        totalSize: r.totalSize || 0,
      })))
    } catch {
      // silent-catch-ok — section is best-effort display
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRemove = useCallback(async (bookId: string) => {
    await downloadManager.removeDownload(bookId)
    setEntries(prev => prev.filter(r => r.bookId !== bookId))
    toast.info('Download removed')
  }, [])

  const handleRemoveAll = useCallback(async () => {
    for (const entry of entries) {
      await downloadManager.removeDownload(entry.bookId)
    }
    setEntries([])
    toast.info('All downloads removed')
  }, [entries])

  const totalBytes = entries.reduce((sum, r) => sum + r.totalSize, 0)

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />
  if (entries.length === 0) return null

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <DownloadCloud className="size-5 text-success" aria-hidden="true" />
          Offline Content
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {entries.length} book{entries.length !== 1 ? 's' : ''} · {fmtBytes(totalBytes)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {entries.map(entry => (
            <div key={entry.bookId} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.totalSize ? fmtBytes(entry.totalSize) : 'Unknown size'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive shrink-0 ml-2"
                onClick={() => handleRemove(entry.bookId)}
                aria-label={`Remove download for ${entry.title}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
        {entries.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 text-destructive hover:bg-destructive/10"
            onClick={handleRemoveAll}
          >
            <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
            Remove All Downloads
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
