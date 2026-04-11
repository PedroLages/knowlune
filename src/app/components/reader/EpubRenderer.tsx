/**
 * EpubRenderer — wraps react-reader's EpubView for EPUB content display.
 *
 * Responsibilities:
 * - Renders EPUB content via EpubView (epub.js wrapper)
 * - Applies reading theme via rendition.themes.default()
 * - Exposes rendition ref for navigation/highlights in later stories
 * - Manages interaction zones: left (prev), center (toggle UI), right (next)
 * - Swipe gesture detection (50px threshold)
 * - Keyboard navigation (Left/Right/Space) — wired in BookReader
 *
 * @module EpubRenderer
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { EpubView } from 'react-reader'
import { cn } from '@/app/components/ui/utils'
import type { Rendition } from 'epubjs'
import type { NavItem } from 'epubjs'
import { useReaderStore } from '@/stores/useReaderStore'
import {
  getReaderThemeColors,
  getReaderChromeClasses,
  useAppColorScheme,
} from './readerThemeConfig'

/** Minimum horizontal swipe distance to trigger page turn */
const SWIPE_THRESHOLD_PX = 50

interface EpubRendererProps {
  /** Blob URL or ArrayBuffer for the EPUB file */
  url: string | ArrayBuffer
  /** Initial CFI location or null for start */
  initialLocation: string | null
  /** Called when location changes (CFI string) */
  onLocationChanged: (cfi: string) => void
  /** Called when TOC is loaded */
  onTocLoaded?: (toc: NavItem[]) => void
  /** Called when rendition is ready (for parent to store ref) */
  onRenditionReady?: (rendition: Rendition) => void
}

export function EpubRenderer({
  url,
  initialLocation,
  onLocationChanged,
  onTocLoaded,
  onRenditionReady,
}: EpubRendererProps) {
  const theme = useReaderStore(s => s.theme)
  const fontSize = useReaderStore(s => s.fontSize)
  const fontFamily = useReaderStore(s => s.fontFamily)
  const lineHeight = useReaderStore(s => s.lineHeight)
  const toggleHeader = useReaderStore(s => s.toggleHeader)
  const colorScheme = useAppColorScheme()
  const renditionRef = useRef<Rendition | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Track when rendition is ready for ResizeObserver binding
  const [renditionReady, setRenditionReady] = useState(false)

  // Page turn direction for animation class
  const [pageTurnDirection, setPageTurnDirection] = useState<'left' | 'right' | null>(null)

  // Swipe tracking
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null)

  // Timer ref for page turn animation reset (cleared on unmount to avoid setState after unmount)
  const pageTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Apply current theme + font settings to epub.js rendition */
  const applyTheme = useCallback(
    (rendition: Rendition) => {
      const themeColors = getReaderThemeColors(theme, colorScheme)
      const fontFamilyMap: Record<string, string> = {
        default: 'inherit',
        serif: 'Georgia, "Times New Roman", serif',
        sans: 'system-ui, -apple-system, sans-serif',
        mono: '"Courier New", Courier, monospace',
      }

      // Apply theme via rendition.themes.default() which accepts a CSS rules object
      rendition.themes.default({
        body: {
          background: themeColors.background,
          color: themeColors.foreground,
          'font-size': `${fontSize}%`,
          'line-height': String(lineHeight),
          'font-family': fontFamilyMap[fontFamily] ?? 'inherit',
        },
      })
    },
    [theme, colorScheme, fontSize, fontFamily, lineHeight]
  )

  /** Store rendition ref and apply initial theme */
  const handleGetRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition
      applyTheme(rendition)
      setRenditionReady(true)
      onRenditionReady?.(rendition)
    },
    [applyTheme, onRenditionReady]
  )

  /** Re-apply theme when settings change */
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current)
    }
  }, [applyTheme])

  /** Clear page turn animation timer on unmount to avoid setState after unmount */
  useEffect(() => {
    return () => {
      if (pageTurnTimerRef.current !== null) {
        clearTimeout(pageTurnTimerRef.current)
      }
    }
  }, [])

  /** Resize epub.js rendition when container dimensions change (Bug 1 fix — AC-1, AC-2) */
  useEffect(() => {
    const container = containerRef.current
    if (!container || !renditionReady) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      // Read from ref in callback to avoid capturing stale rendition at setup time
      if (width > 0 && height > 0 && renditionRef.current) {
        renditionRef.current.resize(width, height)
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [renditionReady])

  /** Navigate to previous page */
  const navigatePrev = useCallback(() => {
    if (!renditionRef.current) return
    setPageTurnDirection('right')
    renditionRef.current.prev().catch(() => {
      // silent-catch-ok: at first page, prev() is a no-op
    })
    if (pageTurnTimerRef.current !== null) clearTimeout(pageTurnTimerRef.current)
    pageTurnTimerRef.current = setTimeout(() => setPageTurnDirection(null), 250)
  }, [])

  /** Navigate to next page */
  const navigateNext = useCallback(() => {
    if (!renditionRef.current) return
    setPageTurnDirection('left')
    renditionRef.current.next().catch(() => {
      // silent-catch-ok: at last page, next() is a no-op
    })
    if (pageTurnTimerRef.current !== null) clearTimeout(pageTurnTimerRef.current)
    pageTurnTimerRef.current = setTimeout(() => setPageTurnDirection(null), 250)
  }, [])

  /** Touch start — record start position for swipe detection */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    swipeTouchStart.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  /** Touch end — detect horizontal swipe and navigate */
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeTouchStart.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - swipeTouchStart.current.x
      const dy = touch.clientY - swipeTouchStart.current.y
      swipeTouchStart.current = null

      // Only horizontal swipes (|dx| > threshold AND |dx| > |dy| to avoid vertical scroll conflicts)
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return

      if (dx < 0) {
        navigateNext() // Swipe left → next page
      } else {
        navigatePrev() // Swipe right → prev page
      }
    },
    [navigateNext, navigatePrev]
  )

  // Animation class for page turn direction (respects prefers-reduced-motion)
  const animationClass =
    pageTurnDirection === 'left'
      ? 'motion-safe:animate-[slide-left_200ms_ease-out]'
      : pageTurnDirection === 'right'
        ? 'motion-safe:animate-[slide-right_200ms_ease-out]'
        : ''

  // Container background matching the active reader theme + app color scheme
  const chromeClasses = getReaderChromeClasses(theme, colorScheme)
  const containerBg = chromeClasses.bg

  // Memoize epubOptions to prevent unnecessary re-renders (Bug 3 fix — AC-4)
  const epubOptions = useMemo(
    () => ({
      spread: 'none' as const, // Force single-page layout on all screen widths (AC-4)
      flow: 'paginated' as const, // Explicit paginated flow for clarity
      allowPopups: false,
    }),
    []
  )

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full', containerBg, animationClass)}
      data-testid="epub-renderer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* epub.js content via react-reader EpubView */}
      <EpubView
        url={url}
        location={initialLocation}
        locationChanged={onLocationChanged}
        tocChanged={onTocLoaded}
        getRendition={handleGetRendition}
        epubOptions={epubOptions}
        loadingView={
          <div className="flex h-full items-center justify-center">
            <div
              className="size-8 animate-spin rounded-full border-4 border-muted border-t-brand"
              aria-hidden="true"
            />
          </div>
        }
      />

      {/* Interaction zones overlaid on epub content (Bug 4 fix — AC-5)
          Container uses pointer-events-none so epub.js iframe receives scroll/select events.
          Individual zones use pointer-events-auto to capture tap/click for navigation. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Left zone (prev) — 33% */}
        <div
          className="pointer-events-auto absolute inset-y-0 left-0 w-[33%] cursor-pointer"
          onClick={navigatePrev}
          role="button"
          tabIndex={-1}
          aria-label="Previous page"
          data-reader-zone="prev"
        />

        {/* Center zone (34%) — toggle header/footer visibility */}
        <div
          className="pointer-events-auto absolute inset-y-0 left-[33%] w-[34%] cursor-pointer"
          onClick={toggleHeader}
          role="button"
          tabIndex={-1}
          aria-label="Toggle reader controls"
          data-reader-zone="toggle"
        />

        {/* Right zone (next) — 33% */}
        <div
          className="pointer-events-auto absolute inset-y-0 right-0 w-[33%] cursor-pointer"
          onClick={navigateNext}
          role="button"
          tabIndex={-1}
          aria-label="Next page"
          data-reader-zone="next"
        />
      </div>

      {/* Live region for page change announcements (accessibility) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="reader-page-announce" />
    </div>
  )
}
