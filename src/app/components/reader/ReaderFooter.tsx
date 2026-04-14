/**
 * ReaderFooter — fixed bottom bar for the EPUB reader.
 *
 * Shows: progress bar (brand color fill), percentage read, page indicator.
 * Auto-hides together with the header after 3 seconds idle.
 *
 * @module ReaderFooter
 */
import { BookOpenText } from 'lucide-react'

import { cn } from '@/app/components/ui/utils'
import type { ReaderTheme } from '@/stores/useReaderStore'
import { useReaderStore } from '@/stores/useReaderStore'
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
  const showPageNumbers = useReaderStore(s => s.showPageNumbers)
  const showProgressBar = useReaderStore(s => s.showProgressBar)

  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex flex-col items-center px-8 pb-6 pt-3',
        'backdrop-blur-3xl rounded-t-xl shadow-[0_-4px_24px_rgba(0,0,0,0.04)]',
        'transition-all duration-200',
        chrome.bgOverlay,
        chrome.text,
        visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}
      aria-hidden={!visible}
      data-testid="reader-footer"
    >
      {/* Progress bar — constrained width, centered */}
      {showProgressBar && (
        <div className="w-full max-w-3xl mb-4 px-4">
          <div
            className="relative h-1 rounded-full bg-black/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Reading progress: ${progressPercent}%`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Page counter — centered, stacked layout (icon above text) */}
      {showPageNumbers && showPageIndicator ? (
        <div className="flex flex-col items-center" data-testid="reader-page-indicator">
          <BookOpenText className="size-5 opacity-60" aria-hidden="true" />
          <span className="text-xs uppercase tracking-widest opacity-60 mt-1">
            Page {currentPage} of {totalPages}
          </span>
        </div>
      ) : showProgressBar ? (
        <span className="text-xs opacity-60" data-testid="reader-progress-text">
          {progressPercent}% read
        </span>
      ) : null}
    </footer>
  )
}
