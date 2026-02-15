import { FolderOpen, Video, FileText } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { TagBadgeList } from '@/app/components/figma/TagBadgeList'
import { TagEditor } from '@/app/components/figma/TagEditor'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedCourse } from '@/data/types'

interface ImportedCourseCardProps {
  course: ImportedCourse
}

export function ImportedCourseCard({ course }: ImportedCourseCardProps) {
  const updateCourseTags = useCourseImportStore(state => state.updateCourseTags)
  const allTags = useCourseImportStore(state => state.getAllTags)()

  function handleRemoveTag(tag: string) {
    updateCourseTags(course.id, course.tags.filter(t => t !== tag))
  }

  function handleAddTag(tag: string) {
    updateCourseTags(course.id, [...course.tags, tag])
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
          <div data-testid="course-card-placeholder" className="relative h-44 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/50 dark:to-teal-950/50 flex items-center justify-center">
            <FolderOpen className="h-16 w-16 text-emerald-300 dark:text-emerald-600" />
          </div>
          <div className="p-5">
            <h3 data-testid="course-card-title" className="font-bold text-base mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
              {course.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              Imported {new Date(course.importedAt).toLocaleDateString()}
            </p>
            <div className="flex items-center gap-1.5 mb-3">
              <TagBadgeList
                tags={course.tags}
                onRemove={handleRemoveTag}
                maxVisible={3}
              />
              <TagEditor
                currentTags={course.tags}
                allTags={allTags}
                onAddTag={handleAddTag}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span data-testid="course-card-video-count" className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {course.videoCount} {course.videoCount === 1 ? 'video' : 'videos'}
                </span>
              </span>
              <span data-testid="course-card-pdf-count" className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
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
