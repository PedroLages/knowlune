/**
 * PlayerHeader — Header bar for the unified lesson player.
 *
 * Shows back link, lesson title, course name, and optional completion status toggle.
 *
 * @see E89-S05
 */

import { lazy, Suspense, useCallback, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { PomodoroTimer } from '@/app/components/figma/PomodoroTimer'
import { Button } from '@/app/components/ui/button'

// Lazy-load QAChatPanel to avoid pulling AI infra into the initial player bundle
const QAChatPanel = lazy(() =>
  import('@/app/components/figma/QAChatPanel').then(m => ({ default: m.QAChatPanel }))
)
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import type { CompletionStatus } from '@/data/types'

const STATUS_LABELS: Record<CompletionStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

const STATUS_ICONS: Record<CompletionStatus, React.ComponentType<{ className?: string }>> = {
  'not-started': Circle,
  'in-progress': Clock,
  completed: CheckCircle2,
}

interface PlayerHeaderProps {
  courseId: string
  lessonId: string
  lessonTitle: string
  courseName?: string
  showCompletionToggle?: boolean
}

export function PlayerHeader({
  courseId,
  lessonId,
  lessonTitle,
  courseName,
  showCompletionToggle = false,
}: PlayerHeaderProps) {
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  const currentStatus = getItemStatus(courseId, lessonId)
  const StatusIcon = STATUS_ICONS[currentStatus]

  const handleStatusChange = useCallback(
    async (status: CompletionStatus) => {
      try {
        await setItemStatus(courseId, lessonId, status, [])
        toast.success(`Marked as ${STATUS_LABELS[status]}`)
      } catch {
        toast.error('Failed to update completion status')
      }
    },
    [courseId, lessonId, setItemStatus]
  )

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
      <Link
        to={`/courses/${courseId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Back to course"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <div className="flex flex-col min-w-0 flex-1">
        <span data-testid="lesson-header-title" className="font-semibold text-sm truncate">
          {lessonTitle}
        </span>
        {courseName && (
          <span
            data-testid="lesson-header-course"
            className="text-xs text-muted-foreground truncate"
          >
            {courseName}
          </span>
        )}
      </div>

      <PomodoroTimer />

      <Suspense fallback={null}>
        <QAChatPanel />
      </Suspense>

      {showCompletionToggle && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="completion-toggle"
              aria-label={`Completion status: ${STATUS_LABELS[currentStatus]}`}
            >
              <StatusIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{STATUS_LABELS[currentStatus]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATUS_LABELS) as CompletionStatus[]).map(status => {
              const Icon = STATUS_ICONS[status]
              return (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => handleStatusChange(status)}
                  data-testid={`status-option-${status}`}
                >
                  <Icon className="size-4 mr-2" aria-hidden="true" />
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
