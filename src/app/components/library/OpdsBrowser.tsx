/**
 * OpdsBrowser -- full-screen dialog for browsing OPDS catalog entries.
 *
 * Supports:
 * - Catalog selector (when multiple catalogs connected)
 * - Grid/list display of book entries with cover, title, author, format, summary
 * - Pagination via OPDS `next` link
 * - Nested feed navigation with breadcrumb trail
 * - "Add to Library" action creating remote-source Book records
 *
 * @module OpdsBrowser
 * @since E88-S02
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Globe,
  Library,
  Loader2,
  Plus,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useOpdsCatalogStore } from '@/stores/useOpdsCatalogStore'
import { useBookStore } from '@/stores/useBookStore'
import {
  fetchCatalogEntries,
  getFormatLabel,
  type OpdsEntry,
  type OpdsNavigationLink,
  type OpdsBreadcrumb,
} from '@/services/OpdsService'
import type { Book, OpdsCatalog } from '@/data/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpdsBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a specific catalog on open */
  initialCatalogId?: string
}

interface FeedState {
  entries: OpdsEntry[]
  navigationLinks: OpdsNavigationLink[]
  nextPageUrl?: string
  feedTitle: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Determine best format for a book from its acquisition links */
function getBookFormat(entry: OpdsEntry): 'epub' | 'pdf' | 'audiobook' {
  for (const link of entry.acquisitionLinks) {
    if (link.type.includes('epub')) return 'epub'
    if (link.type.includes('pdf')) return 'pdf'
    if (link.type.includes('audio')) return 'audiobook'
  }
  // Unable to determine format from MIME types — default to 'pdf' as a safe fallback.
  // Callers should treat this as a best-effort guess when no recognised MIME type is present.
  return 'pdf'
}

/** Check if a book from this OPDS entry already exists in the library */
function isAlreadyInLibrary(entry: OpdsEntry, books: Book[]): boolean {
  return books.some(b => {
    // Check by OPDS ID match in source URL
    if (b.source.type === 'remote') {
      const sourceUrl = (b.source as { type: 'remote'; url: string }).url
      if (entry.acquisitionLinks.some(l => sourceUrl === l.href)) {
        return true
      }
    }
    // Fallback: title + author match (case-insensitive)
    return (
      b.title.toLowerCase() === entry.title.toLowerCase() &&
      b.author.toLowerCase() === entry.author.toLowerCase()
    )
  })
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function EntrySkeletons() {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      data-testid="opds-browser-skeleton"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-[2/3] rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── Navigation Entry Card ────────────────────────────────────────────────────

function NavigationCard({
  link,
  onNavigate,
}: {
  link: OpdsNavigationLink
  onNavigate: (href: string, title: string) => void
}) {
  return (
    <button
      onClick={() => onNavigate(link.href, link.title)}
      className="flex items-center gap-3 rounded-xl bg-card p-4 text-left shadow-card-ambient hover:-translate-y-1 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
      data-testid={`opds-nav-link-${link.title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Library className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium text-foreground truncate">{link.title}</span>
      <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" aria-hidden="true" />
    </button>
  )
}

// ─── Book Entry Card ──────────────────────────────────────────────────────────

function OpdsBookCard({
  entry,
  alreadyAdded,
  onAdd,
  isAdding,
}: {
  entry: OpdsEntry
  alreadyAdded: boolean
  onAdd: (entry: OpdsEntry) => void
  isAdding: boolean
}) {
  const formatLabel = getFormatLabel(entry.acquisitionLinks)

  return (
    <div
      className="flex flex-col rounded-[24px] bg-card overflow-hidden shadow-card-ambient hover:-translate-y-2 transition-all duration-300"
      data-testid={`opds-entry-${entry.id}`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {entry.thumbnailUrl || entry.coverUrl ? (
          <img
            src={entry.thumbnailUrl || entry.coverUrl}
            alt={`Cover of ${entry.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Globe className="size-8 text-muted-foreground/40" aria-hidden="true" />
          </div>
        )}
        {/* Format badge */}
        {formatLabel && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {formatLabel}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3 flex-1">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {entry.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{entry.author}</p>
        {entry.summary && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
            {entry.summary}
          </p>
        )}
      </div>

      {/* Add button */}
      <div className="px-3 pb-3">
        <Button
          variant={alreadyAdded ? 'outline' : 'brand-outline'}
          size="sm"
          disabled={alreadyAdded || isAdding}
          onClick={() => onAdd(entry)}
          className="w-full min-h-[44px]"
          aria-label={
            alreadyAdded ? `${entry.title} already in library` : `Add ${entry.title} to library`
          }
          data-testid={`opds-add-${entry.id}`}
        >
          {isAdding ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : alreadyAdded ? (
            <Check className="mr-1.5 size-3.5" />
          ) : (
            <Plus className="mr-1.5 size-3.5" />
          )}
          {alreadyAdded ? 'In Library' : 'Add to Library'}
        </Button>
      </div>
    </div>
  )
}

// ─── Breadcrumb Trail ─────────────────────────────────────────────────────────

function BreadcrumbTrail({
  breadcrumbs,
  currentTitle,
  onNavigate,
}: {
  breadcrumbs: OpdsBreadcrumb[]
  currentTitle: string
  onNavigate: (index: number) => void
}) {
  if (breadcrumbs.length === 0) return null

  return (
    <nav
      aria-label="Catalog breadcrumb"
      className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest flex-wrap"
    >
      {breadcrumbs.map((crumb, index) => (
        <span key={index} className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(index)}
            className="text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded px-0.5"
          >
            {crumb.title}
          </button>
          <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
        </span>
      ))}
      <span className="text-muted-foreground font-medium truncate">{currentTitle}</span>
    </nav>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OpdsBrowser({ open, onOpenChange, initialCatalogId }: OpdsBrowserProps) {
  const catalogs = useOpdsCatalogStore(s => s.catalogs)
  const loadCatalogs = useOpdsCatalogStore(s => s.loadCatalogs)
  const books = useBookStore(s => s.books)
  const importBook = useBookStore(s => s.importBook)

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedState, setFeedState] = useState<FeedState | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<OpdsBreadcrumb[]>([])
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  const selectedCatalog = useMemo(
    () => catalogs.find(c => c.id === selectedCatalogId),
    [catalogs, selectedCatalogId]
  )

  // Load catalogs on open
  useEffect(() => {
    if (open) {
      loadCatalogs()
    }
  }, [open, loadCatalogs])

  // Auto-select catalog
  useEffect(() => {
    if (!open) return
    if (initialCatalogId) {
      setSelectedCatalogId(initialCatalogId)
    } else if (catalogs.length === 1) {
      setSelectedCatalogId(catalogs[0].id)
    }
  }, [open, catalogs, initialCatalogId])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFeedState(null)
      setBreadcrumbs([])
      setError(null)
      setSelectedCatalogId('')
      setAddingIds(new Set())
    }
  }, [open])

  // Track current feed URL for breadcrumb navigation
  const [currentFeedUrl, setCurrentFeedUrl] = useState<string>('')

  const fetchFeed = useCallback(async (url: string, catalog: OpdsCatalog) => {
    setIsLoading(true)
    setError(null)
    setFeedState(null)

    const result = await fetchCatalogEntries(url, catalog.auth)

    if (result.ok) {
      setFeedState({
        entries: result.entries,
        navigationLinks: result.navigationLinks,
        nextPageUrl: result.nextPageUrl,
        feedTitle: result.feedTitle,
      })
    } else {
      setError(result.error)
    }

    setIsLoading(false)
  }, [])

  // Fetch root feed when catalog selected or catalogs list changes.
  // `catalogs` is included to avoid a stale-closure if the catalog record is
  // updated (e.g. URL / auth changed) without the selected ID changing.
  useEffect(() => {
    if (!selectedCatalog) return
    setCurrentFeedUrl(selectedCatalog.url)
    setBreadcrumbs([])
    fetchFeed(selectedCatalog.url, selectedCatalog)
  }, [selectedCatalogId, catalogs, fetchFeed])

  const handleNavigateToFeed = useCallback(
    (href: string, _title: string) => {
      if (!selectedCatalog || !feedState) return

      // Push current feed to breadcrumbs before navigating
      setBreadcrumbs(prev => [
        ...prev,
        { title: feedState.feedTitle, url: currentFeedUrl || selectedCatalog.url },
      ])

      setCurrentFeedUrl(href)
      fetchFeed(href, selectedCatalog)
    },
    [selectedCatalog, feedState, currentFeedUrl, fetchFeed]
  )

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      if (!selectedCatalog) return
      const crumb = breadcrumbs[index]
      if (!crumb) return

      setBreadcrumbs(prev => prev.slice(0, index))
      setCurrentFeedUrl(crumb.url)
      fetchFeed(crumb.url, selectedCatalog)
    },
    [breadcrumbs, selectedCatalog, fetchFeed]
  )

  const handleGoBack = useCallback(() => {
    if (breadcrumbs.length === 0 || !selectedCatalog) return
    const lastCrumb = breadcrumbs[breadcrumbs.length - 1]
    setBreadcrumbs(prev => prev.slice(0, -1))
    setCurrentFeedUrl(lastCrumb.url)
    fetchFeed(lastCrumb.url, selectedCatalog)
  }, [breadcrumbs, selectedCatalog, fetchFeed])

  const handleLoadMore = useCallback(async () => {
    if (!feedState?.nextPageUrl || !selectedCatalog) return

    setIsLoadingMore(true)
    const result = await fetchCatalogEntries(feedState.nextPageUrl, selectedCatalog.auth)

    if (result.ok) {
      setFeedState(prev =>
        prev
          ? {
              ...prev,
              entries: [...prev.entries, ...result.entries],
              navigationLinks: [...prev.navigationLinks, ...result.navigationLinks],
              nextPageUrl: result.nextPageUrl,
            }
          : null
      )
    } else {
      toast.error(result.error)
    }

    setIsLoadingMore(false)
  }, [feedState, selectedCatalog])

  const handleAddToLibrary = useCallback(
    async (entry: OpdsEntry) => {
      if (!selectedCatalog) return
      if (isAlreadyInLibrary(entry, books)) {
        toast.info(`"${entry.title}" is already in your library.`)
        return
      }

      setAddingIds(prev => new Set(prev).add(entry.id))

      const primaryLink = entry.acquisitionLinks[0]
      if (!primaryLink) {
        toast.error('No download link available for this book.')
        setAddingIds(prev => {
          const next = new Set(prev)
          next.delete(entry.id)
          return next
        })
        return
      }

      const book: Book = {
        id: crypto.randomUUID(),
        title: entry.title,
        author: entry.author,
        format: getBookFormat(entry),
        status: 'unread',
        coverUrl: entry.coverUrl || entry.thumbnailUrl,
        description: entry.summary || undefined,
        tags: [],
        chapters: [],
        source: {
          type: 'remote',
          url: primaryLink.href,
          // Auth credentials are copied from the catalog into the Book record at
          // import time. This is intentional for the local-first architecture where
          // credentials never leave the device. The trade-off is that if the catalog
          // credentials change, existing books will retain stale creds until the user
          // re-imports them. Credential refresh / re-sync from catalog is tracked as
          // future work (look up at read-time via catalogId).
          auth: selectedCatalog.auth
            ? { username: selectedCatalog.auth.username, password: selectedCatalog.auth.password }
            : undefined,
        },
        progress: 0,
        createdAt: new Date().toISOString(),
      }

      try {
        await importBook(book)
        toast.success(`"${entry.title}" added to your library`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add book to library.'
        toast.error(message)
      } finally {
        setAddingIds(prev => {
          const next = new Set(prev)
          next.delete(entry.id)
          return next
        })
      }
    },
    [selectedCatalog, books, importBook]
  )

  const hasContent =
    feedState && (feedState.entries.length > 0 || feedState.navigationLinks.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl h-[85vh] flex flex-col"
        aria-describedby="opds-browser-description"
        data-testid="opds-browser-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Browse Catalog</DialogTitle>
          <DialogDescription id="opds-browser-description">
            Browse your OPDS catalog and add books to your library.
          </DialogDescription>
        </DialogHeader>

        {/* Catalog selector */}
        {catalogs.length > 1 && (
          <div className="shrink-0">
            <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
              <SelectTrigger className="w-full" aria-label="Select catalog">
                <SelectValue placeholder="Select a catalog..." />
              </SelectTrigger>
              <SelectContent>
                {catalogs.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Breadcrumb + back */}
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              className="size-11 shrink-0"
              aria-label="Go back"
              data-testid="opds-browser-back"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <BreadcrumbTrail
              breadcrumbs={breadcrumbs}
              currentTitle={feedState?.feedTitle || 'Loading...'}
              onNavigate={handleBreadcrumbNavigate}
            />
          </div>
        )}

        {/* Content area */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* No catalog selected */}
          {!selectedCatalogId && catalogs.length > 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Globe className="size-12 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Select a catalog to browse.</p>
            </div>
          )}

          {/* No catalogs configured */}
          {catalogs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Globe className="size-12 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No catalogs connected.</p>
              <p className="text-xs text-muted-foreground">
                Add an OPDS catalog in settings first.
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && <EntrySkeletons />}

          {/* Error */}
          {error && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                onClick={() => selectedCatalog && fetchFeed(selectedCatalog.url, selectedCatalog)}
                className="min-h-[44px]"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Navigation links (sub-feeds) */}
          {!isLoading && feedState && feedState.navigationLinks.length > 0 && (
            <div className="mb-6">
              {feedState.entries.length > 0 && (
                <h3 className="text-sm font-medium text-foreground mb-3">Categories</h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {feedState.navigationLinks.map((link, i) => (
                  <NavigationCard
                    key={`${link.href}-${i}`}
                    link={link}
                    onNavigate={handleNavigateToFeed}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Book entries grid */}
          {!isLoading && feedState && feedState.entries.length > 0 && (
            <>
              {feedState.navigationLinks.length > 0 && (
                <h3 className="text-sm font-medium text-foreground mb-3">Books</h3>
              )}
              <div
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                data-testid="opds-entries-grid"
              >
                {feedState.entries.map(entry => (
                  <OpdsBookCard
                    key={entry.id}
                    entry={entry}
                    alreadyAdded={isAlreadyInLibrary(entry, books)}
                    onAdd={handleAddToLibrary}
                    isAdding={addingIds.has(entry.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty feed */}
          {!isLoading && feedState && !hasContent && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Globe className="size-12 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">This feed is empty.</p>
            </div>
          )}

          {/* Load More button */}
          {!isLoading && feedState?.nextPageUrl && (
            <div className="flex justify-center mt-6 mb-4">
              <Button
                variant="brand-outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="min-h-[44px]"
                data-testid="opds-load-more"
              >
                {isLoadingMore ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Cloud className="mr-2 size-4" />
                )}
                Load More
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
