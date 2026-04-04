/**
 * PlayerHeader — Action toolbar for the unified lesson player.
 *
 * Shows pomodoro, Q&A, reading mode, theater mode, notes, and completion toggle.
 * Navigation (back link, lesson title, course name) is handled by CourseBreadcrumb.
 *
 * @see E89-S05
 */

import { lazy, Suspense, useCallback, useEffect } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Maximize2,
  Minimize2,
  PencilLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { PomodoroTimer } from '@/app/components/figma/PomodoroTimer'
import { Button } from '@/app/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'

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
  showCompletionToggle?: boolean
  /** Called after completion status is successfully persisted */
  onStatusChange?: (status: CompletionStatus) => void
  /** Theater mode state and toggle (desktop only) */
  isTheater?: boolean
  onToggleTheater?: () => void
  /** Notes panel toggle (desktop only, hidden in theater) */
  notesOpen?: boolean
  onToggleNotes?: () => void
  /** Whether notes exist for this lesson (shows dot indicator) */
  hasNotes?: boolean
  /** Reading mode toggle callback */
  onToggleReadingMode?: () => void
  /** Whether reading mode is active */
  isReadingMode?: boolean
}

export function PlayerHeader({
  courseId,
  lessonId,
  showCompletionToggle = false,
  onStatusChange,
  isTheater = false,
  onToggleTheater,
  notesOpen,
  onToggleNotes,
  hasNotes,
  onToggleReadingMode,
  isReadingMode = false,
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
        onStatusChange?.(status)
      } catch {
        toast.error('Failed to update completion status')
      }
    },
    [courseId, lessonId, setItemStatus, onStatusChange]
  )

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-border/50 bg-card shrink-0">
      <PomodoroTimer />

      <Suspense fallback={null}>
        <QAChatPanel />
      </Suspense>

      {onToggleReadingMode && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleReadingMode}
              aria-label={isReadingMode ? 'Exit reading mode' : 'Enter reading mode (Cmd+Shift+R)'}
              aria-pressed={isReadingMode}
              data-testid="reading-mode-toggle"
            >
              <BookOpen className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reading mode (Cmd+Shift+R)</TooltipContent>
        </Tooltip>
      )}

      {onToggleTheater && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          onClick={onToggleTheater}
          aria-label={isTheater ? 'Exit theater mode' : 'Enter theater mode'}
          data-testid="theater-mode-toggle"
        >
          {isTheater ? (
            <Minimize2 className="size-4" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-4" aria-hidden="true" />
          )}
        </Button>
      )}

      {onToggleNotes && !isTheater && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleNotes}
          aria-expanded={notesOpen}
          className="hidden lg:flex gap-1.5"
          data-testid="notes-toggle"
        >
          <span className="relative">
            <PencilLine className="size-4" aria-hidden="true" />
            {hasNotes && !notesOpen && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand" />
            )}
          </span>
          Notes
        </Button>
      )}

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
