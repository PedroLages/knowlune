import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { ImportedAuthor } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import { resolvePhotoHandle, revokePhotoUrl } from '@/lib/authorPhotoResolver'

interface NewAuthorData {
  name: string
  title?: string
  bio?: string
  shortBio?: string
  photoUrl?: string
  photoHandle?: FileSystemFileHandle
  courseIds?: string[]
  specialties?: string[]
  yearsExperience?: number
  education?: string
  socialLinks?: { website?: string; twitter?: string; linkedin?: string }
  featuredQuote?: string
  isPreseeded?: boolean
}

interface UpdateAuthorData {
  name?: string
  title?: string
  bio?: string
  shortBio?: string
  photoUrl?: string
  photoHandle?: FileSystemFileHandle
  courseIds?: string[]
  specialties?: string[]
  yearsExperience?: number
  education?: string
  socialLinks?: { website?: string; twitter?: string; linkedin?: string }
  featuredQuote?: string
}

interface AuthorStoreState {
  authors: ImportedAuthor[]
  isLoading: boolean
  isLoaded: boolean
  error: string | null

  loadAuthors: () => Promise<void>
  addAuthor: (data: NewAuthorData) => Promise<ImportedAuthor>
  updateAuthor: (id: string, data: UpdateAuthorData) => Promise<void>
  deleteAuthor: (id: string, options?: { silent?: boolean }) => Promise<void>
  getAuthorById: (id: string) => ImportedAuthor | undefined
  linkCourseToAuthor: (authorId: string, courseId: string) => Promise<void>
  unlinkCourseFromAuthor: (authorId: string, courseId: string) => Promise<void>
}

export const useAuthorStore = create<AuthorStoreState>((set, get) => ({
  authors: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  loadAuthors: async () => {
    if (get().isLoaded) return
    set({ isLoading: true, error: null })
    try {
      const authors = await db.authors.orderBy('createdAt').reverse().toArray()

      // Resolve photoHandle → photoUrl for authors that have a handle but no URL (E25-S05)
      const resolved = await Promise.all(
        authors.map(async author => {
          if (author.photoHandle && !author.photoUrl) {
            const url = await resolvePhotoHandle(author.photoHandle)
            if (url) {
              return { ...author, photoUrl: url }
            }
          }
          return author
        })
      )

      set({ authors: resolved, isLoading: false, isLoaded: true })
    } catch (error) {
      set({ isLoading: false, isLoaded: true, error: 'Failed to load authors' })
      console.error('[AuthorStore] Failed to load authors:', error)
      toast.error('Failed to load authors. Please try refreshing the page.')
    }
  },

  addAuthor: async (data: NewAuthorData) => {
    const now = new Date().toISOString()
    const author: ImportedAuthor = {
      id: crypto.randomUUID(),
      name: data.name,
      title: data.title,
      bio: data.bio,
      shortBio: data.shortBio,
      photoUrl: data.photoUrl,
      photoHandle: data.photoHandle,
      courseIds: data.courseIds ?? [],
      specialties: data.specialties,
      yearsExperience: data.yearsExperience,
      education: data.education,
      socialLinks: data.socialLinks,
      featuredQuote: data.featuredQuote,
      isPreseeded: data.isPreseeded ?? false,
      createdAt: now,
      updatedAt: now,
    }

    const { authors } = get()

    // Optimistic update
    set({
      authors: [author, ...authors],
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.authors.add(author)
      })
      return author
    } catch (error) {
      // Rollback on failure
      set({
        authors,
        error: 'Failed to create author',
      })
      console.error('[AuthorStore] Failed to persist author:', error)
      throw error
    }
  },

  updateAuthor: async (id: string, data: UpdateAuthorData) => {
    const { authors } = get()
    const existing = authors.find(a => a.id === id)
    if (!existing) return

    const updated: ImportedAuthor = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    // Optimistic update
    set({
      authors: authors.map(a => (a.id === id ? updated : a)),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.authors.put(updated)
      })
    } catch (error) {
      // Rollback on failure
      set({
        authors,
        error: 'Failed to update author',
      })
      console.error('[AuthorStore] Failed to update author:', error)
      throw error
    }
  },

  deleteAuthor: async (id: string, options?: { silent?: boolean }) => {
    const { authors } = get()
    const deletedIndex = authors.findIndex(a => a.id === id)
    if (deletedIndex === -1) return
    const deletedAuthor = authors[deletedIndex]

    // Optimistic update
    set({
      authors: authors.filter(a => a.id !== id),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.authors.delete(id)
      })

      // Revoke object URL to prevent memory leak
      if (deletedAuthor.photoHandle) {
        revokePhotoUrl(deletedAuthor.photoHandle)
      }

      if (!options?.silent) {
        toastWithUndo({
          message: `Author "${deletedAuthor.name}" deleted`,
          onUndo: async () => {
            await db.authors.add(deletedAuthor)
            // Restore at original index position
            const current = get().authors
            const restored = [...current]
            restored.splice(deletedIndex, 0, deletedAuthor)
            set({ authors: restored })
            toast.success('Author restored')
          },
          duration: 5000,
        })
      }
    } catch (error) {
      // Rollback to full snapshot preserving original order
      set({
        authors,
        error: 'Failed to delete author',
      })
      toastError.deleteFailed('author')
      throw error
    }
  },

  getAuthorById: (id: string) => {
    return get().authors.find(a => a.id === id)
  },

  linkCourseToAuthor: async (authorId: string, courseId: string) => {
    const { authors } = get()
    const author = authors.find(a => a.id === authorId)
    if (!author) return
    if (author.courseIds.includes(courseId)) return // Already linked

    const updatedCourseIds = [...author.courseIds, courseId]
    const updated: ImportedAuthor = {
      ...author,
      courseIds: updatedCourseIds,
      updatedAt: new Date().toISOString(),
    }

    set({
      authors: authors.map(a => (a.id === authorId ? updated : a)),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.authors.put(updated)
      })
    } catch (error) {
      set({ authors, error: 'Failed to link course to author' })
      console.error('[AuthorStore] Failed to link course:', error)
      throw error
    }
  },

  unlinkCourseFromAuthor: async (authorId: string, courseId: string) => {
    const { authors } = get()
    const author = authors.find(a => a.id === authorId)
    if (!author) return
    if (!author.courseIds.includes(courseId)) return // Not linked

    const updatedCourseIds = author.courseIds.filter(id => id !== courseId)
    const updated: ImportedAuthor = {
      ...author,
      courseIds: updatedCourseIds,
      updatedAt: new Date().toISOString(),
    }

    set({
      authors: authors.map(a => (a.id === authorId ? updated : a)),
      error: null,
    })

    try {
      await persistWithRetry(async () => {
        await db.authors.put(updated)
      })
    } catch (error) {
      set({ authors, error: 'Failed to unlink course from author' })
      console.error('[AuthorStore] Failed to unlink course:', error)
      throw error
    }
  },
}))
