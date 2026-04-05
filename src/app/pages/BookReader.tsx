/**
 * BookReader — full-viewport EPUB reader page.
 *
 * Route: /library/:bookId/read (registered in routes.tsx).
 * Full-screen layout — NOT nested inside the standard Layout component.
 *
 * Responsibilities:
 * - Load book from useBookStore by :bookId URL param
 * - Fetch EPUB content via BookContentService
 * - Render EpubRenderer (lazy-loaded) with loading skeleton
 * - Show ReaderHeader and ReaderFooter with auto-hide behavior
 * - Manage 3-second idle timeout for header/footer auto-hide
 * - Keyboard navigation (Left/Right/Space for page turns, Escape → library)
 * - TOC panel wired to ReaderHeader menu
 * - Chapter tracking updated from TOC + locationChanged callback
 * - Position persistence: debounced save to Dexie on location change
 * - Position restoration: resume from Book.currentPosition on open
 * - Update Book.lastOpenedAt on reader open
 *
 * @module BookReader
 */
// eslint-disable-next-line component-size/max-lines -- page orchestrator: coordinates reader subsystems (EPUB loading, position save, idle timer, keyboard nav, TOC, settings)
import { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router'
import type { Rendition } from 'epubjs'
import type { NavItem } from 'epubjs'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { useReaderStore } from '@/stores/useReaderStore'
import { bookContentService, RemoteEpubError } from '@/services/BookContentService'
import { ReaderHeader } from '@/app/components/reader/ReaderHeader'
import { ReaderFooter } from '@/app/components/reader/ReaderFooter'
import { ReaderErrorBoundary } from '@/app/components/reader/ReaderErrorBoundary'
import { TableOfContents } from '@/app/components/reader/TableOfContents'
import { ReaderSettingsPanel } from '@/app/components/reader/ReaderSettingsPanel'
import { TtsControlBar } from '@/app/components/reader/TtsControlBar'
import { HighlightLayer } from '@/app/components/reader/HighlightLayer'
import { HighlightListPanel } from '@/app/components/reader/HighlightListPanel'
import { ClozeFlashcardCreator } from '@/app/components/reader/ClozeFlashcardCreator'
import { useTts } from '@/app/hooks/useTts'
import { useReadingSession } from '@/app/hooks/useReadingSession'
import { appEventBus } from '@/lib/eventBus'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { getTimeReadToday } from '@/services/ReadingStatsService'
import { db } from '@/db/schema'
import type { ContentPosition } from '@/data/types'

// Lazy-loaded audiobook renderer — keeps audiobook code out of the initial bundle (NFR20)
const AudiobookRenderer = lazy(() =>
  import('@/app/components/audiobook/AudiobookRenderer').then(m => ({
    default: m.AudiobookRenderer,
  }))
)

// Code-split: epub.js + react-reader must NOT be in the initial bundle (architecture decision 12)
const EpubRenderer = lazy(() =>
  import('@/app/components/reader/EpubRenderer').then(m => ({ default: m.EpubRenderer }))
)

const IDLE_TIMEOUT_MS = 3000
const POSITION_SAVE_DEBOUNCE_MS = 500

function LoadingSkeleton({ message = 'Loading book...' }: { message?: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 bg-background"
      data-testid="reader-loading"
      role="status"
      aria-label={message}
    >
      <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const books = useBookStore(s => s.books)
  const isLoaded = useBookStore(s => s.isLoaded)
  const loadBooks = useBookStore(s => s.loadBooks)

  const headerVisible = useReaderStore(s => s.headerVisible)
  const setHeaderVisible = useReaderStore(s => s.setHeaderVisible)
  const currentChapter = useReaderStore(s => s.currentChapter)
  const setCurrentChapter = useReaderStore(s => s.setCurrentChapter)
  const readingProgress = useReaderStore(s => s.readingProgress)
  const setReadingProgress = useReaderStore(s => s.setReadingProgress)
  const setCurrentCfi = useReaderStore(s => s.setCurrentCfi)
  const theme = useReaderStore(s => s.theme)
  const tocOpen = useReaderStore(s => s.tocOpen)
  const setTocOpen = useReaderStore(s => s.setTocOpen)
  const settingsOpen = useReaderStore(s => s.settingsOpen)
  const setSettingsOpen = useReaderStore(s => s.setSettingsOpen)

  const [epubUrl, setEpubUrl] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // CFI resolved from sourceHighlightId query param (E85-S05 back-navigation)
  const [highlightCfi, setHighlightCfi] = useState<string | null>(null)
  // highlightsOpen state: wired to ReaderHeader → HighlightListPanel (E85-S03)
  const [highlightsOpen, setHighlightsOpen] = useState(false)
  // audiobookBookmarksOpen: controls BookmarkListPanel in AudiobookRenderer (E87-S04)
  const [audiobookBookmarksOpen, setAudiobookBookmarksOpen] = useState(false)
  // Cloze flashcard creator state (E85-S04)
  const [clozeText, setClozeText] = useState('')
  const [clozeHighlightId, setClozeHighlightId] = useState<string | undefined>(undefined)
  const [clozeOpen, setClozeOpen] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  // Remote EPUB cache fallback (E88-S03)
  const [hasCachedFallback, setHasCachedFallback] = useState(false)
  // Set to true once EPUB renders successfully — triggers reading session start (E85-S06)
  const [isEpubReady, setIsEpubReady] = useState(false)
  const [toc, setToc] = useState<NavItem[]>([])
  const [currentHref, setCurrentHref] = useState<string | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState<number | undefined>(undefined)
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined)

  const renditionRef = useRef<Rendition | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reading session tracking and streak integration (E85-S06)
  useReadingSession({ bookId: bookId ?? '', isReady: isEpubReady })

  // Daily reading goal celebration — check after each session ends (E86-S05)
  const checkDailyGoalMet = useReadingGoalStore(s => s.checkDailyGoalMet)
  useEffect(() => {
    const unsub = appEventBus.on('reading:session-ended', async () => {
      try {
        const secondsToday = await getTimeReadToday()
        const minutesToday = Math.floor(secondsToday / 60)
        const isNewlyMet = checkDailyGoalMet(minutesToday)
        if (isNewlyMet) {
          toast.success('Daily reading goal reached! ✓', { duration: 4000 })
        }
      } catch {
        // silent-catch-ok: goal check failure should not affect reading UX
      }
    })
    return unsub
  }, [checkDailyGoalMet])

  // TTS read-aloud integration (E84-S05)
  const {
    isTtsAvailable,
    isTtsPlaying,
    isTtsPaused,
    ttsRate,
    ttsCurrentChunk,
    ttsTotalChunks,
    startTts,
    stopTts,
    setTtsRate,
    toggleTts,
  } = useTts(renditionRef)

  // Load books if not yet loaded
  useEffect(() => {
    if (!isLoaded) {
      loadBooks().catch(() => toast.error('Failed to load library'))
    }
  }, [isLoaded, loadBooks])

  // Find book in store
  const book = books.find(b => b.id === bookId)

  // Update lastOpenedAt when reader opens (once book is found)
  useEffect(() => {
    if (!book || !bookId) return

    const now = new Date().toISOString()
    // Update in-memory state
    useBookStore.setState(state => ({
      books: state.books.map(b => (b.id === bookId ? { ...b, lastOpenedAt: now } : b)),
    }))
    // Persist to Dexie (best-effort, non-blocking)
    // silent-catch-ok: lastOpenedAt failure is non-fatal — sorting will use previous value
    db.books.update(bookId, { lastOpenedAt: now }).catch(err => {
      console.error('[BookReader] Failed to update lastOpenedAt:', err)
    })
  }, [bookId]) // Only run once on mount (bookId is stable for this page)

  // Resolve sourceHighlightId query param → cfiRange for back-navigation (E85-S05)
  useEffect(() => {
    const highlightId = searchParams.get('sourceHighlightId')
    if (!highlightId) return

    let ignore = false
    db.bookHighlights
      .get(highlightId)
      .then(highlight => {
        if (!ignore && highlight?.cfiRange) {
          setHighlightCfi(highlight.cfiRange)
        }
      })
      .catch(err => {
        // silent-catch-ok: highlight lookup failure is non-fatal — reader opens at saved position
        console.warn('[BookReader] Could not resolve sourceHighlightId to CFI:', err)
      })
    return () => {
      ignore = true
    }
  }, [searchParams])

  // Load EPUB content
  useEffect(() => {
    if (!book || book.format !== 'epub') return

    let cancelled = false
    setIsLoadingContent(true)
    setLoadError(null)
    setHasCachedFallback(false)

    // Revoke previous Blob URL to avoid memory leaks
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    bookContentService
      .getEpubContent(book)
      .then(arrayBuffer => {
        if (cancelled) return
        const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setEpubUrl(url)
        setIsLoadingContent(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        if (err instanceof RemoteEpubError) {
          console.error(`[BookReader] Remote EPUB error (${err.code}):`, err.message)
          toast.error(err.message)
          setLoadError(err.message)
          setHasCachedFallback(err.hasCachedVersion)
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error loading book'
          console.error('[BookReader] Failed to load EPUB:', message)
          toast.error('Failed to load book')
          setLoadError(message)
        }
        setIsLoadingContent(false)
      })

    return () => {
      cancelled = true
    }
  }, [book, retryKey])

  // Cleanup Blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      // Clear pending save timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Auto-hide header/footer after idle timeout
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    setHeaderVisible(true)
    idleTimerRef.current = setTimeout(() => {
      setHeaderVisible(false)
    }, IDLE_TIMEOUT_MS)
  }, [setHeaderVisible])

  useEffect(() => {
    // Start idle timer on mount
    resetIdleTimer()

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
    }
  }, [resetIdleTimer])

  // Keyboard navigation: Left/Right/Space for page turns, Escape → back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keyboard in inputs/textareas
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const rendition = renditionRef.current
      if (!rendition) return

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          rendition.next().catch(() => {
            // silent-catch-ok: at last page
          })
          break
        case 'ArrowLeft':
          e.preventDefault()
          rendition.prev().catch(() => {
            // silent-catch-ok: at first page
          })
          break
        case 'Escape':
          navigate('/library')
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  /** Debounced position save: persists CFI + progress to Dexie and updates BookStore */
  const debouncedSavePosition = useCallback(
    (cfi: string, progress: number) => {
      if (!bookId) return

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        const position: ContentPosition = { type: 'cfi', value: cfi }
        const progressInt = Math.round(progress * 100) // 0–100

        // Update in-memory BookStore
        useBookStore.setState(state => ({
          books: state.books.map(b =>
            b.id === bookId ? { ...b, currentPosition: position, progress: progressInt } : b
          ),
        }))

        // Persist to Dexie — single update, no toast (non-disruptive during reading)
        // silent-catch-ok: position will be re-saved on next page turn (non-fatal during reading)
        db.books
          .update(bookId, {
            currentPosition: position,
            progress: progressInt,
          })
          .catch(err => {
            console.error('[BookReader] Failed to save position:', err)
          })
      }, POSITION_SAVE_DEBOUNCE_MS)
    },
    [bookId]
  )

  /** CFI location change — update store position + progress + current chapter */
  const handleLocationChanged = useCallback(
    (cfi: string) => {
      setCurrentCfi(cfi)

      // Estimate progress from rendition if available
      if (renditionRef.current) {
        try {
          const loc = renditionRef.current.currentLocation()
          if (loc && typeof loc === 'object' && 'start' in loc) {
            const start = (
              loc as { start?: { percentage?: number; href?: string; location?: number } }
            ).start
            if (typeof start?.percentage === 'number') {
              setReadingProgress(start.percentage)
              debouncedSavePosition(cfi, start.percentage)
            }
            // Update current href for TOC active state
            if (start?.href) {
              setCurrentHref(start.href)
              // Find matching TOC chapter label
              const matchingChapter = findChapterByHref(toc, start.href)
              if (matchingChapter) {
                setCurrentChapter(matchingChapter.label)
              }
            }
            // Update page indicator if locations are available
            if (typeof start?.location === 'number') {
              setCurrentPage(start.location + 1) // 0-based → 1-based
            }
          }
        } catch {
          // silent-catch-ok: progress estimation failure is non-fatal
        }
      }
    },
    [setCurrentCfi, setReadingProgress, setCurrentChapter, toc, debouncedSavePosition]
  )

  /** Find a TOC item by href (recursive for nested items) */
  function findChapterByHref(items: NavItem[], href: string): NavItem | null {
    for (const item of items) {
      if (item.href === href || item.href.split('#')[0] === href.split('#')[0]) {
        return item
      }
      if (item.subitems) {
        const found = findChapterByHref(item.subitems, href)
        if (found) return found
      }
    }
    return null
  }

  /** TOC loaded — store TOC and set initial chapter name */
  const handleTocLoaded = useCallback(
    (loadedToc: NavItem[]) => {
      setToc(loadedToc)
      if (loadedToc.length > 0 && !currentChapter) {
        setCurrentChapter(loadedToc[0].label)
      }
    },
    [currentChapter, setCurrentChapter]
  )

  const handleRenditionReady = useCallback((rendition: Rendition) => {
    renditionRef.current = rendition
    // Signal that EPUB rendered successfully — starts reading session timer (E85-S06)
    setIsEpubReady(true)

    // Generate locations for page count estimation (async, non-blocking)
    // epub.js generates ~1000 chars per "page" by default
    const epubBook = (
      rendition as unknown as {
        book?: { locations?: { generate: (n: number) => Promise<void>; total: number } }
      }
    ).book
    if (epubBook?.locations?.generate) {
      epubBook.locations
        .generate(1000)
        .then(() => {
          if (epubBook.locations && epubBook.locations.total > 0) {
            setTotalPages(epubBook.locations.total)
          }
        })
        .catch(() => {
          // silent-catch-ok: location generation is optional for page counts
        })
    }
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey(k => k + 1)
  }, [])

  /** Load cached version of a remote EPUB (E88-S03 offline fallback) */
  const handleLoadCached = useCallback(async () => {
    if (!book) return
    setIsLoadingContent(true)
    setLoadError(null)
    setHasCachedFallback(false)

    try {
      const arrayBuffer = await bookContentService.getCachedEpub(book.id)
      if (!arrayBuffer) {
        toast.error('Cached version no longer available')
        setLoadError('Cached version no longer available')
        setIsLoadingContent(false)
        return
      }

      // Revoke previous Blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' })
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setEpubUrl(url)
      setIsLoadingContent(false)
    } catch {
      // silent-catch-ok: cache read failure surfaces as user-visible error below
      toast.error('Failed to load cached version')
      setLoadError('Failed to load cached version')
      setIsLoadingContent(false)
    }
  }, [book])

  // Derive initial CFI: prefer highlight back-navigation CFI (E85-S05) over saved position
  const initialCfi =
    highlightCfi ?? (book?.currentPosition?.type === 'cfi' ? book.currentPosition.value : null)

  // Book not found (after store is loaded)
  if (isLoaded && !book) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Book not found</p>
          <button
            onClick={() => navigate('/library')}
            className="text-sm text-brand underline underline-offset-2"
          >
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  // Audiobook: render the AudiobookRenderer instead of the EPUB reader (E87-S02)
  if (book?.format === 'audiobook') {
    return (
      <div
        className="fixed inset-0 flex flex-col bg-background overflow-y-auto"
        data-testid="audiobook-reader"
      >
        {/* Minimal header for back navigation + bookmarks */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={() => navigate('/library')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center"
            aria-label="Back to Library"
          >
            ← Library
          </button>
          <button
            onClick={() => setAudiobookBookmarksOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] flex items-center"
            aria-label="View bookmarks"
          >
            Bookmarks
          </button>
        </div>
        <Suspense
          fallback={
            <div className="flex h-[60vh] items-center justify-center">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AudiobookRenderer
            book={book}
            bookmarksOpen={audiobookBookmarksOpen}
            onBookmarksClose={() => setAudiobookBookmarksOpen(false)}
          />
        </Suspense>
      </div>
    )
  }

  return (
    // Full-viewport, no Layout wrapper — reader owns the full screen
    <div
      className="fixed inset-0 flex flex-col overflow-hidden [touch-action:pan-y]"
      data-testid="book-reader"
    >
      {/* Reader Header */}
      <ReaderHeader
        title={book?.title ?? 'Loading...'}
        currentChapter={currentChapter}
        theme={theme}
        visible={headerVisible}
        onTocOpen={() => setTocOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onHighlightsOpen={() => setHighlightsOpen(true)}
        onReadAloud={isTtsAvailable ? startTts : undefined}
      />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {(isLoadingContent || !isLoaded) && (
          <LoadingSkeleton
            message={
              book?.source.type === 'remote' ? 'Loading from server...' : 'Loading book...'
            }
          />
        )}

        {!isLoadingContent && loadError && (
          <div
            className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-background"
            role="alert"
          >
            <p className="text-destructive font-medium" data-testid="reader-error-message">
              {loadError}
            </p>
            <div className="flex gap-3">
              {hasCachedFallback && (
                <button
                  onClick={handleLoadCached}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-hover transition-colors min-h-[44px]"
                  data-testid="reader-load-cached-button"
                >
                  Read cached version
                </button>
              )}
              <button
                onClick={handleRetry}
                className="text-sm text-brand underline underline-offset-2 min-h-[44px] flex items-center"
                data-testid="reader-retry-button"
              >
                {hasCachedFallback ? 'Retry' : 'Try again'}
              </button>
            </div>
          </div>
        )}

        {!isLoadingContent && !loadError && epubUrl && (
          <ReaderErrorBoundary onRetry={handleRetry}>
            <Suspense fallback={<LoadingSkeleton />}>
              <EpubRenderer
                key={retryKey}
                url={epubUrl}
                initialLocation={initialCfi}
                onLocationChanged={handleLocationChanged}
                onTocLoaded={handleTocLoaded}
                onRenditionReady={handleRenditionReady}
              />
            </Suspense>
          </ReaderErrorBoundary>
        )}
      </main>

      {/* Reader Footer */}
      <ReaderFooter
        progress={readingProgress}
        theme={theme}
        visible={headerVisible}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {/* Table of Contents panel (E84-S02) */}
      <TableOfContents
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        toc={toc}
        currentHref={currentHref}
        rendition={renditionRef.current}
      />

      {/* Reading Settings panel (E84-S03) */}
      <ReaderSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Highlight list panel (E85-S03) */}
      <HighlightListPanel
        open={highlightsOpen}
        onClose={() => setHighlightsOpen(false)}
        rendition={renditionRef.current}
        onFlashcardRequest={(text, highlightId) => {
          setClozeText(text)
          setClozeHighlightId(highlightId)
          setClozeOpen(true)
        }}
      />

      {/* Highlight layer (E85-S01) — text selection events + highlight overlays */}
      {bookId && (
        <HighlightLayer
          rendition={renditionRef.current}
          bookId={bookId}
          currentHref={currentHref}
          focusHighlightId={searchParams.get('sourceHighlightId') ?? undefined}
          onFlashcardRequest={(text, highlightId) => {
            setClozeText(text)
            setClozeHighlightId(highlightId)
            setClozeOpen(true)
          }}
        />
      )}

      {/* Cloze flashcard creator (E85-S04) */}
      {bookId && (
        <ClozeFlashcardCreator
          open={clozeOpen}
          onClose={() => setClozeOpen(false)}
          text={clozeText}
          highlightId={clozeHighlightId}
          bookId={bookId}
        />
      )}

      {/* TTS Read-Aloud control bar (E84-S05) — shown when TTS is active */}
      {(isTtsPlaying || isTtsPaused) && (
        <TtsControlBar
          isPlaying={isTtsPlaying}
          currentChunk={ttsCurrentChunk}
          totalChunks={ttsTotalChunks}
          rate={ttsRate}
          theme={theme}
          onPlayPause={toggleTts}
          onStop={stopTts}
          onRateChange={setTtsRate}
        />
      )}
    </div>
  )
}
