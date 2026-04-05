/**
 * Context menu wrapper for book cards — right-click (desktop) / long-press (mobile).
 *
 * Provides Edit, Change Status (submenu), and Delete actions.
 *
 * @since E83-S04
 */

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { Book, BookStatus } from '@/data/types'
import { useBookStore } from '@/stores/useBookStore'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/app/components/ui/context-menu'

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

interface BookContextMenuProps {
  book: Book
  children: ReactNode
}

export function BookContextMenu({ book, children }: BookContextMenuProps) {
  const updateBookStatus = useBookStore(s => s.updateBookStatus)
  const deleteBook = useBookStore(s => s.deleteBook)

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          disabled
          data-testid="context-menu-edit"
        >
          Edit
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="context-menu-change-status">
            Change Status
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            {STATUS_OPTIONS.map(opt => (
              <ContextMenuItem
                key={opt.value}
                onClick={() => updateBookStatus(book.id, opt.value)}
                data-testid={`context-menu-status-${opt.value}`}
              >
                <span className="flex items-center gap-2">
                  {book.status === opt.value && <Check className="h-3.5 w-3.5" />}
                  <span className={book.status === opt.value ? 'font-medium' : ''}>
                    {opt.label}
                  </span>
                </span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => deleteBook(book.id)}
          data-testid="context-menu-delete"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
