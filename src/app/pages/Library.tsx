/**
 * Library page — book management and reading.
 *
 * Placeholder for E83-S01: shows empty state only.
 * Grid/list views, import, and reader added in subsequent stories.
 *
 * @since E83-S01
 */

import { Library as LibraryIcon } from 'lucide-react'

export function Library() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
        <LibraryIcon className="h-8 w-8 text-brand-soft-foreground" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Your Library</h1>
      <p className="max-w-sm text-center text-muted-foreground">
        Import your first book to get started. Supports EPUB, PDF, and audiobook formats.
      </p>
    </div>
  )
}
