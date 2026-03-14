import { Course, Note } from '@/data/types'
import { db } from '@/db'
import { logStudyAction, getStudyLog } from './studyLog'
import { addToIndex, updateInIndex, removeFromIndex } from '@/lib/noteSearch'
import { triggerNoteLinkSuggestions } from '@/ai/knowledgeGaps/noteLinkSuggestions'

const STORAGE_KEY = 'course-progress'
const MINUTES_PER_LESSON = 15
const MIGRATION_VERSION_KEY = 'notes-migration-version'
const CURRENT_MIGRATION_VERSION = 1

// Module-level cache: avoids repeated localStorage.getItem + JSON.parse per render cycle
let _progressCache: Record<string, CourseProgress> | null = null

export interface CourseProgress {
  courseId: string
  completedLessons: string[]
  lastWatchedLesson?: string
  lastVideoPosition?: number
  lastPdfPages?: Record<string, number>
  notes: Record<string, Note[]>
  startedAt: string
  lastAccessedAt: string
}

/**
 * Legacy format for backward compatibility
 */
interface LegacyCourseProgress {
  courseId: string
  completedLessons: string[]
  lastWatchedLesson?: string
  lastVideoPosition?: number
  notes: Record<string, string>
  startedAt: string
  lastAccessedAt: string
}

/**
 * Migrate legacy string notes to new Note[] format
 */
function migrateNotesFormat(
  legacyProgress: Record<string, LegacyCourseProgress>
): Record<string, CourseProgress> {
  const migrated: Record<string, CourseProgress> = {}

  for (const [courseId, progress] of Object.entries(legacyProgress)) {
    const migratedNotes: Record<string, Note[]> = {}

    // Convert each string note to a Note object
    for (const [lessonId, noteText] of Object.entries(progress.notes || {})) {
      if (typeof noteText === 'string' && noteText.trim() !== '') {
        // Extract tags from legacy content
        const tags = extractTagsFromContent(noteText)

        migratedNotes[lessonId] = [
          {
            id: crypto.randomUUID(),
            courseId,
            videoId: lessonId,
            content: noteText,
            createdAt: progress.startedAt || new Date().toISOString(),
            updatedAt: progress.lastAccessedAt || new Date().toISOString(),
            tags,
          },
        ]
      } else if (Array.isArray(noteText)) {
        // Already migrated — ensure courseId/videoId are set
        migratedNotes[lessonId] = (noteText as Note[]).map(n => ({
          ...n,
          courseId: n.courseId || courseId,
          videoId: n.videoId || lessonId,
        }))
      }
    }

    migrated[courseId] = {
      ...progress,
      notes: migratedNotes,
    }
  }

  return migrated
}

/**
 * Extract hashtags from content for migration
 */
function extractTagsFromContent(content: string): string[] {
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9-]*)/g
  const tags = new Set<string>()
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase())
  }

  return Array.from(tags)
}

export function getAllProgress(): Record<string, CourseProgress> {
  if (_progressCache) return { ..._progressCache }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const data = JSON.parse(raw)

    // Check if migration is needed
    const migrationVersion = localStorage.getItem(MIGRATION_VERSION_KEY)
    if (!migrationVersion || parseInt(migrationVersion) < CURRENT_MIGRATION_VERSION) {
      console.log('[Progress] Migrating notes to new format...')
      const migrated = migrateNotesFormat(data)
      saveAllProgress(migrated)
      localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString())
      console.log('[Progress] Migration complete!')
      return migrated
    }

    _progressCache = data
    return { ..._progressCache }
  } catch (error) {
    console.error('[Progress] Error loading progress:', error)
    return {}
  }
}

export function invalidateProgressCache() {
  _progressCache = null
}

/** Custom event name dispatched after progress is saved (same-tab). */
export const PROGRESS_UPDATED_EVENT = 'course-progress-updated'

function saveAllProgress(data: Record<string, CourseProgress>) {
  _progressCache = null
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT))
}

function ensureProgress(courseId: string): CourseProgress {
  const all = getAllProgress()
  if (!all[courseId]) {
    all[courseId] = {
      courseId,
      completedLessons: [],
      notes: {},
      startedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    }
    saveAllProgress(all)
  }
  return all[courseId]
}

export function getProgress(courseId: string): CourseProgress {
  return ensureProgress(courseId)
}

export function markLessonComplete(courseId: string, lessonId: string) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId)
  }
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
  logStudyAction({
    type: 'lesson_complete',
    courseId,
    lessonId,
    timestamp: new Date().toISOString(),
  })
}

export function markLessonIncomplete(courseId: string, lessonId: string) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  progress.completedLessons = progress.completedLessons.filter(id => id !== lessonId)
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
}

export function saveVideoPosition(courseId: string, lessonId: string, seconds: number) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  progress.lastWatchedLesson = lessonId
  progress.lastVideoPosition = seconds
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
  logStudyAction({
    type: 'video_progress',
    courseId,
    lessonId,
    timestamp: new Date().toISOString(),
    metadata: { seconds },
  })
}

export function savePdfPage(courseId: string, resourceId: string, page: number) {
  const all = getAllProgress()
  const progress = ensureProgress(courseId)
  if (!progress.lastPdfPages) {
    progress.lastPdfPages = {}
  }
  progress.lastPdfPages[resourceId] = page
  progress.lastAccessedAt = new Date().toISOString()
  all[courseId] = progress
  saveAllProgress(all)
  logStudyAction({
    type: 'pdf_progress',
    courseId,
    lessonId: resourceId,
    timestamp: new Date().toISOString(),
    metadata: { page },
  })
}

export function getPdfPage(courseId: string, resourceId: string): number | undefined {
  const progress = getProgress(courseId)
  return progress.lastPdfPages?.[resourceId]
}

/**
 * Normalize tags at the store boundary: trim, lowercase, deduplicate, sort.
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean))
  return Array.from(normalized).sort()
}

/**
 * Get all unique tags across all notes (for autocomplete).
 */
export async function getAllNoteTags(): Promise<string[]> {
  try {
    const tags = await db.notes.orderBy('tags').uniqueKeys()
    return (tags as string[]).sort()
  } catch (error) {
    console.error('[Progress] Failed to get all note tags:', error)
    return []
  }
}

/**
 * Save or update a note for a lesson (persists to IndexedDB via Dexie)
 */
export async function saveNote(
  courseId: string,
  lessonId: string,
  content: string,
  tags: string[] = [],
  videoTimestamp?: number
): Promise<void> {
  const normalizedTags = normalizeTags(tags)

  try {
    const existing = await db.notes.where({ courseId, videoId: lessonId }).first()

    if (existing) {
      const updated = {
        ...existing,
        content,
        tags: normalizedTags,
        updatedAt: new Date().toISOString(),
        ...(videoTimestamp !== undefined ? { timestamp: videoTimestamp } : {}),
      }
      await db.notes.update(existing.id, updated)
      updateInIndex(updated)
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        courseId,
        videoId: lessonId,
        content,
        timestamp: videoTimestamp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: normalizedTags,
      }
      await db.notes.add(newNote)
      addToIndex(newNote)
    }

    logStudyAction({ type: 'note_saved', courseId, lessonId, timestamp: new Date().toISOString() })

    // Trigger cross-course note link suggestions (AC4–AC6)
    const savedNote = existing
      ? { ...existing, content, tags: normalizedTags, updatedAt: new Date().toISOString() }
      : await db.notes.where({ courseId, videoId: lessonId }).first()
    if (savedNote) {
      const allNotes = await db.notes.toArray()
      triggerNoteLinkSuggestions(savedNote, allNotes)
    }
  } catch (error) {
    console.error('[Progress] Failed to save note to Dexie:', error)
  }
}

/**
 * Get all notes for a lesson (reads from IndexedDB)
 */
export async function getNotes(courseId: string, lessonId: string): Promise<Note[]> {
  try {
    return await db.notes.where({ courseId, videoId: lessonId }).toArray()
  } catch (error) {
    console.error('[Progress] Failed to load notes from Dexie:', error)
    return []
  }
}

/**
 * Get the latest note content as a string (for backward compatibility)
 */
export async function getNote(courseId: string, lessonId: string): Promise<string> {
  const notes = await getNotes(courseId, lessonId)
  if (notes.length === 0) return ''
  return notes[notes.length - 1].content
}

/**
 * Add a new note to a lesson (for multiple notes per lesson)
 */
export async function addNote(
  courseId: string,
  lessonId: string,
  content: string,
  tags: string[] = [],
  videoTimestamp?: number
): Promise<string> {
  const normalizedTags = normalizeTags(tags)
  const newNote: Note = {
    id: crypto.randomUUID(),
    courseId,
    videoId: lessonId,
    content,
    timestamp: videoTimestamp,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: normalizedTags,
  }

  try {
    await db.notes.add(newNote)
    addToIndex(newNote)
    logStudyAction({ type: 'note_saved', courseId, lessonId, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[Progress] Failed to add note to Dexie:', error)
  }

  return newNote.id
}

/**
 * Delete a specific note by ID
 */
export async function deleteNote(
  _courseId: string,
  _lessonId: string,
  noteId: string
): Promise<void> {
  try {
    await db.notes.delete(noteId)
    removeFromIndex(noteId)
  } catch (error) {
    console.error('[Progress] Failed to delete note from Dexie:', error)
  }
}

export function getCourseCompletionPercent(courseId: string, totalLessons: number): number {
  if (totalLessons === 0) return 0
  const progress = getProgress(courseId)
  return Math.round((progress.completedLessons.length / totalLessons) * 100)
}

export function isLessonComplete(courseId: string, lessonId: string): boolean {
  const progress = getProgress(courseId)
  return progress.completedLessons.includes(lessonId)
}

export function getCoursesInProgress(
  courses: Course[],
  allProgress?: Record<string, CourseProgress>
): (Course & { progress: CourseProgress; completionPercent: number })[] {
  const all = allProgress ?? getAllProgress()
  return courses
    .filter(c => {
      const p = all[c.id]
      if (!p) return false
      const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      const pct = total > 0 ? (p.completedLessons.length / total) * 100 : 0
      return pct > 0 && pct < 100
    })
    .map(c => {
      const p = all[c.id]!
      const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
      return {
        ...c,
        progress: p,
        completionPercent: Math.round((p.completedLessons.length / total) * 100),
      }
    })
    .sort(
      (a, b) =>
        new Date(b.progress.lastAccessedAt).getTime() -
        new Date(a.progress.lastAccessedAt).getTime()
    )
}

export function getCompletedCourses(
  courses: Course[],
  allProgress?: Record<string, CourseProgress>
): Course[] {
  const all = allProgress ?? getAllProgress()
  return courses.filter(c => {
    const p = all[c.id]
    if (!p) return false
    const total = c.modules.reduce((sum, m) => sum + m.lessons.length, 0)
    return total > 0 && p.completedLessons.length >= total
  })
}

export function getNotStartedCourses(
  courses: Course[],
  allProgress?: Record<string, CourseProgress>
): Course[] {
  const all = allProgress ?? getAllProgress()
  return courses.filter(c => {
    const p = all[c.id]
    return !p || p.completedLessons.length === 0
  })
}

export function getTotalCompletedLessons(allProgress?: Record<string, CourseProgress>): number {
  const all = allProgress ?? getAllProgress()
  return Object.values(all).reduce((sum, p) => sum + p.completedLessons.length, 0)
}

export async function getTotalStudyNotes(): Promise<number> {
  try {
    return await db.notes.count()
  } catch (error) {
    console.error('[Progress] Failed to count notes from Dexie:', error)
    return 0
  }
}

export function getRecentActivity(
  courses: Course[],
  limit = 5
): (Course & { progress: CourseProgress })[] {
  const all = getAllProgress()
  return courses
    .filter(c => all[c.id])
    .map(c => ({ ...c, progress: all[c.id]! }))
    .sort(
      (a, b) =>
        new Date(b.progress.lastAccessedAt).getTime() -
        new Date(a.progress.lastAccessedAt).getTime()
    )
    .slice(0, limit)
}

export function getLast7DaysLessonCompletions(): number[] {
  const logs = getStudyLog()
  const last7Days = Array(7).fill(0)
  const now = new Date()

  logs.forEach(log => {
    if (log.type === 'lesson_complete') {
      const logDate = new Date(log.timestamp)
      const daysAgo = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysAgo >= 0 && daysAgo < 7) {
        last7Days[6 - daysAgo]++
      }
    }
  })

  return last7Days
}

export function getWeeklyChange(metric: 'lessons' | 'courses' | 'notes'): number {
  const logs = getStudyLog()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  let thisWeek = 0
  let lastWeek = 0

  logs.forEach(log => {
    const logDate = new Date(log.timestamp)
    const matchesMetric =
      (metric === 'lessons' && log.type === 'lesson_complete') ||
      (metric === 'notes' && log.type === 'note_saved')

    if (!matchesMetric) return

    if (logDate >= weekAgo) {
      thisWeek++
    } else if (logDate >= twoWeeksAgo) {
      lastWeek++
    }
  })

  return thisWeek - lastWeek
}

export function getAverageProgressPercent(courses: Course[]): number {
  const inProgress = getCoursesInProgress(courses)
  if (inProgress.length === 0) return 0

  const totalPercent = inProgress.reduce((sum, course) => sum + course.completionPercent, 0)
  return Math.round(totalPercent / inProgress.length)
}

export function getTotalEstimatedStudyHours(): number {
  const totalLessons = getTotalCompletedLessons()
  return Math.round(((totalLessons * MINUTES_PER_LESSON) / 60) * 10) / 10 // Round to 1 decimal
}

export function getTimeRemaining(courseId: string, course: Course): number {
  const progress = getProgress(courseId)
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const remainingLessons = totalLessons - progress.completedLessons.length
  return Math.round(((remainingLessons * MINUTES_PER_LESSON) / 60) * 10) / 10 // Round to 1 decimal
}
