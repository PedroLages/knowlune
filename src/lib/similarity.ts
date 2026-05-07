/**
 * Keyword-based book similarity algorithm.
 *
 * Finds similar books using a five-tier strategy:
 * 1. Same series (highest priority, ordered by seriesSequence)
 * 2. Same author (excluding the hero book itself)
 * 3. Description keyword overlap (bigram-weighted with stop-word removal)
 * 4. Same genre + tag overlap (supplemental for books without descriptions)
 * 5. Deduplication across tiers, top 12 results
 *
 * This is a standalone, well-tested utility designed for future replacement
 * or deferral to a dedicated similarity service.
 *
 * @since book-detail-page (2026-05-07)
 */

import type { Book } from '@/data/types'
import { stripHtml } from '@/lib/textUtils'

// ─── Stop Words ───────────────────────────────────────────────────────────────

/** Common English stop words removed during keyword extraction. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'by', 'with', 'from', 'up', 'about', 'into', 'over', 'after',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'need', 'dare', 'ought', 'used',
  'it', 'its', 'that', 'those', 'this', 'these', 'i', 'you', 'he', 'she',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'not', 'no', 'nor', 'neither', 'never', 'none', 'nothing',
  'so', 'very', 'too', 'quite', 'rather', 'some', 'any', 'each', 'every',
  'all', 'both', 'few', 'more', 'most', 'other', 'such', 'only', 'own',
  'same', 'as', 'than', 'then', 'just', 'also', 'well', 'even', 'still',
  'already', 'yet', 'because', 'since', 'while', 'if', 'when', 'where',
  'how', 'what', 'which', 'who', 'whom', 'why', 'whether',
  'here', 'there', 'now', 'then', 'again', 'further', 'once',
])

/** Minimum word length to consider as a unigram keyword. */
const MIN_UNIGRAM_LENGTH = 3

/** Weight multiplier for bigram matches (more specific thematic signal). */
const BIGRAM_WEIGHT = 2

/** Maximum candidates to return. */
const MAX_RESULTS = 12

/** Performance boundary: limit the scoring pool to this many candidates. */
const MAX_SCORING_POOL = 500

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface SimilarBook {
  book: Book
  tier: 'series' | 'author' | 'keyword' | 'genre-tag'
  score: number
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/** Split text into lowercase words, filtering punctuation and short tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= MIN_UNIGRAM_LENGTH && !STOP_WORDS.has(t))
}

/** Extract bigrams from an array of tokens. */
function extractBigrams(tokens: string[]): string[] {
  const bigrams: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`)
  }
  return bigrams
}

/** Build a keyword signature from text: unigrams + weighted bigrams. */
function buildSignature(description: string): { unigrams: Set<string>; bigrams: Set<string> } {
  const tokens = tokenize(description)
  const bigrams = extractBigrams(tokens)
  return {
    unigrams: new Set(tokens),
    bigrams: new Set(bigrams),
  }
}

/** Score a candidate book's description against the hero's keyword signature. */
function scoreByKeywords(
  heroSignature: { unigrams: Set<string>; bigrams: Set<string> },
  candidateDescription: string | undefined
): number {
  if (!candidateDescription) return 0

  const candTokens = tokenize(stripHtml(candidateDescription))
  const candBigrams = extractBigrams(candTokens)
  const candUnigrams = new Set(candTokens)

  let score = 0

  // Unigram matches
  for (const word of heroSignature.unigrams) {
    if (candUnigrams.has(word)) score += 1
  }

  // Bigram matches (higher weight)
  for (const bigram of heroSignature.bigrams) {
    if (candBigrams.includes(bigram)) score += BIGRAM_WEIGHT
  }

  return score
}

/** Score by genre and tag overlap. */
function scoreByGenreAndTags(hero: Book, candidate: Book): number {
  let score = 0

  // Genre match: strong signal
  if (hero.genre && candidate.genre && hero.genre === candidate.genre) {
    score += 5
  }

  // Tag overlap
  const heroTags = new Set(hero.tags.map(t => t.toLowerCase()))
  for (const tag of candidate.tags) {
    if (heroTags.has(tag.toLowerCase())) {
      score += 2
    }
  }

  return score
}

// ─── Main Algorithm ───────────────────────────────────────────────────────────

/**
 * Find books similar to the given hero book.
 *
 * Uses a five-tier approach:
 * 1. Same series books (ordered by seriesSequence)
 * 2. Same author books
 * 3. Description keyword overlap (bigram-weighted)
 * 4. Genre + tag overlap (supplemental)
 * 5. Deduplication across tiers, top 12
 *
 * @param hero - The reference book to find similar books for.
 * @param candidates - The pool of candidate books (typically from Dexie).
 * @returns Array of similar books with their match tier and score, sorted by relevance.
 */
export function findSimilarBooks(hero: Book, candidates: Book[]): SimilarBook[] {
  const results: SimilarBook[] = []
  const seenIds = new Set<string>([hero.id])

  // Pre-compute hero keyword signature
  const heroSignature = hero.description
    ? buildSignature(stripHtml(hero.description))
    : { unigrams: new Set<string>(), bigrams: new Set<string>() }

  // ── Tier 1: Same series ────────────────────────────────────────────────
  if (hero.series) {
    const seriesBooks = candidates
      .filter(b => b.series === hero.series && b.id !== hero.id)
      .sort((a, b) => {
        // Sort by seriesSequence numerically if possible
        const seqA = a.seriesSequence ? parseFloat(a.seriesSequence) : NaN
        const seqB = b.seriesSequence ? parseFloat(b.seriesSequence) : NaN
        if (!Number.isNaN(seqA) && !Number.isNaN(seqB)) return seqA - seqB
        if (!Number.isNaN(seqA)) return -1
        if (!Number.isNaN(seqB)) return 1
        return a.title.localeCompare(b.title)
      })

    for (const book of seriesBooks) {
      if (seenIds.has(book.id)) continue
      seenIds.add(book.id)
      results.push({ book, tier: 'series', score: 100 })
      if (results.length >= MAX_RESULTS) return results
    }
  }

  // ── Tier 2: Same author ─────────────────────────────────────────────────
  if (hero.author) {
    const authorBooks = candidates.filter(
      b => b.author === hero.author && !seenIds.has(b.id)
    )

    for (const book of authorBooks) {
      seenIds.add(book.id)
      results.push({ book, tier: 'author', score: 50 })
      if (results.length >= MAX_RESULTS) return results
    }
  }

  // ── Tier 3: Keyword overlap ─────────────────────────────────────────────
  if (heroSignature.unigrams.size > 0) {
    // Limit the scoring pool for performance
    const pool = candidates.filter(b => !seenIds.has(b.id)).slice(0, MAX_SCORING_POOL)
    const scored = pool
      .map(book => ({
        book,
        score: scoreByKeywords(heroSignature, book.description),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    for (const entry of scored) {
      if (seenIds.has(entry.book.id)) continue
      seenIds.add(entry.book.id)
      results.push({ book: entry.book, tier: 'keyword', score: entry.score })
      if (results.length >= MAX_RESULTS) return results
    }
  }

  // ── Tier 4: Genre + tag overlap (supplemental) ──────────────────────────
  const genreTagPool = candidates
    .filter(b => !seenIds.has(b.id))
    .slice(0, MAX_SCORING_POOL)

  const genreTagScored = genreTagPool
    .map(book => ({
      book,
      score: scoreByGenreAndTags(hero, book),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  for (const entry of genreTagScored) {
    seenIds.add(entry.book.id)
    results.push({ book: entry.book, tier: 'genre-tag', score: entry.score })
    if (results.length >= MAX_RESULTS) return results
  }

  return results
}
