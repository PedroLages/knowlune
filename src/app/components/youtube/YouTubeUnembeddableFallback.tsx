/**
 * YouTubeUnembeddableFallback — reason-aware placeholder shown when a YouTube
 * video cannot be embedded (owner disabled embedding, private, deleted,
 * region-restricted, or generic runtime load failure).
 *
 * Rendered in place of the iframe by:
 *   - `YouTubeVideoContent` when `ImportedVideo.embeddable === false` (pre-flight)
 *   - `YouTubePlayer` when the 10s load timeout fires (runtime safety net)
 *
 * @see docs/plans/2026-04-24-004-fix-youtube-embed-blocked-fallback-plan.md
 */

import type { UnembeddableReason } from '@/data/types'

export interface YouTubeUnembeddableFallbackProps {
  /** YouTube video ID — used to build the "Watch on YouTube" link */
  videoId: string
  /** Reason the video can't be embedded; omit/undefined → generic copy */
  reason?: UnembeddableReason
}

interface FallbackCopy {
  title: string
  body: string
}

/**
 * Maps a non-embeddable reason to user-facing copy.
 * Exported for unit testing.
 */
export function getUnembeddableCopy(reason: UnembeddableReason | undefined): FallbackCopy {
  switch (reason) {
    case 'embedding-disabled':
      return {
        title: "Can't play here",
        body: 'The video owner has disabled embedding on other sites.',
      }
    case 'private':
      return {
        title: 'Video is private',
        body: "This video is private and can't be played here.",
      }
    case 'deleted':
      return {
        title: 'Video unavailable',
        body: 'This video is no longer available on YouTube.',
      }
    case 'deleted-or-private':
      return {
        title: 'Video unavailable',
        body: 'This video is no longer available on YouTube or has been made private.',
      }
    case 'region-restricted':
      return {
        title: 'May not be available in your region',
        body: 'The video owner has restricted this video in some regions.',
      }
    case 'unknown':
    case undefined:
    default:
      return {
        title: "Video couldn't load",
        body: 'The YouTube player failed to initialize. This may be caused by a browser extension or network setting.',
      }
  }
}

export function YouTubeUnembeddableFallback({ videoId, reason }: YouTubeUnembeddableFallbackProps) {
  const { title, body } = getUnembeddableCopy(reason)
  return (
    <div
      className="aspect-video w-full flex flex-col items-center justify-center bg-muted rounded-xl gap-3 text-muted-foreground"
      data-testid="youtube-player-fallback"
    >
      <svg
        className="size-10 opacity-40"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-center max-w-xs px-4">{body}</p>
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-brand hover:underline"
      >
        Watch on YouTube ↗
      </a>
    </div>
  )
}
