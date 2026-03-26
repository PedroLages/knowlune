import { useRef, useState, useEffect } from 'react'

/**
 * Hook that uses IntersectionObserver to detect when an element enters the viewport.
 * Once visible, it stays visible (one-shot) to avoid layout thrashing.
 *
 * Used for lazy-loading thumbnails on course cards (E1B-S04 AC5).
 *
 * @param rootMargin - IntersectionObserver rootMargin (default: '200px' for pre-loading)
 * @returns [ref, isVisible] - Attach ref to the element, isVisible becomes true when in viewport
 */
export function useLazyVisible<T extends HTMLElement = HTMLElement>(
  rootMargin = '200px'
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || isVisible) return

    // Fallback for environments without IntersectionObserver (SSR, older browsers)
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, isVisible])

  return [ref, isVisible]
}
