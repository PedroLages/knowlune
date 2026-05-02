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
// eslint-disable-next-line component-size/max-lines -- manages multiple epub.js event subsystems: selection, overlay restoration, mini-popover, annotation callbacks
import { useEffect, useState, useCallback, useRef } from 'react'
import type { Rendition } from 'epubjs'
import { toast } from 'sonner'
import { useHighlightStore } from '@/stores/useHighlightStore'
import {
  HighlightPopover,
  HIGHLIGHT_TOOLBAR_SELECTION_GAP_PX,
} from '@/app/components/reader/HighlightPopover'
import {
  HighlightMiniPopover,
  type HighlightMiniPopoverAnchor,
} from '@/app/components/reader/HighlightMiniPopover'
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
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  return isIos && isSafari
}

/** Map iframe-local selection rects to viewport using the iframe that owns `contents`. */
function getIframeViewportOffset(
  rendition: Rendition,
  contents: { window: Window }
): { top: number; left: number } {
  const frame = contents.window.frameElement as HTMLIFrameElement | null
  if (frame) {
    const r = frame.getBoundingClientRect()
    return { top: r.top, left: r.left }
  }
  const list = rendition.getContents() as unknown as Array<{ window?: Window; iframe?: HTMLIFrameElement }>
  for (const c of list) {
    if (c.window === contents.window && c.iframe) {
      const r = c.iframe.getBoundingClientRect()
      return { top: r.top, left: r.left }
    }
  }
  const fb = list[0]?.iframe?.getBoundingClientRect()
  return { top: fb?.top ?? 0, left: fb?.left ?? 0 }
}

/** Map mouse client coords from the EPUB iframe to the app viewport (for position:fixed UI). */
function mouseEventToMainViewport(e: MouseEvent): { top: number; left: number } {
  const view = e.view
  if (view && view !== window && view.frameElement) {
    const r = view.frameElement.getBoundingClientRect()
    return { top: e.clientY + r.top, left: e.clientX + r.left }
  }
  return { top: e.clientY, left: e.clientX }
}

/**
 * Anchor for the mini popover: prefer the tapped highlight segment rect (center + vertical span),
 * converted to the shell viewport; fallback to the pointer in main viewport.
 */
function annotationClickToMainViewportAnchor(e: MouseEvent): HighlightMiniPopoverAnchor {
  const view = e.view
  const frame = view && view !== window ? view.frameElement : null
  const frameRect = frame?.getBoundingClientRect()
  const offsetTop = frameRect?.top ?? 0
  const offsetLeft = frameRect?.left ?? 0

  const t = e.target
  if (t instanceof Element) {
    const r = t.getBoundingClientRect()
    return {
      centerX: offsetLeft + r.left + r.width / 2,
      top: offsetTop + r.top,
      bottom: offsetTop + r.bottom,
    }
  }
  const p = mouseEventToMainViewport(e)
  return { centerX: p.left, top: p.top, bottom: p.top }
}

interface SelectionData {
  cfiRange: string
  text: string
  chapterHref: string
  textContext: { prefix: string; suffix: string }
  position: HighlightPosition
  existingHighlightId?: string
}

interface MiniPopoverState {
  highlight: BookHighlight
  anchor: HighlightMiniPopoverAnchor
  initialMode?: 'view' | 'edit' | 'confirm-delete'
}

interface HighlightLayerProps {
  rendition: Rendition | null
  bookId: string
  currentHref?: string
  onFlashcardRequest?: (text: string, highlightId?: string) => void
  onLinkedFlashcardRequest?: (highlight: BookHighlight) => void
  onVocabularyRequest?: (text: string, context?: string) => void
  /** If set, briefly pulse this highlight after restore (E85-S05 back-navigation) */
  focusHighlightId?: string
}

export function HighlightLayer({
  rendition,
  bookId,
  currentHref,
  onFlashcardRequest,
  onLinkedFlashcardRequest,
  onVocabularyRequest,
  focusHighlightId,
}: HighlightLayerProps) {
  const createHighlight = useHighlightStore(s => s.createHighlight)
  const updateHighlight = useHighlightStore(s => s.updateHighlight)
  const deleteHighlight = useHighlightStore(s => s.deleteHighlight)
  const highlights = useHighlightStore(s => s.highlights)
  const loadHighlightsForBook = useHighlightStore(s => s.loadHighlightsForBook)
  // Keep a ref to highlights for use inside epub.js callbacks (closure capture)
  const highlightsRef = useRef(highlights)
  useEffect(() => {
    highlightsRef.current = highlights
  }, [highlights])

  const currentHrefRef = useRef(currentHref)
  useEffect(() => {
    currentHrefRef.current = currentHref
  }, [currentHref])

  const [selection, setSelection] = useState<SelectionData | null>(null)
  const [miniPopover, setMiniPopover] = useState<MiniPopoverState | null>(null)
  const [showIosBanner, setShowIosBanner] = useState(false)

  const selectionToMiniAnchor = useCallback((position: HighlightPosition): HighlightMiniPopoverAnchor => {
    const top = position.below ? position.top + HIGHLIGHT_TOOLBAR_SELECTION_GAP_PX : position.top
    return {
      centerX: position.left + position.width / 2,
      top,
      bottom: top,
    }
  }, [])

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
        // epub.js `add`/`highlight` replaces the map entry but does not detach the prior
        // Annotation's DOM. Re-running this effect after deletes would orphan overlays.
        rendition.annotations.remove(highlight.cfiRange, 'highlight')
        // Annotation callback fires when user taps/clicks the highlight overlay
        rendition.annotations.highlight(
          highlight.cfiRange,
          { highlightId: highlight.id },
          (e: MouseEvent) => {
            // Find current highlight from ref (not stale closure)
            const h = highlightsRef.current.find(x => x.id === highlight.id)
            if (!h) return
            setSelection(null)
            setMiniPopover({
              highlight: h,
              anchor: annotationClickToMainViewportAnchor(e),
            })
          },
          'epub-highlight',
          highlightStyles(highlight.color)
        )
      } catch {
        // silent-catch-ok: CFI may be stale if EPUB was re-imported
      }
    }

    // Pulse the focused highlight after restore (E85-S05 back-navigation emphasis)
    // Respects prefers-reduced-motion: skips animation when reduced motion is preferred
    if (!focusHighlightId) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const targetHighlight = highlights.find(h => h.id === focusHighlightId)
    if (!targetHighlight?.cfiRange) return

    // Inject keyframe + flash class into the epub iframe document
    const injectPulse = () => {
      try {
        const contents = (rendition.getContents() as unknown as Array<{ document?: Document }>)[0]
        const doc = contents?.document
        if (!doc) return

        // Inject keyframe animation if not already present
        if (!doc.getElementById('hl-pulse-style')) {
          const style = doc.createElement('style')
          style.id = 'hl-pulse-style'
          style.textContent = `
            @keyframes hl-pulse {
              0%   { fill-opacity: 0.3; }
              40%  { fill-opacity: 0.7; }
              100% { fill-opacity: 0.3; }
            }
            .epub-highlight-pulse rect, .epub-highlight-pulse path {
              animation: hl-pulse 800ms ease-out forwards;
            }
          `
          doc.head.appendChild(style)
        }

        // Find the annotation element by data-epubcfi attribute
        const annotEl = doc.querySelector(`[data-epubcfi]`)
        if (annotEl) {
          annotEl.classList.add('epub-highlight-pulse')
          setTimeout(() => annotEl.classList.remove('epub-highlight-pulse'), 900)
        }
      } catch {
        // silent-catch-ok: pulse is cosmetic; failure is non-fatal
      }
    }

    // Delay slightly to ensure epub.js has rendered the annotation after display()
    const timer = setTimeout(injectPulse, 600)
    return () => clearTimeout(timer)
  }, [rendition, highlights, focusHighlightId])

  // Register epub.js `selected` event listener
  useEffect(() => {
    if (!rendition) return

    const handleSelected = (cfiRange: string, contents: { window: Window }) => {
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
        const iframeRect = getIframeViewportOffset(rendition, contents)
        const topInViewport = iframeRect.top + rect.top
        const leftInViewport = iframeRect.left + rect.left
        popoverPosition = {
          top: topInViewport,
          left: leftInViewport,
          width: rect.width,
          below: topInViewport < 60, // not enough space above header
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

      const normalizedSelectedText = selectedText.replace(/\s+/g, ' ').trim()
      const existingHighlight = highlightsRef.current.find(h => {
        const sameCfi = h.cfiRange === cfiRange
        const sameChapter = !h.chapterHref || h.chapterHref === currentHrefRef.current
        const sameText = h.textAnchor.replace(/\s+/g, ' ').trim() === normalizedSelectedText
        return sameCfi || (sameChapter && sameText)
      })

      setSelection({
        cfiRange,
        text: selectedText,
        chapterHref: currentHrefRef.current ?? '',
        textContext: { prefix, suffix },
        position: popoverPosition,
        existingHighlightId: existingHighlight?.id,
      })
    }

    rendition.on('selected', handleSelected)
    return () => {
      rendition.off('selected', handleSelected)
    }
  }, [rendition])

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
      // Store highlight ref for the callback closure
      const capturedId = id
      try {
        rendition.annotations.remove(selection.cfiRange, 'highlight')
        rendition.annotations.highlight(
          selection.cfiRange,
          { highlightId: capturedId },
          (e: MouseEvent) => {
            const h = highlightsRef.current.find(x => x.id === capturedId)
            if (!h) return
            setSelection(null)
            setMiniPopover({ highlight: h, anchor: annotationClickToMainViewportAnchor(e) })
          },
          'epub-highlight',
          highlightStyles(color)
        )
      } catch {
        // silent-catch-ok: annotation failure is non-fatal
      }

      // Clear selection in epub iframe
      try {
        const contents = rendition.getContents() as unknown as Array<{ window?: Window }>
        for (const content of contents) {
          content.window?.getSelection()?.removeAllRanges()
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
        try {
          rendition.annotations.remove(selection.cfiRange, 'highlight')
        } catch {
          /* silent-catch-ok */
        }
        toast.error('Failed to save highlight')
      }
    },
    [selection, rendition, bookId, createHighlight]
  )

  const handleNote = useCallback(() => {
    if (!selection || !rendition) return

    const clearIframeSelection = () => {
      try {
        const contents = rendition.getContents() as unknown as Array<{ window?: Window }>
        for (const content of contents) {
          content.window?.getSelection()?.removeAllRanges()
        }
      } catch {
        /* silent-catch-ok */
      }
    }

    const existingHighlight = selection.existingHighlightId
      ? highlightsRef.current.find(h => h.id === selection.existingHighlightId)
      : undefined
    if (existingHighlight) {
      clearIframeSelection()
      setSelection(null)
      setMiniPopover({
        highlight: existingHighlight,
        anchor: selectionToMiniAnchor(selection.position),
        initialMode: 'edit',
      })
      return
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const highlight: BookHighlight = {
      id,
      bookId,
      cfiRange: selection.cfiRange,
      textAnchor: selection.text,
      textContext: selection.textContext,
      chapterHref: selection.chapterHref,
      color: 'yellow',
      position: { type: 'cfi', value: selection.cfiRange },
      createdAt: now,
      updatedAt: now,
    }

    try {
      rendition.annotations.remove(selection.cfiRange, 'highlight')
      rendition.annotations.highlight(
        selection.cfiRange,
        { highlightId: id },
        (e: MouseEvent) => {
          const h = highlightsRef.current.find(x => x.id === id)
          if (!h) return
          setSelection(null)
          setMiniPopover({ highlight: h, anchor: annotationClickToMainViewportAnchor(e) })
        },
        'epub-highlight',
        highlightStyles('yellow')
      )
    } catch {
      // silent-catch-ok: annotation failure is non-fatal
    }

    clearIframeSelection()
    setSelection(null)

    createHighlight(highlight)
      .then(() => {
        setMiniPopover({
          highlight,
          anchor: selectionToMiniAnchor(selection.position),
          initialMode: 'edit',
        })
      })
      .catch(() => {
        try {
          rendition.annotations.remove(selection.cfiRange, 'highlight')
        } catch {
          /* silent-catch-ok */
        }
        toast.error('Failed to save highlight')
      })
  }, [selection, rendition, bookId, createHighlight, selectionToMiniAnchor])

  const handleFlashcard = useCallback(() => {
    if (!selection) return
    setSelection(null)
    onFlashcardRequest?.(selection.text, selection.existingHighlightId)
  }, [selection, onFlashcardRequest])

  const handleVocabulary = useCallback(() => {
    if (!selection) return
    setSelection(null)
    onVocabularyRequest?.(selection.text)
  }, [selection, onVocabularyRequest])

  const handleSelectionHighlightDelete = useCallback(async () => {
    if (!selection?.existingHighlightId || !rendition) return
    const highlight = highlightsRef.current.find(h => h.id === selection.existingHighlightId)
    if (!highlight) return

    if (highlight.cfiRange) {
      try {
        rendition.annotations.remove(highlight.cfiRange, 'highlight')
      } catch {
        // silent-catch-ok: annotation removal failure is non-fatal
      }
    }

    setSelection(null)
    await deleteHighlight(highlight.id)
  }, [selection, rendition, deleteHighlight])

  /** Update an existing highlight (color + note) — remove+re-add annotation for color change */
  const handleMiniUpdate = useCallback(
    async (updates: Partial<Pick<BookHighlight, 'color' | 'note'>>) => {
      if (!miniPopover || !rendition) return
      const { highlight } = miniPopover

      // If color changed, remove old annotation and re-add with new color
      if (updates.color && updates.color !== highlight.color && highlight.cfiRange) {
        try {
          rendition.annotations.remove(highlight.cfiRange, 'highlight')
        } catch {
          // silent-catch-ok: annotation removal failure is non-fatal
        }
        const newColor = updates.color
        const capturedId = highlight.id
        try {
          rendition.annotations.highlight(
            highlight.cfiRange,
            { highlightId: capturedId },
            (e: MouseEvent) => {
              const h = highlightsRef.current.find(x => x.id === capturedId)
              if (!h) return
              setSelection(null)
              setMiniPopover({ highlight: h, anchor: annotationClickToMainViewportAnchor(e) })
            },
            'epub-highlight',
            highlightStyles(newColor)
          )
        } catch {
          // silent-catch-ok: annotation re-add failure is non-fatal
        }
      }

      await updateHighlight(highlight.id, updates)
    },
    [miniPopover, rendition, updateHighlight]
  )

  /** Delete an existing highlight — remove annotation and Dexie record */
  const handleMiniDelete = useCallback(async () => {
    if (!miniPopover || !rendition) return
    const { highlight } = miniPopover

    // Remove epub.js annotation
    if (highlight.cfiRange) {
      try {
        rendition.annotations.remove(highlight.cfiRange, 'highlight')
      } catch {
        // silent-catch-ok: annotation removal failure is non-fatal
      }
    }

    await deleteHighlight(highlight.id)
  }, [miniPopover, rendition, deleteHighlight])

  const handleClose = useCallback(() => {
    setSelection(null)
    // Clear selection in epub iframe
    if (rendition) {
      try {
        const contents = rendition.getContents() as unknown as Array<{ window?: Window }>
        for (const content of contents) {
          content.window?.getSelection()?.removeAllRanges()
        }
      } catch {
        /* silent-catch-ok */
      }
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
            Text selection is limited on iOS Safari. For best highlighting experience, use Chrome on
            desktop or Android.
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

      {/* Highlight action popover (new selection) */}
      {selection && (
        <HighlightPopover
          position={selection.position}
          onColorSelect={handleColorSelect}
          onNote={handleNote}
          onFlashcard={handleFlashcard}
          onVocabulary={onVocabularyRequest ? handleVocabulary : undefined}
          onDeleteHighlight={
            selection.existingHighlightId
              ? () => {
                  handleSelectionHighlightDelete().catch(() => {
                    toast.error('Failed to delete highlight')
                  })
                }
              : undefined
          }
          onClose={handleClose}
        />
      )}

      {/* Mini-popover for existing highlight tap (E85-S02) */}
      {miniPopover && (
        <HighlightMiniPopover
          highlight={miniPopover.highlight}
          anchor={miniPopover.anchor}
          initialMode={miniPopover.initialMode}
          onClose={() => setMiniPopover(null)}
          onUpdate={handleMiniUpdate}
          onDelete={handleMiniDelete}
          onCreateFlashcard={() => {
            setMiniPopover(null)
            onFlashcardRequest?.(miniPopover.highlight.textAnchor, miniPopover.highlight.id)
          }}
          onViewFlashcard={() => {
            setMiniPopover(null)
            onLinkedFlashcardRequest?.(miniPopover.highlight)
          }}
          onVocabulary={
            onVocabularyRequest
              ? () => {
                  setMiniPopover(null)
                  onVocabularyRequest(miniPopover.highlight.textAnchor)
                }
              : undefined
          }
        />
      )}
    </>
  )
}
