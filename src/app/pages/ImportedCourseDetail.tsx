import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Video, FileText } from 'lucide-react'
import { db } from '@/db/schema'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import type { ImportedVideo, ImportedPdf } from '@/data/types'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function ImportedCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  const [videos, setVideos] = useState<ImportedVideo[]>([])
  const [pdfs, setPdfs] = useState<ImportedPdf[]>([])

  useEffect(() => {
    if (!courseId) return
    db.importedVideos.where('courseId').equals(courseId).sortBy('order').then(setVideos)
    db.importedPdfs.where('courseId').equals(courseId).toArray().then(setPdfs)
  }, [courseId])

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>Course not found.</p>
        <Link to="/courses" className="text-sm text-blue-600 hover:underline">
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

      <ul data-testid="course-content-list" className="flex flex-col gap-2">
        {videos.map(video => (
          <li key={video.id} data-testid="course-content-item-video">
            <Link
              to={`/imported-courses/${courseId}/lessons/${video.id}`}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-colors group"
            >
              <Video
                data-testid="content-type-icon"
                className="size-5 text-blue-600 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1 font-medium text-sm group-hover:text-blue-600 transition-colors">
                {video.filename}
              </span>
              {video.duration > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(video.duration)}
                </span>
              )}
            </Link>
          </li>
        ))}

        {pdfs.map(pdf => (
          <li key={pdf.id} data-testid="course-content-item-pdf">
            <div className="flex items-center gap-3 p-4 rounded-xl border bg-card opacity-75 cursor-not-allowed">
              <FileText
                data-testid="content-type-icon"
                className="size-5 text-orange-500 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1 font-medium text-sm">{pdf.filename}</span>
              {pdf.pageCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {pdf.pageCount} {pdf.pageCount === 1 ? 'page' : 'pages'}
                </span>
              )}
            </div>
          </li>
        ))}

        {videos.length === 0 && pdfs.length === 0 && (
          <li className="text-sm text-muted-foreground text-center py-8">
            No content found in this course.
          </li>
        )}
      </ul>
    </div>
  )
}
