import Dexie, { type EntityTable, type Table } from 'dexie'
import type { EntityType } from '@/lib/unifiedSearch'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  VideoBookmark,
  Note,
  Screenshot,
  StudySession,
  ContentProgress,
  Challenge,
  Embedding,
  LearningPathCourse,
  LearningPath,
  LearningPathEntry,
  CourseThumbnail,
  AIUsageEvent,
  ReviewRecord,
  CourseReminder,
  VideoCaptionRecord,
  Flashcard,
  ImportedAuthor,
  CareerPath,
  PathEnrollment,
  CachedEntitlement,
  YouTubeVideoCache,
  YouTubeTranscriptRecord,
  YouTubeCourseChapter,
  Notification,
  NotificationPreferences,
  CourseEmbedding,
  StudySchedule,
  Book,
  BookHighlight,
  AudioBookmark,
  AudioClip,
  OpdsCatalog,
  AudiobookshelfServer,
  VocabularyItem,
  BookReview,
  ChatConversation,
  TranscriptEmbedding,
  LearnerModel,
} from '@/data/types'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { CHECKPOINT_VERSION, CHECKPOINT_SCHEMA, SEARCH_FRECENCY_INDEXES } from './checkpoint'

/**
 * Sync queue entry — tracks pending push to Supabase.
 * Inserted by `syncableWrite()` (E92-S04), drained by the upload engine (E92-S05).
 */
export interface SyncQueueEntry {
  id?: number
  tableName: string
  recordId: string
  operation: 'put' | 'add' | 'delete'
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'uploading' | 'dead-letter'
  createdAt: string
  updatedAt: string
  lastError?: string
}

/**
 * Sync metadata — per-table checkpoint for incremental download.
 * Keyed by `table` (either a Dexie table name or the `__global__` sentinel).
 */
export interface SyncMetadataEntry {
  table: string
  lastSyncTimestamp?: string
  lastUploadedKey?: string
}

/**
 * Frecency row — persistent per-entity counter used by unified search to rank
 * "Best Matches" above the grouped results (E117-S02).
 *
 * Compound primary key: `[entityType+entityId]` so a single entity maps to one row.
 * Local-only: no `userId`, not in `SYNCABLE_TABLES`. Device-local ranking signal
 * — cross-device sync is intentionally deferred (sync would make device-specific
 * ranking shared, which isn't the desired semantic).
 */
export interface FrecencyRow {
  entityType: EntityType
  entityId: string
  openCount: number
  lastOpenedAt: string
}

/** Typed Dexie database interface for ElearningDB */
export type ElearningDatabase = Dexie & {
  importedCourses: EntityTable<ImportedCourse, 'id'>
  importedVideos: EntityTable<ImportedVideo, 'id'>
  importedPdfs: EntityTable<ImportedPdf, 'id'>
  progress: EntityTable<VideoProgress, 'courseId'>
  bookmarks: EntityTable<VideoBookmark, 'id'>
  notes: EntityTable<Note, 'id'>
  screenshots: EntityTable<Screenshot, 'id'>
  studySessions: EntityTable<StudySession, 'id'>
  contentProgress: Table<ContentProgress> // compound PK: [courseId+itemId]
  challenges: EntityTable<Challenge, 'id'>
  embeddings: EntityTable<Embedding, 'noteId'>
  // learningPath table dropped in v25 (migrated to learningPaths + learningPathEntries)
  learningPaths: EntityTable<LearningPath, 'id'>
  learningPathEntries: EntityTable<LearningPathEntry, 'id'>
  courseThumbnails: EntityTable<CourseThumbnail, 'courseId'>
  aiUsageEvents: EntityTable<AIUsageEvent, 'id'>
  reviewRecords: EntityTable<ReviewRecord, 'id'>
  courseReminders: EntityTable<CourseReminder, 'id'>
  // courses table dropped in v30 (E89-S01) — dead regular course system removed
  quizzes: EntityTable<Quiz, 'id'>
  quizAttempts: EntityTable<QuizAttempt, 'id'>
  videoCaptions: Table<VideoCaptionRecord> // compound PK: [courseId+videoId]
  flashcards: EntityTable<Flashcard, 'id'>
  authors: EntityTable<ImportedAuthor, 'id'>
  careerPaths: EntityTable<CareerPath, 'id'>
  pathEnrollments: EntityTable<PathEnrollment, 'id'>
  entitlements: EntityTable<CachedEntitlement, 'userId'>
  youtubeVideoCache: EntityTable<YouTubeVideoCache, 'videoId'>
  youtubeTranscripts: Table<YouTubeTranscriptRecord> // compound PK: [courseId+videoId]
  youtubeChapters: EntityTable<YouTubeCourseChapter, 'id'>
  notifications: EntityTable<Notification, 'id'>
  notificationPreferences: EntityTable<NotificationPreferences, 'id'>
  courseEmbeddings: EntityTable<CourseEmbedding, 'courseId'>
  studySchedules: EntityTable<StudySchedule, 'id'>
  books: EntityTable<Book, 'id'>
  bookHighlights: EntityTable<BookHighlight, 'id'>
  bookFiles: Table<{ bookId: string; filename: string; blob: Blob }> // OPFS fallback
  audioBookmarks: EntityTable<AudioBookmark, 'id'>
  opdsCatalogs: EntityTable<OpdsCatalog, 'id'>
  audiobookshelfServers: EntityTable<AudiobookshelfServer, 'id'>
  chapterMappings: Table<import('@/data/types').ChapterMappingRecord> // compound PK: [epubBookId+audioBookId]
  vocabularyItems: EntityTable<VocabularyItem, 'id'>
  shelves: EntityTable<import('@/data/types').Shelf, 'id'>
  bookShelves: EntityTable<import('@/data/types').BookShelfEntry, 'id'>
  readingQueue: EntityTable<import('@/data/types').ReadingQueueEntry, 'id'>
  audioClips: EntityTable<AudioClip, 'id'>
  bookReviews: EntityTable<BookReview, 'id'>
  chatConversations: EntityTable<ChatConversation, 'id'>
  transcriptEmbeddings: EntityTable<TranscriptEmbedding, 'id'>
  learnerModels: EntityTable<LearnerModel, 'id'>
  // v52: Sync foundation (E92-S02)
  syncQueue: EntityTable<SyncQueueEntry, 'id'>
  syncMetadata: EntityTable<SyncMetadataEntry, 'table'>
  // v53: Unified-search frecency counters (E117-S02). Compound PK: [entityType+entityId].
  searchFrecency: Table<FrecencyRow, [string, string]>
}

/**
 * Declare all incremental migration versions (v1–v27) on a Dexie instance.
 * Required for existing users who need to upgrade from any prior version.
 * Exported for testing: allows comparing migration-built schema vs checkpoint schema.
 */
export function declareLegacyMigrations(database: Dexie): void {
  _declareLegacyMigrations(database)
}

/**
 * Create a fresh Dexie instance using only the checkpoint schema (no migration history).
 * This is what new installs get — a single version declaration with the full schema.
 * Exported for testing: allows comparing checkpoint schema vs migration-built schema.
 */
export function createCheckpointDb(dbName: string): ElearningDatabase {
  const freshDb = new Dexie(dbName) as ElearningDatabase
  freshDb.version(CHECKPOINT_VERSION).stores(CHECKPOINT_SCHEMA)
  return freshDb
}

const db = new Dexie('ElearningDB') as ElearningDatabase

// Declare all legacy migrations for backward compatibility with existing users.
// For fresh installs, Dexie already optimizes by creating the latest schema
// directly without running any upgrade() callbacks.
_declareLegacyMigrations(db)

function _declareLegacyMigrations(database: Dexie): void {
  database.version(1).stores({
    importedCourses: 'id, name, importedAt, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
  })

  database
    .version(2)
    .stores({
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
    })
    .upgrade(tx => {
      return tx
        .table('importedCourses')
        .toCollection()
        .modify(course => {
          if (!course.status) {
            course.status = 'active'
          }
        })
    })

  database.version(3).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, courseId, lessonId, createdAt',
  })

  // Type guards for migration data validation (prevents corrupt data crashes)
  interface MigrationNote {
    id: string
    content: string
    timestamp?: number
    createdAt: string
    updatedAt: string
    tags: string[]
  }

  interface MigrationCourseProgress {
    courseId: string
    notes?: Record<string, MigrationNote[]>
  }

  type MigrationProgress = Record<string, MigrationCourseProgress>

  function isValidMigrationNote(note: unknown): note is MigrationNote {
    if (typeof note !== 'object' || note === null) return false
    const n = note as Record<string, unknown>
    return (
      typeof n.id === 'string' &&
      typeof n.content === 'string' &&
      (n.timestamp === undefined || typeof n.timestamp === 'number') &&
      typeof n.createdAt === 'string' &&
      typeof n.updatedAt === 'string' &&
      Array.isArray(n.tags) &&
      n.tags.every((tag: unknown) => typeof tag === 'string')
    )
  }

  function isValidMigrationProgress(data: unknown): data is MigrationProgress {
    if (typeof data !== 'object' || data === null) return false
    const record = data as Record<string, unknown>

    return Object.entries(record).every(([_courseId, progress]) => {
      if (typeof progress !== 'object' || progress === null) return false
      const p = progress as Record<string, unknown>

      if (typeof p.courseId !== 'string') return false
      if (p.notes !== undefined) {
        if (typeof p.notes !== 'object' || p.notes === null) return false
        const notes = p.notes as Record<string, unknown>
        return Object.values(notes).every(lessonNotes => {
          if (!Array.isArray(lessonNotes)) return false
          return lessonNotes.every(isValidMigrationNote)
        })
      }
      return true
    })
  }

  database
    .version(4)
    .stores({
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    })
    .upgrade(async tx => {
      try {
        const PROGRESS_KEY = 'course-progress'
        const raw = localStorage.getItem(PROGRESS_KEY)
        if (!raw) {
          console.log('[Migration] No localStorage notes to migrate')
          return
        }

        // Security: Parse and validate JSON data before using it
        let parsedData: unknown
        try {
          parsedData = JSON.parse(raw)
        } catch (parseError) {
          console.error('[Migration] Failed to parse localStorage data:', parseError)
          return
        }

        // Security: Validate structure with type guard
        if (!isValidMigrationProgress(parsedData)) {
          console.error('[Migration] Invalid data structure, skipping migration')
          return
        }

        const allProgress: MigrationProgress = parsedData

        const notesToInsert: Note[] = []

        for (const [courseId, progress] of Object.entries(allProgress)) {
          if (!progress.notes) continue
          for (const [lessonId, notes] of Object.entries(progress.notes)) {
            if (!Array.isArray(notes)) continue
            for (const note of notes) {
              notesToInsert.push({
                id: note.id,
                courseId,
                videoId: lessonId,
                content: note.content,
                timestamp: note.timestamp,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                tags: note.tags || [],
              })
            }
          }
        }

        if (notesToInsert.length > 0) {
          await tx.table('notes').bulkAdd(notesToInsert)
        }

        // Count bookmarks already in Dexie for the log message
        const bookmarkCount = await tx.table('bookmarks').count()

        // Retain localStorage as backup (do NOT delete — per AC)
        console.log(
          `[Migration] Migrated ${notesToInsert.length} notes and ${bookmarkCount} bookmarks to IndexedDB`
        )
      } catch (error) {
        console.error('[Migration] Failed:', error)
        throw error
      }
    })

  database.version(5).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  })

  database.version(6).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
  })

  database.version(7).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
  })

  database.version(8).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
  })

  database.version(9).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
  })

  database.version(10).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
  })

  database.version(11).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
  })

  database.version(12).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
  })

  database.version(13).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
  })

  // v14: Quality scoring fields added to StudySession (E11-S03)
  // No new indexes needed — quality score fields are stored inline, not queried by index.
  // New optional fields: interactionCount, breakCount, qualityScore, qualityFactors
  database.version(14).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
  })

  // v15: Per-course study reminders (E11-S06)
  database.version(15).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
  })

  // v16: Seed courses table — moves hardcoded Course[] from src/data/courses into IndexedDB
  database.version(16).stores({
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, instructorId',
  })

  // v17: Quiz tables for quiz subsystem (E12-S02)
  database.version(17).stores({
    // All 17 existing v16 tables (unchanged — must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, instructorId',
    // NEW: Quiz tables
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
  })

  // v18: Caption file associations for user-loaded subtitles (E02-S10)
  database.version(18).stores({
    // All 19 existing v17 tables (unchanged — must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, instructorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    // NEW: User-loaded caption/subtitle file associations
    videoCaptions: '[courseId+videoId], courseId, videoId',
  })

  // v19: Rename instructorId → authorId in courses table
  database
    .version(19)
    .stores({
      // All 20 existing v18 tables (unchanged — must redeclare or Dexie deletes them)
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      learningPath: 'courseId, position, generatedAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
    })
    .upgrade(tx => {
      return tx
        .table('courses')
        .toCollection()
        .modify(course => {
          if (course.instructorId !== undefined) {
            course.authorId = course.instructorId
            delete course.instructorId
          }
        })
    })

  // v20: Authors table for user-managed author profiles (E25-S01)
  // Migration: pre-seeds Chase Hughes, migrates importedCourses authorName → ImportedAuthor records
  database
    .version(20)
    .stores({
      // All 21 existing v19 tables (unchanged — must redeclare or Dexie deletes them)
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      learningPath: 'courseId, position, generatedAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      // NEW: User-managed author profiles
      authors: 'id, name, createdAt',
    })
    .upgrade(async tx => {
      try {
        const now = new Date().toISOString()
        const authorsTable = tx.table('authors')
        const coursesTable = tx.table('importedCourses')

        // AC7: Pre-seed Chase Hughes from static data
        const chaseHughesId = 'chase-hughes'
        await authorsTable.add({
          id: chaseHughesId,
          name: 'Chase Hughes',
          bio: 'Chase Hughes is a leading expert in behavioral analysis, persuasion, and influence. With over two decades of experience training law enforcement, intelligence professionals, and military personnel worldwide, he has developed some of the most advanced behavioral profiling techniques used in the field today.',
          photoUrl: '/images/instructors/chase-hughes',
          courseIds: [],
          specialties: [
            'Behavioral Analysis',
            'Deception Detection',
            'Body Language',
            'Influence & Persuasion',
            'Operative Training',
          ],
          socialLinks: {
            website: 'https://www.chasehughes.com',
            twitter: 'https://twitter.com/taborplace',
          },
          isPreseeded: true,
          createdAt: now,
          updatedAt: now,
        })

        // AC3: Migrate existing importedCourses with authorName strings to ImportedAuthor records
        const courses = await coursesTable.toArray()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coursesWithAuthorName = courses.filter((c: any) => c.authorName)

        if (coursesWithAuthorName.length > 0) {
          // Deduplicate author names (case-insensitive, trimmed)
          const authorMap = new Map<string, string>() // normalized name → author ID
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const course of coursesWithAuthorName as any[]) {
            const rawName: string = course.authorName
            const normalized = rawName.trim().toLowerCase()

            // Skip empty strings after trimming
            if (!normalized) continue

            if (!authorMap.has(normalized)) {
              const authorId = crypto.randomUUID()
              authorMap.set(normalized, authorId)

              // Use the original (first-seen) name for display
              await authorsTable.add({
                id: authorId,
                name: rawName.trim(),
                bio: undefined,
                photoUrl: undefined,
                courseIds: [course.id],
                isPreseeded: false,
                createdAt: now,
                updatedAt: now,
              })
            } else {
              // Link course to existing author and update courseIds
              const existingAuthorId = authorMap.get(normalized)!
              const existingAuthor = await authorsTable.get(existingAuthorId)
              if (existingAuthor) {
                await authorsTable.update(existingAuthorId, {
                  courseIds: [...existingAuthor.courseIds, course.id],
                })
              }
            }

            // Set authorId on the course
            await coursesTable.update(course.id, {
              authorId: authorMap.get(normalized),
            })
          }

          console.log(
            `[Migration v20] Created ${authorMap.size} author profile(s) from ${coursesWithAuthorName.length} courses`
          )
        }

        console.log('[Migration v20] Authors table created with Chase Hughes pre-seeded')
      } catch (error) {
        console.error('[Migration v20] Author migration failed:', error)
        // Graceful degradation: app loads without author features (AC4)
        // Don't rethrow — preserve existing data
      }
    })

  // v21: Career Paths system — curated multi-course learning journeys (E20-S01)
  database.version(21).stores({
    // All 22 existing v20 tables (unchanged — must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    // NEW: Career Paths tables
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
  })

  // v22: Add flashcards table for SM-2 spaced repetition flashcard system (E20-S02)
  database.version(22).stores({
    // All 24 existing v21 tables (unchanged — must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    // NEW: Flashcard system with SM-2 spaced repetition
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
  })

  // v23: Add entitlements table for local subscription cache (E19-S02)
  database.version(23).stores({
    // All 26 existing v22 tables (unchanged — must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    // NEW: Local entitlement cache with 7-day TTL
    entitlements: 'userId',
  })

  // v24: Multi-path learning journeys data model (E26-S01)
  // Creates learningPaths + learningPathEntries tables, migrates existing single-path data,
  // then drops the old learningPath table.
  database
    .version(24)
    .stores({
      // All existing v23 tables (unchanged — must redeclare or Dexie deletes them)
      importedCourses: 'id, name, importedAt, status, *tags',
      importedVideos: 'id, courseId, filename',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      // OLD learningPath table kept during migration (dropped in v25)
      learningPath: 'courseId, position, generatedAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      authors: 'id, name, createdAt',
      careerPaths: 'id',
      pathEnrollments: 'id, pathId, status',
      flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
      entitlements: 'userId',
      // NEW: Multi-path learning journey tables
      learningPaths: 'id, createdAt',
      learningPathEntries: 'id, [pathId+courseId], pathId',
    })
    .upgrade(async tx => {
      try {
        const oldEntries = await tx.table('learningPath').toArray()

        if (oldEntries.length === 0) {
          console.log('[Migration v24] No existing learning path data to migrate')
          return
        }

        const now = new Date().toISOString()
        const defaultPathId = crypto.randomUUID()

        // Create default "My Learning Path" from existing data
        await tx.table('learningPaths').add({
          id: defaultPathId,
          name: 'My Learning Path',
          description: 'Migrated from your original learning path',
          createdAt: now,
          updatedAt: now,
          isAIGenerated: true, // Original was AI-generated
        })

        // Migrate each course entry to the new entries table
        const sorted = oldEntries.sort(
          (a: LearningPathCourse, b: LearningPathCourse) => a.position - b.position
        )
        const newEntries = sorted.map((entry: LearningPathCourse, index: number) => ({
          id: crypto.randomUUID(),
          pathId: defaultPathId,
          courseId: entry.courseId,
          courseType: 'imported' as const,
          position: index + 1,
          justification: entry.justification,
          isManuallyOrdered: entry.isManuallyOrdered,
        }))

        await tx.table('learningPathEntries').bulkAdd(newEntries)

        console.log(
          `[Migration v24] Migrated ${newEntries.length} courses into default "My Learning Path"`
        )
      } catch (error) {
        console.error('[Migration v24] Multi-path migration failed:', error)
        // Graceful degradation: old learningPath table preserved, new tables empty
        // App will function without migration data — user can recreate paths
      }
    })

  // v25: Drop old single-path learningPath table after successful migration (E26-S01)
  database.version(25).stores({
    // All tables from v24 MINUS the old learningPath table (null = delete)
    importedCourses: 'id, name, importedAt, status, *tags',
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: null, // DROP old single-path table
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    entitlements: 'userId',
    learningPaths: 'id, createdAt',
    learningPathEntries: 'id, [pathId+courseId], pathId',
  })

  // v26: YouTube integration schema — new tables, indexes, and source field (E28-S01)
  // - importedCourses: add `source` index for filtering local vs. YouTube courses
  // - importedVideos: add `youtubeVideoId` index for YouTube video lookups
  // - youtubeVideoCache: API response cache with TTL expiry
  // - youtubeTranscripts: per-course transcript storage (compound PK)
  // - youtubeChapters: course-level chapter markers with ordering
  // - upgrade(): backfill existing courses with `source: 'local'`
  database
    .version(26)
    .stores({
      // All existing v25 tables (must redeclare or Dexie deletes them)
      importedCourses: 'id, name, importedAt, status, *tags, source',
      importedVideos: 'id, courseId, filename, youtubeVideoId',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      authors: 'id, name, createdAt',
      careerPaths: 'id',
      pathEnrollments: 'id, pathId, status',
      flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
      entitlements: 'userId',
      learningPaths: 'id, createdAt',
      learningPathEntries: 'id, [pathId+courseId], pathId',
      // NEW: YouTube integration tables
      youtubeVideoCache: 'videoId, expiresAt',
      youtubeTranscripts: '[courseId+videoId], courseId, videoId',
      youtubeChapters: 'id, courseId, order',
    })
    .upgrade(tx => {
      // Backfill existing courses with source: 'local' (no data loss)
      return tx
        .table('importedCourses')
        .toCollection()
        .modify(course => {
          if (course.source === undefined) {
            course.source = 'local'
          }
        })
    })

  // v27: Transcript pipeline — add status index for per-video tracking (E28-S04)
  // - youtubeTranscripts: add `status` index for filtering by fetch state
  // - upgrade(): backfill existing transcript records with status: 'done' and source
  database
    .version(27)
    .stores({
      // All existing v26 tables (must redeclare or Dexie deletes them)
      importedCourses: 'id, name, importedAt, status, *tags, source',
      importedVideos: 'id, courseId, filename, youtubeVideoId',
      importedPdfs: 'id, courseId, filename',
      progress: '[courseId+videoId], courseId, videoId',
      bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
      screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
      studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
      contentProgress: '[courseId+itemId], courseId, itemId, status',
      challenges: 'id, type, deadline, createdAt',
      embeddings: 'noteId, createdAt',
      courseThumbnails: 'courseId',
      aiUsageEvents: 'id, featureType, timestamp, courseId',
      reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
      courseReminders: 'id, courseId',
      courses: 'id, category, difficulty, authorId',
      quizzes: 'id, lessonId, createdAt',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
      videoCaptions: '[courseId+videoId], courseId, videoId',
      authors: 'id, name, createdAt',
      careerPaths: 'id',
      pathEnrollments: 'id, pathId, status',
      flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
      entitlements: 'userId',
      learningPaths: 'id, createdAt',
      learningPathEntries: 'id, [pathId+courseId], pathId',
      youtubeVideoCache: 'videoId, expiresAt',
      youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
      youtubeChapters: 'id, courseId, order',
    })
    .upgrade(tx => {
      // Backfill existing transcript records with new required fields
      return tx
        .table('youtubeTranscripts')
        .toCollection()
        .modify(record => {
          if (record.fullText === undefined) {
            record.fullText = (record.cues || []).map((c: { text: string }) => c.text).join(' ')
          }
          if (record.source === undefined) {
            record.source = 'youtube-transcript'
          }
          if (record.status === undefined) {
            record.status = 'done'
          }
        })
    })
  // v28: Notifications data layer (E43-S06)
  // - New `notifications` table for persistent notification storage
  // - Local-only: added to sync skip-list alongside embeddings, courseThumbnails, youtubeVideoCache
  // - No upgrade callback needed — fresh table with no existing data
  database.version(28).stores({
    // All existing v27 tables (must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags, source',
    importedVideos: 'id, courseId, filename, youtubeVideoId',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    entitlements: 'userId',
    learningPaths: 'id, createdAt',
    learningPathEntries: 'id, [pathId+courseId], pathId',
    youtubeVideoCache: 'videoId, expiresAt',
    youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
    youtubeChapters: 'id, courseId, order',
    // NEW: Notifications table (local-only, sync skip-list)
    notifications: 'id, type, createdAt, readAt, dismissedAt',
  })

  // v29: Notification preferences (per-type toggles + quiet hours)
  // - Single-row config table with fixed PK 'singleton'
  // - No upgrade callback — fresh table with no existing data
  database.version(29).stores({
    // All existing v28 tables (must redeclare or Dexie deletes them)
    importedCourses: 'id, name, importedAt, status, *tags, source',
    importedVideos: 'id, courseId, filename, youtubeVideoId',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    entitlements: 'userId',
    learningPaths: 'id, createdAt',
    learningPathEntries: 'id, [pathId+courseId], pathId',
    youtubeVideoCache: 'videoId, expiresAt',
    youtubeTranscripts: '[courseId+videoId], courseId, videoId, status',
    youtubeChapters: 'id, courseId, order',
    notifications: 'id, type, createdAt, readAt, dismissedAt',
    notificationPreferences: 'id',
  })

  // v30: Drop dead `courses` table — regular course system removed (E89-S01)
  // Setting a table to null tells Dexie to delete it.
  // All other tables survive intact (importedCourses, importedVideos, etc.)
  database.version(30).stores({
    courses: null, // DROP TABLE — dead regular course data
  })

  // v31: FSRS migration — transform SM-2 fields to FSRS fields (E59-S03)
  // Updates indexes: flashcards.nextReviewAt → due, reviewRecords.nextReviewAt/reviewedAt → due/last_review
  // Upgrade callback transforms existing records from SM-2 to FSRS field structure
  database
    .version(31)
    .stores({
      // Only declare tables whose indexes change (Dexie preserves undeclared tables)
      flashcards: 'id, courseId, noteId, due, createdAt',
      reviewRecords: 'id, noteId, due, last_review',
    })
    .upgrade(tx => {
      // --- SM-2 to FSRS field mapping ---
      // easeFactor (2.5 default, 1.3-2.5 range) → difficulty (0-10 scale, inverted)
      // interval (days) → stability (days)
      // reviewCount → reps
      // nextReviewAt (ISO string) → due (ISO string)
      // reviewedAt (ISO string) → last_review (ISO string)
      // New fields: lapses=0, state (derived), elapsed_days (derived), scheduled_days (derived)

      // Capture migration timestamp once for deterministic output
      const migrationNow = new Date()
      const migrationNowIso = migrationNow.toISOString()

      /**
       * Convert SM-2 easeFactor (1.3-2.5, higher=easier) to FSRS difficulty (0-10, higher=harder).
       * SM-2 default easeFactor is 2.5 (easiest) → FSRS difficulty ~0
       * SM-2 minimum easeFactor is 1.3 (hardest) → FSRS difficulty ~10
       */
      function easeFactorToDifficulty(ef: number): number {
        // Clamp to valid SM-2 range
        const clamped = Math.max(1.3, Math.min(2.5, ef || 2.5))
        // Linear map: 2.5 → 0, 1.3 → 10
        const difficulty = ((2.5 - clamped) / (2.5 - 1.3)) * 10
        return Math.round(difficulty * 100) / 100 // 2 decimal places
      }

      /**
       * Derive FSRS card state from SM-2 review count and interval.
       * 0=New, 1=Learning, 2=Review, 3=Relearning
       */
      function deriveCardState(reviewCount: number, interval: number): number {
        if (!reviewCount) return 0 // New
        if (interval < 1) return 1 // Learning (sub-day intervals)
        return 2 // Review (established cards)
      }

      /**
       * Calculate elapsed days between last review and now.
       */
      function calcElapsedDays(reviewedAt: string | undefined): number {
        if (!reviewedAt) return 0
        const lastDate = new Date(reviewedAt)
        if (isNaN(lastDate.getTime())) return 0
        return Math.max(
          0,
          Math.round((migrationNow.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        )
      }

      const flashcardsMigration = tx
        .table('flashcards')
        .toCollection()
        .modify((card: Record<string, unknown>) => {
          const ef = (card.easeFactor as number) || 2.5
          const interval = (card.interval as number) || 0
          const reviewCount = (card.reviewCount as number) || 0
          const nextReviewAt = card.nextReviewAt as string | undefined
          const reviewedAt = card.reviewedAt as string | undefined

          // Map SM-2 → FSRS fields
          card.stability = Math.max(0, interval) // interval in days ≈ stability
          card.difficulty = easeFactorToDifficulty(ef)
          card.reps = reviewCount
          card.lapses = 0 // SM-2 doesn't track lapses
          card.state = deriveCardState(reviewCount, interval)
          card.elapsed_days = calcElapsedDays(reviewedAt)
          card.scheduled_days = Math.max(0, interval)
          card.due = nextReviewAt || card.createdAt || migrationNowIso
          card.last_review = reviewedAt // undefined if never reviewed

          // Remove SM-2 fields
          delete card.easeFactor
          delete card.interval
          delete card.reviewCount
          delete card.nextReviewAt
          delete card.reviewedAt
        })

      const reviewRecordsMigration = tx
        .table('reviewRecords')
        .toCollection()
        .modify((record: Record<string, unknown>) => {
          const ef = (record.easeFactor as number) || 2.5
          const interval = (record.interval as number) || 0
          const reviewCount = (record.reviewCount as number) || 0
          const nextReviewAt = record.nextReviewAt as string | undefined
          const reviewedAt = record.reviewedAt as string | undefined

          // Map SM-2 → FSRS fields
          record.stability = Math.max(0, interval)
          record.difficulty = easeFactorToDifficulty(ef)
          record.reps = reviewCount
          record.lapses = 0
          record.state = deriveCardState(reviewCount, interval)
          record.elapsed_days = calcElapsedDays(reviewedAt)
          record.scheduled_days = Math.max(0, interval)
          record.due = nextReviewAt || migrationNowIso
          record.last_review = reviewedAt

          // Remove SM-2 fields
          delete record.easeFactor
          delete record.interval
          delete record.reviewCount
          delete record.nextReviewAt
          delete record.reviewedAt
        })

      return Promise.all([flashcardsMigration, reviewRecordsMigration])
    })

  // v32: Add knowledgeDecay preference field (E60-S01)
  database
    .version(32)
    .stores({
      notificationPreferences: 'id',
    })
    .upgrade(tx => {
      return tx
        .table('notificationPreferences')
        .toCollection()
        .modify(pref => {
          if (pref.knowledgeDecay === undefined) {
            pref.knowledgeDecay = true
          }
        })
    })
  // v33: Add recommendationMatch preference field (E60-S02)
  database
    .version(33)
    .stores({
      notificationPreferences: 'id',
    })
    .upgrade(tx => {
      return tx
        .table('notificationPreferences')
        .toCollection()
        .modify(pref => {
          if (pref.recommendationMatch === undefined) {
            pref.recommendationMatch = true
          }
        })
    })
  // v34: Add milestoneApproaching preference field (E60-S03)
  database
    .version(34)
    .stores({
      notificationPreferences: 'id',
    })
    .upgrade(tx => {
      return tx
        .table('notificationPreferences')
        .toCollection()
        .modify(pref => {
          if (pref.milestoneApproaching === undefined) {
            pref.milestoneApproaching = true
          }
        })
    })
  // v35: Add courseEmbeddings table for ML quiz generation (E52-S01)
  // Also adds transcriptHash index to quizzes for cache lookup
  database.version(35).stores({
    courseEmbeddings: 'courseId',
    quizzes: 'id, lessonId, createdAt, transcriptHash',
  })

  // v36: Study schedule data model (E50-S01)
  // - New studySchedules table for calendar integration
  // - Indexes on courseId, learningPathId, enabled for filtering
  database.version(36).stores({
    studySchedules: 'id, courseId, learningPathId, enabled',
  })
  // v37: Book library data model (E83-S01)
  // - New books table for epub/pdf/audiobook metadata
  // - New bookHighlights table for user highlights
  // - New bookFiles table for IndexedDB fallback when OPFS unavailable
  database.version(37).stores({
    books: 'id, title, author, format, status, createdAt, lastOpenedAt',
    bookHighlights: 'id, bookId, color, flashcardId, createdAt',
    bookFiles: '[bookId+filename], bookId',
  })
  // v38: Audiobook support (E87-S01)
  // - New audioBookmarks table for bookmarks within audiobook chapters
  // - Indexes on bookId, chapterIndex, timestamp, createdAt
  database.version(38).stores({
    audioBookmarks: 'id, bookId, chapterIndex, timestamp, createdAt',
  })
  // v39: OPDS catalog connections (E88-S01)
  // - New opdsCatalogs table for OPDS feed URLs and auth credentials
  database.version(39).stores({
    opdsCatalogs: 'id, name, url, createdAt',
  })
  // v40: Audiobookshelf server connections (E101-S01)
  // - New audiobookshelfServers table for ABS server URL, API key, and sync status
  database.version(40).stores({
    audiobookshelfServers: 'id, name, url, status, lastSyncedAt',
  })
  // v41: Chapter mapping engine (E103-S01)
  // - New chapterMappings table for EPUB↔audiobook chapter alignment
  database.version(41).stores({
    chapterMappings: '[epubBookId+audioBookId], epubBookId, audioBookId',
  })

  // E109-S01: Vocabulary Builder — word/phrase saving from book reader
  database.version(42).stores({
    vocabularyItems: 'id, bookId, masteryLevel, createdAt',
  })

  // E109-S02: Daily Highlight Review — add lastReviewedAt + reviewRating indexes for spaced review
  database.version(43).stores({
    bookHighlights: 'id, bookId, color, flashcardId, createdAt, lastReviewedAt, reviewRating',
  })

  // E110-S01: Smart Shelves — shelves + bookShelves join table
  database.version(44).stores({
    shelves: 'id, name, isDefault, sortOrder, createdAt',
    bookShelves: 'id, bookId, shelfId, [bookId+shelfId], addedAt',
  })
  // E110-S02: Series Grouping — add `series` index to books for grouping by series name
  database.version(45).stores({
    books: 'id, title, author, format, status, createdAt, lastOpenedAt, series',
  })
  // E110-S03: Reading Queue — ordered list of books to read next
  database.version(46).stores({
    readingQueue: 'id, bookId, sortOrder, addedAt',
  })
  // E111-S01: Audio Clips — clippable audio ranges
  database.version(47).stores({
    audioClips: 'id, bookId, chapterId, createdAt, sortOrder',
  })
  // E113-S01: Book Reviews & Ratings — personal reviews with star ratings
  database.version(48).stores({
    bookReviews: 'id, bookId, createdAt',
  })
  // E57-S03: Chat Conversations — tutor chat persistence
  database.version(49).stores({
    chatConversations: 'id, [courseId+videoId], courseId, updatedAt',
  })
  // E57-S05: Transcript Embeddings — RAG-grounded tutor answers
  database.version(50).stores({
    transcriptEmbeddings: 'id, [courseId+videoId], courseId, createdAt',
  })
  // E72-S01: Learner Models — persistent per-course learner profile
  database.version(51).stores({
    learnerModels: 'id, courseId',
  })

  // v52: Sync Foundation (E92-S02)
  // Adds `userId` and compound `[userId+updatedAt]` indexes to every syncable
  // Dexie table so the sync engine (E92-S05/S06) can run efficient "records
  // modified since last checkpoint" range scans per user. Also creates the
  // `syncQueue` and `syncMetadata` tables used by `syncableWrite()` (E92-S04)
  // and the upload/download engine.
  //
  // Excluded tables (local-only / cache / server-authoritative):
  //   courseThumbnails, videoCaptions, entitlements, youtubeVideoCache,
  //   youtubeTranscripts, youtubeChapters, courseEmbeddings, bookFiles,
  //   transcriptEmbeddings, screenshots
  //
  // Upgrade callback stamps a static `updatedAt = migrationNow` on records
  // that don't already have one. `userId` backfill runs post-open from
  // `src/lib/sync/backfill.ts`, invoked by the auth lifecycle hook in
  // `src/app/hooks/useAuthLifecycle.ts` on SIGNED_IN / INITIAL_SESSION.
  database
    .version(52)
    .stores({
      importedCourses: 'id, name, importedAt, status, *tags, source, userId, [userId+updatedAt]',
      importedVideos: 'id, courseId, filename, youtubeVideoId, userId, [userId+updatedAt]',
      importedPdfs: 'id, courseId, filename, userId, [userId+updatedAt]',
      progress: '[courseId+videoId], courseId, videoId, userId, [userId+updatedAt]',
      bookmarks:
        'id, [courseId+lessonId], courseId, lessonId, createdAt, userId, [userId+updatedAt]',
      notes:
        'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt, userId, [userId+updatedAt]',
      studySessions:
        'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime, userId, [userId+updatedAt]',
      contentProgress: '[courseId+itemId], courseId, itemId, status, userId, [userId+updatedAt]',
      challenges: 'id, type, deadline, createdAt, userId, [userId+updatedAt]',
      embeddings: 'noteId, createdAt, userId, [userId+updatedAt]',
      aiUsageEvents: 'id, featureType, timestamp, courseId, userId, [userId+updatedAt]',
      reviewRecords: 'id, noteId, due, last_review, userId, [userId+updatedAt]',
      courseReminders: 'id, courseId, userId, [userId+updatedAt]',
      quizzes: 'id, lessonId, createdAt, transcriptHash, userId, [userId+updatedAt]',
      quizAttempts: 'id, quizId, [quizId+completedAt], completedAt, userId, [userId+updatedAt]',
      authors: 'id, name, createdAt, userId, [userId+updatedAt]',
      careerPaths: 'id, userId, [userId+updatedAt]',
      pathEnrollments: 'id, pathId, status, userId, [userId+updatedAt]',
      flashcards: 'id, courseId, noteId, due, createdAt, userId, [userId+updatedAt]',
      learningPaths: 'id, createdAt, userId, [userId+updatedAt]',
      learningPathEntries: 'id, [pathId+courseId], pathId, userId, [userId+updatedAt]',
      notifications: 'id, type, createdAt, readAt, dismissedAt, userId, [userId+updatedAt]',
      notificationPreferences: 'id, userId, [userId+updatedAt]',
      studySchedules: 'id, courseId, learningPathId, enabled, userId, [userId+updatedAt]',
      books:
        'id, title, author, format, status, createdAt, lastOpenedAt, series, userId, [userId+updatedAt]',
      bookHighlights:
        'id, bookId, color, flashcardId, createdAt, lastReviewedAt, reviewRating, userId, [userId+updatedAt]',
      audioBookmarks: 'id, bookId, chapterIndex, timestamp, createdAt, userId, [userId+updatedAt]',
      opdsCatalogs: 'id, name, url, createdAt, userId, [userId+updatedAt]',
      audiobookshelfServers: 'id, name, url, status, lastSyncedAt, userId, [userId+updatedAt]',
      chapterMappings:
        '[epubBookId+audioBookId], epubBookId, audioBookId, userId, [userId+updatedAt]',
      vocabularyItems: 'id, bookId, masteryLevel, createdAt, userId, [userId+updatedAt]',
      shelves: 'id, name, isDefault, sortOrder, createdAt, userId, [userId+updatedAt]',
      bookShelves: 'id, bookId, shelfId, [bookId+shelfId], addedAt, userId, [userId+updatedAt]',
      readingQueue: 'id, bookId, sortOrder, addedAt, userId, [userId+updatedAt]',
      audioClips: 'id, bookId, chapterId, createdAt, sortOrder, userId, [userId+updatedAt]',
      bookReviews: 'id, bookId, createdAt, userId, [userId+updatedAt]',
      chatConversations: 'id, [courseId+videoId], courseId, updatedAt, userId, [userId+updatedAt]',
      learnerModels: 'id, courseId, userId, [userId+updatedAt]',
      // Sync infrastructure tables
      syncQueue: '++id, status, [tableName+recordId], createdAt',
      syncMetadata: 'table',
    })
    .upgrade(async tx => {
      const migrationNow = new Date().toISOString()
      // Must stay in sync with SYNCABLE_TABLES in src/lib/sync/backfill.ts.
      // Cannot import that constant here — it creates a circular dep
      // (schema.ts → backfill.ts → @/db → schema.ts). E92-S03's table
      // registry will unify both lists.
      const SYNCABLE_TABLES_V52 = [
        'importedCourses',
        'importedVideos',
        'importedPdfs',
        'progress',
        'bookmarks',
        'notes',
        'studySessions',
        'contentProgress',
        'challenges',
        'embeddings',
        'aiUsageEvents',
        'reviewRecords',
        'courseReminders',
        'quizzes',
        'quizAttempts',
        'authors',
        'careerPaths',
        'pathEnrollments',
        'flashcards',
        'learningPaths',
        'learningPathEntries',
        'notifications',
        'notificationPreferences',
        'studySchedules',
        'books',
        'bookHighlights',
        'audioBookmarks',
        'opdsCatalogs',
        'audiobookshelfServers',
        'chapterMappings',
        'vocabularyItems',
        'shelves',
        'bookShelves',
        'readingQueue',
        'audioClips',
        'bookReviews',
        'chatConversations',
        'learnerModels',
      ] as const

      // Stamp `updatedAt` on records that lack it. `userId` is intentionally NOT
      // set here — it's backfilled post-open by `backfillUserId()` once the
      // Zustand auth store has hydrated (avoids Dexie-open / auth-hydration
      // race). Idempotent: records that already have `updatedAt` are left alone.
      await Promise.all(
        SYNCABLE_TABLES_V52.map(tableName =>
          tx
            .table(tableName)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              if (!record.updatedAt) {
                record.updatedAt = migrationNow
              }
            })
            .catch(err => {
              // Tolerate tables that haven't been used yet (empty / schema-only).
              // Per-table failure does not abort the whole migration — the
              // current policy is "partial-stamp is better than blocking
              // upgrade" — but we log so a genuine IDB error (quota, schema
              // mismatch) is visible in the console rather than silent.
              // TODO(E92-follow-up): narrow this to rethrow anything that
              // isn't "table empty / not found" so hard errors abort the
              // migration cleanly and leave the DB at v51 for safe retry.
              // silent-catch-ok — logged, not silenced; downgraded intentionally.
              console.warn(`[v52 upgrade] skipped updatedAt stamp on table "${tableName}":`, err)
            })
        )
      )
    })

  // v53 (E117-S02): Add `searchFrecency` table for unified-search ranking.
  // Compound PK `[entityType+entityId]` so each entity has exactly one row.
  // Local-only — intentionally NOT added to SYNCABLE_TABLES. No userId field.
  // Upgrade body is empty: the table is new, there is nothing to backfill.
  database
    .version(53)
    .stores({
      searchFrecency: SEARCH_FRECENCY_INDEXES,
    })
    .upgrade(async _tx => {
      // No backfill. Table is new; Dexie creates it on first open at v53.
    })
} // end _declareLegacyMigrations

export { db, CHECKPOINT_VERSION, CHECKPOINT_SCHEMA }
