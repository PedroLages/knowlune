/**
 * useUnifiedSearchIndex — reactive wrapper around `src/lib/unifiedSearch`.
 *
 * Responsibilities
 *  - Kick off the initial boot-time index build once (via `main.tsx`'s
 *    `deferInit`, not this hook — the hook observes the existing module-level
 *    singleton).
 *  - Subscribe to every source table with `useLiveQuery` so writes anywhere
 *    in Dexie flow into the index.
 *  - Maintain per-table `Map<id, updatedAt>` snapshots in refs; on each new
 *    snapshot, compute added / updated / removed docs and apply them via the
 *    imperative `addToIndex` / `updateInIndex` / `removeFromIndex` helpers.
 *  - Debounce update batches (trailing 300ms) so bulk imports don't thrash.
 *  - Expose `{ ready, search }`. `ready` flips true once `initializeUnifiedSearch`
 *    has been called at least once (the initial boot path). Queries before
 *    ready return `[]`.
 *
 * Authors follow `getMergedAuthors` so the unified index matches what the
 * Authors page renders (pre-seeded + imported).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { getMergedAuthors } from '@/lib/authors'
import {
  search as unifiedSearch,
  addToIndex,
  updateInIndex,
  removeFromIndex,
  isInitialized,
  toSearchableCourse,
  toSearchableLesson,
  toSearchableAuthor,
  toSearchableBook,
  toSearchableNote,
  toSearchableHighlight,
  type EntityType,
  type SearchableDoc,
  type SearchOptions,
  type UnifiedSearchResult,
} from '@/lib/unifiedSearch'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedAuthor,
  Book,
  BookHighlight,
  Note,
} from '@/data/types'

// 300ms trailing debounce keeps bulk writes from thrashing the index.
const UPDATE_DEBOUNCE_MS = 300

type ToDocFn<T> = (row: T) => SearchableDoc
type SnapshotMap = Map<string, string | undefined>

interface TableDiff<T> {
  added: T[]
  updated: T[]
  removedIds: string[]
}

/**
 * Diff the new snapshot against the previously-seen one.
 * Added: id not in `prev`. Updated: id exists, `updatedAt` changed.
 * Removed: id in `prev`, not in `next`.
 *
 * Exported only for unit testing.
 */
export function diffSnapshot<T extends { id: string; updatedAt?: string }>(
  next: T[],
  prev: SnapshotMap
): TableDiff<T> {
  const added: T[] = []
  const updated: T[] = []
  const nextIds = new Set<string>()

  for (const row of next) {
    nextIds.add(row.id)
    const prevUpdatedAt = prev.get(row.id)
    if (prevUpdatedAt === undefined && !prev.has(row.id)) {
      added.push(row)
    } else if (prevUpdatedAt !== row.updatedAt) {
      updated.push(row)
    }
  }

  const removedIds: string[] = []
  for (const prevId of prev.keys()) {
    if (!nextIds.has(prevId)) removedIds.push(prevId)
  }

  return { added, updated, removedIds }
}

/**
 * Update `snap` in place to reflect `next` (added/updated set, removed cleared).
 */
function commitSnapshot<T extends { id: string; updatedAt?: string }>(
  next: T[],
  snap: SnapshotMap
): void {
  snap.clear()
  for (const row of next) {
    snap.set(row.id, row.updatedAt)
  }
}

export interface UnifiedSearchHook {
  /** True once the initial Promise.allSettled bootstrap has resolved. */
  ready: boolean
  /** Search the combined index (returns [] when not ready). */
  search: (query: string, opts?: SearchOptions) => UnifiedSearchResult[]
}

export function useUnifiedSearchIndex(): UnifiedSearchHook {
  const [ready, setReady] = useState<boolean>(() => isInitialized())

  // Per-table last-seen snapshot refs. Keyed by entity id → updatedAt.
  const courseSnap = useRef<SnapshotMap>(new Map())
  const videoSnap = useRef<SnapshotMap>(new Map())
  const authorSnap = useRef<SnapshotMap>(new Map())
  const bookSnap = useRef<SnapshotMap>(new Map())
  const noteSnap = useRef<SnapshotMap>(new Map())
  const highlightSnap = useRef<SnapshotMap>(new Map())

  // Dexie live subscriptions — undefined while loading, array once resolved.
  const courses = useLiveQuery(() => db.importedCourses.toArray(), [])
  const videos = useLiveQuery(() => db.importedVideos.toArray(), [])
  const storeAuthors = useLiveQuery(() => db.authors.toArray(), [])
  const books = useLiveQuery(() => db.books.toArray(), [])
  const notes = useLiveQuery(() => db.notes.toArray(), [])
  const highlights = useLiveQuery(() => db.bookHighlights.toArray(), [])

  // Build a course-id → name map once per course snapshot so lessons can
  // carry their parent course name into the index (for subtitle / boost).
  const courseNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of courses ?? []) map.set(c.id, c.name)
    return map
  }, [courses])

  // Build a book-id → title map for highlights.
  const bookTitleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of books ?? []) map.set(b.id, b.title)
    return map
  }, [books])

  // Authors are merged (pre-seeded + imported) so the index matches the
  // Authors page exactly (R6). `getMergedAuthors` is stable — re-derive
  // per-snapshot of the raw store list.
  const mergedAuthors = useMemo(() => {
    if (!storeAuthors) return undefined
    return getMergedAuthors(storeAuthors as ImportedAuthor[])
  }, [storeAuthors])

  // ─── Per-table reconciliation ──────────────────────────────────────────

  useReconcile<ImportedCourse>(courses, courseSnap, toSearchableCourse, 'course')

  useReconcile<ImportedVideo>(
    videos,
    videoSnap,
    row => toSearchableLesson(row, courseNameById.get(row.courseId)),
    'lesson'
  )

  useReconcile(
    mergedAuthors,
    authorSnap,
    row => toSearchableAuthor(row),
    'author',
    // AuthorView has no `updatedAt`; fall back to `createdAt` for diffing.
    row => row.createdAt
  )

  useReconcile<Book>(books, bookSnap, toSearchableBook, 'book')
  useReconcile<Note>(notes, noteSnap, toSearchableNote, 'note')
  useReconcile<BookHighlight>(
    highlights,
    highlightSnap,
    row => toSearchableHighlight(row, bookTitleById.get(row.bookId)),
    'highlight'
  )

  // Flip `ready` once the shared module reports it's been initialized.
  // The boot path (`src/main.tsx`) calls `initializeUnifiedSearch` inside
  // `deferInit`, so on first mount the module may not yet be ready.
  useEffect(() => {
    if (ready) return
    // Cheap poll — the flag flips once, and poll cost is negligible.
    let cancelled = false
    const check = () => {
      if (cancelled) return
      if (isInitialized()) {
        setReady(true)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [ready])

  return useMemo<UnifiedSearchHook>(
    () => ({
      ready,
      search: (query, opts) => (ready ? unifiedSearch(query, opts) : []),
    }),
    [ready]
  )
}

/**
 * Shared reconcile effect — diffs each table snapshot and applies
 * add/update/remove calls on a trailing 300ms debounce. Typed generically so
 * each table can pass its own row shape and `toDoc` mapper.
 */
function useReconcile<T extends { id: string; updatedAt?: string }>(
  rows: T[] | undefined,
  snap: React.MutableRefObject<SnapshotMap>,
  toDoc: ToDocFn<T>,
  type: EntityType,
  // Some entity types (AuthorView) don't have a native `updatedAt` field;
  // the caller can supply a replacement getter.
  updatedAtGetter?: (row: T) => string | undefined
): void {
  useEffect(() => {
    if (!rows) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      // Normalize the row list so `updatedAt` is resolved by the getter.
      const normalized = updatedAtGetter
        ? rows.map(r => ({ ...r, updatedAt: updatedAtGetter(r) }))
        : rows
      try {
        const diff = diffSnapshot(normalized as Array<T & { updatedAt?: string }>, snap.current)
        for (const row of diff.added) addToIndex(toDoc(row))
        for (const row of diff.updated) updateInIndex(toDoc(row))
        for (const id of diff.removedIds) removeFromIndex(id, type)
        commitSnapshot(normalized as Array<T & { updatedAt?: string }>, snap.current)
      } catch (e) {
        // silent-catch-ok: reconcile failure must never block the UI; log for triage.
        console.error(`[unified-search] reconcile failed for type=${type}:`, e)
      }
    }, UPDATE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rows, snap, toDoc, type, updatedAtGetter])
}
