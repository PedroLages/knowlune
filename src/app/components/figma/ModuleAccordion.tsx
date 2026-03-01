import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Circle, Video, FileText } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
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
  activeLessonId?: string
  compact?: boolean
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

export function ModuleAccordion({
  modules,
  courseId,
  completedLessons,
  activeLessonId,
  compact,
}: ModuleAccordionProps) {
  // Controlled accordion — auto-expand module containing the active lesson
  const [openModules, setOpenModules] = useState<string[]>(() => {
    if (!activeLessonId) return []
    return modules.filter(m => m.lessons.some(l => l.id === activeLessonId)).map(m => m.id)
  })

  // Re-expand when active lesson changes (cross-module navigation via Next button)
  useEffect(() => {
    if (!activeLessonId) return
    const activeModuleId = modules.find(m => m.lessons.some(l => l.id === activeLessonId))?.id
    if (!activeModuleId) return
    setOpenModules(prev => (prev.includes(activeModuleId) ? prev : [...prev, activeModuleId]))
  }, [activeLessonId, modules])

  return (
    <Accordion
      type="multiple"
      value={openModules}
      onValueChange={setOpenModules}
      className="space-y-3"
    >
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
                {!compact && module.description && (
                  <span className="text-xs text-muted-foreground">{module.description}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {module.lessons.map(lesson => {
                  const isComplete = completedLessons.includes(lesson.id)
                  const isActive = lesson.id === activeLessonId
                  const hasVideo = lesson.resources.some(r => r.type === 'video')
                  const hasPdf = lesson.resources.some(r => r.type === 'pdf')
                  const videoDuration = lesson.resources.find(r => r.type === 'video')?.metadata
                    ?.duration
                  const duration =
                    videoDuration != null ? formatDuration(videoDuration) : lesson.duration

                  return (
                    <li key={lesson.id}>
                      <Link
                        to={`/courses/${courseId}/${lesson.id}`}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                            : 'hover:bg-accent'
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="size-5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="size-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lesson.title}</p>
                          {duration && <p className="text-xs text-muted-foreground">{duration}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasVideo && <Video className="size-4 text-blue-400" />}
                          {hasPdf && <FileText className="size-4 text-red-400" />}
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
