/**
 * Sync Table Registry — E92-S03
 *
 * Declarative mapping from every syncable Dexie table to its Supabase counterpart.
 * This is the single source of truth for:
 *  - conflict resolution strategy per table
 *  - priority tier for upload ordering
 *  - camelCase → snake_case field overrides (non-obvious only)
 *  - fields to strip before upload (non-serializable: FileSystemHandles, Blobs)
 *  - monotonic fields (use GREATEST() in Supabase upsert — never regresses)
 *  - vault fields (routed to Supabase Vault, never stored in Postgres columns)
 *  - compound primary key fields (for ON CONFLICT clause construction)
 *
 * Pure declarative config — no runtime logic, no imports from the app layer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How the sync engine resolves a Dexie ↔ Supabase conflict for this table. */
export type ConflictStrategy =
  | 'lww' // Last-Write-Wins: highest `updatedAt` wins
  | 'monotonic' // LWW, but certain fields only advance (GREATEST())
  | 'insert-only' // Append-only: INSERT, never UPDATE (dedup by id)
  | 'conflict-copy' // Both versions preserved; conflicting copy tagged `conflict-copy`

/**
 * Upload priority tier — lower number = uploaded first.
 * P0: "Where was I?" (progress, sessions)
 * P1: Learning content (notes, bookmarks, flashcards, books)
 * P2: Settings-adjacent (catalogs, schedules, paths)
 * P3: Communication (notifications, AI events, reminders)
 * P4: Advanced / derived (chat, embeddings, quizzes, authors)
 */
export type PriorityTier = 0 | 1 | 2 | 3 | 4

/** Full configuration for one syncable Dexie table. */
export interface SyncTableConfig {
  /** Dexie table name (camelCase, matches ElearningDatabase key). */
  dexieTable: string
  /** Supabase table name (snake_case). */
  supabaseTable: string
  /** Conflict resolution strategy. */
  conflictStrategy: ConflictStrategy
  /** Upload priority (0 = highest). */
  priorityTier: PriorityTier
  /**
   * camelCase → snake_case field name overrides.
   * Only non-obvious mappings; obvious ones (courseId → course_id) are
   * handled by the engine's default camel→snake converter.
   */
  fieldMap: Record<string, string>
  /**
   * Fields to strip from the Dexie record before uploading.
   * Typically FileSystemHandleType, Blob, or other non-serializable types.
   */
  nonSerializableFields: string[]
  /**
   * Fields that must only ever advance in value (GREATEST() in upsert).
   * e.g. watchedPercent, masteryLevel — local value never overwrites a
   * higher server value.
   */
  monotonicFields?: string[]
  /**
   * Fields that should be routed to Supabase Vault rather than stored in
   * Postgres columns (e.g. passwords, API keys).
   */
  vaultFields?: string[]
  /**
   * Compound primary key field names.
   * When set, the upload engine uses these to build
   * `ON CONFLICT (field1, field2) DO UPDATE ...` instead of `ON CONFLICT (id)`.
   */
  compoundPkFields?: string[]
}

// ---------------------------------------------------------------------------
// Skip-sync tables
// ---------------------------------------------------------------------------

/**
 * Tables that must NOT be synced to Supabase.
 * Reasons: cache/derived data, binary blobs, server-authoritative, or
 * regenerable per-device content.
 */
export const SKIP_SYNC_TABLES = new Set<string>([
  'courseThumbnails', // binary image cache — regenerable
  'screenshots', // binary captures — local-only
  'entitlements', // server-authoritative — clients SELECT only
  'youtubeVideoCache', // short-lived API response cache
  'youtubeTranscripts', // regenerable per device from YouTube API
  'youtubeChapters', // derived from transcript pipeline
  'courseEmbeddings', // ML derived — regenerable
  'bookFiles', // binary EPUB/PDF blobs — Storage bucket handles these
  'transcriptEmbeddings', // ML derived — regenerable
  'videoCaptions', // user-loaded subtitle files — local-only
])

// ---------------------------------------------------------------------------
// Table Registry
// ---------------------------------------------------------------------------

/**
 * Full registry of all 38 syncable Dexie tables.
 * Keyed by Dexie table name (camelCase).
 */
export const tableRegistry: Record<string, SyncTableConfig> = {
  // ─── P0: "Where was I?" ───────────────────────────────────────────────────

  contentProgress: {
    dexieTable: 'contentProgress',
    supabaseTable: 'content_progress',
    conflictStrategy: 'monotonic',
    priorityTier: 0,
    fieldMap: {},
    nonSerializableFields: [],
    monotonicFields: ['status'], // status precedence: not-started < in-progress < completed
    compoundPkFields: ['courseId', 'itemId'],
  },

  studySessions: {
    dexieTable: 'studySessions',
    supabaseTable: 'study_sessions',
    conflictStrategy: 'insert-only',
    priorityTier: 0,
    fieldMap: {},
    nonSerializableFields: [],
  },

  progress: {
    dexieTable: 'progress',
    supabaseTable: 'video_progress',
    conflictStrategy: 'monotonic',
    priorityTier: 0,
    fieldMap: {
      // 'progress' table stores VideoProgress; maps to video_progress Supabase table
    },
    nonSerializableFields: [],
    monotonicFields: ['watchedPercent'],
    compoundPkFields: ['courseId', 'videoId'],
  },

  // ─── P1: Learning Content ─────────────────────────────────────────────────

  notes: {
    dexieTable: 'notes',
    supabaseTable: 'notes',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  bookmarks: {
    dexieTable: 'bookmarks',
    supabaseTable: 'bookmarks',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  flashcards: {
    dexieTable: 'flashcards',
    supabaseTable: 'flashcards',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  books: {
    dexieTable: 'books',
    supabaseTable: 'books',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    // FileSystemHandles and Blobs cannot be serialized for upload
    nonSerializableFields: ['directoryHandle', 'fileHandle', 'coverBlob'],
  },

  bookHighlights: {
    dexieTable: 'bookHighlights',
    supabaseTable: 'book_highlights',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  vocabularyItems: {
    dexieTable: 'vocabularyItems',
    supabaseTable: 'vocabulary_items',
    conflictStrategy: 'monotonic',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
    monotonicFields: ['masteryLevel'], // mastery only advances: 0→1→2→3
  },

  shelves: {
    dexieTable: 'shelves',
    supabaseTable: 'shelves',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  bookShelves: {
    dexieTable: 'bookShelves',
    supabaseTable: 'book_shelves',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  readingQueue: {
    dexieTable: 'readingQueue',
    supabaseTable: 'reading_queue',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  audioClips: {
    dexieTable: 'audioClips',
    supabaseTable: 'audio_clips',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  bookReviews: {
    dexieTable: 'bookReviews',
    supabaseTable: 'book_reviews',
    conflictStrategy: 'lww',
    priorityTier: 1,
    fieldMap: {},
    nonSerializableFields: [],
  },

  // ─── P2: Settings-Adjacent ────────────────────────────────────────────────

  opdsCatalogs: {
    dexieTable: 'opdsCatalogs',
    supabaseTable: 'opds_catalogs',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
    // OPDS auth credentials routed to Vault — not stored in Postgres columns
    vaultFields: ['password'],
  },

  audiobookshelfServers: {
    dexieTable: 'audiobookshelfServers',
    supabaseTable: 'audiobookshelf_servers',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
    // ABS API key routed to Vault — not stored in Postgres columns
    vaultFields: ['apiKey'],
  },

  chapterMappings: {
    dexieTable: 'chapterMappings',
    supabaseTable: 'chapter_mappings',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
    compoundPkFields: ['epubBookId', 'audioBookId'],
  },

  learningPaths: {
    dexieTable: 'learningPaths',
    supabaseTable: 'learning_paths',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  learningPathEntries: {
    dexieTable: 'learningPathEntries',
    supabaseTable: 'learning_path_entries',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  challenges: {
    dexieTable: 'challenges',
    supabaseTable: 'challenges',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  studySchedules: {
    dexieTable: 'studySchedules',
    supabaseTable: 'study_schedules',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  careerPaths: {
    dexieTable: 'careerPaths',
    supabaseTable: 'career_paths',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  pathEnrollments: {
    dexieTable: 'pathEnrollments',
    supabaseTable: 'path_enrollments',
    conflictStrategy: 'lww',
    priorityTier: 2,
    fieldMap: {},
    nonSerializableFields: [],
  },

  // ─── P3: Communication / Events ───────────────────────────────────────────

  importedCourses: {
    dexieTable: 'importedCourses',
    supabaseTable: 'imported_courses',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  importedVideos: {
    dexieTable: 'importedVideos',
    supabaseTable: 'imported_videos',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  importedPdfs: {
    dexieTable: 'importedPdfs',
    supabaseTable: 'imported_pdfs',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  courseReminders: {
    dexieTable: 'courseReminders',
    supabaseTable: 'course_reminders',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  notifications: {
    dexieTable: 'notifications',
    supabaseTable: 'notifications',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  notificationPreferences: {
    dexieTable: 'notificationPreferences',
    supabaseTable: 'notification_preferences',
    conflictStrategy: 'lww',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  aiUsageEvents: {
    dexieTable: 'aiUsageEvents',
    supabaseTable: 'ai_usage_events',
    conflictStrategy: 'insert-only',
    priorityTier: 3,
    fieldMap: {},
    nonSerializableFields: [],
  },

  // ─── P4: Advanced / Derived ───────────────────────────────────────────────

  chatConversations: {
    dexieTable: 'chatConversations',
    supabaseTable: 'chat_conversations',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  learnerModels: {
    dexieTable: 'learnerModels',
    supabaseTable: 'learner_models',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  authors: {
    dexieTable: 'authors',
    supabaseTable: 'authors',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  quizzes: {
    dexieTable: 'quizzes',
    supabaseTable: 'quizzes',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  quizAttempts: {
    dexieTable: 'quizAttempts',
    supabaseTable: 'quiz_attempts',
    conflictStrategy: 'insert-only',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  embeddings: {
    dexieTable: 'embeddings',
    supabaseTable: 'embeddings',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  reviewRecords: {
    dexieTable: 'reviewRecords',
    supabaseTable: 'review_records',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },

  audioBookmarks: {
    dexieTable: 'audioBookmarks',
    supabaseTable: 'audio_bookmarks',
    conflictStrategy: 'lww',
    priorityTier: 4,
    fieldMap: {},
    nonSerializableFields: [],
  },
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Look up the sync config for a Dexie table by name.
 *
 * Returns `undefined` for:
 * - Tables in `SKIP_SYNC_TABLES` (local-only / cache / server-authoritative)
 * - Unknown table names
 *
 * @param dexieTable - Dexie table name (camelCase)
 */
export function getTableConfig(dexieTable: string): SyncTableConfig | undefined {
  if (SKIP_SYNC_TABLES.has(dexieTable)) return undefined
  return tableRegistry[dexieTable]
}
