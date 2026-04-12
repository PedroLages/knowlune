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
    const y = e.clientY - rect.top
    setYPosition(Math.max(0, Math.min(y, rect.height)))
  }, [])

  useEffect(() => {
    if (!enabled) return

    const el = containerRef.current
    if (!el) return

    el.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => el.removeEventListener('pointermove', handlePointerMove)
  }, [enabled, handlePointerMove])

  if (!enabled) return null

  const halfBand = RULER_BAND_HEIGHT / 2
  const topEdge = yPosition !== null ? Math.max(0, yPosition - halfBand) : 0
  const bottomEdge = yPosition !== null ? yPosition + halfBand : 0

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto absolute inset-0 z-20"
      aria-hidden="true"
      data-testid="reading-ruler"
    >
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
