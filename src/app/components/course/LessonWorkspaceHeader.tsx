import type { RefObject } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { CourseBreadcrumb } from '@/app/components/course/CourseBreadcrumb'
import { LessonHeaderTools } from '@/app/components/course/LessonHeaderTools'

interface LessonWorkspaceHeaderProps {
  courseId: string
  courseName: string
  sectionTitle?: string | null
  lessonTitle: string
  currentPosition: number | null
  totalLessons: number
  titleRef: RefObject<HTMLHeadingElement | null>
  syllabusVisible: boolean
  onToggleSyllabus: () => void
}

export function LessonWorkspaceHeader({
  courseId,
  courseName,
  sectionTitle,
  lessonTitle,
  currentPosition,
  totalLessons,
  titleRef,
  syllabusVisible,
  onToggleSyllabus,
}: LessonWorkspaceHeaderProps) {
  const positionLabel =
    currentPosition !== null && totalLessons > 0
      ? `Lesson ${currentPosition} of ${totalLessons}`
      : 'Lesson'

  return (
    <header className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <CourseBreadcrumb
        courseId={courseId}
        courseName={courseName}
        lessonTitle={lessonTitle}
        sectionTitle={sectionTitle}
        lessonPosition={positionLabel}
      />

      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1
            ref={titleRef}
            tabIndex={-1}
            data-testid="lesson-title"
            className="scroll-mt-4 text-pretty text-xl font-semibold leading-tight text-foreground focus-visible:outline-none sm:text-2xl"
          >
            {lessonTitle}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LessonHeaderTools />
          <Button
            variant={syllabusVisible ? 'brand-ghost' : 'outline'}
            onClick={onToggleSyllabus}
            className="min-h-11 gap-2 px-3"
            aria-expanded={syllabusVisible}
            aria-controls="course-syllabus-panel"
            aria-keyshortcuts="Shift+S"
            data-testid="syllabus-toggle"
          >
            {syllabusVisible ? (
              <PanelRightClose className="size-4" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="size-4" aria-hidden="true" />
            )}
            <span className="hidden lg:inline">
              {syllabusVisible ? 'Hide Content' : 'Course Content'}
            </span>
            <span className="lg:hidden">Content</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
