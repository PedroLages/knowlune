import { useCallback, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { ChevronUp, ChevronDown, X, Replace } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/app/components/ui/utils'
import type { SearchReplaceStorage } from './SearchReplaceExtension'

interface FindReplacePanelProps {
  editor: Editor
  onClose: () => void
}

export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const findInputRef = useRef<HTMLInputElement>(null)

  const storage = (editor.storage as unknown as Record<string, SearchReplaceStorage>).searchReplace
  const { results, currentIndex, searchTerm, replaceTerm } = storage

  // Focus the find input on mount
  useEffect(() => {
    findInputRef.current?.focus()
  }, [])

  const handleSearchChange = useCallback(
    (value: string) => {
      editor.commands.setSearchTerm(value)
    },
    [editor]
  )

  const handleReplaceChange = useCallback(
    (value: string) => {
      editor.commands.setReplaceTerm(value)
    },
    [editor]
  )

  const handleFindNext = useCallback(() => {
    editor.commands.findNext()
  }, [editor])

  const handleFindPrev = useCallback(() => {
    editor.commands.findPrev()
  }, [editor])

  const handleReplace = useCallback(() => {
    editor.commands.replaceCurrent()
  }, [editor])

  const handleReplaceAll = useCallback(() => {
    editor.commands.replaceAll()
  }, [editor])

  const handleClose = useCallback(() => {
    editor.commands.clearSearch()
    onClose()
  }, [editor, onClose])

  const matchCountText =
    results.length === 0
      ? searchTerm
        ? 'No results'
        : ''
      : `${currentIndex + 1} of ${results.length}`

  return (
    <div
      data-testid="find-replace-panel"
      className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-muted/50"
      role="search"
      aria-label="Find and replace"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.preventDefault()
          handleClose()
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleFindNext()
        } else if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault()
          handleFindPrev()
        }
      }}
    >
      {/* Find row */}
      <div className="flex items-center gap-2">
        <Input
          ref={findInputRef}
          value={searchTerm}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Find"
          className="h-9 flex-1 min-w-0"
          aria-label="Find text"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-center">
          {matchCountText}
        </span>
        <PanelButton onClick={handleFindPrev} aria-label="Previous match">
          <ChevronUp className="size-4" />
        </PanelButton>
        <PanelButton onClick={handleFindNext} aria-label="Next match">
          <ChevronDown className="size-4" />
        </PanelButton>
        <PanelButton onClick={handleClose} aria-label="Close find and replace">
          <X className="size-4" />
        </PanelButton>
      </div>

      {/* Replace row */}
      <div className="flex items-center gap-2">
        <Input
          value={replaceTerm}
          onChange={e => handleReplaceChange(e.target.value)}
          placeholder="Replace"
          className="h-9 flex-1 min-w-0"
          aria-label="Replace text"
        />
        <PanelButton onClick={handleReplace} aria-label="Replace">
          <Replace className="size-4" />
        </PanelButton>
        <button
          type="button"
          onClick={handleReplaceAll}
          className={cn(
            'inline-flex items-center justify-center h-11 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1'
          )}
          aria-label="Replace all"
        >
          Replace All
        </button>
      </div>
    </div>
  )
}

function PanelButton({
  onClick,
  children,
  ...props
}: {
  onClick: () => void
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center size-11 rounded-md text-sm transition-colors cursor-pointer shrink-0',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1'
      )}
      {...props}
    >
      {children}
    </button>
  )
}
