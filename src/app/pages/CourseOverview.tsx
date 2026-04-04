/**
 * CourseOverview — Visually rich course landing page with hero section,
 * stats, curriculum accordion, and call-to-action.
 *
 * Uses the adapter pattern (never checks `course.source` directly).
 * Reuses CTA logic from E91-S01 (getLastWatchedLesson / getFirstLesson).
 *
 * @see E91-S10
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Play,
  PlayCircle,
  RotateCcw,
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
import { revokeObjectUrl } from '@/lib/courseAdapter'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { getAvatarSrc, getInitials } from '@/lib/authors'
import { formatClockDuration as formatDuration } from '@/lib/formatDuration'
import type { ImportedVideo, ImportedPdf, VideoProgress, YouTubeCourseChapter } from '@/data/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPLETION_THRESHOLD = 90

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatTag(tag: string) {
  return tag
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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
}

function groupByFolder(videos: ImportedVideo[]): ChapterGroup[] {
  const groups = new Map<string, ImportedVideo[]>()
  for (const video of videos) {
    const folder = getFolderName(video.path)
    if (!groups.has(folder)) groups.set(folder, [])
    groups.get(folder)!.push(video)
  }
  return Array.from(groups.entries()).map(([title, vids]) => ({ title, videos: vids }))
}

function groupByChapter(videos: ImportedVideo[], chapters: YouTubeCourseChapter[]): ChapterGroup[] {
  if (chapters.length === 0) return [{ title: '', videos }]

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
      groups.push({ title: currentTitle, videos: currentVideos })
      currentVideos = []
    }
    currentTitle = chTitle
    currentVideos.push(video)
  }
  if (currentVideos.length > 0) {
    groups.push({ title: currentTitle, videos: currentVideos })
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const thumbnailUrlRef = useRef<string | null>(null)
  const [contentLoading, setContentLoading] = useState(true)

  // CTA state
  const [ctaVariant, setCtaVariant] = useState<'start' | 'continue' | 'review' | undefined>()
  const [ctaLessonId, setCtaLessonId] = useState<string | undefined>()

  // Accordion state
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]))

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
        } else {
          const first = await getFirstLesson(adapter!)
          if (ignore) return
          if (first) {
            setCtaVariant('start')
            setCtaLessonId(first.lessonId)
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

  // Thumbnail
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
    return groupByFolder(videos)
  }, [videos, chapters, capabilities?.requiresNetwork])

  const toggleModule = useCallback((index: number) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

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

  const ctaConfig = ctaVariant
    ? {
        start: { label: 'Start Course', icon: Play },
        continue: { label: 'Continue Learning', icon: PlayCircle },
        review: { label: 'Review Course', icon: RotateCcw },
      }[ctaVariant]
    : null

  const hasDescription = Boolean(course.description?.trim())
  const hasTags = course.tags.length > 0
  const totalLessons = videos.length + pdfs.length

  return (
    <div data-testid="course-overview-page" className="max-w-6xl mx-auto px-4 py-8">
      {/* Back nav */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
        >
          <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>
      </motion.div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative rounded-2xl overflow-hidden shadow-studio mb-6"
        // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic gradient requires inline style
        style={{
          background:
            'linear-gradient(160deg, var(--brand-soft) 0%, var(--accent-violet-muted) 50%, var(--card) 100%)',
          minHeight: 280,
        }}
        data-testid="course-overview-hero"
      >
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
            onError={e => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic gradient requires inline style
          style={{
            background:
              'linear-gradient(to top, var(--card) 0%, transparent 60%), linear-gradient(160deg, var(--brand-soft) 0%, var(--accent-violet-muted) 50%, transparent 100%)',
            opacity: 0.85,
          }}
        />

        <div className="relative z-10 p-8 md:p-10 flex flex-col justify-end h-full min-h-[280px]">
          {hasTags && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {course.tags.slice(0, 3).map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <h1
            className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight max-w-3xl"
            data-testid="course-overview-title"
          >
            {course.name}
          </h1>

          {adapterAuthorInfo?.name && (
            <p className="text-sm text-muted-foreground mt-2">{adapterAuthorInfo.name}</p>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        data-testid="course-overview-stats"
      >
        {[
          ...(totalDuration > 0
            ? [{ icon: Clock, value: formatDuration(totalDuration), label: 'Duration' }]
            : []),
          { icon: BookOpen, value: `${totalLessons}`, label: 'Lessons' },
          { icon: Play, value: `${videos.length}`, label: 'Videos' },
          ...(pdfs.length > 0 ? [{ icon: FileText, value: `${pdfs.length}`, label: 'PDFs' }] : []),
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-card rounded-xl p-4 text-center shadow-studio border border-border/50"
          >
            <stat.icon className="size-5 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
            <p className="font-semibold text-foreground capitalize">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--content-gap)] mb-8">
        {/* Left Column (2/3) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={cn(
            'space-y-6',
            hasDescription || (!capabilities?.requiresNetwork && authorData)
              ? 'lg:col-span-2'
              : 'lg:col-span-3'
          )}
        >
          {/* About This Course */}
          {hasDescription && (
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-studio border border-border/50">
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                About This Course
              </h2>
              <p
                className="text-muted-foreground leading-relaxed"
                data-testid="course-overview-description"
              >
                {course.description}
              </p>
            </div>
          )}

          {/* Author Card (local only) */}
          {!capabilities?.requiresNetwork && authorData && (
            <Link
              to={`/authors/${authorData.id}`}
              className="block bg-card rounded-2xl p-6 shadow-studio border border-border/50 hover:shadow-studio-hover hover:-translate-y-px transition-all duration-200 group"
              data-testid="course-overview-author"
            >
              <div className="flex items-center gap-4">
                <Avatar className="size-14 ring-2 ring-border">
                  {authorData.photoUrl && (
                    <AvatarImage {...getAvatarSrc(authorData.photoUrl, 56)} alt={authorData.name} />
                  )}
                  <AvatarFallback className="bg-brand-soft text-brand-soft-foreground text-lg font-semibold">
                    {getInitials(authorData.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                    Instructor
                  </p>
                  <p className="font-semibold text-foreground group-hover:text-brand-soft-foreground transition-colors">
                    {authorData.name}
                  </p>
                  {authorData.title && (
                    <p className="text-sm text-muted-foreground mt-0.5">{authorData.title}</p>
                  )}
                </div>
                <ChevronRight
                  className="size-5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </div>
            </Link>
          )}
        </motion.div>

        {/* Right Column (1/3) */}
        {(hasDescription || (!capabilities?.requiresNetwork && authorData)) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="space-y-6"
          >
            {/* What You'll Learn */}
            {hasTags && (
              <div className="bg-card rounded-2xl p-6 shadow-studio border border-border/50">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">
                  What You&apos;ll Learn
                </h2>
                <ul className="space-y-3" data-testid="course-overview-tags">
                  {course.tags.map(tag => (
                    <li key={tag} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 size-5 rounded-full bg-success-soft flex items-center justify-center">
                        <Check className="size-3 text-success" aria-hidden="true" />
                      </span>
                      <span className="text-sm text-foreground leading-snug">{formatTag(tag)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA Card */}
            {ctaConfig && ctaLessonId && (
              <div
                className="rounded-2xl p-6 shadow-studio text-center"
                // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic gradient requires inline style
                style={{
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--accent-violet) 100%)',
                }}
                data-testid="course-overview-cta"
              >
                <h3 className="font-display text-lg font-semibold text-brand-foreground mb-1">
                  {ctaVariant === 'start'
                    ? 'Ready to Start?'
                    : ctaVariant === 'continue'
                      ? 'Welcome Back!'
                      : 'Revisit This Course'}
                </h3>
                <p className="text-brand-foreground/80 text-sm mb-5">
                  {ctaVariant === 'start'
                    ? 'Start your learning journey'
                    : ctaVariant === 'continue'
                      ? 'Pick up where you left off'
                      : 'Review the material at your own pace'}
                </p>
                <Button
                  variant="outline"
                  className="w-full bg-brand-foreground/10 border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/20"
                  onClick={() => {
                    if (ctaVariant === 'start' && course.id) {
                      useCourseImportStore.getState().updateCourseStatus(course.id, 'active')
                    }
                    navigate(`/courses/${course.id}/lessons/${ctaLessonId}`)
                  }}
                >
                  <ctaConfig.icon className="mr-2 size-4" aria-hidden="true" />
                  {ctaConfig.label}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Curriculum Section */}
      {totalLessons > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="bg-card rounded-2xl p-6 md:p-8 shadow-studio border border-border/50 mb-8"
          data-testid="course-overview-curriculum"
        >
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Curriculum</h2>
            <Badge variant="secondary" className="text-xs">
              {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
            </Badge>
            {completedCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {completedCount} / {videos.length} completed
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            {groupedContent.map((group, groupIndex) => {
              const isExpanded = expandedModules.has(groupIndex)
              const groupTitle =
                group.title ||
                (groupedContent.length > 1 ? `Section ${groupIndex + 1}` : 'All Lessons')
              const groupCompletedCount = group.videos.filter(
                v => (progressMap.get(v.id)?.completionPercentage ?? 0) >= COMPLETION_THRESHOLD
              ).length
              const groupDuration = group.videos.reduce((s, v) => s + (v.duration || 0), 0)

              return (
                <div
                  key={`${group.title}-${groupIndex}`}
                  className="rounded-xl border border-border/50 overflow-hidden"
                >
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleModule(groupIndex)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex-shrink-0 size-8 rounded-lg bg-brand-soft flex items-center justify-center">
                      {group.title ? (
                        <FolderOpen
                          className="size-3.5 text-brand-soft-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-brand-soft-foreground">
                          {groupIndex + 1}
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{groupTitle}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.videos.length} {group.videos.length === 1 ? 'lesson' : 'lessons'}
                        {groupDuration > 0 && ` · ${formatDuration(groupDuration)}`}
                        {groupCompletedCount > 0 && ` · ${groupCompletedCount} done`}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Lessons */}
                  {isExpanded && (
                    <div className="border-t border-border/50">
                      {group.videos.map(video => {
                        const prog = progressMap.get(video.id)
                        const percent = prog?.completionPercentage ?? 0
                        const isCompleted = percent >= COMPLETION_THRESHOLD

                        return (
                          <Link
                            key={video.id}
                            to={`/courses/${courseId}/lessons/${video.id}`}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0 group/lesson"
                            data-testid={`curriculum-lesson-${video.id}`}
                          >
                            {isCompleted ? (
                              <CheckCircle2
                                className="size-4 text-success flex-shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <Video
                                className="size-4 text-muted-foreground flex-shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate text-foreground group-hover/lesson:text-brand-soft-foreground transition-colors">
                                {stripExtension(video.filename)}
                              </p>
                            </div>
                            {video.duration > 0 && (
                              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                                {formatDuration(video.duration)}
                              </Badge>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* PDFs section */}
            {pdfs.length > 0 && (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <span className="flex-shrink-0 size-8 rounded-lg bg-warning/10 flex items-center justify-center">
                    <FileText className="size-3.5 text-warning" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">PDFs</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pdfs.length} {pdfs.length === 1 ? 'document' : 'documents'}
                    </p>
                  </div>
                </div>
                <div className="border-t border-border/50">
                  {pdfs.map(pdf => (
                    <Link
                      key={pdf.id}
                      to={`/courses/${courseId}/lessons/${pdf.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
                    >
                      <FileText className="size-4 text-warning flex-shrink-0" aria-hidden="true" />
                      <p className="text-sm truncate text-foreground flex-1 min-w-0">
                        {stripExtension(pdf.filename)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
