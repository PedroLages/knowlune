import { Link } from 'react-router'
import { CheckCircle2, Circle, Video, FileText } from 'lucide-react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import type { Module } from '@/data/types'

interface LessonListProps {
  modules: Module[]
  courseId: string
  activeLessonId?: string
  completedLessons: string[]
}

export function LessonList({
  modules,
  courseId,
  activeLessonId,
  completedLessons,
}: LessonListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {modules.map(module => (
          <div key={module.id}>
            <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {module.title}
            </h4>
            <ul className="space-y-0.5">
              {module.lessons.map(lesson => {
                const isActive = lesson.id === activeLessonId
                const isComplete = completedLessons.includes(lesson.id)
                const hasVideo = lesson.resources.some(r => r.type === 'video')
                const hasPdf = lesson.resources.some(r => r.type === 'pdf')

                return (
                  <li key={lesson.id}>
                    <Link
                      to={`/courses/${courseId}/${lesson.id}`}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-brand-soft text-brand font-medium'
                          : 'hover:bg-accent text-foreground'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="size-4 text-success shrink-0" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{lesson.title}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasVideo && <Video className="h-3.5 w-3.5 text-brand" />}
                        {hasPdf && <FileText className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
