/**
 * Library page — book management with grid/list views, search, filters, and empty state.
 *
 * Shows empty state with drag-drop import CTA when no books exist,
 * or a responsive book grid/list with search, status filters, and view toggle.
 *
 * @since E83-S01
 * @modified E83-S02 — added import button and BookImportDialog
 * @modified E83-S03 — full grid/list views, BookCard, BookListItem, empty state redesign
 * @modified E83-S04 — search, status filter pills, context menus
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Globe, Grid3X3, Headphones, List, Loader2, Plus, WifiOff, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { BookImportDialog } from '@/app/components/library/BookImportDialog'
import { SeriesCard } from '@/app/components/library/SeriesCard'
import { StorageIndicator } from '@/app/components/library/StorageIndicator'
import { BookCard } from '@/app/components/library/BookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'
import { BookMetadataEditor } from '@/app/components/library/BookMetadataEditor'
import { LibraryFilters } from '@/app/components/library/LibraryFilters'
import { LibrarySourceTabs } from '@/app/components/library/LibrarySourceTabs'
import { ReadingGoalSettings } from '@/app/components/library/ReadingGoalSettings'
import { OpdsCatalogSettings } from '@/app/components/library/OpdsCatalogSettings'
import { AudiobookshelfSettings } from '@/app/components/library/AudiobookshelfSettings'
import { OpdsBrowser } from '@/app/components/library/OpdsBrowser'
import { DailyGoalRing } from '@/app/components/library/DailyGoalRing'
import { YearlyGoalProgress } from '@/app/components/library/YearlyGoalProgress'
import { useBookStore } from '@/stores/useBookStore'
import { useOpdsCatalogStore } from '@/stores/useOpdsCatalogStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { useAudiobookshelfSync } from '@/app/hooks/useAudiobookshelfSync'
import { appEventBus } from '@/lib/eventBus'
import type { Book } from '@/data/types'
import { cn } from '@/app/components/ui/utils'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'

export function Library() {
  const isOnline = useOnlineStatus()
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [catalogsOpen, setCatalogsOpen] = useState(false)
  const [absSettingsOpen, setAbsSettingsOpen] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserCatalogId, setBrowserCatalogId] = useState<string | undefined>()
  const books = useBookStore(s => s.books)
  const libraryView = useBookStore(s => s.libraryView)
  const getFilteredBooks = useBookStore(s => s.getFilteredBooks)
  const filters = useBookStore(s => s.filters)
  const setFilters = useBookStore(s => s.setFilters)
  const loadBooks = useBookStore(s => s.loadBooks)

  const opdsCatalogs = useOpdsCatalogStore(s => s.catalogs)
  const loadCatalogs = useOpdsCatalogStore(s => s.loadCatalogs)

  // Audiobookshelf sync (E101-S03)
  const absServers = useAudiobookshelfStore(s => s.servers)
  const loadAbsServers = useAudiobookshelfStore(s => s.loadServers)
  const { isSyncing: isAbsSyncing, syncCatalog, loadNextPage, pagination } = useAudiobookshelfSync()

  // Series browsing (E102-S02)
  const [absViewMode, setAbsViewMode] = useState<'grid' | 'series'>('grid')
  const absSeries = useAudiobookshelfStore(s => s.series)
  const isLoadingSeries = useAudiobookshelfStore(s => s.isLoadingSeries)
  const loadSeries = useAudiobookshelfStore(s => s.loadSeries)

  const loadGoal = useReadingGoalStore(s => s.loadGoal)
  const goal = useReadingGoalStore(s => s.goal)
  const checkYearlyGoalReached = useReadingGoalStore(s => s.checkYearlyGoalReached)

  // Load goals from localStorage on mount (E86-S05)
  useEffect(() => {
    loadGoal()
  }, [loadGoal])

  // Load catalogs on mount (E88-S02) — needed for Browse button visibility
  useEffect(() => {
    loadCatalogs()
  }, [loadCatalogs])

  // Load ABS servers on mount (E101-S03)
  useEffect(() => {
    loadAbsServers()
  }, [loadAbsServers])

  // Trigger ABS catalog sync when servers are loaded (E101-S03)
  // Background sync — does NOT block Library render
  // Track server IDs so adding a new server triggers re-sync without requiring remount
  const syncedServerIds = useRef(new Set<string>())
  useEffect(() => {
    const newServers = absServers.filter(s => !syncedServerIds.current.has(s.id))
    if (newServers.length > 0) {
      for (const server of newServers) {
        syncedServerIds.current.add(server.id)
      }
      newServers.forEach(server => syncCatalog(server))
    }
  }, [absServers, syncCatalog])

  // Call getFilteredBooks() directly on each render — it reads from Zustand's get() internally.
  // useMemo caused stale closure issues because getFilteredBooks is a stable function reference
  // in Zustand, causing the memo to return cached empty arrays even after books loaded.
  const filteredBooks = getFilteredBooks()

  // Load books on mount
  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  // Yearly goal celebration — fires when a book is marked finished (E86-S05)
  useEffect(() => {
    const unsub = appEventBus.on('book:finished', () => {
      if (!goal) return
      const currentYear = new Date().getFullYear().toString()
      const finishedThisYear = books.filter(
        b => b.status === 'finished' && b.finishedAt?.startsWith(currentYear)
      ).length
      if (checkYearlyGoalReached(finishedThisYear)) {
        toast.success('Yearly reading goal achieved! 🎉', { duration: 6000 })
      }
    })
    return unsub
  }, [goal, books, checkYearlyGoalReached])

  // Drag-drop state for empty state zone
  const [isDragOver, setIsDragOver] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.epub'))
    if (files.length > 0) {
      setDroppedFile(files[0])
      setImportOpen(true)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Books</h1>
            {!isOnline && (
              <span
                role="status"
                aria-label="You are offline"
                className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning-foreground"
                data-testid="library-offline-badge"
              >
                <WifiOff className="size-3" aria-hidden="true" />
                Offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Daily goal ring — compact, only visible when goal is set */}
            <DailyGoalRing />
            {opdsCatalogs.length > 0 && (
              <Button
                variant="brand-outline"
                onClick={() => setBrowserOpen(true)}
                className="min-h-[44px]"
                data-testid="browse-catalog-trigger"
              >
                <Globe className="mr-2 h-4 w-4" />
                Browse Catalog
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAbsSettingsOpen(true)}
              className="size-11 rounded-xl"
              aria-label="Audiobookshelf settings"
              title="Audiobookshelf"
              data-testid="abs-settings-trigger"
            >
              <Headphones className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCatalogsOpen(true)}
              className="size-11 rounded-xl"
              aria-label="OPDS catalog settings"
              title="OPDS Catalogs"
              data-testid="opds-catalog-settings-trigger"
            >
              <Globe className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setGoalsOpen(true)}
              className="size-11 rounded-xl"
              aria-label="Reading goals"
              title="Reading Goals"
            >
              <Target className="size-5" />
            </Button>
            <Button
              variant="brand"
              onClick={() => setImportOpen(true)}
              className="min-h-[44px]"
              data-testid="import-book-trigger"
            >
              <Plus className="mr-2 h-4 w-4" />
              Import Book
            </Button>
          </div>
        </div>
        {/* Yearly goal progress bar — only visible when yearly goal is set */}
        <YearlyGoalProgress />
      </div>

      {/* Empty state */}
      {books.length === 0 && (
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-4 py-24 rounded-[24px] border-2 border-dashed transition-colors',
            isDragOver ? 'border-brand bg-brand-soft/20' : 'border-border/50'
          )}
        >
          <BookOpen className="size-16 text-muted-foreground/40" />
          <h2 className="text-lg font-medium text-foreground">Your library is empty</h2>
          <p className="max-w-sm text-center text-muted-foreground">
            Import your first book to get started. Drag and drop an EPUB file here, or click the
            button below.
          </p>
          <Button
            variant="brand"
            onClick={() => setImportOpen(true)}
            className="min-h-[44px]"
            data-testid="import-first-book-cta"
          >
            <Plus className="mr-2 h-4 w-4" />
            Import Your First Book
          </Button>
        </div>
      )}

      {/* Source filter tabs — only show when ABS servers configured (E101-S03) */}
      {books.length > 0 && <LibrarySourceTabs />}

      {/* ABS view mode toggle: Grid / Series — only when ABS source is selected (E102-S02) */}
      {books.length > 0 && filters.source === 'audiobookshelf' && absServers.length > 0 && (
        <div
          className="flex gap-1 rounded-lg bg-muted p-1 w-fit"
          role="tablist"
          aria-label="Audiobookshelf view mode"
          data-testid="abs-view-toggle"
        >
          <button
            role="tab"
            aria-selected={absViewMode === 'grid'}
            onClick={() => setAbsViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              absViewMode === 'grid'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="abs-view-grid"
          >
            <Grid3X3 className="size-3.5" aria-hidden="true" />
            Grid
          </button>
          <button
            role="tab"
            aria-selected={absViewMode === 'series'}
            onClick={() => {
              setAbsViewMode('series')
              // Lazy-load series on first selection
              const connectedServer = absServers.find(s => s.status === 'connected')
              if (connectedServer && connectedServer.libraryIds.length > 0) {
                loadSeries(connectedServer.id, connectedServer.libraryIds[0])
              }
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              absViewMode === 'series'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="abs-view-series"
          >
            <List className="size-3.5" aria-hidden="true" />
            Series
          </button>
        </div>
      )}

      {/* Syncing indicator (E101-S03) */}
      {isAbsSyncing && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="abs-syncing-indicator"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Syncing Audiobookshelf library...
        </div>
      )}

      {/* Filters — only show when books exist */}
      {books.length > 0 && <LibraryFilters />}

      {/* Series view (E102-S02) — replaces grid when active */}
      {books.length > 0 && filters.source === 'audiobookshelf' && absViewMode === 'series' && (
        <div data-testid="series-view">
          {isLoadingSeries && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!isLoadingSeries && absSeries.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-muted-foreground" data-testid="series-empty-state">
                No series found in this library.
              </p>
            </div>
          )}
          {!isLoadingSeries && absSeries.length > 0 && (
            <div className="flex flex-col gap-3">
              {absSeries.map(s => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid view */}
      {books.length > 0 && libraryView === 'grid' && !(filters.source === 'audiobookshelf' && absViewMode === 'series') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredBooks.map(book => (
            <BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>
              <BookCard book={book} />
            </BookContextMenu>
          ))}
        </div>
      )}

      {/* List view */}
      {books.length > 0 && libraryView === 'list' && !(filters.source === 'audiobookshelf' && absViewMode === 'series') && (
        <div className="flex flex-col divide-y divide-border/50">
          {filteredBooks.map(book => (
            <BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>
              <BookListItem book={book} />
            </BookContextMenu>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel for ABS pagination (E101-S03) */}
      {filters.source === 'audiobookshelf' && absServers.length > 0 && (
        <AbsPaginationSentinel
          servers={absServers}
          pagination={pagination}
          loadNextPage={loadNextPage}
          isSyncing={isAbsSyncing}
        />
      )}

      {/* No results message */}
      {books.length > 0 && filteredBooks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-muted-foreground">No books match your filters.</p>
          <Button
            variant="outline"
            onClick={() => setFilters({})}
            className="min-h-[44px]"
            data-testid="clear-filters"
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Storage indicator — only when books exist */}
      {books.length > 0 && <StorageIndicator bookCount={books.length} refreshKey={books.length} />}

      <BookImportDialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) setDroppedFile(null)
        }}
        initialFile={droppedFile}
      />

      <BookMetadataEditor
        book={editingBook}
        open={editingBook !== null}
        onOpenChange={open => {
          if (!open) setEditingBook(null)
        }}
      />

      <ReadingGoalSettings open={goalsOpen} onOpenChange={setGoalsOpen} />
      <AudiobookshelfSettings open={absSettingsOpen} onOpenChange={setAbsSettingsOpen} />
      <OpdsCatalogSettings
        open={catalogsOpen}
        onOpenChange={setCatalogsOpen}
        onBrowse={catalogId => {
          setBrowserCatalogId(catalogId)
          setBrowserOpen(true)
        }}
      />
      <OpdsBrowser
        open={browserOpen}
        onOpenChange={open => {
          setBrowserOpen(open)
          if (!open) setBrowserCatalogId(undefined)
        }}
        initialCatalogId={browserCatalogId}
      />
    </div>
  )
}

/**
 * Infinite scroll sentinel for ABS pagination.
 * Uses IntersectionObserver to trigger loadNextPage when visible.
 */
function AbsPaginationSentinel({
  servers,
  pagination,
  loadNextPage,
  isSyncing,
}: {
  servers: import('@/data/types').AudiobookshelfServer[]
  pagination: Record<string, { currentPage: number; totalItems: number }>
  loadNextPage: (server: import('@/data/types').AudiobookshelfServer) => Promise<void>
  isSyncing: boolean
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  // Guard against rapid-fire IntersectionObserver callbacks
  const isLoadingRef = useRef(false)

  // Check if any server has more pages to load
  const hasMorePages = servers.some(server => {
    const pag = pagination[server.id]
    if (!pag) return false
    return (pag.currentPage + 1) * 50 < pag.totalItems
  })

  useEffect(() => {
    if (!hasMorePages || isSyncing || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isLoadingRef.current) {
          isLoadingRef.current = true
          const promises: Promise<void>[] = []
          for (const server of servers) {
            const pag = pagination[server.id]
            if (pag && (pag.currentPage + 1) * 50 < pag.totalItems) {
              promises.push(loadNextPage(server))
            }
          }
          Promise.all(promises).finally(() => {
            isLoadingRef.current = false
          })
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMorePages, isSyncing, servers, pagination, loadNextPage])

  if (!hasMorePages) return null

  return (
    <div ref={sentinelRef} data-testid="abs-pagination-sentinel">
      {isSyncing && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[24px] border border-border/50 overflow-hidden">
              <div className="aspect-[2/3] bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
