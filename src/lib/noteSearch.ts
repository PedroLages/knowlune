import MiniSearch from 'minisearch'
import type { Note } from '@/data/types'

interface SearchableNote {
  id: string
  content: string
  tags: string
}

const miniSearch = new MiniSearch<SearchableNote>({
  fields: ['content', 'tags'],
  storeFields: ['id'],
  searchOptions: {
    boost: { tags: 2 },
    prefix: true,
    fuzzy: 0.2,
  },
})

let initialized = false

/**
 * Initialize the search index from all notes in Dexie.
 * Call once on app startup after migration.
 */
export function initializeSearchIndex(notes: Note[]): void {
  if (initialized) {
    miniSearch.removeAll()
  }

  const docs = notes.map(note => ({
    id: note.id,
    content: note.content,
    tags: note.tags.join(' '),
  }))

  miniSearch.addAll(docs)
  initialized = true
}

/**
 * Add a single note to the index (after create).
 */
export function addToIndex(note: Note): void {
  if (!initialized) return
  miniSearch.add({
    id: note.id,
    content: note.content,
    tags: note.tags.join(' '),
  })
}

/**
 * Update a note in the index (after edit).
 */
export function updateInIndex(note: Note): void {
  if (!initialized) return
  try {
    miniSearch.discard(note.id)
  } catch {
    // Note might not be in the index yet
  }
  miniSearch.add({
    id: note.id,
    content: note.content,
    tags: note.tags.join(' '),
  })
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
