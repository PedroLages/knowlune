/**
 * Data export service for LevelUp learning platform.
 *
 * Exports all IndexedDB + localStorage data in multiple formats:
 * - JSON (full data with schema version)
 * - CSV (sessions, progress, streaks as separate files in zip)
 * - Markdown (notes with YAML frontmatter in zip)
 *
 * Non-serializable fields (FileSystemHandles, Blobs) are excluded.
 */
import { db } from '@/db/schema'
import type {
  ImportedCourse,
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  VideoBookmark,
  Note,
  StudySession,
  ContentProgress,
  Challenge,
  ReviewRecord,
  LearningPathCourse,
  AIUsageEvent,
} from '@/data/types'
import { sessionsToCSV, progressToCSV, deriveStreakDays, streakDaysToCSV } from './csvSerializer'

// --- Export Schema ---

export const CURRENT_SCHEMA_VERSION = 14

export interface LevelUpExport {
  schemaVersion: number
  exportedAt: string
  data: {
    settings: Record<string, unknown>
    importedCourses: Omit<ImportedCourse, 'directoryHandle'>[]
    importedVideos: Omit<ImportedVideo, 'fileHandle'>[]
    importedPdfs: Omit<ImportedPdf, 'fileHandle'>[]
    progress: VideoProgress[]
    bookmarks: VideoBookmark[]
    notes: Note[]
    studySessions: StudySession[]
    contentProgress: ContentProgress[]
    challenges: Challenge[]
    reviewRecords: ReviewRecord[]
    learningPath: LearningPathCourse[]
    aiUsageEvents: AIUsageEvent[]
  }
}

// --- Progress Callback ---

export type ExportProgressCallback = (percent: number, phase: string) => void

/** Yield to the UI thread between heavy operations */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

// --- JSON Export (AC1) ---

function getLocalStorageData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key)!)
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }
  return data
}

function stripDirectoryHandle(
  course: ImportedCourse
): Omit<ImportedCourse, 'directoryHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { directoryHandle, ...rest } = course
  return rest
}

function stripFileHandleVideo(
  video: ImportedVideo
): Omit<ImportedVideo, 'fileHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fileHandle, ...rest } = video
  return rest
}

function stripFileHandlePdf(
  pdf: ImportedPdf
): Omit<ImportedPdf, 'fileHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fileHandle, ...rest } = pdf
  return rest
}

export async function exportAllAsJson(
  onProgress?: ExportProgressCallback
): Promise<LevelUpExport> {
  const tables = [
    'importedCourses',
    'importedVideos',
    'importedPdfs',
    'progress',
    'bookmarks',
    'notes',
    'studySessions',
    'contentProgress',
    'challenges',
    'reviewRecords',
    'learningPath',
    'aiUsageEvents',
  ] as const
  const totalSteps = tables.length + 1 // +1 for localStorage

  // Step 1: localStorage
  onProgress?.(0, 'Exporting settings...')
  const settings = getLocalStorageData()
  await yieldToUI()

  // Steps 2+: IndexedDB tables
  const tableData: Record<string, unknown[]> = {}
  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i]
    const percent = Math.round(((i + 1) / totalSteps) * 100)
    onProgress?.(percent, `Exporting ${tableName} (${i + 1}/${tables.length})...`)

    tableData[tableName] = await db.table(tableName).toArray()
    await yieldToUI()
  }

  onProgress?.(100, 'Complete')

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings,
      importedCourses: (tableData.importedCourses as ImportedCourse[]).map(stripDirectoryHandle),
      importedVideos: (tableData.importedVideos as ImportedVideo[]).map(stripFileHandleVideo),
      importedPdfs: (tableData.importedPdfs as ImportedPdf[]).map(stripFileHandlePdf),
      progress: tableData.progress as VideoProgress[],
      bookmarks: tableData.bookmarks as VideoBookmark[],
      notes: tableData.notes as Note[],
      studySessions: tableData.studySessions as StudySession[],
      contentProgress: tableData.contentProgress as ContentProgress[],
      challenges: tableData.challenges as Challenge[],
      reviewRecords: tableData.reviewRecords as ReviewRecord[],
      learningPath: tableData.learningPath as LearningPathCourse[],
      aiUsageEvents: tableData.aiUsageEvents as AIUsageEvent[],
    },
  }
}

// --- CSV Export (AC2) ---

export interface CsvExportFiles {
  sessions: string
  progress: string
  streaks: string
}

export async function exportAllAsCsv(
  onProgress?: ExportProgressCallback
): Promise<CsvExportFiles> {
  onProgress?.(0, 'Loading sessions...')
  const sessions = await db.studySessions.toArray()
  await yieldToUI()

  onProgress?.(33, 'Loading progress...')
  const contentProgress = await db.contentProgress.toArray()
  await yieldToUI()

  onProgress?.(50, 'Generating CSV files...')
  const sessionsCsv = sessionsToCSV(sessions)
  const progressCsv = progressToCSV(contentProgress)
  await yieldToUI()

  onProgress?.(75, 'Calculating streaks...')
  const streakDays = deriveStreakDays(sessions)
  const streaksCsv = streakDaysToCSV(streakDays)
  await yieldToUI()

  onProgress?.(100, 'Complete')

  return {
    sessions: sessionsCsv,
    progress: progressCsv,
    streaks: streaksCsv,
  }
}
