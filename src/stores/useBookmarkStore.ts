import { create } from 'zustand'
import { db } from '@/db'
import type { VideoBookmark } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { formatBookmarkTimestamp } from '@/lib/bookmarks'

interface BookmarkState {
  bookmarks: VideoBookmark[]
  isLoading: boolean
  error: string | null

  loadBookmarks: () => Promise<void>
  loadLessonBookmarks: (courseId: string, lessonId: string) => Promise<void>
  loadCourseBookmarks: (courseId: string) => Promise<void>
  addBookmark: (courseId: string, lessonId: string, timestamp: number, label?: string) => Promise<void>
  updateBookmarkLabel: (bookmarkId: string, label: string) => Promise<void>
  deleteBookmark: (bookmarkId: string) => Promise<void>
  getTotalCount: () => Promise<number>
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  isLoading: false,
  error: null,

  loadBookmarks: async () => {
    set({ isLoading: true, error: null })
    try {
      const bookmarks = await db.bookmarks.toArray()
      set({ bookmarks: bookmarks.sort((a, b) => a.timestamp - b.timestamp), isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load bookmarks' })
      console.error('[BookmarkStore] Failed to load bookmarks:', error)
    }
  },

  loadLessonBookmarks: async (courseId: string, lessonId: string) => {
    set({ isLoading: true, error: null })
    try {
      const bookmarks = await db.bookmarks.where({ courseId, lessonId }).toArray()
      set({
        bookmarks: bookmarks.sort((a, b) => a.timestamp - b.timestamp),
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load lesson bookmarks' })
      console.error('[BookmarkStore] Failed to load lesson bookmarks:', error)
    }
  },

  loadCourseBookmarks: async (courseId: string) => {
    set({ isLoading: true, error: null })
    try {
      const bookmarks = await db.bookmarks.where({ courseId }).toArray()
      set({
        bookmarks: bookmarks.sort((a, b) => a.timestamp - b.timestamp),
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load course bookmarks' })
      console.error('[BookmarkStore] Failed to load course bookmarks:', error)
    }
  },

  addBookmark: async (courseId: string, lessonId: string, timestamp: number, label?: string) => {
    const bookmark: VideoBookmark = {
      id: crypto.randomUUID(),
      courseId,
      lessonId,
      timestamp: Math.floor(timestamp),
      label: label || formatBookmarkTimestamp(timestamp),
      createdAt: new Date().toISOString(),
    }

    const { bookmarks } = get()

    // Optimistic update
    set({
      bookmarks: [...bookmarks, bookmark].sort((a, b) => a.timestamp - b.timestamp),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.bookmarks.add(bookmark)
      })
    } catch (error) {
      // Rollback on failure
      set({
        bookmarks: bookmarks,
        error: 'Failed to add bookmark',
      })
      console.error('[BookmarkStore] Failed to persist bookmark:', error)
    }
  },

  updateBookmarkLabel: async (bookmarkId: string, label: string) => {
    const { bookmarks } = get()
    const bookmark = bookmarks.find(b => b.id === bookmarkId)
    if (!bookmark) return

    const oldLabel = bookmark.label

    // Optimistic update
    set({
      bookmarks: bookmarks.map(b => (b.id === bookmarkId ? { ...b, label } : b)),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.bookmarks.update(bookmarkId, { label })
      })
    } catch (error) {
      // Rollback on failure
      set({
        bookmarks: get().bookmarks.map(b => (b.id === bookmarkId ? { ...b, label: oldLabel } : b)),
        error: 'Failed to update bookmark',
      })
      console.error('[BookmarkStore] Failed to update bookmark:', error)
    }
  },

  deleteBookmark: async (bookmarkId: string) => {
    const { bookmarks } = get()
    const bookmarkToDelete = bookmarks.find(b => b.id === bookmarkId)

    // Optimistic update
    set({
      bookmarks: bookmarks.filter(b => b.id !== bookmarkId),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.bookmarks.delete(bookmarkId)
      })
    } catch (error) {
      // Rollback on failure
      if (bookmarkToDelete) {
        set({
          bookmarks: [...get().bookmarks, bookmarkToDelete].sort((a, b) => a.timestamp - b.timestamp),
          error: 'Failed to delete bookmark',
        })
      }
      console.error('[BookmarkStore] Failed to delete bookmark:', error)
    }
  },

  getTotalCount: async () => {
    try {
      return await db.bookmarks.count()
    } catch (error) {
      console.error('[BookmarkStore] Failed to get count:', error)
      return 0
    }
  },
}))
