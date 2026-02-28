import { useEffect, useMemo, useState } from 'react'
import { FileText, ArrowUpDown } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { NoteCard } from './NoteCard'
import { useNoteStore } from '@/stores/useNoteStore'
import type { Module, Note } from '@/data/types'

interface CourseNotesTabProps {
  courseId: string
  modules: Module[]
}

type SortMode = 'video-order' | 'date-created'

interface LessonInfo {
  lessonTitle: string
  moduleTitle: string
  moduleOrder: number
  lessonOrder: number
}

export function CourseNotesTab({ courseId, modules }: CourseNotesTabProps) {
  const notes = useNoteStore(s => s.notes)
  const isLoading = useNoteStore(s => s.isLoading)
  const loadNotesByCourse = useNoteStore(s => s.loadNotesByCourse)
  const deleteNote = useNoteStore(s => s.deleteNote)
  const [sortMode, setSortMode] = useState<SortMode>('video-order')

  useEffect(() => {
    loadNotesByCourse(courseId)
  }, [courseId, loadNotesByCourse])

  // Build lookup from videoId → lesson/module info
  const lessonMap = useMemo(() => {
    const map = new Map<string, LessonInfo>()
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

  // Group and sort notes
  const groupedNotes = useMemo(() => {
    if (sortMode === 'date-created') {
      // Flat list sorted by creation date (newest first)
      return [{
        moduleTitle: '',
        lessons: [{
          lessonTitle: '',
          lessonId: '',
          notes: [...notes].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        }],
      }]
    }

    // Group by module → lesson in video order
    const moduleMap = new Map<string, { moduleTitle: string; moduleOrder: number; lessons: Map<string, { lessonTitle: string; lessonOrder: number; notes: Note[] }> }>()

    for (const note of notes) {
      const info = lessonMap.get(note.videoId)
      const moduleTitle = info?.moduleTitle ?? 'Unknown Module'
      const moduleOrder = info?.moduleOrder ?? 999
      const lessonTitle = info?.lessonTitle ?? 'Unknown Lesson'
      const lessonOrder = info?.lessonOrder ?? 999

      if (!moduleMap.has(moduleTitle)) {
        moduleMap.set(moduleTitle, { moduleTitle, moduleOrder, lessons: new Map() })
      }
      const modGroup = moduleMap.get(moduleTitle)!

      if (!modGroup.lessons.has(note.videoId)) {
        modGroup.lessons.set(note.videoId, { lessonTitle, lessonOrder, notes: [] })
      }
      modGroup.lessons.get(note.videoId)!.notes.push(note)
    }

    return Array.from(moduleMap.values())
      .sort((a, b) => a.moduleOrder - b.moduleOrder)
      .map(mod => ({
        moduleTitle: mod.moduleTitle,
        lessons: Array.from(mod.lessons.entries())
          .sort(([, a], [, b]) => a.lessonOrder - b.lessonOrder)
          .map(([lessonId, data]) => ({
            lessonTitle: data.lessonTitle,
            lessonId,
            notes: data.notes,
          })),
      }))
  }, [notes, lessonMap, sortMode])

  const handleDelete = async (noteId: string) => {
    await deleteNote(noteId)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  // Empty state (AC3)
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-[24px] border">
        <FileText className="size-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          No notes yet. Start taking notes while watching videos.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortMode(m => m === 'video-order' ? 'date-created' : 'video-order')}
          aria-label="Sort notes"
        >
          <ArrowUpDown className="size-3.5 mr-1.5" />
          {sortMode === 'video-order' ? 'Video Order' : 'Date Created'}
        </Button>
      </div>

      {/* Grouped notes */}
      <div className="space-y-6">
        {groupedNotes.map((group) => (
          <div key={group.moduleTitle || 'all'}>
            {group.moduleTitle && (
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {group.moduleTitle}
              </h3>
            )}
            <div className="space-y-4">
              {group.lessons.map((lesson) => (
                <div key={lesson.lessonId || 'flat'}>
                  {lesson.lessonTitle && (
                    <h4 className="text-sm font-medium mb-2">{lesson.lessonTitle}</h4>
                  )}
                  <div className="space-y-3">
                    {lesson.notes.map(note => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        lessonTitle={lesson.lessonTitle}
                        courseId={courseId}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
