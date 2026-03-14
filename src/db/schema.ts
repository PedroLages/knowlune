import Dexie, { type EntityTable, type Table } from 'dexie'
import { z } from 'zod'
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
} from '@/data/types'

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

// Zod schema for migration data validation (prevents corrupt data crashes)
const MigrationNoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  timestamp: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
})

const MigrationProgressSchema = z.record(
  z.object({
    courseId: z.string(),
    notes: z.record(z.array(MigrationNoteSchema)).optional(),
  })
)

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

      // Security: Validate structure with Zod schema
      const validationResult = MigrationProgressSchema.safeParse(parsedData)
      if (!validationResult.success) {
        console.error(
          '[Migration] Invalid data structure, skipping migration:',
          validationResult.error
        )
        return
      }

      const allProgress = validationResult.data

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

export { db }
