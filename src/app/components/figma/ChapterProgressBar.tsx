import type { Chapter } from '@/data/types'
import { formatTimestamp as formatTime } from '@/lib/format'

interface ChapterProgressBarProps {
  progress: number // 0–100
  duration: number // seconds
  chapters?: Chapter[]
  bookmarks?: { id: string; timestamp: number; label: string }[]
  onSeek: (percent: number) => void
  onBookmarkSeek?: (time: number) => void
  loopStart?: number | null
  loopEnd?: number | null
}

export function ChapterProgressBar({
  progress,
  duration,
  chapters,
  bookmarks,
  onSeek,
  onBookmarkSeek,
  loopStart,
  loopEnd,
}: ChapterProgressBarProps) {
  const handleChapterClick = (e: React.MouseEvent, time: number) => {
    e.stopPropagation()
    if (duration > 0) {
      onSeek((time / duration) * 100)
    }
  }

  return (
    <div className="relative flex-1 py-3 -my-3 group/progress">
      {/* Visual track — pointer-events-none so range input below handles seeking */}
      <div className="relative w-full h-1 group-hover/progress:h-3 transition-[height] duration-150 bg-white/30 rounded-full pointer-events-none">
        {/* Fill bar */}
        <div
          className="absolute inset-y-0 left-0 bg-white rounded-full"
          style={{ width: `${progress}%` }}
        />

        {/* AB-loop region: shaded band between A and B markers */}
        {loopStart != null && loopEnd != null && duration > 0 && (
          <div
            data-testid="loop-region"
            className="absolute inset-y-0 bg-brand/30 rounded-sm"
            style={{
              left: `${(loopStart / duration) * 100}%`,
              width: `${((loopEnd - loopStart) / duration) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}

        {/* A marker */}
        {loopStart != null && duration > 0 && (
          <div
            data-testid="loop-start-marker"
            className="absolute inset-y-0 w-0.5 bg-brand -translate-x-1/2"
            style={{ left: `${(loopStart / duration) * 100}%` }}
            aria-hidden="true"
          />
        )}

        {/* B marker */}
        {loopEnd != null && duration > 0 && (
          <div
            data-testid="loop-end-marker"
            className="absolute inset-y-0 w-0.5 bg-brand -translate-x-1/2"
            style={{ left: `${(loopEnd / duration) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Chapter markers — above range input (z-20) for hover tooltips */}
      {chapters &&
        duration > 0 &&
        chapters.map((chapter, idx) => {
          const pct = (chapter.time / duration) * 100
          if (pct <= 0 || pct >= 100) return null
          return (
            <button
              key={idx}
              data-testid="chapter-marker"
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center z-20 cursor-pointer"
              style={{ left: `${pct}%` }}
              onClick={e => handleChapterClick(e, chapter.time)}
              aria-label={`Go to chapter: ${chapter.title} at ${formatTime(chapter.time)}`}
            >
              <span className="w-0.5 h-3 bg-white/80" />
            </button>
          )
        })}

      {/* Bookmark markers — above range input (z-20) */}
      {bookmarks &&
        duration > 0 &&
        bookmarks.map(bm => (
          <button
            key={bm.id}
            data-testid="bookmark-marker"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center z-20 cursor-pointer group/marker"
            style={{ left: `${(bm.timestamp / duration) * 100}%` }}
            onClick={e => {
              e.stopPropagation()
              onBookmarkSeek?.(bm.timestamp)
            }}
            aria-label={`Bookmark at ${formatTime(bm.timestamp)}`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400 border border-yellow-600 group-hover/marker:scale-150 transition-transform" />
          </button>
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
        onChange={e => onSeek(parseFloat(e.target.value))}
      />
    </div>
  )
}
