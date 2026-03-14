import type { Note } from '@/data/types'
import type { NoteLinkSuggestion } from './types'

const DISMISSED_KEY = 'dismissed-note-links'

/** Common English stopwords to exclude from key-term matching */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'can',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'i',
  'my',
  'me',
  'we',
  'our',
  'you',
  'your',
  'they',
  'their',
  'them',
  'not',
  'no',
  'so',
  'if',
  'as',
  'up',
  'out',
  'also',
])

function extractKeyTerms(content: string): Set<string> {
  return new Set(
    content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w))
  )
}

function dismissedPairKey(id1: string, id2: string): string {
  // Always sort so "a:b" and "b:a" produce the same key
  return [id1, id2].sort().join(':')
}

function getDismissedPairs(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

/** Persist a dismissed pair to localStorage */
export function dismissNoteLinkPair(sourceId: string, targetId: string): void {
  try {
    const pairs = getDismissedPairs()
    pairs.add(dismissedPairKey(sourceId, targetId))
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...pairs]))
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Find cross-course note link suggestions for a newly saved note.
 *
 * Returns candidates from other courses that share 2+ tags or 2+ key terms
 * with the saved note, excluding previously dismissed pairs.
 *
 * @param savedNote - The note that was just saved
 * @param allNotes  - All notes currently loaded (from the note store)
 * @param courseMap - Map of courseId → course name for display
 */
export function findNoteLinkSuggestions(
  savedNote: Note,
  allNotes: Note[],
  courseMap: Map<string, string>
): NoteLinkSuggestion[] {
  const dismissed = getDismissedPairs()
  const savedTerms = extractKeyTerms(savedNote.content)
  const savedTags = new Set(savedNote.tags.map(t => t.toLowerCase()))

  const suggestions: NoteLinkSuggestion[] = []

  for (const candidate of allNotes) {
    // Only cross-course suggestions
    if (candidate.courseId === savedNote.courseId) continue
    if (candidate.id === savedNote.id) continue
    if (candidate.deleted) continue

    // Skip dismissed pairs
    if (dismissed.has(dismissedPairKey(savedNote.id, candidate.id))) continue

    const candidateTags = new Set(candidate.tags.map(t => t.toLowerCase()))
    const sharedTags = [...savedTags].filter(t => candidateTags.has(t))

    const candidateTerms = extractKeyTerms(candidate.content)
    const sharedTerms = [...savedTerms].filter(t => candidateTerms.has(t))

    if (sharedTags.length >= 2 || sharedTerms.length >= 2) {
      suggestions.push({
        sourceNoteId: savedNote.id,
        targetNoteId: candidate.id,
        targetCourseId: candidate.courseId,
        targetCourseTitle: courseMap.get(candidate.courseId) ?? candidate.courseId,
        sharedTags,
        previewContent: candidate.content.slice(0, 100),
      })
    }
  }

  return suggestions
}
