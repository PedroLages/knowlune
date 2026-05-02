/**
 * Viewport placement for HighlightMiniPopover (unit-tested, iframe-agnostic).
 *
 * @module highlightMiniPopoverPosition
 */

/** Main-viewport anchor from highlight geometry (iframe-adjusted in HighlightLayer). */
export interface HighlightMiniPopoverAnchor {
  centerX: number
  top: number
  bottom: number
}

export interface MiniPopoverClampOptions {
  margin?: number
  headerReserve?: number
  gap?: number
  viewportWidth?: number
  viewportHeight?: number
}

/**
 * Place a fixed-position popover near a highlight: centered on anchorX, prefer above the highlight.
 */
export function clampMiniPopoverPosition(
  anchor: HighlightMiniPopoverAnchor,
  size: { width: number; height: number },
  options?: MiniPopoverClampOptions
): { top: number; left: number } {
  const margin = options?.margin ?? 8
  const headerReserve = options?.headerReserve ?? 48
  const gap = options?.gap ?? 8
  const vw = options?.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 800)
  const vh = options?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 600)
  const w = Math.max(1, size.width)
  const h = Math.max(1, size.height)

  let left = anchor.centerX - w / 2
  left = Math.min(Math.max(margin, left), vw - w - margin)

  let top = anchor.top - gap - h
  if (top < headerReserve) {
    top = anchor.bottom + gap
  }
  if (top + h + margin > vh) {
    top = Math.max(headerReserve, vh - h - margin)
  }
  if (top < headerReserve) {
    top = headerReserve
  }

  return { top, left }
}
