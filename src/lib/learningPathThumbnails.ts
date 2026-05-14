import type { LearningPathEntry } from '@/data/types'

/**
 * Walk path entries in order (caller must sort, e.g. by `position`) and collect
 * up to `limit` thumbnail URLs from `thumbnailUrls[courseId]`, skipping gaps.
 */
export function getPathCourseThumbnailUrls(
  sortedEntries: LearningPathEntry[],
  thumbnailUrls: Record<string, string>,
  limit: number
): string[] {
  if (limit <= 0) return []
  const out: string[] = []
  for (const entry of sortedEntries) {
    if (out.length >= limit) break
    const url = thumbnailUrls[entry.courseId]
    if (url) out.push(url)
  }
  return out
}
