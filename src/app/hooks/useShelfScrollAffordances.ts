import { useCallback, useEffect, useState, type RefObject } from 'react'

/** Subpixel tolerance for scroll edge detection (see browser fractional scrollLeft). */
const SCROLL_EDGE_EPS = 2

export interface ShelfScrollAffordances {
  canScrollLeft: boolean
  canScrollRight: boolean
  /** True when content is wider than the viewport (horizontal scroll possible). */
  hasOverflow: boolean
  /** Re-read scroll metrics from the scroller (after layout, scroll, or content changes). */
  update: () => void
}

/**
 * Measures a horizontal scroller for arrow visibility and overflow.
 * Uses ResizeObserver on the scroller, plus image `load`/`error` listeners and a subtree
 * MutationObserver so affordances update when lazy-loaded covers widen content
 * without changing the scroller's layout box (ResizeObserver alone can miss that).
 *
 * @param contentKey — When this value changes (e.g. child count), subscriptions are reset.
 */
export function useShelfScrollAffordances(
  scrollerRef: RefObject<HTMLElement | null>,
  contentKey: number | string
): ShelfScrollAffordances {
  const [affordances, setAffordances] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    hasOverflow: false,
  })

  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    const left = el.scrollLeft
    const eps = SCROLL_EDGE_EPS
    setAffordances({
      hasOverflow: maxScrollLeft > 0.5,
      canScrollLeft: left > eps,
      canScrollRight: left < maxScrollLeft - eps,
    })
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

    const boundImages = new Set<HTMLImageElement>()
    const onImageLayout = () => update()

    const bindImageLoads = (root: HTMLElement) => {
      for (const img of [...boundImages]) {
        if (!root.contains(img)) {
          img.removeEventListener('load', onImageLayout)
          img.removeEventListener('error', onImageLayout)
          boundImages.delete(img)
        }
      }
      root.querySelectorAll('img').forEach((node) => {
        if (!(node instanceof HTMLImageElement)) return
        if (boundImages.has(node)) return
        boundImages.add(node)
        node.addEventListener('load', onImageLayout, { passive: true })
        node.addEventListener('error', onImageLayout, { passive: true })
        if (node.complete) update()
      })
    }

    bindImageLoads(el)

    const mo = new MutationObserver(() => {
      bindImageLoads(el)
      update()
    })
    mo.observe(el, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ro.disconnect()
      boundImages.forEach((img) => {
        img.removeEventListener('load', onImageLayout)
        img.removeEventListener('error', onImageLayout)
      })
      boundImages.clear()
    }
  }, [update, contentKey])

  return { ...affordances, update }
}
