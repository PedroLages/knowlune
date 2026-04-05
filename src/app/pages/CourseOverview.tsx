/**
 * CourseOverview — Visually rich course landing page with hero section,
 * stats, curriculum accordion, and call-to-action.
 *
 * Uses the adapter pattern (never checks `course.source` directly).
 * Reuses CTA logic from E91-S01 (getLastWatchedLesson / getFirstLesson).
 *
 * @see E91-S10
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Play,
  PlayCircle,
  Video,
  CheckCircle2,
} from 'lucide-react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { db } from '@/db'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import { getLastWatchedLesson, getFirstLesson } from '@/lib/progress'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { StudyScheduleEditor } from '@/app/components/figma/StudyScheduleEditor'
import { formatClockDuration as formatDuration } from '@/lib/formatDuration'
import type { ImportedVideo, ImportedPdf, VideoProgress, YouTubeCourseChapter } from '@/data/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPLETION_THRESHOLD = 90

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

function stripExtension(filename: string): string {
  return filename.replace(/\.\w+$/, '')
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

interface ChapterGroup {
  title: string
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
}

function groupByFolder(videos: ImportedVideo[], pdfs: ImportedPdf[] = []): ChapterGroup[] {
  const videoGroups = new Map<string, ImportedVideo[]>()
  const pdfGroups = new Map<string, ImportedPdf[]>()

  for (const video of videos) {
    const folder = getFolderName(video.path)
    if (!videoGroups.has(folder)) videoGroups.set(folder, [])
    videoGroups.get(folder)!.push(video)
  }

  for (const pdf of pdfs) {
    const folder = getFolderName(pdf.path)
    if (!pdfGroups.has(folder)) pdfGroups.set(folder, [])
    pdfGroups.get(folder)!.push(pdf)
  }

  const allFolders = new Set([...videoGroups.keys(), ...pdfGroups.keys()])
  return Array.from(allFolders)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(title => ({
      title,
      videos: videoGroups.get(title) ?? [],
      pdfs: pdfGroups.get(title) ?? [],
    }))
}

function groupByChapter(videos: ImportedVideo[], chapters: YouTubeCourseChapter[]): ChapterGroup[] {
  if (chapters.length === 0) return [{ title: '', videos, pdfs: [] }]

  const videoChapterMap = new Map<string, string>()
  for (const ch of chapters) {
    if (!videoChapterMap.has(ch.videoId)) {
      videoChapterMap.set(ch.videoId, ch.title)
    }
  }

  const groups: ChapterGroup[] = []
  let currentTitle = ''
  let currentVideos: ImportedVideo[] = []

  for (const video of videos) {
    const chTitle = videoChapterMap.get(video.youtubeVideoId ?? '') ?? ''
    if (chTitle !== currentTitle && currentVideos.length > 0) {
      groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
      currentVideos = []
    }
    currentTitle = chTitle
    currentVideos.push(video)
  }
  if (currentVideos.length > 0) {
    groups.push({ title: currentTitle, videos: currentVideos, pdfs: [] })
  }

  return groups
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CourseOverview() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  const { adapter, loading: adapterLoading, error: adapterError } = useCourseAdapter(courseId)
  const course = adapter?.getCourse()
  const capabilities = adapter?.getCapabilities()
  const adapterAuthorInfo = adapter?.getAuthorInfo() ?? null

  const storeAuthors = useAuthorStore(s => s.authors)
  const loadAuthors = useAuthorStore(s => s.loadAuthors)
  useLazyStore(loadAuthors)

  // Content state
  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [pdfs, setPdfs] = useState<ImportedPdf[]>([])
  const [chapters, setChapters] = useState<YouTubeCourseChapter[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  const [contentLoading, setContentLoading] = useState(true)

  // CTA state
  const [ctaVariant, setCtaVariant] = useState<'start' | 'continue' | 'review' | undefined>()
  const [ctaLessonId, setCtaLessonId] = useState<string | undefined>()
  const [ctaLessonTitle, setCtaLessonTitle] = useState<string | undefined>()

  // Accordion state
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]))

  // Schedule editor state
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false)

  // Load content
  useEffect(() => {
    if (!courseId) return
    let ignore = false

    Promise.all([
      db.importedVideos.where('courseId').equals(courseId).sortBy('order'),
      db.importedPdfs.where('courseId').equals(courseId).toArray(),
      // silent-catch-ok — youtubeChapters may not exist for local courses
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
        // silent-catch-ok — error state handled by UI
        console.error('[CourseOverview] Failed to load:', err)
        if (!ignore) setContentLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [courseId])

  // CTA resolution
  useEffect(() => {
    if (!courseId || !adapter || contentLoading) return
    let ignore = false

    async function resolveCta() {
      try {
        const lastWatched = await getLastWatchedLesson(courseId!)
        if (ignore) return

        if (lastWatched) {
          const allCompleted =
            videos.length > 0 &&
            videos.every(
              v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= COMPLETION_THRESHOLD
            )
          setCtaVariant(allCompleted ? 'review' : 'continue')
          setCtaLessonId(lastWatched.lessonId)
          setCtaLessonTitle(lastWatched.lessonTitle)
        } else {
          const first = await getFirstLesson(adapter!)
          if (ignore) return
          if (first) {
            setCtaVariant('start')
            setCtaLessonId(first.lessonId)
            setCtaLessonTitle(first.lessonTitle)
          }
        }
      } catch (err) {
        console.error('[CourseOverview CTA] Failed:', err)
        toast.error('Could not determine course progress.')
        setCtaVariant('start')
      }
    }

    resolveCta()
    return () => {
      ignore = true
    }
  }, [courseId, adapter, contentLoading, videos, progressMap])

  // Derived data
  const authorData = useMemo(() => {
    if (!course?.authorId) return undefined
    const a = storeAuthors.find(x => x.id === course.authorId)
    return a ? { id: a.id, name: a.name, title: a.title, photoUrl: a.photoUrl } : undefined
  }, [course?.authorId, storeAuthors])

  const totalDuration = useMemo(
    () => videos.reduce((sum, v) => sum + (v.duration || 0), 0),
    [videos]
  )

  const completedCount = useMemo(
    () =>
      videos.filter(v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= COMPLETION_THRESHOLD)
        .length,
    [videos, progressMap]
  )

  const groupedContent = useMemo(() => {
    if (capabilities?.requiresNetwork && chapters.length > 0) {
      return groupByChapter(videos, chapters)
    }
    return groupByFolder(videos, capabilities?.requiresNetwork ? [] : pdfs)
  }, [videos, pdfs, chapters, capabilities?.requiresNetwork])

  const toggleModule = useCallback((index: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // Determine module status for timeline dots (must be before early returns — Rules of Hooks)
  const moduleStatuses = useMemo(() => {
    let foundActive = false
    return groupedContent.map(group => {
      const groupVideos = group.videos
      const allCompleted =
        groupVideos.length > 0 &&
        groupVideos.every(
          v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= COMPLETION_THRESHOLD
        )
      if (allCompleted) return 'completed' as const
      if (!foundActive) {
        foundActive = true
        return 'active' as const
      }
      return 'upcoming' as const
    })
  }, [groupedContent, progressMap])

  // Loading
  if (adapterLoading || contentLoading) {
    return (
      <div
        className="max-w-6xl mx-auto px-4 py-8 space-y-6"
        role="status"
        aria-busy="true"
        aria-label="Loading course overview"
      >
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[280px] w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }

  // Error / not found
  if (adapterError || !adapter || !course) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <BookOpen className="size-16 text-muted-foreground/50" aria-hidden="true" />
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

  const ctaLabel =
    ctaVariant === 'start'
      ? 'Start Course'
      : ctaVariant === 'continue' && ctaLessonTitle
        ? `Resume: ${ctaLessonTitle}`
        : ctaVariant === 'continue'
          ? 'Continue Learning'
          : ctaVariant === 'review'
            ? 'Review Course'
            : null

  const overallPercent = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0

  const totalLessons = videos.length + pdfs.length
  const authorName = adapterAuthorInfo?.name ?? authorData?.name

  return (
    <div
      data-testid="course-overview-page"
      className="w-full min-h-screen pb-20 bg-surface-sunken rounded-2xl overflow-hidden"
    >
      {/* Cinematic Hero Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative h-[45vh] min-h-[400px] w-full bg-surface-sunken flex flex-col items-center justify-center text-center px-6 overflow-hidden border-b border-border/60"
        data-testid="course-overview-hero"
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0"
          // eslint-disable-next-line react-best-practices/no-inline-styles -- radial gradient requires inline style
          style={{
            background:
              'radial-gradient(ellipse at center, var(--accent-violet-muted), transparent 70%)',
          }}
        />
        {/* Dot pattern texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          // eslint-disable-next-line react-best-practices/no-inline-styles -- SVG pattern and mask require inline style
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9ImN1cnJlbnRDb2xvciIvPjwvc3ZnPg==")`,
            maskImage: 'linear-gradient(to bottom, white, transparent)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl font-bold text-foreground tracking-tight"
            data-testid="course-overview-title"
          >
            {course.name}
          </motion.h1>
          {authorName &&
            (authorData?.id ? (
              <Link
                to={`/authors/${authorData.id}`}
                className="text-lg text-muted-foreground font-light hover:text-foreground transition-colors inline-block"
              >
                By {authorName}
              </Link>
            ) : (
              <p className="text-lg text-muted-foreground font-light">By {authorName}</p>
            ))}

          {ctaLabel && ctaLessonId && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="pt-6 flex justify-center"
            >
              <button
                type="button"
                className="bg-foreground text-background hover:bg-foreground/90 px-8 py-4 rounded-full font-bold flex items-center gap-3 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] motion-safe:hover:scale-105"
                data-testid="course-overview-cta"
                onClick={() => {
                  if (ctaVariant === 'start' && course.id) {
                    useCourseImportStore.getState().updateCourseStatus(course.id, 'active')
                  }
                  navigate(`/courses/${course.id}/lessons/${ctaLessonId}`)
                }}
              >
                <Play className="size-5 fill-current" aria-hidden="true" />
                {ctaLabel}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Floating Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="max-w-5xl mx-auto -mt-10 relative z-20 px-6"
      >
        <div
          className="bg-card border border-border rounded-2xl p-4 flex flex-wrap justify-around items-center shadow-studio relative overflow-hidden"
          role="group"
          aria-label="Course statistics"
          data-testid="course-overview-stats"
        >
          {/* Progress line at top */}
          <div
            className="absolute top-0 left-0 h-1 bg-accent-violet shadow-[0_0_10px_var(--accent-violet)] transition-all duration-1000 ease-out"
            // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic width
            style={{ width: `${overallPercent}%` }}
          />

          {totalDuration > 0 && (
            <>
              <div className="flex items-center gap-3 px-4">
                <Clock className="size-5 text-accent-violet" aria-hidden="true" />
                <div>
                  <div className="text-lg font-bold text-foreground leading-none">
                    {formatDuration(totalDuration)}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                    Total Time
                  </div>
                </div>
              </div>
              <div className="w-px h-10 bg-muted-foreground/15 hidden sm:block" />
            </>
          )}

          <div className="flex items-center gap-3 px-4">
            <BookOpen className="size-5 text-accent-violet" aria-hidden="true" />
            <div>
              <div className="text-lg font-bold text-foreground leading-none">
                {completedCount} / {totalLessons}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                Lessons Done
              </div>
            </div>
          </div>

          <div className="w-px h-10 bg-muted-foreground/15 hidden sm:block" />

          <div className="flex items-center gap-3 px-4">
            <PlayCircle className="size-5 text-accent-violet" aria-hidden="true" />
            <div>
              <div className="text-lg font-bold text-foreground leading-none">
                {overallPercent}%
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                Completed
              </div>
            </div>
          </div>

          {pdfs.length > 0 && (
            <>
              <div className="w-px h-10 bg-muted-foreground/15 hidden sm:block" />
              <div className="flex items-center gap-3 px-4">
                <FileText className="size-5 text-accent-violet" aria-hidden="true" />
                <div>
                  <div className="text-lg font-bold text-foreground leading-none">
                    {pdfs.length}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                    Resources
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Content Area: Timeline + Sidebar */}
      {/* Section heading above the grid so both columns align */}
      <div className="max-w-5xl mx-auto px-6 mt-16 mb-8 flex items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">Course Journey</h2>
        {completedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {completedCount} / {videos.length} completed
          </Badge>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Timeline Curriculum (Left 2/3) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="lg:col-span-2"
          data-testid="course-overview-curriculum"
        >
          <div className="relative border-l-2 border-muted-foreground/15 ml-4 space-y-10 pb-8">
            {(() => {
              let moduleNum = 0
              return groupedContent.map((group, groupIndex) => {
                if (group.videos.length === 0) return null
                moduleNum++
                const status = moduleStatuses[groupIndex]
                const groupTitle =
                  group.title ||
                  (groupedContent.length > 1 ? `Section ${moduleNum}` : 'All Lessons')
                const groupLessonCount = group.videos.length
                const groupCompletedCount = group.videos.filter(
                  v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= COMPLETION_THRESHOLD
                ).length
                const groupDuration = group.videos.reduce((s, v) => s + (v.duration || 0), 0)
                const isExpanded = expandedModules.has(groupIndex)

                return (
                  <div key={`${group.title}-${groupIndex}`} className="relative pl-8 group/module">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute -left-[13px] top-1 size-6 rounded-full border-4 border-background flex items-center justify-center transition-colors duration-300',
                        status === 'completed' && 'bg-success shadow-[0_0_8px_var(--success)]',
                        status === 'active' &&
                          'bg-accent-violet shadow-[0_0_12px_var(--accent-violet)]',
                        status === 'upcoming' && 'bg-muted-foreground/30'
                      )}
                    >
                      {status === 'completed' && (
                        <CheckCircle2
                          className="size-3 text-success-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Module card */}
                    <div
                      className={cn(
                        'rounded-2xl border transition-all overflow-hidden',
                        status === 'active' &&
                          'bg-card border-accent-violet/30 shadow-[0_0_20px_var(--accent-violet-muted)]',
                        status === 'completed' &&
                          'bg-card/30 border-success/15 hover:border-success/30',
                        status === 'upcoming' &&
                          'bg-card/30 border-muted-foreground/8 hover:border-muted-foreground/20'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleModule(groupIndex)}
                        aria-expanded={isExpanded}
                        className="w-full text-left p-6"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3
                            className={cn(
                              'text-lg font-semibold',
                              status === 'active' && 'text-foreground',
                              status === 'completed' && 'text-foreground/60',
                              status === 'upcoming' && 'text-foreground/80'
                            )}
                          >
                            {groupTitle}
                          </h3>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                            Module {moduleNum}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="size-3.5" aria-hidden="true" />
                              {groupCompletedCount} / {groupLessonCount}{' '}
                              {groupLessonCount === 1 ? 'lesson' : 'lessons'}
                            </span>
                            {groupDuration > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="size-3.5" aria-hidden="true" />
                                {formatDuration(groupDuration)}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={cn(
                              'size-5 text-muted-foreground transition-transform duration-200',
                              isExpanded && 'rotate-180'
                            )}
                            aria-hidden="true"
                          />
                        </div>

                        {/* Micro progress bar — hidden when no progress */}
                        {groupCompletedCount > 0 && (
                          <div className="w-full h-1 bg-muted rounded-full mt-4 overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all duration-500',
                                status === 'completed' ? 'bg-success' : 'bg-accent-violet'
                              )}
                              // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic width requires inline style
                              style={{
                                width: `${(groupCompletedCount / groupLessonCount) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </button>

                      {/* Expanded lesson list */}
                      {isExpanded && (
                        <div className="bg-surface-sunken border-t-2 border-muted-foreground/40 p-2">
                          <div className="max-h-[400px] overflow-y-auto space-y-0.5 pr-1">
                            {group.videos.map(video => {
                              const prog = progressMap.get(video.id)
                              const percent = prog?.completionPercentage ?? 0
                              const isCompleted = percent >= COMPLETION_THRESHOLD

                              return (
                                <Link
                                  key={video.id}
                                  to={`/courses/${courseId}/lessons/${video.id}`}
                                  className={cn(
                                    'flex items-center gap-3 px-4 py-2.5 min-h-[44px] rounded-xl transition-colors group/lesson',
                                    isCompleted
                                      ? 'bg-success/5 hover:bg-success/10'
                                      : 'hover:bg-muted/50'
                                  )}
                                  data-testid={`curriculum-lesson-${video.id}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2
                                      className="size-5 text-success flex-shrink-0"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Video
                                      className="size-5 text-muted-foreground flex-shrink-0"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={cn(
                                        'text-sm font-medium truncate transition-colors',
                                        isCompleted
                                          ? 'text-success-foreground'
                                          : 'text-foreground/80 group-hover/lesson:text-foreground'
                                      )}
                                    >
                                      {stripExtension(video.filename)}
                                    </p>
                                    {video.duration > 0 && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <PlayCircle className="size-3" aria-hidden="true" />
                                        {formatDuration(video.duration)}
                                      </p>
                                    )}
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </motion.div>

        {/* Sticky Sidebar (Right 1/3) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-1"
        >
          <div className="sticky top-24 space-y-6">
            {/* Course Progress Ring */}
            <div className="bg-card/50 border border-muted-foreground/10 rounded-2xl p-6 flex flex-col items-center">
              <div className="relative size-28 mb-4">
                <svg className="size-28 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  {/* Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/50"
                  />
                  {/* Progress */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-accent-violet transition-all duration-1000 ease-out"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - overallPercent / 100)}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{overallPercent}%</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {videos.length} lessons
              </p>
            </div>

            {/* Course Tags */}
            {course.tags.length > 0 && (
              <div className="bg-card/50 border border-muted-foreground/10 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  Topics
                </h2>
                <div className="flex flex-wrap gap-2">
                  {course.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* About / Description */}
            {course.description?.trim() && (
              <div className="bg-card/50 border border-muted-foreground/10 rounded-2xl p-6">
                <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
                  About
                </h2>
                <p
                  className="text-sm text-muted-foreground leading-relaxed"
                  data-testid="course-overview-description"
                >
                  {course.description}
                </p>
              </div>
            )}

            {/* Schedule study time */}
            <div className="bg-card/50 border border-muted-foreground/10 rounded-2xl p-6 text-center">
              <Calendar className="size-6 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold text-foreground mb-1">
                Schedule Study Time
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Set recurring study blocks for this course
              </p>
              <Button
                variant="brand-outline"
                size="sm"
                className="w-full min-h-[44px]"
                data-testid="schedule-study-time-button"
                onClick={() => setScheduleEditorOpen(true)}
              >
                <Calendar className="size-4 mr-1.5" aria-hidden="true" />
                Schedule study time
              </Button>
              <StudyScheduleEditor
                courseId={course.id}
                open={scheduleEditorOpen}
                onOpenChange={setScheduleEditorOpen}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
