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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { getMergedAuthors } from '@/lib/authors'
import {
  search as unifiedSearch,
  addToIndex,
  updateInIndex,
  removeFromIndex,
  isInitialized,
  getIndexedIds,
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
import { applyFrecency, type FrecencyRow } from '@/lib/searchFrecency'
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

export interface SearchBestMatchesOptions {
  /** Final cap on the Best Matches row list. Defaults to 3. */
  limit?: number
  /**
   * Initial MiniSearch pool passed through `applyFrecency`. Bounded so a
   * power-user with thousands of frecency rows still only does one
   * `bulkGet` of a manageable size. Defaults to 50.
   */
  poolSize?: number
}

export interface UnifiedSearchHook {
  /** True once the initial Promise.allSettled bootstrap has resolved. */
  ready: boolean
  /** Search the combined index (returns [] when not ready). */
  search: (query: string, opts?: SearchOptions) => UnifiedSearchResult[]
  /**
   * Run a ranking-aware search intended for the palette's "Best Matches"
   * section. Applies the frecency multiplier (capped at 2.0) over a bounded
   * pool of MiniSearch results. Returns `[]` when not ready or on empty query.
   *
   * Does NOT affect the main `search()` path — grouped sections stay on pure
   * MiniSearch relevance for predictable scan-reading order.
   */
  searchBestMatches: (
    query: string,
    opts?: SearchBestMatchesOptions
  ) => Promise<UnifiedSearchResult[]>
}

/**
 * Seed a snapshot map from entity ids already present in the shared index.
 * The first reconcile pass will see these ids as "no-op" (updatedAt unknown
 * but id present → classified as "updated" only if its updatedAt changed).
 * We intentionally store `undefined` as the sentinel so the first genuine
 * diff will fire an `updateInIndex` call iff the live row's `updatedAt`
 * differs from `undefined` — which is always true, so bulk-loaded docs
 * get refreshed exactly once and never re-added.
 *
 * Trade-off: one extra update call per pre-loaded doc at first mount.
 * Upside: no duplicate `add` calls (which would otherwise no-op via the
 * duplicate-key catch, but still pay the cost of MiniSearch's hash check).
 */
function seedSnapshotFromIndex(type: EntityType): SnapshotMap {
  const map: SnapshotMap = new Map()
  for (const id of getIndexedIds(type)) {
    map.set(id, undefined)
  }
  return map
}

export function useUnifiedSearchIndex(): UnifiedSearchHook {
  const [ready, setReady] = useState<boolean>(() => isInitialized())

  // Per-table last-seen snapshot refs. Keyed by entity id → updatedAt.
  // Seeded from the already-indexed state so first-mount reconcile doesn't
  // re-add every doc that `main.tsx` bulk-loaded at boot (F002).
  const courseSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('course'))
  const videoSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('lesson'))
  const authorSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('author'))
  const bookSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('book'))
  const noteSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('note'))
  const highlightSnap = useRef<SnapshotMap>(seedSnapshotFromIndex('highlight'))

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

  // ─── Stable toDoc closures (F001) ──────────────────────────────────────
  // Inline arrow functions would produce new references every render, which
  // would reset the 300ms reconcile debounce on every Dexie live update.
  // Keying on the lookup maps keeps each closure stable until its inputs
  // actually change.

  const lessonToDoc = useRef<ToDocFn<ImportedVideo>>(row => toSearchableLesson(row))
  useMemo(() => {
    lessonToDoc.current = row => toSearchableLesson(row, courseNameById.get(row.courseId))
  }, [courseNameById])

  const authorToDoc = useRef<ToDocFn<ReturnType<typeof getMergedAuthors>[number]>>(row =>
    toSearchableAuthor(row)
  )
  const authorUpdatedAt = useRef<(row: ReturnType<typeof getMergedAuthors>[number]) => string | undefined>(
    row => row.createdAt
  )

  const highlightToDoc = useRef<ToDocFn<BookHighlight>>(row => toSearchableHighlight(row))
  useMemo(() => {
    highlightToDoc.current = row => toSearchableHighlight(row, bookTitleById.get(row.bookId))
  }, [bookTitleById])

  // ─── Per-table reconciliation ──────────────────────────────────────────

  useReconcile<ImportedCourse>(courses, courseSnap, toSearchableCourse, 'course')

  useReconcile<ImportedVideo>(videos, videoSnap, lessonToDoc, 'lesson')

  useReconcile(mergedAuthors, authorSnap, authorToDoc, 'author', authorUpdatedAt)

  useReconcile<Book>(books, bookSnap, toSearchableBook, 'book')
  useReconcile<Note>(notes, noteSnap, toSearchableNote, 'note')
  useReconcile<BookHighlight>(highlights, highlightSnap, highlightToDoc, 'highlight')

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

  // `searchBestMatches` — runs pure-relevance search, joins against
  // `db.searchFrecency` for the result ids, applies the capped multiplier,
  // sorts desc, and truncates to `limit`. Stable identity across renders
  // while `ready` doesn't change so palette memos don't thrash.
  const searchBestMatches = useCallback(
    async (
      query: string,
      opts?: SearchBestMatchesOptions
    ): Promise<UnifiedSearchResult[]> => {
      if (!ready) return []
      const q = query.trim()
      if (!q) return []
      const poolSize = opts?.poolSize ?? 50
      const limit = opts?.limit ?? 3
      const pool = unifiedSearch(q, { limit: poolSize })
      if (pool.length === 0) return []
      const keys: [EntityType, string][] = pool.map(r => [r.type, r.id])
      let rows: (FrecencyRow | undefined)[]
      try {
        rows = await db.searchFrecency.bulkGet(keys)
      } catch (err) {
        // silent-catch-ok: frecency read failure degrades to pure relevance
        console.error('[unified-search] searchFrecency.bulkGet failed:', err)
        return pool.slice(0, limit)
      }
      const map = new Map<string, FrecencyRow>()
      rows.forEach((row, i) => {
        if (row) map.set(`${keys[i][0]}:${keys[i][1]}`, row)
      })
      const ranked = applyFrecency(pool, map, Date.now())
      ranked.sort((a, b) => b.score - a.score)
      return ranked.slice(0, limit)
    },
    [ready]
  )

  return useMemo<UnifiedSearchHook>(
    () => ({
      ready,
      search: (query, opts) => (ready ? unifiedSearch(query, opts) : []),
      searchBestMatches,
    }),
    [ready, searchBestMatches]
  )
}

/**
 * Shared reconcile effect — diffs each table snapshot and applies
 * add/update/remove calls on a trailing 300ms debounce. Typed generically so
 * each table can pass its own row shape and `toDoc` mapper.
 *
 * `toDoc` and `updatedAtGetter` can be passed as plain functions (for
 * simple, stable mappers) or as refs (for mappers that depend on lookup
 * maps that change across renders). Refs are unwrapped at call-time so the
 * effect deps stay stable — this is the F001 fix that prevents the 300ms
 * debounce from being reset on every render.
 */
function isRef<T>(value: unknown): value is React.MutableRefObject<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, 'current')
  )
}

function useReconcile<T extends { id: string; updatedAt?: string }>(
  rows: T[] | undefined,
  snap: React.MutableRefObject<SnapshotMap>,
  toDoc: ToDocFn<T> | React.MutableRefObject<ToDocFn<T>>,
  type: EntityType,
  // Some entity types (AuthorView) don't have a native `updatedAt` field;
  // the caller can supply a replacement getter.
  updatedAtGetter?:
    | ((row: T) => string | undefined)
    | React.MutableRefObject<(row: T) => string | undefined>
): void {
  useEffect(() => {
    if (!rows) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      const toDocFn: ToDocFn<T> = isRef<ToDocFn<T>>(toDoc) ? toDoc.current : toDoc
      const updatedAtFn = updatedAtGetter
        ? isRef<(row: T) => string | undefined>(updatedAtGetter)
          ? updatedAtGetter.current
          : updatedAtGetter
        : undefined
      // Normalize the row list so `updatedAt` is resolved by the getter.
      const normalized = updatedAtFn ? rows.map(r => ({ ...r, updatedAt: updatedAtFn(r) })) : rows
      try {
        const diff = diffSnapshot(normalized as Array<T & { updatedAt?: string }>, snap.current)
        for (const row of diff.added) addToIndex(toDocFn(row))
        for (const row of diff.updated) updateInIndex(toDocFn(row))
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
    // `toDoc` and `updatedAtGetter` are deliberately excluded — when passed
    // as refs they're read via `.current` at timer-fire time; when passed as
    // stable functions, their identity never changes. Including them would
    // reset the 300ms debounce on every parent render (F001).
  }, [rows, snap, type, toDoc, updatedAtGetter])
}
