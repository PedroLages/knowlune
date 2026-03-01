import Dexie, { type EntityTable } from 'dexie'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  VideoBookmark,
  Note,
  Screenshot,
} from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  importedCourses: EntityTable<ImportedCourse, 'id'>
  importedVideos: EntityTable<ImportedVideo, 'id'>
  importedPdfs: EntityTable<ImportedPdf, 'id'>
  progress: EntityTable<VideoProgress, 'courseId'>
  bookmarks: EntityTable<VideoBookmark, 'id'>
  notes: EntityTable<Note, 'id'>
  screenshots: EntityTable<Screenshot, 'id'>
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

      const allProgress: Record<
        string,
        {
          courseId: string
          notes: Record<
            string,
            Array<{
              id: string
              content: string
              timestamp?: number
              createdAt: string
              updatedAt: string
              tags: string[]
            }>
          >
        }
      > = JSON.parse(raw)

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

export { db }
