/**
 * ReaderFooter — fixed bottom bar for the EPUB reader.
 *
 * Shows: progress bar (brand color fill), percentage read, page indicator.
 * Auto-hides together with the header after 3 seconds idle.
 *
 * @module ReaderFooter
 */
import { cn } from '@/app/components/ui/utils'
import type { ReaderTheme } from '@/stores/useReaderStore'

const FOOTER_BG: Record<ReaderTheme, string> = {
  light: 'bg-[#FAF5EE]/95',
  sepia: 'bg-[#F4ECD8]/95',
  dark: 'bg-[#1a1a1a]/95',
}

const FOOTER_TEXT: Record<ReaderTheme, string> = {
  light: 'text-[#1a1a1a]',
  sepia: 'text-[#3a2a1a]',
  dark: 'text-[#d4d4d4]',
}

interface ReaderFooterProps {
  /** Progress 0–1 */
  progress: number
  theme: ReaderTheme
  visible: boolean
  /** Current page number (1-based), optional — shown when available */
  currentPage?: number
  /** Total page estimate from epub.js locations.total, optional */
  totalPages?: number
}

export function ReaderFooter({
  progress,
  theme,
  visible,
  currentPage,
  totalPages,
}: ReaderFooterProps) {
  const progressPercent = Math.round(progress * 100)
  const showPageIndicator = currentPage != null && totalPages != null && totalPages > 0

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 px-4 py-2',
        'backdrop-blur-sm border-t border-black/10 transition-all duration-200',
        FOOTER_BG[theme],
        FOOTER_TEXT[theme],
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}
      aria-hidden={!visible}
      data-testid="reader-footer"
    >
      {/* Progress bar */}
      <div
        className="h-1 w-full rounded-full bg-black/10 mb-1"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Reading progress: ${progressPercent}%`}
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Progress text */}
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-60" data-testid="reader-progress-text">
          {progressPercent}% read
        </span>
        {showPageIndicator ? (
          <span className="text-xs opacity-60" data-testid="reader-page-indicator">
            Page {currentPage} of {totalPages}
          </span>
        ) : (
          progress > 0 && progress < 1 && (
            <span className="text-xs opacity-60">
              {Math.round((1 - progress) * 100)}% remaining
            </span>
          )
        )}
      </div>
    </footer>
  )
}
