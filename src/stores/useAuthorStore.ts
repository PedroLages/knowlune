import { create } from 'zustand'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Author } from '@/data/types'
import { persistWithRetry } from '@/lib/persistWithRetry'

interface AuthorState {
  authors: Author[]
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  loadAuthors: () => Promise<void>
  addAuthor: (data: Omit<Author, 'id'>) => Promise<Author>
  updateAuthor: (id: string, data: Partial<Omit<Author, 'id'>>) => Promise<void>
  deleteAuthor: (id: string) => Promise<void>
  getAuthorById: (id: string) => Author | undefined
}

export const useAuthorStore = create<AuthorState>((set, get) => ({
  authors: [],
  isLoaded: false,
  isLoading: false,
  error: null,

  loadAuthors: async () => {
    const { isLoaded, isLoading } = get()
    if (isLoaded || isLoading) return

    set({ isLoading: true, error: null })
    try {
      const authors = await db.authors.toArray()
      set({ authors, isLoaded: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false, error: 'Failed to load authors' })
      console.error('[AuthorStore] Failed to load authors:', error)
      toast.error('Failed to load authors')
    }
  },

  addAuthor: async (data: Omit<Author, 'id'>) => {
    const author: Author = {
      ...data,
      id: crypto.randomUUID(),
    }

    try {
      await persistWithRetry(async () => {
        await db.authors.add(author)
      })
      set({ authors: [...get().authors, author] })
      return author
    } catch (error) {
      console.error('[AuthorStore] Failed to add author:', error)
      toast.error('Failed to create author')
      throw error
    }
  },

  updateAuthor: async (id: string, data: Partial<Omit<Author, 'id'>>) => {
    const { authors } = get()
    const existing = authors.find(a => a.id === id)
    if (!existing) return

    const updated = { ...existing, ...data }

    try {
      await persistWithRetry(async () => {
        await db.authors.put(updated)
      })
      set({
        authors: authors.map(a => (a.id === id ? updated : a)),
      })
    } catch (error) {
      console.error('[AuthorStore] Failed to update author:', error)
      toast.error('Failed to update author')
      throw error
    }
  },

  deleteAuthor: async (id: string) => {
    const { authors } = get()
    const existing = authors.find(a => a.id === id)
    if (!existing) return

    try {
      await persistWithRetry(async () => {
        await db.authors.delete(id)
      })
      set({ authors: authors.filter(a => a.id !== id) })
    } catch (error) {
      console.error('[AuthorStore] Failed to delete author:', error)
      toast.error('Failed to delete author')
      throw error
    }
  },

  getAuthorById: (id: string) => {
    return get().authors.find(a => a.id === id)
  },
}))
