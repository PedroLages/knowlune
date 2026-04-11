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
import { getReaderChromeClasses, useAppColorScheme } from './readerThemeConfig'

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
  const colorScheme = useAppColorScheme()
  const chrome = getReaderChromeClasses(theme, colorScheme)
  const progressPercent = Math.round(progress * 100)
  const showPageIndicator = currentPage != null && totalPages != null && totalPages > 0

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 px-4 py-2',
        'backdrop-blur-3xl transition-all duration-200',
        chrome.bgOverlay,
        chrome.text,
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
          progress > 0 &&
          progress < 1 && (
            <span className="text-xs opacity-60">
              {Math.round((1 - progress) * 100)}% remaining
            </span>
          )
        )}
      </div>
    </footer>
  )
}
