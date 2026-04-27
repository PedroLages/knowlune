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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useReaderStore } from '@/stores/useReaderStore'
import {
  getReaderThemeColors,
  getReaderChromeClasses,
} from './readerThemeConfig'
import { getReaderFontEpubStack } from './readerFontOptions'

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
  const letterSpacing = useReaderStore(s => s.letterSpacing)
  const wordSpacing = useReaderStore(s => s.wordSpacing)
  const scrollMode = useReaderStore(s => s.scrollMode)
  const dualPage = useReaderStore(s => s.dualPage)
  const toggleHeader = useReaderStore(s => s.toggleHeader)
  const renditionRef = useRef<Rendition | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

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
      const themeColors = getReaderThemeColors(theme)
      // Apply theme via rendition.themes.default() which accepts a CSS rules object
      const bodyStyles: Record<string, string> = {
        background: themeColors.background,
        color: themeColors.foreground,
        'font-size': `${fontSize}%`,
        'line-height': String(lineHeight),
        'font-family': getReaderFontEpubStack(fontFamily),
      }

      // Set spacing explicitly: use 'normal' when zero to reset any stale epub.js
      // styles that may have been applied by a previous non-zero value.
      bodyStyles['letter-spacing'] = letterSpacing > 0 ? `${letterSpacing}em` : 'normal'
      bodyStyles['word-spacing'] = wordSpacing > 0 ? `${wordSpacing}em` : 'normal'

      rendition.themes.default({
        body: bodyStyles,
      })
    },
    [theme, fontSize, fontFamily, lineHeight, letterSpacing, wordSpacing]
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

  /** Switch epub.js flow between paginated and scrolled-doc at runtime (E114-S02) */
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    const newFlow = scrollMode ? 'scrolled-doc' : 'paginated'
    rendition.flow(newFlow)
    // After flow change, resize to re-layout content
    const container = viewportRef.current
    if (container) {
      const { width, height } = container.getBoundingClientRect()
      if (width > 0 && height > 0) {
        rendition.resize(width, height)
      }
    }
    // Re-apply theme after flow switch — some epub.js versions reset theme styles on flow change
    applyTheme(rendition)
  }, [scrollMode, applyTheme])

  /** Switch epub.js spread between auto and none at runtime */
  useEffect(() => {
    const rendition = renditionRef.current
    if (!rendition) return
    const newSpread = !scrollMode && dualPage ? 'auto' : 'none'
    rendition.spread(newSpread)
    const container = viewportRef.current
    if (container) {
      const { width, height } = container.getBoundingClientRect()
      if (width > 0 && height > 0) {
        rendition.resize(width, height)
      }
    }
  }, [dualPage, scrollMode])

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
    const container = viewportRef.current
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

  // Container background matching the active reader Page Tone
  const chromeClasses = getReaderChromeClasses(theme)
  const containerBg = chromeClasses.bg
  const readerViewportClass = scrollMode
    ? 'max-w-[72ch]'
    : dualPage
      ? 'max-w-6xl'
      : 'max-w-[44rem]'

  // Memoize epubOptions — depends on scrollMode for flow switching (E114-S02)
  const epubOptions = useMemo(
    () => ({
      spread: (!scrollMode && dualPage ? 'auto' : 'none') as 'auto' | 'none',
      flow: scrollMode ? ('scrolled-doc' as const) : ('paginated' as const),
      allowPopups: false,
    }),
    [scrollMode, dualPage]
  )

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) toggleHeader()
      }}
      className={cn(
        'relative h-full w-full overflow-hidden px-6 pt-14 pb-20 sm:px-16 lg:px-24',
        containerBg,
        animationClass
      )}
      data-testid="epub-renderer"
      onTouchStart={scrollMode ? undefined : handleTouchStart}
      onTouchEnd={scrollMode ? undefined : handleTouchEnd}
    >
      <div
        ref={viewportRef}
        className={cn(
          'relative mx-auto h-full w-full transition-[max-width] duration-200 motion-reduce:transition-none',
          readerViewportClass
        )}
        data-testid="epub-viewport"
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
      </div>

      {/* Gutter page controls avoid covering selectable EPUB text. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {!scrollMode && (
          <div
            className="group pointer-events-auto absolute inset-y-0 left-0 hidden w-12 cursor-pointer sm:block sm:w-16 lg:w-20"
            onClick={navigatePrev}
            role="button"
            tabIndex={-1}
            aria-label="Previous page"
            data-reader-zone="prev"
          >
            <ChevronLeft
              className={cn(
                'pointer-events-none absolute left-3 top-1/2 size-8 -translate-y-1/2 text-foreground/30 transition-opacity duration-300 motion-reduce:transition-none',
                pageTurnDirection === 'right' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            />
          </div>
        )}

        {!scrollMode && (
          <div
            className="group pointer-events-auto absolute inset-y-0 right-0 hidden w-12 cursor-pointer sm:block sm:w-16 lg:w-20"
            onClick={navigateNext}
            role="button"
            tabIndex={-1}
            aria-label="Next page"
            data-reader-zone="next"
          >
            <ChevronRight
              className={cn(
                'pointer-events-none absolute right-3 top-1/2 size-8 -translate-y-1/2 text-foreground/30 transition-opacity duration-300 motion-reduce:transition-none',
                pageTurnDirection === 'left' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            />
          </div>
        )}
      </div>

      {/* Live region for page change announcements (accessibility) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="reader-page-announce" />
    </div>
  )
}
