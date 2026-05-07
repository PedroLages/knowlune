import { describe, it, expect, beforeEach } from 'vitest'
import { findSimilarBooks } from '@/lib/similarity'
import type { Book } from '@/data/types'

let _counter = 0

/** Minimal book factory for tests. Uses unique author names to avoid cross-tier interference. */
function makeBook(overrides: Partial<Book> & { id: string; title: string }): Book {
  _counter++
  return {
    id: overrides.id,
    title: overrides.title,
    author: overrides.author ?? `Author ${_counter}`,
    format: overrides.format ?? 'epub',
    status: overrides.status ?? 'unread',
    tags: overrides.tags ?? [],
    chapters: overrides.chapters ?? [],
    source: overrides.source ?? { type: 'local', opfsPath: '/test' },
    progress: overrides.progress ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    genre: overrides.genre,
    description: overrides.description,
    series: overrides.series,
    seriesSequence: overrides.seriesSequence,
    language: overrides.language,
    publishDate: overrides.publishDate,
  }
}

beforeEach(() => {
  _counter = 0
})

describe('findSimilarBooks', () => {
  // ── Stop-word filtering ───────────────────────────────────────────────────
  it('filters stop words from description keywords', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description:
        'The art of critical thinking and logical analysis for better decisions',
    })

    const candidate = makeBook({
      id: 'c1',
      title: 'Similar Book',
      description:
        'This book covers critical thinking and logical reasoning skills',
    })

    const candidates = [candidate]
    const results = findSimilarBooks(hero, candidates)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].tier).toBe('keyword')

    // Stop words like "the", "of", "and", "for" should not produce false matches
    // Only meaningful words like "critical", "thinking", "logical", "analysis",
    // "decisions", "better" should match
    const result = results.find(r => r.book.id === 'c1')
    expect(result).toBeDefined()
    expect(result!.score).toBeGreaterThan(0)
  })

  // ── Bigram extraction ─────────────────────────────────────────────────────
  it('weights bigram matches higher than unigram matches', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description: 'machine learning and artificial intelligence fundamentals',
    })

    // Candidate with bigram overlap: "machine learning" AND "artificial intelligence"
    const bigramMatch = makeBook({
      id: 'bigram',
      title: 'Bigram Match',
      description: 'machine learning and artificial intelligence in healthcare',
    })

    // Candidate with only unigram overlap
    const unigramMatch = makeBook({
      id: 'unigram',
      title: 'Unigram Match',
      description: 'learning about intelligence systems and machines',
    })

    const results = findSimilarBooks(hero, [bigramMatch, unigramMatch])
    const bigramResult = results.find(r => r.book.id === 'bigram')
    const unigramResult = results.find(r => r.book.id === 'unigram')

    expect(bigramResult).toBeDefined()
    expect(unigramResult).toBeDefined()
    expect(bigramResult!.score).toBeGreaterThan(unigramResult!.score)
  })

  // ── Tier ordering ─────────────────────────────────────────────────────────
  it('ranks same-series books above all other tiers', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      series: 'Great Series',
      seriesSequence: '1',
    })

    const sameSeries = makeBook({
      id: 'series',
      title: 'Series Book 2',
      series: 'Great Series',
      seriesSequence: '2',
    })

    const sameAuthor = makeBook({
      id: 'author',
      title: 'Author Other Book',
      author: hero.author,
    })

    const results = findSimilarBooks(hero, [sameAuthor, sameSeries])
    expect(results[0].tier).toBe('series')
    expect(results[0].book.id).toBe('series')
    expect(results[1].tier).toBe('author')
    expect(results[1].book.id).toBe('author')
  })

  it('ranks same-author books above keyword matches', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      author: 'Jane Doe',
      description: 'understanding cognitive biases in decision making',
    })

    const sameAuthor = makeBook({
      id: 'author',
      title: 'Author Other Book',
      author: 'Jane Doe',
      description: 'completely unrelated topic about cooking',
    })

    const keywordMatch = makeBook({
      id: 'keyword',
      title: 'Keyword Match',
      author: 'Other Author',
      description: 'cognitive biases in everyday decision making',
    })

    const results = findSimilarBooks(hero, [keywordMatch, sameAuthor])
    expect(results[0].tier).toBe('author')
    expect(results[0].book.id).toBe('author')
  })

  it('includes genre-tag matches when no keyword overlap exists', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      genre: 'self-help',
      tags: ['productivity', 'habits'],
      description: '', // no keyword signal
    })

    const genreMatch = makeBook({
      id: 'genre',
      title: 'Genre Match',
      genre: 'self-help',
      tags: ['productivity', 'time-management'],
      description: '',
    })

    const results = findSimilarBooks(hero, [genreMatch])
    expect(results.length).toBeGreaterThanOrEqual(1)
    const result = results.find(r => r.book.id === 'genre')
    expect(result).toBeDefined()
    expect(result!.tier).toBe('genre-tag')
  })

  // ── Deduplication ─────────────────────────────────────────────────────────
  it('deduplicates books across tiers', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      author: 'Test Author',
      series: 'Test Series',
    })

    // Same book appears in both series and author tiers
    const sameBook = makeBook({
      id: 'dup',
      title: 'Dup Book',
      series: 'Test Series',
      author: 'Test Author',
    })

    const results = findSimilarBooks(hero, [sameBook])
    expect(results.length).toBe(1)
    expect(results[0].book.id).toBe('dup')
    expect(results[0].tier).toBe('series') // series has priority
  })

  // ── Empty description handling ────────────────────────────────────────────
  it('handles hero with no description gracefully', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description: undefined,
    })

    const candidate = makeBook({
      id: 'c1',
      title: 'Some Book',
      description: 'some description text',
    })

    // Should not crash, should return empty results or genre-tag matches
    const results = findSimilarBooks(hero, [candidate])
    // No keyword match expected since hero has no description
    expect(Array.isArray(results)).toBe(true)
  })

  it('handles candidate books with no description gracefully', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description: 'cognitive psychology and behavioral science',
    })

    const noDesc = makeBook({
      id: 'no-desc',
      title: 'No Description Book',
      description: undefined,
    })

    const results = findSimilarBooks(hero, [noDesc])
    const result = results.find(r => r.book.id === 'no-desc')
    // Should not crash; may or may not match depending on genre/tags
    expect(Array.isArray(results)).toBe(true)
  })

  // ── 200-candidate boundary ────────────────────────────────────────────────
  it('handles large candidate pools without crashing', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description: 'machine learning and data science fundamentals',
    })

    const candidates: Book[] = []
    for (let i = 0; i < 600; i++) {
      candidates.push(
        makeBook({
          id: `candidate-${i}`,
          title: `Candidate ${i}`,
          description: i < 50
            ? 'machine learning data science artificial intelligence'
            : 'completely unrelated topic about cooking gardening sports',
        })
      )
    }

    const results = findSimilarBooks(hero, candidates)
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(12)
    // The first results should be keyword matches close to the hero's topic
    expect(results[0].tier).toBe('keyword')
  })

  // ── Empty candidates ──────────────────────────────────────────────────────
  it('returns empty array for empty candidate pool', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
    })

    const results = findSimilarBooks(hero, [])
    expect(results).toEqual([])
  })

  // ── Excludes hero book ────────────────────────────────────────────────────
  it('excludes the hero book itself from results', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      series: 'Test Series',
    })

    const results = findSimilarBooks(hero, [hero])
    expect(results.find(r => r.book.id === 'hero')).toBeUndefined()
  })

  // ── Maximum 12 results ────────────────────────────────────────────────────
  it('returns at most 12 results', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Hero Book',
      description: 'test topic keyword for matching',
      tags: ['tag-a', 'tag-b', 'tag-c'],
    })

    const candidates: Book[] = []
    for (let i = 0; i < 30; i++) {
      candidates.push(
        makeBook({
          id: `candidate-${i}`,
          title: `Candidate ${i}`,
          description: 'test topic keyword for matching signal',
          tags: ['tag-a', 'tag-b', 'tag-c'],
        })
      )
    }

    const results = findSimilarBooks(hero, candidates)
    expect(results.length).toBeLessThanOrEqual(12)
  })

  // ── Series ordering by seriesSequence ─────────────────────────────────────
  it('orders same-series books by seriesSequence', () => {
    const hero = makeBook({
      id: 'hero',
      title: 'Book 1',
      series: 'Trilogy',
      seriesSequence: '1',
    })

    const book3 = makeBook({
      id: 'book-3',
      title: 'Book 3',
      series: 'Trilogy',
      seriesSequence: '3',
    })

    const book2 = makeBook({
      id: 'book-2',
      title: 'Book 2',
      series: 'Trilogy',
      seriesSequence: '2',
    })

    const results = findSimilarBooks(hero, [book3, book2])
    expect(results.length).toBe(2)
    expect(results[0].book.id).toBe('book-2')
    expect(results[1].book.id).toBe('book-3')
  })
})
