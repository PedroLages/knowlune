/**
 * Unified Search Index — single MiniSearch instance across all Knowlune
 * entity types (E117-S01 Story 1).
 *
 * Design
 *  - One MiniSearch instance, indexed by `_searchId` = `${type}:${id}` so
 *    cross-entity id collisions are impossible (e.g. a course with id 'abc'
 *    and a note with id 'abc' both index without overwriting each other).
 *  - `type` discriminator is indexed and stored so consumers can render
 *    grouped sections and scope queries via `search(q, { types: [...] })`.
 *  - `storeFields` carries just enough data (`displayTitle`, `subtitle`,
 *    `parentId`, `parentTitle`, plus entity-specific navigation fields)
 *    to render a palette row and build a route without re-querying Dexie.
 *  - Notes field config is preserved verbatim from the legacy
 *    `src/lib/noteSearch.ts` (boost `tags`×2 and `courseName`×1.5;
 *    `prefix: true`, `fuzzy: 0.2`, `combineWith: 'OR'`).
 *  - Imperative `addToIndex` / `updateInIndex` / `removeFromIndex` mirror
 *    the legacy `discard`-in-try/catch pattern so missing ids never throw.
 *
 * Replaces `src/lib/noteSearch.ts`; the notes subset of the combined index
 * uses the same field config and boosts.
 */
import MiniSearch from 'minisearch'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedAuthor,
  Book,
  BookHighlight,
  Note,
  Course,
} from '@/data/types'
import type { AuthorView } from '@/lib/authors'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type EntityType = 'course' | 'book' | 'lesson' | 'note' | 'highlight' | 'author'

/** Shared document shape stored in the combined MiniSearch index. */
export interface SearchableDoc {
  /** Synthetic primary key: `${type}:${id}`. Prevents cross-entity id collisions. */
  _searchId: string
  /** Original entity id (without `type:` prefix). */
  id: string
  type: EntityType
  /** Primary display string (course name, book title, lesson title, …). */
  displayTitle: string
  /** Secondary display string (subtitle / contextual label). */
  subtitle?: string
  /** Parent entity id (e.g. `courseId` for a lesson). */
  parentId?: string
  /** Parent entity title (for rendering breadcrumbs without re-querying). */
  parentTitle?: string

  // Fields searched per-entity — unioned across all types.
  // Each field is optional because a given entity only fills a subset.
  name?: string
  title?: string
  description?: string
  content?: string
  tags?: string // space-separated or ' | '-joined
  category?: string
  author?: string
  specialties?: string
  education?: string
  courseName?: string
  videoTitle?: string
  textAnchor?: string
  bookTitle?: string

  // Navigation / render helpers (stored, not searched).
  courseId?: string
  videoId?: string
  bookId?: string
  chapterHref?: string
  cfiRange?: string
  color?: string
  timestamp?: number
}

export interface UnifiedSearchResult {
  id: string
  type: EntityType
  score: number
  displayTitle: string
  subtitle?: string
  parentId?: string
  parentTitle?: string
  // Navigation fields (copied verbatim from stored doc).
  courseId?: string
  videoId?: string
  bookId?: string
  chapterHref?: string
  cfiRange?: string
  color?: string
  timestamp?: number
  content?: string
  tags?: string
  textAnchor?: string
}

export interface SearchOptions {
  types?: EntityType[]
  limit?: number
}

// ────────────────────────────────────────────────────────────────────────────
// MiniSearch singleton
// ────────────────────────────────────────────────────────────────────────────

// Fields searched (union across all entity types). Per-entity boosts live in
// `searchOptions.boost`. MiniSearch's single-corpus IDF is a known trade-off
// for cross-entity scoring — see plan "Key Technical Decisions".
const SEARCH_FIELDS = [
  'name',
  'title',
  'displayTitle',
  'description',
  'content',
  'tags',
  'category',
  'author',
  'specialties',
  'education',
  'courseName',
  'videoTitle',
  'textAnchor',
  'bookTitle',
  'subtitle',
  'parentTitle',
] as const

const STORE_FIELDS = [
  'id',
  'type',
  'displayTitle',
  'subtitle',
  'parentId',
  'parentTitle',
  'courseId',
  'videoId',
  'bookId',
  'chapterHref',
  'cfiRange',
  'color',
  'timestamp',
  'content',
  'tags',
  'textAnchor',
] as const

const miniSearch = new MiniSearch<SearchableDoc>({
  idField: '_searchId',
  fields: [...SEARCH_FIELDS],
  storeFields: [...STORE_FIELDS],
  searchOptions: {
    boost: {
      // Notes — preserved verbatim from src/lib/noteSearch.ts
      tags: 2,
      courseName: 1.5,
      // Courses / lessons / books — titles weight above descriptions
      name: 2,
      title: 2,
      displayTitle: 2,
      // Authors — name is primary
      author: 1.5,
      specialties: 1.2,
    },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'OR',
  },
})

let initialized = false

// Course/lesson lookup maps used by the notes helper so notes carry the
// course and lesson titles in their searchable document (mirrors
// `buildCourseLookup` / `toSearchableNote` from the legacy module).
let courseNameMap = new Map<string, string>()
let lessonTitleMap = new Map<string, string>()

/**
 * Build course/lesson lookup maps used when indexing notes.
 * Imported courses and videos feed the maps automatically via their own
 * `toSearchable*` helpers below; this function exists for the
 * legacy-static `Course[]` pathway (kept for API compatibility).
 */
export function buildCourseLookup(courses: Course[]): void {
  courseNameMap = new Map()
  lessonTitleMap = new Map()
  for (const course of courses) {
    courseNameMap.set(course.id, course.shortTitle || course.title)
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessonTitleMap.set(lesson.id, lesson.title)
      }
    }
  }
}

/**
 * Register an additional course id → display name mapping.
 * Used when notes are indexed alongside imported (non-static) courses.
 */
export function registerCourseName(courseId: string, name: string): void {
  courseNameMap.set(courseId, name)
}

/**
 * Register an additional lesson id → title mapping.
 * Used when notes are indexed alongside imported videos.
 */
export function registerLessonTitle(videoId: string, title: string): void {
  lessonTitleMap.set(videoId, title)
}

// ────────────────────────────────────────────────────────────────────────────
// toSearchable<Entity> helpers
// ────────────────────────────────────────────────────────────────────────────

export function toSearchableCourse(course: ImportedCourse): SearchableDoc {
  // Seed the course name lookup so subsequent note indexing resolves the name.
  courseNameMap.set(course.id, course.name)
  return {
    _searchId: `course:${course.id}`,
    id: course.id,
    type: 'course',
    displayTitle: course.name,
    subtitle: course.category || undefined,
    name: course.name,
    description: course.description,
    category: course.category,
    tags: (course.tags ?? []).join(' | '),
  }
}

export function toSearchableLesson(
  video: ImportedVideo,
  parentCourseName?: string
): SearchableDoc {
  // Derive a title — `filename` is the source of truth for local imports;
  // YouTube imports may have richer metadata but still fall back safely.
  const title = video.filename || video.youtubeVideoId || video.id
  if (parentCourseName) {
    courseNameMap.set(video.courseId, parentCourseName)
  }
  lessonTitleMap.set(video.id, title)
  return {
    _searchId: `lesson:${video.id}`,
    id: video.id,
    type: 'lesson',
    displayTitle: title,
    subtitle: parentCourseName,
    parentId: video.courseId,
    parentTitle: parentCourseName,
    title,
    description: video.description,
    courseId: video.courseId,
    videoId: video.id,
    courseName: parentCourseName,
  }
}

export function toSearchableAuthor(author: AuthorView | ImportedAuthor): SearchableDoc {
  const specialties = (author.specialties ?? []).join(' | ')
  return {
    _searchId: `author:${author.id}`,
    id: author.id,
    type: 'author',
    displayTitle: author.name,
    subtitle: 'title' in author ? author.title : undefined,
    author: author.name,
    title: 'title' in author ? author.title : undefined,
    description: 'bio' in author ? author.bio : undefined,
    specialties,
    education: 'education' in author ? author.education : undefined,
  }
}

export function toSearchableBook(book: Book): SearchableDoc {
  return {
    _searchId: `book:${book.id}`,
    id: book.id,
    type: 'book',
    displayTitle: book.title,
    subtitle: book.author || undefined,
    title: book.title,
    author: book.author,
    description: book.description,
    tags: (book.tags ?? []).join(' | '),
    bookId: book.id,
    bookTitle: book.title,
  }
}

export function toSearchableNote(note: Note): SearchableDoc {
  const courseName = courseNameMap.get(note.courseId) ?? ''
  const videoTitle = lessonTitleMap.get(note.videoId) ?? ''
  return {
    _searchId: `note:${note.id}`,
    id: note.id,
    type: 'note',
    displayTitle: note.content.slice(0, 80),
    subtitle: courseName && videoTitle ? `${courseName} · ${videoTitle}` : courseName || videoTitle,
    parentId: note.courseId,
    parentTitle: courseName,
    content: note.content,
    tags: (note.tags ?? []).join(' | '),
    courseName,
    videoTitle,
    courseId: note.courseId,
    videoId: note.videoId,
    timestamp: note.timestamp,
  }
}

export function toSearchableHighlight(
  highlight: BookHighlight,
  parentBookTitle?: string
): SearchableDoc {
  return {
    _searchId: `highlight:${highlight.id}`,
    id: highlight.id,
    type: 'highlight',
    displayTitle: highlight.textAnchor.slice(0, 80),
    subtitle: parentBookTitle,
    parentId: highlight.bookId,
    parentTitle: parentBookTitle,
    textAnchor: highlight.textAnchor,
    content: highlight.note,
    bookId: highlight.bookId,
    bookTitle: parentBookTitle,
    chapterHref: highlight.chapterHref,
    cfiRange: highlight.cfiRange,
    color: highlight.color,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Index lifecycle — init / add / update / remove
// ────────────────────────────────────────────────────────────────────────────

/**
 * Initialize (or re-initialize) the unified index from a flat list of docs.
 * On re-init, existing entries are cleared first so stale docs don't linger.
 */
export function initializeUnifiedSearch(docs: SearchableDoc[]): void {
  if (initialized) {
    miniSearch.removeAll()
  }
  if (docs.length > 0) {
    miniSearch.addAll(docs)
  }
  initialized = true
}

/** Returns true once `initializeUnifiedSearch` has been called at least once. */
export function isInitialized(): boolean {
  return initialized
}

/**
 * Return the set of original (non-prefixed) ids currently stored in the index
 * for the given entity type. Used by `useUnifiedSearchIndex` to seed its
 * per-table snapshot refs so the first reconcile pass doesn't re-add docs
 * that `main.tsx` already bulk-loaded at boot.
 */
export function getIndexedIds(type: EntityType): Set<string> {
  const out = new Set<string>()
  if (!initialized) return out
  const prefix = `${type}:`
  // MiniSearch stores docs keyed by `_searchId`. The library exposes
  // `documentCount` but not an iterator; however `has()` + `search('')`
  // both fail for our purposes. We iterate the internal store via the
  // public `toJSON()` API which returns the document registry.
  // Falling back to a cheap empty-set is acceptable if the shape changes.
  try {
    const json = miniSearch.toJSON() as { storedFields?: Record<string, unknown> }
    const stored = json?.storedFields
    if (stored) {
      for (const searchId of Object.keys(stored)) {
        if (searchId.startsWith(prefix)) {
          out.add(searchId.slice(prefix.length))
        }
      }
    }
  } catch {
    // silent-catch-ok: if the internal JSON shape changes we just return
    // an empty seed — the worst case is a one-time re-add of existing docs.
  }
  return out
}

/**
 * Add a doc. Safe to call repeatedly — swallows the "already in index" error
 * via the same `discard`-in-try/catch pattern used by legacy noteSearch.
 */
export function addToIndex(doc: SearchableDoc): void {
  if (!initialized) return
  try {
    miniSearch.add(doc)
  } catch (e) {
    // MiniSearch throws if `_searchId` already exists. Treat as "update".
    if (e instanceof Error && e.message.toLowerCase().includes('duplicate')) {
      updateInIndex(doc)
      return
    }
    console.error('[unified-search] add failed:', e)
  }
}

/**
 * Update a doc (discard + re-add). Matches `noteSearch.ts` semantics — if the
 * doc was never added we silently fall through to `add`.
 */
export function updateInIndex(doc: SearchableDoc): void {
  if (!initialized) return
  try {
    miniSearch.discard(doc._searchId)
  } catch (e) {
    // "not in the index" is expected for first-add path — swallow.
    if (!(e instanceof Error && e.message.includes('not in the index'))) {
      console.error('[unified-search] update discard failed:', e)
    }
  }
  try {
    miniSearch.add(doc)
  } catch (e) {
    console.error('[unified-search] update add failed:', e)
  }
}

/** Remove a doc by the original (non-prefixed) id + type. */
export function removeFromIndex(id: string, type: EntityType): void {
  if (!initialized) return
  const searchId = `${type}:${id}`
  try {
    miniSearch.discard(searchId)
  } catch {
    // silent-catch-ok: discard() throws when id is unknown; expected during
    // reconciliation of concurrent Dexie writes — treat as a no-op.
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Query
// ────────────────────────────────────────────────────────────────────────────

/**
 * Search the combined index. Returns relevance-ranked results across every
 * enabled entity type. An empty query returns `[]` (no accidental return-all).
 */
export function search(query: string, opts: SearchOptions = {}): UnifiedSearchResult[] {
  if (!initialized) return []
  const q = query.trim()
  if (!q) return []

  const typeSet = opts.types ? new Set<EntityType>(opts.types) : null
  const raw = miniSearch.search(q)
  const results: UnifiedSearchResult[] = []

  for (const r of raw) {
    const type = r.type as EntityType | undefined
    if (!type) continue
    if (typeSet && !typeSet.has(type)) continue

    results.push({
      id: (r.id as string) ?? '',
      type,
      score: r.score,
      displayTitle: (r.displayTitle as string) ?? '',
      subtitle: r.subtitle as string | undefined,
      parentId: r.parentId as string | undefined,
      parentTitle: r.parentTitle as string | undefined,
      courseId: r.courseId as string | undefined,
      videoId: r.videoId as string | undefined,
      bookId: r.bookId as string | undefined,
      chapterHref: r.chapterHref as string | undefined,
      cfiRange: r.cfiRange as string | undefined,
      color: r.color as string | undefined,
      timestamp: r.timestamp as number | undefined,
      content: r.content as string | undefined,
      tags: r.tags as string | undefined,
      textAnchor: r.textAnchor as string | undefined,
    })

    if (opts.limit && results.length >= opts.limit) break
  }

  return results
}

// ────────────────────────────────────────────────────────────────────────────
// Test-only reset hook — never called in app code.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reset module-level state. ONLY for unit tests — never call in app code.
 * (The module-level singleton must persist across HMR in the app.)
 */
export function __resetForTests(): void {
  miniSearch.removeAll()
  initialized = false
  courseNameMap = new Map()
  lessonTitleMap = new Map()
}
