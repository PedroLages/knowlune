import { useCallback } from 'react'
import type { Chapter } from '@/data/types'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface ChapterProgressBarProps {
  progress: number    // 0–100
  duration: number    // seconds
  chapters?: Chapter[]
  bookmarks?: { id: string; timestamp: number; label: string }[]
  onSeek: (percent: number) => void
  onBookmarkSeek?: (time: number) => void
}

export function ChapterProgressBar({
  progress,
  duration,
  chapters,
  bookmarks,
  onSeek,
  onBookmarkSeek,
}: ChapterProgressBarProps) {
  const handleChapterClick = useCallback(
    (e: React.MouseEvent, time: number) => {
      e.stopPropagation()
      if (duration > 0) {
        onSeek((time / duration) * 100)
      }
    },
    [duration, onSeek],
  )

  return (
    <div className="relative flex-1 py-3 -my-3 group/progress">
      {/* Visual track — pointer-events-none so range input below handles seeking */}
      <div className="relative w-full h-1 group-hover/progress:h-1.5 transition-[height] duration-150 bg-white/30 rounded-full pointer-events-none">
        {/* Fill bar */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Chapter markers — above range input (z-20) for hover tooltips */}
      {chapters && duration > 0 &&
        chapters.map((chapter, idx) => {
          const pct = (chapter.time / duration) * 100
          if (pct <= 0 || pct >= 100) return null
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <button
                  data-testid="chapter-marker"
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center z-20 cursor-pointer"
                  style={{ left: `${pct}%` }}
                  onClick={(e) => handleChapterClick(e, chapter.time)}
                  aria-label={`Go to chapter: ${chapter.title} at ${formatTime(chapter.time)}`}
                >
                  <span className="w-0.5 h-3 bg-white/80" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {formatTime(chapter.time)} — {chapter.title}
              </TooltipContent>
            </Tooltip>
          )
        })}

      {/* Bookmark markers — above range input (z-20) */}
      {bookmarks &&
        duration > 0 &&
        bookmarks.map((bm) => (
          <Tooltip key={bm.id}>
            <TooltipTrigger asChild>
              <button
                data-testid="bookmark-marker"
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center z-20 cursor-pointer group/marker"
                style={{ left: `${(bm.timestamp / duration) * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmarkSeek?.(bm.timestamp)
                }}
                aria-label={`Bookmark at ${formatTime(bm.timestamp)}`}
              >
                <span className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-600 group-hover/marker:scale-150 transition-transform" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{formatTime(bm.timestamp)}</TooltipContent>
          </Tooltip>
        ))}

      {/* Hidden range input — z-10, covers full hit area for keyboard a11y and click-to-seek */}
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        aria-label="Video progress"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => onSeek(parseFloat(e.target.value))}
      />
    </div>
  )
}
