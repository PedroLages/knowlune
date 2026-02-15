import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Plus, Search, Trash2, BookOpen, StickyNote } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { PageLayout } from './_PageLayout'

const journalEntries = [
  {
    id: '1',
    title: 'Behavioral Analysis Reflections',
    content:
      'Today I learned about baseline behavior — the idea that you must first understand someone\'s normal patterns before you can detect deviations. Key takeaway: spend at least 5 minutes observing before drawing conclusions.\n\nThe concept of "comfort vs. discomfort" signals is fascinating. Need to practice more with the exercises.',
    timestamp: '2026-02-15T14:30:00Z',
  },
  {
    id: '2',
    title: 'Notes on Deception Detection',
    content:
      'Verbal indicators to watch for:\n- Qualifying language ("to be honest", "frankly")\n- Distancing language (avoiding "I")\n- Tense switching\n- Excessive detail in irrelevant areas\n\nNeed to review the Statement Analysis module again.',
    timestamp: '2026-02-14T10:15:00Z',
  },
  {
    id: '3',
    title: 'Influence Techniques Summary',
    content:
      'Six principles of influence (Cialdini):\n1. Reciprocity\n2. Commitment & Consistency\n3. Social Proof\n4. Authority\n5. Liking\n6. Scarcity\n\nThe course adds a 7th: Behavioral Alignment. This is unique to the Hughes methodology.',
    timestamp: '2026-02-12T16:45:00Z',
  },
  {
    id: '4',
    title: 'Body Language Practice Log',
    content:
      'Practiced baseline observation at the coffee shop for 30 minutes. Noticed:\n- Most people exhibit self-soothing behaviors when waiting\n- Phone checking as a comfort behavior\n- Posture shifts when approached by strangers',
    timestamp: '2026-02-10T09:00:00Z',
  },
  {
    id: '5',
    title: 'Study Plan for Next Week',
    content:
      'Goals:\n- Complete Module 3 of Ellipsis Manual\n- Start Operative Field Guide Module 1\n- Review all notes from Body Language course\n- Practice nonverbal observation 3x this week',
    timestamp: '2026-02-08T20:00:00Z',
  },
]

const lessonNotes = [
  {
    courseId: 'c1',
    courseName: 'The Ellipsis Manual',
    lessonId: 'l1',
    lessonName: 'Baseline Behavior',
    note: 'Baseline = normal behavioral patterns. Must observe for 5+ minutes before conclusions. Look for pacifiers, adaptors, and regulators.',
  },
  {
    courseId: 'c1',
    courseName: 'The Ellipsis Manual',
    lessonId: 'l2',
    lessonName: 'Observational Techniques',
    note: 'SCAN method: Systematic observation, Context awareness, Anomaly detection, Note-taking. Practice with video recordings first.',
  },
  {
    courseId: 'c2',
    courseName: 'Body Language Mastery',
    lessonId: 'l3',
    lessonName: 'Facial Expressions',
    note: "Ekman's 7 universal emotions: happiness, sadness, anger, fear, surprise, contempt, disgust. Micro-expressions last 1/25th of a second.",
  },
  {
    courseId: 'c2',
    courseName: 'Body Language Mastery',
    lessonId: 'l4',
    lessonName: 'Hand Gestures',
    note: 'Palm-up gestures = openness. Palm-down = authority. Steepling = confidence. Self-touching = anxiety or discomfort.',
  },
  {
    courseId: 'c3',
    courseName: 'NLP Mastery Program',
    lessonId: 'l5',
    lessonName: 'Rapport Building',
    note: "Mirror and match: posture, breathing rate, speaking pace. Don't mimic — subtly align over 2-3 minutes.",
  },
]

function StudyJournalContent() {
  const [selectedId, setSelectedId] = useState(journalEntries[0].id)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'journal' | 'notes'>('journal')

  const selected = journalEntries.find(e => e.id === selectedId)
  const filtered = search
    ? journalEntries.filter(
        e =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.content.toLowerCase().includes(search.toLowerCase())
      )
    : journalEntries

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6">Study Journal</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'journal'
              ? 'bg-blue-600 text-white'
              : 'bg-card border border-border text-muted-foreground hover:bg-accent'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Journal
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'bg-blue-600 text-white'
              : 'bg-card border border-border text-muted-foreground hover:bg-accent'
          }`}
        >
          <StickyNote className="w-4 h-4" /> Lesson Notes
        </button>
      </div>

      {activeTab === 'journal' ? (
        <div className="flex gap-4 flex-1">
          {/* Left panel — Entry list */}
          <Card className="w-80 flex flex-col shrink-0">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entries..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button size="icon" aria-label="Create new journal entry">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto space-y-2">
                {filtered.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedId === entry.id ? 'bg-accent' : 'hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium text-sm truncate">{entry.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right panel — Editor */}
          <Card className="flex-1">
            <CardContent className="p-6 h-full flex flex-col">
              {selected ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">{selected.title}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1 bg-background border border-border rounded-lg p-4 text-sm whitespace-pre-wrap overflow-auto">
                    {selected.content}
                  </div>
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
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            {lessonNotes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No lesson notes yet. Add notes while studying lessons.
              </p>
            ) : (
              <div className="space-y-4">
                {lessonNotes.map((note, i) => (
                  <div key={i} className="border-b border-border pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-blue-600 hover:underline cursor-pointer">
                        {note.lessonName}
                      </span>
                      <span className="text-xs text-muted-foreground">in {note.courseName}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StudyJournalPage() {
  return (
    <PageLayout activePath="/messages">
      <StudyJournalContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Study Journal',
  component: StudyJournalPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof StudyJournalPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyJournal: Story = {
  render: () => (
    <PageLayout activePath="/messages">
      <div className="h-full flex flex-col">
        <h1 className="text-2xl font-bold mb-6">Study Journal</h1>
        <Card className="rounded-[24px]">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No journal entries yet</h3>
            <p className="text-muted-foreground mb-6">
              Start writing to capture your learning journey.
            </p>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-medium mx-auto transition-colors">
              <Plus className="w-4 h-4" /> Create First Entry
            </button>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  ),
}
