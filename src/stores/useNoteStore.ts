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
import { findAndReturnNoteLinkSuggestions } from '@/ai/knowledgeGaps/noteLinkSuggestions'
import type { NoteLinkSuggestion } from '@/ai/knowledgeGaps/types'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

interface NoteState {
  notes: Note[]
  isLoading: boolean
  error: string | null
  pendingNoteLinkSuggestions: {
    courseId: string
    videoId: string
    suggestions: NoteLinkSuggestion[]
  } | null
  suggestionGeneration: number

  loadNotes: () => Promise<void>
  loadNotesByLesson: (courseId: string, videoId: string) => Promise<void>
  loadNotesByCourse: (courseId: string) => Promise<void>
  saveNote: (note: Note) => Promise<void>
  addNote: (note: Note) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
  softDelete: (noteId: string) => Promise<void>
  restoreNote: (noteId: string) => Promise<void>
  getNoteForLesson: (courseId: string, videoId: string) => Note | undefined
  setPendingNoteLinkSuggestions: (data: {
    courseId: string
    videoId: string
    suggestions: NoteLinkSuggestion[]
  }) => void
  clearPendingNoteLinkSuggestions: () => void
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  isLoading: false,
  error: null,
  pendingNoteLinkSuggestions: null,
  suggestionGeneration: 0,

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
      // Scoped by lesson to prevent stale suggestions leaking across navigations.
      // Generation counter prevents concurrent saves from silently overwriting.
      const currentCourseId = note.courseId
      const currentVideoId = note.videoId
      const gen = get().suggestionGeneration + 1
      set({ suggestionGeneration: gen })
      findAndReturnNoteLinkSuggestions(note, get().notes).then(suggestions => {
        if (get().suggestionGeneration !== gen) return // stale, discard
        if (suggestions.length > 0) {
          set({
            pendingNoteLinkSuggestions: {
              courseId: currentCourseId,
              videoId: currentVideoId,
              suggestions,
            },
          })
        }
      })
    } catch (error) {
      // Rollback on failure
      set({ notes: oldNotes, error: 'Failed to save note' })
      console.error('[NoteStore] Failed to persist note:', error)
      throw error
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
      throw error
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
        notes: state.notes.map(n => (n.id === noteId ? { ...n, deleted: true, deletedAt } : n)),
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
        notes: state.notes.map(n =>
          n.id === noteId ? { ...n, deleted: false, deletedAt: undefined } : n
        ),
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

  setPendingNoteLinkSuggestions: (data: {
    courseId: string
    videoId: string
    suggestions: NoteLinkSuggestion[]
  }) => {
    set({ pendingNoteLinkSuggestions: data })
  },

  clearPendingNoteLinkSuggestions: () => {
    set({ pendingNoteLinkSuggestions: null })
  },
}))
