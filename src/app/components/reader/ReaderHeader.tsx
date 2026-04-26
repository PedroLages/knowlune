/**
 * ReaderHeader — fixed top bar for the EPUB reader.
 *
 * Contains: back button, book title (truncated), chapter indicator,
 * and menu button for Highlights, TOC, Settings, and optional Read Aloud.
 *
 * Auto-hides after 3 seconds of idle (managed by BookReader page).
 *
 * @module ReaderHeader
 */
import { ArrowLeft, Headphones, MoreHorizontal, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/components/ui/utils'
import type { ReaderTheme } from '@/stores/useReaderStore'
import { getReaderChromeClasses, useAppColorScheme } from './readerThemeConfig'

interface ReaderHeaderProps {
  title: string
  currentChapter?: string
  theme: ReaderTheme
  visible: boolean
  onTocOpen?: () => void
  onSettingsOpen?: () => void
  onHighlightsOpen?: () => void
  /** Called when Read Aloud menu item is clicked. Hidden if undefined (TTS not available). */
  onReadAloud?: () => void
  /** When provided, renders a "Switch to Listening" button. Wired by BookReader when a chapter mapping exists (E103-S02). */
  onSwitchToListening?: () => void
  /** Reading progress (0-1) for chapter name fallback — displays as percentage when chapter is unavailable */
  readingProgress?: number
}

export function ReaderHeader({
  title,
  currentChapter,
  theme,
  visible,
  onTocOpen,
  onSettingsOpen,
  onHighlightsOpen,
  onReadAloud,
  onSwitchToListening,
  readingProgress,
}: ReaderHeaderProps) {
  const navigate = useNavigate()
  const colorScheme = useAppColorScheme()
  const chrome = getReaderChromeClasses(theme, colorScheme)

  // Chapter display: use chapter name when available, fall back to progress percentage
  // Treat empty string as unavailable (should show progress percentage instead)
  const chapterDisplay =
    currentChapter ||
    (readingProgress !== undefined ? `${Math.round(readingProgress * 100)}%` : undefined)

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3',
        'backdrop-blur-3xl shadow-sm transition-all duration-200',
        chrome.bgOverlay,
        chrome.text,
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      )}
      aria-hidden={!visible}
      data-testid="reader-header"
    >
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/library')}
        aria-label="Back to library"
        className={cn('min-h-[44px] min-w-[44px]', 'hover:bg-black/10', chrome.text)}
        data-testid="reader-back-button"
      >
        <ArrowLeft className="size-5" />
      </Button>

      {/* Title and chapter */}
      <div className="flex-1 min-w-0 mx-3 text-center">
        <p
          className="text-sm font-semibold truncate leading-tight"
          title={title}
          data-testid="reader-book-title"
        >
          {title}
        </p>
        {chapterDisplay && (
          <p
            className="text-xs opacity-60 truncate leading-tight"
            title={chapterDisplay}
            data-testid="reader-chapter-title"
          >
            {chapterDisplay}
          </p>
        )}
      </div>

      {/* Switch to Listening — only when a chapter mapping exists (E103-S02) */}
      {onSwitchToListening && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSwitchToListening}
          aria-label="Switch to listening"
          title="Switch to listening"
          className={cn('min-h-[44px] min-w-[44px] gap-1.5', chrome.text, 'hover:bg-black/10')}
          data-testid="switch-to-listening-button"
        >
          <Headphones className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline text-xs">Listen</span>
        </Button>
      )}

      {/* Menu button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reader menu"
            className={cn('min-h-[44px] min-w-[44px]', 'hover:bg-black/10', chrome.text)}
            data-testid="reader-menu-button"
          >
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[130] w-48">
          <DropdownMenuItem
            onClick={() => onTocOpen?.()}
            data-testid="reader-menu-toc"
          >
            Table of Contents
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSettingsOpen?.()}
            data-testid="reader-menu-settings"
          >
            Reading Settings
          </DropdownMenuItem>
          {onReadAloud && (
            <DropdownMenuItem onClick={() => onReadAloud()} data-testid="reader-menu-read-aloud">
              <Volume2 className="size-4 mr-2" aria-hidden="true" />
              Read Aloud
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => onHighlightsOpen?.()}
            data-testid="reader-menu-highlights"
          >
            Highlights & Notes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
