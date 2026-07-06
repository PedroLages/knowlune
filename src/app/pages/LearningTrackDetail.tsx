import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import {
  BookOpen,
  Trophy,
  ArrowLeft,
  AlertCircle,
  RotateCcw,
  Map as MapIcon,
  Layers,
  ListVideo,
  FolderKanban,
  StickyNote,
} from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import { PathProgressSidebar } from '@/app/components/learning-path/PathProgressSidebar'
import { ProgressionModeToggle } from '@/app/components/learning-path/ProgressionModeToggle'
import { ContinueLearningBento } from '@/app/components/learning-path/ContinueLearningBento'
import { PathTimeline } from '@/app/components/learning-path/PathTimeline'
import { RoadmapPhases, type RoadmapPhase } from '@/app/components/learning-path/RoadmapPhases'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { usePathProgress } from '@/app/hooks/usePathProgress'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
import { useManualModuleCompletion } from '@/app/hooks/useManualModuleCompletion'
import { getPathCourseThumbnailUrls } from '@/lib/learningPathThumbnails'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { toast } from 'sonner'
import { db } from '@/db'
import { buildGroupedCurriculum, type ChapterGroup } from '@/lib/curriculumGrouping'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { findFirstIncompleteLesson } from '@/lib/resumeLearning'
import type {
  PathCourseInfo,
  PathProgressionMode,
  ImportedVideo,
  ImportedPdf,
  VideoProgress,
  YouTubeCourseChapter,
} from '@/data/types'

export function LearningTrackDetail() {
  const { trackId } = useParams<{ trackId: string }>()
  const navigate = useNavigate()
  const paths = useLearningPathStore(s => s.paths)
  const loadPaths = useLearningPathStore(s => s.loadPaths)
  const reorderPathCourses = useLearningPathStore(s => s.reorderPathCourses)
  const setProgressionMode = useLearningPathStore(s => s.setProgressionMode)
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const { authors, loadAuthors } = useAuthorStore()
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [videosByCourse, setVideosByCourse] = useState<Map<string, ImportedVideo[]>>(new Map())
  const [pdfsByCourse, setPdfsByCourse] = useState<Map<string, ImportedPdf[]>>(new Map())
  const [chaptersByCourse, setChaptersByCourse] = useState<Map<string, YouTubeCourseChapter[]>>(
    new Map()
  )
  const [videoProgressMap, setVideoProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  const statusMap = useContentProgressStore(s => s.statusMap)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)
  const [loadedCourseIds, setLoadedCourseIds] = useState<Set<string>>(new Set())
  // Prevents "No courses yet" flash during initial load by waiting until
  // React has committed at least one render after isReady flips to true —
  // ensures Zustand store updates (entries) are visible before deciding emptiness.
  const [entriesChecked, setEntriesChecked] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

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

  const courseEntries = useLearningPathStore(
    useShallow(
      useCallback(
        state =>
          trackId
            ? state.entries
                .filter(e => e.pathId === trackId)
                .sort((a, b) => a.position - b.position)
            : [],
        [trackId]
      )
    )
  )

  const heroCourseThumbnails = useMemo(
    () => getPathCourseThumbnailUrls(courseEntries, thumbnailUrls, 4),
    [courseEntries, thumbnailUrls]
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

  // Load contentProgress for all courses in the path (primary resume-point source)
  useEffect(() => {
    if (!isReady || courseEntries.length === 0) return

    const courseIds = courseEntries.map(e => e.courseId).filter(Boolean)
    const loadingSet = new Set<string>()

    let ignore = false

    async function loadContentProgress() {
      const batchSize = 10
      for (let i = 0; i < courseIds.length; i += batchSize) {
        if (ignore) return
        const batch = courseIds.slice(i, i + batchSize)
        await Promise.allSettled(batch.map(id => loadCourseProgress(id)))
        batch.forEach(id => loadingSet.add(id))
        if (!ignore) {
          setLoadedCourseIds(new Set(loadingSet))
        }
      }
    }

    loadContentProgress()

    return () => {
      ignore = true
    }
  }, [isReady, courseEntries, loadCourseProgress])

  // Real progress tracking from contentProgress (catalog) + progress table (imported)
  const pathProgress = usePathProgress(courseEntries)

  // Manual module completion (localStorage-backed, per-track)
  const {
    completedIds: manuallyCompletedIds,
    markComplete,
    undoComplete,
  } = useManualModuleCompletion(trackId ?? '')

  // Count manually completed entries not already counted in auto-progress
  const manualCompletionsNotInAuto = useMemo(() => {
    let count = 0
    for (const entry of courseEntries) {
      if (entry.courseId === '') continue
      const autoCompleted =
        (pathProgress.courseProgress.get(entry.courseId)?.completionPct ?? 0) >= 100
      if (!autoCompleted && manuallyCompletedIds.has(entry.id)) count++
    }
    return count
  }, [courseEntries, pathProgress.courseProgress, manuallyCompletedIds])

  // Enhanced progress that includes manual completions.
  // completionPct from the hook is lesson-level and correct; the previous override
  // with (completedCourses / totalCourses) * 100 incorrectly left the ring at 0 %
  // for the entire first course. Only completedCourses is adjusted here.
  const enhancedProgress = useMemo(() => {
    const completedCourses = pathProgress.completedCourses + manualCompletionsNotInAuto
    return {
      ...pathProgress,
      completedCourses,
      totalCourses: Math.max(pathProgress.totalCourses, 1),
    }
  }, [pathProgress, manualCompletionsNotInAuto])

  // Dismiss any active undo toast on unmount to prevent stale closures
  const activeToastRef = useRef<string | number | null>(null)
  useEffect(() => {
    return () => {
      if (activeToastRef.current !== null) {
        toast.dismiss(activeToastRef.current)
      }
    }
  }, [])

  // Toggle manual completion for a module entry
  const handleMarkComplete = useCallback(
    (entryId: string) => {
      if (manuallyCompletedIds.has(entryId)) {
        undoComplete(entryId)
        toast.success('Module completion undone')
      } else {
        markComplete(entryId)
        const toastId = toast.success('Module marked as complete', {
          action: {
            label: 'Undo',
            onClick: () => undoComplete(entryId),
          },
          duration: 5000,
        })
        activeToastRef.current = toastId
      }
    },
    [manuallyCompletedIds, markComplete, undoComplete]
  )

  const handleProgressionModeChange = useCallback(
    (mode: PathProgressionMode) => {
      if (!trackId) return
      setProgressionMode(trackId, mode)
    },
    [trackId, setProgressionMode]
  )

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

  // Derived data — manual completions count toward completed entries
  const completedEntries = useMemo(
    () =>
      courseEntries.filter(
        e =>
          (courseInfo.get(e.courseId)?.completionPct ?? 0) >= 100 || manuallyCompletedIds.has(e.id)
      ),
    [courseEntries, courseInfo, manuallyCompletedIds]
  )
  const completedEntryIds = useMemo(
    () => new Set(completedEntries.map(e => e.id)),
    [completedEntries]
  )
  const currentEntry = useMemo(
    () =>
      courseEntries.find(e => {
        if (e.courseId === '') return false
        const pct = courseInfo.get(e.courseId)?.completionPct ?? 0
        return pct > 0 && pct < 100 && !manuallyCompletedIds.has(e.id)
      }) ??
      (courseEntries.length > completedEntries.length
        ? (courseEntries.find(
            e =>
              e.courseId !== '' && !manuallyCompletedIds.has(e.id) && !completedEntryIds.has(e.id)
          ) ?? null)
        : null),
    [courseEntries, courseInfo, completedEntries, completedEntryIds, manuallyCompletedIds]
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

  // Compute the first incomplete lesson for the CTA course.
  // Uses contentProgress (statusMap) as primary source, with legacy progress table fallback.
  // Returns undefined during contentProgress loading to preserve skeleton/spinner state.
  const targetLessonId = useMemo(() => {
    const ctaCourseId = currentCourseId ?? firstCourseId
    if (!ctaCourseId) return undefined

    const videos = videosByCourse.get(ctaCourseId) ?? []
    const pdfs = pdfsByCourse.get(ctaCourseId) ?? []

    // If no lessons at all, return undefined (nothing to navigate to)
    if (videos.length === 0 && pdfs.length === 0) return undefined

    // If contentProgress hasn't loaded yet for this course, return undefined
    // (loading sentinel — UI preserves skeleton/spinner)
    if (!loadedCourseIds.has(ctaCourseId)) return undefined

    const progressList = [...videoProgressMap.values()].filter(p => p.courseId === ctaCourseId)

    return (
      findFirstIncompleteLesson(ctaCourseId, statusMap, progressList, videos, pdfs) ??
      videos[0]?.id ??
      pdfs[0]?.id
    )
  }, [
    currentCourseId,
    firstCourseId,
    videosByCourse,
    pdfsByCourse,
    videoProgressMap,
    statusMap,
    loadedCourseIds,
  ])

  // First lesson for the ContinueLearningBento's current entry.
  // Uses contentProgress (statusMap) as primary source, with legacy progress table fallback.
  const currentEntryTargetLessonId = useMemo(() => {
    const courseId = currentEntry?.courseId
    if (!courseId) return undefined

    const videos = videosByCourse.get(courseId) ?? []
    const pdfs = pdfsByCourse.get(courseId) ?? []

    // If no lessons at all, return undefined
    if (videos.length === 0 && pdfs.length === 0) return undefined

    // If contentProgress hasn't loaded yet for this course, return undefined
    // (loading sentinel — preserves skeleton/spinner)
    if (!loadedCourseIds.has(courseId)) return undefined

    const progressList = [...videoProgressMap.values()].filter(p => p.courseId === courseId)

    return (
      findFirstIncompleteLesson(courseId, statusMap, progressList, videos, pdfs) ??
      videos[0]?.id ??
      pdfs[0]?.id
    )
  }, [currentEntry, videosByCourse, pdfsByCourse, videoProgressMap, statusMap, loadedCourseIds])

  // Map of courseId → first incomplete lesson ID, for PathTimeline navigation.
  // Uses contentProgress (statusMap) as primary source, with legacy progress table fallback.
  // Courses without loaded contentProgress are skipped (no entry in the map) — the
  // PathTimeline's onCourseClick navigates to the course overview in that case.
  const firstLessonByCourse = useMemo(() => {
    const map = new Map<string, string>()
    for (const [courseId, videos] of videosByCourse) {
      if (!loadedCourseIds.has(courseId)) continue
      const pdfs = pdfsByCourse.get(courseId) ?? []
      const progressList = [...videoProgressMap.values()].filter(p => p.courseId === courseId)
      const lessonId =
        findFirstIncompleteLesson(courseId, statusMap, progressList, videos, pdfs) ??
        videos[0]?.id ??
        pdfs[0]?.id
      if (lessonId) {
        map.set(courseId, lessonId)
      }
    }
    return map
  }, [videosByCourse, pdfsByCourse, videoProgressMap, statusMap, loadedCourseIds])

  // ── New computed values for improved UX ──

  // Next lesson title for the ContinueLearningBento
  const nextLessonTitle = useMemo(() => {
    const courseId = currentEntry?.courseId
    if (!courseId) return undefined
    const videos = videosByCourse.get(courseId)
    if (!videos || videos.length === 0) return undefined
    const targetId = currentEntryTargetLessonId
    if (!targetId) return undefined
    const video = videos.find(v => v.id === targetId)
    return video?.filename?.replace(/\.\w+$/, '') ?? undefined
  }, [currentEntry, videosByCourse, currentEntryTargetLessonId])

  // Lessons remaining in current course
  const currentCourseLessonsRemaining = useMemo(() => {
    const courseId = currentEntry?.courseId
    if (!courseId) return undefined
    const videos = videosByCourse.get(courseId) ?? []
    if (videos.length === 0) return undefined
    const progressList = [...videoProgressMap.values()].filter(p => p.courseId === courseId)
    const completedCount = progressList.filter(p => p.completionPercentage >= 90).length
    return Math.max(0, videos.length - completedCount)
  }, [currentEntry, videosByCourse, videoProgressMap])

  // Estimated remaining minutes for current course
  const currentCourseRemainingMinutes = useMemo(() => {
    const courseId = currentEntry?.courseId
    if (!courseId) return undefined
    const videos = videosByCourse.get(courseId) ?? []
    if (videos.length === 0) return undefined
    const progressList = [...videoProgressMap.values()].filter(p => p.courseId === courseId)
    const completedIds = new Set(
      progressList.filter(p => p.completionPercentage >= 90).map(p => p.videoId)
    )
    const remainingSeconds = videos
      .filter(v => !completedIds.has(v.id))
      .reduce((sum, v) => sum + v.duration, 0)
    return Math.round(remainingSeconds / 60)
  }, [currentEntry, videosByCourse, videoProgressMap])

  // Current course info for sidebar
  const currentCourseName = useMemo(() => {
    if (!currentEntry?.courseId) return undefined
    return courseInfo.get(currentEntry.courseId)?.name
  }, [currentEntry, courseInfo])

  const currentCoursePct = useMemo(() => {
    if (!currentEntry?.courseId) return undefined
    return courseInfo.get(currentEntry.courseId)?.completionPct
  }, [currentEntry, courseInfo])

  // Next milestone (first non-completed course)
  const nextMilestoneName = useMemo(() => {
    const next = courseEntries.find(e => {
      if (e.courseId === '') return false
      const pct = courseInfo.get(e.courseId)?.completionPct ?? 0
      if (pct >= 100) return false
      if (manuallyCompletedIds.has(e.id)) return false
      return e.courseId !== currentEntry?.courseId
    })
    return next ? courseInfo.get(next.courseId)?.name : undefined
  }, [courseEntries, courseInfo, manuallyCompletedIds, currentEntry])

  // Roadmap phases — derive from course entries by splitting into groups of ~4
  const roadmapPhases = useMemo((): RoadmapPhase[] => {
    const nonGapCourses = courseEntries.filter(e => e.courseId !== '')
    if (nonGapCourses.length === 0) return []

    // Auto-derive phases from course groupings (every ~4 courses = 1 phase)
    const PHASE_SIZE = 4
    const phaseLabels = [
      'Foundation',
      'Core Skills',
      'Advanced Topics',
      'Specialization',
      'Mastery',
    ]
    const phases: RoadmapPhase[] = []

    for (let i = 0; i < nonGapCourses.length; i += PHASE_SIZE) {
      const chunk = nonGapCourses.slice(i, i + PHASE_SIZE)
      const phaseIdx = Math.floor(i / PHASE_SIZE)
      phases.push({
        name: phaseLabels[phaseIdx] ?? `Phase ${phaseIdx + 1}`,
        description: `${chunk.length} ${chunk.length === 1 ? 'course' : 'courses'}`,
        courseIds: chunk.map(e => e.courseId),
      })
    }
    return phases
  }, [courseEntries])

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
          <p className="text-muted-foreground text-sm mb-6 max-w-md text-center">{loadError}</p>
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
      {/* Full-width hero banner — breaks out of Layout main padding. */}
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
        <PathHeroBanner
          path={path}
          courseCount={courseEntries.length}
          completedCount={completedEntries.length}
          pathProgress={enhancedProgress}
          orderedCourseThumbnails={heroCourseThumbnails}
          currentCourseId={currentCourseId}
          firstCourseId={firstCourseId}
          targetLessonId={targetLessonId}
          backUrl="/learning-tracks"
          backLabel="Back to Learning Tracks"
          trackId={trackId}
          trackName={path.name}
          currentCourseName={currentCourseName}
          nextLessonTitle={nextLessonTitle}
        />
      </div>

      {/* Content area */}
      <div className="-mt-6 sm:-mt-8 lg:-mt-10 relative z-10 max-w-[1440px] mx-auto w-full">
        {!entriesChecked ? null : courseEntries.length > 0 ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Tab bar — sticky below hero */}
            <div className="sticky top-0 z-20 -mx-2 px-2 py-2 bg-background/95 backdrop-blur-sm border-b border-border overflow-x-auto">
              <TabsList className="w-full sm:w-auto inline-flex h-12 p-1 bg-muted/50 rounded-2xl gap-1">
                <TabsTrigger
                  value="overview"
                  className="h-9 rounded-xl px-4 text-sm font-medium gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-none"
                >
                  <Layers className="size-[18px]" aria-hidden="true" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger
                  value="roadmap"
                  className="h-9 rounded-xl px-4 text-sm font-medium gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-none"
                >
                  <MapIcon className="size-[18px]" aria-hidden="true" />
                  <span className="hidden sm:inline">Roadmap</span>
                </TabsTrigger>
                <TabsTrigger
                  value="courses"
                  className="h-9 rounded-xl px-4 text-sm font-medium gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-none"
                >
                  <ListVideo className="size-[18px]" aria-hidden="true" />
                  <span className="hidden sm:inline">Courses</span>
                </TabsTrigger>
                <TabsTrigger
                  value="projects"
                  className="h-9 rounded-xl px-4 text-sm font-medium gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-none"
                >
                  <FolderKanban className="size-[18px]" aria-hidden="true" />
                  <span className="hidden sm:inline">Projects</span>
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="h-9 rounded-xl px-4 text-sm font-medium gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm transition-none"
                >
                  <StickyNote className="size-[18px]" aria-hidden="true" />
                  <span className="hidden sm:inline">Notes</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="mt-0">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--content-gap)]">
                  {/* Left Column (2/3) */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Continue Learning Bento */}
                    {currentEntry && (
                      <motion.section variants={itemVariants}>
                        <ContinueLearningBento
                          entry={currentEntry}
                          courseInfo={courseInfo.get(currentEntry.courseId)}
                          thumbnailUrl={thumbnailUrls[currentEntry.courseId]}
                          targetLessonId={currentEntryTargetLessonId}
                          trackId={trackId}
                          trackName={path.name}
                          coursePosition={courseEntries.indexOf(currentEntry) + 1}
                          totalCourses={courseEntries.length}
                          nextLessonTitle={nextLessonTitle}
                          lessonsRemaining={currentCourseLessonsRemaining}
                          estimatedRemainingMinutes={currentCourseRemainingMinutes}
                        />
                      </motion.section>
                    )}

                    {/* Path Complete Banner */}
                    {!currentEntry && courseEntries.length > 0 && (
                      <motion.div variants={itemVariants}>
                        <div className="bg-success-soft border border-success/20 rounded-2xl p-4 flex items-center gap-3">
                          <Trophy
                            className="w-5 h-5 text-success flex-shrink-0"
                            aria-hidden="true"
                          />
                          <p className="text-sm font-medium text-success">All courses completed!</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Motivation message */}
                    {currentEntry && (
                      <motion.div variants={itemVariants}>
                        <div className="bg-card rounded-2xl border border-border/50 p-4 shadow-card-ambient">
                          <p className="text-sm text-muted-foreground">
                            {currentCoursePct != null && currentCoursePct > 0
                              ? `You're making progress on ${currentCourseName ?? 'your current course'}. Keep going!`
                              : `You started your learning path. Dive into ${currentCourseName ?? 'your first course'} to begin.`}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Right Column (1/3): Progress Sidebar */}
                  <aside className="lg:col-span-1 space-y-6">
                    <PathProgressSidebar
                      progress={enhancedProgress}
                      difficultyLabel={path.difficultyLabel}
                      estimatedHours={path.estimatedHours}
                      courseCount={courseEntries.length}
                      createdAt={path.createdAt}
                      updatedAt={path.updatedAt}
                      progressionMode={path.progressionMode}
                      onProgressionModeChange={handleProgressionModeChange}
                      currentCourseName={currentCourseName}
                      currentCoursePct={currentCoursePct}
                      nextMilestoneName={nextMilestoneName}
                      nextMilestoneEstimate={
                        nextMilestoneName ? 'Keep studying to reach this milestone' : undefined
                      }
                      tab={activeTab}
                    />
                  </aside>
                </div>

                {/* ── Courses / Curriculum ── */}
                <motion.section variants={itemVariants}>
                  <div className="bg-card rounded-[24px] shadow-card-ambient border border-border/50 p-6 lg:p-8 relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand/60 to-brand/20 pointer-events-none"
                      aria-hidden="true"
                    />
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="font-display text-2xl font-bold">Courses</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">
                          {courseEntries.length} {courseEntries.length === 1 ? 'Course' : 'Courses'}
                        </span>
                        <ProgressionModeToggle
                          mode={path.progressionMode ?? 'sequential'}
                          onChange={handleProgressionModeChange}
                        />
                        <Button
                          variant={isEditing ? 'brand' : 'ghost'}
                          size="sm"
                          onClick={() => setIsEditing(!isEditing)}
                          data-testid="edit-courses-button"
                        >
                          {isEditing ? 'Done' : 'Edit'}
                        </Button>
                      </div>
                    </div>
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
                        const fromTrackState = {
                          fromTrack: { trackId: trackId ?? '', trackName: path.name },
                        }
                        if (lessonId) {
                          navigate(`/courses/${courseId}/lessons/${lessonId}`, {
                            state: fromTrackState,
                          })
                        } else {
                          navigate(`/courses/${courseId}`, { state: fromTrackState })
                        }
                      }}
                      autoScrollToCurrent
                      videosByCourse={videosByCourse}
                      lessonGroupsByCourse={lessonGroupsByCourse}
                      videoProgressMap={videoProgressMap}
                      manuallyCompletedIds={manuallyCompletedIds}
                      onMarkComplete={handleMarkComplete}
                      editable={isEditing}
                      onReorderByCourseId={(activeCourseId, overCourseId) =>
                        reorderPathCourses(trackId ?? '', activeCourseId, overCourseId)
                      }
                      progressionMode={path.progressionMode}
                    />
                  </div>
                </motion.section>
              </motion.div>
            </TabsContent>

            {/* ── Courses Tab ── */}
            <TabsContent value="courses" className="mt-0">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-8"
              >
                <motion.section variants={itemVariants}>
                  <div className="bg-card rounded-[24px] shadow-card-ambient border border-border/50 p-6 lg:p-8 relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand/60 to-brand/20 pointer-events-none"
                      aria-hidden="true"
                    />
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="font-display text-2xl font-bold">Courses</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">
                          {courseEntries.length} {courseEntries.length === 1 ? 'Course' : 'Courses'}
                        </span>
                        <ProgressionModeToggle
                          mode={path.progressionMode ?? 'sequential'}
                          onChange={handleProgressionModeChange}
                        />
                        <Button
                          variant={isEditing ? 'brand' : 'ghost'}
                          size="sm"
                          onClick={() => setIsEditing(!isEditing)}
                          data-testid="edit-courses-button"
                        >
                          {isEditing ? 'Done' : 'Edit'}
                        </Button>
                      </div>
                    </div>
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
                        const fromTrackState = {
                          fromTrack: { trackId: trackId ?? '', trackName: path.name },
                        }
                        if (lessonId) {
                          navigate(`/courses/${courseId}/lessons/${lessonId}`, {
                            state: fromTrackState,
                          })
                        } else {
                          navigate(`/courses/${courseId}`, { state: fromTrackState })
                        }
                      }}
                      autoScrollToCurrent
                      videosByCourse={videosByCourse}
                      lessonGroupsByCourse={lessonGroupsByCourse}
                      videoProgressMap={videoProgressMap}
                      manuallyCompletedIds={manuallyCompletedIds}
                      onMarkComplete={handleMarkComplete}
                      editable={isEditing}
                      onReorderByCourseId={(activeCourseId, overCourseId) =>
                        reorderPathCourses(trackId ?? '', activeCourseId, overCourseId)
                      }
                      progressionMode={path.progressionMode}
                    />
                  </div>
                </motion.section>
              </motion.div>
            </TabsContent>

            {/* ── Roadmap Tab ── */}
            <TabsContent value="roadmap" className="mt-0">
              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <motion.section variants={itemVariants}>
                  <div className="bg-card rounded-[24px] shadow-card-ambient border border-border/50 p-6 lg:p-8 relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand/60 to-brand/20 pointer-events-none"
                      aria-hidden="true"
                    />
                    <h2 className="font-display text-2xl font-bold mb-6">Your Learning Roadmap</h2>
                    <RoadmapPhases
                      entries={courseEntries}
                      courseInfoMap={courseInfo}
                      phases={roadmapPhases}
                      trackId={trackId ?? ''}
                      trackName={path.name}
                      currentCourseId={currentCourseId}
                    />
                  </div>
                </motion.section>
              </motion.div>
            </TabsContent>

            {/* ── Projects Tab (placeholder) ── */}
            <TabsContent value="projects" className="mt-0">
              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <motion.section variants={itemVariants}>
                  <Card className="rounded-[24px] shadow-card-ambient border border-border/50">
                    <CardContent className="p-8 text-center">
                      <FolderKanban
                        className="size-12 text-muted-foreground mx-auto mb-4"
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-semibold mb-2">Projects & Labs</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Portfolio projects, hands-on labs, and capstone tasks will appear here as
                        you progress through your courses.
                      </p>
                    </CardContent>
                  </Card>
                </motion.section>
              </motion.div>
            </TabsContent>

            {/* ── Notes Tab (placeholder) ── */}
            <TabsContent value="notes" className="mt-0">
              <motion.div variants={containerVariants} initial="hidden" animate="visible">
                <motion.section variants={itemVariants}>
                  <Card className="rounded-[24px] shadow-card-ambient border border-border/50">
                    <CardContent className="p-8 text-center">
                      <StickyNote
                        className="size-12 text-muted-foreground mx-auto mb-4"
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-semibold mb-2">Your Notes</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Notes you take during lessons will be organized here by course and lesson.
                      </p>
                    </CardContent>
                  </Card>
                </motion.section>
              </motion.div>
            </TabsContent>
          </Tabs>
        ) : (
          /* Empty path (no courses) */
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <motion.div variants={itemVariants}>
              <Card className="rounded-2xl shadow-sm border border-border">
                <CardContent className="p-8 text-center">
                  <BookOpen
                    className="size-12 text-muted-foreground mx-auto mb-4"
                    aria-hidden="true"
                  />
                  <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    This track doesn&apos;t have any courses yet. Add courses to start tracking your
                    progress.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </div>
    </>
  )
}
