import type { Editor } from '@tiptap/react'
import { cn } from '@/app/components/ui/utils'
import { getScrollBehavior } from './search-replace'

interface TableOfContentsPanelProps {
  editor: Editor
  onClose?: () => void
}

interface TocItem {
  id: string
  level: number
  textContent: string
  pos: number
}

export function TableOfContentsPanel({ editor, onClose }: TableOfContentsPanelProps) {
  const storage = editor.storage.tableOfContents as { content: TocItem[] } | undefined
  const items: TocItem[] = storage?.content ?? []

  const handleClick = (pos: number) => {
    editor.chain().focus().setTextSelection(pos).run()

    // Scroll the heading into view
    const { node } = editor.view.domAtPos(pos)
    const el = node instanceof Element ? node : node.parentElement
    el?.scrollIntoView({ block: 'center', behavior: getScrollBehavior() })

    onClose?.()
  }

  if (items.length === 0) {
    return (
      <div data-testid="toc-panel" className="p-4 text-sm text-muted-foreground">
        No headings yet
      </div>
    )
  }

  return (
    <div
      data-testid="toc-panel"
      className="py-2 max-h-[300px] overflow-y-auto"
      role="navigation"
      aria-label="Table of contents"
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => handleClick(item.pos)}
          className={cn(
            'block w-full text-left text-sm py-2.5 px-4 transition-colors cursor-pointer',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            item.level === 1 && 'font-semibold',
            item.level === 2 && 'pl-8',
            item.level === 3 && 'pl-12 text-muted-foreground'
          )}
        >
          {item.textContent}
        </button>
      ))}
    </div>
  )
}
