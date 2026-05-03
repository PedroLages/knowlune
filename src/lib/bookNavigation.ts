/**
 * Single-source book destination path.
 *
 * Determines the route a book navigates to, matching the canonical behavior
 * established in BookCard:
 *  - Audiobook/EPUB → `/library/:id/read` (enters the reader surface)
 *  - PDF → `/library/:id` (library detail; no reader)
 *
 * Any code that constructs a book navigation target (cards, palette handlers,
 * chat citations, etc.) should import this helper rather than duplicating the
 * conditional inline.
 *
 * @since fix: search-palette-library-ux (2026-05-03)
 */
import type { Book } from '@/data/types'

export function getBookDestinationPath(book: Book): string {
  if (book.format === 'epub' || book.format === 'audiobook') {
    return `/library/${book.id}/read`
  }
  return `/library/${book.id}`
}
