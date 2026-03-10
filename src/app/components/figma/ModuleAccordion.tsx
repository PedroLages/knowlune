import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { Video, FileText } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import { Badge } from '@/app/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import type { CompletionStatus, Module } from '@/data/types'
import { StatusIndicator } from './StatusIndicator'
import { StatusSelector } from './StatusSelector'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

interface ModuleAccordionProps {
  modules: Module[]
  courseId: string
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
  activeLessonId,
  compact,
}: ModuleAccordionProps) {
  const statusMap = useContentProgressStore(state => state.statusMap)
  const setItemStatus = useContentProgressStore(state => state.setItemStatus)
  const loadCourseProgress = useContentProgressStore(state => state.loadCourseProgress)

  const getStatus = (itemId: string): CompletionStatus =>
    statusMap[`${courseId}:${itemId}`] ?? 'not-started'

  const [openModules, setOpenModules] = useState<string[]>(() => {
    if (!activeLessonId) return []
    return modules.filter(m => m.lessons.some(l => l.id === activeLessonId)).map(m => m.id)
  })
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  // Load progress from IndexedDB on mount
  useEffect(() => {
    loadCourseProgress(courseId)
  }, [courseId, loadCourseProgress])

  // Re-expand when active lesson changes
  useEffect(() => {
    if (!activeLessonId) return
    const activeModuleId = modules.find(m => m.lessons.some(l => l.id === activeLessonId))?.id
    if (!activeModuleId) return
    setOpenModules(prev => (prev.includes(activeModuleId) ? prev : [...prev, activeModuleId]))
  }, [activeLessonId, modules])

  const handleStatusChange = useCallback(
    (itemId: string, status: CompletionStatus) => {
      setItemStatus(courseId, itemId, status, modules)
      setOpenPopover(null)
    },
    [courseId, modules, setItemStatus]
  )

  return (
    <Accordion
      type="multiple"
      value={openModules}
      onValueChange={setOpenModules}
      className="space-y-3"
    >
      {modules.map(module => {
        const moduleStatus = getStatus(module.id)
        const completedInModule = module.lessons.filter(l => getStatus(l.id) === 'completed').length

        return (
          <AccordionItem
            key={module.id}
            value={module.id}
            className="rounded-[24px] border border-border bg-card px-5 shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <StatusIndicator status={moduleStatus} itemId={module.id} mode="display" />
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
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {module.lessons.map(lesson => {
                  const lessonStatus = getStatus(lesson.id)
                  const isActive = lesson.id === activeLessonId
                  const hasVideo = lesson.resources.some(r => r.type === 'video')
                  const hasPdf = lesson.resources.some(r => r.type === 'pdf')
                  const videoDuration = lesson.resources.find(r => r.type === 'video')?.metadata
                    ?.duration
                  const duration =
                    videoDuration != null ? formatDuration(videoDuration) : lesson.duration

                  return (
                    <li key={lesson.id}>
                      <div
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                          isActive ? 'bg-brand-soft text-brand font-medium' : 'hover:bg-accent'
                        )}
                      >
                        <Popover
                          open={openPopover === lesson.id}
                          onOpenChange={open => setOpenPopover(open ? lesson.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <StatusIndicator status={lessonStatus} itemId={lesson.id} />
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-2"
                            align="start"
                            side="right"
                            onOpenAutoFocus={e => e.preventDefault()}
                          >
                            <StatusSelector
                              currentStatus={lessonStatus}
                              onSelect={status => handleStatusChange(lesson.id, status)}
                            />
                          </PopoverContent>
                        </Popover>

                        <Link
                          to={`/courses/${courseId}/${lesson.id}`}
                          className="flex flex-1 items-center gap-3 min-w-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{lesson.title}</p>
                            {duration && (
                              <p className="text-xs text-muted-foreground">{duration}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasVideo && <Video className="size-4 text-brand" />}
                            {hasPdf && <FileText className="size-4 text-destructive" />}
                          </div>
                        </Link>
                      </div>
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
