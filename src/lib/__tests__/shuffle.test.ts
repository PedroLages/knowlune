import { describe, it, expect } from 'vitest'
import { fisherYatesShuffle } from '../shuffle'

describe('fisherYatesShuffle', () => {
  it('returns array with all elements present (valid permutation)', () => {
    const input = [1, 2, 3, 4, 5]
    const result = fisherYatesShuffle(input)
    expect(result).toHaveLength(5)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    fisherYatesShuffle(input)
    expect(input).toEqual(copy)
  })

  it('returns empty array for empty input', () => {
    expect(fisherYatesShuffle([])).toEqual([])
  })

  it('returns single-element array unchanged', () => {
    expect(fisherYatesShuffle([42])).toEqual([42])
  })

  it('works with generic types (strings)', () => {
    const input = ['a', 'b', 'c']
    const result = fisherYatesShuffle(input)
    expect(result).toHaveLength(3)
    expect(result.sort()).toEqual(['a', 'b', 'c'])
  })

  it('produces uniform distribution across 10,000 shuffles', () => {
    const input = [0, 1, 2, 3, 4]
    const n = input.length
    const runs = 10_000
    // Count how many times each value appears in each position
    const counts: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < runs; i++) {
      const result = fisherYatesShuffle(input)
      for (let pos = 0; pos < n; pos++) {
        counts[pos][result[pos]]++
      }
    }

    const expected = runs / n // 2000
    const tolerance = 0.05 // ±5%

    for (let pos = 0; pos < n; pos++) {
      for (let val = 0; val < n; val++) {
        const ratio = counts[pos][val] / expected
        expect(ratio).toBeGreaterThan(1 - tolerance)
        expect(ratio).toBeLessThan(1 + tolerance)
      }
    }
  })
})
