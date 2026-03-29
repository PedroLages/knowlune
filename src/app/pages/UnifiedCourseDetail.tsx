/**
 * UnifiedCourseDetail — Placeholder that delegates to ImportedCourseDetail or
 * YouTubeCourseDetail based on the course source.
 *
 * This is a transitional component for E89-S03 (route consolidation).
 * S04 will replace this with a real unified page using the adapter layer.
 *
 * NOTE: The double Dexie lookup (once here via useCourseAdapter to determine source,
 * then again inside the delegated detail component) is intentional for this transitional
 * phase. S04 eliminates this by unifying into a single component.
 */

import { useParams } from 'react-router'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { ImportedCourseDetail } from './ImportedCourseDetail'
import { YouTubeCourseDetail } from './YouTubeCourseDetail'
import { Skeleton } from '@/app/components/ui/skeleton'

export function UnifiedCourseDetail() {
  const { courseId } = useParams()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  if (loading) {
    return (
      <div className="space-y-6 p-1" role="status" aria-busy="true" aria-label="Loading course">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-[24px]" />
      </div>
    )
  }

  if (error || !adapter) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <h2 className="text-xl font-semibold text-foreground">Course not found</h2>
        <p className="text-muted-foreground">
          The course you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
      </div>
    )
  }

  const source = adapter.getSource()

  if (source === 'youtube') {
    return <YouTubeCourseDetail />
  }

  return <ImportedCourseDetail />
}
