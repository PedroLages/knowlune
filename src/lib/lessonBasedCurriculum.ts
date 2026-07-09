/**
 * Lesson-based curriculum grouping engine (E??-S??)
 *
 * Replaces flat file grouping (groupByFolder) with lesson-based grouping that:
 * 1. Extracts numeric prefixes from filenames
 * 2. Groups files by numeric prefix
 * 3. Identifies the main lesson (video-first priority)
 * 4. Attaches supporting files as materials
 * 5. Produces clean lesson titles (no raw filenames)
 *
 * Architecture:
 *   Course
 *     Section
 *       LessonGroup (one per numeric prefix)
 *         primary: LessonItem (main content)
 *         materials: LessonItem[] (attached PDFs, TXTs, cheat sheets, etc.)
 *
 * This produces a clean course outline like top learning platforms,
 * not a raw file browser.
 */

import type { ImportedVideo, ImportedPdf, YouTubeCourseChapter } from '@/data/types'
import { sortImportedVideosForCurriculum } from '@/lib/sortImportedVideosForCurriculum'
import { isMaterialFilename } from '@/lib/lessonMaterialMatcher'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A lesson within a section — always lesson-based, never a raw file. */
export interface LessonGroup {
  /** Numeric prefix (e.g. "002") for ordering */
  numericPrefix: string
  /** Main content: video, reading (PDF/TXT), quiz, or assignment */
  primary: LessonGroupItem
  /** Supporting materials: companion PDFs, TXT notes, cheat sheets, slides, transcripts */
  materials: LessonGroupItem[]
}

/** An item within a lesson group (primary or material). */
export interface LessonGroupItem {
  id: string
  title: string
  /** Clean display title (number prefix stripped, human-readable) */
  displayTitle: string
  type: 'video' | 'pdf' | 'text' | 'quiz' | 'assignment' | 'material'
  /** Duration in seconds (videos only) */
  duration?: number
  /** Page count (PDFs only) */
  pageCount?: number
  /** Original filename (for file handle lookup) */
  filename: string
  /** Original file path (for folder/section grouping) */
  path: string
  /** Whether this is the main content of its lesson group */
  isPrimary: boolean
  /** Source item reference */
  sourceMetadata?: Record<string, unknown>
}

/** A section within a course (derived from folder paths or YouTube chapters). */
export interface CourseSection {
  /** Section number (e.g. 1 for folder "01-Getting Started") */
  numericPrefix: string
  /** Clean section title */
  title: string
  /** Lesson groups within this section, sorted by numeric prefix */
  lessons: LessonGroup[]
}

// ---------------------------------------------------------------------------
// Filename parsing
// ---------------------------------------------------------------------------

const EXTENSION_RE = /\.[a-zA-Z0-9]{2,4}$/

/**
 * Parse a filename into its numeric prefix and clean stem.
 *
 * Examples:
 *   "001 The Linux Directory Structure.mp4"  → prefix "001", stem "The Linux Directory Structure"
 *   "002 Welcome-to-Shell-Text.txt"           → prefix "002", stem "Welcome to Shell Text"
 *   "011 vi-cheat-sheet.pdf"                  → prefix "011", stem "vi cheat sheet"
 *   "Resources.pdf"                           → prefix null, stem "Resources"
 */
export function parseNumericPrefix(filename: string): {
  prefix: string | null
  stem: string
} {
  const stripped = filename.replace(EXTENSION_RE, '')
  const match = stripped.match(/^(\d+(?:[-_.]\d+)*)/)
  const prefix = match ? match[1] : null
  const remainder = prefix ? stripped.slice(prefix.length) : stripped

  // Normalize stem for matching: lowercase, replace separators with spaces
  const stem = remainder
    .toLowerCase()
    .replace(/^[-_.\s]+/, '')
    .replace(/[-_.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { prefix, stem }
}

/**
 * Convert a raw filename into a clean display title.
 *
 * Examples:
 *   "002 Welcome-to-Shell-Text.txt"  → "Welcome to Shell"
 *   "001 The Linux Directory Structure.mp4" → "The Linux Directory Structure"
 *   "011 vi-cheat-sheet.pdf"         → "vi cheat sheet"
 */
export function cleanLessonTitle(filename: string): string {
  const { prefix, stem } = parseNumericPrefix(filename)

  // Remove trailing keywords that indicate material files (case-insensitive).
  // Patterns account for both original separators (hyphens/underscores/dots)
  // and space-normalized stems from parseNumericPrefix.
  const cleaned = stem
    .replace(/\b(text|cheat[\s\-_.]?sheet|slides?|transcript|notes?|handouts?|handout|worksheets?|worksheet|resources?|supplement|extra|bonus|download)$/i, '')
    .trim()

  // If cleaning removed everything, use the stem as-is
  if (!cleaned) {
    return stem
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim()
  }

  // Title case the result
  return cleaned
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/**
 * Detect content type from filename extension.
 */
function detectContentType(filename: string): 'video' | 'pdf' | 'text' | 'material' {
  const lower = filename.toLowerCase()
  if (/\.(mp4|mkv|webm|mov|avi|m4v)$/.test(lower)) return 'video'
  if (/\.pdf$/.test(lower)) return 'pdf'
  if (/\.(txt|md|markdown)$/.test(lower)) return 'text'
  return 'material'
}

/** Known video extensions for main content detection. */
export const VIDEO_EXTENSIONS = /\.(mp4|mkv|webm|mov|avi|m4v)$/i

/** Known document extensions for reading-type main content. */
export const DOCUMENT_EXTENSIONS = /\.(pdf|txt|md|markdown)$/i

// ---------------------------------------------------------------------------
// Main grouping logic
// ---------------------------------------------------------------------------

/**
 * Build lesson-based grouped curriculum from flat video and PDF lists.
 *
 * Algorithm:
 * 1. Parse numeric prefix from every file
 * 2. Group all files by numeric prefix
 * 3. For each group:
 *    a. Identify the main lesson (video > reading/text/PDF > quiz)
 *    b. Everything else becomes materials
 *    c. Generate clean lesson title from the main content's filename
 * 4. Group lessons into sections by folder path
 * 5. Sort everything by numeric prefix
 */

export function buildLessonBasedCurriculum(opts: {
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  chapters: YouTubeCourseChapter[]
  preferChapterGrouping: boolean
}): CourseSection[] {
  const { videos, pdfs, chapters, preferChapterGrouping } = opts

  // If YouTube chapters are available and preferred, use chapter grouping
  if (preferChapterGrouping && chapters.length > 0) {
    return buildYouTubeSections(videos, chapters)
  }

    // Collect items into section-scoped prefix maps.
    // Outer key: section path (e.g. "01 - Overview")
    // Inner key: numeric prefix (e.g. "001")
    // This prevents prefix collisions across sections.
    const sectionBuckets = new Map()
  
    function getSectionMap(sectionKey) {
      if (!sectionBuckets.has(sectionKey)) {
        sectionBuckets.set(sectionKey, new Map())
      }
      return sectionBuckets.get(sectionKey)
    }
  
    function getBuilder(sectionKey, prefix, fallbackPath) {
      const sectionMap = getSectionMap(sectionKey)
      if (!sectionMap.has(prefix)) {
        sectionMap.set(prefix, { prefix, video: null, pdfs: [], txts: [], other: [], path: fallbackPath })
      }
      return sectionMap.get(prefix)
    }
  
    // Process videos into section-scoped builders
    for (const video of videos) {
      const { prefix } = parseNumericPrefix(video.filename)
      if (!prefix) continue
  
      const sectionKey = getSectionName(video.path) || ''
      const builder = getBuilder(sectionKey, prefix, video.path)
  
      if (!builder.video) {
        builder.video = { ...video, isMaterial: false }
      } else {
        // Additional video at same prefix — keep primary, push extra as material
        builder.other.push(createItemFromVideo(video, true))
      }
  
      if (video.path.length < builder.path.length) {
        builder.path = video.path
      }
    }
  
    // Process PDFs into section-scoped builders
    for (const pdf of pdfs) {
      const { prefix } = parseNumericPrefix(pdf.filename)
      if (!prefix) continue
  
      const sectionKey = getSectionName(pdf.path) || ''
      const builder = getBuilder(sectionKey, prefix, pdf.path)
  
      const contentType = detectContentType(pdf.filename)
      const isMaterial = isMaterialFilename(pdf.filename)
      const item = createItemFromPdf(pdf, isMaterial, contentType)
  
      switch (contentType) {
        case 'pdf':
          if (isMaterial) {
            builder.pdfs.push(item)
          } else {
            if (!builder.video) {
              builder.pdfs.unshift({ ...item, isPrimaryCandidate: true })
            } else {
              builder.pdfs.push(item)
            }
          }
          break
        case 'text':
          if (isMaterial) {
            builder.txts.push(item)
          } else {
            if (!builder.video) {
              builder.txts.unshift({ ...item, isPrimaryCandidate: true })
            } else {
              builder.txts.push(item)
            }
          }
          break
        default:
          builder.other.push(item)
          break
      }
  
      if (pdf.path.length < builder.path.length) {
        builder.path = pdf.path
      }
    }
  
    // Build sections: resolve lesson groups within each section bucket
    const sections = []
  
    for (const [sectionPath, prefixMap] of sectionBuckets) {
      const sectionGroups = []
  
      for (const [, builder] of prefixMap) {
        const group = resolveLessonGroup(builder)
        if (group) sectionGroups.push(group)
      }
  
      sectionGroups.sort((a, b) =>
        a.numericPrefix.localeCompare(b.numericPrefix, undefined, { numeric: true })
      )
  
      if (sectionGroups.length > 0) {
        sections.push({
          numericPrefix: parseSectionPrefix(sectionPath),
          title: cleanSectionTitle(sectionPath),
          lessons: sectionGroups,
        })
      }
    }
  
    sections.sort((a, b) =>
      a.numericPrefix.localeCompare(b.numericPrefix, undefined, { numeric: true })
    )
  
    return sections
}

// ---------------------------------------------------------------------------
// Internal types for builder
// ---------------------------------------------------------------------------

interface LessonGroupBuilder {
  prefix: string
  video: (ImportedVideo & { isMaterial: boolean }) | null
  pdfs: LessonGroupItemBuilder[]
  txts: LessonGroupItemBuilder[]
  other: LessonGroupItemBuilder[]
  path: string
}

interface LessonGroupItemBuilder {
  id: string
  title: string
  displayTitle: string
  type: 'video' | 'pdf' | 'text' | 'quiz' | 'assignment' | 'material'
  duration?: number
  pageCount?: number
  filename: string
  path: string
  isMaterial: boolean
  isPrimaryCandidate?: boolean
  sourceMetadata?: Record<string, unknown>
}

function createItemFromVideo(
  video: ImportedVideo,
  isMaterial: boolean
): LessonGroupItemBuilder {
  return {
    id: video.id,
    title: video.filename.replace(EXTENSION_RE, ''),
    displayTitle: cleanLessonTitle(video.filename),
    type: 'video',
    duration: video.duration,
    filename: video.filename,
    path: video.path,
    isMaterial,
    sourceMetadata: {
      path: video.path,
      format: video.format,
      fileSize: video.fileSize,
      width: video.width,
      height: video.height,
      thumbnailUrl: video.thumbnailUrl,
      description: video.description,
      chapters: video.chapters,
      youtubeVideoId: video.youtubeVideoId,
      youtubeUrl: video.youtubeUrl,
    },
  }
}

function createItemFromPdf(
  pdf: ImportedPdf,
  isMaterial: boolean,
  overrideType?: 'video' | 'pdf' | 'text' | 'material'
): LessonGroupItemBuilder {
  const resolvedType = overrideType ?? (pdf.filename.endsWith('.pdf') ? 'pdf' : 'material')
  return {
    id: pdf.id,
    title: pdf.filename.replace(EXTENSION_RE, ''),
    displayTitle: cleanLessonTitle(pdf.filename),
    type: resolvedType,
    pageCount: pdf.pageCount,
    filename: pdf.filename,
    path: pdf.path,
    isMaterial,
    sourceMetadata: {
      path: pdf.path,
      pageCount: pdf.pageCount,
    },
  }
}

// ---------------------------------------------------------------------------
// Lesson group resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a builder into a final LessonGroup.
 *
 * Priority for primary content:
 * 1. Video (first non-material video)
 * 2. Reading/Text/PDF (non-material document)
 * 3. Quiz/Assignment
 *
 * Everything else becomes materials.
 */
function resolveLessonGroup(builder: LessonGroupBuilder): LessonGroup | null {
  const allItems: LessonGroupItemBuilder[] = []

  // Add videos (non-material first)
  if (builder.video) {
    if (builder.video.isMaterial) {
      allItems.push(createItemFromVideo(builder.video, true))
    } else {
      allItems.unshift(createItemFromVideo(builder.video, false))
    }
  }

  // Add all PDFs, TXTs, and other items
  allItems.push(...builder.pdfs, ...builder.txts, ...builder.other)

  if (allItems.length === 0) return null

  // Find primary: video > reading > text > anything
  let primaryItem: LessonGroupItemBuilder | undefined

  // Priority 1: Non-material video
  primaryItem = allItems.find(i => i.type === 'video' && !i.isMaterial)

  // Priority 2: Non-material reading (PDF or text marked as primary candidate)
  if (!primaryItem) {
    primaryItem = allItems.find(
      i => (i.type === 'pdf' || i.type === 'text') && !i.isMaterial
    )
  }

  // Priority 3: Any non-material item
  if (!primaryItem) {
    primaryItem = allItems.find(i => !i.isMaterial)
  }

  // Fallback: first item
  if (!primaryItem) {
    primaryItem = allItems[0]
    primaryItem.isMaterial = false
  }

  // Build the final group
  const primary: LessonGroupItem = {
    id: primaryItem.id,
    title: primaryItem.title,
    displayTitle: primaryItem.displayTitle,
    type: primaryItem.type,
    duration: primaryItem.duration,
    pageCount: primaryItem.pageCount,
    filename: primaryItem.filename,
    path: primaryItem.path,
    isPrimary: true,
    sourceMetadata: primaryItem.sourceMetadata,
  }

  // Everything else is a material
  const materials: LessonGroupItem[] = allItems
    .filter(i => i.id !== primaryItem.id)
    .map(i => ({
      id: i.id,
      title: i.title,
      displayTitle: i.displayTitle,
      type: i.type === 'material' ? 'material' : i.type,
      duration: i.duration,
      pageCount: i.pageCount,
      filename: i.filename,
      path: i.path,
      isPrimary: false,
      sourceMetadata: i.sourceMetadata,
    }))
    .sort((a, b) => {
      // Sort: PDFs first, then text, then other
      const typeOrder: Record<string, number> = { pdf: 0, text: 1, material: 2, video: 3 }
      const orderA = typeOrder[a.type] ?? 2
      const orderB = typeOrder[b.type] ?? 2
      if (orderA !== orderB) return orderA - orderB
      return a.displayTitle.localeCompare(b.displayTitle)
    })

  return {
    numericPrefix: builder.prefix,
    primary,
    materials,
  }
}

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

/**
 * Extract the first folder segment from a path (section name).
 */
function getSectionName(path: string): string {
  const normalized = path.replace(/^\/+/, '')
  const slashIndex = normalized.indexOf('/')
  return slashIndex > 0 ? normalized.substring(0, slashIndex) : ''
}

/**
 * Parse section prefix from folder name (e.g. "01-GettingStarted" → "01").
 */
function parseSectionPrefix(path: string): string {
  const sectionName = getSectionName(path)
  const match = sectionName.match(/^(\d+)/)
  return match ? match[1] : '999'
}

/**
 * Convert a raw folder name into a clean human-readable section title.
 *
 * Examples:
 *   "01-Getting-Started"                     → "Getting Started"
 *   "02 - Installing and Connecting to a Linux System" → "Installing and Connecting to a Linux System"
 *   "03-Linux-Fundamentals"                  → "Linux Fundamentals"
 *   ""                                        → "Course Content"
 */
function cleanSectionTitle(folderName: string): string {
  if (!folderName) return 'Course Content'

  // Strip leading numeric prefix (e.g. "01", "02 - ", "03-")
  const cleaned = folderName
    .replace(/^\d+\s*-\s*/, '')  // "01 - Overview"
    .replace(/^\d+-/, '')         // "01-Overview"
    .replace(/^\d+\s+/, '')       // "01 Overview"
    .trim()

  if (!cleaned) return 'Course Content'

  // Humanize: replace hyphens/underscores with spaces
  return cleaned
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build sections from lesson groups.
 * Groups lessons by their folder path's first segment.
 */
function buildSections(lessonGroups: LessonGroup[]): CourseSection[] {
  if (lessonGroups.length === 0) return []

  // Check if all lessons are in the same section (flat structure)
  const sections = new Map<string, { path: string; lessons: LessonGroup[] }>()

  for (const group of lessonGroups) {
    const sectionName = getSectionName(group.primary.path)
    if (!sections.has(sectionName)) {
      sections.set(sectionName, { path: sectionName, lessons: [] })
    }
    sections.get(sectionName)!.lessons.push(group)
  }

  // If only one section (or all empty), return flat
  if (sections.size <= 1) {
    const onlySection = Array.from(sections.values())[0]
    const title = cleanSectionTitle(onlySection?.path || '')
    return [
      {
        numericPrefix: onlySection ? parseSectionPrefix(onlySection.path) : '1',
        title,
        lessons: onlySection?.lessons || lessonGroups,
      },
    ]
  }

  // Multiple sections — sort by section prefix
  return Array.from(sections.entries())
    .sort(([a], [b]) =>
      parseSectionPrefix(a).localeCompare(parseSectionPrefix(b), undefined, { numeric: true })
    )
    .map(([_name, { path, lessons }]) => {
      const section: CourseSection = {
        numericPrefix: parseSectionPrefix(path),
        title: cleanSectionTitle(path),
        lessons,
      }
      return section
    })
}

// ---------------------------------------------------------------------------
// YouTube chapter-based sections
// ---------------------------------------------------------------------------

function buildYouTubeSections(
  videos: ImportedVideo[],
  chapters: YouTubeCourseChapter[]
): CourseSection[] {
  if (chapters.length === 0) {
    return [
      {
        numericPrefix: '1',
        title: 'Course Content',
        lessons: sortImportedVideosForCurriculum(videos).map((v, i) => ({
          numericPrefix: String(i + 1).padStart(3, '0'),
          primary: {
            id: v.id,
            title: v.filename.replace(EXTENSION_RE, ''),
            displayTitle: cleanLessonTitle(v.filename),
            type: 'video' as const,
            duration: v.duration,
            filename: v.filename,
            path: v.path,
            isPrimary: true,
            sourceMetadata: {
              youtubeVideoId: v.youtubeVideoId,
              youtubeUrl: v.youtubeUrl,
              thumbnailUrl: v.thumbnailUrl,
              description: v.description,
            },
          },
          materials: [],
        })),
      },
    ]
  }

  // Map video IDs to chapter titles
  const videoChapterMap = new Map<string, string>()
  for (const ch of chapters) {
    if (!videoChapterMap.has(ch.videoId)) {
      videoChapterMap.set(ch.videoId, ch.title)
    }
  }

  // Group by chapter
  const chapterGroups = new Map<string, ImportedVideo[]>()
  let currentTitle = ''
  let currentVideos: ImportedVideo[] = []

  for (const video of sortImportedVideosForCurriculum(videos)) {
    const chTitle = videoChapterMap.get(video.youtubeVideoId ?? '') ?? ''
    if (chTitle !== currentTitle && currentVideos.length > 0) {
      if (!chapterGroups.has(currentTitle)) chapterGroups.set(currentTitle, [])
      chapterGroups.get(currentTitle)!.push(...currentVideos)
      currentVideos = []
    }
    currentTitle = chTitle
    currentVideos.push(video)
  }

  if (currentVideos.length > 0) {
    if (!chapterGroups.has(currentTitle)) chapterGroups.set(currentTitle, [])
    chapterGroups.get(currentTitle)!.push(...currentVideos)
  }

  let runningYouTubeIndex = 0
  return Array.from(chapterGroups.entries()).map(([title, chapterVideos], sectionIndex) => {
    const section: CourseSection = {
      numericPrefix: String(sectionIndex + 1).padStart(3, '0'),
      title: title || `Section ${sectionIndex + 1}`,
      lessons: chapterVideos.map((v, i) => ({
        numericPrefix: String(i + 1).padStart(3, '0'),
        primary: {
          id: v.id,
          title: v.filename.replace(EXTENSION_RE, ''),
          displayTitle: cleanLessonTitle(v.filename),
          type: 'video' as const,
          duration: v.duration,
          filename: v.filename,
          path: v.path,
          isPrimary: true,
          sourceMetadata: {
            youtubeVideoId: v.youtubeVideoId,
            youtubeUrl: v.youtubeUrl,
            thumbnailUrl: v.thumbnailUrl,
            description: v.description,
          },
        },
        materials: [],
      })),
    }
    runningYouTubeIndex += chapterVideos.length
    return section
  })
}

// ---------------------------------------------------------------------------
// Helpers for consumers
// ---------------------------------------------------------------------------

/**
 * Get all lesson IDs (primary + materials) from a course section list.
 */
export function getAllLessonIds(sections: CourseSection[]): string[] {
  return sections.flatMap(s =>
    s.lessons.flatMap(lg => [lg.primary.id, ...lg.materials.map(m => m.id)])
  )
}

/**
 * Find which section and lesson group a given item ID belongs to.
 */
export function findLessonLocation(
  sections: CourseSection[],
  itemId: string
): { sectionIndex: number; groupIndex: number; isMaterial: boolean } | null {
  for (let si = 0; si < sections.length; si++) {
    for (let gi = 0; gi < sections[si].lessons.length; gi++) {
      const lg = sections[si].lessons[gi]
      if (lg.primary.id === itemId) {
        return { sectionIndex: si, groupIndex: gi, isMaterial: false }
      }
      if (lg.materials.some(m => m.id === itemId)) {
        return { sectionIndex: si, groupIndex: gi, isMaterial: true }
      }
    }
  }
  return null
}

/**
 * Get the primary lesson ID for a material item (for navigation).
 */
export function getPrimaryLessonId(
  sections: CourseSection[],
  materialId: string
): string | null {
  const loc = findLessonLocation(sections, materialId)
  if (!loc || !loc.isMaterial) return null
  return sections[loc.sectionIndex].lessons[loc.groupIndex].primary.id
}
