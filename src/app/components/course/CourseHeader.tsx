/**
 * CourseHeader — Source-agnostic course header with metadata display,
 * thumbnail, author info, and action buttons.
 *
 * Used by UnifiedCourseDetail (E89-S04).
 * Never checks `course.source` directly — uses `isYouTube` prop from parent adapter.
 */

import { Link } from 'react-router'
import { ArrowLeft, Trash2, User, Youtube, RefreshCw, WifiOff, Settings2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'
import { EditableTitle } from '@/app/components/figma/EditableTitle'
import { getAvatarSrc, getInitials } from '@/lib/authors'
import type { ImportedCourse } from '@/data/types'

interface AuthorInfo {
  id: string
  name: string
  title?: string
  photoUrl?: string
}

export interface CourseHeaderProps {
  course: ImportedCourse
  isYouTube: boolean
  thumbnailUrl: string | null
  authorData?: AuthorInfo
  videoCount: number
  pdfCount: number
  isOnline: boolean
  isRefreshing: boolean
  onTitleSave: (newTitle: string) => void
  onDelete: () => void
  onEdit: () => void
  onRefreshMetadata?: () => void
}

export function CourseHeader({
  course,
  isYouTube,
  thumbnailUrl,
  authorData,
  videoCount,
  pdfCount,
  isOnline,
  isRefreshing,
  onTitleSave,
  onDelete,
  onEdit,
  onRefreshMetadata,
}: CourseHeaderProps) {
  return (
    <div>
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Courses
      </Link>

      {/* Offline banner (YouTube only) */}
      {!isOnline && isYouTube && (
        <div
          className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 mb-4"
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
        >
          <WifiOff className="size-4 text-warning shrink-0" aria-hidden="true" />
          <p className="text-sm text-warning">
            You are offline. Cached data is shown below. Video playback requires an internet
            connection.
          </p>
        </div>
      )}

      {/* Course header with thumbnail */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-1">
        {/* Thumbnail */}
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full sm:w-32 h-28 sm:h-20 object-cover rounded-lg shrink-0"
          />
        ) : isYouTube ? (
          <div className="w-full sm:w-32 h-28 sm:h-20 bg-muted rounded-lg flex items-center justify-center shrink-0">
            <Youtube className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-2 sm:gap-4">
            <EditableTitle
              value={course.name}
              onSave={onTitleSave}
              data-testid="course-detail-title"
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                data-testid="detail-edit-course-button"
                onClick={onEdit}
              >
                <Settings2 className="size-4 mr-1.5" aria-hidden="true" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-testid="detail-delete-course-button"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>

          {/* Metadata line */}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            {isYouTube && course.youtubeChannelTitle && (
              <>
                <span data-testid="youtube-channel-info">{course.youtubeChannelTitle}</span>
                <span aria-hidden="true">&middot;</span>
              </>
            )}
            {!isYouTube && (
              <>
                <span>Imported {new Date(course.importedAt).toLocaleDateString()}</span>
                <span aria-hidden="true">&middot;</span>
              </>
            )}
            <span data-testid="video-pdf-count">
              {videoCount} {videoCount === 1 ? 'video' : 'videos'}
              {pdfCount > 0 && (
                <>
                  , {pdfCount} {pdfCount === 1 ? 'PDF' : 'PDFs'}
                </>
              )}
            </span>
          </div>

          {/* Tags */}
          {course.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {course.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Refresh metadata button (YouTube only) */}
          {isYouTube && onRefreshMetadata && (
            <div className="mt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={onRefreshMetadata}
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

      {/* Author Section (local courses) */}
      {!isYouTube && (
        <div data-testid="course-author-section" className="flex items-center gap-3 mt-4 mb-6">
          {authorData ? (
            <Link
              to={`/authors/${authorData.id}`}
              className="flex items-center gap-2.5 rounded-xl bg-card border p-3 pr-5 hover:bg-accent transition-colors group/author"
            >
              <Avatar className="size-9 ring-1 ring-border/50">
                <AvatarImage {...getAvatarSrc(authorData.photoUrl ?? '', 36)} alt="" />
                <AvatarFallback className="text-xs font-semibold bg-brand/10 text-brand">
                  {getInitials(authorData.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium group-hover/author:text-brand transition-colors">
                  {authorData.name}
                </p>
                {authorData.title && (
                  <p className="text-xs text-muted-foreground">{authorData.title}</p>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3 pr-5">
              <div className="size-9 rounded-full bg-muted flex items-center justify-center">
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground">Unknown Author</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
