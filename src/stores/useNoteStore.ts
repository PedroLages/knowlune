import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Note } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { addToIndex, updateInIndex, removeFromIndex } from '@/lib/noteSearch'
import { embeddingPipeline } from '@/ai/embeddingPipeline'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import {
  findNoteLinkSuggestions,
  dismissNoteLinkPair,
} from '@/ai/knowledgeGaps/noteLinkSuggestions'
import type { NoteLinkSuggestion } from '@/ai/knowledgeGaps/types'

interface NoteState {
  notes: Note[]
  isLoading: boolean
  error: string | null

  loadNotes: () => Promise<void>
  loadNotesByLesson: (courseId: string, videoId: string) => Promise<void>
  loadNotesByCourse: (courseId: string) => Promise<void>
  saveNote: (note: Note) => Promise<void>
  addNote: (note: Note) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
  softDelete: (noteId: string) => void
  restoreNote: (noteId: string) => void
  getNoteForLesson: (courseId: string, videoId: string) => Note | undefined
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  isLoading: false,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const notes = await db.notes.toArray()
      set({ notes, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load notes from database' })
      console.error('[NoteStore] Failed to load notes:', error)
    }
  },

  loadNotesByLesson: async (courseId: string, videoId: string) => {
    set({ isLoading: true, error: null })
    try {
      const notes = await db.notes.where({ courseId, videoId }).toArray()
      set({ notes, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load lesson notes' })
      console.error('[NoteStore] Failed to load lesson notes:', error)
    }
  },

  loadNotesByCourse: async (courseId: string) => {
    set({ isLoading: true, error: null })
    try {
      const notes = await db.notes.where({ courseId }).toArray()
      set({ notes, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load course notes' })
      console.error('[NoteStore] Failed to load course notes:', error)
    }
  },

  saveNote: async (note: Note) => {
    const { notes } = get()
    const existingIndex = notes.findIndex(n => n.id === note.id)
    const oldNotes = [...notes]

    // Optimistic update
    if (existingIndex >= 0) {
      set({
        notes: notes.map(n => (n.id === note.id ? note : n)),
        error: null,
      })
    } else {
      set({ notes: [...notes, note], error: null })
    }

    try {
      await persistWithRetry(async () => {
        await db.notes.put(note)
      })
      if (existingIndex >= 0) {
        updateInIndex(note)
      } else {
        addToIndex(note)
      }
      if (supportsWorkers()) {
        embeddingPipeline
          .indexNote(note)
          .catch(err => console.error('[NoteStore] Embedding failed:', err))
      }
      // Suggest cross-course note links after successful save (AC4–AC6)
      triggerNoteLinkSuggestions(note, get().notes)
    } catch (error) {
      // Rollback on failure
      set({ notes: oldNotes, error: 'Failed to save note' })
      console.error('[NoteStore] Failed to persist note:', error)
    }
  },

  addNote: async (note: Note) => {
    const { notes } = get()

    // Optimistic update
    set({ notes: [...notes, note], error: null })

    try {
      await persistWithRetry(async () => {
        await db.notes.add(note)
      })
      addToIndex(note)
      if (supportsWorkers()) {
        embeddingPipeline
          .indexNote(note)
          .catch(err => console.error('[NoteStore] Embedding failed:', err))
      }
    } catch (error) {
      // Rollback on failure
      set({
        notes: notes.filter(n => n.id !== note.id),
        error: 'Failed to add note',
      })
      console.error('[NoteStore] Failed to persist new note:', error)
    }
  },

  deleteNote: async (noteId: string) => {
    const { notes } = get()
    const noteToDelete = notes.find(n => n.id === noteId)

    // Optimistic update
    set({
      notes: notes.filter(n => n.id !== noteId),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.notes.delete(noteId)
      })
      removeFromIndex(noteId)
      if (supportsWorkers()) {
        embeddingPipeline
          .removeNote(noteId)
          .catch(err => console.error('[NoteStore] Embedding removal failed:', err))
      }
    } catch (error) {
      // Rollback on failure
      if (noteToDelete) {
        set({
          notes: [...get().notes, noteToDelete],
          error: 'Failed to delete note',
        })
      }
      console.error('[NoteStore] Failed to delete note:', error)
    }
  },

  softDelete: (noteId: string) => {
    const { notes } = get()
    set({
      notes: notes.map(n =>
        n.id === noteId ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n
      ),
      error: null,
    })
  },

  restoreNote: (noteId: string) => {
    const { notes } = get()
    set({
      notes: notes.map(n => (n.id === noteId ? { ...n, deleted: false, deletedAt: undefined } : n)),
      error: null,
    })
  },

  getNoteForLesson: (courseId: string, videoId: string) => {
    const { notes } = get()
    return notes.find(n => n.courseId === courseId && n.videoId === videoId)
  },
}))

// ── Note link suggestion helpers (AC4–AC6) ────────────────────────────────────

/**
 * After a note is saved, run cross-course link detection and show a Sonner
 * toast for the first matching suggestion. Non-blocking — errors are swallowed.
 */
function triggerNoteLinkSuggestions(savedNote: Note, allNotes: Note[]): void {
  try {
    // Build courseId → name map from DB (fire-and-forget, non-blocking)
    db.importedCourses.toArray().then(courses => {
      const courseMap = new Map(courses.map(c => [c.id, c.name]))
      const suggestions = findNoteLinkSuggestions(savedNote, allNotes, courseMap)
      if (suggestions.length === 0) return

      // Show one toast per suggestion (cap at 2 to avoid toast flooding)
      suggestions.slice(0, 2).forEach(s => {
        showNoteLinkToast(s)
      })
    }).catch(err => console.error('[NoteStore] Note link suggestion failed:', err))
  } catch (err) {
    console.error('[NoteStore] Note link suggestion failed:', err)
  }
}

function showNoteLinkToast(suggestion: NoteLinkSuggestion): void {
  const preview = suggestion.previewContent.length > 60
    ? suggestion.previewContent.slice(0, 60) + '…'
    : suggestion.previewContent

  toast('Note connection found', {
    description: `"${preview}" — ${suggestion.targetCourseTitle}`,
    duration: 8000,
    action: {
      label: 'Link notes',
      onClick: () => acceptNoteLinkSuggestion(suggestion),
    },
    cancel: {
      label: 'Dismiss',
      onClick: () => dismissNoteLinkPair(suggestion.sourceNoteId, suggestion.targetNoteId),
    },
  })
}

/**
 * Accept a note link suggestion — creates a bidirectional link in both notes.
 * Updates are persisted to IndexedDB and the Zustand store.
 */
async function acceptNoteLinkSuggestion(suggestion: NoteLinkSuggestion): Promise<void> {
  try {
    const [sourceNote, targetNote] = await Promise.all([
      db.notes.get(suggestion.sourceNoteId),
      db.notes.get(suggestion.targetNoteId),
    ])

    if (!sourceNote || !targetNote) {
      console.error('[NoteStore] Could not find notes for link suggestion')
      return
    }

    const updatedSource: Note = {
      ...sourceNote,
      linkedNoteIds: [...new Set([...(sourceNote.linkedNoteIds ?? []), targetNote.id])],
      updatedAt: new Date().toISOString(),
    }

    const updatedTarget: Note = {
      ...targetNote,
      linkedNoteIds: [...new Set([...(targetNote.linkedNoteIds ?? []), sourceNote.id])],
      updatedAt: new Date().toISOString(),
    }

    await Promise.all([
      db.notes.put(updatedSource),
      db.notes.put(updatedTarget),
    ])

    // Update Zustand store to reflect linked notes
    useNoteStore.setState(state => ({
      notes: state.notes.map(n => {
        if (n.id === updatedSource.id) return updatedSource
        if (n.id === updatedTarget.id) return updatedTarget
        return n
      }),
    }))

    toast.success('Notes linked!', {
      description: `Linked to note in ${suggestion.targetCourseTitle}`,
      duration: 3000,
    })
  } catch (err) {
    console.error('[NoteStore] Failed to accept note link suggestion:', err)
    toast.error('Failed to link notes')
  }
}
