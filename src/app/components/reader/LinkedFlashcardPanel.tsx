/**
 * LinkedFlashcardPanel — read-only in-reader view for a highlight's linked flashcard.
 *
 * @module LinkedFlashcardPanel
 */
import { Layers, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import type { Flashcard } from '@/data/types'

interface LinkedFlashcardPanelProps {
  open: boolean
  flashcard: Flashcard | null
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  onClose: () => void
}

export function LinkedFlashcardPanel({
  open,
  flashcard,
  isLoading = false,
  isError = false,
  onRetry,
  onClose,
}: LinkedFlashcardPanelProps) {
  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] rounded-t-2xl px-4 pb-6 pt-0 overflow-y-auto"
        data-testid="linked-flashcard-panel"
        showCloseButton={false}
      >
        <SheetHeader className="py-4 border-b border-border/50 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <Layers className="size-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold">Linked Flashcard</SheetTitle>
                <SheetDescription className="text-xs">
                  This card was created from the selected highlight.
                </SheetDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close linked flashcard panel"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4" data-testid="linked-flashcard-loading">
            <p className="text-sm font-medium text-foreground">Loading linked flashcard...</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Finding the card connected to this highlight.
            </p>
          </div>
        ) : isError ? (
          <div
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
            data-testid="linked-flashcard-error"
          >
            <p className="text-sm font-medium text-foreground">Could not load linked flashcard</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Something went wrong while loading the card. You can try again without leaving the
              reader.
            </p>
            {onRetry && (
              <Button variant="outline" size="sm" className="mt-3 cursor-pointer" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        ) : flashcard ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Front
              </p>
              <p
                className="text-base font-medium leading-relaxed text-foreground"
                data-testid="linked-flashcard-front"
              >
                {flashcard.front}
              </p>
            </section>

            <section className="rounded-xl border border-border bg-background p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Back
              </p>
              <p
                className="text-sm leading-relaxed text-foreground"
                data-testid="linked-flashcard-back"
              >
                {flashcard.back}
              </p>
            </section>

            <p className="text-xs text-muted-foreground">
              Review scheduling stays in Flashcards. This panel is just a quick source check while
              reading.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl border border-warning/30 bg-warning/10 p-4"
            data-testid="linked-flashcard-missing"
          >
            <p className="text-sm font-medium text-foreground">Linked flashcard not found</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The highlight still points to a flashcard, but that card is no longer available.
            </p>
          </div>
        )}

        <div className="mt-5">
          <Button variant="brand" className="w-full" onClick={onClose}>
            Back to reading
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
