import { useState, useMemo } from 'react'
import { Search, FileText, ExternalLink, FolderOpen } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { PdfViewer } from '@/app/components/figma/PdfViewer'
import { allCourses } from '@/data/courses'
import { getResourceUrl } from '@/lib/media'
import type { Resource } from '@/data/types'

interface LibraryItem {
  resource: Resource
  courseName: string
  moduleName: string
  lessonName: string
  category: string
}

function collectLibraryItems(): LibraryItem[] {
  const items: LibraryItem[] = []

  for (const course of allCourses) {
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        for (const resource of lesson.resources) {
          if (resource.type === 'pdf' || resource.type === 'markdown') {
            items.push({
              resource,
              courseName: course.shortTitle,
              moduleName: module.title,
              lessonName: lesson.title,
              category: course.category,
            })
          }
        }
      }
    }
  }

  return items
}

const categoryTabs = [
  { value: 'all', label: 'All Documents' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis' },
  { value: 'influence-authority', label: 'Influence & Authority' },
  { value: 'confidence-mastery', label: 'Confidence' },
  { value: 'operative-training', label: 'Operative Training' },
  { value: 'research-library', label: 'Research Library' },
]

export function Library() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)

  const allItems = useMemo(() => collectLibraryItems(), [])

  const filtered = useMemo(() => {
    let items = allItems
    if (activeTab !== 'all') {
      items = items.filter(item => item.category === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        item =>
          item.resource.title.toLowerCase().includes(q) ||
          item.courseName.toLowerCase().includes(q) ||
          item.moduleName.toLowerCase().includes(q) ||
          item.lessonName.toLowerCase().includes(q)
      )
    }
    return items
  }, [allItems, activeTab, searchQuery])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Resource Library</h1>
        <p className="text-muted-foreground">Browse all documents and materials across courses</p>
      </div>

      {/* Search */}
      <Card className="bg-card rounded-3xl border-0 shadow-sm p-6 mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents..."
              aria-label="Search documents"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-0"
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="flex-wrap">
          {categoryTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categoryTabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FolderOpen className="mb-3 h-12 w-12" />
                <p>No documents found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => (
                  <Card
                    key={item.resource.id}
                    className="bg-card rounded-2xl border-0 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-red-50 dark:bg-red-900/30 p-2.5 shrink-0">
                        <FileText className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm mb-1 truncate">{item.resource.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.courseName} &middot; {item.moduleName}
                        </p>
                        <Badge variant="secondary" className="mt-2 text-xs uppercase">
                          {item.resource.type}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* PDF Viewer Dialog */}
      <Dialog open={selectedItem !== null} onOpenChange={open => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-500" />
              {selectedItem?.resource.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedItem && (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedItem.courseName} &middot; {selectedItem.moduleName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getResourceUrl(selectedItem.resource), '_blank')}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Open
                  </Button>
                </div>
                <PdfViewer
                  src={getResourceUrl(selectedItem.resource)}
                  title={selectedItem.resource.title}
                  compact
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
