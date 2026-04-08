import { describe, it, expect } from 'vitest'
import { cosineSimilarity, normalizeVector, dotProduct, euclideanDistance } from '@/lib/vectorMath'

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([-1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('throws on dimension mismatch', () => {
    const a = new Float32Array([1, 2])
    const b = new Float32Array([1, 2, 3])
    expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch')
  })

  it('returns 0 for zero vector', () => {
    const a = new Float32Array([0, 0, 0])
    const b = new Float32Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('is commutative', () => {
    const a = new Float32Array([1, 3, -5])
    const b = new Float32Array([4, -2, -1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 5)
  })
})

// ---------------------------------------------------------------------------
// normalizeVector
// ---------------------------------------------------------------------------

describe('normalizeVector', () => {
  it('produces unit length vector', () => {
    const v = new Float32Array([3, 4])
    const n = normalizeVector(v)
    const magnitude = Math.sqrt(n[0] ** 2 + n[1] ** 2)
    expect(magnitude).toBeCloseTo(1, 5)
  })

  it('preserves direction', () => {
    const v = new Float32Array([6, 0])
    const n = normalizeVector(v)
    expect(n[0]).toBeCloseTo(1, 5)
    expect(n[1]).toBeCloseTo(0, 5)
  })

  it('returns same vector for zero vector (avoids division by zero)', () => {
    const v = new Float32Array([0, 0, 0])
    const n = normalizeVector(v)
    expect(n[0]).toBe(0)
    expect(n[1]).toBe(0)
    expect(n[2]).toBe(0)
  })

  it('does not mutate original', () => {
    const v = new Float32Array([3, 4])
    normalizeVector(v)
    expect(v[0]).toBe(3)
    expect(v[1]).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// dotProduct
// ---------------------------------------------------------------------------

describe('dotProduct', () => {
  it('computes correct dot product', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([4, 5, 6])
    // 1*4 + 2*5 + 3*6 = 32
    expect(dotProduct(a, b)).toBeCloseTo(32, 4)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0])
    const b = new Float32Array([0, 1])
    expect(dotProduct(a, b)).toBeCloseTo(0, 5)
  })

  it('throws on dimension mismatch', () => {
    const a = new Float32Array([1])
    const b = new Float32Array([1, 2])
    expect(() => dotProduct(a, b)).toThrow('Vector dimension mismatch')
  })
})

// ---------------------------------------------------------------------------
// euclideanDistance
// ---------------------------------------------------------------------------

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3])
    expect(euclideanDistance(a, a)).toBe(0)
  })

  it('computes correct distance', () => {
    const a = new Float32Array([0, 0])
    const b = new Float32Array([3, 4])
    expect(euclideanDistance(a, b)).toBeCloseTo(5, 5)
  })

  it('is commutative', () => {
    const a = new Float32Array([1, 5])
    const b = new Float32Array([3, -2])
    expect(euclideanDistance(a, b)).toBeCloseTo(euclideanDistance(b, a), 5)
  })

  it('throws on dimension mismatch', () => {
    const a = new Float32Array([1])
    const b = new Float32Array([1, 2])
    expect(() => euclideanDistance(a, b)).toThrow('Vector dimension mismatch')
  })
})
