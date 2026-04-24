/**
 * Storage indicator for the book library.
 *
 * Shows book count, storage used/available, and a color-coded progress bar
 * that shifts from brand → warning → destructive as usage increases.
 *
 * @since E83-S07
 */

import { useCallback, useEffect, useState } from 'react'
import { HardDrive } from 'lucide-react'
import { formatFileSize } from '@/lib/format'
import { opfsStorageService } from '@/services/OpfsStorageService'

interface StorageData {
  usage: number
  quota: number
  percent: number
}

interface StorageIndicatorProps {
  /** Number of books in the library (filtered by active source when provided) */
  bookCount: number
  /**
   * Global total when a source filter is active. When present and different
   * from `bookCount`, shown as secondary "{n} total across all sources" text.
   * Omit when no filter is active.
   */
  totalBookCount?: number
  /** Increment to trigger a re-fetch (bump after import/delete) */
  refreshKey?: number
}

export function StorageIndicator({
  bookCount,
  totalBookCount,
  refreshKey = 0,
}: StorageIndicatorProps) {
  const [data, setData] = useState<StorageData | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  const fetchEstimate = useCallback(async () => {
    const estimate = await opfsStorageService.getStorageEstimate()
    if (!estimate) {
      setUnavailable(true)
      return
    }
    const quota = estimate.quota || 1 // avoid division by zero
    setData({
      usage: estimate.usage,
      quota: estimate.quota,
      percent: Math.min(1, estimate.usage / quota),
    })
  }, [])

  useEffect(() => {
    fetchEstimate()
  }, [fetchEstimate, refreshKey])

  if (unavailable) {
    return (
      <div
        className="flex items-center gap-3 p-4 rounded-xl bg-surface-sunken/30 border border-border/50"
        data-testid="storage-indicator"
      >
        <HardDrive className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Storage info unavailable</span>
      </div>
    )
  }

  if (!data) return null

  const percentNum = Math.round(data.percent * 100)
  const available = Math.max(0, data.quota - data.usage)

  // Determine progress bar color based on thresholds
  let barColor: string
  if (data.percent > 0.95) {
    barColor = 'bg-destructive'
  } else if (data.percent >= 0.8) {
    barColor = 'bg-warning'
  } else {
    barColor = 'bg-brand'
  }

  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-xl bg-surface-sunken/30 border border-border/50"
      data-testid="storage-indicator"
      role="status"
      aria-label={`Storage: ${percentNum}% used`}
    >
      <div className="flex items-center gap-3">
        <HardDrive className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
          {totalBookCount !== undefined && totalBookCount !== bookCount && (
            <span
              className="ml-1 text-muted-foreground/80"
              data-testid="storage-indicator-total"
            >
              ({totalBookCount} total across all sources)
            </span>
          )}{' '}
          &middot; {formatFileSize(data.usage)} used &middot; {formatFileSize(available)} available
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={percentNum}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Storage usage"
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentNum}%` }}
        />
      </div>

      {/* Warning message when >90% */}
      {data.percent > 0.9 && (
        <p className="text-xs text-warning mt-1">
          Storage is almost full. Consider removing books you&apos;ve finished reading.
        </p>
      )}
    </div>
  )
}
