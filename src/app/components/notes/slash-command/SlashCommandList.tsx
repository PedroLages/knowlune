import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Image as ImageIcon,
  Youtube,
  ChevronRight,
  Quote,
  Table2,
} from 'lucide-react'

export interface SlashCommandItem {
  title: string
  description: string
  icon: React.ReactNode
  command: (editor: Editor) => void
}

export function getSlashCommandItems(callbacks: {
  onImageUpload: () => void
  onYoutubeEmbed: () => void
}): SlashCommandItem[] {
  return [
    {
      title: 'Heading 1',
      description: 'Large heading',
      icon: <Heading1 className="size-4" />,
      command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      description: 'Medium heading',
      icon: <Heading2 className="size-4" />,
      command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      description: 'Small heading',
      icon: <Heading3 className="size-4" />,
      command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: <List className="size-4" />,
      command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: 'Ordered List',
      description: 'Numbered list',
      icon: <ListOrdered className="size-4" />,
      command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      title: 'Task List',
      description: 'Checklist with todos',
      icon: <ListTodo className="size-4" />,
      command: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      title: 'Code Block',
      description: 'Syntax-highlighted code',
      icon: <Code className="size-4" />,
      command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      title: 'Image',
      description: 'Upload an image',
      icon: <ImageIcon className="size-4" />,
      command: () => callbacks.onImageUpload(),
    },
    {
      title: 'YouTube',
      description: 'Embed a video',
      icon: <Youtube className="size-4" />,
      command: () => callbacks.onYoutubeEmbed(),
    },
    {
      title: 'Toggle',
      description: 'Collapsible section',
      icon: <ChevronRight className="size-4" />,
      command: (editor) => editor.chain().focus().setDetails().run(),
    },
    {
      title: 'Blockquote',
      description: 'Quote text',
      icon: <Quote className="size-4" />,
      command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      title: 'Table',
      description: 'Insert a table',
      icon: <Table2 className="size-4" />,
      command: (editor) => {
        if (editor.isActive('table')) return
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      },
    },
  ]
}

interface SlashCommandListProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Scroll selected item into view
    useEffect(() => {
      const container = containerRef.current
      if (!container) return
      const selected = container.querySelector('[data-selected="true"]')
      selected?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((i) => (i + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((i) => (i + 1) % items.length)
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
          data-testid="slash-command-list"
          className="bg-popover shadow-lg border border-border rounded-xl p-3 text-sm text-muted-foreground"
        >
          No matching commands
        </div>
      )
    }

    return (
      <div
        ref={containerRef}
        data-testid="slash-command-list"
        className="bg-popover shadow-lg border border-border rounded-xl py-1 max-h-[300px] overflow-y-auto w-64"
        role="listbox"
        aria-label="Slash commands"
      >
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            data-selected={index === selectedIndex}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors hover:bg-accent data-[selected=true]:bg-accent"
            onClick={() => command(item)}
          >
            <span className="flex items-center justify-center size-8 rounded-md bg-muted text-muted-foreground shrink-0">
              {item.icon}
            </span>
            <span>
              <span className="block font-medium">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    )
  },
)

SlashCommandList.displayName = 'SlashCommandList'
