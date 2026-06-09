import { useEffect, useMemo } from 'react'
import { useScrubPreview } from '@/app/hooks/useScrubPreview'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/app/components/ui/utils'

/** Storyboard sprite-sheet data for instant preview rendering */
export interface StoryboardProp {
  url: string
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
  interval: number
  frameCount: number
}

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
  /** Whether the tooltip should be visible (gated on hover state) */
  visible?: boolean
  /** Storyboard sprite sheet for instant preview (YouTube-style). Falls back to live extraction when absent. */
  storyboard?: StoryboardProp
}

/**
 * Floating scrub preview tooltip — YouTube-style thumbnail shown when
 * hovering the progress bar. Uses an offscreen hidden <video> + <canvas>
 * to extract frames without disturbing main playback.
 *
 * The offscreen video is kept mounted at all times (preloading metadata)
 * so the first hover has no perceptible delay. Frame requests and tooltip
 * visibility are gated on the `visible` prop.
 */
export function ScrubPreview({
  src,
  time,
  x,
  trackWidth,
  duration: _duration,
  chapterTitle,
  visible = true,
  storyboard,
}: ScrubPreviewProps) {
  const { videoRef, canvasRef, requestFrameAt, thumbnailAvailable } = useScrubPreview(src)

  // Request a frame whenever the target time changes, but only when visible
  // and only when using live extraction (no storyboard).
  useEffect(() => {
    if (visible && !storyboard) {
      requestFrameAt(time)
    }
  }, [time, requestFrameAt, visible, storyboard])

  // Clamp horizontal position so the preview never overflows the track edges.
  // halfPreviewWidth is an estimate; the actual element width is content-driven
  // but 80px is a reasonable midpoint for a ~160px-wide thumbnail.
  const halfPreviewWidth = 80
  const left = useMemo(() => {
    if (trackWidth <= 0) return x
    return Math.max(halfPreviewWidth, Math.min(x, trackWidth - halfPreviewWidth))
  }, [x, trackWidth, halfPreviewWidth])

  const timeLabel = formatTimestamp(time)

  // Compute sprite tile position when storyboard is available
  const spriteStyle = useMemo(() => {
    if (!storyboard) return undefined
    const frameIndex = Math.max(
      0,
      Math.min(
        Math.floor(time / storyboard.interval),
        storyboard.frameCount - 1
      )
    )
    const col = frameIndex % storyboard.columns
    const row = Math.floor(frameIndex / storyboard.columns)
    return {
      backgroundImage: `url(${storyboard.url})`,
      backgroundPosition: `-${col * storyboard.tileWidth}px -${row * storyboard.tileHeight}px`,
      backgroundSize: `${storyboard.columns * storyboard.tileWidth}px ${storyboard.rows * storyboard.tileHeight}px`,
    }
  }, [storyboard, time])

  return (
    <>
      {/* Offscreen video for live extraction — only rendered when no storyboard.
          position:fixed + left:-9999px keeps it out of layout flow but seekable. */}
      {!storyboard && (
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
      )}

      {/* Tooltip — positioned above the track. Hidden when not hovering;
          the offscreen video stays mounted (preloading metadata) regardless. */}
      <div
        data-testid="scrub-preview"
        className={cn(
          'absolute bottom-full mb-3 -translate-x-1/2 pointer-events-none z-30',
          'motion-reduce:transition-none',
          !visible && 'invisible'
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
          {/* Thumbnail area */}
          {storyboard ? (
            /* Storyboard sprite tile — instant, no seek needed */
            <div
              data-testid="scrub-preview-sprite"
              className="w-[160px] h-[90px]"
              style={spriteStyle}
            />
          ) : (
            /* Live extraction — canvas always mounted (breaks the deadlock).
               Placeholder overlays the canvas until the first frame is painted. */
            <div className="relative w-[160px] h-[90px] bg-black">
              <canvas
                ref={canvasRef}
                className="block w-full h-full"
                width={160}
                height={90}
              />
              {!thumbnailAvailable && (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
              )}
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
