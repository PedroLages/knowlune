import { useState, useEffect, useRef } from 'react'
import type { TranscriptCue } from '@/data/types'
import { cn } from '@/app/components/ui/utils'
import { parseVTT } from '@/lib/captions'
import { scrollIntoViewReducedMotion } from '@/lib/scroll'

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
        // silent-catch-ok — error state handled by component
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
      scrollIntoViewReducedMotion(activeCueRef.current, { behavior: 'smooth', block: 'nearest' })
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
