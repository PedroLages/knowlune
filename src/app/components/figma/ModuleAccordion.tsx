import { Link } from 'react-router'
import { CheckCircle2, Circle, Video, FileText } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import { Badge } from '@/app/components/ui/badge'
import type { Module } from '@/data/types'

interface ModuleAccordionProps {
  modules: Module[]
  courseId: string
  completedLessons: string[]
}

export function ModuleAccordion({ modules, courseId, completedLessons }: ModuleAccordionProps) {
  return (
    <Accordion type="multiple" className="space-y-3">
      {modules.map(module => {
        const completedInModule = module.lessons.filter(l => completedLessons.includes(l.id)).length

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            className="rounded-[24px] border border-border bg-card px-5 shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{module.title}</span>
                  {module.lessons.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {completedInModule}/{module.lessons.length}
                    </Badge>
                  )}
                </div>
                {module.description && (
                  <span className="text-xs text-muted-foreground">{module.description}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {module.lessons.map(lesson => {
                  const isComplete = completedLessons.includes(lesson.id)
                  const hasVideo = lesson.resources.some(r => r.type === 'video')
                  const hasPdf = lesson.resources.some(r => r.type === 'pdf')

                  return (
                    <li key={lesson.id}>
                      <Link
                        to={`/courses/${courseId}/${lesson.id}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent transition-colors"
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lesson.title}</p>
                          {lesson.duration && (
                            <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasVideo && <Video className="h-4 w-4 text-info" />}
                          {hasPdf && <FileText className="h-4 w-4 text-destructive/70" />}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
