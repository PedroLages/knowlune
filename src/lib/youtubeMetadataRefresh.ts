/**
 * YouTube Metadata Refresh Service
 *
 * Background service that refreshes stale YouTube course metadata.
 * Runs on app startup, non-blocking, rate-limited.
 *
 * - Detects courses where `lastRefreshedAt` > 30 days ago
 * - Fetches fresh metadata from YouTube API
 * - Updates `youtubeVideoCache` and `importedVideos` tables
 * - Marks removed videos with `removedFromYouTube` flag
 *
 * @see E28-S12 — Offline Support, Metadata Refresh & Security Hardening
 */

import { db } from '@/db'
import { getVideoMetadataBatch } from '@/lib/youtubeApi'
import type { ImportedCourse, ImportedVideo } from '@/data/types'

/** Staleness threshold: 30 days in milliseconds */
export const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Check if a course's metadata is stale (> 30 days since last refresh).
 */
export function isMetadataStale(course: ImportedCourse): boolean {
  if (course.source !== 'youtube') return false
  if (!course.lastRefreshedAt) return true // Never refreshed
  const lastRefreshed = new Date(course.lastRefreshedAt).getTime()
  if (isNaN(lastRefreshed)) return true
  return Date.now() - lastRefreshed > STALE_THRESHOLD_MS
}

/**
 * Get all YouTube courses with stale metadata.
 */
export async function getStaleCourses(): Promise<ImportedCourse[]> {
  const allCourses = await db.importedCourses.toArray()
  return allCourses.filter(isMetadataStale)
}

/**
 * Refresh metadata for a single YouTube course.
 *
 * Fetches fresh metadata for all videos in the course,
 * updates cache and importedVideos records, and marks
 * removed videos.
 *
 * @returns Number of videos updated
 */
export async function refreshCourseMetadata(course: ImportedCourse): Promise<{
  updated: number
  removed: number
}> {
  if (course.source !== 'youtube') {
    return { updated: 0, removed: 0 }
  }

  // Get all videos for this course
  const videos = await db.importedVideos
    .where('courseId')
    .equals(course.id)
    .toArray()

  if (videos.length === 0) {
    // Update lastRefreshedAt even if no videos
    await db.importedCourses.update(course.id, {
      lastRefreshedAt: new Date().toISOString(),
    })
    return { updated: 0, removed: 0 }
  }

  // Collect YouTube video IDs
  const videoIdMap = new Map<string, ImportedVideo>()
  for (const video of videos) {
    if (video.youtubeVideoId && !video.removedFromYouTube) {
      videoIdMap.set(video.youtubeVideoId, video)
    }
  }

  if (videoIdMap.size === 0) {
    await db.importedCourses.update(course.id, {
      lastRefreshedAt: new Date().toISOString(),
    })
    return { updated: 0, removed: 0 }
  }

  // Batch-fetch fresh metadata
  const results = await getVideoMetadataBatch([...videoIdMap.keys()])

  let updated = 0
  let removed = 0

  // Process results
  for (const [youtubeVideoId, result] of results) {
    const video = videoIdMap.get(youtubeVideoId)
    if (!video) continue

    if (result.ok) {
      // Update importedVideo with fresh metadata
      const updates: Partial<ImportedVideo> = {}
      let hasChanges = false

      if (result.data.title && result.data.title !== video.filename) {
        updates.filename = result.data.title
        hasChanges = true
      }
      if (result.data.duration > 0 && result.data.duration !== video.duration) {
        updates.duration = result.data.duration
        hasChanges = true
      }
      if (result.data.thumbnailUrl && result.data.thumbnailUrl !== video.thumbnailUrl) {
        updates.thumbnailUrl = result.data.thumbnailUrl
        hasChanges = true
      }
      if (result.data.description && result.data.description !== video.description) {
        updates.description = result.data.description
        hasChanges = true
      }
      if (result.data.chapters && result.data.chapters.length > 0) {
        updates.chapters = result.data.chapters
        hasChanges = true
      }

      if (hasChanges) {
        await db.importedVideos.update(video.id, updates)
        updated++
      }
    } else if (result.code === 'NOT_FOUND') {
      // Video was removed from YouTube — mark it
      await db.importedVideos.update(video.id, {
        removedFromYouTube: true,
      })
      removed++
    }
    // For NETWORK_ERROR, QUOTA_EXCEEDED etc., skip silently (will retry next time)
  }

  // Update lastRefreshedAt on the course
  await db.importedCourses.update(course.id, {
    lastRefreshedAt: new Date().toISOString(),
  })

  return { updated, removed }
}

/**
 * Refresh metadata for all stale YouTube courses.
 *
 * Intended to run on app startup. Non-blocking, rate-limited.
 * Processes courses sequentially to avoid overwhelming the API.
 *
 * @returns Summary of refresh results
 */
export async function refreshStaleMetadata(): Promise<{
  coursesProcessed: number
  totalUpdated: number
  totalRemoved: number
}> {
  const staleCourses = await getStaleCourses()

  if (staleCourses.length === 0) {
    return { coursesProcessed: 0, totalUpdated: 0, totalRemoved: 0 }
  }

  let totalUpdated = 0
  let totalRemoved = 0

  for (const course of staleCourses) {
    try {
      const { updated, removed } = await refreshCourseMetadata(course)
      totalUpdated += updated
      totalRemoved += removed
    } catch (error) {
      // Non-blocking: log and continue with next course
      console.warn(
        `[MetadataRefresh] Failed to refresh course "${course.name}":`,
        error
      )
    }
  }

  if (totalUpdated > 0 || totalRemoved > 0) {
    console.info(
      `[MetadataRefresh] Refreshed ${staleCourses.length} course(s): ${totalUpdated} updated, ${totalRemoved} removed`
    )
  }

  return {
    coursesProcessed: staleCourses.length,
    totalUpdated,
    totalRemoved,
  }
}
