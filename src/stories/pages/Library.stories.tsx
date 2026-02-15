import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Search, FileText, FolderOpen, ExternalLink, X } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { PageLayout } from './_PageLayout'

const documents = [
  {
    id: '1',
    title: 'Behavioral Analysis Framework',
    type: 'pdf',
    course: 'Ellipsis Manual',
    module: 'Foundations',
    category: 'behavioral-analysis',
  },
  {
    id: '2',
    title: 'Nonverbal Cue Reference Guide',
    type: 'pdf',
    course: 'Ellipsis Manual',
    module: 'Reading Cues',
    category: 'behavioral-analysis',
  },
  {
    id: '3',
    title: 'Deception Detection Checklist',
    type: 'pdf',
    course: 'Ellipsis Manual',
    module: 'Deception',
    category: 'behavioral-analysis',
  },
  {
    id: '4',
    title: 'Influence Principles Overview',
    type: 'pdf',
    course: 'Behavioral Table',
    module: 'Core Principles',
    category: 'influence-authority',
  },
  {
    id: '5',
    title: 'Persuasion Techniques Matrix',
    type: 'pdf',
    course: 'Behavioral Table',
    module: 'Techniques',
    category: 'influence-authority',
  },
  {
    id: '6',
    title: 'Body Language Quick Reference',
    type: 'pdf',
    course: 'Body Language',
    module: 'Essentials',
    category: 'confidence-mastery',
  },
  {
    id: '7',
    title: 'Confidence Building Exercises',
    type: 'pdf',
    course: 'Body Language',
    module: 'Practice',
    category: 'confidence-mastery',
  },
  {
    id: '8',
    title: 'Operative Field Handbook',
    type: 'pdf',
    course: 'Field Guide',
    module: 'Field Ops',
    category: 'operative-training',
  },
  {
    id: '9',
    title: 'Social Engineering Playbook',
    type: 'pdf',
    course: 'Social Eng 101',
    module: 'Tactics',
    category: 'operative-training',
  },
  {
    id: '10',
    title: 'Research Methods Reference',
    type: 'pdf',
    course: 'Research Methods',
    module: 'Methodology',
    category: 'research-library',
  },
  {
    id: '11',
    title: 'Data Collection Templates',
    type: 'pdf',
    course: 'Research Methods',
    module: 'Templates',
    category: 'research-library',
  },
  {
    id: '12',
    title: 'NLP Techniques Handbook',
    type: 'pdf',
    course: 'NLP Mastery',
    module: 'Core NLP',
    category: 'confidence-mastery',
  },
]

const categoryTabs = [
  { value: 'all', label: 'All Documents' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis' },
  { value: 'influence-authority', label: 'Influence & Authority' },
  { value: 'confidence-mastery', label: 'Confidence' },
  { value: 'operative-training', label: 'Operative Training' },
  { value: 'research-library', label: 'Research Library' },
]

function LibraryContent() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedDoc, setSelectedDoc] = useState<(typeof documents)[0] | null>(null)

  const filtered = documents.filter(doc => {
    if (activeTab !== 'all' && doc.category !== activeTab) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.course.toLowerCase().includes(q) ||
        doc.module.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Resource Library</h1>
        <p className="text-muted-foreground">Browse all documents and materials across courses</p>
      </div>

      {/* Search */}
      <Card className="rounded-3xl border-0 shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-muted border-0"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categoryTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-card border border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FolderOpen className="mb-3 h-12 w-12" />
          <p>No documents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doc => (
            <Card
              key={doc.id}
              className="rounded-2xl border-0 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-50 p-2.5 shrink-0">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm mb-1 truncate">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.course} &middot; {doc.module}
                  </p>
                  <Badge variant="secondary" className="mt-2 text-xs uppercase">
                    {doc.type}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* PDF Preview Dialog */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
          <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold">{selectedDoc.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ExternalLink className="h-4 w-4" /> Open
                </Button>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-2 rounded-lg hover:bg-accent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              <div className="text-xs text-muted-foreground mb-4">
                {selectedDoc.course} &middot; {selectedDoc.module}
              </div>
              {/* PDF placeholder */}
              <div className="bg-muted rounded-xl h-96 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">PDF Preview</p>
                  <p className="text-sm mt-1">{selectedDoc.title}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LibraryPage() {
  return (
    <PageLayout activePath="/library">
      <LibraryContent />
    </PageLayout>
  )
}

const meta = {
  title: 'Pages/Library',
  component: LibraryPage,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof LibraryPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyLibrary: Story = {
  render: () => (
    <PageLayout activePath="/library">
      <div>
        <h1 className="text-3xl font-bold mb-6">Resource Library</h1>
        <Card className="rounded-[24px]">
          <div className="p-16 text-center">
            <FolderOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Import a course with PDF documents to see them here.
            </p>
          </div>
        </Card>
      </div>
    </PageLayout>
  ),
}
