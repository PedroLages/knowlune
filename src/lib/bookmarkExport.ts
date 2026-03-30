/**
 * Bookmark Markdown export for PKM integration.
 *
 * Exports bookmarks as Markdown files with YAML frontmatter,
 * organized one file per course under `bookmarks/{course-name}/bookmarks.md`.
 * Bookmarks are grouped by video heading and sorted by timestamp ascending.
 */
import { db } from '@/db/schema'
import type { VideoBookmark } from '@/data/types'
import type { ExportProgressCallback } from './exportService'
import { sanitizeFilename } from './noteExport'

/** Yield to the UI thread between heavy operations */
function yieldToUI(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Formats a timestamp in seconds to a human-readable string.
 *
 * - 0 → "0:00"
 * - 65 → "1:05"
 * - 3725 → "1:02:05"
 * - 59 → "0:59"
 */
export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(Math.abs(seconds))
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/**
 * Generates YAML frontmatter for a bookmarks file.
 */
function generateBookmarkFrontmatter(
  courseName: string,
  bookmarkCount: number,
  exportedAt: string
): string {
  const lines = [
    '---',
    `type: "bookmarks"`,
    `course: "${courseName.replace(/"/g, '\\"')}"`,
    `bookmark_count: ${bookmarkCount}`,
    `exported: "${exportedAt}"`,
    '---',
    '',
  ]
  return lines.join('\n')
}

/**
 * Exports all bookmarks as Markdown files with YAML frontmatter.
 *
 * Produces one `.md` file per course, with bookmarks grouped by video heading
 * and sorted by timestamp ascending within each group.
 * Returns an empty array without error if no bookmarks exist (AC7).
 */
export async function exportBookmarksAsMarkdown(
  onProgress?: ExportProgressCallback
): Promise<Array<{ name: string; content: string }>> {
  onProgress?.(0, 'Loading bookmarks...')
  const bookmarks = await db.bookmarks.toArray()

  if (bookmarks.length === 0) {
    onProgress?.(100, 'Complete')
    return []
  }

  await yieldToUI()

  // Load courses for name lookup
  onProgress?.(20, 'Loading courses...')
  const courses = await db.importedCourses.toArray()
  const courseMap = new Map(courses.map(c => [c.id, c.name]))
  await yieldToUI()

  // Load videos for name lookup
  onProgress?.(40, 'Loading videos...')
  const videos = await db.importedVideos.toArray()
  const videoMap = new Map(videos.map(v => [v.id, v.filename]))
  await yieldToUI()

  // Group bookmarks by courseId
  const byCourse = new Map<string, VideoBookmark[]>()
  for (const bm of bookmarks) {
    const group = byCourse.get(bm.courseId) || []
    group.push(bm)
    byCourse.set(bm.courseId, group)
  }

  onProgress?.(60, 'Generating Markdown files...')
  const exportedAt = new Date().toISOString()
  const files: Array<{ name: string; content: string }> = []

  for (const [courseId, courseBookmarks] of byCourse) {
    const courseName = courseMap.get(courseId) || 'Unknown Course'
    const sanitizedCourseName = sanitizeFilename(courseName) || 'unknown-course'

    // Group by lessonId (video)
    const byVideo = new Map<string, VideoBookmark[]>()
    for (const bm of courseBookmarks) {
      const group = byVideo.get(bm.lessonId) || []
      group.push(bm)
      byVideo.set(bm.lessonId, group)
    }

    const frontmatter = generateBookmarkFrontmatter(courseName, courseBookmarks.length, exportedAt)

    // Build body with video headings
    const bodyParts: string[] = []
    for (const [lessonId, videoBookmarks] of byVideo) {
      const videoName = videoMap.get(lessonId) || lessonId
      bodyParts.push(`## ${videoName}`)
      bodyParts.push('')

      // Sort by timestamp ascending (AC5)
      const sorted = [...videoBookmarks].sort((a, b) => a.timestamp - b.timestamp)
      for (const bm of sorted) {
        bodyParts.push(`- **[${formatTimestamp(bm.timestamp)}]** ${bm.label}`)
      }
      bodyParts.push('')
    }

    const fullContent = frontmatter + bodyParts.join('\n')
    const filename = `bookmarks/${sanitizedCourseName}/bookmarks.md`

    files.push({ name: filename, content: fullContent })
    await yieldToUI()
  }

  onProgress?.(100, 'Complete')
  return files
}
