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
}

export function CourseBreadcrumb({ courseId, courseName, lessonTitle }: CourseBreadcrumbProps) {
  return (
    <TooltipProvider>
      <Breadcrumb data-testid="course-breadcrumb" className="mb-4">
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
