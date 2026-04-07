/**
 * Collection card matching Stitch design — two visual modes:
 *
 * **Expanded**: horizontal split (cover collage LEFT, book list RIGHT),
 *   spans 2 grid columns on xl+, includes gradient "Play Collection" CTA.
 *   Book rows animate in with staggered fade+slide.
 *
 * **Collapsed**: compact vertical card (cover grid, name, count, arrow).
 *   Hover lifts card with shadow intensification.
 *
 * @since E102-S03
 * @modified Library Redesign — faithful Stitch implementation + animations
 */

import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Play, ArrowRight } from 'lucide-react'
import type { AbsCollection, Book } from '@/data/types'
import { CoverCollageGrid } from '@/app/components/library/CoverCollageGrid'
import { useBookStore } from '@/stores/useBookStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { getCoverUrl } from '@/services/AudiobookshelfService'

interface CollectionCardProps {
  collection: AbsCollection
  expanded?: boolean
  onExpand?: () => void
}

export const CollectionCard = memo(function CollectionCard({
  collection,
  expanded = false,
  onExpand,
}: CollectionCardProps) {
  const navigate = useNavigate()
  const allBooks = useBookStore(s => s.books)
  const servers = useAudiobookshelfStore(s => s.servers)

  const bookMap = useMemo(() => {
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
  }, [collection.books, allBooks])

  const total = collection.books.length
  const server = servers.find(s => s.status === 'connected')
  const coverUrls = collection.books.slice(0, 4).map(b =>
    server ? getCoverUrl(server.url, b.id, server.apiKey) : null
  )

  // ── Collapsed (compact vertical) ──────────────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="bg-card rounded-xl p-6 shadow-card-ambient flex flex-col gap-6 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 ease-out cursor-pointer group text-left w-full animate-in fade-in slide-in-from-bottom-4 duration-500"
        data-testid={`collection-card-${collection.id}`}
        aria-label={`${collection.name} collection, ${total} ${total === 1 ? 'audiobook' : 'audiobooks'}`}
      >
        <div className="overflow-hidden rounded-lg">
          <CoverCollageGrid
            coverUrls={coverUrls}
            alt={`${collection.name} collection covers`}
            className="w-full shadow-card-ambient"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground group-hover:text-brand transition-colors duration-200">
            {collection.name}
          </h2>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-medium text-muted-foreground">
              {total} {total === 1 ? 'Book' : 'Books'}
            </span>
            <ArrowRight className="size-5 text-brand group-hover:translate-x-1.5 transition-transform duration-300" aria-hidden="true" />
          </div>
        </div>
      </button>
    )
  }

  // ── Expanded (horizontal split) ───────────────────────────────────────
  return (
    <div
      className="bg-card rounded-xl shadow-card-ambient overflow-hidden p-8 flex flex-col md:flex-row gap-10 animate-in fade-in zoom-in-95 duration-400"
      data-testid={`collection-card-${collection.id}`}
    >
      {/* Left: Cover collage + collection info + CTA */}
      <div className="md:w-1/3 flex-shrink-0 animate-in slide-in-from-left-6 duration-500">
        <div className="overflow-hidden rounded-lg">
          <CoverCollageGrid
            coverUrls={coverUrls}
            alt={`${collection.name} collection covers`}
            className="w-full aspect-[3/4] shadow-card-ambient"
          />
        </div>
        <div className="mt-6">
          <h2 className="text-3xl font-bold text-foreground leading-tight">{collection.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
            <BookOpen className="size-4" aria-hidden="true" />
            {total} {total === 1 ? 'Book' : 'Books'}
          </p>
          {collection.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {collection.description}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate(`/library/collection/${collection.id}`)}
            className="mt-6 w-full py-4 bg-gradient-to-r from-brand to-brand-hover text-brand-foreground font-bold rounded-full shadow-lg shadow-brand/20 flex items-center justify-center gap-2 hover:scale-[1.03] hover:shadow-xl hover:shadow-brand/30 active:scale-[0.98] transition-all duration-200"
            data-testid={`collection-play-${collection.id}`}
          >
            <Play className="size-5" style={{ fill: 'currentColor' }} aria-hidden="true" />
            Play Collection
          </button>
        </div>
      </div>

      {/* Right: Book list */}
      <div className="flex-grow animate-in slide-in-from-right-6 duration-500 fill-mode-both delay-150">
        <h3 className="font-bold text-lg mb-6 border-b border-border/30 pb-4">
          Inside this Collection
        </h3>
        <div className="space-y-6">
          {collection.books.slice(0, 3).map((absBook, i) => {
            const localBook = bookMap.get(absBook.id)
            const progress = localBook?.progress ?? 0
            const isFinished = localBook && (localBook.status === 'finished' || localBook.progress >= 100)
            const title = absBook.media.metadata.title
            const author = absBook.media.metadata.authorName ||
              absBook.media.metadata.authors?.map(a => a.name).join(', ') || ''

            return (
              <div
                key={absBook.id}
                className="flex items-center gap-4 group cursor-pointer rounded-lg p-2 -m-2 hover:bg-muted/30 transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
                style={{ animationDelay: `${200 + i * 100}ms` }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (localBook) navigate(`/library/${localBook.id}/read`)
                }}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && localBook) {
                    e.preventDefault()
                    navigate(`/library/${localBook.id}/read`)
                  }
                }}
              >
                <div className="w-16 h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow duration-200">
                  {server ? (
                    <img
                      src={getCoverUrl(server.url, absBook.id, server.apiKey)}
                      alt={`Cover of ${title}`}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="text-sm font-bold text-foreground leading-tight group-hover:text-brand transition-colors duration-200 truncate">
                    {title}
                  </h4>
                  {author && <p className="text-sm text-muted-foreground truncate">{author}</p>}
                  <div className="mt-2 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-bold ${progress > 0 ? 'text-brand' : 'text-muted-foreground'}`}>
                    {isFinished ? 'Done' : progress > 0 ? `${progress}%` : 'Unplayed'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        {total > 3 && (
          <button
            type="button"
            onClick={() => navigate(`/library/collection/${collection.id}`)}
            className="mt-6 text-sm font-medium text-brand hover:underline hover:translate-x-1 transition-all duration-200"
          >
            +{total - 3} more &middot; View All
          </button>
        )}
      </div>
    </div>
  )
})
