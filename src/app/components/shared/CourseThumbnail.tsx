import { BookOpen } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface CourseThumbnailProps {
  url?: string
  alt?: string
  courseName?: string
  className?: string
}

/**
 * Standard 48px course thumbnail square with lazy-loaded image
 * and BookOpen fallback icon when no URL is available.
 */
export function CourseThumbnail({ url, alt, courseName, className }: CourseThumbnailProps) {
  const altText = alt ?? (courseName ? `${courseName} thumbnail` : 'Course thumbnail')
  return (
    <div className={cn('size-12 shrink-0 rounded-lg bg-muted overflow-hidden', className)}>
      {url ? (
        <img src={url} alt={altText} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="size-full flex items-center justify-center">
          <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
