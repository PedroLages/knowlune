/**
 * HighlightLayer — manages epub.js text selection and highlight overlays.
 *
 * Responsibilities:
 * - Listen for epub.js `selected` event to detect text selection
 * - Show HighlightPopover with color / note / flashcard actions
 * - Create BookHighlight records in Dexie via useHighlightStore
 * - Apply highlight overlays via rendition.annotations.highlight()
 * - Restore existing highlights for the book on rendition ready
 * - Detect iOS Safari text selection limitations (upstream epub.js bug)
 *
 * Color mapping (0.3 opacity, multiply blend):
 *   yellow → #FFEB3B, green → #4CAF50, blue → #42A5F5, pink → #EC407A
 *
 * @module HighlightLayer
 */
import { useEffect, useState, useCallback } from 'react'
import type { Rendition } from 'epubjs'
import { toast } from 'sonner'
import { useHighlightStore } from '@/stores/useHighlightStore'
import { HighlightPopover } from '@/app/components/reader/HighlightPopover'
import type { HighlightPosition } from '@/app/components/reader/HighlightPopover'
import type { BookHighlight, HighlightColor } from '@/data/types'

/** Hex color values per highlight color key */
const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FF9800',
}

/** CSS styles applied to highlight annotations in the epub iframe */
function highlightStyles(color: HighlightColor): Record<string, string> {
  return {
    fill: HIGHLIGHT_HEX[color],
    'fill-opacity': '0.3',
    'mix-blend-mode': 'multiply',
  }
}

/** Detect iOS Safari where epub.js text selection is broken (upstream bug #904) */
function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  return isIos && isSafari
}

interface SelectionData {
  cfiRange: string
  text: string
  chapterHref: string
  textContext: { prefix: string; suffix: string }
  position: HighlightPosition
}

interface HighlightLayerProps {
  rendition: Rendition | null
  bookId: string
  currentHref?: string
  onFlashcardRequest?: (text: string, highlightId?: string) => void
}

export function HighlightLayer({
  rendition,
  bookId,
  currentHref,
  onFlashcardRequest,
}: HighlightLayerProps) {
  const createHighlight = useHighlightStore(s => s.createHighlight)
  const highlights = useHighlightStore(s => s.highlights)
  const loadHighlightsForBook = useHighlightStore(s => s.loadHighlightsForBook)

  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [showIosBanner, setShowIosBanner] = useState(false)

  // Load highlights for this book when rendition is ready
  useEffect(() => {
    if (!bookId) return
    loadHighlightsForBook(bookId).catch(() => {
      // silent-catch-ok: highlight load failure is non-fatal — reader still works
    })
  }, [bookId, loadHighlightsForBook])

  // Show iOS Safari informational banner
  useEffect(() => {
    if (isIosSafari()) {
      setShowIosBanner(true)
    }
  }, [])

  // Restore existing highlight overlays when rendition + highlights are ready
  useEffect(() => {
    if (!rendition || highlights.length === 0) return

    for (const highlight of highlights) {
      if (!highlight.cfiRange) continue
      try {
        rendition.annotations.highlight(
          highlight.cfiRange,
          { highlightId: highlight.id },
          undefined,
          'epub-highlight',
          highlightStyles(highlight.color)
        )
      } catch {
        // silent-catch-ok: CFI may be stale if EPUB was re-imported; text anchor fallback is E85-S02
      }
    }
  }, [rendition, highlights])

  // Register epub.js `selected` event listener
  useEffect(() => {
    if (!rendition) return

    const handleSelected = (
      cfiRange: string,
      contents: { window: Window }
    ) => {
      const win = contents.window
      const sel = win.getSelection()
      if (!sel || sel.isCollapsed) return

      const selectedText = sel.toString().trim()
      if (!selectedText) return

      // Get bounding rect for popover positioning
      let popoverPosition: HighlightPosition = { top: 0, left: 0, width: 0 }
      try {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        // Convert iframe coordinates to window coordinates
        const iframe = rendition.getContents()[0] as unknown as { iframe?: HTMLIFrameElement }
        const iframeRect = iframe.iframe?.getBoundingClientRect() ?? { top: 0, left: 0 }
        popoverPosition = {
          top: iframeRect.top + rect.top,
          left: iframeRect.left + rect.left,
          width: rect.width,
          below: iframeRect.top + rect.top < 60, // not enough space above header
        }
      } catch {
        // silent-catch-ok: position estimation failure — use default position
        popoverPosition = { top: 100, left: window.innerWidth / 2 - 100, width: 200 }
      }

      // Extract prefix/suffix context (30 chars each)
      let prefix = ''
      let suffix = ''
      try {
        const bodyText = win.document.body.textContent ?? ''
        const idx = bodyText.indexOf(selectedText)
        if (idx >= 0) {
          prefix = bodyText.substring(Math.max(0, idx - 30), idx)
          suffix = bodyText.substring(idx + selectedText.length, idx + selectedText.length + 30)
        }
      } catch {
        // silent-catch-ok: context extraction is best-effort
      }

      setSelection({
        cfiRange,
        text: selectedText,
        chapterHref: currentHref ?? '',
        textContext: { prefix, suffix },
        position: popoverPosition,
      })
    }

    rendition.on('selected', handleSelected)
    return () => {
      rendition.off('selected', handleSelected)
    }
  }, [rendition, currentHref])

  /** Create highlight with the selected color */
  const handleColorSelect = useCallback(
    async (color: 'yellow' | 'green' | 'blue' | 'pink') => {
      if (!selection || !rendition) return

      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      const highlight: BookHighlight = {
        id,
        bookId,
        cfiRange: selection.cfiRange,
        textAnchor: selection.text,
        textContext: selection.textContext,
        chapterHref: selection.chapterHref,
        color,
        position: { type: 'cfi', value: selection.cfiRange },
        createdAt: now,
        updatedAt: now,
      }

      // Apply overlay in epub.js immediately (optimistic)
      try {
        rendition.annotations.highlight(
          selection.cfiRange,
          { highlightId: id },
          undefined,
          'epub-highlight',
          highlightStyles(color)
        )
      } catch {
        // silent-catch-ok: annotation failure is non-fatal
      }

      // Clear selection in epub iframe
      try {
        const contents = rendition.getContents()
        for (const content of contents) {
          const win = (content as unknown as { window?: Window }).window
          win?.getSelection()?.removeAllRanges()
        }
      } catch {
        // silent-catch-ok
      }

      setSelection(null)

      // Persist to Dexie
      try {
        await createHighlight(highlight)
      } catch {
        // Rollback annotation if persist fails
        // silent-catch-ok: inner annotation removal failure is non-fatal
        try { rendition.annotations.remove(selection.cfiRange) } catch { /* silent-catch-ok */ }
        toast.error('Failed to save highlight')
      }
    },
    [selection, rendition, bookId, createHighlight]
  )

  const handleNote = useCallback(() => {
    // Save highlight with yellow default, then open note (E85-S02)
    if (selection) {
      // silent-catch-ok: note initiation failure falls back gracefully
      handleColorSelect('yellow').catch(() => { /* silent-catch-ok */ })
    }
  }, [selection, handleColorSelect])

  const handleFlashcard = useCallback(() => {
    if (!selection) return
    setSelection(null)
    onFlashcardRequest?.(selection.text)
  }, [selection, onFlashcardRequest])

  const handleClose = useCallback(() => {
    setSelection(null)
    // Clear selection in epub iframe
    if (rendition) {
      try {
        const contents = rendition.getContents()
        for (const content of contents) {
          const win = (content as unknown as { window?: Window }).window
          win?.getSelection()?.removeAllRanges()
        }
      } catch { /* silent-catch-ok */ }
    }
  }, [rendition])

  return (
    <>
      {/* iOS Safari text selection limitation banner */}
      {showIosBanner && (
        <div
          className="fixed top-12 left-0 right-0 z-[55] bg-warning/10 border-b border-warning/30 px-4 py-2.5 flex items-center justify-between gap-2"
          role="alert"
          data-testid="ios-tts-banner"
        >
          <p className="text-xs text-warning-foreground leading-snug">
            Text selection is limited on iOS Safari. For best highlighting experience, use Chrome on desktop or Android.
          </p>
          <button
            onClick={() => setShowIosBanner(false)}
            aria-label="Dismiss"
            className="text-warning hover:text-warning-foreground shrink-0 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Highlight action popover */}
      {selection && (
        <HighlightPopover
          position={selection.position}
          onColorSelect={handleColorSelect}
          onNote={handleNote}
          onFlashcard={handleFlashcard}
          onClose={handleClose}
        />
      )}
    </>
  )
}
