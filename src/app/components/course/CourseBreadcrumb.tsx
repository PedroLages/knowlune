/**
 * CourseBreadcrumb — Breadcrumb trail for course detail and lesson player pages.
 *
 * Shows: Courses > [Course Name] (on detail page)
 *        Courses > [Course Name] > [Lesson Title] (on player page)
 *
 * Long names truncate with ellipsis and show full text in a tooltip.
 *
 * NOTE: data-testid on <Breadcrumb> is spread correctly — shadcn Breadcrumb
 * uses forwardRef and spreads rest props onto the underlying <nav> element.
 *
 * @see E89-S08
 */

import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'

interface CourseBreadcrumbProps {
  courseId: string
  courseName: string
  /** If provided, renders the lesson segment. Omit for course detail page. */
  lessonTitle?: string
  /** Optional course section shown between the course and lesson. */
  sectionTitle?: string | null
  /** Compact mobile position, for example “Lesson 12 of 74”. */
  lessonPosition?: string
}

export function CourseBreadcrumb({
  courseId,
  courseName,
  lessonTitle,
  sectionTitle,
  lessonPosition,
}: CourseBreadcrumbProps) {
  return (
    <TooltipProvider>
      {lessonTitle ? (
        <div className="mb-2 flex items-center justify-between gap-3 sm:hidden">
          <Link
            to={`/courses/${courseId}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Course
          </Link>
          {lessonPosition ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {lessonPosition}
            </span>
          ) : null}
        </div>
      ) : null}

      <Breadcrumb
        data-testid="course-breadcrumb"
        className={lessonTitle ? 'mb-2 hidden sm:block' : 'mb-4'}
      >
        <BreadcrumbList>
          {/* Courses root */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/courses">Courses</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbSeparator />

          {/* Course name — link if on lesson page, current page if on detail page */}
          <BreadcrumbItem className="max-w-[200px] sm:max-w-[300px]">
            {lessonTitle ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <BreadcrumbLink asChild>
                    <Link to={`/courses/${courseId}`} className="truncate block">
                      {courseName}
                    </Link>
                  </BreadcrumbLink>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{courseName}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <BreadcrumbPage className="truncate block">{courseName}</BreadcrumbPage>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{courseName}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </BreadcrumbItem>

          {lessonTitle && sectionTitle ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="max-w-[180px] lg:max-w-[240px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate text-muted-foreground">{sectionTitle}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{sectionTitle}</p>
                  </TooltipContent>
                </Tooltip>
              </BreadcrumbItem>
            </>
          ) : null}

          {/* Lesson title segment (only on player page) */}
          {lessonTitle && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="max-w-[200px] sm:max-w-[300px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BreadcrumbPage className="truncate block">{lessonTitle}</BreadcrumbPage>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{lessonTitle}</p>
                  </TooltipContent>
                </Tooltip>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </TooltipProvider>
  )
}
