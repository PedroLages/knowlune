import { useMemo } from 'react'
import { CheckCircle2, Clock3, Headphones, NotebookPen } from 'lucide-react'
import { LibraryShelfRow } from '@/app/components/library/LibraryShelfRow'
import { ContinueShelfTile } from '@/app/components/library/ContinueShelfTile'
import { RecentBookCard } from '@/app/components/library/RecentBookCard'
import { useBookStore } from '@/stores/useBookStore'
import {
  getContinueListeningShelf,
  getContinueReadingShelf,
  getRecentlyAddedShelf,
  getRecentlyFinishedShelf,
} from '@/lib/libraryShelves'

const CONTINUE_LISTENING_HEADING_ID = 'shelf-continue-listening-heading'
const CONTINUE_READING_HEADING_ID = 'shelf-continue-reading-heading'
const RECENTLY_ADDED_HEADING_ID = 'shelf-recently-added-heading'
const RECENTLY_FINISHED_HEADING_ID = 'shelf-recently-finished-heading'

export function LibraryShelves() {
  const books = useBookStore(s => s.books)
  const continueListening = useMemo(() => getContinueListeningShelf(books), [books])
  const continueReading = useMemo(() => getContinueReadingShelf(books), [books])
  const recentlyAdded = useMemo(() => getRecentlyAddedShelf(books), [books])
  const recentlyFinished = useMemo(() => getRecentlyFinishedShelf(books), [books])

  if (books.length === 0) return null

  return (
    <div className="space-y-8" data-testid="library-shelves">
      <LibraryShelfRow
        icon={Headphones}
        label="Continue Listening"
        count={continueListening.length}
        subtitle="Pick up where you left off"
        headingLevel="h2"
        headingId={CONTINUE_LISTENING_HEADING_ID}
        data-testid="shelf-continue-listening"
      >
        {continueListening.map(book => (
          <ContinueShelfTile key={book.id} book={book} />
        ))}
      </LibraryShelfRow>

      <LibraryShelfRow
        icon={NotebookPen}
        label="Continue Reading"
        count={continueReading.length}
        subtitle="Jump back into your latest pages"
        headingLevel="h2"
        headingId={CONTINUE_READING_HEADING_ID}
        data-testid="shelf-continue-reading"
      >
        {continueReading.map(book => (
          <ContinueShelfTile key={book.id} book={book} />
        ))}
      </LibraryShelfRow>

      <LibraryShelfRow
        icon={Clock3}
        label="Recently Added"
        count={recentlyAdded.length}
        headingLevel="h2"
        headingId={RECENTLY_ADDED_HEADING_ID}
        data-testid="shelf-recently-added"
      >
        {recentlyAdded.map(book => (
          <RecentBookCard key={book.id} book={book} />
        ))}
      </LibraryShelfRow>

      <LibraryShelfRow
        icon={CheckCircle2}
        label="Recently Finished"
        count={recentlyFinished.length}
        headingLevel="h2"
        headingId={RECENTLY_FINISHED_HEADING_ID}
        data-testid="shelf-recently-finished"
      >
        {recentlyFinished.map(book => (
          <RecentBookCard key={book.id} book={book} />
        ))}
      </LibraryShelfRow>

    </div>
  )
}
