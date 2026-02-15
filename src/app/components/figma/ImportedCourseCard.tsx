import { FolderOpen, Video, FileText, Circle, CheckCircle2, PauseCircle } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { TagBadgeList } from '@/app/components/figma/TagBadgeList'
import { TagEditor } from '@/app/components/figma/TagEditor'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse, LearnerCourseStatus } from '@/data/types'

const statusConfig: Record<
  LearnerCourseStatus,
  { label: string; icon: typeof Circle; badgeClass: string }
> = {
  active: {
    label: 'Active',
    icon: Circle,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  paused: {
    label: 'Paused',
    icon: PauseCircle,
    badgeClass: 'bg-gray-100 text-gray-400 dark:bg-gray-800/50 dark:text-gray-400',
  },
}

interface ImportedCourseCardProps {
  course: ImportedCourse
  allTags: string[]
}

export function ImportedCourseCard({ course, allTags }: ImportedCourseCardProps) {
  const updateCourseTags = useCourseImportStore(state => state.updateCourseTags)
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)

  const status = course.status
  const config = statusConfig[status]
  const StatusIcon = config.icon

  function handleRemoveTag(tag: string) {
    updateCourseTags(
      course.id,
      course.tags.filter(t => t !== tag)
    )
  }

  function handleAddTag(tag: string) {
    updateCourseTags(course.id, [...course.tags, tag])
  }

  function handleStatusChange(newStatus: LearnerCourseStatus) {
    if (newStatus !== status) {
      updateCourseStatus(course.id, newStatus)
    }
  }

  return (
    <article
      data-testid="imported-course-card"
      aria-label={`${course.name} — ${course.videoCount} ${course.videoCount === 1 ? 'video' : 'videos'}, ${course.pdfCount} ${course.pdfCount === 1 ? 'PDF' : 'PDFs'}`}
    >
      <div
        className="rounded-[24px] cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none block"
        tabIndex={0}
      >
        <Card className="group bg-card rounded-[24px] border-0 shadow-sm overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 motion-reduce:hover:scale-100">
          <div
            data-testid="course-card-placeholder"
            className="relative h-44 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center"
          >
            <FolderOpen className="size-16 text-emerald-300 dark:text-emerald-600" />
            <div className="absolute top-3 right-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="status-badge"
                    onClick={e => e.stopPropagation()}
                    className="focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-full outline-none"
                    aria-label={`Course status: ${config.label}. Click to change.`}
                  >
                    <Badge
                      className={cn('border-0 text-xs gap-1 cursor-pointer hover:opacity-80 transition-opacity', config.badgeClass)}
                    >
                      <StatusIcon className="size-3" aria-hidden="true" />
                      {config.label}
                    </Badge>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                  {(Object.entries(statusConfig) as [LearnerCourseStatus, typeof config][]).map(
                    ([key, cfg]) => {
                      const Icon = cfg.icon
                      return (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className="gap-2"
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {cfg.label}
                          {key === status && (
                            <CheckCircle2
                              className="size-3.5 ml-auto text-blue-600"
                              aria-hidden="true"
                            />
                          )}
                        </DropdownMenuItem>
                      )
                    }
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="p-5">
            <h3
              data-testid="course-card-title"
              className="font-bold text-base mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors"
            >
              {course.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Imported {new Date(course.importedAt).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-1.5 mb-3">
              <TagBadgeList tags={course.tags} onRemove={handleRemoveTag} maxVisible={3} />
              <TagEditor currentTags={course.tags} allTags={allTags} onAddTag={handleAddTag} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span data-testid="course-card-video-count" className="flex items-center gap-1">
                <Video className="size-3.5" aria-hidden="true" />
                <span>
                  {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                </span>
              </span>
              <span data-testid="course-card-pdf-count" className="flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden="true" />
                <span>
                  {course.pdfCount} {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
                </span>
              </span>
            </div>
          </div>
        </Card>
      </div>
    </article>
  )
}
