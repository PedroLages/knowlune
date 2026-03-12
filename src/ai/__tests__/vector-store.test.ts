/**
 * Unit tests for VectorStorePersistence
 *
 * AC3: Embedding pipeline saves 384-dim vector to IndexedDB and in-memory store
 * AC4: Note deletion removes embedding from IndexedDB and in-memory store
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

// Fresh module imports per test to avoid singleton state bleed
let VectorStorePersistence: typeof import('../vector-store').VectorStorePersistence
let vectorStorePersistence: typeof import('../vector-store').vectorStorePersistence

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  // Re-import schema to get a fresh Dexie instance
  vi.resetModules()
  await import('@/db/schema')
  const mod = await import('../vector-store')
  VectorStorePersistence = mod.VectorStorePersistence
  // Use a fresh instance (not the singleton) for isolation
  vectorStorePersistence = new mod.VectorStorePersistence() as typeof vectorStorePersistence
})

function make384Vector(seed = 1): number[] {
  const v = new Array(384).fill(0)
  v[0] = seed
  return v
}

describe('VectorStorePersistence — AC3: saveEmbedding', () => {
  it('persists embedding to IndexedDB and in-memory store', async () => {
    const embedding = make384Vector(1)
    await vectorStorePersistence.saveEmbedding('note-1', embedding)

    expect(vectorStorePersistence.size).toBe(1)

    // Verify persisted in IndexedDB
    const { db } = await import('@/db/schema')
    const record = await db.embeddings.get('note-1')
    expect(record).toBeDefined()
    expect(record!.noteId).toBe('note-1')
    expect(record!.embedding).toHaveLength(384)
    expect(record!.createdAt).toBeTruthy()
  })

  it('updates existing embedding when same noteId is saved again', async () => {
    await vectorStorePersistence.saveEmbedding('note-1', make384Vector(1))
    await vectorStorePersistence.saveEmbedding('note-1', make384Vector(0.5))

    expect(vectorStorePersistence.size).toBe(1)

    const { db } = await import('@/db/schema')
    const record = await db.embeddings.get('note-1')
    expect(record!.embedding[0]).toBeCloseTo(0.5)
  })

  it('throws and does not persist if embedding has wrong dimensions', async () => {
    await expect(vectorStorePersistence.saveEmbedding('note-bad', [1, 2, 3])).rejects.toThrow(
      /dimensions/i
    )

    expect(vectorStorePersistence.size).toBe(0)

    const { db } = await import('@/db/schema')
    const record = await db.embeddings.get('note-bad')
    expect(record).toBeUndefined()
  })
})

describe('VectorStorePersistence — AC4: removeEmbedding', () => {
  it('removes embedding from both IndexedDB and in-memory store', async () => {
    await vectorStorePersistence.saveEmbedding('note-del', make384Vector(1))
    expect(vectorStorePersistence.size).toBe(1)

    await vectorStorePersistence.removeEmbedding('note-del')
    expect(vectorStorePersistence.size).toBe(0)

    const { db } = await import('@/db/schema')
    const record = await db.embeddings.get('note-del')
    expect(record).toBeUndefined()
  })

  it('is a no-op for a noteId that does not exist', async () => {
    await expect(vectorStorePersistence.removeEmbedding('ghost-note')).resolves.not.toThrow()
    expect(vectorStorePersistence.size).toBe(0)
  })
})

describe('VectorStorePersistence — AC2: loadAll', () => {
  it('loads all persisted embeddings into memory on startup', async () => {
    // Persist directly via another instance
    const writer = new VectorStorePersistence()
    await writer.saveEmbedding('note-a', make384Vector(1))
    await writer.saveEmbedding('note-b', make384Vector(0.5))

    // Fresh instance simulates app restart
    const reader = new VectorStorePersistence()
    expect(reader.size).toBe(0)

    await reader.loadAll()
    expect(reader.size).toBe(2)
  })
})
