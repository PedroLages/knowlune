import { useEffect, useMemo } from 'react'
import { useScrubPreview } from '@/app/hooks/useScrubPreview'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/app/components/ui/utils'

export interface ScrubPreviewProps {
  /** Video source URL (same as main player) for the offscreen preview video */
  src: string
  /** Hovered timestamp in seconds */
  time: number
  /** Pointer X position relative to the track (px) */
  x: number
  /** Track full width in px */
  trackWidth: number
  /** Video duration in seconds */
  duration: number
  /** Chapter title at the hovered time, if chapters exist */
  chapterTitle?: string
}

/**
 * Floating scrub preview tooltip — YouTube-style thumbnail shown when
 * hovering the progress bar. Uses an offscreen hidden <video> + <canvas>
 * to extract frames without disturbing main playback.
 */
export function ScrubPreview({
  src,
  time,
  x,
  trackWidth,
  duration: _duration,
  chapterTitle,
}: ScrubPreviewProps) {
  const { videoRef, canvasRef, requestFrameAt, thumbnailAvailable } = useScrubPreview(src)

  // Request a frame whenever the target time changes
  useEffect(() => {
    requestFrameAt(time)
  }, [time, requestFrameAt])

  // Clamp horizontal position so the preview never overflows the track edges.
  // halfPreviewWidth is an estimate; the actual element width is content-driven
  // but 80px is a reasonable midpoint for a ~160px-wide thumbnail.
  const halfPreviewWidth = 80
  const left = useMemo(() => {
    if (trackWidth <= 0) return x
    return Math.max(halfPreviewWidth, Math.min(x, trackWidth - halfPreviewWidth))
  }, [x, trackWidth, halfPreviewWidth])

  const timeLabel = formatTimestamp(time)

  return (
    <>
      {/* Hidden offscreen video — keeps the hook's ref wired to a real DOM element.
          position:fixed + left:-9999px keeps it out of layout flow but seekable. */}
      <video
        ref={videoRef}
        src={src}
        muted
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        className="fixed left-[-9999px] top-0 w-1 h-1 opacity-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Tooltip — positioned above the track */}
      <div
        data-testid="scrub-preview"
        className={cn(
          'absolute bottom-full mb-3 -translate-x-1/2 pointer-events-none z-30',
          'motion-reduce:transition-none'
        )}
        style={{ left }}
        aria-hidden="true"
      >
        <div
          className={cn(
            'rounded-lg overflow-hidden border border-border bg-background shadow-lg',
            'min-w-[120px] max-w-[200px]'
          )}
        >
          {/* Thumbnail or placeholder */}
          {thumbnailAvailable ? (
            <canvas
              ref={canvasRef}
              className="block w-full h-auto bg-black"
              width={160}
              height={90}
            />
          ) : (
            <div className="w-[160px] h-[90px] bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Preview</span>
            </div>
          )}

          {/* Timestamp + chapter caption */}
          <div className="px-2 py-1">
            <time
              dateTime={`${time}s`}
              className="block text-xs text-foreground font-medium tabular-nums text-center"
            >
              {timeLabel}
            </time>
            {chapterTitle && (
              <span className="block text-[10px] text-muted-foreground text-center truncate mt-0.5">
                {chapterTitle}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
