/**
 * TranscriptPanel — synchronized transcript display for YouTube lessons.
 *
 * Features:
 * - Active cue highlighting synced to player's current time
 * - Auto-scroll to keep active cue visible
 * - Click-to-seek on any transcript segment
 * - Search with instant highlight matching (<100ms)
 * - Keyboard navigation (Tab through segments, Enter to seek)
 * - Empty state and loading skeleton states
 * - WCAG 2.2 AA accessible
 *
 * @see E28-S10
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, FileText, Loader2, Download } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'
import { downloadAsFile } from '@/lib/download'
import { scrollIntoViewReducedMotion } from '@/lib/scroll'
import type { TranscriptCue } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCueTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Highlights search matches within text by wrapping them in <mark> elements.
 * Returns JSX fragments for rendering.
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-warning/30 text-foreground rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

/**
 * Checks if a cue matches the search query.
 */
function cueMatchesQuery(cue: TranscriptCue, query: string): boolean {
  if (!query.trim()) return false
  return cue.text.toLowerCase().includes(query.toLowerCase())
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TranscriptLoadingState = 'loading' | 'ready' | 'empty' | 'error'

export interface TranscriptPanelProps {
  /** Transcript cues to display */
  cues: TranscriptCue[]
  /** Current playback time in seconds */
  currentTime: number
  /** Callback when user clicks/activates a cue to seek */
  onSeek: (time: number) => void
  /** Loading state of the transcript */
  loadingState: TranscriptLoadingState
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranscriptPanel({ cues, currentTime, onSeek, loadingState }: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const activeCueRef = useRef<HTMLButtonElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isUserScrollingRef = useRef(false)
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Find the currently active cue based on playback time
  const activeCueIndex = useMemo(() => {
    if (!cues.length) return -1
    for (let i = cues.length - 1; i >= 0; i--) {
      if (currentTime >= cues[i].startTime && currentTime < cues[i].endTime) {
        return i
      }
    }
    // If between cues, find the last cue that started before current time
    for (let i = cues.length - 1; i >= 0; i--) {
      if (currentTime >= cues[i].startTime) return i
    }
    return -1
  }, [cues, currentTime])

  // Track search match count for screen reader announcement
  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0
    return cues.filter(c => cueMatchesQuery(c, searchQuery)).length
  }, [cues, searchQuery])

  // Track user scrolling to temporarily disable auto-scroll
  const handleScroll = useCallback(() => {
    isUserScrollingRef.current = true
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current)
    }
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false
    }, 3000) // Resume auto-scroll after 3s of no user scrolling
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
    }
  }, [])

  // Auto-scroll to active cue (unless user is scrolling or searching)
  useEffect(() => {
    if (activeCueRef.current && !isUserScrollingRef.current && !searchQuery.trim()) {
      scrollIntoViewReducedMotion(activeCueRef.current, {
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [activeCueIndex, searchQuery])

  const handleCueClick = useCallback(
    (time: number) => {
      onSeek(time)
    },
    [onSeek]
  )

  const handleCueKeyDown = useCallback(
    (event: React.KeyboardEvent, time: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSeek(time)
      }
    },
    [onSeek]
  )

  // Loading skeleton state
  if (loadingState === 'loading') {
    return (
      <div
        className="rounded-xl border bg-card p-4 h-full flex flex-col"
        data-testid="transcript-panel"
        role="region"
        aria-label="Transcript"
        aria-busy="true"
      >
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="size-4 text-muted-foreground animate-spin" aria-hidden="true" />
          <h2 className="font-semibold text-sm">Transcript</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Fetching transcript...</p>
        <div className="space-y-3" aria-label="Loading transcript">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state — no transcript available
  if (loadingState === 'empty' || (loadingState === 'ready' && !cues.length)) {
    return (
      <div
        className="rounded-xl border bg-card p-4 h-full flex flex-col items-center justify-center gap-3"
        data-testid="transcript-panel"
        role="region"
        aria-label="Transcript"
      >
        <FileText className="size-10 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground text-center">
          No transcript available for this video
        </p>
        <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
          Transcripts are automatically fetched when available. For videos without captions,
          consider setting up Whisper for local transcription.
        </p>
      </div>
    )
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div
        className="rounded-xl border bg-card p-4 h-full flex flex-col items-center justify-center gap-3"
        data-testid="transcript-panel"
        role="region"
        aria-label="Transcript"
      >
        <FileText className="size-10 text-destructive/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground text-center">Failed to load transcript</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border bg-card flex flex-col h-full"
      data-testid="transcript-panel"
      role="region"
      aria-label="Transcript"
    >
      {/* Header + Search */}
      <div className="p-3 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-semibold text-sm">Transcript</h2>
          <span className="text-xs text-muted-foreground ml-auto">{cues.length} segments</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Download transcript"
                  onClick={() => {
                    const lines = cues.map(
                      cue => `[${formatCueTime(cue.startTime)}] ${cue.text}`
                    )
                    downloadAsFile(lines.join('\n'), 'transcript.txt', 'text/plain')
                  }}
                >
                  <Download className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download transcript</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
            aria-label="Search transcript"
            data-testid="transcript-search-input"
          />
        </div>
        {searchQuery.trim() && (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {matchCount} {matchCount === 1 ? 'match' : 'matches'} found
          </p>
        )}
      </div>

      {/* Cue list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
        onScroll={handleScroll}
        role="list"
        aria-label="Transcript segments"
      >
        {cues.map((cue, idx) => {
          const isActive = idx === activeCueIndex
          const isMatch = searchQuery.trim() ? cueMatchesQuery(cue, searchQuery) : false
          const isSearchActive = searchQuery.trim().length > 0
          // When searching, dim non-matching cues but keep them visible
          const isDimmed = isSearchActive && !isMatch

          return (
            <button
              key={idx}
              ref={isActive ? activeCueRef : undefined}
              role="listitem"
              data-testid={isActive ? 'transcript-cue-active' : 'transcript-cue'}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isActive
                  ? 'bg-brand-soft border-l-2 border-brand text-foreground font-medium'
                  : 'hover:bg-accent text-muted-foreground',
                isMatch && !isActive && 'bg-warning/10',
                isDimmed && 'opacity-40'
              )}
              onClick={() => handleCueClick(cue.startTime)}
              onKeyDown={e => handleCueKeyDown(e, cue.startTime)}
              aria-label={`${formatCueTime(cue.startTime)} — ${cue.text}`}
              aria-current={isActive ? 'true' : undefined}
              tabIndex={0}
            >
              <span
                className="text-xs text-muted-foreground block mb-0.5 font-mono"
                aria-hidden="true"
              >
                {formatCueTime(cue.startTime)}
              </span>
              {isSearchActive ? highlightText(cue.text, searchQuery) : cue.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
