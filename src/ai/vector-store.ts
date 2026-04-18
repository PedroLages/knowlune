import { db } from '@/db'
import type { SyncQueueEntry } from '@/db'
import { BruteForceVectorStore } from '@/lib/vectorSearch'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { useAuthStore } from '@/stores/useAuthStore'
import { syncEngine } from '@/lib/sync/syncEngine'
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
      const record: Embedding = {
        id: crypto.randomUUID(),
        noteId,
        embedding,
        createdAt: new Date().toISOString(),
      }
      await persistWithRetry(() =>
        syncableWrite('embeddings', 'put', record as unknown as Record<string, unknown>)
      )
    } catch (error) {
      // Rollback in-memory insert if DB write fails
      this.store.remove(noteId)
      throw error
    }
  }

  /** Remove embedding for a deleted note. Removes from both IndexedDB and in-memory store. */
  async removeEmbedding(noteId: string): Promise<void> {
    // Look up the Dexie record to get its stable `id` for the sync queue entry.
    // The Dexie table is keyed on `noteId`, so the actual Dexie delete must use
    // `noteId` — but the syncQueue `recordId` must use `id` (the Supabase PK).
    const rec = await db.embeddings.where('noteId').equals(noteId).first()
    if (rec?.id) {
      // Delete from Dexie by the Dexie PK (noteId), then enqueue by the Supabase PK (id).
      await db.embeddings.delete(noteId)
      // Manually enqueue the delete so the upload engine can delete the Supabase row.
      // We bypass syncableWrite's Dexie delete (which would use `id` as key) by
      // doing the Dexie delete above and using syncableWrite only for the queue entry.
      // Since syncableWrite delete also deletes from Dexie, we use skipQueue workaround:
      // instead, directly insert the queue entry.
      await _enqueueEmbeddingDelete(rec.id)
    } else if (rec) {
      // Legacy record without `id` (pre-v54 migration): direct delete only.
      // No sync queue entry — this record was never uploaded so no remote row to delete.
      console.warn('[VectorStore] removeEmbedding: record lacks id, falling back to direct delete', { noteId })
      await db.embeddings.delete(noteId)
    }
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

// ---------------------------------------------------------------------------
// Private helper — enqueue an embeddings delete entry for the upload engine.
//
// The `embeddings` table has a PK mismatch: Dexie uses `noteId` as primary key
// while Supabase uses `id` (UUID). `syncableWrite('delete')` would call
// `db.embeddings.delete(id)` — which fails because Dexie expects `noteId`.
// To work around this, `removeEmbedding` deletes from Dexie by `noteId`
// directly, then calls this helper to insert the sync queue entry using `id`
// as the `recordId` (the Supabase conflict key for the delete).
// ---------------------------------------------------------------------------

async function _enqueueEmbeddingDelete(id: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id ?? null
  if (!userId) return // unauthenticated — no remote row to delete

  const now = new Date().toISOString()
  try {
    const queueEntry: Omit<SyncQueueEntry, 'id'> = {
      tableName: 'embeddings',
      recordId: id,
      operation: 'delete',
      payload: { id },
      attempts: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    await db.syncQueue.add(queueEntry as SyncQueueEntry)
    syncEngine.nudge()
  } catch (err) {
    // Non-fatal: queue insert failure. The Dexie delete already succeeded.
    // silent-catch-ok — logged, not silenced; matches syncableWrite error contract.
    console.error('[VectorStore] _enqueueEmbeddingDelete: queue insert failed:', err)
  }
}
