import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface VideoShortcutsOverlayProps {
  open: boolean
  onClose: () => void
}

interface ShortcutEntry {
  keys: string[]
  description: string
  separator?: string // defaults to '+' (chord); use '/' for independent keys
}

const playbackShortcuts: ShortcutEntry[] = [
  { keys: ['Space', 'K'], description: 'Play/Pause' },
  { keys: ['J'], description: 'Skip back 10s' },
  { keys: ['L'], description: 'Skip forward 10s' },
  { keys: ['\u2190'], description: 'Seek back 5s' },
  { keys: ['\u2192'], description: 'Seek forward 5s' },
  { keys: ['0\u20139'], description: 'Jump to 0\u201390%' },
  { keys: ['P'], description: 'Picture-in-Picture' },
  { keys: ['<', '>'], description: 'Speed down/up', separator: '/' },
]

const controlShortcuts: ShortcutEntry[] = [
  { keys: ['M'], description: 'Mute' },
  { keys: ['\u2191', '\u2193'], description: 'Volume up/down' },
  { keys: ['C'], description: 'Captions' },
  { keys: ['F'], description: 'Fullscreen' },
  { keys: ['B'], description: 'Add bookmark' },
  { keys: ['?'], description: 'Show shortcuts' },
]

const loopShortcuts: ShortcutEntry[] = [
  { keys: ['A'], description: 'Set loop start / end (A→B, Esc to reset)' },
  { keys: ['Esc'], description: 'Clear loop' },
]

const notesShortcuts: ShortcutEntry[] = [
  { keys: ['N'], description: 'Focus note editor' },
  { keys: ['Alt', 'T'], description: 'Insert timestamp (in notes)' },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded bg-white/20 border border-white/30 text-xs font-mono font-medium text-white">
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutEntry }) {
  const sep = shortcut.separator ?? '+'
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/80">{shortcut.description}</span>
      <div className="flex items-center gap-1 shrink-0">
        {shortcut.keys.map((key, i) => (
          <span key={key} className="flex items-center gap-1">
            {i > 0 && <span className="text-xs text-white/50">{sep}</span>}
            <Kbd>{key}</Kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

export function VideoShortcutsOverlay({ open, onClose }: VideoShortcutsOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      data-testid="video-shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      tabIndex={-1}
      className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 size-11 text-white/70 hover:text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Close shortcuts"
      >
        <X className="size-5" />
      </Button>

      <div className="w-full max-w-lg px-6">
        <h3 id="shortcuts-title" className="text-white text-base font-semibold text-center mb-4">
          Keyboard Shortcuts
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          {/* Column 1: Playback */}
          <div data-column="playback" className="space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              Playback
            </p>
            {playbackShortcuts.map(s => (
              <ShortcutRow key={s.description} shortcut={s} />
            ))}
          </div>

          {/* Column 2: Controls + AB Loop + Notes */}
          <div data-column="controls" className="space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
              Controls
            </p>
            {controlShortcuts.map(s => (
              <ShortcutRow key={s.description} shortcut={s} />
            ))}
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 mt-4">
              AB Loop
            </p>
            {loopShortcuts.map(s => (
              <ShortcutRow key={s.description} shortcut={s} />
            ))}
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 mt-4">
              Notes
            </p>
            {notesShortcuts.map(s => (
              <ShortcutRow key={s.description} shortcut={s} />
            ))}
          </div>
        </div>

        <p className="text-xs text-white/60 text-center mt-4">Press ? or Esc to close</p>
      </div>
    </div>
  )
}
