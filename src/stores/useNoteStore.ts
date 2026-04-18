import { create } from 'zustand'
import { db } from '@/db'
import type { Note } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import {
  addToIndex as addDocToIndex,
  updateInIndex as updateDocInIndex,
  removeFromIndex as removeDocFromIndex,
  toSearchableNote,
} from '@/lib/unifiedSearch'
import { embeddingPipeline } from '@/ai/embeddingPipeline'
import { supportsWorkers } from '@/ai/lib/workerCapabilities'
import { triggerNoteLinkSuggestions } from '@/ai/knowledgeGaps/noteLinkSuggestions'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

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
  softDelete: (noteId: string) => Promise<void>
  restoreNote: (noteId: string) => Promise<void>
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
        await syncableWrite('notes', 'put', note as unknown as SyncableRecord)
      })
      if (existingIndex >= 0) {
        updateDocInIndex(toSearchableNote(note))
      } else {
        addDocToIndex(toSearchableNote(note))
      }
      if (supportsWorkers()) {
        embeddingPipeline
          .indexNote(note)
          .catch(err => console.error('[NoteStore] Embedding failed:', err))
      }
      // Suggest cross-course note links after successful save (AC4–AC6)
      triggerNoteLinkSuggestions(note, get().notes, (source, target) => {
        // Update Zustand store to reflect linked notes
        useNoteStore.setState(state => ({
          notes: state.notes.map(n => {
            if (n.id === source.id) return source
            if (n.id === target.id) return target
            return n
          }),
        }))
      })
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
        await syncableWrite('notes', 'add', note as unknown as SyncableRecord)
      })
      addDocToIndex(toSearchableNote(note))
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
        await syncableWrite('notes', 'delete', noteId)
      })
      removeDocFromIndex(noteId, 'note')
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

  softDelete: async (noteId: string) => {
    const deletedAt = new Date().toISOString()

    try {
      await persistWithRetry(async () => {
        const existing = await db.notes.get(noteId)
        if (!existing) return
        const mergedNote: Note = { ...existing, deleted: true, deletedAt }
        await syncableWrite('notes', 'put', mergedNote as unknown as SyncableRecord)
      })
      // Optimistic state update applied after successful persist
      set(state => ({
        notes: state.notes.map(n =>
          n.id === noteId ? { ...n, deleted: true, deletedAt } : n
        ),
        error: null,
      }))
    } catch (error) {
      set({ error: 'Failed to soft delete note' })
      console.error('[NoteStore] Failed to soft delete note:', error)
    }
  },

  restoreNote: async (noteId: string) => {
    try {
      await persistWithRetry(async () => {
        const existing = await db.notes.get(noteId)
        if (!existing) return
        const mergedNote: Note = { ...existing, deleted: false, deletedAt: undefined }
        await syncableWrite('notes', 'put', mergedNote as unknown as SyncableRecord)
      })
      // Optimistic state update applied after successful persist
      set(state => ({
        notes: state.notes.map(n => (n.id === noteId ? { ...n, deleted: false, deletedAt: undefined } : n)),
        error: null,
      }))
    } catch (error) {
      set({ error: 'Failed to restore note' })
      console.error('[NoteStore] Failed to restore note:', error)
    }
  },

  getNoteForLesson: (courseId: string, videoId: string) => {
    const { notes } = get()
    return notes.find(n => n.courseId === courseId && n.videoId === videoId)
  },
}))
