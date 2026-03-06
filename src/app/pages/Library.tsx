import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  Search,
  FileText,
  ExternalLink,
  FolderOpen,
  Trash2,
  BookmarkIcon,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { PdfViewer } from '@/app/components/figma/PdfViewer'
import { allCourses } from '@/data/courses'
import { getResourceUrl } from '@/lib/media'
import { getAllBookmarks, deleteBookmark, formatBookmarkTimestamp } from '@/lib/bookmarks'
import type { Resource, VideoBookmark } from '@/data/types'

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

function findCourseAndLesson(
  courseId: string,
  lessonId: string
): { courseTitle: string; lessonTitle: string } {
  const course = allCourses.find(c => c.id === courseId)
  if (!course) return { courseTitle: courseId, lessonTitle: lessonId }
  const lesson = course.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)
  return { courseTitle: course.shortTitle, lessonTitle: lesson?.title || lessonId }
}

const categoryTabs = [
  { value: 'all', label: 'All Documents' },
  { value: 'behavioral-analysis', label: 'Behavioral Analysis' },
  { value: 'influence-authority', label: 'Influence & Authority' },
  { value: 'confidence-mastery', label: 'Confidence' },
  { value: 'operative-training', label: 'Operative Training' },
  { value: 'research-library', label: 'Research Library' },
]

function BookmarksSection() {
  const navigate = useNavigate()
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VideoBookmark | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    getAllBookmarks()
      .then(bm => {
        setBookmarks(bm)
        setIsLoading(false)
      })
      .catch(() => {
        setError('Failed to load bookmarks')
        setIsLoading(false)
      })
  }, [])

  const handleDelete = async (bookmark: VideoBookmark) => {
    try {
      await deleteBookmark(bookmark.id)
      setBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
    } catch {
      toast.error('Failed to delete bookmark')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleBookmarkClick = (bookmark: VideoBookmark) => {
    navigate(`/courses/${bookmark.courseId}/${bookmark.lessonId}?t=${bookmark.timestamp}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading bookmarks...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-destructive">
        <AlertTriangle className="mb-3 size-12 opacity-60" />
        <p>{error}</p>
        <p className="text-xs mt-1 text-muted-foreground">Try refreshing the page</p>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Clock className="mb-3 size-12 opacity-40" />
        <p>No bookmarks yet</p>
        <p className="text-xs mt-1">Bookmark important moments in videos to find them later</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {bookmarks.map(bookmark => {
          const { courseTitle, lessonTitle } = findCourseAndLesson(
            bookmark.courseId,
            bookmark.lessonId
          )
          return (
            <div
              key={bookmark.id}
              data-testid="bookmark-entry"
              className="group flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <button
                type="button"
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
                onClick={() => handleBookmarkClick(bookmark)}
              >
                <div className="shrink-0 w-14 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <span className="text-xs font-mono font-semibold text-warning">
                    {formatBookmarkTimestamp(bookmark.timestamp)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lessonTitle}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {courseTitle} &middot;{' '}
                    {new Date(bookmark.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                onClick={e => {
                  e.stopPropagation()
                  deleteTriggerRef.current = e.currentTarget as HTMLButtonElement
                  setDeleteTarget(bookmark)
                }}
                aria-label="Delete bookmark"
              >
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          )
        })}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null)
            deleteTriggerRef.current?.focus()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the bookmark at{' '}
              {deleteTarget && formatBookmarkTimestamp(deleteTarget.timestamp)}. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function Library() {
  const [libraryTab, setLibraryTab] = useState('documents')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryTab, setCategoryTab] = useState('all')
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null)

  const allItems = collectLibraryItems()

  const filtered = (() => {
    let items = allItems
    if (categoryTab !== 'all') {
      items = items.filter(item => item.category === categoryTab)
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
  })()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Resource Library</h1>
        <p className="text-muted-foreground">
          Browse documents, materials, and bookmarks across courses
        </p>
      </div>

      {/* Top-level tabs: Documents / Bookmarks */}
      <Tabs value={libraryTab} onValueChange={setLibraryTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="documents">
            <FileText className="size-4 mr-1.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="bookmarks">
            <BookmarkIcon className="size-4 mr-1.5" />
            Bookmarks
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          {/* Search */}
          <Card className="bg-card rounded-3xl border-0 shadow-sm p-6 mb-6">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
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
          <Tabs value={categoryTab} onValueChange={setCategoryTab} className="mb-6">
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
                    <FolderOpen className="mb-3 size-12" />
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
                            <FileText className="size-5 text-red-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm mb-1 truncate">
                              {item.resource.title}
                            </h3>
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
        </TabsContent>

        {/* Bookmarks Tab */}
        <TabsContent value="bookmarks" className="mt-6">
          <BookmarksSection />
        </TabsContent>
      </Tabs>

      {/* PDF Viewer Dialog */}
      <Dialog open={selectedItem !== null} onOpenChange={open => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-red-500" />
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
                    <ExternalLink className="mr-1 size-4" />
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
