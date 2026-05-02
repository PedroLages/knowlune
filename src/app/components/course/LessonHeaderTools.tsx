/**
 * LessonHeaderTools — Lesson action buttons for the Layout header.
 *
 * Self-contained component with no props. Reads lesson chrome state from
 * useLessonChromeStore, completion state from useContentProgressStore, and
 * route context from useCourseRoute.
 *
 * Renders: PomodoroTimer, QAChatPanel (lazy), reading mode toggle, theater
 * mode toggle (hidden below lg), notes toggle (hidden below lg), and
 * completion status dropdown (hidden for guests).
 *
 * All tools carry data-theater-hide for theater/reading mode compatibility.
 *
 * @see docs/plans/2026-05-02-001-feat-merge-lesson-toolbar-into-header-plan.md  Unit 3
 */

import { lazy, Suspense, useCallback, useEffect } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  PencilLine,
  SkipForward,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'
import { PomodoroTimer } from '@/app/components/figma/PomodoroTimer'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useCourseRoute } from '@/app/hooks/useCourseRoute'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'
import type { CompletionStatus } from '@/data/types'

// Lazy-load QAChatPanel to avoid pulling AI infra into the initial player bundle
const QAChatPanel = lazy(() =>
  import('@/app/components/figma/QAChatPanel').then(m => ({ default: m.QAChatPanel }))
)

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

const STATUS_COLORS: Record<CompletionStatus, string> = {
  'not-started': 'text-muted-foreground',
  'in-progress': 'text-warning',
  completed: 'text-success',
}

/**
 * Lesson tools rendered inside the Layout header on lesson player pages.
 * Self-contained — reads all required state from stores and hooks.
 */
export function LessonHeaderTools() {
  const { courseId, lessonId } = useCourseRoute()
  const isGuest = useAuthStore(selectIsGuestMode)

  // Lesson chrome state
  const isTheater = useLessonChromeStore(s => s.isTheater)
  const toggleTheater = useLessonChromeStore(s => s.toggleTheater)
  const isReadingMode = useLessonChromeStore(s => s.isReadingMode)
  const toggleReadingMode = useLessonChromeStore(s => s.toggleReadingMode)
  const notesOpen = useLessonChromeStore(s => s.notesOpen)
  const toggleNotes = useLessonChromeStore(s => s.toggleNotes)
  const hasNotes = useLessonChromeStore(s => s.hasNotes)
  const autoPlay = useLessonChromeStore(s => s.autoPlay)
  const toggleAutoPlay = useLessonChromeStore(s => s.toggleAutoPlay)
  const qaPanelOpen = useLessonChromeStore(s => s.qaPanelOpen)
  const toggleQAPanel = useLessonChromeStore(s => s.toggleQAPanel)
  const setQAPanelOpen = useLessonChromeStore(s => s.setQAPanelOpen)

  // Completion state
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  const currentStatus: CompletionStatus =
    courseId && lessonId
      ? getItemStatus(courseId, lessonId)
      : 'not-started'

  const StatusIcon = STATUS_ICONS[currentStatus]

  const handleStatusChange = useCallback(
    async (status: CompletionStatus) => {
      if (!courseId || !lessonId) return
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
    <div
      data-theater-hide
      className="hidden md:flex items-center gap-2"
    >
      {/* Secondary tools group — visible inline on desktop, collapsed into kebab on tablet */}
      <span className="hidden lg:contents">
        <PomodoroTimer />

        <Suspense fallback={null}>
          <QAChatPanel open={qaPanelOpen} onOpenChange={setQAPanelOpen} />
        </Suspense>

        {/* Reading mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleReadingMode}
              aria-label={isReadingMode ? 'Exit reading mode' : 'Enter reading mode (Cmd+Option+R)'}
              aria-pressed={isReadingMode}
              data-testid="reading-mode-toggle"
            >
              <BookOpen className="size-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reading mode (Cmd+Option+R)</TooltipContent>
        </Tooltip>

        {/* Theater mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheater}
          aria-label={isTheater ? 'Exit theater mode' : 'Enter theater mode'}
          data-testid="theater-mode-toggle"
        >
          {isTheater ? (
            <Minimize2 className="size-5" aria-hidden="true" />
          ) : (
            <Maximize2 className="size-5" aria-hidden="true" />
          )}
        </Button>

        {/* Auto-play toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleAutoPlay}
              aria-label={autoPlay ? 'Auto-play is on' : 'Auto-play is off'}
              data-testid="autoplay-toggle"
            >
              <SkipForward
                className={cn('size-5', !autoPlay && 'text-muted-foreground')}
                aria-hidden="true"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Auto-play: {autoPlay ? 'On' : 'Off'}</TooltipContent>
        </Tooltip>
      </span>

      {/* Tablet kebab menu — secondary tools */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex lg:hidden"
            aria-label="More lesson tools"
            data-testid="tablet-kebab-trigger"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={toggleReadingMode}
            data-testid="kebab-reading-mode"
          >
            <BookOpen className="size-5 mr-2" aria-hidden="true" />
            {isReadingMode ? 'Exit Reading Mode' : 'Reading Mode'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={toggleTheater}
            data-testid="kebab-theater-mode"
          >
            {isTheater ? (
              <Minimize2 className="size-5 mr-2" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-5 mr-2" aria-hidden="true" />
            )}
            {isTheater ? 'Exit Theater' : 'Theater Mode'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={toggleAutoPlay}
            data-testid="kebab-autoplay"
          >
            <SkipForward className="size-5 mr-2" aria-hidden="true" />
            Auto-play: {autoPlay ? 'On' : 'Off'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={toggleQAPanel}
            data-testid="kebab-qa-panel"
          >
            <MessageCircle className="size-5 mr-2" aria-hidden="true" />
            Ask AI
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notes toggle — visible on tablet and desktop */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleNotes}
        aria-expanded={notesOpen}
        className="flex gap-1.5"
        data-testid="notes-toggle"
      >
        <span className="relative">
          <PencilLine className="size-5" aria-hidden="true" />
          {hasNotes && !notesOpen && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand" />
          )}
        </span>
        Notes
      </Button>

      {/* Completion status dropdown — hidden for guest users */}
      {!isGuest && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn('gap-1.5', STATUS_COLORS[currentStatus])}
              data-testid="completion-toggle"
              aria-label={`Completion status: ${STATUS_LABELS[currentStatus]}`}
            >
              <StatusIcon className="size-5" aria-hidden="true" />
              <span className="hidden sm:inline">{STATUS_LABELS[currentStatus]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATUS_LABELS) as CompletionStatus[]).map(status => {
              const Icon = STATUS_ICONS[status]
              const isActive = status === currentStatus
              return (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => handleStatusChange(status)}
                  data-testid={`status-option-${status}`}
                  className={cn(STATUS_COLORS[status], isActive && 'font-semibold bg-accent')}
                >
                  <Icon className="size-5 mr-2" aria-hidden="true" />
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
