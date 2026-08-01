import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, ImageOff, Plus } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

export type CourseThumbnailFit = 'cover' | 'contain'

export interface CourseThumbnailCandidate {
  url: string
  fit?: CourseThumbnailFit
}

interface CourseThumbnailMediaProps {
  candidates: readonly CourseThumbnailCandidate[]
  alt?: string
  fallbackLabel?: string
  loading?: boolean
  onAddCover?: () => void
  className?: string
  imageClassName?: string
  'data-testid'?: string
}

/**
 * Shared course-cover surface used by every course card density.
 *
 * The placeholder stays mounted until an image has loaded successfully. This
 * prevents a broken remote URL from exposing the browser's broken-image icon
 * and gives callers a single recovery affordance for missing artwork.
 */
export function CourseThumbnailMedia({
  candidates,
  alt = '',
  fallbackLabel = 'No cover available',
  loading = false,
  onAddCover,
  className,
  imageClassName,
  'data-testid': testId,
}: CourseThumbnailMediaProps) {
  const candidateKey = useMemo(
    () => candidates.map(candidate => candidate.url).join('|'),
    [candidates]
  )
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set())
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)

  useEffect(() => {
    setFailedUrls(new Set())
    setLoadedUrl(null)
  }, [candidateKey])

  const activeCandidate = candidates.find(candidate => !failedUrls.has(candidate.url))
  const isReady = activeCandidate != null && loadedUrl === activeCandidate.url
  const hasFallback = !loading && !activeCandidate

  function handleImageError(url: string) {
    setFailedUrls(previous => {
      const next = new Set(previous)
      next.add(url)
      return next
    })
    setLoadedUrl(null)
  }

  return (
    <div
      data-testid={testId}
      className={cn('relative h-full w-full overflow-hidden bg-muted', className)}
      aria-label={hasFallback ? fallbackLabel : undefined}
    >
      <div
        data-testid="course-thumbnail-placeholder"
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground/60',
          isReady || loading ? 'opacity-0' : 'opacity-100',
          'transition-opacity duration-200 motion-reduce:transition-none'
        )}
        aria-hidden="true"
      >
        {hasFallback ? <ImageOff className="size-8" /> : <FolderOpen className="size-8" />}
        {hasFallback && (
          <span className="text-xs font-medium text-muted-foreground">{fallbackLabel}</span>
        )}
      </div>

      {loading && (
        <div
          data-testid="course-thumbnail-loading"
          className="absolute inset-0 animate-pulse bg-muted/80 motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}

      {activeCandidate && (
        <img
          key={activeCandidate.url}
          src={activeCandidate.url}
          alt={alt}
          aria-hidden={alt ? undefined : true}
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoadedUrl(activeCandidate.url)}
          onError={() => handleImageError(activeCandidate.url)}
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-300 motion-reduce:transition-none',
            activeCandidate.fit === 'contain' ? 'object-contain' : 'object-cover',
            isReady ? 'opacity-100' : 'opacity-0',
            imageClassName
          )}
        />
      )}

      {hasFallback && onAddCover && (
        <button
          type="button"
          data-testid="course-thumbnail-add-cover"
          aria-label="Add a course cover"
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            onAddCover()
          }}
          className={cn(
            'absolute bottom-3 left-1/2 z-20 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full',
            'bg-background/90 px-3 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm',
            'transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add cover
        </button>
      )}
    </div>
  )
}
