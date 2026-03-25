/**
 * Author detection from course folder names and photo discovery.
 *
 * Provides:
 * - Pure detection function for extracting author names from folder naming conventions
 * - Photo candidate scoring for discovering author photos in course folders
 * - DB match-or-create function for linking detected authors
 *
 * @module
 */

import { db } from '@/db'
import type { ScannedImage } from '@/lib/courseImport'

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

  return db.transaction('rw', db.authors, async () => {
    // Case-insensitive lookup via indexed query instead of full table scan
    const existing = await db.authors.where('name').equalsIgnoreCase(normalizedInput).first()

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
  })
}

// --- Author Photo Detection ---

/**
 * File name patterns (without extension) that strongly indicate an author photo.
 * Matched case-insensitively against the file's base name.
 */
const EXACT_PHOTO_NAMES = [
  'author',
  'instructor',
  'photo',
  'avatar',
  'profile',
  'headshot',
  'portrait',
  'teacher',
  'presenter',
] as const

/**
 * Directory names that suggest contained images are author-related.
 * Matched case-insensitively against each path segment.
 */
const AUTHOR_DIRECTORIES = ['about', 'instructor', 'author', 'profile', 'bio', 'teacher'] as const

/**
 * Represents a scored photo candidate for ranking.
 */
export interface PhotoCandidate {
  image: ScannedImage
  score: number
}

/**
 * Extracts the base name (without extension) from a filename.
 * E.g., "author.jpg" -> "author", "Profile Photo.png" -> "profile photo"
 */
function getBaseName(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  return base.toLowerCase()
}

/**
 * Extracts directory segments from a file path.
 * E.g., "about/images/photo.jpg" -> ["about", "images"]
 */
function getPathDirectories(path: string): string[] {
  const parts = path.split('/')
  // Remove the filename (last segment)
  return parts.slice(0, -1).map(p => p.toLowerCase())
}

/**
 * Scores a single image as a potential author photo candidate.
 *
 * Scoring system (higher = better match):
 * - 100: Exact name match in root (e.g., "author.jpg", "profile.png")
 * - 90: Exact name match in an author-related directory
 * - 70: Partial name match in an author-related directory
 * - 60: Exact name match in a non-author nested directory
 * - 40: Partial name match (filename contains an author keyword)
 * - 20: File in an author directory but generic name
 * - 0: No match
 */
export function scoreAuthorPhoto(image: ScannedImage): number {
  const baseName = getBaseName(image.filename)
  const dirs = getPathDirectories(image.path)

  const isExactName = EXACT_PHOTO_NAMES.some(name => baseName === name)
  const isPartialName = EXACT_PHOTO_NAMES.some(name => baseName.includes(name) && baseName !== name)
  const isInAuthorDir = dirs.some(dir =>
    AUTHOR_DIRECTORIES.includes(dir as (typeof AUTHOR_DIRECTORIES)[number])
  )

  // Exact name in root or shallow path — strongest signal
  if (isExactName && dirs.length === 0) return 100
  // In an author-related directory with exact name
  if (isExactName && isInAuthorDir) return 90
  // In an author-related directory (any image)
  if (isInAuthorDir && !isExactName && !isPartialName) return 20
  // Exact name but in a non-author nested directory
  if (isExactName) return 60
  // Partial name match (e.g., "author-photo.jpg", "profile_pic.png")
  if (isPartialName && isInAuthorDir) return 70
  if (isPartialName) return 40
  return 0
}

/**
 * Detects the best author photo candidate from a list of scanned images.
 *
 * Strategy:
 * 1. Score each image using filename and directory heuristics
 * 2. Filter to candidates with score > 0
 * 3. Return the highest-scoring candidate (or null if none found)
 *
 * @param images - All images discovered during course folder scan
 * @returns The best photo candidate's ScannedImage, or null if no match
 */
export function detectAuthorPhoto(images: ScannedImage[]): ScannedImage | null {
  if (!images || images.length === 0) return null

  const candidates: PhotoCandidate[] = images
    .map(image => ({ image, score: scoreAuthorPhoto(image) }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)

  return candidates.length > 0 ? candidates[0].image : null
}
