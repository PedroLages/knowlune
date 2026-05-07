import { useCallback, useEffect, useState, type RefObject } from 'react'

export interface ShelfScrollAffordances {
  canScrollLeft: boolean
  canScrollRight: boolean
  /** True when content is wider than the viewport (horizontal scroll possible). */
  hasOverflow: boolean
  update: () => void
}

/**
 * Measures a horizontal scroller for arrow visibility and overflow.
 * Uses ResizeObserver so affordances update when tiles/images change width.
 */
export function useShelfScrollAffordances(
  scrollerRef: RefObject<HTMLElement | null>,
  /** Re-run layout when row content changes (e.g. child count). */
  contentKey: unknown
): ShelfScrollAffordances {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)

  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    setHasOverflow(maxScrollLeft > 0)
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 1)
  }, [scrollerRef])

  useEffect(() => {
    update()
    const el = scrollerRef.current
    if (!el) return

    const onScroll = () => update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    const ro = new ResizeObserver(() => update())
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
    }
  }, [update, contentKey])

  return { canScrollLeft, canScrollRight, hasOverflow, update }
}
