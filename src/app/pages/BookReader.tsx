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
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router'
import { recordVisit } from '@/lib/searchFrecency'
import type { Rendition } from 'epubjs'
import type { NavItem } from 'epubjs'
import { toast } from 'sonner'
import { Loader2, ChevronDown, Bookmark } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useBookStore } from '@/stores/useBookStore'
import { useReaderStore } from '@/stores/useReaderStore'
import { bookContentService, RemoteEpubError } from '@/services/BookContentService'
import { ReaderHeader } from '@/app/components/reader/ReaderHeader'
import { ReaderFooter } from '@/app/components/reader/ReaderFooter'
import { ReaderErrorBoundary } from '@/app/components/reader/ReaderErrorBoundary'
import { TableOfContents } from '@/app/components/reader/TableOfContents'
import { ReaderSettingsPanel } from '@/app/components/reader/ReaderSettingsPanel'
import { TtsControlBar } from '@/app/components/reader/TtsControlBar'
import { ReadingRuler } from '@/app/components/reader/ReadingRuler'
import { HighlightLayer } from '@/app/components/reader/HighlightLayer'
import { useVocabularyStore } from '@/stores/useVocabularyStore'
import { HighlightListPanel } from '@/app/components/reader/HighlightListPanel'
import { ClozeFlashcardCreator } from '@/app/components/reader/ClozeFlashcardCreator'
import { useTts } from '@/app/hooks/useTts'
import { useReadingSession } from '@/app/hooks/useReadingSession'
import { useFormatSwitch } from '@/app/hooks/useFormatSwitch'
import { appEventBus } from '@/lib/eventBus'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { getTimeReadToday } from '@/services/ReadingStatsService'
import { getPagesReadToday } from '@/app/hooks/usePagesReadToday'
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
  const location = useLocation()

  // R19: capture deep-links to the reader (e.g. /library/:bookId/read) that
  // bypass the Library landing. Skipped for palette-initiated navigations.
  useEffect(() => {
    if (!bookId || bookId === 'undefined') return
    const state = location.state as { __viaPalette?: boolean } | null
    if (state?.__viaPalette === true) return
    void recordVisit('book', bookId)
  }, [bookId, location.state])
  const handleMinimize = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/library')
    }
  }, [navigate])
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
  const currentCfi = useReaderStore(s => s.currentCfi)
  const theme = useReaderStore(s => s.theme)
  const tocOpen = useReaderStore(s => s.tocOpen)
  const setTocOpen = useReaderStore(s => s.setTocOpen)
  const settingsOpen = useReaderStore(s => s.settingsOpen)
  const setSettingsOpen = useReaderStore(s => s.setSettingsOpen)

  const [epubUrl, setEpubUrl] = useState<string | ArrayBuffer | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // CFI resolved from sourceHighlightId query param (E85-S05 back-navigation)
  const [highlightCfi, setHighlightCfi] = useState<string | null>(null)
  // highlightsOpen state: wired to ReaderHeader → HighlightListPanel (E85-S03)
  const [highlightsOpen, setHighlightsOpen] = useState(false)
  // audiobookBookmarksOpen: controls BookmarkListPanel in AudiobookRenderer (E87-S04)
  const [audiobookBookmarksOpen, setAudiobookBookmarksOpen] = useState(false)
  const [hasBookmarks, setHasBookmarks] = useState(false)
  const [bookmarkVersion, setBookmarkVersion] = useState(0)
  const handleBookmarkChange = useCallback(() => setBookmarkVersion(v => v + 1), [])

  // Check if book has any bookmarks (for filled icon state)
  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    db.audioBookmarks
      .where('bookId')
      .equals(bookId)
      .count()
      .then(count => {
        if (!cancelled) setHasBookmarks(count > 0)
      })
      .catch(() => {
        // silent-catch-ok: non-critical UI state
      })
    return () => {
      cancelled = true
    }
  }, [bookId, audiobookBookmarksOpen, bookmarkVersion])
  // Cloze flashcard creator state (E85-S04)
  const [clozeText, setClozeText] = useState('')
  const [clozeHighlightId, setClozeHighlightId] = useState<string | undefined>(undefined)
  const [clozeOpen, setClozeOpen] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  // Remote EPUB cache fallback (E88-S03) — stored as RemoteEpubError for derived state
  const [remoteEpubError, setRemoteEpubError] = useState<RemoteEpubError | null>(null)
  // Set to true once EPUB renders successfully — triggers reading session start (E85-S06)
  const [isEpubReady, setIsEpubReady] = useState(false)
  const [toc, setToc] = useState<NavItem[]>([])
  const [isTocLoading, setIsTocLoading] = useState(true)
  const [currentHref, setCurrentHref] = useState<string | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState<number | undefined>(undefined)
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined)

  const renditionRef = useRef<Rendition | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timeout effect for TOC loading — fallback to empty state after 5 seconds
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isTocLoading) {
        setIsTocLoading(false)
      }
    }, 5000) // 5 second timeout

    return () => clearTimeout(timeoutId)
  }, [isTocLoading])

  // Reading session tracking and streak integration (E85-S06)
  useReadingSession({ bookId: bookId ?? '', isReady: isEpubReady })

  // Daily reading goal celebration — check after each session ends (E86-S05)
  const checkDailyGoalMet = useReadingGoalStore(s => s.checkDailyGoalMet)
  const checkPagesGoalMet = useReadingGoalStore(s => s.checkPagesGoalMet)
  useEffect(() => {
    const unsub = appEventBus.on('reading:session-ended', async () => {
      try {
        const secondsToday = await getTimeReadToday()
        const minutesToday = Math.floor(secondsToday / 60)
        const isNewlyMet = checkDailyGoalMet(minutesToday)
        if (isNewlyMet) {
          toast.success('Daily reading goal reached! ✓', { duration: 4000 })
          return
        }
        // E108-S05: also check pages goal for books (pages mode)
        const pagesToday = await getPagesReadToday()
        const isPagesGoalMet = checkPagesGoalMet(pagesToday)
        if (isPagesGoalMet) {
          toast.success('Daily reading goal reached! ✓', { duration: 4000 })
        }
      } catch {
        // silent-catch-ok: goal check failure should not affect reading UX
      }
    })
    return unsub
  }, [checkDailyGoalMet, checkPagesGoalMet])

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
  const bookRef = useRef(book)
  bookRef.current = book

  // Format switching: EPUB ↔ audiobook via chapter mapping (E103-S02)
  const { hasMapping, switchToFormat } = useFormatSwitch(bookId, book?.format)

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
    const currentBook = bookRef.current
    if (!currentBook || currentBook.format !== 'epub') return

    let cancelled = false
    setIsLoadingContent(true)
    setIsTocLoading(true) // Reset TOC loading state when loading new content
    setLoadError(null)
    setRemoteEpubError(null)

    bookContentService
      .getEpubContent(currentBook)
      .then(arrayBuffer => {
        if (cancelled) return
        setEpubUrl(arrayBuffer)
        setIsLoadingContent(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        if (err instanceof RemoteEpubError) {
          console.error(`[BookReader] Remote EPUB error (${err.code}):`, err.message)
          toast.error(err.message)
          setLoadError(err.message)
          setRemoteEpubError(err)
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
  }, [bookId, retryKey])

  // Timeout: if epubUrl is set but epub.js never fires getRendition within 12s, show error
  useEffect(() => {
    if (!epubUrl || isEpubReady) return
    const timer = setTimeout(() => {
      setLoadError('Book failed to load. The file may be corrupted or in an unsupported format.')
    }, 12_000)
    return () => clearTimeout(timer)
  }, [epubUrl, isEpubReady])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
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
      // Guard: skip during IME composition (e.g., Japanese/Chinese input)
      if (e.isComposing) return

      // Guard: skip when text input, select, or contentEditable is focused (AC-5)
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target.isContentEditable) return

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
        case 't':
        case 'T':
          e.preventDefault()
          setTocOpen(!useReaderStore.getState().tocOpen)
          break
        case 'h':
        case 'H':
          e.preventDefault()
          setHighlightsOpen(prev => !prev)
          break
        case 'b':
        case 'B':
          e.preventDefault()
          toast.info('EPUB bookmarks coming soon')
          break
        case 's':
        case 'S':
          e.preventDefault()
          setSettingsOpen(!useReaderStore.getState().settingsOpen)
          break
        case 'Escape':
          handleMinimize()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMinimize])

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

  /**
   * Immediately flush the current EPUB position to Dexie — used before navigating
   * away (e.g., format switch) to ensure position is persisted before unmount.
   * Cancels any pending debounced save first (AC4 / E103-S02).
   */
  const saveEpubPositionNow = useCallback(() => {
    if (!bookId || !renditionRef.current) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    try {
      const loc = renditionRef.current.currentLocation()
      if (loc && typeof loc === 'object' && 'start' in loc) {
        const start = (loc as { start?: { cfi?: string; percentage?: number } }).start
        if (start?.cfi) {
          const position: ContentPosition = { type: 'cfi', value: start.cfi }
          const progressInt =
            typeof start.percentage === 'number' ? Math.round(start.percentage * 100) : undefined
          useBookStore.setState(state => ({
            books: state.books.map(b =>
              b.id === bookId
                ? {
                    ...b,
                    currentPosition: position,
                    ...(progressInt !== undefined && { progress: progressInt }),
                  }
                : b
            ),
          }))
          // silent-catch-ok: pre-navigation save failure is non-fatal (position saved on next open)
          db.books
            .update(bookId, {
              currentPosition: position,
              ...(progressInt !== undefined && { progress: progressInt }),
            })
            .catch(err => console.error('[BookReader] Pre-navigation EPUB save failed:', err))
        }
      }
    } catch {
      // silent-catch-ok: rendition may not have location yet
    }
  }, [bookId])

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

  /** TOC loaded — store TOC, clear loading state, and set initial chapter name */
  const handleTocLoaded = useCallback(
    (loadedToc: NavItem[]) => {
      setToc(loadedToc)
      setIsTocLoading(false)
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
    setRemoteEpubError(null)

    try {
      const arrayBuffer = await bookContentService.getCachedEpub(book.id)
      if (!arrayBuffer) {
        toast.error('Cached version no longer available')
        setLoadError('Cached version no longer available')
        setIsLoadingContent(false)
        return
      }

      setEpubUrl(arrayBuffer)
      setIsLoadingContent(false)
    } catch {
      // silent-catch-ok: Cache API unavailable (e.g. private browsing) — user-visible error set below
      toast.error('Failed to load cached version')
      setLoadError('Failed to load cached version')
      setIsLoadingContent(false)
    }
  }, [book])

  // Derived: whether there is a cached fallback available (E88-S03)
  const hasCachedFallback = remoteEpubError?.hasCachedVersion ?? false

  // Read format-switch params (E103) — captured once via refs so we can strip
  // them from the URL immediately while still applying them after the renderer mounts.
  const startChapterParam = searchParams.get('startChapter')
  const startChapterIndex = startChapterParam !== null ? parseInt(startChapterParam, 10) : null
  const offsetCfiParamRef = useRef<string | null>(null)
  const seekSecondsParamRef = useRef<number | null>(null)
  const chapterPctParamRef = useRef<number | null>(null)
  if (offsetCfiParamRef.current === null) {
    offsetCfiParamRef.current = searchParams.get('offsetCfi')
  }
  if (seekSecondsParamRef.current === null) {
    const v = searchParams.get('seekSeconds')
    if (v !== null) {
      const parsed = parseFloat(v)
      if (Number.isFinite(parsed)) seekSecondsParamRef.current = parsed
    }
  }
  if (chapterPctParamRef.current === null) {
    const v = searchParams.get('chapterPct')
    if (v !== null) {
      const parsed = parseFloat(v)
      if (Number.isFinite(parsed)) chapterPctParamRef.current = parsed
    }
  }

  // Clear format-switch params from the URL after capturing them — prevents
  // stale params on refresh.
  useEffect(() => {
    if (
      startChapterParam !== null ||
      searchParams.get('offsetCfi') !== null ||
      searchParams.get('seekSeconds') !== null ||
      searchParams.get('chapterPct') !== null
    ) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('startChapter')
      newParams.delete('offsetCfi')
      newParams.delete('seekSeconds')
      newParams.delete('chapterPct')
      const newSearch = newParams.toString()
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, { replace: true })
    }
  }, []) // Run once on mount only

  // For EPUB: navigate to startChapter's TOC href (or offsetCfi / chapterPct
  // intra-chapter target) once the TOC is loaded (E103 — Story B).
  const startChapterAppliedRef = useRef(false)
  useEffect(() => {
    if (
      startChapterIndex === null ||
      startChapterAppliedRef.current ||
      toc.length === 0 ||
      !renditionRef.current ||
      book?.format !== 'epub'
    )
      return

    const idx = Math.max(0, Math.min(startChapterIndex, toc.length - 1))
    const targetHref = toc[idx]?.href
    if (!targetHref) return

    startChapterAppliedRef.current = true
    const rendition = renditionRef.current
    const offsetCfi = offsetCfiParamRef.current
    const chapterPct = chapterPctParamRef.current

    // Helper: surface an EpubLocations interface from the rendition's epub.js Book.
    const getLocations = () => {
      const epubBookInternal = (
        rendition as unknown as {
          book?: {
            locations?: {
              percentageFromCfi: (cfi: string) => number
              cfiFromPercentage: (pct: number) => string
              total?: number
              generate?: (n: number) => Promise<void>
            }
          }
        }
      )?.book
      return epubBookInternal?.locations ?? null
    }

    // Wait up to 500ms for locations.generate to complete when an intra-chapter
    // target is present, then apply the most precise display target available.
    // Rationale (Story B.4): hard-reload with format-switch URL params can
    // arrive before locations are ready; we'd compute garbage CFIs otherwise.
    let cancelled = false
    const applyTarget = async () => {
      try {
        if (offsetCfi || chapterPct !== null) {
          const locs = getLocations()
          if (locs && (!locs.total || locs.total <= 0) && typeof locs.generate === 'function') {
            // Race generate() against a 500ms timeout
            await Promise.race([
              locs.generate(1000),
              new Promise<void>(resolve => setTimeout(resolve, 500)),
            ])
          }
        }
        if (cancelled) return

        let displayTarget: string | undefined

        if (offsetCfi) {
          // Direct CFI from EPUB→Audio→… chain, or precomputed by an external switcher.
          displayTarget = offsetCfi
        } else if (chapterPct !== null && book) {
          // Audio→EPUB: we receive a chapter percentage; compute the CFI inside the
          // mapped chapter using the freshly-generated locations.
          const locs = getLocations()
          const chapter = book.chapters.find(ch => ch.id === targetHref)
          if (locs && (locs.total ?? 0) > 0 && chapter && chapter.position.type === 'cfi') {
            try {
              const startPct = locs.percentageFromCfi(chapter.position.value)
              // Find the next chapter (by spine order) for end percentage.
              const sorted = [...book.chapters].sort((a, b) => a.order - b.order)
              const nextCh = sorted[(sorted.findIndex(c => c.id === chapter.id) + 1) | 0]
              const endPct =
                nextCh && nextCh.position.type === 'cfi'
                  ? locs.percentageFromCfi(nextCh.position.value)
                  : 1
              if (
                Number.isFinite(startPct) &&
                Number.isFinite(endPct) &&
                endPct > startPct
              ) {
                const target = Math.max(0, Math.min(1, startPct + chapterPct * (endPct - startPct)))
                const cfi = locs.cfiFromPercentage(target)
                if (cfi) displayTarget = cfi
              }
            } catch {
              // silent-catch-ok: fall through to chapter-start jump below
            }
          }
        }

        if (!displayTarget) displayTarget = targetHref
        await rendition.display(displayTarget)
      } catch {
        // silent-catch-ok: chapter navigation failure falls back to current position
      }
    }
    void applyTarget()
    return () => {
      cancelled = true
    }
  }, [startChapterIndex, toc, book?.format, book])

  const initialCfiRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialCfiRef.current !== null) return
    if (!book) return
    initialCfiRef.current =
      highlightCfi ?? (book.currentPosition?.type === 'cfi' ? book.currentPosition.value : null)
  }, [book, highlightCfi])
  const initialCfi = initialCfiRef.current

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
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card/70 backdrop-blur-[32px] shadow-[0_4px_24px_-4px_rgba(27,28,21,0.06)] sticky top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground"
            aria-label="Minimize player"
            data-testid="audiobook-minimize-button"
          >
            <ChevronDown className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAudiobookBookmarksOpen(true)}
            className={`min-h-[44px] min-w-[44px] hover:text-foreground ${audiobookBookmarksOpen || hasBookmarks ? 'text-foreground' : 'text-muted-foreground'}`}
            aria-label="View bookmarks"
          >
            <Bookmark className="size-5" fill={hasBookmarks ? 'currentColor' : 'none'} />
          </Button>
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
            onSwitchToReading={
              hasMapping
                ? (chapterIndex: number, currentTime: number, audioElementDuration?: number) =>
                    switchToFormat(chapterIndex, undefined, {
                      audioCurrentTime: currentTime,
                      audioElementDuration,
                    })
                : undefined
            }
            initialChapterIndex={
              startChapterIndex !== null
                ? Math.max(0, Math.min(startChapterIndex, book.chapters.length - 1))
                : undefined
            }
            initialSeekSeconds={seekSecondsParamRef.current ?? undefined}
            initialChapterPct={chapterPctParamRef.current ?? undefined}
            onBookmarkChange={handleBookmarkChange}
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
        onSwitchToListening={
          hasMapping && book?.format === 'epub'
            ? () => {
                // Save EPUB position immediately before navigating (AC4 / E103-S02)
                saveEpubPositionNow()
                // Derive current EPUB chapter index from TOC + currentHref
                const epubChapterIndex = currentHref
                  ? toc.findIndex(item => item.href.split('#')[0] === currentHref.split('#')[0])
                  : -1
                // Pull live CFI + locations for intra-chapter math (E103 — Story B).
                // The resolver returns null when locations aren't ready; the hook degrades
                // to chapter-start jump in that case.
                let liveCfi: string | undefined
                let liveLocations: import('@/lib/chapterSwitchResolver').EpubLocations | null = null
                try {
                  const loc = renditionRef.current?.currentLocation()
                  const start = (loc as { start?: { cfi?: string } } | undefined)?.start
                  liveCfi = start?.cfi ?? currentCfi ?? undefined
                  const epubBookInternal = (
                    renditionRef.current as unknown as {
                      book?: {
                        locations?: {
                          percentageFromCfi: (cfi: string) => number
                          cfiFromPercentage: (pct: number) => string
                          total?: number
                        }
                      }
                    }
                  )?.book
                  const locs = epubBookInternal?.locations
                  if (locs && (locs.total ?? 0) > 0) {
                    liveLocations = {
                      percentageFromCfi: locs.percentageFromCfi.bind(locs),
                      cfiFromPercentage: locs.cfiFromPercentage.bind(locs),
                    }
                  }
                } catch {
                  // silent-catch-ok: rendition may not yet have a current location
                }
                const epubChapterHref = currentHref
                  ? currentHref.split('#')[0]
                  : toc[Math.max(0, epubChapterIndex)]?.href.split('#')[0]
                switchToFormat(Math.max(0, epubChapterIndex), undefined, {
                  epubCurrentCfi: liveCfi,
                  epubChapterHref,
                  epubLocations: liveLocations,
                })
              }
            : undefined
        }
        readingProgress={readingProgress}
      />

      {/* Main content area */}
      <main className="relative flex-1 overflow-hidden">
        {/* Reading ruler overlay (E114-S01) */}
        <ReadingRuler />
        {(isLoadingContent || !isLoaded) && (
          <LoadingSkeleton
            message={book?.source.type === 'remote' ? 'Loading from server...' : 'Loading book...'}
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
            <div className="flex flex-wrap gap-3 justify-center">
              {hasCachedFallback && (
                <Button
                  variant="brand"
                  onClick={handleLoadCached}
                  data-testid="reader-load-cached-button"
                >
                  Read cached version
                </Button>
              )}
              <Button
                variant="brand-outline"
                onClick={handleRetry}
                data-testid="reader-retry-button"
              >
                {hasCachedFallback ? 'Retry' : 'Try again'}
              </Button>
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
        isLoading={isTocLoading}
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
        bookId={bookId}
        bookTitle={book?.title}
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
          onVocabularyRequest={text => {
            if (!bookId) return
            const now = new Date().toISOString()
            useVocabularyStore.getState().addItem({
              id: crypto.randomUUID(),
              bookId,
              word: text.trim(),
              masteryLevel: 0,
              createdAt: now,
              updatedAt: now,
            })
            toast.success(`"${text.trim().slice(0, 30)}" added to vocabulary`)
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
