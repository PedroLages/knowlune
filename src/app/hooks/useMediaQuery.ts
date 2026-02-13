import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  // Initialize with actual window state to prevent hydration mismatches
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)

    // Set initial value (in case useState didn't have window access)
    setMatches(media.matches)

    // Create event listener
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)

    // Modern browsers (deprecated addListener/removeListener removed)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [query])

  return matches
}

// Predefined breakpoint hooks following Tailwind CSS defaults
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 639px)")
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 640px) and (max-width: 1023px)")
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}
