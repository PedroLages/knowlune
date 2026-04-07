/**
 * Collection detail page — faithful Stitch design implementation.
 *
 * Hero section with editorial cover collage (individual covers with rotation),
 * metadata badges, large heading, gradient CTA. Books displayed as grid cards
 * matching the library BookCard style.
 *
 * @since Library Redesign
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { BookOpen, Play, ArrowLeft, CheckCircle2, Bookmark, Grid3X3, List } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { BookCard } from '@/app/components/library/BookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { useBookStore } from '@/stores/useBookStore'
import { getCoverUrl } from '@/services/AudiobookshelfService'
import type { Book } from '@/data/types'

type SortMode = 'recent' | 'progress'

export function CollectionDetail() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const collections = useAudiobookshelfStore(s => s.collections)
  const servers = useAudiobookshelfStore(s => s.servers)
  const allBooks = useBookStore(s => s.books)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [collectionId])

  const collection = collections.find(c => c.id === collectionId)
  const server = servers.find(s => s.status === 'connected')

  const bookMap = useMemo(() => {
    if (!collection) return new Map<string, Book>()
    const index = new Map<string, Book>()
    for (const book of allBooks) {
      if (book.absItemId) index.set(book.absItemId, book)
    }
    const map = new Map<string, Book>()
    for (const absBook of collection.books) {
      const local = index.get(absBook.id)
      if (local) map.set(absBook.id, local)
    }
    return map
  }, [collection, allBooks])

  if (!collection) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 animate-in fade-in duration-300">
        <p className="text-muted-foreground">Collection not found.</p>
        <Button variant="outline" onClick={() => navigate('/library?view=collections')}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Collections
        </Button>
      </div>
    )
  }

  const total = collection.books.length
  const coverUrls = collection.books.slice(0, 4).map(b =>
    server ? getCoverUrl(server.url, b.id, server.apiKey) : null
  )
  const completedCount = collection.books.filter(b => {
    const local = bookMap.get(b.id)
    return local && (local.status === 'finished' || local.progress >= 100)
  }).length

  // Get local Book objects for BookCard rendering, sorted
  const localBooks = useMemo(() => {
    const books: Book[] = []
    for (const absBook of collection.books) {
      const local = bookMap.get(absBook.id)
      if (local) books.push(local)
    }
    if (sortMode === 'progress') {
      books.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    }
    return books
  }, [collection.books, bookMap, sortMode])

  // Staggered cover rotations for editorial feel
  const coverRotations = [
    'hover:-rotate-1',
    'translate-y-4 hover:rotate-1',
    '-translate-y-4 hover:-rotate-1',
    'hover:rotate-1',
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-8 animate-in fade-in slide-in-from-left-4 duration-400">
        <Link
          to="/library?view=collections"
          className="inline-flex items-center text-brand/60 text-sm hover:text-brand transition-colors group font-medium"
        >
          <ArrowLeft className="size-4 mr-2 transition-transform group-hover:-translate-x-1 duration-200" />
          Collections
        </Link>
      </nav>

      {/* Hero Section: Editorial Layout */}
      <section className="flex flex-col md:flex-row gap-12 items-start mb-20">
        {/* Left: 2x2 Individual Cover Collage */}
        <div className="w-full md:w-1/2 lg:w-2/5 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-8 duration-700">
          {coverUrls.map((url, i) => (
            <div
              key={i}
              className={`aspect-[3/4] rounded-sm shadow-card-ambient overflow-hidden transform ${coverRotations[i]} transition-transform duration-500`}
            >
              {url ? (
                <img
                  src={url}
                  alt={`Collection cover ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Collection Metadata */}
        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col justify-center pt-8 animate-in fade-in slide-in-from-right-8 duration-700 fill-mode-both delay-100">
          {/* Metadata badges */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold tracking-widest uppercase">
              Curated Set
            </span>
            <span className="flex items-center text-muted-foreground text-xs font-bold uppercase tracking-widest">
              <BookOpen className="size-3.5 mr-1" aria-hidden="true" />
              {total} Books
            </span>
            {completedCount > 0 && (
              <span className="flex items-center text-muted-foreground text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 className="size-3.5 mr-1" aria-hidden="true" />
                {completedCount} Completed
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-5xl lg:text-7xl font-extrabold text-foreground tracking-tight mb-6 leading-none">
            {collection.name}
          </h1>

          {/* Description */}
          {collection.description && (
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed mb-10">
              {collection.description}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => {
                const firstBook = bookMap.values().next().value
                if (firstBook) navigate(`/library/${firstBook.id}/read`)
              }}
              className="h-14 px-10 bg-gradient-to-br from-brand to-brand-hover text-brand-foreground rounded-full font-bold flex items-center justify-center gap-3 shadow-card-ambient active:scale-95 transition-all hover:brightness-110 duration-200"
            >
              <Play className="size-5" style={{ fill: 'currentColor' }} aria-hidden="true" />
              Play Collection
            </button>
            <button
              type="button"
              className="h-14 w-14 rounded-full border border-border/20 flex items-center justify-center text-brand hover:bg-brand/5 transition-colors active:scale-95 duration-200"
              aria-label="Bookmark collection"
            >
              <Bookmark className="size-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Book Grid Section */}
      <section className="animate-in fade-in slide-in-from-bottom-6 duration-500 fill-mode-both delay-300">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-xs font-bold tracking-[0.25em] text-muted-foreground uppercase">
            All Books
          </h2>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setSortMode('recent')}
              className={`text-xs font-bold uppercase tracking-widest pb-1 transition-colors ${
                sortMode === 'recent'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recently Added
            </button>
            <button
              type="button"
              onClick={() => setSortMode('progress')}
              className={`text-xs font-bold uppercase tracking-widest pb-1 transition-colors ${
                sortMode === 'progress'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Progress
            </button>
            {/* View toggle */}
            <div className="flex items-center gap-1 ml-2 border-l border-border/30 pl-4">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-brand/10 text-brand' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Grid view"
              >
                <Grid3X3 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-brand/10 text-brand' : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid view — uses BookCard (audiobooks get square covers automatically) */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {localBooks.map((book, i) => (
              <div
                key={book.id}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                style={{ animationDelay: `${400 + i * 50}ms` }}
              >
                <BookCard book={book} />
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {viewMode === 'list' && (
          <div className="flex flex-col gap-2">
            {localBooks.map((book, i) => (
              <div
                key={book.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
                style={{ animationDelay: `${400 + i * 40}ms` }}
              >
                <BookListItem book={book} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state if no local books matched */}
        {localBooks.length === 0 && total > 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Sync your library to see books from this collection.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
