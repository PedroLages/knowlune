import { Check, Play, Lock, AlertCircle, Import, BookOpen, Search, Replace } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { CourseTypeBadge } from '@/app/components/shared/CourseTypeBadge'
import { isCourseInProgress } from '@/lib/progressUtils'
import { extractGapSearchTerm, cleanGapJustification } from '@/data/learningPathUtils'
import type { LearningPathEntry, PathCourseInfo } from '@/data/types'

interface CourseEntry extends LearningPathEntry {
  info?: PathCourseInfo
  thumbnailUrl?: string
}

interface GapResolution {
  entryId: string
  type: 'import' | 'match' | 'replace'
}

interface RoadmapListViewProps {
  entries: CourseEntry[]
  courseInfoMap: Map<string, PathCourseInfo>
  thumbnailUrls: Record<string, string>
  gapEntries: CourseEntry[]
  onGapResolve: (resolution: GapResolution) => void
  onCourseClick: (courseId: string) => void
  /** Set of course IDs that are currently loading */
  loadingResolve?: Set<string>
}

function GapEntryCard({
  entry,
  onResolve,
  isLoading,
}: {
  entry: CourseEntry
  onResolve: (resolution: GapResolution) => void
  isLoading?: boolean
}) {
  const searchTerm = extractGapSearchTerm(entry.justification)
  const justification = cleanGapJustification(entry.justification)

  return (
    <Card
      className="border-2 border-dashed border-warning/40 bg-warning/5"
      data-testid={`gap-entry-${entry.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 size-9 rounded-full bg-warning/20 flex items-center justify-center text-sm font-semibold text-warning">
            {entry.position}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm">
              {justification || searchTerm || `Course ${entry.position}`}
            </h4>
            {justification && justification !== searchTerm && (
              <p className="text-xs text-muted-foreground mt-0.5">{justification}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs border-warning/60 text-warning">
                <AlertCircle className="w-3 h-3 mr-1" />
                Not in your library
              </Badge>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="text-xs w-full justify-start"
              onClick={() => onResolve({ entryId: entry.id, type: 'import' })}
              disabled={isLoading}
            >
              <Import className="size-3.5 mr-1" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs w-full justify-start"
              onClick={() => onResolve({ entryId: entry.id, type: 'match' })}
              disabled={isLoading}
            >
              <Search className="size-3.5 mr-1" />
              Match
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs w-full justify-start"
              onClick={() => onResolve({ entryId: entry.id, type: 'replace' })}
              disabled={isLoading}
            >
              <Replace className="size-3.5 mr-1" />
              Replace
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Syllabus-style list view of the learning path.
 * Shows each course in order with completion status, gap entries with
 * import/match/replace resolution actions, and visual status indicators.
 */
export function RoadmapListView({
  entries,
  courseInfoMap,
  thumbnailUrls,
  gapEntries,
  onGapResolve,
  onCourseClick,
  loadingResolve,
}: RoadmapListViewProps) {
  const gapEntryIds = new Set(gapEntries.map(e => e.id))

  return (
    <div className="space-y-4" role="list" aria-label="Curriculum">
      {entries.map((entry, i) => {
        // Gap entry — render with resolution actions
        if (entry.courseId === '' || gapEntryIds.has(entry.id)) {
          return (
            <div key={entry.id || `gap-${i}`} role="listitem">
              <GapEntryCard
                entry={entry}
                onResolve={onGapResolve}
                isLoading={loadingResolve?.has(entry.id)}
              />
            </div>
          )
        }

        const info = courseInfoMap.get(entry.courseId)
        const thumbUrl = thumbnailUrls[entry.courseId]
        const isCompleted = (info?.completionPct ?? 0) >= 100
        const isInProgress = isCourseInProgress(info?.completionPct, isCompleted)

        return (
          <div key={entry.courseId} role="listitem">
            <Card
              className={cn(
                'cursor-pointer hover:shadow-md transition-all duration-200',
                isCompleted && 'border-success/20 bg-success/5',
                isInProgress && 'border-brand/20 bg-brand/5'
              )}
              onClick={() => onCourseClick(entry.courseId)}
              tabIndex={0}
              role="button"
              aria-label={`${info?.name || 'Course'} — ${isCompleted ? 'Completed' : isInProgress ? `${info?.completionPct ?? 0}% complete` : 'Not started'}`}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCourseClick(entry.courseId)
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Status indicator */}
                  <div
                    className={cn(
                      'size-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold',
                      isCompleted && 'bg-success text-success-foreground',
                      isInProgress && 'bg-brand text-brand-foreground',
                      !isCompleted && !isInProgress && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : isInProgress ? (
                      <Play className="size-4 fill-current" aria-hidden="true" />
                    ) : (
                      <Lock className="size-4" aria-hidden="true" />
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="size-12 shrink-0 rounded-lg bg-muted overflow-hidden">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Course info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm leading-tight truncate">
                        {info?.name || 'Unknown Course'}
                      </h3>
                      <CourseTypeBadge courseType={entry.courseType} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {info?.authorName && (
                        <span className="text-xs text-muted-foreground truncate">
                          {info.authorName}
                        </span>
                      )}
                      {isCompleted ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider border-success/30 text-success"
                        >
                          Completed
                        </Badge>
                      ) : isInProgress ? (
                        <span className="text-xs text-brand font-medium">
                          {info?.completionPct ?? 0}% complete
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not started</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
