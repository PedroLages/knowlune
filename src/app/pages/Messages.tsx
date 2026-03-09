import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, Search, Trash2, BookOpen, StickyNote } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Textarea } from '@/app/components/ui/textarea'
import {
  getJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  searchJournalEntries,
  type JournalEntry,
} from '@/lib/journal'
import { getAllProgress } from '@/lib/progress'
import { allCourses } from '@/data/courses'

function getAllLessonNotes(): {
  courseId: string
  courseName: string
  lessonId: string
  lessonName: string
  note: string
}[] {
  const progress = getAllProgress()
  const notes: {
    courseId: string
    courseName: string
    lessonId: string
    lessonName: string
    note: string
  }[] = []

  for (const [courseId, courseProgress] of Object.entries(progress)) {
    const course = allCourses.find(c => c.id === courseId)
    if (!course) continue
    for (const [lessonId, noteArray] of Object.entries(courseProgress.notes)) {
      // Get the latest note from the array
      if (!noteArray || noteArray.length === 0) continue
      const latestNote = noteArray[noteArray.length - 1]
      if (!latestNote.content.trim()) continue
      const lesson = course.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)
      notes.push({
        courseId,
        courseName: course.title,
        lessonId,
        lessonName: lesson?.title ?? lessonId,
        note: latestNote.content,
      })
    }
  }
  return notes
}

export default function Messages() {
  const [entries, setEntries] = useState<JournalEntry[]>(getJournalEntries())
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('journal')

  const selected = entries.find(e => e.id === selectedId)
  const filtered = searchQuery ? searchJournalEntries(searchQuery) : entries

  function handleNew() {
    const entry = createJournalEntry({
      title: 'Untitled',
      content: '',
      tags: [],
    })
    setEntries(getJournalEntries())
    setSelectedId(entry.id)
  }

  function handleUpdate(id: string, updates: Partial<Omit<JournalEntry, 'id'>>) {
    updateJournalEntry(id, updates)
    setEntries(getJournalEntries())
  }

  function handleDelete(id: string) {
    deleteJournalEntry(id)
    const updated = getJournalEntries()
    setEntries(updated)
    setSelectedId(updated[0]?.id ?? null)
  }

  const allNotes = getAllLessonNotes()

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6">Study Journal</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="journal" className="gap-2">
            <BookOpen className="w-4 h-4" /> Journal
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="w-4 h-4" /> Lesson Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="flex-1 flex gap-4 mt-0">
          {/* Left panel */}
          <Card className="w-80 flex flex-col">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entries..."
                    aria-label="Search journal entries"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button size="icon" onClick={handleNew} aria-label="Create new journal entry">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No entries yet. Click + to create one.
                  </p>
                ) : (
                  filtered.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedId === entry.id ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{entry.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right panel - Editor */}
          <Card className="flex-1">
            <CardContent className="p-6 h-full flex flex-col">
              {selected ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <Input
                      value={selected.title}
                      onChange={e => handleUpdate(selected.id, { title: e.target.value })}
                      aria-label="Entry title"
                      className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                      placeholder="Entry title..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(selected.id)}
                      aria-label="Delete journal entry"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={selected.content}
                    onChange={e => handleUpdate(selected.id, { content: e.target.value })}
                    aria-label="Entry content"
                    placeholder="Write your thoughts..."
                    className="flex-1 resize-none border-0 p-0 focus-visible:ring-0"
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    Last updated: {new Date(selected.timestamp).toLocaleString()}
                  </p>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <p>Select an entry or create a new one</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="flex-1 mt-0">
          <Card>
            <CardContent className="p-6">
              {allNotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No lesson notes yet. Add notes while studying lessons.
                </p>
              ) : (
                <div className="space-y-4">
                  {allNotes.map((note, i) => (
                    <div key={i} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/courses/${note.courseId}/${note.lessonId}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          {note.lessonName}
                        </Link>
                        <span className="text-xs text-muted-foreground">in {note.courseName}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
