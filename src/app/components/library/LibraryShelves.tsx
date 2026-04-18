/**
 * LibraryShelves — integration wrapper that renders the Library page's shelf
 * section using the E116 shelf primitives (`LibraryShelfHeading`,
 * `LibraryShelfRow`, `ShelfSeeAllLink`).
 *
 * Scope (E116-S03):
 * - Renders two demonstration shelves ("Recently Added", "Continue Reading")
 *   driven by static mock data so the shelf primitives are visible on the
 *   Library route regardless of real-books state.
 * - Each shelf is wrapped in its own `<section aria-labelledby>` pointing at
 *   the heading's deterministic `id` for proper landmark/outline structure.
 * - Top-level shelves use `h2` (page `h1` lives in `Library.tsx`).
 * - Uses only design tokens; no hardcoded colors.
 *
 * Intentionally extracted from `Library.tsx` so the shelf section stays
 * testable in isolation and additive to the existing page logic (stores,
 * ABS sync, OPDS, queues, goals remain untouched).
 *
 * @since E116-S03
 */

import { Clock, History } from 'lucide-react'
import {
  LibraryShelfRow,
  ShelfSeeAllLink,
} from '@/app/components/library'

interface MockShelfItem {
  id: string
  title: string
  author: string
  format: 'epub' | 'audiobook'
}

const recentlyAddedMock: MockShelfItem[] = [
  { id: 'mock-recent-1', title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', format: 'epub' },
  { id: 'mock-recent-2', title: 'Deep Work', author: 'Cal Newport', format: 'audiobook' },
  { id: 'mock-recent-3', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', format: 'epub' },
  { id: 'mock-recent-4', title: 'Atomic Habits', author: 'James Clear', format: 'audiobook' },
]

const continueReadingMock: MockShelfItem[] = [
  { id: 'mock-continue-1', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', format: 'epub' },
  { id: 'mock-continue-2', title: 'Sapiens', author: 'Yuval Noah Harari', format: 'audiobook' },
  { id: 'mock-continue-3', title: 'The Mom Test', author: 'Rob Fitzpatrick', format: 'epub' },
]

/**
 * Minimal, self-contained shelf tile used for the demonstration shelves.
 *
 * Deliberately decoupled from `BookCard`/`RecentBookCard` so the mock shelves
 * do not synthesize full `Book` records or reach into stores / navigation
 * hooks. Uses only design tokens.
 */
function ShelfMockTile({ item }: { item: MockShelfItem }) {
  return (
    <div
      className="w-36 sm:w-40 flex flex-col gap-2"
      data-testid={`shelf-mock-tile-${item.id}`}
    >
      <div className="aspect-[2/3] rounded-xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-wide">
        {item.format === 'audiobook' ? 'Audio' : 'Ebook'}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{item.author}</p>
      </div>
    </div>
  )
}

const RECENTLY_ADDED_HEADING_ID = 'shelf-recently-added-heading'
const CONTINUE_READING_HEADING_ID = 'shelf-continue-reading-heading'

export function LibraryShelves() {
  return (
    <div className="space-y-8" data-testid="library-shelves">
      <section aria-labelledby={RECENTLY_ADDED_HEADING_ID}>
        <LibraryShelfRow
          icon={Clock}
          label="Recently Added"
          headingLevel="h2"
          headingId={RECENTLY_ADDED_HEADING_ID}
          data-testid="shelf-recently-added"
          actionSlot={<ShelfSeeAllLink />}
        >
          {recentlyAddedMock.map(item => (
            <ShelfMockTile key={item.id} item={item} />
          ))}
        </LibraryShelfRow>
      </section>

      <section aria-labelledby={CONTINUE_READING_HEADING_ID}>
        <LibraryShelfRow
          icon={History}
          label="Continue Reading"
          headingLevel="h2"
          headingId={CONTINUE_READING_HEADING_ID}
          data-testid="shelf-continue-reading"
          actionSlot={<ShelfSeeAllLink />}
        >
          {continueReadingMock.map(item => (
            <ShelfMockTile key={item.id} item={item} />
          ))}
        </LibraryShelfRow>
      </section>
    </div>
  )
}
