import { sortImportedVideosForCurriculum } from '@/lib/sortImportedVideosForCurriculum'
import type { ImportedVideo, ImportedPdf, YouTubeCourseChapter } from '@/data/types'

export interface ChapterGroup {
  title: string
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
}

/**
 * Safely decode a URI-encoded string, returning the original on malformed input.
 */
function safeDecodeURIComponent(s: string): string {
  if (!s) return s
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Extract the first folder segment from a path, decoded.
 * e.g. "03%20-%20Linux%20Fundamentals/lesson.mp4" → "03 - Linux Fundamentals"
 */
function getFolderName(path: string): string {
  const decoded = safeDecodeURIComponent(path)
  const parts = decoded.split('/')
  return parts.length > 1 ? parts[0] : ''
}

/**
 * Convert a raw folder name into a human-readable title by
 * stripping leading numeric prefixes.
 *
 * Examples:
 *   "01 - Overview"              → "Overview"
 *   "03-Linux-Fundamentals"      → "Linux Fundamentals"
 *   "03%20-%20Linux%20Fundamentals" → "Linux Fundamentals"  (already decoded)
 *   "My Section"                 → "My Section"
 *   ""                            → "Course Content"
 *   "mod-a"                      → "mod-a"  (no numeric prefix, left as-is)
 */
export function cleanFolderTitle(folderName: string): string {
  if (!folderName) return 'Course Content'

  const cleaned = folderName
    .replace(/^\d+\s*[-. ]\s*/, '') // "01 - Overview", "01-Overview", "01. Overview", "01 Overview"
    .trim()

  if (!cleaned) return 'Course Content'

  // Only humanize separators when a numeric prefix was actually stripped
  // (i.e. the cleaned string is different from the original).
  if (cleaned !== folderName) {
    return cleaned
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return cleaned
}

export function groupByFolder(videos: ImportedVideo[], pdfs: ImportedPdf[] = []): ChapterGroup[] {
  const videoGroups = new Map<string, ImportedVideo[]>()
  const pdfGroups = new Map<string, ImportedPdf[]>()

  for (const video of videos) {
    const folder = getFolderName(video.path)
    if (!videoGroups.has(folder)) videoGroups.set(folder, [])
    videoGroups.get(folder)!.push(video)
  }

  for (const pdf of pdfs) {
    const folder = getFolderName(pdf.path)
    if (!pdfGroups.has(folder)) pdfGroups.set(folder, [])
    pdfGroups.get(folder)!.push(pdf)
  }

  const allFolders = new Set([...videoGroups.keys(), ...pdfGroups.keys()])
  return Array.from(allFolders)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(folderName => ({
      title: cleanFolderTitle(folderName),
      videos: videoGroups.get(folderName) ?? [],
      pdfs: pdfGroups.get(folderName) ?? [],
    }))
}

export function groupByChapter(
  videos: ImportedVideo[],
  chapters: YouTubeCourseChapter[]
): ChapterGroup[] {
  if (chapters.length === 0) return [{ title: '', videos, pdfs: [] }]

  const videoChapterMap = new Map<string, string>()
  for (const ch of chapters) {
    if (!videoChapterMap.has(ch.videoId)) {
      videoChapterMap.set(ch.videoId, ch.title)
    }
  }

  const groups: ChapterGroup[] = []
  let currentTitle = ''
  let currentVideos: ImportedVideo[] = []

  for (const video of videos) {
    const chTitle = videoChapterMap.get(video.youtubeVideoId ?? '') ?? ''
    if (chTitle !== currentTitle && currentVideos.length > 0) {
      groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
      currentVideos = []
    }
    currentTitle = chTitle
    currentVideos.push(video)
  }
  if (currentVideos.length > 0) {
    groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
  }

  return groups
}

/** Same rules as CourseOverview `groupedContent`. */
export function buildGroupedCurriculum(opts: {
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  chapters: YouTubeCourseChapter[]
  preferChapterGrouping: boolean
}): ChapterGroup[] {
  const { videos, pdfs, chapters, preferChapterGrouping } = opts
  const raw =
    preferChapterGrouping && chapters.length > 0
      ? groupByChapter(videos, chapters)
      : groupByFolder(videos, preferChapterGrouping ? [] : pdfs)
  return raw.map(group => ({
    ...group,
    videos: sortImportedVideosForCurriculum(group.videos),
  }))
}
