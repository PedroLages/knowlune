import { BookOpen, Video, FileText, Play, FileDown } from 'lucide-react'
import { allCourses } from '@/data/courses'
import { getRecentActions, type StudyAction } from '@/lib/studyLog'
import { Badge } from '@/app/components/ui/badge'

function getActionIcon(type: StudyAction['type']) {
  switch (type) {
    case 'lesson_complete':
      return BookOpen
    case 'video_progress':
      return Video
    case 'note_saved':
      return FileText
    case 'course_started':
      return Play
    case 'pdf_progress':
      return FileDown
    default:
      return BookOpen
  }
}

function getActionLabel(type: StudyAction['type']): string {
  switch (type) {
    case 'lesson_complete':
      return 'Completed lesson'
    case 'video_progress':
      return 'Watched video'
    case 'note_saved':
      return 'Saved note'
    case 'course_started':
      return 'Started course'
    case 'pdf_progress':
      return 'Read PDF'
    default:
      return 'Activity'
  }
}

function getActionColor(type: StudyAction['type']): string {
  switch (type) {
    case 'lesson_complete':
      return 'bg-success'
    case 'video_progress':
      return 'bg-brand'
    case 'note_saved':
      return 'bg-warning'
    case 'course_started':
      return 'bg-info'
    case 'pdf_progress':
      return 'bg-accent-violet'
    default:
      return 'bg-muted-foreground'
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/** Group actions by date string for section headers */
function groupByDate(actions: StudyAction[]): [string, StudyAction[]][] {
  const groups = new Map<string, StudyAction[]>()
  const today = new Date().toLocaleDateString()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

  for (const action of actions) {
    const dateStr = new Date(action.timestamp).toLocaleDateString()
    const label = dateStr === today ? 'Today' : dateStr === yesterday ? 'Yesterday' : dateStr
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(action)
  }

  return Array.from(groups.entries())
}

interface RecentActivityTimelineProps {
  limit?: number
}

export function RecentActivityTimeline({ limit = 8 }: RecentActivityTimelineProps) {
  const actions = getRecentActions(limit)

  if (actions.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8 text-sm">
        No activity yet. Start studying to see your progress here.
      </p>
    )
  }

  const grouped = groupByDate(actions)

  return (
    <div className="space-y-4">
      {grouped.map(([dateLabel, dayActions]) => (
        <div key={dateLabel}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {dateLabel}
          </p>
          <div className="space-y-2">
            {dayActions.map((action, i) => {
              const Icon = getActionIcon(action.type)
              const course = allCourses.find(c => c.id === action.courseId)

              return (
                <div
                  key={`${action.timestamp}-${i}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 motion-safe:transition-colors"
                >
                  {/* Icon with colored indicator */}
                  <div className="relative flex-shrink-0">
                    <div className="rounded-lg bg-muted p-2">
                      <Icon className="size-4 text-foreground" aria-hidden="true" />
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card ${getActionColor(action.type)}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getActionLabel(action.type)}
                      {course && (
                        <span className="text-muted-foreground font-normal">
                          {' '}in {course.title}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Category badge + time */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {course && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                        {course.category}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatRelativeTime(action.timestamp)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
