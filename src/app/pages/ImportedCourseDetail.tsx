import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import {
  ArrowLeft,
  Video,
  FileText,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  User,
  Trash2,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useFileStatusVerification } from '@/hooks/useFileStatusVerification'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
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
import { cn } from '@/app/components/ui/utils'
import { getAvatarSrc, getInitials } from '@/lib/authors'
import { EditableTitle } from '@/app/components/figma/EditableTitle'
import type { ImportedVideo, ImportedPdf } from '@/data/types'
import type { FileStatus } from '@/lib/fileVerification'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function FileStatusBadge({ status, itemId }: { status: FileStatus; itemId: string }) {
  if (status === 'missing') {
    return (
      <Badge variant="destructive" data-testid={`file-not-found-badge-${itemId}`} role="status">
        <AlertTriangle className="size-3" aria-hidden="true" />
        File not found
      </Badge>
    )
  }
  if (status === 'permission-denied') {
    return (
      <Badge
        className="bg-warning text-warning-foreground"
        data-testid={`file-permission-badge-${itemId}`}
        role="status"
      >
        <ShieldAlert className="size-3" aria-hidden="true" />
        Permission needed
      </Badge>
    )
  }
  return null
}

/** Renders text with matched characters wrapped in <mark> for search highlighting */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRegex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(splitRegex)

  return (
    <>
      {parts.map((part, i) => {
        // Check each part independently (avoids regex.lastIndex statefulness)
        const isMatch = part.length > 0 && part.toLowerCase() === query.toLowerCase()
        return isMatch ? (
          <mark key={i} className="bg-warning/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

/** Minimum number of content items required to show the search input */
const SEARCH_THRESHOLD = 10

export function ImportedCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const removeImportedCourse = useCourseImportStore(state => state.removeImportedCourse)
  const updateCourseDetails = useCourseImportStore(state => state.updateCourseDetails)
  const course = importedCourses.find(c => c.id === courseId)

  const storeAuthors = useAuthorStore(state => state.authors)
  const loadAuthors = useAuthorStore(state => state.loadAuthors)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const contentListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    loadImportedCourses()
    loadAuthors()
  }, [loadImportedCourses, loadAuthors])

  // E1C-S02: Inline title editing — optimistic update to IndexedDB + Zustand store
  const handleTitleSave = useCallback(
    async (newTitle: string) => {
      if (!courseId) return
      const success = await updateCourseDetails(courseId, { name: newTitle })
      if (success) {
        toast.success('Title updated')
      } else {
        toast.error('Failed to update title')
      }
    },
    [courseId, updateCourseDetails]
  )

  async function handleDelete() {
    if (deleting || !courseId) return
    setDeleting(true)
    try {
      await removeImportedCourse(courseId)
      const { importError } = useCourseImportStore.getState()
      if (importError) {
        toast.error('Failed to delete course')
        setDeleting(false)
      } else {
        toast.success('Course deleted')
        navigate('/courses')
      }
    } catch {
      toast.error('Failed to delete course')
      setDeleting(false)
    }
  }

  const authorData = course?.authorId ? storeAuthors.find(a => a.id === course.authorId) : undefined

  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [pdfs, setPdfs] = useState<ImportedPdf[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!courseId) return
    let ignore = false

    Promise.all([
      db.importedVideos.where('courseId').equals(courseId).sortBy('order'),
      db.importedPdfs.where('courseId').equals(courseId).toArray(),
    ])
      .then(([v, p]) => {
        if (!ignore) {
          setVideos(v)
          setPdfs(p)
        }
      })
      .catch(err => {
        // silent-catch-ok — error state handled by setLoadError UI
        console.error('Failed to load course content:', err)
        if (!ignore) setLoadError(true)
      })

    return () => {
      ignore = true
    }
  }, [courseId])

  const fileStatuses = useFileStatusVerification(videos, pdfs)

  const totalItems = videos.length + pdfs.length
  const showSearch = totalItems >= SEARCH_THRESHOLD

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos
    const q = searchQuery.toLowerCase()
    return videos.filter(v => v.filename.toLowerCase().includes(q))
  }, [videos, searchQuery])

  const filteredPdfs = useMemo(() => {
    if (!searchQuery) return pdfs
    const q = searchQuery.toLowerCase()
    return pdfs.filter(p => p.filename.toLowerCase().includes(q))
  }, [pdfs, searchQuery])

  const hasResults = filteredVideos.length > 0 || filteredPdfs.length > 0

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    contentListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>Course not found.</p>
        <Link to="/courses" className="text-sm text-brand hover:underline">
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div data-testid="imported-course-detail" className="max-w-3xl mx-auto px-4 py-8">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Courses
      </Link>

      <div className="flex items-start justify-between gap-4 mb-1">
        <EditableTitle
          value={course.name}
          onSave={handleTitleSave}
          data-testid="course-detail-title"
        />
        <Button
          variant="ghost"
          size="sm"
          data-testid="detail-delete-course-button"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
          Delete
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Imported {new Date(course.importedAt).toLocaleDateString()} &middot; {course.videoCount}{' '}
        {course.videoCount === 1 ? 'video' : 'videos'}, {course.pdfCount}{' '}
        {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
      </p>

      {/* Author Section */}
      <div data-testid="course-author-section" className="flex items-center gap-3 mb-6">
        {authorData ? (
          <Link
            to={`/authors/${authorData.id}`}
            className="flex items-center gap-2.5 rounded-xl bg-card border p-3 pr-5 hover:bg-accent transition-colors group/author"
          >
            <Avatar className="size-9 ring-1 ring-border/50">
              <AvatarImage {...getAvatarSrc(authorData.photoUrl ?? '', 36)} alt="" />
              <AvatarFallback className="text-xs font-semibold bg-brand/10 text-brand">
                {getInitials(authorData.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium group-hover/author:text-brand transition-colors">
                {authorData.name}
              </p>
              {authorData.title && (
                <p className="text-xs text-muted-foreground">{authorData.title}</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3 pr-5">
            <div className="size-9 rounded-full bg-muted flex items-center justify-center">
              <User className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">Unknown Author</p>
          </div>
        )}
      </div>

      {loadError && (
        <div
          data-testid="course-load-error"
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive mb-4"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
          <span>Failed to load course content.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Reload
          </button>
        </div>
      )}

      {/* E1C-S06: Search/filter input — shown only when 10+ content items */}
      {showSearch && (
        <div data-testid="content-search-container" className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            data-testid="content-search-input"
            type="search"
            placeholder="Search videos and PDFs\u2026"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 rounded-xl"
            aria-label="Filter course content by filename"
          />
          {searchQuery && (
            <button
              type="button"
              data-testid="content-search-clear"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      <ul
        ref={contentListRef}
        data-testid="course-content-list"
        aria-label="Course content"
        className="flex flex-col gap-2"
      >
        {filteredVideos.map(video => {
          const status = fileStatuses.get(video.id) ?? 'checking'
          const isUnavailable = status === 'missing' || status === 'permission-denied'

          const content = (
            <>
              <Video
                data-testid="content-type-icon"
                className={cn(
                  'size-5 shrink-0',
                  isUnavailable ? 'text-muted-foreground' : 'text-brand'
                )}
                aria-hidden="true"
              />
              <span
                data-testid={`file-status-${video.id}`}
                data-status={status}
                className={cn(
                  'flex-1 font-medium text-sm',
                  !isUnavailable && 'group-hover:text-brand transition-colors'
                )}
              >
                <HighlightedText text={video.filename} query={searchQuery} />
              </span>
              <FileStatusBadge status={status} itemId={video.id} />
              {video.duration > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(video.duration)}
                </span>
              )}
            </>
          )

          return (
            <li key={video.id} data-testid={`course-content-item-video-${video.id}`}>
              {isUnavailable ? (
                <div
                  className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card opacity-50 cursor-not-allowed"
                  aria-disabled="true"
                >
                  {content}
                </div>
              ) : (
                <Link
                  to={`/imported-courses/${courseId}/lessons/${video.id}`}
                  className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group"
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}

        {filteredPdfs.map(pdf => {
          const status = fileStatuses.get(pdf.id) ?? 'checking'
          const isUnavailable = status === 'missing' || status === 'permission-denied'

          return (
            <li key={pdf.id} data-testid={`course-content-item-pdf-${pdf.id}`}>
              <div
                className={cn(
                  'flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card',
                  isUnavailable ? 'opacity-50 cursor-not-allowed' : 'opacity-75'
                )}
                aria-disabled={isUnavailable ? 'true' : undefined}
              >
                <FileText
                  data-testid="content-type-icon"
                  className={cn(
                    'size-5 shrink-0',
                    isUnavailable ? 'text-muted-foreground' : 'text-warning'
                  )}
                  aria-hidden="true"
                />
                <span
                  data-testid={`file-status-${pdf.id}`}
                  data-status={status}
                  className="flex-1 font-medium text-sm"
                >
                  <HighlightedText text={pdf.filename} query={searchQuery} />
                </span>
                {isUnavailable ? (
                  <FileStatusBadge status={status} itemId={pdf.id} />
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-muted-foreground"
                    data-testid={`pdf-coming-soon-${pdf.id}`}
                  >
                    PDF viewer coming soon
                  </Badge>
                )}
                {pdf.pageCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {pdf.pageCount} {pdf.pageCount === 1 ? 'page' : 'pages'}
                  </span>
                )}
              </div>
            </li>
          )
        })}

        {/* Empty state: no matches from search filter */}
        {searchQuery && !hasResults && (
          <li
            data-testid="content-search-empty"
            className="flex flex-col items-center gap-3 text-sm text-muted-foreground text-center py-12"
          >
            <Search className="size-8 text-muted-foreground/50" aria-hidden="true" />
            <p>No videos or PDFs match your search</p>
            <Button
              variant="outline"
              size="sm"
              data-testid="content-search-clear-empty"
              onClick={handleClearSearch}
            >
              Clear search
            </Button>
          </li>
        )}

        {/* Empty state: course has no content at all */}
        {!searchQuery && videos.length === 0 && pdfs.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-8">
            No content found in this course.
          </li>
        )}
      </ul>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{course.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the course and all its content from your library. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm-button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting\u2026' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
