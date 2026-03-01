import { useState, useEffect, useRef } from 'react'
import type { TranscriptCue } from '@/data/types'
import { cn } from '@/app/components/ui/utils'

// ---------------------------------------------------------------------------
// VTT parser (inline, no dependency)
// Handles HH:MM:SS.mmm and MM:SS.mmm timestamp formats
// ---------------------------------------------------------------------------

function parseTime(t: string): number {
  const parts = t.replace(',', '.').split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
}

function parseVTT(text: string): TranscriptCue[] {
  const blocks = text.trim().split(/\n\n+/)
  const cues: TranscriptCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timestampLine = lines.find(l => l.includes('-->'))
    if (!timestampLine) continue

    const match = timestampLine.match(
      /(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)/
    )
    if (!match) continue

    const startTime = parseTime(match[1])
    const endTime = parseTime(match[2])

    const tsIdx = lines.indexOf(timestampLine)
    const textLines = lines.slice(tsIdx + 1).filter(l => l.trim())
    if (!textLines.length) continue

    cues.push({ startTime, endTime, text: textLines.join(' ') })
  }

  return cues
}

function formatCueTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TranscriptPanelProps {
  src: string
  currentTime: number
  onSeek: (time: number) => void
}

export function TranscriptPanel({ src, currentTime, onSeek }: TranscriptPanelProps) {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [error, setError] = useState(false)
  const activeCueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setCues([])

    fetch(src)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch transcript')
        return r.text()
      })
      .then(text => {
        if (!cancelled) setCues(parseVTT(text))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  const activeCue = cues.find(c => currentTime >= c.startTime && currentTime < c.endTime)

  // Auto-scroll active cue into view
  useEffect(() => {
    if (activeCueRef.current) {
      activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeCue])

  if (error) {
    return <div className="p-4 text-sm text-muted-foreground">Transcript unavailable</div>
  }

  if (!cues.length) {
    return <div className="p-4 text-sm text-muted-foreground">Loading transcript…</div>
  }

  return (
    <div className="overflow-y-auto space-y-1 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cues.map((cue, idx) => {
        const isActive = cue === activeCue
        return (
          <button
            key={idx}
            ref={isActive ? activeCueRef : undefined}
            data-testid={isActive ? 'transcript-cue-active' : 'transcript-cue'}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-600 text-foreground font-medium'
                : 'hover:bg-accent text-muted-foreground'
            )}
            onClick={() => onSeek(cue.startTime)}
          >
            <span className="text-xs text-muted-foreground block mb-0.5 font-mono">
              {formatCueTime(cue.startTime)}
            </span>
            {cue.text}
          </button>
        )
      })}
    </div>
  )
}
