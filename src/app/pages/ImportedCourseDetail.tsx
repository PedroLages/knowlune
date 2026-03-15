import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Video, FileText, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react'
import { db } from '@/db/schema'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useFileStatusVerification } from '@/hooks/useFileStatusVerification'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
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

export function ImportedCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

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
        console.error('Failed to load course content:', err)
        if (!ignore) setLoadError(true)
      })

    return () => {
      ignore = true
    }
  }, [courseId])

  const fileStatuses = useFileStatusVerification(videos, pdfs)

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

      <h1 data-testid="course-detail-title" className="text-2xl font-bold mb-1">
        {course.name}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Imported {new Date(course.importedAt).toLocaleDateString()} &middot; {course.videoCount}{' '}
        {course.videoCount === 1 ? 'video' : 'videos'}, {course.pdfCount}{' '}
        {course.pdfCount === 1 ? 'PDF' : 'PDFs'}
      </p>

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

      <ul
        data-testid="course-content-list"
        aria-label="Course content"
        className="flex flex-col gap-2"
      >
        {videos.map(video => {
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
                {video.filename}
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

        {pdfs.map(pdf => {
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
                  {pdf.filename}
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

        {videos.length === 0 && pdfs.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-8">
            No content found in this course.
          </li>
        )}
      </ul>
    </div>
  )
}
