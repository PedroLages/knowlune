/**
 * LessonList — Source-agnostic lesson list with folder/chapter grouping,
 * file status badges, search/filter, and progress indicators.
 *
 * Used by UnifiedCourseDetail (E89-S04).
 * Supports both local folder grouping and YouTube chapter grouping.
 */

import { Fragment, useState, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router'
import {
  Video,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Search,
  X,
  ChevronDown,
  FolderOpen,
  Play,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Progress } from '@/app/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'
import type { ImportedVideo, ImportedPdf, VideoProgress, YouTubeCourseChapter } from '@/data/types'
import type { FileStatus } from '@/lib/fileVerification'
import { humanizeFilename } from '@/lib/courseAdapter'
import type { ContentCapabilities } from '@/lib/courseAdapter'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Percentage threshold at which a lesson is considered completed. */
const COMPLETION_THRESHOLD = 90

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

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

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

function formatFolderCount(videoCount: number, pdfCount: number): string {
  const parts: string[] = []
  if (videoCount > 0) parts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`)
  if (pdfCount > 0) parts.push(`${pdfCount} PDF${pdfCount !== 1 ? 's' : ''}`)
  return parts.join(' · ') || '0 items'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FileStatusBadge({ status, itemId }: { status: FileStatus; itemId: string }) {
  if (status === 'missing') {
    return (
      <Badge variant="destructive" data-testid={`file-not-found-badge-${itemId}`} role="status">
        <AlertTriangle className="size-3" aria-hidden="true" />
        File not found
      </Badge>
    )
  }
  if (status === 'permission-denied') {
    return (
      <Badge
        className="bg-warning text-warning-foreground"
        data-testid={`file-permission-badge-${itemId}`}
        role="status"
      >
        <ShieldAlert className="size-3" aria-hidden="true" />
        Permission needed
      </Badge>
    )
  }
  return null
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRegex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(splitRegex)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.length > 0 && part.toLowerCase() === query.toLowerCase()
        return isMatch ? (
          <mark key={i} className="bg-warning/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChapterGroup {
  title: string
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
}

export interface LessonListProps {
  courseId: string
  videos: ImportedVideo[]
  pdfs: ImportedPdf[]
  capabilities: ContentCapabilities
  fileStatuses: Map<string, FileStatus>
  progressMap: Map<string, VideoProgress>
  chapters: YouTubeCourseChapter[]
}

/** Minimum number of content items required to show the search input */
const SEARCH_THRESHOLD = 10

export function LessonList({
  courseId,
  videos,
  pdfs,
  capabilities,
  fileStatuses,
  progressMap,
  chapters,
}: LessonListProps) {
  const isNetworkSource = capabilities.requiresNetwork
  const [searchQuery, setSearchQuery] = useState('')
  const contentListRef = useRef<HTMLUListElement>(null)

  const totalItems = videos.length + pdfs.length
  const showSearch = totalItems >= SEARCH_THRESHOLD

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos
    const q = searchQuery.toLowerCase()
    return videos.filter(v => v.filename.toLowerCase().includes(q))
  }, [videos, searchQuery])

  const filteredPdfs = useMemo(() => {
    if (!searchQuery) return pdfs
    const q = searchQuery.toLowerCase()
    return pdfs.filter(p => p.filename.toLowerCase().includes(q))
  }, [pdfs, searchQuery])

  const hasResults = filteredVideos.length > 0 || filteredPdfs.length > 0

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    contentListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Group videos and PDFs by folder (local) or chapter (YouTube)
  const groupedContent = useMemo(() => {
    if (isNetworkSource && chapters.length > 0) {
      return groupByChapter(filteredVideos, chapters)
    }
    return groupByFolder(filteredVideos, isNetworkSource ? [] : filteredPdfs)
  }, [filteredVideos, filteredPdfs, chapters, isNetworkSource])

  const hasMultipleGroups =
    groupedContent.length > 1 || (groupedContent.length === 1 && groupedContent[0].title !== '')

  return (
    <TooltipProvider delayDuration={300}>
      <div>
        {/* Search/filter input */}
        {showSearch && (
          <div data-testid="content-search-container" className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              data-testid="content-search-input"
              type="search"
              placeholder="Search videos and PDFs…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 rounded-xl"
              aria-label="Filter course content by filename"
            />
            {searchQuery && (
              <button
                type="button"
                data-testid="content-search-clear"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        <ul
          ref={contentListRef}
          data-testid="course-content-list"
          aria-label="Course content"
          className="flex flex-col gap-0.5"
        >
          {isNetworkSource
            ? renderYouTubeGroups(
                groupedContent,
                courseId,
                progressMap,
                hasMultipleGroups,
                searchQuery
              )
            : renderLocalGroups(
                groupedContent,
                courseId,
                fileStatuses,
                progressMap,
                hasMultipleGroups,
                searchQuery
              )}

          {/* Ungrouped PDFs (PDFs without folder paths in local courses) */}
          {/* PDFs with folder paths are now rendered inside their folder groups */}

          {/* Empty state: no matches from search filter */}
          {searchQuery && !hasResults && (
            <li
              data-testid="content-search-empty"
              className="flex flex-col items-center gap-3 text-sm text-muted-foreground text-center py-12"
            >
              <Search className="size-8 text-muted-foreground/50" aria-hidden="true" />
              <p>No videos or PDFs match your search</p>
              <Button
                variant="outline"
                size="sm"
                data-testid="content-search-clear-empty"
                onClick={handleClearSearch}
              >
                Clear search
              </Button>
            </li>
          )}

          {/* Empty state: course has no content at all */}
          {!searchQuery && videos.length === 0 && pdfs.length === 0 && (
            <li className="text-sm text-muted-foreground text-center py-8">
              No content found in this course.
            </li>
          )}
        </ul>
      </div>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Grouping functions
// ---------------------------------------------------------------------------

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

  // Merge all folder names from both videos and PDFs
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
  if (chapters.length === 0) {
    return [{ title: '', videos, pdfs: [] }]
  }

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
// Render helpers
// ---------------------------------------------------------------------------

function renderLocalGroups(
  groups: ChapterGroup[],
  courseId: string,
  fileStatuses: Map<string, FileStatus>,
  progressMap: Map<string, VideoProgress>,
  hasMultipleGroups: boolean,
  searchQuery: string
) {
  return groups.map(group => {
    const videoItems = group.videos.map((video, videoIndex) => {
      const status = fileStatuses.get(video.id) ?? 'checking'
      const isUnavailable = status === 'missing' || status === 'permission-denied'
      const prog = progressMap.get(video.id)
      const percent = prog?.completionPercentage ?? 0
      const isCompleted = percent >= COMPLETION_THRESHOLD

      const humanized = humanizeFilename(video.filename)
      const content = (
        <>
          {/* Index / completion indicator */}
          <span
            className={cn(
              'size-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold',
              isCompleted
                ? 'bg-success/10 text-success'
                : 'bg-resource-video-bg text-resource-video'
            )}
            aria-label={isCompleted ? 'Completed' : undefined}
          >
            {isCompleted ? (
              <CheckCircle2
                className="size-3.5"
                aria-hidden="true"
                data-testid={`completion-badge-${video.id}`}
              />
            ) : (
              <span>{videoIndex + 1}</span>
            )}
          </span>

          {/* Video info */}
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  data-testid={`file-status-${video.id}`}
                  data-status={status}
                  className={cn(
                    'text-sm font-medium truncate block',
                    !isUnavailable && 'group-hover:text-brand transition-colors'
                  )}
                >
                  <HighlightedText text={humanized} query={searchQuery} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="max-w-xs">
                {humanized}
              </TooltipContent>
            </Tooltip>
            <FileStatusBadge status={status} itemId={video.id} />
            <div className="flex items-center gap-1.5 mt-0.5">
              <Video className="size-3 text-muted-foreground" aria-hidden="true" />
              {video.duration > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(video.duration)}
                </span>
              )}
              {percent > 0 && !isCompleted && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-brand-soft text-brand-soft-foreground"
                  data-testid={`progress-badge-${video.id}`}
                >
                  {percent}%
                </Badge>
              )}
            </div>
            {percent > 0 && (
              <Progress
                value={percent}
                className="h-1 mt-1.5"
                aria-label={`${percent}% watched`}
                data-testid={`progress-bar-${video.id}`}
              />
            )}
          </div>
        </>
      )

      return (
        <li key={video.id} data-testid={`course-content-item-video-${video.id}`}>
          {isUnavailable ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-50 cursor-not-allowed"
              aria-disabled="true"
            >
              {content}
            </div>
          ) : (
            <Link
              to={`/courses/${courseId}/lessons/${video.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors group"
            >
              {content}
            </Link>
          )}
        </li>
      )
    })

    const pdfItems = group.pdfs.map(pdf => {
      const status = fileStatuses.get(pdf.id) ?? 'checking'
      const isUnavailable = status === 'missing' || status === 'permission-denied'
      const humanized = humanizeFilename(pdf.filename)

      const content = (
        <>
          {/* PDF type indicator */}
          <span className="size-7 rounded-lg bg-resource-pdf-bg flex items-center justify-center shrink-0">
            <FileText className="size-3.5 text-resource-pdf" aria-hidden="true" />
          </span>

          {/* PDF info */}
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  className={cn(
                    'text-sm font-medium truncate block',
                    !isUnavailable && 'group-hover:text-brand transition-colors'
                  )}
                >
                  <HighlightedText text={humanized} query={searchQuery} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="max-w-xs">
                {humanized}
              </TooltipContent>
            </Tooltip>
            <FileStatusBadge status={status} itemId={pdf.id} />
            <div className="flex items-center gap-1.5 mt-0.5">
              <FileText className="size-3 text-muted-foreground" aria-hidden="true" />
              {pdf.pageCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {pdf.pageCount} {pdf.pageCount === 1 ? 'pg' : 'pgs'}
                </Badge>
              )}
            </div>
          </div>
        </>
      )

      return (
        <li key={pdf.id} data-testid={`course-content-item-pdf-${pdf.id}`}>
          {isUnavailable ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-50 cursor-not-allowed"
              aria-disabled="true"
            >
              {content}
            </div>
          ) : (
            <Link
              to={`/courses/${courseId}/lessons/${pdf.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors group"
            >
              {content}
            </Link>
          )}
        </li>
      )
    })

    if (!hasMultipleGroups) {
      return (
        <Fragment key={group.title || 'root'}>
          {videoItems}
          {pdfItems}
        </Fragment>
      )
    }

    const totalDuration = group.videos.reduce((sum, v) => sum + v.duration, 0)

    return (
      <li key={group.title || 'root'}>
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground group/folder">
            <FolderOpen className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">
              {group.title ? humanizeFilename(group.title) : 'General'}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {formatFolderCount(group.videos.length, group.pdfs.length)}
              {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
            </span>
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-data-[state=open]/folder:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col gap-0.5 mt-1 ml-2 pl-4 border-l border-border/50">
              {videoItems}
              {pdfItems}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </li>
    )
  })
}

function renderYouTubeGroups(
  groups: ChapterGroup[],
  courseId: string,
  progressMap: Map<string, VideoProgress>,
  hasMultipleGroups: boolean,
  searchQuery: string
) {
  return groups.map(group => (
    <li key={group.title || group.videos[0]?.id || 'ungrouped'}>
      {hasMultipleGroups && group.title && (
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {group.title}
        </h2>
      )}
      <ul className="flex flex-col gap-2">
        {group.videos.map((video, videoIndex) => {
          const prog = progressMap.get(video.id)
          const percent = prog?.completionPercentage ?? 0
          const isCompleted = percent >= COMPLETION_THRESHOLD
          const isRemoved = video.removedFromYouTube === true

          return (
            <li key={video.id}>
              <Link
                to={`/courses/${courseId}/lessons/${video.id}`}
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
                    isCompleted ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
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
                      <HighlightedText text={video.filename} query={searchQuery} />
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
    </li>
  ))
}
