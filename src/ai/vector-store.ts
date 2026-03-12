import { db } from '@/db'
import { BruteForceVectorStore } from '@/lib/vectorSearch'
import type { Embedding } from '@/data/types'

export class VectorStorePersistence {
  private store: BruteForceVectorStore

  constructor(dimensions = 384) {
    this.store = new BruteForceVectorStore(dimensions)
  }

  /** Load all embeddings from IndexedDB into in-memory store (call on app startup). */
  async loadAll(): Promise<void> {
    try {
      const embeddings = await db.embeddings.toArray()
      for (const emb of embeddings) {
        this.store.insert(emb.noteId, emb.embedding)
      }
    } catch (error) {
      console.error('[VectorStore] Failed to load embeddings:', error)
      // Graceful degradation: empty store is valid
    }
    // Notify any UI listening for store readiness (e.g. semantic search toggle)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vector-store-ready'))
    }
  }

  /** Persist embedding for a note (create/update). Updates both IndexedDB and in-memory store. */
  async saveEmbedding(noteId: string, embedding: number[]): Promise<void> {
    // Insert to memory first — throws immediately on dimension mismatch,
    // preventing a stale IndexedDB record with no in-memory counterpart.
    this.store.insert(noteId, embedding)
    try {
      const record: Embedding = { noteId, embedding, createdAt: new Date().toISOString() }
      await db.embeddings.put(record)
    } catch (error) {
      // Rollback in-memory insert if DB write fails
      this.store.remove(noteId)
      throw error
    }
  }

  /** Remove embedding for a deleted note. Removes from both IndexedDB and in-memory store. */
  async removeEmbedding(noteId: string): Promise<void> {
    await db.embeddings.delete(noteId)
    this.store.remove(noteId)
  }

  /** Get the in-memory store for searches. */
  getStore(): BruteForceVectorStore {
    return this.store
  }

  /** Get count of loaded embeddings. */
  get size(): number {
    return this.store.size
  }
}

// Singleton — shared across the app
export const vectorStorePersistence = new VectorStorePersistence()
