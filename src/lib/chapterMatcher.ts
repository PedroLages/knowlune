/**
 * Chapter Title Matching Engine
 *
 * Pure synchronous functions for matching EPUB chapters to audiobook chapters.
 * Uses Jaro-Winkler similarity (primary) with Levenshtein fallback.
 * No dependencies, no async, no side effects.
 *
 * @module chapterMatcher
 * @since E103-S01
 */

import type { ChapterMapping } from '@/data/types'

/** Default confidence threshold — pairs below this are discarded */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7

/** Input shape for EPUB chapters */
export interface EpubChapterInput {
  href: string
  label: string
}

/** Input shape for audio chapters */
export interface AudioChapterInput {
  title: string
}

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalize a chapter title for comparison.
 * - lowercase
 * - strip leading numbers, dots, colons, dashes
 * - collapse whitespace
 * - trim
 */
export function normalizeChapterTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^[\d\s.:\-–]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Jaro-Winkler Similarity ───────────────────────────────────────────────

/**
 * Compute Jaro similarity between two strings.
 * Returns 0–1 where 1 = identical.
 */
function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const matchWindow = Math.max(Math.floor(Math.max(a.length, b.length) / 2) - 1, 0)

  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
}

/**
 * Compute Jaro-Winkler similarity between two strings.
 * Applies a prefix bonus (up to 4 chars) to the Jaro score.
 * Returns 0–1 where 1 = identical.
 */
export function jaroWinklerSimilarity(a: string, b: string): number {
  const jaro = jaroSimilarity(a, b)
  const prefixLen = Math.min(
    4,
    [...a].findIndex((c, i) => c !== b[i]) === -1 ? Math.min(a.length, b.length) : [...a].findIndex((c, i) => c !== b[i])
  )
  const p = 0.1 // standard Winkler scaling factor
  return jaro + prefixLen * p * (1 - jaro)
}

// ─── Levenshtein Similarity ─────────────────────────────────────────────────

/**
 * Compute Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Use single-row optimization
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }

  return prev[b.length]
}

/**
 * Compute normalized Levenshtein similarity (0–1).
 * 1 = identical, 0 = completely different.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

// ─── Matching Engine ────────────────────────────────────────────────────────

/**
 * Compute chapter mapping between EPUB and audio chapters.
 *
 * Algorithm:
 * 1. Normalize all titles
 * 2. For each EPUB chapter, find best audio match via Jaro-Winkler
 * 3. If no JW matches above threshold, retry with Levenshtein
 * 4. Greedy assignment: each audio chapter matched at most once
 * 5. Only pairs above threshold are returned
 *
 * @returns Array of matches sorted by EPUB chapter order
 */
export function computeChapterMapping(
  epubChapters: EpubChapterInput[],
  audioChapters: AudioChapterInput[],
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): ChapterMapping[] {
  if (epubChapters.length === 0 || audioChapters.length === 0) return []

  const normalizedEpub = epubChapters.map(c => normalizeChapterTitle(c.label))
  const normalizedAudio = audioChapters.map(c => normalizeChapterTitle(c.title))

  const usedAudioIndexes = new Set<number>()
  const mappings: ChapterMapping[] = []

  // Pass 1: Jaro-Winkler
  for (let ei = 0; ei < normalizedEpub.length; ei++) {
    let bestScore = -1
    let bestAi = -1

    for (let ai = 0; ai < normalizedAudio.length; ai++) {
      if (usedAudioIndexes.has(ai)) continue
      const score = jaroWinklerSimilarity(normalizedEpub[ei], normalizedAudio[ai])
      if (score > bestScore) {
        bestScore = score
        bestAi = ai
      }
    }

    if (bestScore >= threshold && bestAi >= 0) {
      usedAudioIndexes.add(bestAi)
      mappings.push({
        epubChapterHref: epubChapters[ei].href,
        audioChapterIndex: bestAi,
        confidence: bestScore,
      })
    }
  }

  // Pass 2: Levenshtein fallback for unmatched EPUB chapters
  const matchedEpubHrefs = new Set(mappings.map(m => m.epubChapterHref))

  for (let ei = 0; ei < normalizedEpub.length; ei++) {
    if (matchedEpubHrefs.has(epubChapters[ei].href)) continue

    let bestScore = -1
    let bestAi = -1

    for (let ai = 0; ai < normalizedAudio.length; ai++) {
      if (usedAudioIndexes.has(ai)) continue
      const score = levenshteinSimilarity(normalizedEpub[ei], normalizedAudio[ai])
      if (score > bestScore) {
        bestScore = score
        bestAi = ai
      }
    }

    if (bestScore >= threshold && bestAi >= 0) {
      usedAudioIndexes.add(bestAi)
      mappings.push({
        epubChapterHref: epubChapters[ei].href,
        audioChapterIndex: bestAi,
        confidence: bestScore,
      })
    }
  }

  // Sort by EPUB chapter order (original index)
  const hrefOrder = new Map(epubChapters.map((c, i) => [c.href, i]))
  mappings.sort((a, b) => (hrefOrder.get(a.epubChapterHref) ?? 0) - (hrefOrder.get(b.epubChapterHref) ?? 0))

  return mappings
}
