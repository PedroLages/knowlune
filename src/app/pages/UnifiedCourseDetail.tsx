/**
 * UnifiedCourseDetail — Single course detail page for both local and YouTube courses.
 *
 * Replaces ImportedCourseDetail (553 lines) and YouTubeCourseDetail (470 lines)
 * with a single adapter-driven component. All source-specific branching goes
 * through `adapter.getCapabilities()` — never checks `course.source` directly.
 *
 * Sub-components:
 * - CourseHeader: metadata, thumbnail, author, actions
 * - LessonList: folder/chapter grouping, search, progress
 * - CourseProgress: overall progress card
 * - AISummaryPanel: collapsible AI summary placeholder
 *
 * @see E89-S04
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import { useFileStatusVerification } from '@/hooks/useFileStatusVerification'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { refreshCourseMetadata } from '@/lib/youtubeMetadataRefresh'
import { revokeObjectUrl } from '@/lib/courseAdapter'
import { getLastWatchedLesson, getFirstLesson } from '@/lib/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { EditCourseDialog } from '@/app/components/figma/EditCourseDialog'
import { CourseBreadcrumb } from '@/app/components/course/CourseBreadcrumb'
import { CourseHeader, type CtaVariant } from '@/app/components/course/CourseHeader'
import { CourseProgress } from '@/app/components/course/CourseProgress'
import { AISummaryPanel } from '@/app/components/course/AISummaryPanel'
import { LessonList } from '@/app/components/course/LessonList'
import type { ImportedVideo, ImportedPdf, VideoProgress, YouTubeCourseChapter } from '@/data/types'

export function UnifiedCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const { adapter, loading: adapterLoading, error: adapterError } = useCourseAdapter(courseId)
  const course = adapter?.getCourse()
  const capabilities = adapter?.getCapabilities()
  const isYouTube = adapter?.getSource() === 'youtube'

  // Store access for mutations
  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const loadImportedCourses = useCourseImportStore(s => s.loadImportedCourses)
  const removeImportedCourse = useCourseImportStore(s => s.removeImportedCourse)
  const updateCourseDetails = useCourseImportStore(s => s.updateCourseDetails)
  const getAllTags = useCourseImportStore(s => s.getAllTags)
  const storeAuthors = useAuthorStore(s => s.authors)
  const loadAuthors = useAuthorStore(s => s.loadAuthors)

  useLazyStore(loadImportedCourses)
  useLazyStore(loadAuthors)

  // Content state
  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [pdfs, setPdfs] = useState<ImportedPdf[]>([])
  const [chapters, setChapters] = useState<YouTubeCourseChapter[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const thumbnailUrlRef = useRef<string | null>(null)
  const [contentLoading, setContentLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // CTA state
  const [ctaVariant, setCtaVariant] = useState<CtaVariant | undefined>()
  const [ctaLessonId, setCtaLessonId] = useState<string | undefined>()
  const [ctaLessonTitle, setCtaLessonTitle] = useState<string | undefined>()

  // UI state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load content from Dexie
  useEffect(() => {
    if (!courseId) return
    let ignore = false

    Promise.all([
      db.importedVideos.where('courseId').equals(courseId).sortBy('order'),
      db.importedPdfs.where('courseId').equals(courseId).toArray(),
      // silent-catch-ok — youtubeChapters table may not exist for local courses
      db.youtubeChapters
        .where('courseId')
        .equals(courseId)
        .sortBy('order')
        .catch(() => []),
      db.progress.where('courseId').equals(courseId).toArray(),
    ])
      .then(([v, p, ch, prog]) => {
        if (ignore) return
        setVideos(v)
        setPdfs(p)
        setChapters(ch)
        const pMap = new Map<string, VideoProgress>()
        for (const pr of prog) pMap.set(pr.videoId, pr)
        setProgressMap(pMap)
        setContentLoading(false)
      })
      .catch(err => {
        // silent-catch-ok — error state handled by setLoadError UI
        console.error('[UnifiedCourseDetail] Failed to load:', err)
        if (!ignore) {
          setLoadError(true)
          setContentLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [courseId])

  // Determine CTA button state
  useEffect(() => {
    if (!courseId || !adapter || contentLoading) return
    let ignore = false

    async function resolveCta() {
      const lastWatched = await getLastWatchedLesson(courseId!)
      if (ignore) return

      if (lastWatched) {
        // Check if ALL videos are completed (completionPercentage >= 90)
        const allCompleted =
          videos.length > 0 && videos.every(v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= 90)
        setCtaVariant(allCompleted ? 'review' : 'continue')
        setCtaLessonId(lastWatched.lessonId)
        setCtaLessonTitle(lastWatched.lessonTitle)
      } else {
        // No progress — start course
        const first = await getFirstLesson(adapter!)
        if (ignore) return
        if (first) {
          setCtaVariant('start')
          setCtaLessonId(first.lessonId)
          setCtaLessonTitle(first.lessonTitle)
        }
      }
    }

    resolveCta()
    return () => {
      ignore = true
    }
  }, [courseId, adapter, contentLoading, videos, progressMap])

  // Load thumbnail via adapter
  useEffect(() => {
    if (!adapter) return
    let ignore = false
    // silent-catch-ok — thumbnail is non-critical
    adapter
      .getThumbnailUrl()
      .then(url => {
        if (!ignore) {
          setThumbnailUrl(url)
          thumbnailUrlRef.current = url
        }
      })
      .catch(() => {})
    return () => {
      ignore = true
      const blobUrl = thumbnailUrlRef.current
      if (blobUrl?.startsWith('blob:')) revokeObjectUrl(blobUrl)
    }
  }, [adapter])

  const fileStatuses = useFileStatusVerification(isYouTube ? [] : videos, isYouTube ? [] : pdfs)

  const authorData = useMemo(() => {
    if (!course?.authorId) return undefined
    const a = storeAuthors.find(x => x.id === course.authorId)
    return a ? { id: a.id, name: a.name, title: a.title, photoUrl: a.photoUrl } : undefined
  }, [course?.authorId, storeAuthors])

  const allTags = useMemo(() => getAllTags(), [getAllTags])

  const completedCount = useMemo(
    () => videos.filter(v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= 90).length,
    [videos, progressMap]
  )

  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      if (!courseId) return
      const ok = await updateCourseDetails(courseId, { name: newTitle })
      toast[ok ? 'success' : 'error'](ok ? 'Title updated' : 'Failed to update title')
    },
    [courseId, updateCourseDetails]
  )

  const handleDelete = useCallback(async () => {
    if (deleting || !courseId) return
    setDeleting(true)
    try {
      await removeImportedCourse(courseId)
      if (useCourseImportStore.getState().importError) {
        toast.error('Failed to delete course')
        setDeleting(false)
      } else {
        toast.success('Course deleted')
        navigate('/courses')
      }
    } catch {
      toast.error('Failed to delete course')
      setDeleting(false)
    }
  }, [deleting, courseId, removeImportedCourse, navigate])

  const handleRefresh = useCallback(async () => {
    if (!course || !isOnline || isRefreshing) return
    setIsRefreshing(true)
    try {
      const { updated, removed } = await refreshCourseMetadata(course)
      if (updated > 0 || removed > 0) {
        toast.success(`Metadata refreshed: ${updated} updated, ${removed} removed`)
        if (courseId) {
          setVideos(await db.importedVideos.where('courseId').equals(courseId).sortBy('order'))
        }
      } else {
        toast.info('Metadata is already up to date')
      }
    } catch (err) {
      console.error('[UnifiedCourseDetail] Refresh failed:', err)
      toast.error('Failed to refresh metadata')
    } finally {
      setIsRefreshing(false)
    }
  }, [course, isOnline, isRefreshing, courseId])

  const storeCourse = importedCourses.find(c => c.id === courseId)

  // Loading state
  if (adapterLoading || contentLoading) {
    return (
      <div
        className="max-w-3xl mx-auto px-4 py-8 space-y-6"
        role="status"
        aria-busy="true"
        aria-label="Loading course"
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (adapterError || !adapter || !course || !capabilities) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <h2 className="text-xl font-semibold text-foreground">Course not found</h2>
        <p className="text-muted-foreground">
          The course you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors font-medium"
        >
          <ArrowLeft className="size-4" />
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div data-testid="unified-course-detail" className="max-w-3xl mx-auto px-4 py-8">
      <CourseBreadcrumb courseId={courseId!} courseName={course.name} />

      <CourseHeader
        course={course}
        isYouTube={isYouTube ?? false}
        thumbnailUrl={thumbnailUrl}
        authorData={authorData}
        videoCount={videos.length}
        pdfCount={pdfs.length}
        isOnline={isOnline}
        isRefreshing={isRefreshing}
        onTitleSave={handleTitleSave}
        onDelete={() => setDeleteDialogOpen(true)}
        onEdit={() => setEditDialogOpen(true)}
        onRefreshMetadata={isYouTube ? handleRefresh : undefined}
        ctaVariant={ctaVariant}
        ctaLessonId={ctaLessonId}
        ctaLessonTitle={ctaLessonTitle}
      />

      {loadError && (
        <div
          data-testid="course-load-error"
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive mb-4"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span>Failed to load course content.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Reload
          </button>
        </div>
      )}

      <CourseProgress completedCount={completedCount} totalCount={videos.length} />
      {isYouTube && <AISummaryPanel />}

      <LessonList
        courseId={courseId!}
        videos={videos}
        pdfs={pdfs}
        isYouTube={isYouTube ?? false}
        fileStatuses={fileStatuses}
        progressMap={progressMap}
        chapters={chapters}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{course.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the course and all its content from your library. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting\u2026' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {storeCourse && (
        <EditCourseDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          course={storeCourse}
          allTags={allTags}
        />
      )}
    </div>
  )
}
