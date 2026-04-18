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
 * @modified E108-S03 — keyboard shortcuts (N=import, /=search, G+L=toggle view)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { FormatTabs } from '@/app/components/library/FormatTabs'
import { LibraryShelves } from '@/app/components/library/LibraryShelves'
import { SmartGroupedView } from '@/app/components/library/SmartGroupedView'
import {
  BookOpen,
  CloudUpload,
  FolderOpen,
  Globe,
  Grid3X3,
  Headphones,
  Layers,
  Library as LibraryIcon,
  List,
  Loader2,
  Plus,
  RefreshCw,
  WifiOff,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { BookImportDialog } from '@/app/components/library/BookImportDialog'
import { SeriesCard } from '@/app/components/library/SeriesCard'
import { CollectionsView } from '@/app/components/library/CollectionsView'
import { StorageIndicator } from '@/app/components/library/StorageIndicator'
import { BookCard } from '@/app/components/library/BookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'
import { BookMetadataEditor } from '@/app/components/library/BookMetadataEditor'
import { LibraryFilters } from '@/app/components/library/LibraryFilters'
import { LibrarySourceTabs } from '@/app/components/library/LibrarySourceTabs'
import { ReadingQueue } from '@/app/components/library/ReadingQueue'
import { ShelfManager } from '@/app/components/library/ShelfManager'
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
import { useShelfStore } from '@/stores/useShelfStore'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'
import { useAudiobookshelfSync } from '@/app/hooks/useAudiobookshelfSync'
import { appEventBus } from '@/lib/eventBus'
import type { Book } from '@/data/types'
import { cn } from '@/app/components/ui/utils'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { useKeyboardShortcuts } from '@/app/hooks/useKeyboardShortcuts'

export function Library() {
  const isOnline = useOnlineStatus()
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [catalogsOpen, setCatalogsOpen] = useState(false)
  const [shelvesOpen, setShelvesOpen] = useState(false)
  const [absSettingsOpen, setAbsSettingsOpen] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserCatalogId, setBrowserCatalogId] = useState<string | undefined>()
  const books = useBookStore(s => s.books)
  const libraryView = useBookStore(s => s.libraryView)
  const localSeriesView = useBookStore(s => s.localSeriesView)
  const setLocalSeriesView = useBookStore(s => s.setLocalSeriesView)
  const filters = useBookStore(s => s.filters)
  const setFilters = useBookStore(s => s.setFilters)
  const loadBooks = useBookStore(s => s.loadBooks)

  const opdsCatalogs = useOpdsCatalogStore(s => s.catalogs)
  const loadCatalogs = useOpdsCatalogStore(s => s.loadCatalogs)

  // Audiobookshelf sync (E101-S03)
  const absServers = useAudiobookshelfStore(s => s.servers)
  const loadAbsServers = useAudiobookshelfStore(s => s.loadServers)
  const { isSyncing: isAbsSyncing, syncCatalog, loadNextPage, pagination } = useAudiobookshelfSync()

  // Series & Collections browsing (E102-S02, E102-S03)
  const [searchParams] = useSearchParams()
  const initialView = searchParams.get('view')
  const [absViewMode, setAbsViewMode] = useState<'grid' | 'series' | 'collections'>(
    initialView === 'collections' ? 'collections' : initialView === 'series' ? 'series' : 'grid'
  )

  const getBooksBySeries = useBookStore(s => s.getBooksBySeries)

  // When navigating back with ?view=collections, ensure ABS source is selected
  useEffect(() => {
    if (
      (initialView === 'collections' || initialView === 'series') &&
      filters.source !== 'audiobookshelf'
    ) {
      setFilters({ source: 'audiobookshelf' })
    }
  }, [])
  const absSeries = useAudiobookshelfStore(s => s.series)
  const isLoadingSeries = useAudiobookshelfStore(s => s.isLoadingSeries)
  const loadSeries = useAudiobookshelfStore(s => s.loadSeries)
  const loadCollections = useAudiobookshelfStore(s => s.loadCollections)

  const loadShelves = useShelfStore(s => s.loadShelves)
  const loadQueue = useReadingQueueStore(s => s.loadQueue)

  const loadGoal = useReadingGoalStore(s => s.loadGoal)
  const goal = useReadingGoalStore(s => s.goal)
  const checkYearlyGoalReached = useReadingGoalStore(s => s.checkYearlyGoalReached)

  // Library keyboard shortcuts (E108-S03)
  useKeyboardShortcuts([
    {
      key: 'n',
      description: 'Open import dialog',
      action: () => setImportOpen(true),
    },
    {
      key: '/',
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-testid="library-search-input"]'
        )
        if (searchInput) searchInput.focus()
      },
    },
    {
      key: ['g', 'l'],
      description: 'Toggle grid/list view',
      action: () => {
        // Intentional: read from store inside action to avoid stale closure
        const { libraryView: current, setLibraryView } = useBookStore.getState()
        setLibraryView(current === 'grid' ? 'list' : 'grid')
      },
    },
  ])

  // Load shelves on mount (E110-S01)
  useEffect(() => {
    loadShelves()
  }, [loadShelves])

  // Load reading queue on mount (E110-S03)
  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  // Auto-remove book from queue when it's finished (E110-S03 AC-7)
  // Intentional: reads from get() inside the callback to avoid stale closure
  useEffect(() => {
    const unsub = appEventBus.on('book:finished', event => {
      useReadingQueueStore.getState().removeFromQueue(event.bookId)
    })
    return unsub
  }, [])

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
    const newServers = absServers.filter(s => !syncedServerIds.current.has(s.id) && !s.lastSyncedAt)
    if (newServers.length > 0) {
      for (const server of newServers) {
        syncedServerIds.current.add(server.id)
      }
      newServers.forEach(server => syncCatalog(server))
    }
  }, [absServers, syncCatalog])

  // Manual sync — clears TTL cache and re-triggers full catalog sync
  const handleManualSync = useCallback(() => {
    const store = useAudiobookshelfStore.getState()
    // Clear TTL caches so series/collections re-fetch
    useAudiobookshelfStore.setState({
      seriesLoadedAt: {},
      collectionsLoadedAt: {},
    })
    // Clear synced tracking so syncCatalog runs again
    syncedServerIds.current.clear()
    // Trigger sync for all connected servers
    for (const server of store.servers) {
      syncedServerIds.current.add(server.id)
      syncCatalog(server)
    }
  }, [syncCatalog])

  // Use useBookStore.getState() to always read from the authoritative store state.
  // The previously-extracted getFilteredBooks via selector had stale get() reads on initial
  // render when books loaded async (E110-S02 regression).
  const filteredBooks = useBookStore.getState().getFilteredBooks()

  // Stable ID array so LocalSeriesView's useMemo dep doesn't fire on every render (ADV-3).
  const filteredBookIds = useMemo(() => filteredBooks.map(b => b.id), [filteredBooks])

  // Derive active format tab from the store's format filter
  const activeFormatTab = useMemo(() => {
    const f = filters.format
    if (!f || f.length === 0) return 'all' as const
    if (f.length === 1 && f[0] === 'audiobook') return 'audiobooks' as const
    if (f.every(v => v === 'epub' || v === 'pdf')) return 'ebooks' as const
    return 'all' as const
  }, [filters.format])

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
            {absServers.length > 0 &&
              (() => {
                const connectedServer = absServers.find(s => s.status === 'connected')
                const isOffline = absServers.some(s => s.status === 'offline')
                const isAuthFailed = absServers.some(s => s.status === 'auth-failed')
                return (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleManualSync}
                    disabled={isAbsSyncing}
                    className="size-11 rounded-xl relative"
                    aria-label="Sync Audiobookshelf library"
                    title={
                      isAbsSyncing
                        ? 'Syncing...'
                        : connectedServer
                          ? `Connected — last synced ${connectedServer.lastSyncedAt ? new Date(connectedServer.lastSyncedAt).toLocaleTimeString() : 'never'}`
                          : 'Sync Library'
                    }
                    data-testid="abs-sync-trigger"
                  >
                    <RefreshCw className={cn('size-5', isAbsSyncing && 'animate-spin')} />
                    {/* Status dot */}
                    <span
                      className={cn(
                        'absolute top-1 right-1 size-2.5 rounded-full border-2 border-background',
                        isAbsSyncing
                          ? 'bg-brand animate-pulse'
                          : isAuthFailed
                            ? 'bg-destructive'
                            : isOffline
                              ? 'bg-warning'
                              : connectedServer
                                ? 'bg-success'
                                : 'bg-muted'
                      )}
                    />
                  </Button>
                )
              })()}
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
              onClick={() => setShelvesOpen(true)}
              className="size-11 rounded-xl"
              aria-label="Manage shelves"
              title="Manage Shelves"
              data-testid="manage-shelves-trigger"
            >
              <LibraryIcon className="size-5" />
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

      {/* Shelf sections — Recently Added + Continue Reading from real store data */}
      {books.length > 0 && <LibraryShelves />}

      {/* Empty state */}
      {books.length === 0 && (
        <section
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-6 py-16 px-6"
        >
          {/* Illustration card with glow */}
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-brand/5 rounded-full blur-3xl scale-150" />
            <div className="relative p-6 rounded-xl bg-card shadow-card-ambient border border-border/15">
              <div className="w-48 h-64 sm:w-56 sm:h-72 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <BookOpen className="size-12" />
                  <Headphones className="size-8" />
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground text-center leading-tight">
            Your library is waiting to be filled.
          </h2>
          <p className="max-w-md text-center text-muted-foreground text-lg leading-relaxed">
            Start your next journey by importing your favorite stories or connecting to your
            existing collection.
          </p>

          {/* Two CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => setImportOpen(true)}
              className="min-h-[44px] bg-gradient-to-br from-brand to-brand-hover text-brand-foreground px-6"
              data-testid="import-first-book-cta"
            >
              <Plus className="mr-2 h-4 w-4" />
              Import Book
            </Button>
            <Button
              variant="outline"
              onClick={() => setAbsSettingsOpen(true)}
              className="min-h-[44px] border-border/15 px-6"
              data-testid="connect-abs-cta"
            >
              <Headphones className="mr-2 h-4 w-4" />
              Connect Audiobookshelf
            </Button>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              'w-full max-w-md p-6 border-2 border-dashed rounded-xl transition-colors cursor-pointer',
              isDragOver ? 'border-brand bg-brand-soft/20' : 'border-border/30'
            )}
          >
            <div className="flex flex-col items-center gap-2">
              <CloudUpload className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground font-medium">
                Or drag and drop your files here
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Reading Queue — always visible when books exist (E110-S03 AC-1) */}
      {books.length > 0 && <ReadingQueue />}

      {/* Source filter tabs — only show when ABS servers configured (E101-S03) */}
      {books.length > 0 && <LibrarySourceTabs />}

      {/* Format tabs — hidden for ABS Series/Collections views (server-driven, not filterable) */}
      {books.length > 0 &&
        !(filters.source === 'audiobookshelf' && absViewMode !== 'grid') && (
        <FormatTabs />
      )}

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
          <button
            role="tab"
            aria-selected={absViewMode === 'collections'}
            onClick={() => {
              setAbsViewMode('collections')
              // Lazy-load collections on first selection
              const connectedServer = absServers.find(s => s.status === 'connected')
              if (connectedServer) {
                loadCollections(connectedServer.id)
              }
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              absViewMode === 'collections'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="abs-view-collections"
          >
            <FolderOpen className="size-3.5" aria-hidden="true" />
            Collections
          </button>
        </div>
      )}

      {/* Local/All series toggle (E110-S02) — when NOT in ABS source view */}
      {books.length > 0 && filters.source !== 'audiobookshelf' && (
        <div
          className="flex gap-1 rounded-lg bg-muted p-1 w-fit"
          role="tablist"
          aria-label="Library view mode"
          data-testid="local-view-toggle"
        >
          <button
            role="tab"
            aria-selected={!localSeriesView && libraryView === 'grid'}
            onClick={() => {
              setLocalSeriesView(false)
              useBookStore.getState().setLibraryView('grid')
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              !localSeriesView && libraryView === 'grid'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="local-view-grid"
          >
            <Grid3X3 className="size-3.5" aria-hidden="true" />
            Grid
          </button>
          <button
            role="tab"
            aria-selected={!localSeriesView && libraryView === 'list'}
            onClick={() => {
              setLocalSeriesView(false)
              useBookStore.getState().setLibraryView('list')
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              !localSeriesView && libraryView === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="local-view-list"
          >
            <List className="size-3.5" aria-hidden="true" />
            List
          </button>
          <button
            role="tab"
            aria-selected={localSeriesView}
            onClick={() => setLocalSeriesView(true)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px]',
              localSeriesView
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid="local-view-series"
          >
            <Layers className="size-3.5" aria-hidden="true" />
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

      {/* Collections view (E102-S03) — replaces grid when active */}
      {books.length > 0 && filters.source === 'audiobookshelf' && absViewMode === 'collections' && (
        <CollectionsView />
      )}

      {/* Smart grouped view — series view OR "All" format tab in grid/list (prevents mixed aspect ratios) */}
      {books.length > 0 &&
        filters.source !== 'audiobookshelf' &&
        (localSeriesView || activeFormatTab === 'all') && (
        <SmartGroupedView
          getBooksBySeries={getBooksBySeries}
          onEdit={setEditingBook}
          filteredBookIds={filteredBookIds}
          formatTab={activeFormatTab}
          viewMode={libraryView}
        />
      )}

      {/* Grid view — specific format tabs OR ABS grid (SmartGroupedView handles local "All" tab) */}
      {books.length > 0 &&
        libraryView === 'grid' &&
        !localSeriesView &&
        (activeFormatTab !== 'all' || filters.source === 'audiobookshelf') &&
        !(
          filters.source === 'audiobookshelf' &&
          (absViewMode === 'series' || absViewMode === 'collections')
        ) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredBooks.map(book => (
              <BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>
                <BookCard book={book} />
              </BookContextMenu>
            ))}
          </div>
        )}

      {/* List view — specific format tabs OR ABS list (SmartGroupedView handles local "All" tab) */}
      {books.length > 0 &&
        libraryView === 'list' &&
        !localSeriesView &&
        (activeFormatTab !== 'all' || filters.source === 'audiobookshelf') &&
        !(
          filters.source === 'audiobookshelf' &&
          (absViewMode === 'series' || absViewMode === 'collections')
        ) && (
          <div className="flex flex-col gap-2">
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

      {/* No results message — hidden when local series view handles its own empty state */}
      {books.length > 0 && filteredBooks.length === 0 && !localSeriesView && (
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

      <ShelfManager open={shelvesOpen} onOpenChange={setShelvesOpen} />
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
