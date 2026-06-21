import { useMemo } from 'react'
import { BookOpen, Compass, Headphones, LibraryBig, Repeat2, Rows3 } from 'lucide-react'
import type { Book } from '@/data/types'
import { useBookStore } from '@/stores/useBookStore'
import { RecentBookCard } from '@/app/components/library/RecentBookCard'
import { LibraryMediaShelfRow } from '@/app/components/library/LibraryMediaShelfRow'
import type { RecentSeriesGroup } from '@/lib/libraryShelves'
import {
  getAudiobookDiscoverShelf,
  getAudiobookListenAgainShelf,
  getAudiobookRecentSeriesShelf,
  getAudiobookRecentlyAddedShelf,
  getContinueListeningShelf,
  getContinueReadingShelf,
  getEbookDiscoverShelf,
  getEbookReadAgainShelf,
  getEbookRecentSeriesShelf,
  getEbookRecentlyAddedShelf,
} from '@/lib/libraryShelves'
import { cn } from '@/app/components/ui/utils'
import { LIBRARY_SHELF_CARD_WIDTH_CLASS } from '@/app/components/library/shelfCardSizing'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { LibraryRail } from '@/app/components/library/rails/LibraryRail'
import { BookTile } from '@/app/components/library/BookTile'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'

type Mode = 'audiobooks' | 'ebooks' | 'all'

function getActiveMode(formatFilter: string[] | undefined): Mode {
  if (!formatFilter || formatFilter.length === 0) return 'all'
  if (formatFilter.length === 1 && formatFilter[0] === 'audiobook') return 'audiobooks'
  if (formatFilter.every(v => v === 'epub' || v === 'pdf')) return 'ebooks'
  return 'all'
}

function getModeBooks(allBooks: Book[], filters: { source?: string }, mode: Mode): Book[] {
  const sourceFiltered =
    filters.source && filters.source !== 'all'
      ? allBooks.filter(b => (filters.source === 'audiobookshelf' ? b.absServerId : !b.absServerId))
      : allBooks

  if (mode === 'all') return sourceFiltered
  return mode === 'audiobooks'
    ? sourceFiltered.filter(b => b.format === 'audiobook')
    : sourceFiltered.filter(b => b.format === 'epub' || b.format === 'pdf')
}

function SeriesTile({ group }: { group: RecentSeriesGroup }) {
  const covers = group.books.slice(0, 3)
  const cover0 = useBookCoverUrl({ bookId: covers[0]?.id ?? '', coverUrl: covers[0]?.coverUrl })
  const cover1 = useBookCoverUrl({ bookId: covers[1]?.id ?? '', coverUrl: covers[1]?.coverUrl })
  const cover2 = useBookCoverUrl({ bookId: covers[2]?.id ?? '', coverUrl: covers[2]?.coverUrl })
  const coverUrls = [cover0, cover1, cover2].filter(Boolean) as string[]

  return (
    <div
      className={cn('group cursor-default', LIBRARY_SHELF_CARD_WIDTH_CLASS)}
      data-testid="media-series-tile"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-card-ambient">
        {coverUrls.length > 0 ? (
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5">
            <img
              src={coverUrls[0]}
              alt=""
              className="col-span-2 row-span-1 h-full w-full object-cover rounded-xl"
            />
            {coverUrls[1] ? (
              <img src={coverUrls[1]} alt="" className="h-full w-full object-cover rounded-xl" />
            ) : (
              <div className="h-full w-full rounded-xl bg-background/40" />
            )}
            {coverUrls[2] ? (
              <img src={coverUrls[2]} alt="" className="h-full w-full object-cover rounded-xl" />
            ) : (
              <div className="h-full w-full rounded-xl bg-background/40" />
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Rows3 className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-3 px-1 text-center">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground">{group.name}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{group.books.length} book(s)</p>
      </div>
    </div>
  )
}

export function LibraryMediaShelfColumn({ onEdit }: { onEdit: (book: Book) => void }) {
  const books = useBookStore(s => s.books)
  const filters = useBookStore(s => s.filters)

  const mode = useMemo(() => getActiveMode(filters.format), [filters.format])

  const modeBooks = useMemo(() => getModeBooks(books, filters, mode), [books, filters, mode])

  const abBooks = useMemo(() => modeBooks.filter(b => b.format === 'audiobook'), [modeBooks])
  const ebBooks = useMemo(
    () => modeBooks.filter(b => b.format === 'epub' || b.format === 'pdf'),
    [modeBooks]
  )

  if (books.length === 0) return null

  if (mode === 'all') {
    return (
      <div className="flex flex-col gap-8" data-testid="library-media-shelf-column">
        {abBooks.length > 0 && (
          <LibraryRail
            icon={Headphones}
            title="Continue Listening"
            count={getContinueListeningShelf(abBooks).length}
            subtitle="Pick up where you left off"
            data-testid="media-shelf-continue-listening"
          >
            {getContinueListeningShelf(abBooks).map(book => (
              <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                <BookTile book={book} variant="denseContinue" showProgress />
              </BookContextMenu>
            ))}
          </LibraryRail>
        )}
        {ebBooks.length > 0 && (
          <LibraryRail
            icon={BookOpen}
            title="Continue Reading"
            count={getContinueReadingShelf(ebBooks).length}
            subtitle="Jump back into your latest pages"
            data-testid="media-shelf-continue-reading"
          >
            {getContinueReadingShelf(ebBooks).map(book => (
              <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                <BookTile book={book} variant="denseContinue" showProgress />
              </BookContextMenu>
            ))}
          </LibraryRail>
        )}
        {(abBooks.length > 0 || ebBooks.length > 0) && (
          <LibraryRail
            icon={LibraryBig}
            title="Recently Added"
            count={abBooks.length + ebBooks.length}
            data-testid="media-shelf-recently-added"
          >
            {[...abBooks, ...ebBooks].map(book => (
              <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                <BookTile book={book} variant="small" />
              </BookContextMenu>
            ))}
          </LibraryRail>
        )}
        {(abBooks.length > 0 || ebBooks.length > 0) && (
          <LibraryMediaShelfRow
            icon={Rows3}
            label="Recent Series"
            count={
              getAudiobookRecentSeriesShelf(abBooks).length +
              getEbookRecentSeriesShelf(ebBooks).length
            }
            data-testid="media-shelf-recent-series"
          >
            {[...getAudiobookRecentSeriesShelf(abBooks), ...getEbookRecentSeriesShelf(ebBooks)].map(
              group => (
                <SeriesTile key={group.name.toLowerCase()} group={group} />
              )
            )}
          </LibraryMediaShelfRow>
        )}
        {(abBooks.length > 0 || ebBooks.length > 0) && (
          <LibraryRail
            icon={Compass}
            title="Discover"
            count={
              getAudiobookDiscoverShelf(abBooks).length + getEbookDiscoverShelf(ebBooks).length
            }
            data-testid="media-shelf-discover"
          >
            {[...getAudiobookDiscoverShelf(abBooks), ...getEbookDiscoverShelf(ebBooks)].map(
              book => (
                <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                  <BookTile book={book} variant="small" />
                </BookContextMenu>
              )
            )}
          </LibraryRail>
        )}
        {(abBooks.length > 0 || ebBooks.length > 0) && (
          <LibraryMediaShelfRow
            icon={Repeat2}
            label="Listen & Read Again"
            count={
              getAudiobookListenAgainShelf(abBooks).length + getEbookReadAgainShelf(ebBooks).length
            }
            data-testid="media-shelf-again"
          >
            {[...getAudiobookListenAgainShelf(abBooks), ...getEbookReadAgainShelf(ebBooks)].map(
              book => (
                <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                  <RecentBookCard book={book} tone="muted" />
                </BookContextMenu>
              )
            )}
          </LibraryMediaShelfRow>
        )}
      </div>
    )
  }

  const shelves = useMemo(() => {
    if (mode === 'audiobooks') {
      return {
        continue: getContinueListeningShelf(modeBooks),
        recentlyAdded: getAudiobookRecentlyAddedShelf(modeBooks),
        recentSeries: getAudiobookRecentSeriesShelf(modeBooks),
        discover: getAudiobookDiscoverShelf(modeBooks),
        again: getAudiobookListenAgainShelf(modeBooks),
      }
    }
    return {
      continue: getContinueReadingShelf(modeBooks),
      recentlyAdded: getEbookRecentlyAddedShelf(modeBooks),
      recentSeries: getEbookRecentSeriesShelf(modeBooks),
      discover: getEbookDiscoverShelf(modeBooks),
      again: getEbookReadAgainShelf(modeBooks),
    }
  }, [mode, modeBooks])

  return (
    <div className="flex flex-col gap-8" data-testid="library-media-shelf-column">
      <LibraryRail
        icon={mode === 'audiobooks' ? Headphones : BookOpen}
        title={mode === 'audiobooks' ? 'Continue Listening' : 'Continue Reading'}
        count={shelves.continue.length}
        subtitle={
          mode === 'audiobooks' ? 'Pick up where you left off' : 'Jump back into your latest pages'
        }
        data-testid="media-shelf-continue"
      >
        {shelves.continue.map(book => (
          <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
            <BookTile book={book} variant="denseContinue" showProgress />
          </BookContextMenu>
        ))}
      </LibraryRail>

      <LibraryRail
        icon={LibraryBig}
        title="Recently Added"
        count={shelves.recentlyAdded.length}
        data-testid="media-shelf-recently-added"
      >
        {shelves.recentlyAdded.map(book => (
          <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
            <BookTile book={book} variant="small" />
          </BookContextMenu>
        ))}
      </LibraryRail>

      <LibraryMediaShelfRow
        icon={Rows3}
        label="Recent Series"
        count={shelves.recentSeries.length}
        data-testid="media-shelf-recent-series"
      >
        {shelves.recentSeries.map(group => (
          <SeriesTile key={group.name.toLowerCase()} group={group} />
        ))}
      </LibraryMediaShelfRow>

      <LibraryRail
        icon={Compass}
        title="Discover"
        count={shelves.discover.length}
        data-testid="media-shelf-discover"
      >
        {shelves.discover.map(book => (
          <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
            <BookTile book={book} variant="small" />
          </BookContextMenu>
        ))}
      </LibraryRail>

      <LibraryMediaShelfRow
        icon={Repeat2}
        label={mode === 'audiobooks' ? 'Listen Again' : 'Read Again'}
        count={shelves.again.length}
        data-testid="media-shelf-again"
      >
        {shelves.again.map(book => (
          <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
            <RecentBookCard book={book} tone="muted" />
          </BookContextMenu>
        ))}
      </LibraryMediaShelfRow>
    </div>
  )
}
