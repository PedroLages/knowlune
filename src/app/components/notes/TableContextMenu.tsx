import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react'
import { Editor } from '@tiptap/react'
import { Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Minus } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface TableContextMenuProps {
  editor: Editor
  children: React.ReactNode
}

export function TableContextMenu({ editor, children }: TableContextMenuProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('td, th') && editor.isActive('table')) {
        event.preventDefault()

        const menuWidth = 208 // w-52 = 13rem = 208px
        const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8)
        const y = event.clientY

        setPosition({ x, y })
        setVisible(true)
      }
    },
    [editor]
  )

  useEffect(() => {
    if (!visible) return

    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setVisible(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false)
        return
      }

      const menu = menuRef.current
      if (!menu) return

      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      const current = items.indexOf(document.activeElement as HTMLButtonElement)

      let next = current
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          next = (current + 1) % items.length
          break
        case 'ArrowUp':
          event.preventDefault()
          next = (current - 1 + items.length) % items.length
          break
        case 'Home':
          event.preventDefault()
          next = 0
          break
        case 'End':
          event.preventDefault()
          next = items.length - 1
          break
        default:
          return
      }

      items[next]?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible])

  // Clamp menu position after render so it doesn't overflow viewport
  useLayoutEffect(() => {
    if (!visible || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 8) {
      const clampedY = Math.max(8, window.innerHeight - rect.height - 8)
      setPosition(prev => ({ ...prev, y: clampedY }))
    }
  }, [visible])

  // Focus first menu item for keyboard accessibility
  useEffect(() => {
    if (!visible) return
    requestAnimationFrame(() => {
      const firstButton = menuRef.current?.querySelector('button')
      firstButton?.focus()
    })
  }, [visible])

  const runAction = useCallback((action: () => void) => {
    action()
    setVisible(false)
  }, [])

  const menuItems = useMemo(
    () => [
      {
        label: 'Add Row Above',
        icon: ArrowUp,
        action: () => editor.chain().focus().addRowBefore().run(),
      },
      {
        label: 'Add Row Below',
        icon: ArrowDown,
        action: () => editor.chain().focus().addRowAfter().run(),
      },
      { separator: true },
      {
        label: 'Add Column Left',
        icon: ArrowLeft,
        action: () => editor.chain().focus().addColumnBefore().run(),
      },
      {
        label: 'Add Column Right',
        icon: ArrowRight,
        action: () => editor.chain().focus().addColumnAfter().run(),
      },
      { separator: true },
      {
        label: 'Delete Row',
        icon: Minus,
        action: () => editor.chain().focus().deleteRow().run(),
      },
      {
        label: 'Delete Column',
        icon: Minus,
        action: () => editor.chain().focus().deleteColumn().run(),
      },
      { separator: true },
      {
        label: 'Delete Table',
        icon: Trash2,
        action: () => editor.chain().focus().deleteTable().run(),
        destructive: true,
      },
    ],
    [editor]
  )

  return (
    <div onContextMenu={handleContextMenu}>
      {children}

      {visible && (
        <div
          ref={menuRef}
          data-testid="table-context-menu"
          role="menu"
          aria-label="Table options"
          className="fixed bg-popover shadow-lg border border-border rounded-xl py-1 px-1 w-52 z-50"
          style={{ left: position.x, top: position.y }}
        >
          {menuItems.map((item, index) => {
            if ('separator' in item && item.separator) {
              return (
                <div
                  key={`sep-${index}`}
                  role="separator"
                  aria-hidden="true"
                  className="h-px bg-border my-1"
                />
              )
            }

            const {
              label,
              icon: Icon,
              action,
              destructive,
            } = item as {
              label: string
              icon: typeof ArrowUp
              action: () => void
              destructive?: boolean
            }

            return (
              <button
                key={label}
                type="button"
                role="menuitem"
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left cursor-pointer transition-colors hover:bg-accent rounded-md min-h-11',
                  destructive && 'text-destructive'
                )}
                onClick={() => runAction(action)}
              >
                <Icon className="size-4" />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
