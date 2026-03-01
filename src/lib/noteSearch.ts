import MiniSearch from 'minisearch'
import type { Note, Course } from '@/data/types'

interface SearchableNote {
  id: string
  content: string
  tags: string
  courseName: string
  videoTitle: string
  courseId: string
  videoId: string
  timestamp?: number
}

const miniSearch = new MiniSearch<SearchableNote>({
  fields: ['content', 'tags', 'courseName', 'videoTitle'],
  storeFields: [
    'id',
    'courseName',
    'videoTitle',
    'tags',
    'courseId',
    'videoId',
    'content',
    'timestamp',
  ],
  searchOptions: {
    boost: { tags: 2, courseName: 1.5 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'OR',
  },
})

let initialized = false

// Lookup maps for enriching notes with course/video names
let courseNameMap = new Map<string, string>()
let lessonTitleMap = new Map<string, string>()

/**
 * Build lookup maps from static course data.
 * Maps courseId → shortTitle and lessonId → lesson.title.
 */
export function buildCourseLookup(courses: Course[]): void {
  courseNameMap = new Map()
  lessonTitleMap = new Map()
  for (const course of courses) {
    courseNameMap.set(course.id, course.shortTitle || course.title)
    for (const mod of course.modules) {
      for (const lesson of mod.lessons) {
        lessonTitleMap.set(lesson.id, lesson.title)
      }
    }
  }
}

function toSearchableNote(note: Note): SearchableNote {
  return {
    id: note.id,
    content: note.content,
    tags: note.tags.join(' | '),
    courseName: courseNameMap.get(note.courseId) ?? '',
    videoTitle: lessonTitleMap.get(note.videoId) ?? '',
    courseId: note.courseId,
    videoId: note.videoId,
    timestamp: note.timestamp,
  }
}

/**
 * Initialize the search index from all notes in Dexie.
 * Call once on app startup after migration.
 */
export function initializeSearchIndex(notes: Note[]): void {
  if (initialized) {
    miniSearch.removeAll()
  }

  miniSearch.addAll(notes.map(toSearchableNote))
  initialized = true
}

/**
 * Add a single note to the index (after create).
 */
export function addToIndex(note: Note): void {
  if (!initialized) return
  miniSearch.add(toSearchableNote(note))
}

/**
 * Update a note in the index (after edit).
 */
export function updateInIndex(note: Note): void {
  if (!initialized) return
  try {
    miniSearch.discard(note.id)
  } catch (e) {
    // MiniSearch throws when ID not in index — expected during first add
    if (!(e instanceof Error && e.message.includes('not in the index'))) {
      console.error('Unexpected error updating search index:', e)
    }
  }
  miniSearch.add(toSearchableNote(note))
}

/**
 * Remove a note from the index (after delete).
 */
export function removeFromIndex(noteId: string): void {
  if (!initialized) return
  try {
    miniSearch.discard(noteId)
  } catch {
    // Note might not be in the index
  }
}

export interface SearchResult {
  id: string
  score: number
}

/**
 * Search notes by query string.
 * Returns matching note IDs with relevance scores.
 */
export function searchNotes(query: string): SearchResult[] {
  if (!initialized || !query.trim()) return []

  return miniSearch.search(query).map(result => ({
    id: result.id as string,
    score: result.score,
  }))
}

export interface NoteSearchResult {
  id: string
  score: number
  content: string
  courseName: string
  videoTitle: string
  courseId: string
  videoId: string
  tags: string[]
  timestamp?: number
}

/**
 * Search notes with enriched context for rendering in the command palette.
 * Returns results with stored fields for rendering and navigation.
 */
export function searchNotesWithContext(query: string): NoteSearchResult[] {
  if (!initialized || !query.trim()) return []

  return miniSearch
    .search(query)
    .slice(0, 20)
    .map(result => ({
      id: result.id as string,
      score: result.score,
      content: (result.content as string) ?? '',
      courseName: (result.courseName as string) ?? '',
      videoTitle: (result.videoTitle as string) ?? '',
      courseId: (result.courseId as string) ?? '',
      videoId: (result.videoId as string) ?? '',
      tags: ((result.tags as string) ?? '').split(' | ').filter(Boolean),
      timestamp: result.timestamp as number | undefined,
    }))
}
