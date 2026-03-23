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
  CourseThumbnail,
  AIUsageEvent,
  ReviewRecord,
  CourseReminder,
  Course,
  VideoCaptionRecord,
} from '@/data/types'
import type { Quiz, QuizAttempt } from '@/types/quiz'

const db = new Dexie('ElearningDB') as Dexie & {
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
  learningPath: EntityTable<LearningPathCourse, 'courseId'>
  courseThumbnails: EntityTable<CourseThumbnail, 'courseId'>
  aiUsageEvents: EntityTable<AIUsageEvent, 'id'>
  reviewRecords: EntityTable<ReviewRecord, 'id'>
  courseReminders: EntityTable<CourseReminder, 'id'>
  courses: EntityTable<Course, 'id'>
  quizzes: EntityTable<Quiz, 'id'>
  quizAttempts: EntityTable<QuizAttempt, 'id'>
  videoCaptions: Table<VideoCaptionRecord> // compound PK: [courseId+videoId]
}

db.version(1).stores({
  importedCourses: 'id, name, importedAt, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
})

db.version(2)
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

db.version(3).stores({
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

db.version(4)
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

db.version(5).stores({
  importedCourses: 'id, name, importedAt, status, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
})

db.version(6).stores({
  importedCourses: 'id, name, importedAt, status, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
})

db.version(7).stores({
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

db.version(8).stores({
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

db.version(9).stores({
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

db.version(10).stores({
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

db.version(11).stores({
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

db.version(12).stores({
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

db.version(13).stores({
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
db.version(14).stores({
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
db.version(15).stores({
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
db.version(16).stores({
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
db.version(17).stores({
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
db.version(18).stores({
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
db.version(19)
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

export { db }
