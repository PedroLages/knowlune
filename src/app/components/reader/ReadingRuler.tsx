/**
 * ReadingRuler — a horizontal guide line that follows the cursor/touch
 * to help readers track their reading position.
 *
 * The ruler renders as an overlay on the reader viewport. It responds to
 * both mouse moves (desktop) and touch moves (mobile). A translucent
 * band highlights the current line while dimming the area above and below.
 *
 * Toggle via useReaderStore.readingRulerEnabled.
 *
 * Implementation note: The container uses `pointer-events-none` so it never
 * blocks tap navigation zones (prev/center/next at z-10). Pointer tracking
 * is done on `document` so movement is captured regardless of which child
 * element the pointer is over. The visual ruler only appears after the first
 * pointer move so no blank overlay intercepts clicks before the user moves.
 *
 * @module ReadingRuler
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReaderStore } from '@/stores/useReaderStore'

/** Height of the highlighted reading band in pixels */
const RULER_BAND_HEIGHT = 40

export function ReadingRuler() {
  const enabled = useReaderStore(s => s.readingRulerEnabled)
  const [yPosition, setYPosition] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    // Only update position when pointer is within the ruler container bounds
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return
    }
    const y = e.clientY - rect.top
    setYPosition(Math.max(0, Math.min(y, rect.height)))
  }, [])

  useEffect(() => {
    if (!enabled) {
      setYPosition(null)
      return
    }

    // Listen on document so pointer-events-none on the container doesn't
    // prevent event delivery. This also handles the case where the user's
    // pointer is over the epub iframe.
    document.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => document.removeEventListener('pointermove', handlePointerMove)
  }, [enabled, handlePointerMove])

  if (!enabled) return null

  const halfBand = RULER_BAND_HEIGHT / 2
  const topEdge = yPosition !== null ? Math.max(0, yPosition - halfBand) : 0
  const bottomEdge = yPosition !== null ? yPosition + halfBand : 0

  return (
    <div
      ref={containerRef}
      // pointer-events-none ensures this overlay never blocks tap navigation zones
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
      data-testid="reading-ruler"
    >
      {/* Visual ruler only renders after first pointer move — no blank overlay on initial render */}
      {yPosition !== null && (
        <>
          {/* Dim area above the ruler band */}
          <div
            className="absolute inset-x-0 top-0 bg-black/20 transition-[height] duration-75 ease-out"
            style={{ height: `${topEdge}px` }}
          />
          {/* Clear band — the reading focus area */}
          <div
            className="absolute inset-x-0 border-y border-brand/40"
            style={{ top: `${topEdge}px`, height: `${RULER_BAND_HEIGHT}px` }}
            data-testid="reading-ruler-band"
          />
          {/* Dim area below the ruler band */}
          <div
            className="absolute inset-x-0 bottom-0 bg-black/20 transition-[top] duration-75 ease-out"
            style={{ top: `${bottomEdge}px` }}
          />
        </>
      )}
    </div>
  )
}
