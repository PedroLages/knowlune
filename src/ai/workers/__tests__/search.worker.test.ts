/**
 * Unit tests for search worker logic
 *
 * AC5: Search worker handles load-index and search tasks with correct top-K ordering.
 *
 * Note: Web Workers are not available in the Vitest/JSDOM environment.
 * This test exercises the BruteForceVectorStore (the core of search.worker.ts)
 * directly to validate the load-index and search semantics the worker implements.
 */
import { describe, it, expect } from 'vitest'
import { BruteForceVectorStore } from '@/lib/vectorSearch'

function make384Vector(dim0: number, dim1 = 0, dim2 = 0): number[] {
  const v = new Array(384).fill(0)
  v[0] = dim0
  v[1] = dim1
  v[2] = dim2
  return v
}

describe('search worker logic — AC5: load-index and search', () => {
  it('load-index: inserts all vectors into the store', () => {
    const store = new BruteForceVectorStore(384)

    // Simulate load-index payload: record[noteId] → vector
    const vectors: Record<string, number[]> = {
      'note-a': make384Vector(1, 0, 0),
      'note-b': make384Vector(0, 1, 0),
      'note-c': make384Vector(0, 0, 1),
    }

    for (const [noteId, vector] of Object.entries(vectors)) {
      store.insert(noteId, vector)
    }

    expect(store.size).toBe(3)
  })

  it('search: returns top-K results ordered by similarity score descending', () => {
    const store = new BruteForceVectorStore(384)

    // note-a is most similar to query (both point toward dim 0)
    // note-b has partial similarity (mixed dim 0/1)
    // note-c is orthogonal (dim 2 only) — lowest similarity
    store.insert('note-a', make384Vector(1, 0, 0))
    store.insert('note-b', make384Vector(0.8, 0.6, 0))
    store.insert('note-c', make384Vector(0, 0, 1))

    const queryVector = make384Vector(1, 0, 0)
    const results = store.search(queryVector, 3)

    expect(results).toHaveLength(3)

    // Scores must be in descending order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity)
    }

    // note-a must be first (exact match → similarity ~1.0)
    expect(results[0].id).toBe('note-a')
    expect(results[0].similarity).toBeCloseTo(1.0, 5)

    // note-c must be last (orthogonal → similarity ~0)
    expect(results[results.length - 1].id).toBe('note-c')
    expect(results[results.length - 1].similarity).toBeCloseTo(0, 5)
  })

  it('search: returns at most topK results', () => {
    const store = new BruteForceVectorStore(384)
    store.insert('note-1', make384Vector(1, 0, 0))
    store.insert('note-2', make384Vector(0, 1, 0))
    store.insert('note-3', make384Vector(0, 0, 1))

    const results = store.search(make384Vector(1, 0, 0), 2)
    expect(results).toHaveLength(2)
  })

  it('search: returns empty array when store is empty', () => {
    const store = new BruteForceVectorStore(384)
    const results = store.search(make384Vector(1, 0, 0), 5)
    expect(results).toHaveLength(0)
  })

  it('search: result objects have id and similarity fields (maps to noteId and score)', () => {
    const store = new BruteForceVectorStore(384)
    store.insert('note-x', make384Vector(1, 0, 0))

    const results = store.search(make384Vector(1, 0, 0), 1)
    expect(results[0]).toHaveProperty('id', 'note-x')
    expect(results[0]).toHaveProperty('similarity')
    expect(typeof results[0].similarity).toBe('number')
  })
})
