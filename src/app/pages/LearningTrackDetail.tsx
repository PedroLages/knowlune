import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { BookOpen, Trophy, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import { PathProgressSidebar } from '@/app/components/learning-path/PathProgressSidebar'
import { ContinueLearningBento } from '@/app/components/learning-path/ContinueLearningBento'
import { PathTimeline } from '@/app/components/learning-path/PathTimeline'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { usePathProgress } from '@/app/hooks/usePathProgress'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { toast } from 'sonner'
import { db } from '@/db'
import { buildGroupedCurriculum, type ChapterGroup } from '@/lib/curriculumGrouping'
import type { PathCourseInfo, ImportedVideo, ImportedPdf, VideoProgress, YouTubeCourseChapter } from '@/data/types'

export function LearningTrackDetail() {
  const { trackId } = useParams<{ trackId: string }>()
  const navigate = useNavigate()
  const { paths, entries, loadPaths, getEntriesForPath } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const { authors, loadAuthors } = useAuthorStore()
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [videosByCourse, setVideosByCourse] = useState<Map<string, ImportedVideo[]>>(new Map())
  const [pdfsByCourse, setPdfsByCourse] = useState<Map<string, ImportedPdf[]>>(new Map())
  const [chaptersByCourse, setChaptersByCourse] = useState<Map<string, YouTubeCourseChapter[]>>(new Map())
  const [videoProgressMap, setVideoProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  // Prevents "No courses yet" flash during initial load by waiting until
  // React has committed at least one render after isReady flips to true —
  // ensures Zustand store updates (entries) are visible before deciding emptiness.
  const [entriesChecked, setEntriesChecked] = useState(false)

  // Load all data on mount — uses requestAnimationFrame after Promise resolution
  // to ensure Zustand store state has been committed by React before rendering
  // content (avoids data race on direct URL navigation).
  useEffect(() => {
    let ignore = false

    Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
      .then(() => {
        if (!ignore) {
          requestAnimationFrame(() => {
            if (!ignore) setIsReady(true)
          })
        }
      })
      .catch(err => {
        console.error('[LearningTrackDetail] Failed to load:', err)
        const message = err instanceof Error ? err.message : 'Failed to load track data'
        setLoadError(message)
        toast.error(message)
        if (!ignore) {
          requestAnimationFrame(() => setIsReady(true))
        }
      })

    return () => {
      ignore = true
    }
  }, [loadPaths, loadImportedCourses, loadAuthors])

  // Retry handler — clears error and reloads all data
  const handleRetry = useCallback(() => {
    setLoadError(null)
    setIsReady(false)

    Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
      .then(() => {
        requestAnimationFrame(() => setIsReady(true))
      })
      .catch(err => {
        console.error('[LearningTrackDetail] Retry failed:', err)
        const message = err instanceof Error ? err.message : 'Failed to load track data'
        setLoadError(message)
        toast.error(message)
        requestAnimationFrame(() => setIsReady(true))
      })
  }, [loadPaths, loadImportedCourses, loadAuthors])

  // Load thumbnail URLs when imported courses are available
  useLoadCourseThumbnails(importedCourses, loadThumbnailUrls)

  // Find the path
  const path = useMemo(() => paths.find(p => p.id === trackId), [paths, trackId])

  // Gate: only show "No courses yet" after React has committed a render where
  // isReady is true — prevents the empty state from flashing before Zustand
  // store updates (entries) are visible in the component tree.
  useEffect(() => {
    if (isReady && path) {
      const raf = requestAnimationFrame(() => setEntriesChecked(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [isReady, path])

  // Get sorted entries for this path
  const courseEntries = useMemo(
    () => (trackId ? getEntriesForPath(trackId) : []),
    [trackId, entries, getEntriesForPath]
  )

  // Load videos and progress for all courses in the path (for lesson accordions)
  useEffect(() => {
    if (!isReady || courseEntries.length === 0) return

    const courseIds = courseEntries.map(e => e.courseId).filter(Boolean)
    if (courseIds.length === 0) return

    let ignore = false

    Promise.all([
      Promise.all(
        courseIds.map(courseId =>
          db.importedVideos.where('courseId').equals(courseId).sortBy('order')
        )
      ).then(results => {
        const map = new Map<string, ImportedVideo[]>()
        courseIds.forEach((courseId, i) => {
          if (results[i].length > 0) map.set(courseId, results[i])
        })
        return map
      }),
      Promise.all(
        courseIds.map(courseId => db.importedPdfs.where('courseId').equals(courseId).toArray())
      ).then(results => {
        const map = new Map<string, ImportedPdf[]>()
        courseIds.forEach((courseId, i) => {
          map.set(courseId, results[i])
        })
        return map
      }),
      Promise.all(
        courseIds.map(courseId =>
          db.youtubeChapters
            .where('courseId')
            .equals(courseId)
            .sortBy('order')
            .catch(() => [] as YouTubeCourseChapter[])
        )
      ).then(results => {
        const map = new Map<string, YouTubeCourseChapter[]>()
        courseIds.forEach((courseId, i) => {
          map.set(courseId, results[i])
        })
        return map
      }),
      db.progress.toArray().then(records => {
        const map = new Map<string, VideoProgress>()
        for (const r of records) {
          if (r.videoId) map.set(r.videoId, r)
        }
        return map
      }),
    ])
      .then(([videoMap, pdfsMap, chaptersMap, progMap]) => {
        if (!ignore) {
          setVideosByCourse(videoMap)
          setPdfsByCourse(pdfsMap)
          setChaptersByCourse(chaptersMap)
          setVideoProgressMap(progMap)
        }
      })
      .catch(err => {
        console.error('[LearningTrackDetail] Failed to load videos:', err)
      })

    return () => {
      ignore = true
    }
  }, [isReady, courseEntries])

  // Real progress tracking from contentProgress (catalog) + progress table (imported)
  const pathProgress = usePathProgress(courseEntries)

  // Build course info lookup — uses real progress data
  const courseInfo = useMemo(() => {
    const map = new Map<string, PathCourseInfo>()

    for (const ic of importedCourses) {
      const authorName = ic.authorId ? authors.find(a => a.id === ic.authorId)?.name : undefined
      const cpInfo = pathProgress.courseProgress.get(ic.id)
      map.set(ic.id, {
        name: ic.name,
        type: 'imported',
        authorName,
        completionPct: cpInfo?.completionPct ?? 0,
        description: ic.description,
        videoCount: ic.videoCount,
        totalDuration: ic.totalDuration,
      })
    }

    // Add fallback entries for courses referenced in path entries but not in
    // importedCourses — prevents "Unknown Course" labels when courses have been
    // removed from the library but remain in the track.
    for (const entry of courseEntries) {
      if (!map.has(entry.courseId) && entry.courseId !== '') {
        map.set(entry.courseId, {
          name: 'Course',
          type: entry.courseType,
          authorName: undefined,
          completionPct: 0,
          description: undefined,
          videoCount: 0,
          totalDuration: 0,
        })
      }
    }

    return map
  }, [importedCourses, authors, pathProgress.courseProgress, courseEntries])

  /** Chapter/folder groups per course — matches CourseOverview syllabus grouping for track syllabus expanders. */
  const lessonGroupsByCourse = useMemo(() => {
    const map = new Map<string, ChapterGroup[]>()
    for (const [courseId, videos] of videosByCourse) {
      if (videos.length === 0) continue
      const course = importedCourses.find(c => c.id === courseId)
      const preferYoutube = (course?.source ?? 'local') === 'youtube'
      map.set(
        courseId,
        buildGroupedCurriculum({
          videos,
          pdfs: pdfsByCourse.get(courseId) ?? [],
          chapters: chaptersByCourse.get(courseId) ?? [],
          preferChapterGrouping: preferYoutube,
        })
      )
    }
    return map
  }, [videosByCourse, pdfsByCourse, chaptersByCourse, importedCourses])

  // Derived data
  const completedEntries = useMemo(
    () => courseEntries.filter(e => (courseInfo.get(e.courseId)?.completionPct ?? 0) >= 100),
    [courseEntries, courseInfo]
  )
  const currentEntry = useMemo(
    () =>
      courseEntries.find(e => {
        const pct = courseInfo.get(e.courseId)?.completionPct ?? 0
        return pct > 0 && pct < 100
      }) ??
      (courseEntries.length > completedEntries.length
        ? courseEntries[completedEntries.length]
        : null),
    [courseEntries, courseInfo, completedEntries.length]
  )

  // First non-gap course ID for hero CTA
  const firstCourseId = useMemo(
    () => courseEntries.find(e => e.courseId !== '')?.courseId ?? null,
    [courseEntries]
  )

  // Current in-progress course ID for hero CTA
  const currentCourseId = useMemo(() => {
    const inProgress = currentEntry?.courseId
    return inProgress && inProgress !== '' ? inProgress : null
  }, [currentEntry])

  // Compute the first incomplete lesson for the CTA course
  const targetLessonId = useMemo(() => {
    const ctaCourseId = currentCourseId ?? firstCourseId
    if (!ctaCourseId) return undefined

    const videos = videosByCourse.get(ctaCourseId)
    if (!videos || videos.length === 0) return undefined

    const sortedVideos = [...videos].sort((a, b) => a.order - b.order)
    const firstIncomplete = sortedVideos.find(v => {
      const prog = videoProgressMap.get(v.id)
      return (prog?.completionPercentage ?? 0) < 90
    })

    return firstIncomplete?.id ?? sortedVideos[0]?.id
  }, [currentCourseId, firstCourseId, videosByCourse, videoProgressMap])

  // First lesson for the ContinueLearningBento's current entry
  const currentEntryTargetLessonId = useMemo(() => {
    const courseId = currentEntry?.courseId
    if (!courseId) return undefined

    const videos = videosByCourse.get(courseId)
    if (!videos || videos.length === 0) return undefined

    const sortedVideos = [...videos].sort((a, b) => a.order - b.order)
    const firstIncomplete = sortedVideos.find(v => {
      const prog = videoProgressMap.get(v.id)
      return (prog?.completionPercentage ?? 0) < 90
    })

    return firstIncomplete?.id ?? sortedVideos[0]?.id
  }, [currentEntry, videosByCourse, videoProgressMap])

  // Map of courseId → first incomplete lesson ID, for PathTimeline navigation
  const firstLessonByCourse = useMemo(() => {
    const map = new Map<string, string>()
    for (const [courseId, videos] of videosByCourse) {
      if (videos.length === 0) continue
      const sortedVideos = [...videos].sort((a, b) => a.order - b.order)
      const firstIncomplete = sortedVideos.find(v => {
        const prog = videoProgressMap.get(v.id)
        return (prog?.completionPercentage ?? 0) < 90
      })
      map.set(courseId, firstIncomplete?.id ?? sortedVideos[0].id)
    }
    return map
  }, [videosByCourse, videoProgressMap])

  // Check prefers-reduced-motion
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = !prefersReducedMotion
  const containerVariants = shouldAnimate ? staggerContainer : { hidden: {}, visible: {} }
  const itemVariants = shouldAnimate ? fadeUp : { hidden: {}, visible: {} }

  // Loading state
  if (!isReady) {
    return (
      <DelayedFallback>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </DelayedFallback>
    )
  }

  // Error state — critical data (paths) failed to load
  if (loadError && !path) {
    return (
      <div className="space-y-6">
        <Link
          to="/learning-tracks"
          className="inline-flex items-center gap-2 text-brand font-medium hover:-translate-x-1 transition-transform"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Learning Tracks
        </Link>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="size-12 text-destructive mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold mb-2">Failed to load track</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md text-center">
            {loadError}
          </p>
          <Button variant="brand" onClick={handleRetry}>
            <RotateCcw className="size-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Path not found
  if (!path) {
    return (
      <div className="space-y-6">
        <Link
          to="/learning-tracks"
          className="inline-flex items-center gap-2 text-brand font-medium hover:-translate-x-1 transition-transform"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Learning Tracks
        </Link>
        <EmptyState
          icon={BookOpen}
          title="Track not found"
          description="This learning track does not exist or has been deleted."
          actionLabel="View All Tracks"
          onAction={() => {
            navigate('/learning-tracks')
          }}
        />
      </div>
    )
  }

  return (
    <>
      {/* Full-width hero banner — breaks out of Layout main padding */}
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
        <PathHeroBanner
          path={path}
          courseCount={courseEntries.length}
          completedCount={completedEntries.length}
          pathProgress={pathProgress}
          thumbnailUrls={thumbnailUrls}
          currentCourseId={currentCourseId}
          firstCourseId={firstCourseId}
          targetLessonId={targetLessonId}
          backUrl="/learning-tracks"
          backLabel="Back to Learning Tracks"
        />
      </div>

      {/* Content area with negative margin to overlap hero */}
      <div className="-mt-10 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Course list section */}
          {!entriesChecked ? (
            /* Brief hold during initial load — prevents flash of empty state
               before Zustand store entries are visible in this render cycle */
            null
          ) : courseEntries.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--content-gap)]">
              {/* Left Column (2/3): Continue Learning + Timeline */}
              <div className="lg:col-span-2 space-y-8">
                {/* Continue Learning Bento Card */}
                {currentEntry && (
                  <motion.section variants={itemVariants}>
                    <ContinueLearningBento
                      entry={currentEntry}
                      courseInfo={courseInfo.get(currentEntry.courseId)}
                      thumbnailUrl={thumbnailUrls[currentEntry.courseId]}
                      targetLessonId={currentEntryTargetLessonId}
                    />
                  </motion.section>
                )}

                {/* Path Complete Banner */}
                {!currentEntry && courseEntries.length > 0 && (
                  <motion.div variants={itemVariants}>
                    <div className="bg-success-soft border border-success/20 rounded-2xl p-4 flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-success flex-shrink-0" aria-hidden="true" />
                      <p className="text-sm font-medium text-success">All courses completed!</p>
                    </div>
                  </motion.div>
                )}

                {/* Syllabus Card */}
                <motion.section variants={itemVariants}>
                  <div className="bg-card rounded-2xl shadow-sm border border-border p-6 lg:p-8">
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="font-display text-2xl font-bold">Syllabus</h2>
                      <span className="text-muted-foreground text-sm">
                        {courseEntries.length} {courseEntries.length === 1 ? 'Course' : 'Courses'}
                      </span>
                    </div>

                    {/* Timeline (read-only — no drag-and-drop, no gap resolution) */}
                    <PathTimeline
                      entries={courseEntries.map(e => ({
                        ...e,
                        info: courseInfo.get(e.courseId),
                      }))}
                      courseInfoMap={courseInfo}
                      gapEntries={courseEntries.filter(e => e.courseId === '')}
                      onGapResolve={() => {}}
                      onCourseClick={courseId => {
                        const lessonId = firstLessonByCourse.get(courseId)
                        if (lessonId) {
                          navigate(`/courses/${courseId}/lessons/${lessonId}`)
                        } else {
                          navigate(`/courses/${courseId}`)
                        }
                      }}
                      autoScrollToCurrent
                      videosByCourse={videosByCourse}
                      lessonGroupsByCourse={lessonGroupsByCourse}
                      videoProgressMap={videoProgressMap}
                    />
                  </div>
                </motion.section>
              </div>

              {/* Right Column (1/3): Progress Sidebar */}
              <aside className="lg:col-span-1 space-y-6">
                <PathProgressSidebar
                  progress={pathProgress}
                  difficultyLabel={path.difficultyLabel}
                  estimatedHours={path.estimatedHours}
                  courseCount={courseEntries.length}
                  createdAt={path.createdAt}
                  updatedAt={path.updatedAt}
                />
              </aside>
            </div>
          ) : (
            /* Empty path (no courses) */
            <motion.div variants={itemVariants}>
              <Card className="rounded-2xl shadow-sm border border-border">
                <CardContent className="p-8 text-center">
                  <BookOpen className="size-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    This track doesn&apos;t have any courses yet. Add courses to start tracking your progress.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  )
}
