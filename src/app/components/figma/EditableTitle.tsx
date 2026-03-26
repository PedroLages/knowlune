import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface EditableTitleProps {
  value: string
  onSave: (newTitle: string) => void
  className?: string
  'data-testid'?: string
}

/**
 * Inline-editable title component (E1C-S02).
 *
 * - Click title or edit icon to enter edit mode
 * - Pre-fills and selects current title
 * - Enter or blur saves (trimmed, non-empty)
 * - Empty submission restores original + shows validation message
 * - Escape cancels without saving
 */
export function EditableTitle({
  value,
  onSave,
  className,
  'data-testid': testId,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync draft when external value changes (e.g., after save)
  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [value, isEditing])

  // Focus and select input text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const startEditing = useCallback(() => {
    setDraft(value)
    setValidationError(null)
    setIsEditing(true)
  }, [value])

  const cancelEditing = useCallback(() => {
    setDraft(value)
    setValidationError(null)
    setIsEditing(false)
  }, [value])

  const saveTitle = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) {
      // AC3: Clear title entirely -> restore original, show validation message
      setDraft(value)
      setValidationError('Title cannot be empty')
      setIsEditing(false)
      return
    }
    if (trimmed !== value) {
      onSave(trimmed)
    }
    setValidationError(null)
    setIsEditing(false)
  }, [draft, value, onSave])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  if (isEditing) {
    return (
      <div data-testid={testId ? `${testId}-editing` : undefined}>
        <h1>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => {
              setDraft(e.target.value)
              if (validationError) setValidationError(null)
            }}
            onBlur={saveTitle}
            onKeyDown={handleKeyDown}
            aria-label="Edit course title"
            aria-invalid={!!validationError}
            maxLength={120}
            data-testid={testId ? `${testId}-input` : undefined}
            className={cn(
              'w-full text-2xl font-bold bg-transparent border-b-2 border-brand outline-none py-0.5 px-0',
              'focus:border-brand focus:ring-0',
              className
            )}
          />
        </h1>
        {validationError && (
          <p
            className="text-xs text-destructive mt-1"
            role="alert"
            aria-live="assertive"
            data-testid={testId ? `${testId}-error` : undefined}
          >
            {validationError}
          </p>
        )}
      </div>
    )
  }

  return (
    <div data-testid={testId ? `${testId}-display` : undefined}>
      <h1 className="inline">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Edit title: ${value}`}
          data-testid={testId}
          className={cn(
            'group/title inline-flex items-center gap-2 text-left cursor-pointer rounded-md',
            '-ml-1 px-1 py-0.5',
            'hover:bg-muted/60 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
          )}
        >
          <span className={cn('text-2xl font-bold', className)}>{value}</span>
          <Pencil
            className="size-4 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity duration-150 shrink-0"
            aria-hidden="true"
          />
        </button>
      </h1>
      {validationError && (
        <p
          className="text-xs text-destructive mt-1"
          role="alert"
          aria-live="assertive"
          data-testid={testId ? `${testId}-error` : undefined}
        >
          {validationError}
        </p>
      )}
    </div>
  )
}
