import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { EmojiItem } from '@tiptap/extension-emoji'

interface EmojiListProps {
  items: EmojiItem[]
  command: (item: EmojiItem) => void
  ref?: React.Ref<EmojiListRef>
}

export interface EmojiListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export function EmojiList({ items, command, ref }: EmojiListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const selected = container.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div
        data-testid="emoji-list"
        className="bg-popover shadow-lg border border-border rounded-xl p-3 text-sm text-muted-foreground"
      >
        No matching emojis
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="emoji-list"
      className="bg-popover shadow-lg border border-border rounded-xl py-1 max-h-[200px] overflow-y-auto w-56"
      role="listbox"
      aria-label="Emoji suggestions"
    >
      {items.map((item, index) => (
        <button
          key={item.name}
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          data-selected={index === selectedIndex}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors hover:bg-accent data-[selected=true]:bg-accent"
          onClick={() => command(item)}
        >
          <span className="text-lg">{item.emoji ?? item.fallbackImage}</span>
          <span className="text-muted-foreground">:{item.shortcodes[0]}:</span>
        </button>
      ))}
    </div>
  )
}
