/**
 * Interleaved Review — greedy algorithm to maximize topic variety.
 *
 * Produces a review sequence that spreads topics apart while prioritising
 * notes with low predicted retention.
 *
 * Weights:
 *   60 % — time urgency  (lower retention → higher urgency)
 *   40 % — topic dissimilarity (Jaccard distance from last-selected note)
 */
import type { ReviewRecord, Note } from '@/data/types'
import { predictRetention } from '@/lib/spacedRepetition'

const URGENCY_WEIGHT = 0.6
const DISSIMILARITY_WEIGHT = 0.4

/**
 * Jaccard similarity of two tag arrays.
 * Returns 0 when either array is empty (no shared context → treat as dissimilar).
 */
export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0

  const setA = new Set(tagsA)
  const setB = new Set(tagsB)

  let intersection = 0
  for (const tag of setA) {
    if (setB.has(tag)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Build an interleaved sequence of due reviews.
 *
 * Greedy: pick the highest-scored remaining note, then re-score the rest
 * based on dissimilarity to the note just picked.  O(n²) — fine for
 * typical queue sizes (10-50 notes).
 */
export function interleaveReviews(
  dueReviews: ReviewRecord[],
  noteMap: Map<string, Note>,
  now: Date
): ReviewRecord[] {
  if (dueReviews.length <= 1) return [...dueReviews]

  // Pre-compute retention scores (0-100, lower = more urgent)
  const retentionMap = new Map<string, number>()
  for (const r of dueReviews) {
    retentionMap.set(r.id, predictRetention(r, now))
  }

  // Normalise retention to 0-1 urgency (invert: 0% retention → urgency 1.0)
  const maxRetention = 100
  const urgencyOf = (id: string) => 1 - (retentionMap.get(id) ?? 0) / maxRetention

  const remaining = new Set(dueReviews.map(r => r.id))
  const reviewById = new Map(dueReviews.map(r => [r.id, r]))
  const result: ReviewRecord[] = []
  let lastTags: string[] = []

  while (remaining.size > 0) {
    let bestId: string | null = null
    let bestScore = -Infinity

    for (const id of remaining) {
      const record = reviewById.get(id)!
      const note = noteMap.get(record.noteId)
      const tags = note?.tags ?? []

      const urgency = urgencyOf(id)
      const dissimilarity = 1 - jaccardSimilarity(tags, lastTags)
      const score = URGENCY_WEIGHT * urgency + DISSIMILARITY_WEIGHT * dissimilarity

      if (score > bestScore) {
        bestScore = score
        bestId = id
      }
    }

    if (!bestId) break

    const picked = reviewById.get(bestId)!
    result.push(picked)
    remaining.delete(bestId)

    const pickedNote = noteMap.get(picked.noteId)
    lastTags = pickedNote?.tags ?? []
  }

  return result
}
