/**
 * BookReader — full-viewport EPUB reader page.
 *
 * Route: /library/:bookId (registered in routes.tsx).
 * Full-screen layout — NOT nested inside the standard Layout component.
 *
 * Responsibilities:
 * - Load book from useBookStore by :bookId URL param
 * - Fetch EPUB content via BookContentService
 * - Render EpubRenderer (lazy-loaded) with loading skeleton
 * - Show ReaderHeader and ReaderFooter with auto-hide behavior
 * - Manage 3-second idle timeout for header/footer auto-hide
 *
 * @module BookReader
 */
import { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import type { Rendition } from 'epubjs'
import type { NavItem } from 'epubjs'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { useReaderStore } from '@/stores/useReaderStore'
import { bookContentService } from '@/services/BookContentService'
import { ReaderHeader } from '@/app/components/reader/ReaderHeader'
import { ReaderFooter } from '@/app/components/reader/ReaderFooter'
import { ReaderErrorBoundary } from '@/app/components/reader/ReaderErrorBoundary'

// Code-split: epub.js + react-reader must NOT be in the initial bundle (architecture decision 12)
const EpubRenderer = lazy(() =>
  import('@/app/components/reader/EpubRenderer').then(m => ({ default: m.EpubRenderer }))
)

const IDLE_TIMEOUT_MS = 3000

function LoadingSkeleton() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 bg-[#FAF5EE]"
      data-testid="reader-loading"
      role="status"
      aria-label="Loading book..."
    >
      <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Loading book...</p>
    </div>
  )
}

export function BookReader() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
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
  const setTocOpen = useReaderStore(s => s.setTocOpen)
  const setSettingsOpen = useReaderStore(s => s.setSettingsOpen)

  const [epubUrl, setEpubUrl] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const renditionRef = useRef<Rendition | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Load books if not yet loaded
  useEffect(() => {
    if (!isLoaded) {
      loadBooks().catch(() => toast.error('Failed to load library'))
    }
  }, [isLoaded, loadBooks])

  // Find book in store
  const book = books.find(b => b.id === bookId)

  // Load EPUB content
  useEffect(() => {
    if (!book || book.format !== 'epub') return

    let cancelled = false
    setIsLoadingContent(true)
    setLoadError(null)

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
        const message = err instanceof Error ? err.message : 'Unknown error loading book'
        console.error('[BookReader] Failed to load EPUB:', message)
        toast.error('Failed to load book')
        setLoadError(message)
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

  // Keyboard: Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/library')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  /** CFI location change — update store position + progress */
  const handleLocationChanged = useCallback(
    (cfi: string) => {
      setCurrentCfi(cfi)

      // Estimate progress from rendition if available
      if (renditionRef.current) {
        try {
          const loc = renditionRef.current.currentLocation()
          if (loc && typeof loc === 'object' && 'start' in loc) {
            const start = (loc as { start?: { percentage?: number } }).start
            if (typeof start?.percentage === 'number') {
              setReadingProgress(start.percentage)
            }
          }
        } catch {
          // silent-catch-ok: progress estimation failure is non-fatal
        }
      }
    },
    [setCurrentCfi, setReadingProgress]
  )

  /** TOC loaded — extract first chapter name as initial current chapter */
  const handleTocLoaded = useCallback(
    (toc: NavItem[]) => {
      if (toc.length > 0 && !currentChapter) {
        setCurrentChapter(toc[0].label)
      }
    },
    [currentChapter, setCurrentChapter]
  )

  const handleRenditionReady = useCallback((rendition: Rendition) => {
    renditionRef.current = rendition
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey(k => k + 1)
  }, [])

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
      />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {(isLoadingContent || !isLoaded) && <LoadingSkeleton />}

        {!isLoadingContent && loadError && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center bg-[#FAF5EE]">
            <p className="text-destructive font-medium">Failed to load book</p>
            <button
              onClick={handleRetry}
              className="text-sm text-brand underline underline-offset-2"
              data-testid="reader-retry-button"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoadingContent && !loadError && epubUrl && (
          <ReaderErrorBoundary onRetry={handleRetry}>
            <Suspense fallback={<LoadingSkeleton />}>
              <EpubRenderer
                key={retryKey}
                url={epubUrl}
                initialLocation={null}
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
      />
    </div>
  )
}
