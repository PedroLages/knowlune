/**
 * ChapterList — scrollable list of audiobook chapters with status icons.
 *
 * - Completed chapters (index < currentChapterIndex): Check icon in text-success
 * - Current chapter (index === currentChapterIndex): Play icon in text-brand, font-medium
 * - Upcoming chapters: default text-foreground
 *
 * Tapping a chapter loads that chapter via onChapterSelect().
 *
 * @module ChapterList
 * @since E87-S04
 */
import { Check, Play } from 'lucide-react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { BookChapter } from '@/data/types'

interface ChapterListProps {
  chapters: BookChapter[]
  currentChapterIndex: number
  totalDuration?: number // seconds — used to compute last chapter duration
  onChapterSelect: (index: number) => void
}

/** Derive chapter duration from cumulative start times */
function getChapterDuration(
  chapters: BookChapter[],
  index: number,
  totalDuration?: number
): number | null {
  const pos = chapters[index]?.position
  const start = pos?.type === 'time' ? pos.seconds : null
  if (start === null) return null
  const nextPos = index + 1 < chapters.length ? chapters[index + 1]?.position : null
  const nextStart =
    nextPos?.type === 'time'
      ? nextPos.seconds
      : (totalDuration ?? null)
  if (nextStart === null) return null
  return nextStart - start
}

export function ChapterList({
  chapters,
  currentChapterIndex,
  totalDuration,
  onChapterSelect,
}: ChapterListProps) {
  if (chapters.length <= 1) return null

  return (
    <div className="w-full border-t border-border/50 pt-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
        Chapters
      </h2>
      <ScrollArea className="max-h-56 w-full">
        <ul role="list">
          {chapters.map((chapter, index) => {
            const isCompleted = index < currentChapterIndex
            const isCurrent = index === currentChapterIndex
            const duration = getChapterDuration(chapters, index, totalDuration)

            return (
              <li key={chapter.id} className="border-b border-border/50 last:border-b-0">
                <button
                  onClick={() => onChapterSelect(index)}
                  className={`flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/40 ${isCurrent ? 'text-brand font-medium' : 'text-foreground'}`}
                  aria-label={`${chapter.title ?? `Chapter ${index + 1}`}${isCurrent ? ' — now playing' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  {/* Status icon */}
                  <span className="flex-shrink-0 w-5 flex items-center justify-center">
                    {isCompleted && <Check className="size-4 text-success" aria-hidden="true" />}
                    {isCurrent && <Play className="size-4 text-brand" aria-hidden="true" />}
                  </span>

                  {/* Title */}
                  <span className="flex-1 truncate text-sm">
                    {chapter.title ?? `Chapter ${index + 1}`}
                  </span>

                  {/* Duration derived from cumulative start times */}
                  {duration !== null && (
                    <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatAudioTime(duration)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
