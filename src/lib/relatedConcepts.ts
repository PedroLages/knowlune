/**
 * Related Concepts Finder
 *
 * Hybrid approach: tag-based matching + vector similarity search.
 * Falls back to tag-only matching if vector search unavailable (AC6).
 * Fallback activates within 2 seconds.
 */

import type { Note } from '@/data/types'
import { stripHtml } from '@/lib/textUtils'
import { vectorStorePersistence } from '@/ai/vector-store'
import { db } from '@/db'

/** A related note with context about why it's related */
export interface RelatedNote {
  noteId: string
  /** First line of content or lesson title */
  title: string
  /** Display name of the source course */
  courseName: string
  /** Tags shared with the source note */
  sharedTags: string[]
  /** Key terms shared (for topical overlap display) */
  sharedTerms: string[]
  /** Vector similarity score (0-1), undefined if tag-only */
  similarityScore?: number
  /** Whether this match is tag-only (no AI/vector) */
  tagOnly: boolean
}

/** Common English stopwords to exclude from term extraction */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'but', 'and', 'or', 'if', 'this',
  'that', 'these', 'those', 'it', 'its', 'i', 'we', 'you', 'they',
  'he', 'she', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'about', 'up',
])

/** Minimum word length to consider as a key term */
const MIN_TERM_LENGTH = 3

/** Vector search timeout for fallback (AC6: within 2 seconds) */
const VECTOR_SEARCH_TIMEOUT_MS = 1500

/** Maximum related notes to return */
const MAX_RESULTS = 5

/**
 * Find notes related to the given note using hybrid tag + vector matching.
 *
 * @param note - The source note to find related notes for
 * @param allNotes - All available notes (including from other courses)
 * @param courseNames - Map of courseId → display name
 * @returns Related notes sorted by relevance (max 5)
 */
export async function findRelatedNotes(
  note: Note,
  allNotes: Note[],
  courseNames: Map<string, string>
): Promise<RelatedNote[]> {
  // Exclude the source note and deleted notes
  const candidates = allNotes.filter(n => n.id !== note.id && !n.deleted)

  if (candidates.length === 0) return []

  // Step 1: Tag-based matching (always available, instant)
  const tagMatches = findTagMatches(note, candidates, courseNames)

  // Step 2: Vector similarity (with timeout fallback)
  let vectorMatches: RelatedNote[] = []
  try {
    vectorMatches = await Promise.race([
      findVectorMatches(note, candidates, courseNames),
      new Promise<RelatedNote[]>(resolve =>
        setTimeout(() => resolve([]), VECTOR_SEARCH_TIMEOUT_MS)
      ),
    ])
  } catch {
    // Vector search failed — use tag-only results
    console.warn('[relatedConcepts] Vector search failed, using tag-only results')
  }

  // Step 3: Merge and deduplicate
  return mergeResults(tagMatches, vectorMatches)
}

/**
 * Find notes sharing 1+ tags with the source note.
 */
function findTagMatches(
  note: Note,
  candidates: Note[],
  courseNames: Map<string, string>
): RelatedNote[] {
  if (note.tags.length === 0) return []

  const sourceTagSet = new Set(note.tags)
  const sourceTerms = extractKeyTerms(note.content)

  return candidates
    .map(candidate => {
      const sharedTags = candidate.tags.filter(t => sourceTagSet.has(t))
      if (sharedTags.length === 0) return null

      const candidateTerms = extractKeyTerms(candidate.content)
      const sharedTerms = [...sourceTerms].filter((t: string) => candidateTerms.has(t))

      return {
        noteId: candidate.id,
        title: extractTitle(candidate.content),
        courseName: courseNames.get(candidate.courseId) ?? candidate.courseId,
        sharedTags,
        sharedTerms,
        tagOnly: true,
      } satisfies RelatedNote
    })
    .filter((r): r is RelatedNote => r != null)
    .sort((a, b) => b.sharedTags.length - a.sharedTags.length)
}

/**
 * Find semantically similar notes using vector embeddings.
 */
async function findVectorMatches(
  note: Note,
  candidates: Note[],
  courseNames: Map<string, string>
): Promise<RelatedNote[]> {
  const store = vectorStorePersistence.getStore()
  if (store.size === 0) return []

  // Get the source note's embedding
  const sourceEmbedding = await db.embeddings.get(note.id)
  if (!sourceEmbedding) return []

  // Search for similar vectors (k+1 because source note might be in results)
  const results = store.search(sourceEmbedding.embedding, MAX_RESULTS + 1)

  const candidateIds = new Set(candidates.map(c => c.id))
  const sourceTerms = extractKeyTerms(note.content)
  const sourceTagSet = new Set(note.tags)

  return results
    .filter(r => r.id !== note.id && candidateIds.has(r.id) && r.similarity > 0.3)
    .slice(0, MAX_RESULTS)
    .map(result => {
      const candidate = candidates.find(c => c.id === result.id)
      if (!candidate) return null

      const sharedTags = candidate.tags.filter(t => sourceTagSet.has(t))
      const candidateTerms = extractKeyTerms(candidate.content)
      const sharedTerms = [...sourceTerms].filter((t: string) => candidateTerms.has(t))

      return {
        noteId: candidate.id,
        title: extractTitle(candidate.content),
        courseName: courseNames.get(candidate.courseId) ?? candidate.courseId,
        sharedTags,
        sharedTerms,
        similarityScore: result.similarity,
        tagOnly: false,
      } satisfies RelatedNote
    })
    .filter((r): r is RelatedNote => r != null)
}

/**
 * Merge tag-based and vector-based results, deduplicate, and sort by relevance.
 */
function mergeResults(tagMatches: RelatedNote[], vectorMatches: RelatedNote[]): RelatedNote[] {
  const seen = new Map<string, RelatedNote>()

  // Vector matches get priority (they have similarity scores)
  for (const match of vectorMatches) {
    seen.set(match.noteId, match)
  }

  // Add tag matches not already present, or upgrade tag-only to hybrid
  for (const match of tagMatches) {
    const existing = seen.get(match.noteId)
    if (!existing) {
      seen.set(match.noteId, match)
    } else {
      // Merge: keep vector match but ensure shared tags/terms are complete
      existing.sharedTags = [
        ...new Set([...existing.sharedTags, ...match.sharedTags]),
      ]
      existing.sharedTerms = [
        ...new Set([...existing.sharedTerms, ...match.sharedTerms]),
      ]
    }
  }

  // Sort: vector matches first (by similarity), then tag matches (by tag count)
  return Array.from(seen.values())
    .sort((a, b) => {
      if (a.similarityScore != null && b.similarityScore != null) {
        return b.similarityScore - a.similarityScore
      }
      if (a.similarityScore != null) return -1
      if (b.similarityScore != null) return 1
      return b.sharedTags.length - a.sharedTags.length
    })
    .slice(0, MAX_RESULTS)
}

/**
 * Extract key terms from note content for topical overlap detection.
 * Returns a Set of lowercase terms (stopwords removed, min 3 chars).
 */
function extractKeyTerms(content: string): Set<string> {
  const plain = stripHtml(content).toLowerCase()
  const words = plain.split(/\W+/).filter(
    w => w.length >= MIN_TERM_LENGTH && !STOPWORDS.has(w)
  )
  return new Set(words)
}

/**
 * Extract a title from note content (first line, stripped of HTML, truncated).
 */
function extractTitle(content: string, maxLength = 60): string {
  const plain = stripHtml(content)
  const firstLine = plain.split('\n')[0].trim()
  if (firstLine.length <= maxLength) return firstLine
  return firstLine.slice(0, maxLength).trimEnd() + '\u2026'
}
