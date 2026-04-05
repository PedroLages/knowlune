/**
 * Lesson-Material Matcher
 *
 * Pure functions that associate companion PDFs with their parent videos
 * based on filename analysis. Used by CourseAdapter.getGroupedLessons()
 * to produce structured lesson groups for the sidebar and Materials tab.
 *
 * Matching tiers (tried in order):
 *   1. Exact stem — identical normalized filename (sans extension)
 *   2. Same full prefix + similarity ≥50% LCS
 *   3. Same full prefix, single video at that prefix
 *   4. Same section prefix + similarity ≥50% (e.g. PDF "01-X" → video "01-01-Y")
 *   5. Same section prefix, single video at that section
 */

import type { LessonItem } from './courseAdapter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaterialGroup {
  primary: LessonItem
  materials: LessonItem[]
}

export interface FilenameComponents {
  /** Full numeric prefix, e.g. "01", "01-01". null if none. */
  numericPrefix: string | null
  /** First numeric segment only, e.g. "01" from "01-01". Used for section-level matching. */
  sectionPrefix: string | null
  /** Normalized stem: lowercase, stripped extension, punctuation → spaces */
  stem: string
  /** Original filename for display */
  originalFilename: string
}

// ---------------------------------------------------------------------------
// Filename parsing
// ---------------------------------------------------------------------------

const EXTENSION_RE = /\.[a-zA-Z0-9]{2,4}$/

/**
 * Parse a filename into its numeric prefix and normalized stem.
 *
 * Examples:
 *   "01-FNL Replay - Drones Psyops.mp4"  → prefix "01", stem "fnl replay drones psyops"
 *   "01-01 A Behavior Profiler.pdf"       → prefix "01-01", stem "a behavior profiler"
 *   "Resources.pdf"                       → prefix null, stem "resources"
 */
export function parseFilenameComponents(filename: string): FilenameComponents {
  // Strip file extension
  const stripped = filename.replace(EXTENSION_RE, '')

  // Extract numeric prefix: handles "01-01", "01", "1." patterns
  const prefixMatch = stripped.match(/^(\d+(?:[-_.]\d+)*)/)
  const numericPrefix = prefixMatch ? prefixMatch[1] : null

  // Section prefix: first numeric segment only (e.g. "01" from "01-01")
  // Used for fallback matching when PDFs use "01-Title" but videos use "01-01- Title"
  const sectionPrefix = numericPrefix ? numericPrefix.split(/[-_.]/)[0] : null

  // Get the remainder after the prefix
  const remainder = numericPrefix ? stripped.slice(numericPrefix.length) : stripped

  // Normalize: lowercase, replace separators with spaces, collapse whitespace
  const stem = remainder
    .toLowerCase()
    .replace(/[-_.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { numericPrefix, sectionPrefix, stem, originalFilename: filename }
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

/**
 * Longest common subsequence length between two strings.
 * Used for fuzzy matching between video and PDF stems.
 */
export function lcsLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0

  // Space-optimized DP (two rows)
  const m = a.length
  const n = b.length
  let prev = new Array<number>(n + 1).fill(0)
  let curr = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1])
      }
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }

  return prev[n]
}

/** Similarity ratio: LCS length / max string length. Returns 0-1. */
export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  return lcsLength(a, b) / Math.max(a.length, b.length)
}

// ---------------------------------------------------------------------------
// Matching algorithm
// ---------------------------------------------------------------------------

const SIMILARITY_THRESHOLD = 0.5

/**
 * Match companion PDFs to their parent videos using tiered filename analysis.
 *
 * Returns a list of MaterialGroup objects where each video (or standalone PDF)
 * is a primary lesson with zero or more companion materials.
 */
export function matchMaterialsToLessons(videos: LessonItem[], pdfs: LessonItem[]): MaterialGroup[] {
  if (pdfs.length === 0) {
    return videos.map(v => ({ primary: v, materials: [] }))
  }

  const videoParsed = videos.map(v => ({
    item: v,
    components: parseFilenameComponents(v.title),
  }))
  const pdfParsed = pdfs.map(p => ({
    item: p,
    components: parseFilenameComponents(p.title),
  }))

  // Track which PDFs have been matched
  const matchedPdfIds = new Set<string>()
  // Map from video ID to matched PDFs
  const videoMaterials = new Map<string, LessonItem[]>()

  for (const vp of videoParsed) {
    videoMaterials.set(vp.item.id, [])
  }

  // --- Tier 1: Exact stem match ---
  for (const pp of pdfParsed) {
    if (matchedPdfIds.has(pp.item.id)) continue

    for (const vp of videoParsed) {
      if (pp.components.stem.length > 0 && pp.components.stem === vp.components.stem) {
        videoMaterials.get(vp.item.id)!.push(pp.item)
        matchedPdfIds.add(pp.item.id)
        break
      }
    }
  }

  // --- Tier 2: Same prefix + similarity ≥ 50% ---
  for (const pp of pdfParsed) {
    if (matchedPdfIds.has(pp.item.id)) continue
    if (!pp.components.numericPrefix) continue

    let bestMatch: { videoId: string; score: number } | null = null

    for (const vp of videoParsed) {
      if (vp.components.numericPrefix !== pp.components.numericPrefix) continue

      const score = similarity(pp.components.stem, vp.components.stem)
      if (score >= SIMILARITY_THRESHOLD) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { videoId: vp.item.id, score }
        }
      }
    }

    if (bestMatch) {
      videoMaterials.get(bestMatch.videoId)!.push(pp.item)
      matchedPdfIds.add(pp.item.id)
    }
  }

  // --- Tier 3: Same prefix, single video at that prefix ---
  for (const pp of pdfParsed) {
    if (matchedPdfIds.has(pp.item.id)) continue
    if (!pp.components.numericPrefix) continue

    const videosAtPrefix = videoParsed.filter(
      vp => vp.components.numericPrefix === pp.components.numericPrefix
    )

    if (videosAtPrefix.length === 1) {
      videoMaterials.get(videosAtPrefix[0].item.id)!.push(pp.item)
      matchedPdfIds.add(pp.item.id)
    }
  }

  // --- Tier 4: Same SECTION prefix + similarity ≥ 50% ---
  // Handles cases like PDF "01-Flight_Manual.pdf" (section "01") matching
  // video "01-01- Communication Laws.mp4" (section "01") when full prefixes differ.
  for (const pp of pdfParsed) {
    if (matchedPdfIds.has(pp.item.id)) continue
    if (!pp.components.sectionPrefix) continue

    let bestMatch: { videoId: string; score: number } | null = null

    for (const vp of videoParsed) {
      if (vp.components.sectionPrefix !== pp.components.sectionPrefix) continue

      const score = similarity(pp.components.stem, vp.components.stem)
      if (score >= SIMILARITY_THRESHOLD) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { videoId: vp.item.id, score }
        }
      }
    }

    if (bestMatch) {
      videoMaterials.get(bestMatch.videoId)!.push(pp.item)
      matchedPdfIds.add(pp.item.id)
    }
  }

  // --- Tier 5: Same SECTION prefix, single video at that section ---
  // Last resort: if a PDF's section matches exactly one video's section, group them.
  for (const pp of pdfParsed) {
    if (matchedPdfIds.has(pp.item.id)) continue
    if (!pp.components.sectionPrefix) continue

    const videosAtSection = videoParsed.filter(
      vp => vp.components.sectionPrefix === pp.components.sectionPrefix
    )

    if (videosAtSection.length === 1) {
      videoMaterials.get(videosAtSection[0].item.id)!.push(pp.item)
      matchedPdfIds.add(pp.item.id)
    }
  }

  // --- Build result ---
  // Video groups (sorted by video order)
  const groups: MaterialGroup[] = videoParsed
    .map(vp => ({
      primary: vp.item,
      materials: videoMaterials.get(vp.item.id)!.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.primary.order - b.primary.order)

  // Unmatched PDFs become standalone groups
  const unmatchedPdfs = pdfParsed
    .filter(pp => !matchedPdfIds.has(pp.item.id))
    .map(pp => ({ primary: pp.item, materials: [] as LessonItem[] }))
    .sort((a, b) => a.primary.order - b.primary.order)

  // Merge video groups and standalone PDFs by order
  return mergeByOrder(groups, unmatchedPdfs)
}

/**
 * Merge two sorted-by-order arrays into one sorted array.
 */
function mergeByOrder(a: MaterialGroup[], b: MaterialGroup[]): MaterialGroup[] {
  const result: MaterialGroup[] = []
  let i = 0
  let j = 0

  while (i < a.length && j < b.length) {
    if (a[i].primary.order <= b[j].primary.order) {
      result.push(a[i++])
    } else {
      result.push(b[j++])
    }
  }

  while (i < a.length) result.push(a[i++])
  while (j < b.length) result.push(b[j++])

  return result
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Find companion materials for a specific lesson within pre-computed groups.
 */
export function getCompanionMaterials(lessonId: string, groups: MaterialGroup[]): LessonItem[] {
  const group = groups.find(g => g.primary.id === lessonId)
  return group?.materials ?? []
}

/**
 * Get the set of all companion PDF IDs (for filtering them out of flat lists).
 */
export function getCompanionPdfIds(groups: MaterialGroup[]): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const mat of group.materials) {
      ids.add(mat.id)
    }
  }
  return ids
}
