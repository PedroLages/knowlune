import { useEffect, useState, useMemo } from 'react'
import { FileText } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { NoteCard } from './NoteCard'
import { useNoteStore } from '@/stores/useNoteStore'
import type { Module, Note } from '@/data/types'

type SortMode = 'video-order' | 'date-created'

interface CourseNotesTabProps {
  courseId: string
  modules: Module[]
}

interface LessonGroup {
  lessonId: string
  lessonTitle: string
  moduleTitle: string
  moduleOrder: number
  lessonOrder: number
  notes: Note[]
}

export function CourseNotesTab({ courseId, modules }: CourseNotesTabProps) {
  const { notes, isLoading, loadNotesByCourse } = useNoteStore()
  const [sortMode, setSortMode] = useState<SortMode>('video-order')

  useEffect(() => {
    loadNotesByCourse(courseId)
  }, [courseId, loadNotesByCourse])

  // Build a lookup map from lessonId → { lessonTitle, moduleTitle, orders }
  const lessonMap = useMemo(() => {
    const map = new Map<string, { lessonTitle: string; moduleTitle: string; moduleOrder: number; lessonOrder: number }>()
    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        map.set(lesson.id, {
          lessonTitle: lesson.title,
          moduleTitle: mod.title,
          moduleOrder: mod.order,
          lessonOrder: lesson.order,
        })
      }
    }
    return map
  }, [modules])

  // Group notes by module → lesson and apply sorting
  const groupedByModule = useMemo(() => {
    // Build lesson groups
    const groupMap = new Map<string, LessonGroup>()
    for (const note of notes) {
      const info = lessonMap.get(note.videoId)
      if (!info) continue // orphan note — skip

      let group = groupMap.get(note.videoId)
      if (!group) {
        group = {
          lessonId: note.videoId,
          lessonTitle: info.lessonTitle,
          moduleTitle: info.moduleTitle,
          moduleOrder: info.moduleOrder,
          lessonOrder: info.lessonOrder,
          notes: [],
        }
        groupMap.set(note.videoId, group)
      }
      group.notes.push(note)
    }

    // Sort notes within each group by creation date (newest first)
    for (const group of groupMap.values()) {
      group.notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    // Collect all groups
    const allGroups = Array.from(groupMap.values())

    // Sort groups
    if (sortMode === 'video-order') {
      allGroups.sort((a, b) => a.moduleOrder - b.moduleOrder || a.lessonOrder - b.lessonOrder)
    } else {
      // Sort by most recent note first
      allGroups.sort((a, b) => {
        const aLatest = new Date(a.notes[0].updatedAt).getTime()
        const bLatest = new Date(b.notes[0].updatedAt).getTime()
        return bLatest - aLatest
      })
    }

    // Group by module
    const moduleGroups = new Map<string, LessonGroup[]>()
    for (const group of allGroups) {
      const key = group.moduleTitle
      let arr = moduleGroups.get(key)
      if (!arr) {
        arr = []
        moduleGroups.set(key, arr)
      }
      arr.push(group)
    }

    return moduleGroups
  }, [notes, lessonMap, sortMode])

  const totalNotes = notes.length

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (totalNotes === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <h3 className="text-base font-semibold mb-1">No notes yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Start taking notes while watching videos. Your notes will appear here grouped by lesson.
        </p>
      </div>
    )
  }

  // All module IDs for default-open accordion
  const moduleKeys = Array.from(groupedByModule.keys())

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {totalNotes} {totalNotes === 1 ? 'note' : 'notes'}
        </p>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button
            variant={sortMode === 'video-order' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => setSortMode('video-order')}
          >
            Video Order
          </Button>
          <Button
            variant={sortMode === 'date-created' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs h-7 px-2.5"
            onClick={() => setSortMode('date-created')}
          >
            Date Created
          </Button>
        </div>
      </div>

      {/* Notes grouped by module → lesson */}
      <Accordion type="multiple" defaultValue={moduleKeys} className="space-y-3">
        {Array.from(groupedByModule.entries()).map(([moduleTitle, lessonGroups]) => (
          <AccordionItem
            key={moduleTitle}
            value={moduleTitle}
            className="rounded-[24px] border border-border bg-card/50 px-5 shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{moduleTitle}</span>
                <Badge variant="secondary" className="text-xs">
                  {lessonGroups.reduce((sum, g) => sum + g.notes.length, 0)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {lessonGroups.map(group => (
                  <div key={group.lessonId}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 px-1">
                      {group.lessonTitle}
                    </h4>
                    <div className="space-y-2">
                      {group.notes.map(note => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          courseId={courseId}
                          lessonTitle={group.lessonTitle}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
