import Dexie, { type EntityTable, type Table } from 'dexie'
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
  Course,
  VideoCaptionRecord,
  Flashcard,
  ImportedAuthor,
  CareerPath,
  PathEnrollment,
  CachedEntitlement,
  YouTubeVideoCache,
  YouTubeTranscriptRecord,
  YouTubeCourseChapter,
} from '@/data/types'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { CHECKPOINT_VERSION, CHECKPOINT_SCHEMA } from './checkpoint'

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
  courses: EntityTable<Course, 'id'>
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
} // end _declareLegacyMigrations

export { db, CHECKPOINT_VERSION, CHECKPOINT_SCHEMA }
