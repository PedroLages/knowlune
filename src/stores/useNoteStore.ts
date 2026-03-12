import { create } from 'zustand'
import { db } from '@/db'
import type { Note } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { addToIndex, updateInIndex, removeFromIndex } from '@/lib/noteSearch'
import { embeddingPipeline } from '@/ai/embeddingPipeline'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'

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

  getNoteForLesson: (courseId: string, videoId: string) => {
    const { notes } = get()
    return notes.find(n => n.courseId === courseId && n.videoId === videoId)
  },
}))
