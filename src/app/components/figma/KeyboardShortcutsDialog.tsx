import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Kbd } from '@/app/components/ui/kbd'

interface Shortcut {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  label: string
  shortcuts: Shortcut[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    label: 'Global',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Cmd', 'K'], description: 'Open search' },
      { keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
      { keys: ['Cmd', ','], description: 'Go to Settings' },
      { keys: ['Escape'], description: 'Close dialog / search (also closes TOC, panels in reader)' },
    ],
  },
  {
    label: 'Library',
    shortcuts: [
      { keys: ['N'], description: 'Open import dialog' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['G', 'then', 'L'], description: 'Toggle grid/list view' },
    ],
  },
  {
    label: 'EPUB Reader',
    shortcuts: [
      { keys: ['←'], description: 'Previous page' },
      { keys: ['→'], description: 'Next page' },
      { keys: ['T'], description: 'Open table of contents' },
      { keys: ['H'], description: 'Open highlights panel' },
      { keys: ['B'], description: 'Add bookmark' },
      { keys: ['S'], description: 'Open settings' },
      { keys: ['Escape'], description: 'Return to library' },
    ],
  },
  {
    label: 'Audiobook Player',
    shortcuts: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['←'], description: 'Skip back 30s' },
      { keys: ['→'], description: 'Skip forward 30s' },
      { keys: ['↑'], description: 'Volume up' },
      { keys: ['↓'], description: 'Volume down' },
      { keys: ['['], description: 'Decrease speed' },
      { keys: [']'], description: 'Increase speed' },
      { keys: ['M'], description: 'Toggle mute' },
      { keys: ['Escape'], description: 'Return to library' },
    ],
  },
]

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate the platform quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {shortcutGroups.map(group => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map(shortcut => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={`${key}-${i}`} className="flex items-center gap-1">
                          {i > 0 && key !== 'then' && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                          {key === 'then' ? (
                            <span className="text-xs text-muted-foreground mx-0.5">then</span>
                          ) : (
                            <Kbd>{key}</Kbd>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
