import { PanelRightClose, X } from 'lucide-react'
import type { CourseAdapter } from '@/lib/courseAdapter'
import { Button } from '@/app/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { LessonsTab } from '@/app/components/course/tabs/LessonsTab'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'

interface CourseSyllabusPanelProps {
  courseId: string
  lessonId: string
  courseName: string
  adapter: CourseAdapter
  currentPosition: number | null
  totalLessons: number
  progressPercent: number | null
  inlineOpen: boolean
  overlayOpen: boolean
  onInlineClose: () => void
  onOverlayOpenChange: (open: boolean) => void
  onFocusMaterials?: () => void
}

interface SyllabusBodyProps extends Pick<
  CourseSyllabusPanelProps,
  | 'courseId'
  | 'lessonId'
  | 'courseName'
  | 'adapter'
  | 'currentPosition'
  | 'totalLessons'
  | 'progressPercent'
  | 'onFocusMaterials'
> {
  onClose?: () => void
  closeLabel?: string
  onLessonSelect?: () => void
}

function SyllabusBody({
  courseId,
  lessonId,
  courseName,
  adapter,
  currentPosition,
  totalLessons,
  progressPercent,
  onFocusMaterials,
  onClose,
  closeLabel = 'Hide course content',
  onLessonSelect,
}: SyllabusBodyProps) {
  return (
    <div id="course-syllabus-panel" className="flex h-full min-h-0 flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-sm font-semibold text-foreground" title={courseName}>
              {courseName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {currentPosition !== null && totalLessons > 0
                ? `Lesson ${currentPosition} of ${totalLessons}`
                : `${totalLessons} lessons`}
            </p>
          </div>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 size-11 shrink-0"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <PanelRightClose className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {progressPercent !== null ? (
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Course progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <div
                className="h-full rounded-full bg-success transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{progressPercent}%</span>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <LessonsTab
          courseId={courseId}
          lessonId={lessonId}
          adapter={adapter}
          onFocusMaterials={onFocusMaterials}
          onLessonSelect={onLessonSelect}
        />
      </div>
    </div>
  )
}

export function CourseSyllabusPanel(props: CourseSyllabusPanelProps) {
  const isWide = useMediaQuery('(min-width: 1440px)')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const closeOverlay = () => props.onOverlayOpenChange(false)
  const bodyProps = {
    courseId: props.courseId,
    lessonId: props.lessonId,
    courseName: props.courseName,
    adapter: props.adapter,
    currentPosition: props.currentPosition,
    totalLessons: props.totalLessons,
    progressPercent: props.progressPercent,
    onFocusMaterials: props.onFocusMaterials,
  }

  if (isWide) {
    return props.inlineOpen ? (
      <aside
        data-testid="desktop-sidebar"
        aria-label="Course content"
        className="sticky top-0 hidden h-[calc(100dvh-7rem)] w-[clamp(352px,24vw,400px)] shrink-0 self-start overflow-hidden rounded-2xl border border-border bg-card shadow-sm min-[1440px]:flex min-[1440px]:flex-col"
      >
        <SyllabusBody {...bodyProps} onClose={props.onInlineClose} />
      </aside>
    ) : null
  }

  if (isMobile) {
    return (
      <Drawer open={props.overlayOpen} onOpenChange={props.onOverlayOpenChange}>
        <DrawerContent className="max-h-[85svh] pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Course Content</DrawerTitle>
            <DrawerDescription>
              Browse sections and lessons in {props.courseName}.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10 size-11"
              aria-label="Close course content"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DrawerClose>
          <div className="min-h-0 flex-1 overflow-hidden pt-3">
            <SyllabusBody {...bodyProps} onLessonSelect={closeOverlay} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={props.overlayOpen} onOpenChange={props.onOverlayOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[400px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Course Content</SheetTitle>
          <SheetDescription>Browse sections and lessons in {props.courseName}.</SheetDescription>
        </SheetHeader>
        <SyllabusBody {...bodyProps} onLessonSelect={closeOverlay} />
      </SheetContent>
    </Sheet>
  )
}
