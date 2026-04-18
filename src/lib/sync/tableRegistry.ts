/**
 * Sync Table Registry — E92-S03
 *
 * Single declarative source-of-truth for every Dexie table that participates
 * in the Supabase sync pipeline (E92-S04 through E92-S09). All sync engine
 * code must read from this registry rather than hardcoding per-table logic.
 *
 * Priority tiers (lower = higher priority, synced first):
 *   P0 — Core progress / session data (synced immediately on connection)
 *   P1 — Notes, flashcards, annotations, AI learning data
 *   P2 — Imported content metadata, books, shelves
 *   P3 — Learning paths, scheduling, notifications, integrations
 *   P4 — Analytics / append-only events, quizzes
 *
 * Conflict strategies:
 *   'lww'          — Last-write-wins using updatedAt timestamps (default)
 *   'monotonic'    — Field-level monotonic merge (e.g. watchedSeconds only goes up)
 *   'insert-only'  — Immutable append-only records; never update or delete
 *   'conflict-copy'— On conflict, create a copy (future use)
 *   'skip'         — Table opted out of sync (future use)
 *
 * Pure module — no Dexie, Zustand, or React imports. Safe to import anywhere.
 */

export interface TableRegistryEntry {
  /** Name of the Dexie (IndexedDB) table */
  dexieTable: string
  /** Name of the corresponding Supabase Postgres table */
  supabaseTable: string
  /** Strategy for resolving conflicts between local and remote versions */
  conflictStrategy: 'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip'
  /** Sync priority tier — 0 is highest, 4 is lowest */
  priority: 0 | 1 | 2 | 3 | 4
  /**
   * Explicit field name overrides: keys are Dexie (camelCase) field names,
   * values are Supabase (snake_case) column names.
   * Only list NON-OBVIOUS mappings. The fieldMapper default converts camelCase
   * to snake_case automatically (e.g. courseId → course_id).
   */
  fieldMap: Record<string, string>
  /**
   * Fields to strip before upload. These are non-serializable browser API
   * handles (FileSystemDirectoryHandle, FileSystemFileHandle) that cannot be
   * JSON-encoded and have no Supabase column equivalent.
   */
  stripFields?: string[]
  /**
   * Monotonic fields: only sync if the new value is greater than the current
   * remote value. Used for metrics that should only increase (e.g. watchedSeconds).
   * Applies only when conflictStrategy is 'monotonic'.
   */
  monotonicFields?: string[]
  /**
   * Compound primary key fields for tables whose PK spans multiple columns.
   * The sync engine uses these to construct the correct upsert key.
   */
  compoundPkFields?: string[]
  /**
   * Vault fields: sensitive credentials that MUST NOT appear in Postgres rows.
   * These are stripped from the upload payload and routed to Supabase Vault
   * separately (E95-S02). Distinct from stripFields — vault fields are
   * technically serializable but must never reach the database column.
   */
  vaultFields?: string[]
  /** If true, use INSERT ... ON CONFLICT DO NOTHING (never UPDATE) */
  insertOnly?: boolean
  /** If true, this table is temporarily excluded from sync */
  skipSync?: boolean
  /**
   * If true, this table only uploads to Supabase — no rows are downloaded to
   * Dexie. The download phase skips this table entirely.
   *
   * Design rationale: upload-only tables (e.g. `embeddings`) are generated
   * client-side. There is no meaningful download direction — either the device
   * already holds the embedding locally or it will regenerate. Uploading avoids
   * expensive re-generation on a new device.
   *
   * Note: upload-only tables have no download phase, so the `lastSyncTimestamp`
   * cursor is never advanced for these tables. This is correct behavior.
   */
  uploadOnly?: boolean
}

// ---------------------------------------------------------------------------
// P0 — Core progress / session data
// ---------------------------------------------------------------------------

const contentProgress: TableRegistryEntry = {
  dexieTable: 'contentProgress',
  supabaseTable: 'content_progress',
  conflictStrategy: 'monotonic',
  priority: 0,
  fieldMap: {},
  compoundPkFields: ['courseId', 'itemId'],
}

const studySessions: TableRegistryEntry = {
  dexieTable: 'studySessions',
  supabaseTable: 'study_sessions',
  conflictStrategy: 'insert-only',
  priority: 0,
  fieldMap: {},
  insertOnly: true,
}

/**
 * `progress` stores VideoProgress records in Dexie but maps to `video_progress`
 * in Supabase (different name — not an automatic camelCase conversion).
 * Note: the Dexie schema declares this as EntityTable<VideoProgress, 'courseId'>
 * but the actual PK is compound [courseId+videoId] — tracked as a known issue
 * from E92-S02 code review (R1-PE-01). Do not fix as part of E92-S03.
 */
const progress: TableRegistryEntry = {
  dexieTable: 'progress',
  supabaseTable: 'video_progress',
  conflictStrategy: 'monotonic',
  priority: 0,
  fieldMap: {},
  monotonicFields: ['watchedSeconds'],
}

// ---------------------------------------------------------------------------
// P1 — Notes, flashcards, annotations, AI learning data
// ---------------------------------------------------------------------------

/**
 * `notes` uses conflict-copy strategy (E93-S03): when remote wins on timestamp
 * AND content differs, the local version is preserved as a JSONB snapshot in
 * `conflict_copy` rather than silently discarded.
 *
 * Field map:
 *   - `deleted → soft_deleted` (NFR24 rename)
 *   - `conflictCopy → conflict_copy` (JSONB — auto camelCase would produce
 *     `conflict_copy` too, but explicit entry ensures upload direction is correct)
 *   - `conflictNoteId → conflict_source_id` (TEXT)
 */
const notes: TableRegistryEntry = {
  dexieTable: 'notes',
  supabaseTable: 'notes',
  conflictStrategy: 'conflict-copy',
  priority: 1,
  fieldMap: {
    deleted: 'soft_deleted',
    conflictCopy: 'conflict_copy',
    conflictNoteId: 'conflict_source_id',
  },
}

const bookmarks: TableRegistryEntry = {
  dexieTable: 'bookmarks',
  supabaseTable: 'bookmarks',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

const flashcards: TableRegistryEntry = {
  dexieTable: 'flashcards',
  supabaseTable: 'flashcards',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

/**
 * `reviewRecords` stores derived FSRS state locally. It IS synced to Supabase,
 * but NOT to the `flashcard_reviews` table directly — see E93-S04 for the FSRS
 * replay mechanism. `flashcard_reviews` is a Supabase-only INSERT-only table
 * (no Dexie equivalent) created in E93-S01.
 */
const reviewRecords: TableRegistryEntry = {
  dexieTable: 'reviewRecords',
  supabaseTable: 'review_records',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

/**
 * `embeddings` stores 384-dim vectors generated client-side for semantic search.
 * Upload-only: device generates embedding → uploads to Supabase `embeddings` table.
 * No download direction is needed — each device either has the embedding locally
 * (generated it) or will regenerate. Uploading avoids expensive re-generation.
 *
 * LWW is trivially correct for deterministic vectors: the same note+model always
 * produces the same vector, so there are no meaningful conflicts.
 *
 * Field map:
 *   - `noteId → note_id` (non-obvious: PK is noteId in Dexie, note_id FK in Supabase)
 *   - `embedding → vector` (Supabase pgvector column is named `vector`, not `embedding`)
 */
const embeddings: TableRegistryEntry = {
  dexieTable: 'embeddings',
  supabaseTable: 'embeddings',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {
    noteId: 'note_id',
    embedding: 'vector',
  },
  uploadOnly: true,
}

const bookHighlights: TableRegistryEntry = {
  dexieTable: 'bookHighlights',
  supabaseTable: 'book_highlights',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

const vocabularyItems: TableRegistryEntry = {
  dexieTable: 'vocabularyItems',
  supabaseTable: 'vocabulary_items',
  conflictStrategy: 'monotonic',
  priority: 1,
  fieldMap: {},
  monotonicFields: ['masteryLevel'],
}

const audioBookmarks: TableRegistryEntry = {
  dexieTable: 'audioBookmarks',
  supabaseTable: 'audio_bookmarks',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

const audioClips: TableRegistryEntry = {
  dexieTable: 'audioClips',
  supabaseTable: 'audio_clips',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

/**
 * `chatConversations` stores createdAt as an epoch bigint (milliseconds since
 * Unix epoch), NOT a timestamptz. The Supabase column is `created_at_epoch`.
 */
const chatConversations: TableRegistryEntry = {
  dexieTable: 'chatConversations',
  supabaseTable: 'chat_conversations',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {
    createdAt: 'created_at_epoch',
  },
}

const learnerModels: TableRegistryEntry = {
  dexieTable: 'learnerModels',
  supabaseTable: 'learner_models',
  conflictStrategy: 'lww',
  priority: 1,
  fieldMap: {},
}

// ---------------------------------------------------------------------------
// P2 — Imported content metadata, books, shelves
// ---------------------------------------------------------------------------

/**
 * `importedCourses` holds FileSystemDirectoryHandle and coverImageHandle
 * references that cannot be serialized. Strip before upload.
 */
const importedCourses: TableRegistryEntry = {
  dexieTable: 'importedCourses',
  supabaseTable: 'imported_courses',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
  stripFields: ['directoryHandle', 'coverImageHandle'],
}

/**
 * `importedVideos` holds a FileSystemFileHandle that cannot be serialized.
 */
const importedVideos: TableRegistryEntry = {
  dexieTable: 'importedVideos',
  supabaseTable: 'imported_videos',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
  stripFields: ['fileHandle'],
}

/**
 * `importedPdfs` holds a FileSystemFileHandle that cannot be serialized.
 */
const importedPdfs: TableRegistryEntry = {
  dexieTable: 'importedPdfs',
  supabaseTable: 'imported_pdfs',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
  stripFields: ['fileHandle'],
}

/**
 * `authors` holds a photoHandle (FileSystemFileHandle) for local cover images.
 */
const authors: TableRegistryEntry = {
  dexieTable: 'authors',
  supabaseTable: 'authors',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
  stripFields: ['photoHandle'],
}

/**
 * `books` tracks reading progress monotonically via the `progress` field
 * (a 0–100 percentage value).
 */
const books: TableRegistryEntry = {
  dexieTable: 'books',
  supabaseTable: 'books',
  conflictStrategy: 'monotonic',
  priority: 2,
  fieldMap: {},
  monotonicFields: ['progress'],
}

const bookReviews: TableRegistryEntry = {
  dexieTable: 'bookReviews',
  supabaseTable: 'book_reviews',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
}

const shelves: TableRegistryEntry = {
  dexieTable: 'shelves',
  supabaseTable: 'shelves',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
}

const bookShelves: TableRegistryEntry = {
  dexieTable: 'bookShelves',
  supabaseTable: 'book_shelves',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
}

const readingQueue: TableRegistryEntry = {
  dexieTable: 'readingQueue',
  supabaseTable: 'reading_queue',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
}

/**
 * `chapterMappings` uses a compound PK across epubBookId and audioBookId.
 */
const chapterMappings: TableRegistryEntry = {
  dexieTable: 'chapterMappings',
  supabaseTable: 'chapter_mappings',
  conflictStrategy: 'lww',
  priority: 2,
  fieldMap: {},
  compoundPkFields: ['epubBookId', 'audioBookId'],
}

// ---------------------------------------------------------------------------
// P3 — Learning paths, scheduling, notifications, integrations
// ---------------------------------------------------------------------------

const learningPaths: TableRegistryEntry = {
  dexieTable: 'learningPaths',
  supabaseTable: 'learning_paths',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

const learningPathEntries: TableRegistryEntry = {
  dexieTable: 'learningPathEntries',
  supabaseTable: 'learning_path_entries',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

/**
 * `challenges` tracks currentProgress monotonically (challenge progress only
 * advances forward).
 */
const challenges: TableRegistryEntry = {
  dexieTable: 'challenges',
  supabaseTable: 'challenges',
  conflictStrategy: 'monotonic',
  priority: 3,
  fieldMap: {},
  monotonicFields: ['currentProgress'],
}

const courseReminders: TableRegistryEntry = {
  dexieTable: 'courseReminders',
  supabaseTable: 'course_reminders',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

const notifications: TableRegistryEntry = {
  dexieTable: 'notifications',
  supabaseTable: 'notifications',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

const careerPaths: TableRegistryEntry = {
  dexieTable: 'careerPaths',
  supabaseTable: 'career_paths',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

const pathEnrollments: TableRegistryEntry = {
  dexieTable: 'pathEnrollments',
  supabaseTable: 'path_enrollments',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

const studySchedules: TableRegistryEntry = {
  dexieTable: 'studySchedules',
  supabaseTable: 'study_schedules',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

/**
 * `opdsCatalogs` stores OPDS server credentials. The `password` field is a
 * vault field — it must NEVER appear in Postgres rows. It will be routed to
 * Supabase Vault in E95-S02.
 */
const opdsCatalogs: TableRegistryEntry = {
  dexieTable: 'opdsCatalogs',
  supabaseTable: 'opds_catalogs',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
  vaultFields: ['password'],
}

/**
 * `audiobookshelfServers` stores ABS server credentials. The `apiKey` field
 * is a vault field — must NEVER appear in Postgres rows.
 */
const audiobookshelfServers: TableRegistryEntry = {
  dexieTable: 'audiobookshelfServers',
  supabaseTable: 'audiobookshelf_servers',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
  vaultFields: ['apiKey'],
}

const notificationPreferences: TableRegistryEntry = {
  dexieTable: 'notificationPreferences',
  supabaseTable: 'notification_preferences',
  conflictStrategy: 'lww',
  priority: 3,
  fieldMap: {},
}

// ---------------------------------------------------------------------------
// P4 — Analytics / append-only events, quizzes
// ---------------------------------------------------------------------------

const quizzes: TableRegistryEntry = {
  dexieTable: 'quizzes',
  supabaseTable: 'quizzes',
  conflictStrategy: 'lww',
  priority: 4,
  fieldMap: {},
}

/**
 * `quizAttempts` are immutable once created — never update or delete.
 */
const quizAttempts: TableRegistryEntry = {
  dexieTable: 'quizAttempts',
  supabaseTable: 'quiz_attempts',
  conflictStrategy: 'insert-only',
  priority: 4,
  fieldMap: {},
  insertOnly: true,
}

/**
 * `aiUsageEvents` are append-only analytics events — never update or delete.
 */
const aiUsageEvents: TableRegistryEntry = {
  dexieTable: 'aiUsageEvents',
  supabaseTable: 'ai_usage_events',
  conflictStrategy: 'insert-only',
  priority: 4,
  fieldMap: {},
  insertOnly: true,
}

// ---------------------------------------------------------------------------
// Registry export — ordered by priority (P0 first, P4 last)
// E92-S05 iterates this array in order for priority-based upload.
// ---------------------------------------------------------------------------

/**
 * Array of all 38 syncable tables, ordered by priority tier then by
 * registration order within each tier.
 *
 * NOTE: `flashcard_reviews` is intentionally absent — it is a Supabase-only
 * INSERT-only table (no Dexie equivalent), created in E93-S01.
 */
export const tableRegistry: TableRegistryEntry[] = [
  // P0
  contentProgress,
  studySessions,
  progress,
  // P1
  notes,
  bookmarks,
  flashcards,
  reviewRecords,
  embeddings,
  bookHighlights,
  vocabularyItems,
  audioBookmarks,
  audioClips,
  chatConversations,
  learnerModels,
  // P2
  importedCourses,
  importedVideos,
  importedPdfs,
  authors,
  books,
  bookReviews,
  shelves,
  bookShelves,
  readingQueue,
  chapterMappings,
  // P3
  learningPaths,
  learningPathEntries,
  challenges,
  courseReminders,
  notifications,
  careerPaths,
  pathEnrollments,
  studySchedules,
  opdsCatalogs,
  audiobookshelfServers,
  notificationPreferences,
  // P4
  quizzes,
  quizAttempts,
  aiUsageEvents,
]

/**
 * Look up a registry entry by Dexie table name.
 * Returns undefined if the table is not registered (e.g. flashcard_reviews).
 */
export function getTableEntry(dexieTable: string): TableRegistryEntry | undefined {
  return tableRegistry.find((e) => e.dexieTable === dexieTable)
}
