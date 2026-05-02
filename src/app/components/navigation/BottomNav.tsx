import { useState, lazy, Suspense, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router'
import {
  MoreHorizontal,
  MessageSquarePlus,
  ArrowLeft,
  NotebookPen,
  CircleCheck,
  BookOpen,
  Maximize2,
  Minimize2,
  Clock,
  MessageCircle,
  Circle,
} from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/app/components/ui/drawer'
import { cn } from '@/app/components/ui/utils'
import {
  getPrimaryNav,
  getOverflowNav,
  getIsActive,
  navigationGroups,
  primaryNavPaths,
  settingsItem,
} from '@/app/config/navigation'
import { useProgressiveDisclosure } from '@/app/hooks/useProgressiveDisclosure'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { toast } from 'sonner'
import type { CompletionStatus } from '@/data/types'

// Lazy-load QAChatPanel to avoid pulling AI infra into the mobile bundle
const QAChatPanel = lazy(() =>
  import('@/app/components/figma/QAChatPanel').then(m => ({ default: m.QAChatPanel }))
)

// Lazy-load PomodoroTimer (not heavy but avoids pulling it into every page)
const PomodoroTimer = lazy(() =>
  import('@/app/components/figma/PomodoroTimer').then(m => ({ default: m.PomodoroTimer }))
)

interface BottomNavProps {
  mode?: 'standard' | 'lesson'
  courseId?: string
  lessonId?: string
  onFeedbackClick?: () => void
}

/**
 * Lesson-mode drawer content — rendered inside the Vaul Drawer when mode='lesson'.
 * Self-contained: reads from useLessonChromeStore and useContentProgressStore.
 */
function LessonDrawerContent({
  courseId,
  lessonId,
  onClose,
}: {
  courseId?: string
  lessonId?: string
  onClose: () => void
}) {
  const isTheater = useLessonChromeStore(s => s.isTheater)
  const toggleTheater = useLessonChromeStore(s => s.toggleTheater)
  const isReadingMode = useLessonChromeStore(s => s.isReadingMode)
  const toggleReadingMode = useLessonChromeStore(s => s.toggleReadingMode)

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

  const isCompleted = currentStatus === 'completed'

  const handleToggleCompletion = useCallback(async () => {
    if (!courseId || !lessonId) return
    const nextStatus: CompletionStatus = isCompleted ? 'not-started' : 'completed'
    try {
      await setItemStatus(courseId, lessonId, nextStatus, [])
      toast.success(nextStatus === 'completed' ? 'Lesson completed' : 'Marked as not started')
      onClose()
    } catch {
      toast.error('Failed to update completion status')
    }
  }, [courseId, lessonId, isCompleted, setItemStatus, onClose])

  const handleReadingMode = useCallback(() => {
    toggleReadingMode()
    onClose()
  }, [toggleReadingMode, onClose])

  const handleTheaterMode = useCallback(() => {
    toggleTheater()
    onClose()
  }, [toggleTheater, onClose])

  return (
    <nav className="flex flex-col max-h-[60vh]" aria-label="Lesson tools">
      <div className="overflow-y-auto flex-1 px-4 pt-2 pb-2">
        <ul className="space-y-1">
          {/* Completion toggle */}
          <li>
            <button
              type="button"
              onClick={handleToggleCompletion}
              data-testid="drawer-completion-toggle"
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full',
                isCompleted
                  ? 'text-success'
                  : 'text-foreground hover:bg-accent active:bg-accent'
              )}
            >
              {isCompleted ? (
                <CircleCheck className="size-5" aria-hidden="true" />
              ) : (
                <Circle className="size-5" aria-hidden="true" />
              )}
              <span className="text-sm font-medium">
                {isCompleted ? 'Completed' : 'Mark Complete'}
              </span>
            </button>
          </li>

          {/* Notes toggle */}
          <li>
            <button
              type="button"
              onClick={() => {
                useLessonChromeStore.getState().toggleNotes()
                onClose()
              }}
              data-testid="drawer-notes-toggle"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full text-foreground hover:bg-accent active:bg-accent"
            >
              <NotebookPen className="size-5" aria-hidden="true" />
              <span className="text-sm font-medium">Notes</span>
            </button>
          </li>

          {/* Reading mode toggle */}
          <li>
            <button
              type="button"
              onClick={handleReadingMode}
              data-testid="drawer-reading-mode"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full text-foreground hover:bg-accent active:bg-accent"
            >
              <BookOpen className="size-5" aria-hidden="true" />
              <span className="text-sm font-medium">
                {isReadingMode ? 'Exit Reading Mode' : 'Reading Mode'}
              </span>
            </button>
          </li>

          {/* Theater mode toggle */}
          <li>
            <button
              type="button"
              onClick={handleTheaterMode}
              data-testid="drawer-theater-mode"
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full text-foreground hover:bg-accent active:bg-accent"
            >
              {isTheater ? (
                <Minimize2 className="size-5" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-5" aria-hidden="true" />
              )}
              <span className="text-sm font-medium">
                {isTheater ? 'Exit Theater' : 'Theater Mode'}
              </span>
            </button>
          </li>

          {/* Pomodoro Timer */}
          <li>
            <Suspense
              fallback={
                <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
                  <Clock className="size-5" aria-hidden="true" />
                  <span className="text-sm font-medium">Pomodoro Timer</span>
                </div>
              }
            >
              <PomodoroTimer />
            </Suspense>
          </li>

          {/* QA Chat */}
          <li>
            <Suspense
              fallback={
                <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground">
                  <MessageCircle className="size-5" aria-hidden="true" />
                  <span className="text-sm font-medium">QA Chat</span>
                </div>
              }
            >
              <QAChatPanel />
            </Suspense>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export function BottomNav({ mode = 'standard', courseId, lessonId, onFeedbackClick }: BottomNavProps = {}) {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const { isVisible } = useProgressiveDisclosure()

  // Filter nav items by progressive disclosure
  const primaryNav = getPrimaryNav().filter(item => isVisible(item.disclosureKey))
  const overflowNav = getOverflowNav().filter(item => isVisible(item.disclosureKey))

  // Check if any overflow item is active
  const isMoreActive = overflowNav.some(item =>
    getIsActive(item, location.pathname, location.search)
  )

  // Lesson chrome state (for lesson mode primary slots)
  const notesOpen = useLessonChromeStore(s => s.notesOpen)
  const toggleNotes = useLessonChromeStore(s => s.toggleNotes)
  const hasNotes = useLessonChromeStore(s => s.hasNotes)

  // Completion state (for lesson mode primary slots)
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  useEffect(() => {
    if (mode === 'lesson' && courseId) {
      loadCourseProgress(courseId)
    }
  }, [mode, courseId, loadCourseProgress])

  const completionStatus: CompletionStatus =
    mode === 'lesson' && courseId && lessonId
      ? getItemStatus(courseId, lessonId)
      : 'not-started'

  const isLessonCompleted = completionStatus === 'completed'

  const handleCompletionToggle = useCallback(async () => {
    if (!courseId || !lessonId) return
    const nextStatus: CompletionStatus = isLessonCompleted ? 'not-started' : 'completed'
    try {
      await setItemStatus(courseId, lessonId, nextStatus, [])
      toast.success(nextStatus === 'completed' ? 'Lesson completed' : 'Marked as not started')
    } catch {
      toast.error('Failed to update completion status')
    }
  }, [courseId, lessonId, isLessonCompleted, setItemStatus])

  // -------------------------------------------------------------------------
  // Lesson-mode primary nav items
  // -------------------------------------------------------------------------

  const lessonPrimarySlots = (
    <>
      {/* Back to Course */}
      {courseId && (
        <Link
          to={`/courses/${courseId}`}
          aria-label="Back to course"
          className="flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150 text-muted-foreground active:text-brand"
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-none">Back</span>
        </Link>
      )}

      {/* Notes */}
      <button
        type="button"
        onClick={toggleNotes}
        aria-label="Toggle notes"
        aria-expanded={notesOpen}
        data-testid="bottomnav-notes-toggle"
        className={cn(
          'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
          notesOpen || hasNotes ? 'text-brand' : 'text-muted-foreground active:text-brand'
        )}
      >
        <span className="relative">
          <NotebookPen className="size-6" aria-hidden="true" />
          {hasNotes && !notesOpen && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand" />
          )}
        </span>
        <span className="text-[10px] font-medium leading-none">Notes</span>
      </button>

      {/* Completion */}
      <button
        type="button"
        onClick={handleCompletionToggle}
        aria-label={isLessonCompleted ? 'Mark as not started' : 'Mark as completed'}
        data-testid="bottomnav-completion-toggle"
        className={cn(
          'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
          isLessonCompleted ? 'text-success' : 'text-muted-foreground active:text-brand'
        )}
      >
        <CircleCheck className="size-6" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-none">
          {isLessonCompleted ? 'Done' : 'Complete'}
        </span>
      </button>

      {/* More (opens lesson drawer) */}
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-label="More lesson tools"
        aria-expanded={moreOpen}
        data-testid="bottomnav-more-trigger"
        className="flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150 text-muted-foreground active:text-brand"
      >
        <MoreHorizontal className="size-6" aria-hidden="true" />
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>
    </>
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isLessonMode = mode === 'lesson'

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
        aria-label={isLessonMode ? 'Lesson navigation' : 'Mobile navigation'}
      >
        <div className="flex items-center justify-around h-14">
          {isLessonMode ? (
            lessonPrimarySlots
          ) : (
            <>
              {/* Primary Navigation Items */}
              {primaryNav.map(item => {
                const Icon = item.icon
                const active = getIsActive(item, location.pathname, location.search)
                const href = item.tab ? `${item.path}?tab=${item.tab}` : item.path

                return (
                  <Link
                    key={item.tab ? `${item.path}?tab=${item.tab}` : item.path}
                    to={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
                      active ? 'text-brand' : 'text-muted-foreground active:text-brand'
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                    <span className="text-[10px] font-medium leading-none">{item.name}</span>
                  </Link>
                )
              })}

              {/* More Button */}
              <button
                onClick={() => setMoreOpen(true)}
                aria-label="More menu"
                aria-expanded={moreOpen}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 h-14 transition-colors duration-150',
                  isMoreActive ? 'text-brand' : 'text-muted-foreground active:text-brand'
                )}
              >
                <MoreHorizontal className="size-6" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none">More</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen} direction="bottom">
        <DrawerContent>
          <DrawerHeader>
            <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-4" aria-hidden="true" />
            <DrawerTitle>{isLessonMode ? 'Lesson Tools' : 'More Options'}</DrawerTitle>
          </DrawerHeader>

          {isLessonMode ? (
            <LessonDrawerContent
              courseId={courseId}
              lessonId={lessonId}
              onClose={() => setMoreOpen(false)}
            />
          ) : (
            <nav className="flex flex-col max-h-[60vh]" aria-label="Additional navigation">
              {/* Scrollable nav links area */}
              <div className="overflow-y-auto flex-1 px-4 pt-2 pb-2">
                {/* Render overflow items grouped by navigationGroups for consistency with the sidebar */}
                {navigationGroups.map(group => {
                  const items = group.items.filter(item => !primaryNavPaths.includes(item.path))
                  if (items.length === 0) return null
                  return (
                    <section key={group.label} className="mb-4">
                      <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </p>
                      <ul className="space-y-1">
                        {items.map(item => {
                          const Icon = item.icon
                          const active = getIsActive(item, location.pathname, location.search)
                          const href = item.tab ? `${item.path}?tab=${item.tab}` : item.path
                          return (
                            <li key={item.tab ? `${item.path}?tab=${item.tab}` : item.path}>
                              <Link
                                to={href}
                                onClick={() => setMoreOpen(false)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150',
                                  active
                                    ? 'bg-brand text-brand-foreground'
                                    : 'text-foreground hover:bg-accent active:bg-accent'
                                )}
                              >
                                <Icon className="size-5" aria-hidden="true" />
                                <span className="text-sm font-medium">{item.name}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
                {/* Settings always appears at the bottom of the scrollable section */}
                <div className="border-t border-border pt-2 mb-2">
                  <ul>
                    {(() => {
                      const item = settingsItem
                      const Icon = item.icon
                      const active = getIsActive(item, location.pathname, location.search)
                      const href = item.path
                      return (
                        <li key={href}>
                          <Link
                            to={href}
                            onClick={() => setMoreOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150',
                              active
                                ? 'bg-brand text-brand-foreground'
                                : 'text-foreground hover:bg-accent active:bg-accent'
                            )}
                          >
                            <Icon className="size-5" aria-hidden="true" />
                            <span className="text-sm font-medium">{item.name}</span>
                          </Link>
                        </li>
                      )
                    })()}
                  </ul>
                </div>
              </div>
              {/* Send Feedback pinned to bottom — always visible regardless of scroll position */}
              <div className="sticky bottom-0 bg-background border-t border-border px-4 pb-6 pt-2">
                <button
                  type="button"
                  data-testid="feedback-trigger-mobile"
                  onClick={() => {
                    setMoreOpen(false)
                    onFeedbackClick?.()
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 w-full',
                    'text-foreground hover:bg-accent active:bg-accent'
                  )}
                >
                  <MessageSquarePlus className="size-5" aria-hidden="true" />
                  <span className="text-sm font-medium">Send Feedback</span>
                </button>
              </div>
            </nav>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
