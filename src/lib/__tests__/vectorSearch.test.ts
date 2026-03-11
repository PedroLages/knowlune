/**
 * Vector Search Tests (AC6)
 *
 * Tests the brute-force k-NN cosine similarity search logic used by
 * the search worker. Verifies results are sorted by score descending.
 */

import { describe, it, expect } from 'vitest'
import { BruteForceVectorStore } from '../vectorSearch'
import { cosineSimilarity } from '../vectorMath'

describe('cosineSimilarity (AC6: real cosine sort)', () => {
  it('returns 1.0 for identical vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([1, 0, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0)
  })

  it('returns higher score for more similar vectors', () => {
    const query = new Float32Array([1, 0, 0])
    const high = new Float32Array([1, 0, 0]) // identical
    const med = new Float32Array([0.7, 0.7, 0]) // partial match
    const low = new Float32Array([0, 0, 1]) // orthogonal

    const scoreHigh = cosineSimilarity(query, high)
    const scoreMed = cosineSimilarity(query, med)
    const scoreLow = cosineSimilarity(query, low)

    expect(scoreHigh).toBeGreaterThan(scoreMed)
    expect(scoreMed).toBeGreaterThan(scoreLow)
  })
})

describe('BruteForceVectorStore.search (AC6: search worker algorithm)', () => {
  it('returns results sorted by cosine similarity descending', () => {
    const store = new BruteForceVectorStore(3)
    store.insert('note-high', [1, 0, 0]) // most similar to query
    store.insert('note-med', [0.7, 0.7, 0]) // partial match
    store.insert('note-low', [0, 0, 1]) // orthogonal

    const results = store.search([1, 0, 0], 3)

    expect(results[0].id).toBe('note-high')
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity)
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity)
  })

  it('respects topK limit', () => {
    const store = new BruteForceVectorStore(3)
    store.insert('a', [1, 0, 0])
    store.insert('b', [0, 1, 0])
    store.insert('c', [0, 0, 1])

    const results = store.search([1, 0, 0], 2)

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('a') // highest cosine similarity
  })

  it('returns empty array when store is empty', () => {
    const store = new BruteForceVectorStore(3)
    expect(store.search([1, 0, 0], 5)).toEqual([])
  })

  it('returns the note with highest cosine score first', () => {
    // Simulate the AC6 scenario: two notes, query matches note-1 best
    const store = new BruteForceVectorStore(4)
    store.insert('note-1', [1, 0, 0, 0]) // query is identical
    store.insert('note-2', [0, 1, 0, 0]) // orthogonal

    const results = store.search([1, 0, 0, 0], 2)

    expect(results[0].id).toBe('note-1')
    expect(results[0].similarity).toBeCloseTo(1.0)
    expect(results[1].similarity).toBeCloseTo(0)
  })
})
