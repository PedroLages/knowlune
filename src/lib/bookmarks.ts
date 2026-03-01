import { db } from '@/db/schema'
import type { VideoBookmark } from '@/data/types'
import { formatTimestamp } from '@/lib/format'

const LEGACY_STORAGE_KEY = 'video-bookmarks'

/**
 * Add a new bookmark
 */
export async function addBookmark(
  courseId: string,
  lessonId: string,
  timestamp: number,
  label?: string
): Promise<string> {
  const defaultLabel = formatTimestamp(timestamp)

  const bookmark: VideoBookmark = {
    id: crypto.randomUUID(),
    courseId,
    lessonId,
    timestamp: Math.floor(timestamp),
    label: label || defaultLabel,
    createdAt: new Date().toISOString(),
  }

  await db.bookmarks.add(bookmark)
  return bookmark.id
}

/**
 * Get all bookmarks for a specific lesson
 */
export async function getLessonBookmarks(
  courseId: string,
  lessonId: string
): Promise<VideoBookmark[]> {
  const bookmarks = await db.bookmarks.where({ courseId, lessonId }).toArray()
  return bookmarks.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get all bookmarks for a specific course
 */
export async function getCourseBookmarks(courseId: string): Promise<VideoBookmark[]> {
  const bookmarks = await db.bookmarks.where({ courseId }).toArray()
  return bookmarks.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Update bookmark label
 */
export async function updateBookmarkLabel(bookmarkId: string, label: string): Promise<boolean> {
  const updated = await db.bookmarks.update(bookmarkId, { label })
  return updated === 1
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(bookmarkId: string): Promise<void> {
  await db.bookmarks.delete(bookmarkId)
}

/**
 * Check if a bookmark exists at a specific timestamp (within 1 second tolerance)
 */
export async function hasBookmarkAt(
  courseId: string,
  lessonId: string,
  timestamp: number
): Promise<boolean> {
  const bookmarks = await getLessonBookmarks(courseId, lessonId)
  return bookmarks.some(b => Math.abs(b.timestamp - timestamp) < 1)
}

/**
 * Export helper for displaying timestamp
 */
export function formatBookmarkTimestamp(seconds: number): string {
  return formatTimestamp(seconds)
}

/**
 * Get all bookmarks across all courses, sorted by most recently created first
 */
export async function getAllBookmarks(): Promise<VideoBookmark[]> {
  return db.bookmarks.orderBy('createdAt').reverse().toArray()
}

/**
 * Get total bookmark count across all courses
 */
export async function getTotalBookmarkCount(): Promise<number> {
  return db.bookmarks.count()
}

/**
 * Clear all bookmarks (for debugging/testing)
 */
export async function clearAllBookmarks(): Promise<void> {
  await db.bookmarks.clear()
}

/**
 * Migrate bookmarks from localStorage to IndexedDB.
 * Idempotent — skips if localStorage key is already gone.
 */
export async function migrateBookmarksFromLocalStorage(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return

    const legacy: VideoBookmark[] = JSON.parse(raw)
    if (legacy.length === 0) {
      return
    }

    // Ensure label exists on legacy records
    const withLabels = legacy.map(b => ({
      ...b,
      label: b.label || formatTimestamp(b.timestamp),
    }))

    await db.bookmarks.bulkPut(withLabels)
    // Retain localStorage as backup for one version cycle (per AC)
  } catch (error) {
    console.error('[Bookmarks] Migration from localStorage failed:', error)
  }
}
