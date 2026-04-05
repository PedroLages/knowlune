/**
 * ClozeFlashcardCreator — inline panel for creating cloze-deletion flashcards
 * from a highlighted passage.
 *
 * Appears as a bottom Sheet (mobile and desktop). The user taps words to
 * "blank" them, sees a real-time preview showing [___] for blanks, then
 * creates a Flashcard record in Dexie and links it to the BookHighlight.
 *
 * First-time onboarding: first word pulses once; one-time tooltip shown.
 * Stored in localStorage key: 'knowlune-cloze-tutorial-shown-v1'
 *
 * @module ClozeFlashcardCreator
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { db } from '@/db/schema'
import { useHighlightStore } from '@/stores/useHighlightStore'
import type { Flashcard } from '@/data/types'

const TUTORIAL_KEY = 'knowlune-cloze-tutorial-shown-v1'
const BLANK_PLACEHOLDER = '[___]'

/** Split text into word tokens, preserving whitespace between words */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(t => t.length > 0)
}

/** Build cloze front text replacing blanked words with [___] */
function buildClozeFront(tokens: string[], blanked: Set<number>): string {
  return tokens.map((token, i) => (blanked.has(i) ? BLANK_PLACEHOLDER : token)).join('')
}

/** Build cloze back text (original text with blanked words indicated) */
function buildClozeBack(tokens: string[], blanked: Set<number>): string {
  return tokens.map((token, i) => (blanked.has(i) ? `**${token.trim()}**` : token)).join('')
}

interface ClozeFlashcardCreatorProps {
  open: boolean
  onClose: () => void
  /** The highlighted text to turn into a flashcard */
  text: string
  /** The highlight ID to link; undefined if creating highlight first */
  highlightId?: string
  bookId: string
}

export function ClozeFlashcardCreator({
  open,
  onClose,
  text,
  highlightId,
  bookId,
}: ClozeFlashcardCreatorProps) {
  const updateHighlight = useHighlightStore(s => s.updateHighlight)

  const tokens = tokenize(text)
  const wordIndices = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.trim().length > 0)
    .map(({ i }) => i)

  const [blanked, setBlanked] = useState<Set<number>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [pulseFirst, setPulseFirst] = useState(false)

  // Show first-time tutorial tip
  useEffect(() => {
    if (!open) return
    const shown = localStorage.getItem(TUTORIAL_KEY)
    if (!shown) {
      setShowTutorial(true)
      setPulseFirst(true)
      const timer = setTimeout(() => setPulseFirst(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Reset state when text changes
  useEffect(() => {
    setBlanked(new Set())
  }, [text])

  const dismissTutorial = () => {
    setShowTutorial(false)
    localStorage.setItem(TUTORIAL_KEY, '1')
  }

  const toggleBlank = useCallback(
    (index: number) => {
      setBlanked(prev => {
        const next = new Set(prev)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return next
      })
      if (showTutorial) dismissTutorial()
    },
    [showTutorial]
  )

  const front = buildClozeFront(tokens, blanked)
  const back = buildClozeBack(tokens, blanked)
  const hasBlanks = blanked.size > 0

  const handleCreate = async () => {
    if (!hasBlanks) return
    setIsCreating(true)

    try {
      const now = new Date().toISOString()
      const flashcardId = crypto.randomUUID()

      const flashcard: Flashcard = {
        id: flashcardId,
        courseId: '', // book-sourced flashcards use empty courseId sentinel
        sourceType: 'book',
        sourceBookId: bookId,
        sourceHighlightId: highlightId,
        front,
        back,
        stability: 0,
        difficulty: 0,
        reps: 0,
        lapses: 0,
        state: 0, // New — enters FSRS queue at state 0
        elapsed_days: 0,
        scheduled_days: 0,
        due: now,
        createdAt: now,
        updatedAt: now,
      }

      await db.flashcards.put(flashcard)

      // Link the flashcard back to the highlight
      if (highlightId) {
        await updateHighlight(highlightId, { flashcardId })
      }

      toast.success("Flashcard created — it'll appear in your next review")
      onClose()
    } catch {
      toast.error('Failed to create flashcard')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] rounded-t-2xl px-4 pb-6 pt-0 overflow-y-auto"
        data-testid="cloze-creator"
      >
        <SheetHeader className="py-4 border-b border-border/50 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand" aria-hidden="true" />
              <SheetTitle className="text-base font-semibold">Create Flashcard</SheetTitle>
            </div>
            <button
              onClick={onClose}
              aria-label="Close flashcard creator"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </SheetHeader>

        {/* Instruction */}
        <p className="text-sm text-muted-foreground mb-3">Tap words to create blanks:</p>

        {/* First-time tutorial tooltip */}
        {showTutorial && (
          <div className="bg-brand/10 border border-brand/20 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-brand-soft-foreground">
              Tap any word to blank it for your flashcard
            </p>
            <button
              onClick={dismissTutorial}
              className="text-brand-soft-foreground/60 hover:text-brand-soft-foreground text-xs underline shrink-0"
              aria-label="Dismiss tip"
            >
              Got it
            </button>
          </div>
        )}

        {/* Word tokens */}
        <div
          className="flex flex-wrap gap-1.5 mb-4 leading-loose"
          role="group"
          aria-label="Tap words to blank them"
        >
          {tokens.map((token, i) => {
            const isWord = token.trim().length > 0
            if (!isWord) {
              // Whitespace token — render as space
              return (
                <span key={i} className="inline">
                  {token}
                </span>
              )
            }
            const isBlanked = blanked.has(i)
            const isFirst = wordIndices[0] === i
            return (
              <button
                key={i}
                role="checkbox"
                aria-checked={isBlanked}
                aria-label={`Blank the word '${token.trim()}'`}
                onClick={() => toggleBlank(i)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    toggleBlank(i)
                  }
                }}
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-sm transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  isBlanked
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-muted/30 hover:bg-muted cursor-pointer',
                  isFirst && pulseFirst && !isBlanked ? 'motion-safe:animate-pulse' : ''
                )}
                data-testid={`cloze-word-${i}`}
              >
                {token}
              </button>
            )
          })}
        </div>

        {/* Preview */}
        {hasBlanks && (
          <div className="bg-muted/20 rounded-xl p-3 mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              Preview
            </p>
            <p className="text-sm italic text-foreground">{front}</p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose} data-testid="cloze-cancel">
            Cancel
          </Button>
          <Button
            variant="brand"
            className="flex-1"
            onClick={() => {
              handleCreate().catch(() => {
                /* silent-catch-ok */
              })
            }}
            disabled={!hasBlanks || isCreating}
            aria-disabled={!hasBlanks}
            data-testid="cloze-create"
          >
            {isCreating ? 'Creating...' : 'Create Card'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
