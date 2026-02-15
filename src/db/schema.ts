import Dexie, { type EntityTable } from 'dexie'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'

const db = new Dexie('ElearningDB') as Dexie & {
  importedCourses: EntityTable<ImportedCourse, 'id'>
  importedVideos: EntityTable<ImportedVideo, 'id'>
  importedPdfs: EntityTable<ImportedPdf, 'id'>
}

db.version(1).stores({
  importedCourses: 'id, name, importedAt, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
})

export { db }
