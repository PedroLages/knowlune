import { useEffect, useMemo } from 'react'
import { useScrubPreview } from '@/app/hooks/useScrubPreview'
import { formatTimestamp } from '@/lib/format'
import { crossOriginForUrl } from '@/lib/media'
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
  /** When true, storyboard generation is in progress — show a loading spinner. */
  loading?: boolean
  /** When true, storyboard generation previously failed — skip live extraction and show compact timestamp only. */
  storyboardFailed?: boolean
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
  loading = false,
  storyboardFailed = false,
}: ScrubPreviewProps) {
  const { videoRef, canvasRef, requestFrameAt, thumbnailAvailable, corsFailed } =
    useScrubPreview(src)

  // Request a frame whenever the target time changes, but only when visible
  // and only when using live extraction (no storyboard, not failed).
  const useLiveExtraction = !storyboard && !corsFailed && !storyboardFailed
  useEffect(() => {
    if (visible && useLiveExtraction) {
      requestFrameAt(time)
    }
  }, [time, requestFrameAt, visible, useLiveExtraction])

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
      Math.min(Math.floor(time / storyboard.interval), storyboard.frameCount - 1)
    )
    const col = frameIndex % storyboard.columns
    const row = Math.floor(frameIndex / storyboard.columns)
    return {
      backgroundImage: `url(${storyboard.url})`,
      backgroundPosition: `-${col * storyboard.tileWidth}px -${row * storyboard.tileHeight}px`,
      backgroundSize: `${storyboard.columns * storyboard.tileWidth}px ${storyboard.rows * storyboard.tileHeight}px`,
    }
  }, [storyboard, time])

  // Determine which visual to show in the preview area
  const showLoading = loading && !storyboard
  const showCompactOnly = !storyboard && (corsFailed || storyboardFailed) && !loading
  const showLiveCanvas = useLiveExtraction && !loading

  return (
    <>
      {/* Offscreen video for live extraction — only rendered when live extraction
          is viable (not loading, not CORS-failed, not storyboard-failed). */}
      {showLiveCanvas && (
        <video
          ref={videoRef}
          src={src}
          muted
          preload="auto"
          playsInline
          crossOrigin={crossOriginForUrl(src)}
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
        {/* Storyboard sprite tile — instant, no seek needed */}
        {storyboard && (
          <div className="rounded-lg overflow-hidden border border-border bg-background shadow-lg">
            <div
              data-testid="scrub-preview-sprite"
              className="w-[160px] h-[90px]"
              style={spriteStyle}
            />
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
        )}

        {/* Loading state — spinner + compact timestamp */}
        {showLoading && (
          <div
            data-testid="scrub-preview-loading"
            className="rounded-lg border border-border bg-background shadow-lg px-3 py-2 flex items-center gap-2"
          >
            <div className="size-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
            <time
              dateTime={`${time}s`}
              className="text-xs text-foreground font-medium tabular-nums"
            >
              {timeLabel}
            </time>
          </div>
        )}

        {/* Live extraction canvas — only when viable */}
        {showLiveCanvas && (
          <div className="rounded-lg overflow-hidden border border-border bg-background shadow-lg min-w-[120px] max-w-[200px]">
            <div className="relative w-[160px] h-[90px] bg-black">
              <canvas ref={canvasRef} className="block w-full h-full" width={160} height={90} />
              {!thumbnailAvailable && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
            </div>
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
        )}

        {/* Compact timestamp-only tooltip — no storyboard, CORS failed, or generation failed */}
        {showCompactOnly && (
          <div
            data-testid="scrub-preview-compact"
            className="rounded-lg border border-border bg-background shadow-lg px-3 py-1.5"
          >
            <time
              dateTime={`${time}s`}
              className="text-xs text-foreground font-medium tabular-nums"
            >
              {timeLabel}
            </time>
            {chapterTitle && (
              <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                {chapterTitle}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}
