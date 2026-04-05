/**
 * EpubRenderer — wraps react-reader's EpubView for EPUB content display.
 *
 * Responsibilities:
 * - Renders EPUB content via ReactReader (epub.js wrapper)
 * - Applies reading theme via rendition.themes.override()
 * - Exposes rendition ref for navigation/highlights in later stories
 * - Manages interaction zones: left (prev), center (toggle UI), right (next)
 *
 * @module EpubRenderer
 */
import { useRef, useEffect, useCallback } from 'react'
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

  return (
    <div className="relative h-full w-full" data-testid="epub-renderer">
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
      {/* Left zone (prev) — 33% — handled by E84-S02 */}
      <div
        className="absolute inset-y-0 left-0 w-[33%] cursor-pointer"
        aria-hidden="true"
        data-reader-zone="prev"
      />

      {/* Center zone (34%) — toggle header/footer visibility */}
      <div
        className="absolute inset-y-0 left-[33%] w-[34%] cursor-pointer"
        onClick={toggleHeader}
        aria-hidden="true"
        data-reader-zone="toggle"
      />

      {/* Right zone (next) — 33% — handled by E84-S02 */}
      <div
        className="absolute inset-y-0 right-0 w-[33%] cursor-pointer"
        aria-hidden="true"
        data-reader-zone="next"
      />
    </div>
  )
}
