/**
 * YouTubeCourseDetail — course detail page with chapter structure,
 * per-video progress bars, offline support, metadata refresh, and
 * removed-video badges.
 *
 * @see E28-S09 AC12, E28-S12
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Clock,
  Youtube,
  RefreshCw,
  WifiOff,
  AlertTriangle,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { refreshCourseMetadata } from '@/lib/youtubeMetadataRefresh'
import { Progress } from '@/app/components/ui/progress'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'
import type { ImportedVideo, VideoProgress, YouTubeCourseChapter } from '@/data/types'

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

interface ChapterGroup {
  title: string
  videos: ImportedVideo[]
}

export function YouTubeCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const isOnline = useOnlineStatus()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [chapters, setChapters] = useState<YouTubeCourseChapter[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, VideoProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false)

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

  // Load videos, chapters, and progress
  useEffect(() => {
    if (!courseId) return
    let ignore = false

    // silent-catch-ok: error logged to console
    Promise.all([
      db.importedVideos.where('courseId').equals(courseId).sortBy('order'),
      db.youtubeChapters.where('courseId').equals(courseId).sortBy('order'),
      db.progress.where('courseId').equals(courseId).toArray(),
    ])
      .then(([v, ch, prog]) => {
        if (!ignore) {
          setVideos(v)
          setChapters(ch)
          const pMap = new Map<string, VideoProgress>()
          for (const p of prog) {
            pMap.set(p.videoId, p)
          }
          setProgressMap(pMap)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('[YouTubeCourseDetail] Failed to load course data:', err)
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [courseId])

  // Handle manual metadata refresh
  const handleRefresh = useCallback(async () => {
    if (!course || !isOnline || isRefreshing) return
    setIsRefreshing(true)
    try {
      const { updated, removed } = await refreshCourseMetadata(course)
      if (updated > 0 || removed > 0) {
        toast.success(`Metadata refreshed: ${updated} updated, ${removed} removed`)
        // Reload videos to reflect changes
        if (courseId) {
          const freshVideos = await db.importedVideos
            .where('courseId')
            .equals(courseId)
            .sortBy('order')
          setVideos(freshVideos)
        }
      } else {
        toast.info('Metadata is already up to date')
      }
    } catch (error) {
      console.error('[YouTubeCourseDetail] Metadata refresh failed:', error)
      toast.error('Failed to refresh metadata')
    } finally {
      setIsRefreshing(false)
    }
  }, [course, isOnline, isRefreshing, courseId])

  // Group videos by chapter
  const chapterGroups = useMemo((): ChapterGroup[] => {
    if (chapters.length === 0) {
      // No chapters — treat all videos as a single ungrouped list
      return [{ title: '', videos }]
    }

    // Build a map of videoId → chapter title
    const videoChapterMap = new Map<string, string>()
    for (const ch of chapters) {
      // Use the first chapter entry for each video
      if (!videoChapterMap.has(ch.videoId)) {
        videoChapterMap.set(ch.videoId, ch.title)
      }
    }

    // Group videos preserving order
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
  }, [videos, chapters])

  // Overall completion stats
  const completedCount = useMemo(() => {
    return videos.filter(v => {
      const prog = progressMap.get(v.id)
      return prog && prog.completionPercentage >= 90
    }).length
  }, [videos, progressMap])

  const overallPercent = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0

  if (!course && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>Course not found.</p>
        <Link to="/courses" className="text-sm text-brand hover:underline">
          Back to Courses
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="max-w-3xl mx-auto px-4 py-8"
        aria-busy="true"
        aria-label="Loading course"
      >
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-6" />
        <Skeleton className="h-3 w-full mb-4" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full mb-2 rounded-xl" />
        ))}
      </div>
    )
  }

  const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0)
  const isYouTubeCourse = course?.source === 'youtube'

  return (
    <div data-testid="youtube-course-detail" className="max-w-3xl mx-auto px-4 py-8">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Courses
      </Link>

      {/* Offline banner */}
      {!isOnline && isYouTubeCourse && (
        <div
          className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 mb-4"
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
        >
          <WifiOff className="size-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-sm text-warning">
            You are offline. Cached data is shown below. Video playback requires an internet connection.
          </p>
        </div>
      )}

      {/* Course header */}
      <div className="flex items-start gap-4 mb-6">
        {course?.youtubeThumbnailUrl ? (
          <img
            src={course.youtubeThumbnailUrl}
            alt=""
            className="w-32 h-20 object-cover rounded-lg shrink-0"
          />
        ) : (
          <div className="w-32 h-20 bg-muted rounded-lg flex items-center justify-center shrink-0">
            <Youtube className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold truncate" data-testid="course-detail-title">
            {course?.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            {course?.youtubeChannelTitle && (
              <span>{course.youtubeChannelTitle}</span>
            )}
            <span aria-hidden="true">&middot;</span>
            <span>
              {videos.length} {videos.length === 1 ? 'video' : 'videos'}
            </span>
            {totalDuration > 0 && (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>{formatDuration(totalDuration)} total</span>
              </>
            )}
          </div>

          {/* Refresh metadata button (YouTube courses only) */}
          {isYouTubeCourse && (
            <div className="mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleRefresh}
                      disabled={!isOnline || isRefreshing}
                      data-testid="refresh-metadata-button"
                      aria-label={
                        !isOnline
                          ? 'Refresh metadata — requires internet connection'
                          : isRefreshing
                            ? 'Refreshing metadata...'
                            : 'Refresh metadata from YouTube'
                      }
                    >
                      <RefreshCw
                        className={cn('size-3.5', isRefreshing && 'animate-spin')}
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline">
                        {isRefreshing ? 'Refreshing...' : 'Refresh metadata'}
                      </span>
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isOnline && (
                  <TooltipContent>
                    <p>Requires internet connection</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl border bg-card p-4 mb-6" data-testid="course-progress-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{videos.length} completed
          </span>
        </div>
        <Progress value={overallPercent} className="h-2" aria-label="Course completion progress" />
        <p className="text-xs text-muted-foreground mt-1">{overallPercent}% complete</p>
      </div>

      {/* AI Summary panel (Premium feature — AC8) */}
      {isYouTubeCourse && (
        <Collapsible open={aiSummaryOpen} onOpenChange={setAiSummaryOpen}>
          <div className="rounded-xl border bg-card mb-6" data-testid="ai-summary-panel">
            <CollapsibleTrigger asChild>
              <button
                className="flex items-center justify-between w-full p-4 text-left hover:bg-accent/50 transition-colors rounded-xl"
                aria-label="Toggle AI course summary"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" aria-hidden="true" />
                  <span className="text-sm font-medium">AI Course Summary</span>
                  <Badge variant="secondary" className="text-xs bg-brand-soft text-brand-soft-foreground">
                    Premium
                  </Badge>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    aiSummaryOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 text-sm text-muted-foreground">
                <p>
                  AI-generated summaries are created from transcript data. Import transcripts
                  for this course to enable AI summaries.
                </p>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Chapter groups and video list */}
      <div className="space-y-6" data-testid="course-content-list" aria-label="Course content">
        {chapterGroups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`}>
            {group.title && (
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {group.videos.map((video, videoIndex) => {
                const prog = progressMap.get(video.id)
                const percent = prog?.completionPercentage ?? 0
                const isCompleted = percent >= 90
                const isRemoved = video.removedFromYouTube === true

                return (
                  <li key={video.id}>
                    <Link
                      to={`/youtube-courses/${courseId}/lessons/${video.id}`}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group',
                        isRemoved && 'opacity-75'
                      )}
                      data-testid={`course-video-item-${video.id}`}
                    >
                      {/* Index / completion indicator */}
                      <div
                        className={cn(
                          'size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium',
                          isCompleted
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-4" aria-label="Completed" />
                        ) : (
                          <span>{videoIndex + 1}</span>
                        )}
                      </div>

                      {/* Thumbnail */}
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="w-24 h-14 object-cover rounded-md shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-24 h-14 bg-muted rounded-md flex items-center justify-center shrink-0">
                          <Play className="size-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                      )}

                      {/* Video info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium group-hover:text-brand transition-colors line-clamp-2">
                            {video.filename}
                          </span>
                          {isRemoved && (
                            <Badge
                              variant="destructive"
                              className="text-xs shrink-0"
                              data-testid={`removed-badge-${video.id}`}
                            >
                              <AlertTriangle className="size-3 mr-1" aria-hidden="true" />
                              Removed from YouTube
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {video.duration > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              <Clock className="size-3 inline mr-0.5" aria-hidden="true" />
                              {formatDuration(video.duration)}
                            </span>
                          )}
                          {percent > 0 && !isCompleted && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-brand-soft text-brand-soft-foreground"
                            >
                              {percent}%
                            </Badge>
                          )}
                        </div>
                        {/* Per-video progress bar */}
                        {percent > 0 && (
                          <Progress
                            value={percent}
                            className="h-1 mt-1.5"
                            aria-label={`${percent}% watched`}
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
