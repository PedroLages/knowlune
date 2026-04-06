/**
 * Context menu wrapper for book cards — right-click (desktop) / long-press (mobile).
 *
 * Provides Edit, Change Status (submenu), and Delete actions.
 * Delete requires confirmation via AlertDialog to prevent accidental data loss.
 * Includes a "..." button for touch devices where right-click is unavailable.
 *
 * @since E83-S04
 */

import { useState, type ReactNode } from 'react'
import { Check, MoreVertical, ArrowRightLeft } from 'lucide-react'
import type { Book, BookStatus } from '@/data/types'
import { useBookStore } from '@/stores/useBookStore'
import { LinkFormatsDialog } from './LinkFormatsDialog'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

/** Shared status menu items used by both ContextMenu and DropdownMenu. */
function StatusMenuItems({
  book,
  onStatusChange,
  MenuItem,
}: {
  book: Book
  onStatusChange: (status: BookStatus) => void
  MenuItem: React.ComponentType<{
    key?: string
    onClick?: () => void
    children: ReactNode
    'data-testid'?: string
  }>
}) {
  return (
    <>
      {STATUS_OPTIONS.map(opt => (
        <MenuItem
          key={opt.value}
          onClick={() => onStatusChange(opt.value)}
          data-testid={`context-menu-status-${opt.value}`}
        >
          <span className="flex items-center gap-2">
            {book.status === opt.value && <Check className="h-3.5 w-3.5" />}
            <span className={book.status === opt.value ? 'font-medium' : ''}>{opt.label}</span>
          </span>
        </MenuItem>
      ))}
    </>
  )
}

interface BookContextMenuProps {
  book: Book
  children: ReactNode
  onEdit?: () => void
}

export function BookContextMenu({ book, children, onEdit }: BookContextMenuProps) {
  const updateBookStatus = useBookStore(s => s.updateBookStatus)
  const deleteBook = useBookStore(s => s.deleteBook)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  const handleDelete = () => {
    setConfirmDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    await deleteBook(book.id)
    setConfirmDeleteOpen(false)
  }

  const handleStatusChange = (status: BookStatus) => {
    updateBookStatus(book.id, status)
  }

  return (
    <>
      <div className="group relative">
        <ContextMenu>
          <ContextMenuTrigger>{children}</ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={onEdit} data-testid="context-menu-edit">
              Edit
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => setLinkDialogOpen(true)}
              data-testid="context-menu-link-format"
              className="flex items-center gap-2"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {book.linkedBookId ? 'Linked Format…' : 'Link Format…'}
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger data-testid="context-menu-change-status">
                Change Status
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <StatusMenuItems
                  book={book}
                  onStatusChange={handleStatusChange}
                  MenuItem={ContextMenuItem}
                />
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
              data-testid="context-menu-delete"
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Touch-friendly trigger — visible on hover/focus for touch devices */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute top-1 right-1 z-10 rounded-md p-1.5 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              aria-label={`More actions for ${book.title}`}
              data-testid="book-more-actions"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLinkDialogOpen(true)}
              data-testid="dropdown-menu-link-format"
              className="flex items-center gap-2"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {book.linkedBookId ? 'Linked Format…' : 'Link Format…'}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <StatusMenuItems
                  book={book}
                  onStatusChange={handleStatusChange}
                  MenuItem={DropdownMenuItem}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDelete}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Link Formats dialog */}
      <LinkFormatsDialog book={book} open={linkDialogOpen} onOpenChange={setLinkDialogOpen} />

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{book.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the book and all its highlights. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]" /* WCAG 2.5.5 touch target */
              data-testid="confirm-delete-book"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
