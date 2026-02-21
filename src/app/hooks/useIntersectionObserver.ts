import { RefObject, useEffect, useState } from 'react'

export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit
): boolean {
  // Initialize as intersecting (visible) to avoid flash of mini-player on mount
  const [isIntersecting, setIsIntersecting] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      options
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, options])

  return isIntersecting
}
