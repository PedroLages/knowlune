/**
 * Vector Store Proxy
 *
 * Main-thread IndexedDB interface for note embeddings.
 * Workers cannot access IndexedDB directly — this module provides a clean
 * API to load embeddings for worker transfer and persist results from workers.
 */

import { db } from '@/db'
import type { NoteEmbedding } from '@/data/types'

/**
 * Load all note embeddings from IndexedDB into a plain object for worker transfer.
 * Called on main thread before sending to search worker via load-index.
 */
export async function loadVectorIndex(): Promise<Record<string, Float32Array>> {
  const embeddings = await db.embeddings.toArray()
  const index: Record<string, Float32Array> = {}
  for (const entry of embeddings) {
    index[entry.noteId] = entry.embedding
  }
  return index
}

/**
 * Persist a single embedding to IndexedDB.
 */
export async function saveEmbedding(
  noteId: string,
  embedding: Float32Array,
  model = 'all-MiniLM-L6-v2'
): Promise<void> {
  await db.embeddings.put({
    noteId,
    embedding,
    model,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Persist a batch of embeddings. Yields to the main thread every 10 items
 * to keep the UI responsive during large batch operations (NFR33).
 */
export async function bulkSaveEmbeddings(
  items: Array<{ noteId: string; embedding: Float32Array }>,
  model = 'all-MiniLM-L6-v2'
): Promise<void> {
  const BATCH_SIZE = 10
  const createdAt = new Date().toISOString()

  try {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      await db.embeddings.bulkPut(
        batch.map(({ noteId, embedding }) => ({
          noteId,
          embedding,
          model,
          createdAt,
        }))
      )
      // Yield to main thread between batches to avoid blocking UI (NFR33)
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
  } catch (error) {
    console.error('[VectorStore] bulkSaveEmbeddings failed:', error)
    throw error
  }
}

/**
 * Delete embedding when note content changes (cache invalidation).
 */
export async function deleteEmbedding(noteId: string): Promise<void> {
  await db.embeddings.delete(noteId)
}

/**
 * Get embedding for a single note (for incremental updates).
 */
export async function getEmbedding(noteId: string): Promise<NoteEmbedding | undefined> {
  return db.embeddings.get(noteId)
}
