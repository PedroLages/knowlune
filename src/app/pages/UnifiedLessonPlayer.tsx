/**
 * UnifiedLessonPlayer — Placeholder that delegates to ImportedLessonPlayer or
 * YouTubeLessonPlayer based on the course source.
 *
 * This is a transitional component for E89-S03 (route consolidation).
 * S05 will replace this with a real unified player using the adapter layer.
 */

import { useParams } from 'react-router'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { ImportedLessonPlayer } from './ImportedLessonPlayer'
import { YouTubeLessonPlayer } from './YouTubeLessonPlayer'
import { Skeleton } from '@/app/components/ui/skeleton'

export function UnifiedLessonPlayer() {
  const { courseId } = useParams()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  if (loading) {
    return (
      <div className="space-y-6 p-1" role="status" aria-busy="true" aria-label="Loading lesson">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-[24px]" />
      </div>
    )
  }

  if (error || !adapter) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <h2 className="text-xl font-semibold text-foreground">Lesson not found</h2>
        <p className="text-muted-foreground">
          The lesson you&apos;re looking for doesn&apos;t exist or the course has been removed.
        </p>
      </div>
    )
  }

  const source = adapter.getSource()

  if (source === 'youtube') {
    return <YouTubeLessonPlayer />
  }

  return <ImportedLessonPlayer />
}
