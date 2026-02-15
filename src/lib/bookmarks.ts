const STORAGE_KEY = 'video-bookmarks'

export interface VideoBookmark {
  id: string
  courseId: string
  lessonId: string
  timestamp: number // seconds
  label: string
  createdAt: string
}

/**
 * Get all bookmarks from localStorage
 */
function getAllBookmarks(): VideoBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error('[Bookmarks] Error loading bookmarks:', error)
    return []
  }
}

/**
 * Save all bookmarks to localStorage
 */
function saveAllBookmarks(bookmarks: VideoBookmark[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
  } catch (error) {
    console.error('[Bookmarks] Error saving bookmarks:', error)
  }
}

/**
 * Add a new bookmark
 */
export function addBookmark(
  courseId: string,
  lessonId: string,
  timestamp: number,
  label?: string
): string {
  const bookmarks = getAllBookmarks()

  // Generate default label if not provided
  const defaultLabel = formatTimestamp(timestamp)

  const newBookmark: VideoBookmark = {
    id: crypto.randomUUID(),
    courseId,
    lessonId,
    timestamp: Math.floor(timestamp), // Ensure integer seconds
    label: label || defaultLabel,
    createdAt: new Date().toISOString(),
  }

  bookmarks.push(newBookmark)
  saveAllBookmarks(bookmarks)

  return newBookmark.id
}

/**
 * Get all bookmarks for a specific lesson
 */
export function getLessonBookmarks(courseId: string, lessonId: string): VideoBookmark[] {
  const bookmarks = getAllBookmarks()
  return bookmarks
    .filter(b => b.courseId === courseId && b.lessonId === lessonId)
    .sort((a, b) => a.timestamp - b.timestamp) // Sort by timestamp
}

/**
 * Get all bookmarks for a specific course
 */
export function getCourseBookmarks(courseId: string): VideoBookmark[] {
  const bookmarks = getAllBookmarks()
  return bookmarks.filter(b => b.courseId === courseId).sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Update bookmark label
 */
export function updateBookmarkLabel(bookmarkId: string, label: string): boolean {
  const bookmarks = getAllBookmarks()
  const bookmark = bookmarks.find(b => b.id === bookmarkId)

  if (!bookmark) return false

  bookmark.label = label
  saveAllBookmarks(bookmarks)
  return true
}

/**
 * Delete a bookmark
 */
export function deleteBookmark(bookmarkId: string): boolean {
  const bookmarks = getAllBookmarks()
  const initialLength = bookmarks.length
  const filtered = bookmarks.filter(b => b.id !== bookmarkId)

  if (filtered.length === initialLength) return false // Bookmark not found

  saveAllBookmarks(filtered)
  return true
}

/**
 * Check if a bookmark exists at a specific timestamp (within 1 second tolerance)
 */
export function hasBookmarkAt(courseId: string, lessonId: string, timestamp: number): boolean {
  const bookmarks = getLessonBookmarks(courseId, lessonId)
  return bookmarks.some(b => Math.abs(b.timestamp - timestamp) < 1)
}

/**
 * Format timestamp as HH:MM:SS or MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Export helper for displaying timestamp
 */
export function formatBookmarkTimestamp(seconds: number): string {
  return formatTimestamp(seconds)
}

/**
 * Get total bookmark count across all courses
 */
export function getTotalBookmarkCount(): number {
  return getAllBookmarks().length
}

/**
 * Clear all bookmarks (for debugging/testing)
 */
export function clearAllBookmarks() {
  localStorage.removeItem(STORAGE_KEY)
}
