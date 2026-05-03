import { useEffect } from 'react'
import type { ImportedCourse } from '@/data/types'

/**
 * Loads thumbnail URLs for an array of imported courses.
 * Extracted from duplicate useEffect blocks in LearningPathDetail
 * and LearningPaths.
 */
export function useLoadCourseThumbnails(
  importedCourses: ImportedCourse[],
  loadThumbnailUrls: (courseIds: string[]) => void
) {
  useEffect(() => {
    if (importedCourses.length > 0) {
      loadThumbnailUrls(importedCourses.map(c => c.id))
    }
  }, [importedCourses, loadThumbnailUrls])
}
