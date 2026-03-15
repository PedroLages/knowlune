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
import { sanitizeFilename, extractTextFromHtml, htmlToMarkdown } from './noteExport'

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

/** Yield to the UI thread between heavy operations (works in background tabs) */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// --- JSON Export (AC1) ---

/** Allowlist of localStorage keys safe to export (no auth tokens, API keys, etc.) */
const EXPORTABLE_LS_PREFIXES = [
  'app-settings',
  'streak-',
  'eduvi-sidebar',
  'levelup-',
  'theme',
  'study-',
  'onboarding',
]

function getLocalStorageData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && EXPORTABLE_LS_PREFIXES.some(prefix => key.startsWith(prefix))) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key)!)
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }
  return data
}

function stripDirectoryHandle(course: ImportedCourse): Omit<ImportedCourse, 'directoryHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { directoryHandle, ...rest } = course
  return rest
}

function stripFileHandleVideo(video: ImportedVideo): Omit<ImportedVideo, 'fileHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fileHandle, ...rest } = video
  return rest
}

function stripFileHandlePdf(pdf: ImportedPdf): Omit<ImportedPdf, 'fileHandle'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fileHandle, ...rest } = pdf
  return rest
}

export async function exportAllAsJson(onProgress?: ExportProgressCallback): Promise<LevelUpExport> {
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

export async function exportAllAsCsv(onProgress?: ExportProgressCallback): Promise<CsvExportFiles> {
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

// --- Markdown Notes Export (AC3) ---

export interface MarkdownNoteFile {
  name: string
  content: string
}

function generateBulkFrontmatter(note: Note, courseName: string, lastReviewedAt?: string): string {
  const plainText = extractTextFromHtml(note.content)
  const firstLine = plainText.split('\n')[0]?.trim() || 'Untitled Note'
  const title = firstLine.slice(0, 100)

  const lines = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `course: "${courseName.replace(/"/g, '\\"')}"`,
    `topic: "${(note.tags[0] || '').replace(/"/g, '\\"')}"`,
    `tags: [${note.tags.map(tag => `"${tag}"`).join(', ')}]`,
    `created: "${note.createdAt}"`,
    `updated: "${note.updatedAt}"`,
  ]

  if (lastReviewedAt) {
    lines.push(`lastReviewedAt: "${lastReviewedAt}"`)
  }

  lines.push('---', '')
  return lines.join('\n')
}

export async function exportNotesAsMarkdown(
  onProgress?: ExportProgressCallback
): Promise<MarkdownNoteFile[]> {
  onProgress?.(0, 'Loading notes...')
  const notes = await db.notes.toArray()
  // Filter out soft-deleted notes
  const activeNotes = notes.filter(n => !n.deleted)
  await yieldToUI()

  onProgress?.(25, 'Loading course names...')
  const courses = await db.importedCourses.toArray()
  const courseMap = new Map(courses.map(c => [c.id, c.name]))
  await yieldToUI()

  onProgress?.(40, 'Loading review records...')
  const reviewRecords = await db.reviewRecords.toArray()
  // Build map: noteId → most recent reviewedAt
  const lastReviewMap = new Map<string, string>()
  for (const record of reviewRecords) {
    const existing = lastReviewMap.get(record.noteId)
    if (!existing || record.reviewedAt > existing) {
      lastReviewMap.set(record.noteId, record.reviewedAt)
    }
  }
  await yieldToUI()

  onProgress?.(50, 'Converting notes to Markdown...')
  const files: MarkdownNoteFile[] = []
  const usedFilenames = new Set<string>()

  for (let i = 0; i < activeNotes.length; i++) {
    const note = activeNotes[i]
    const courseName = courseMap.get(note.courseId) || 'Unknown Course'
    const lastReviewedAt = lastReviewMap.get(note.id)

    const frontmatter = generateBulkFrontmatter(note, courseName, lastReviewedAt)
    const markdown = htmlToMarkdown(note.content)
    const fullContent = frontmatter + markdown

    // Generate unique filename
    const plainText = extractTextFromHtml(note.content)
    const firstLine = plainText.split('\n')[0]?.trim() || 'note'
    let baseName = sanitizeFilename(firstLine.slice(0, 50))
    if (!baseName) baseName = `note-${note.id.slice(0, 8)}`

    let filename = `${baseName}.md`
    let counter = 1
    while (usedFilenames.has(filename)) {
      filename = `${baseName}-${counter}.md`
      counter++
    }
    usedFilenames.add(filename)

    files.push({ name: filename, content: fullContent })

    // Yield every 20 notes
    if (i % 20 === 0) {
      const percent = 50 + Math.round((i / activeNotes.length) * 50)
      onProgress?.(percent, `Converting note ${i + 1}/${activeNotes.length}...`)
      await yieldToUI()
    }
  }

  onProgress?.(100, 'Complete')
  return files
}
