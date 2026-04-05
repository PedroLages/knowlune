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
import { useRef, useEffect, useCallback, useState } from 'react'
import { EpubView } from 'react-reader'
import type { Rendition } from 'epubjs'
import type { NavItem } from 'epubjs'
import { useReaderStore } from '@/stores/useReaderStore'

/** Reader theme backgrounds applied to the EPUB iframe */
const READER_THEME_STYLES: Record<string, { background: string; color: string }> = {
  light: { background: '#FAF5EE', color: '#1a1a1a' },
  sepia: { background: '#F4ECD8', color: '#3a2a1a' },
  dark: { background: '#1a1a1a', color: '#d4d4d4' },
}

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
  const renditionRef = useRef<Rendition | null>(null)

  // Page turn direction for animation class
  const [pageTurnDirection, setPageTurnDirection] = useState<'left' | 'right' | null>(null)

  // Swipe tracking
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null)

  /** Apply current theme + font settings to epub.js rendition */
  const applyTheme = useCallback(
    (rendition: Rendition) => {
      const themeStyles = READER_THEME_STYLES[theme] ?? READER_THEME_STYLES.light
      const fontFamilyMap: Record<string, string> = {
        default: 'inherit',
        serif: 'Georgia, "Times New Roman", serif',
        sans: 'system-ui, -apple-system, sans-serif',
        mono: '"Courier New", Courier, monospace',
      }

      // Apply theme via rendition.themes.default() which accepts a CSS rules object
      rendition.themes.default({
        body: {
          background: themeStyles.background,
          color: themeStyles.color,
          'font-size': `${fontSize}%`,
          'line-height': String(lineHeight),
          'font-family': fontFamilyMap[fontFamily] ?? 'inherit',
        },
      })
    },
    [theme, fontSize, fontFamily, lineHeight]
  )

  /** Store rendition ref and apply initial theme */
  const handleGetRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition
      applyTheme(rendition)
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

  /** Navigate to previous page */
  const navigatePrev = useCallback(() => {
    if (!renditionRef.current) return
    setPageTurnDirection('right')
    renditionRef.current.prev().catch(() => {
      // silent-catch-ok: at first page, prev() is a no-op
    })
    setTimeout(() => setPageTurnDirection(null), 250)
  }, [])

  /** Navigate to next page */
  const navigateNext = useCallback(() => {
    if (!renditionRef.current) return
    setPageTurnDirection('left')
    renditionRef.current.next().catch(() => {
      // silent-catch-ok: at last page, next() is a no-op
    })
    setTimeout(() => setPageTurnDirection(null), 250)
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

  return (
    <div
      className={`relative h-full w-full ${animationClass}`}
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
        epubOptions={{
          // Use default (non-continuous) manager for performance (AC1 NFR1)
          allowPopups: false,
        }}
        loadingView={
          <div className="flex h-full items-center justify-center">
            <div
              className="size-8 animate-spin rounded-full border-4 border-muted border-t-brand"
              aria-hidden="true"
            />
          </div>
        }
      />

      {/* Interaction zones overlaid on epub content */}
      {/* Left zone (prev) — 33% */}
      <div
        className="absolute inset-y-0 left-0 w-[33%] cursor-pointer"
        onClick={navigatePrev}
        role="button"
        tabIndex={-1}
        aria-label="Previous page"
        data-reader-zone="prev"
      />

      {/* Center zone (34%) — toggle header/footer visibility */}
      <div
        className="absolute inset-y-0 left-[33%] w-[34%] cursor-pointer"
        onClick={toggleHeader}
        role="button"
        tabIndex={-1}
        aria-label="Toggle reader controls"
        data-reader-zone="toggle"
      />

      {/* Right zone (next) — 33% */}
      <div
        className="absolute inset-y-0 right-0 w-[33%] cursor-pointer"
        onClick={navigateNext}
        role="button"
        tabIndex={-1}
        aria-label="Next page"
        data-reader-zone="next"
      />

      {/* Live region for page change announcements (accessibility) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="reader-page-announce" />
    </div>
  )
}
