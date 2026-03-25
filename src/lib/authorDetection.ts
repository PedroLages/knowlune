/**
 * Author detection from course folder names.
 *
 * Provides a pure detection function for extracting author names from
 * folder naming conventions (e.g., "Author Name - Course Title") and
 * a DB match-or-create function for linking detected authors.
 *
 * @module
 */

import { db } from '@/db'

// --- Pure Detection ---

/**
 * Separator patterns to try, in priority order.
 * Each is tried against the folder name; the first match wins.
 */
const SEPARATORS = [' - ', ' — ', ' – '] as const

/**
 * Heuristic: a person's name has 2+ space-separated tokens
 * and consists of letters, periods, hyphens, and apostrophes.
 */
const PERSON_NAME_PATTERN = /^[\p{L}.''-]+(\s+[\p{L}.''-]+)+$/u

/**
 * Attempts to extract an author name from a course folder name.
 *
 * Looks for common separator patterns ("Author - Course Title") and
 * validates that the left-side looks like a person's name (2+ words).
 *
 * @returns Detected author name, or null if no confident match.
 */
export function detectAuthorFromFolderName(folderName: string): string | null {
  if (!folderName) return null

  for (const sep of SEPARATORS) {
    const idx = folderName.indexOf(sep)
    if (idx === -1) continue

    const candidate = folderName.slice(0, idx).trim()
    if (!candidate) continue

    // Validate it looks like a person's name
    if (PERSON_NAME_PATTERN.test(candidate)) {
      return candidate
    }
  }

  return null
}

// --- DB Match / Create ---

/**
 * Looks up an existing author by name (case-insensitive) or creates a new one.
 *
 * @returns The author ID (existing or newly created), or null if authorName is null/empty.
 */
export async function matchOrCreateAuthor(authorName: string | null): Promise<string | null> {
  if (!authorName) return null

  const trimmed = authorName.trim()
  if (!trimmed) return null

  const normalizedInput = trimmed.toLowerCase()

  // Search all authors for case-insensitive match
  const allAuthors = await db.authors.toArray()
  const existing = allAuthors.find(a => a.name.toLowerCase() === normalizedInput)

  if (existing) {
    return existing.id
  }

  // Create new author with slug-based ID
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.authors.add({
    id,
    name: trimmed,
    courseIds: [],
    isPreseeded: false,
    createdAt: now,
    updatedAt: now,
  })

  return id
}
