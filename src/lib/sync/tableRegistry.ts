/**
 * Sync Table Registry — E92-S03
 *
 * Single source of truth for every Dexie table that participates in Supabase sync.
 *
 * This registry is consumed by:
 *   - `backfill.ts` (Unit 7): derives the list of syncable table names
 *   - `syncableWrite.ts` (E92-S04): reads `stripFields`, `vaultFields`, `compoundPkFields`
 *   - `syncEngine.ts` upload phase (E92-S05): reads `conflictStrategy`, `insertOnly`, `monotonicFields`
 *   - `syncEngine.ts` download phase (E92-S06): reads `conflictStrategy`, `priority`
 *   - P0/P1/P2+ store rewiring (E92-S09+): looks up the entry by Dexie table name
 *
 * Design rule: adding a new syncable table means adding ONE entry here — never
 * editing the sync engine. Any `if (tableName === 'X')` branch in downstream
 * sync code is a smell; look up in the registry instead.
 *
 * # Field Mapping Scope
 *
 * The `fieldMap` covers pure camelCase↔snake_case renames only. It does NOT
 * handle semantic transformations (e.g., computing `watched_seconds` from
 * `currentTime`, or translating a Dexie compound record into a flattened
 * Supabase row). Those transformations live in the upload/download phases of
 * `syncEngine.ts` where they can access the full per-table context.
 *
 * The registry flags which fields to strip (`stripFields`), which are stored
 * in Vault (`vaultFields`), which are monotonic (`monotonicFields`), and which
 * form compound primary keys (`compoundPkFields`). Downstream stories special-
 * case on these flags.
 *
 * # Special Cases
 *
 * - `reviewRecords` is NOT in this registry. It is local-only derived FSRS
 *   scheduling state; it is recomputed from the merged `flashcard_reviews` log
 *   on download. See E93 docs for details.
 *
 * - `flashcard_reviews` is NOT in this registry. It is a Supabase-only
 *   INSERT-only table with no Dexie equivalent. E92-S05's upload path
 *   transforms local `reviewRecords` mutations into `flashcard_reviews` INSERTs
 *   at upload time.
 *
 * - `skipSync: true` entries exist to declare an intended future exclusion.
 *   No entries use this flag in E92-S03; E96-S04 will populate `youtubeChapters`
 *   and similar transient-cache tables with `skipSync: true` after its spike.
 *
 * @see docs/plans/2026-04-17-004-feat-e92-s03-sync-table-registry-and-field-mapping-plan.md
 * @see src/db/checkpoint.ts — authoritative post-v52 Dexie schema
 * @see supabase/migrations/20260413000001_p0_sync_foundation.sql — P0 Supabase column names
 */

/**
 * Declarative description of a single syncable table.
 *
 * `fieldMap` is camelCase (Dexie property) → snake_case (Supabase column).
 * The inverse direction is computed lazily by `fieldMapper.toCamelCase()`.
 *
 * Identity fields (`userId`, `createdAt`, `updatedAt`) are handled by the
 * universal `IDENTITY_FIELD_MAP` below; do not repeat them in per-table
 * `fieldMap` unless you need a per-table override.
 */
export interface TableRegistryEntry {
  /** Dexie (IndexedDB) table name — matches a key of `CHECKPOINT_SCHEMA`. */
  readonly dexieTable: string

  /** Supabase (Postgres) table name — matches `CREATE TABLE public.<name>`. */
  readonly supabaseTable: string

  /**
   * Conflict resolution strategy applied by the download phase (E92-S06).
   *
   * - `lww`: last-write-wins on `updated_at` (server wins if server is newer)
   * - `monotonic`: `GREATEST()` applied to `monotonicFields` (never decrease)
   * - `insert-only`: INSERT never UPDATE; duplicate inserts are no-ops
   * - `conflict-copy`: divergent writes within 5s window are both preserved
   * - `skip`: declared but not synced (populated in E96-S04)
   */
  readonly conflictStrategy: 'lww' | 'monotonic' | 'insert-only' | 'conflict-copy' | 'skip'

  /**
   * Download priority bucket. P0 downloads first, P4 last.
   * Shared buckets download in parallel.
   */
  readonly priority: 0 | 1 | 2 | 3 | 4

  /**
   * camelCase (Dexie) → snake_case (Supabase) field rename table.
   *
   * Entries that translate 1:1 via `IDENTITY_FIELD_MAP` (`userId`,
   * `createdAt`, `updatedAt`) need not be listed here. Passthrough fields
   * that have the same name on both sides (e.g., `id`, `tags`) also need
   * not be listed.
   */
  readonly fieldMap: Readonly<Record<string, string>>

  /**
   * Fields dropped entirely before upload (non-serializable IndexedDB
   * handles like `FileSystemDirectoryHandle`, `File`, `Blob`, etc.).
   *
   * These fields are local-only and have no Supabase column.
   */
  readonly stripFields?: readonly string[]

  /**
   * Fields that must never decrease on the server side. The upload phase
   * uses the table's dedicated `upsert_<table>()` function instead of a
   * generic upsert. The download phase applies `Math.max()` when merging.
   */
  readonly monotonicFields?: readonly string[]

  /**
   * Fields that together form the primary key. Only set for tables with
   * compound PKs (e.g., `progress.[courseId+videoId]`). The upload phase
   * reads this to construct the correct `onConflict` target.
   */
  readonly compoundPkFields?: readonly string[]

  /**
   * Fields stored in Supabase Vault (encrypted credential storage) rather
   * than as regular row columns. Stripped from the row payload at upload
   * time; written to Vault in a separate call (E95 owns the Vault write).
   */
  readonly vaultFields?: readonly string[]

  /**
   * Convenience boolean redundant with `conflictStrategy: 'insert-only'`.
   * Kept separate so test filters and reviewer tooling can distinguish
   * "declared insert-only" from "strategy happens to be insert-only".
   */
  readonly insertOnly?: boolean

  /**
   * When `true`, the sync engine ignores this table entirely. Declared on
   * the interface so E96-S04's later spike can populate it without editing
   * the interface. No entries use this flag in E92-S03.
   */
  readonly skipSync?: boolean
}

/**
 * Universal camelCase → snake_case rename for identity fields present on
 * every syncable record. Applied by `fieldMapper.toSnakeCase()` on top of
 * the per-table `fieldMap`. A per-table override (hypothetical) takes
 * precedence when explicitly present in `fieldMap`.
 */
export const IDENTITY_FIELD_MAP = {
  userId: 'user_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

/**
 * The registry itself — keyed by Dexie table name so downstream code can
 * do `tableRegistry[dexieTable]` lookups with compile-time narrowing.
 *
 * Entries are populated across Units 2 (P0), 3 (P1), and 4 (P2/P3/P4).
 * Each priority group is grouped together and ordered roughly by
 * feature-area for readability.
 */
export const tableRegistry: Readonly<Record<string, TableRegistryEntry>> = {
  // ── P0: Core progress + sessions ─────────────────────────────────────

  contentProgress: {
    dexieTable: 'contentProgress',
    supabaseTable: 'content_progress',
    conflictStrategy: 'lww',
    priority: 0,
    compoundPkFields: ['courseId', 'itemId'],
    fieldMap: {
      // Dexie `ContentProgress` (src/data/types.ts) has: courseId, itemId,
      // status, updatedAt. Supabase `content_progress` has: user_id,
      // content_id, content_type, status, progress_pct, completed_at,
      // created_at, updated_at.
      //
      // Pure-rename fields only. The upload phase (E92-S05) is responsible
      // for projecting `(courseId, itemId)` into `(content_id, content_type)`
      // since the Dexie shape does not carry `content_type` explicitly and
      // `itemId` is the semantic content identifier.
      courseId: 'course_id',
      itemId: 'item_id',
    },
  },

  studySessions: {
    dexieTable: 'studySessions',
    supabaseTable: 'study_sessions',
    conflictStrategy: 'insert-only',
    priority: 0,
    insertOnly: true,
    fieldMap: {
      // Dexie `StudySession`: courseId, contentItemId, startTime, endTime,
      // duration, idleTime, videosWatched[], lastActivity, sessionType,
      // interactionCount?, breakCount?, qualityScore?, qualityFactors?
      // Supabase `study_sessions`: user_id, started_at, duration_seconds,
      // idle_seconds, interaction_count, breaks, created_at
      //
      // Supabase lacks `updated_at` — study_sessions is immutable. Download
      // cursor is `created_at` (E92-S06 must special-case this).
      startTime: 'started_at',
      duration: 'duration_seconds',
      idleTime: 'idle_seconds',
      interactionCount: 'interaction_count',
      breakCount: 'breaks',
    },
    stripFields: [
      // Fields with no Supabase column — not synced as individual fields on
      // study_sessions. (`videosWatched` denormalized into interactionCount.)
      'courseId',
      'contentItemId',
      'endTime',
      'videosWatched',
      'lastActivity',
      'sessionType',
      'qualityScore',
      'qualityFactors',
    ],
  },

  progress: {
    dexieTable: 'progress',
    supabaseTable: 'video_progress',
    conflictStrategy: 'monotonic',
    priority: 0,
    compoundPkFields: ['courseId', 'videoId'],
    monotonicFields: ['watchedSeconds'],
    fieldMap: {
      // Dexie `VideoProgress`: courseId, videoId, currentTime,
      // completionPercentage, completedAt?, currentPage?
      // Supabase `video_progress`: user_id, video_id, watched_seconds,
      // duration_seconds, last_position, watched_percent (generated),
      // created_at, updated_at. UNIQUE(user_id, video_id).
      //
      // Semantic mismatch: Dexie's `currentTime` is playback position
      // (seconds), but Supabase's `watched_seconds` is cumulative watched
      // duration. E92-S05 must decide how to reconcile — for now the
      // registry declares the rename and E92-S05 handles the semantic.
      courseId: 'course_id',
      videoId: 'video_id',
      currentTime: 'watched_seconds',
    },
    stripFields: [
      // Fields not syncable (derived or local-only UX state).
      'completionPercentage',
      'completedAt',
      'currentPage',
    ],
  },

  // ── P1: Learning content (notes, flashcards, embeddings, books) ──────

  notes: {
    dexieTable: 'notes',
    supabaseTable: 'notes',
    conflictStrategy: 'conflict-copy',
    priority: 1,
    fieldMap: {
      courseId: 'course_id',
      videoId: 'video_id',
      contentId: 'content_id',
      contentType: 'content_type',
      softDeleted: 'soft_deleted',
      conflictCopy: 'conflict_copy',
      conflictSourceId: 'conflict_source_id',
    },
  },

  bookmarks: {
    dexieTable: 'bookmarks',
    supabaseTable: 'bookmarks',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      courseId: 'course_id',
      lessonId: 'lesson_id',
      videoId: 'video_id',
      // E93-S01 Supabase schema uses `position_seconds`; Dexie record stores `timestamp`.
      timestamp: 'position_seconds',
    },
  },

  flashcards: {
    dexieTable: 'flashcards',
    supabaseTable: 'flashcards',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      courseId: 'course_id',
      noteId: 'note_id',
      sourceType: 'source_type',
      sourceNoteId: 'source_note_id',
      sourceBookId: 'source_book_id',
      sourceHighlightId: 'source_highlight_id',
      dueDate: 'due_date',
      elapsedDays: 'elapsed_days',
      scheduledDays: 'scheduled_days',
      lastReview: 'last_review',
    },
  },

  // `reviewRecords` is included in the registry with `skipSync: true` so
  // that `backfill.ts` still stamps `userId` on local records (the table has
  // a `[userId+updatedAt]` index and must partition by user) — but the sync
  // engine ignores it entirely. `flashcard_reviews` (Supabase-only INSERT-
  // only table) is populated in E92-S05 from reviewRecords mutations; it
  // has no Dexie equivalent and therefore no registry entry.
  reviewRecords: {
    dexieTable: 'reviewRecords',
    supabaseTable: 'flashcard_reviews', // not actually used — skipSync short-circuits upload
    conflictStrategy: 'skip',
    priority: 1,
    skipSync: true,
    fieldMap: {
      noteId: 'note_id',
      // `last_review` is snake_case in the Dexie index string for historical
      // reasons (pre-sync), so the camelCase property name on the record is
      // already `last_review`. Left as identity (no rename).
    },
  },

  embeddings: {
    dexieTable: 'embeddings',
    supabaseTable: 'embeddings',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      noteId: 'note_id',
      // `embedding` / `vector` — E93-S01 uses `vector` column name; Dexie
      // record stores `embedding: Float32Array`. Upload phase converts to
      // plain array.
      embedding: 'vector',
    },
  },

  bookHighlights: {
    dexieTable: 'bookHighlights',
    supabaseTable: 'book_highlights',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      bookId: 'book_id',
      chapterId: 'chapter_id',
      cfiRange: 'cfi_range',
      flashcardId: 'flashcard_id',
      reviewRating: 'review_rating',
      lastReviewedAt: 'last_reviewed_at',
    },
  },

  vocabularyItems: {
    dexieTable: 'vocabularyItems',
    supabaseTable: 'vocabulary_items',
    conflictStrategy: 'lww',
    priority: 1,
    monotonicFields: ['masteryLevel'],
    fieldMap: {
      masteryLevel: 'mastery_level',
      sourceBookId: 'source_book_id',
      sourceHighlightId: 'source_highlight_id',
      flashcardId: 'flashcard_id',
    },
  },

  audioBookmarks: {
    dexieTable: 'audioBookmarks',
    supabaseTable: 'audio_bookmarks',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      bookId: 'book_id',
      chapterIndex: 'chapter_index',
      // Dexie stores `timestamp` (seconds); Supabase column is `position_seconds`.
      timestamp: 'position_seconds',
    },
  },

  audioClips: {
    dexieTable: 'audioClips',
    supabaseTable: 'audio_clips',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      bookId: 'book_id',
      chapterId: 'chapter_id',
      startTime: 'start_time_seconds',
      endTime: 'end_time_seconds',
      sortOrder: 'sort_order',
    },
  },

  chatConversations: {
    dexieTable: 'chatConversations',
    supabaseTable: 'chat_conversations',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      courseId: 'course_id',
      videoId: 'video_id',
      // `createdAtEpoch` is a bigint (ms since epoch) distinct from the
      // universal `createdAt` ISO timestamp. Kept as separate field.
      createdAtEpoch: 'created_at_epoch',
    },
  },

  learnerModels: {
    dexieTable: 'learnerModels',
    supabaseTable: 'learner_models',
    conflictStrategy: 'lww',
    priority: 1,
    fieldMap: {
      courseId: 'course_id',
      vocabularyLevel: 'vocabulary_level',
      // jsonb fields pass through by reference; no per-key renaming.
      quizStats: 'quiz_stats',
    },
  },

  // ── P2: Library — courses, books, authors, shelves ───────────────────

  importedCourses: {
    dexieTable: 'importedCourses',
    supabaseTable: 'imported_courses',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      importedAt: 'imported_at',
    },
    stripFields: [
      // FileSystemDirectoryHandle — browser-only, non-serializable.
      'directoryHandle',
    ],
  },

  importedVideos: {
    dexieTable: 'importedVideos',
    supabaseTable: 'imported_videos',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      courseId: 'course_id',
      youtubeVideoId: 'youtube_video_id',
    },
    stripFields: [
      // File/FileHandle references — local playback only.
      'fileHandle',
      'file',
    ],
  },

  importedPdfs: {
    dexieTable: 'importedPdfs',
    supabaseTable: 'imported_pdfs',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      courseId: 'course_id',
    },
    stripFields: [
      'fileHandle',
      'file',
    ],
  },

  authors: {
    dexieTable: 'authors',
    supabaseTable: 'authors',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {},
    stripFields: [
      // Photo stored locally as Blob reference; not synced.
      'photoHandle',
      'photo',
      'photoBlob',
    ],
  },

  books: {
    dexieTable: 'books',
    supabaseTable: 'books',
    conflictStrategy: 'lww',
    priority: 2,
    monotonicFields: ['progress'],
    fieldMap: {
      lastOpenedAt: 'last_opened_at',
    },
    stripFields: [
      // Cover image / book file stored locally; not part of the row.
      // Transferred via Storage bucket in E94.
      'coverImageHandle',
      'coverImageBlob',
      'coverBlob',
      'fileHandle',
    ],
  },

  bookReviews: {
    dexieTable: 'bookReviews',
    supabaseTable: 'book_reviews',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      bookId: 'book_id',
    },
  },

  shelves: {
    dexieTable: 'shelves',
    supabaseTable: 'shelves',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      isDefault: 'is_default',
      sortOrder: 'sort_order',
    },
  },

  bookShelves: {
    dexieTable: 'bookShelves',
    supabaseTable: 'book_shelves',
    conflictStrategy: 'lww',
    priority: 2,
    compoundPkFields: ['bookId', 'shelfId'],
    fieldMap: {
      bookId: 'book_id',
      shelfId: 'shelf_id',
      addedAt: 'added_at',
    },
  },

  readingQueue: {
    dexieTable: 'readingQueue',
    supabaseTable: 'reading_queue',
    conflictStrategy: 'lww',
    priority: 2,
    fieldMap: {
      bookId: 'book_id',
      sortOrder: 'sort_order',
      addedAt: 'added_at',
    },
  },

  chapterMappings: {
    dexieTable: 'chapterMappings',
    supabaseTable: 'chapter_mappings',
    conflictStrategy: 'lww',
    priority: 2,
    compoundPkFields: ['epubBookId', 'audioBookId'],
    fieldMap: {
      epubBookId: 'epub_book_id',
      audioBookId: 'audio_book_id',
    },
  },

  // ── P3: Learning paths, reminders, credential catalogs, notifications ─

  learningPaths: {
    dexieTable: 'learningPaths',
    supabaseTable: 'learning_paths',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {},
  },

  learningPathEntries: {
    dexieTable: 'learningPathEntries',
    supabaseTable: 'learning_path_entries',
    conflictStrategy: 'lww',
    priority: 3,
    compoundPkFields: ['pathId', 'courseId'],
    fieldMap: {
      pathId: 'path_id',
      courseId: 'course_id',
    },
  },

  challenges: {
    dexieTable: 'challenges',
    supabaseTable: 'challenges',
    conflictStrategy: 'lww',
    priority: 3,
    monotonicFields: ['currentProgress'],
    fieldMap: {
      targetValue: 'target_value',
      currentProgress: 'current_progress',
      celebratedMilestones: 'celebrated_milestones',
      completedAt: 'completed_at',
    },
  },

  courseReminders: {
    dexieTable: 'courseReminders',
    supabaseTable: 'course_reminders',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {
      courseId: 'course_id',
    },
  },

  notifications: {
    dexieTable: 'notifications',
    supabaseTable: 'notifications',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {
      readAt: 'read_at',
      dismissedAt: 'dismissed_at',
    },
  },

  careerPaths: {
    dexieTable: 'careerPaths',
    supabaseTable: 'career_paths',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {},
  },

  pathEnrollments: {
    dexieTable: 'pathEnrollments',
    supabaseTable: 'path_enrollments',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {
      pathId: 'path_id',
    },
  },

  studySchedules: {
    dexieTable: 'studySchedules',
    supabaseTable: 'study_schedules',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {
      courseId: 'course_id',
      learningPathId: 'learning_path_id',
    },
  },

  opdsCatalogs: {
    dexieTable: 'opdsCatalogs',
    supabaseTable: 'opds_catalogs',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {},
    vaultFields: [
      // Never sent as part of the row payload — E95 writes to Supabase
      // Vault in a separate call.
      'password',
    ],
  },

  audiobookshelfServers: {
    dexieTable: 'audiobookshelfServers',
    supabaseTable: 'audiobookshelf_servers',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {
      lastSyncedAt: 'last_synced_at',
    },
    vaultFields: [
      'apiKey',
    ],
  },

  notificationPreferences: {
    dexieTable: 'notificationPreferences',
    supabaseTable: 'notification_preferences',
    conflictStrategy: 'lww',
    priority: 3,
    fieldMap: {},
  },

  // ── P4: Quizzes + AI usage events (append-only analytics) ────────────

  quizzes: {
    dexieTable: 'quizzes',
    supabaseTable: 'quizzes',
    conflictStrategy: 'lww',
    priority: 4,
    fieldMap: {
      lessonId: 'lesson_id',
      transcriptHash: 'transcript_hash',
    },
  },

  quizAttempts: {
    dexieTable: 'quizAttempts',
    supabaseTable: 'quiz_attempts',
    conflictStrategy: 'insert-only',
    priority: 4,
    insertOnly: true,
    fieldMap: {
      quizId: 'quiz_id',
      completedAt: 'completed_at',
    },
  },

  aiUsageEvents: {
    dexieTable: 'aiUsageEvents',
    supabaseTable: 'ai_usage_events',
    conflictStrategy: 'insert-only',
    priority: 4,
    insertOnly: true,
    fieldMap: {
      featureType: 'feature_type',
      courseId: 'course_id',
    },
  },
} as const

/**
 * Helper: array of all Dexie table names in the registry, in declaration order.
 * Used by `backfill.ts` (Unit 7) and download scheduling (E92-S06).
 */
export const SYNCABLE_TABLE_NAMES: readonly string[] = Object.freeze(
  Object.keys(tableRegistry),
)

/**
 * Helper: array of registry entries, in declaration order. Most consumers
 * want this for priority-ordered iteration.
 */
export const SYNCABLE_TABLES: readonly TableRegistryEntry[] = Object.freeze(
  Object.values(tableRegistry),
)

/**
 * Type alias for downstream narrowing: `keyof typeof tableRegistry`.
 * Note: because `tableRegistry` is typed `Readonly<Record<string, ...>>`
 * rather than a literal object type, this resolves to `string` at compile
 * time. Consumers should treat table-name lookups as string-keyed.
 */
export type RegistryTableName = keyof typeof tableRegistry
