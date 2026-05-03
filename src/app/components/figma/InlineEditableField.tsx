import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/app/components/ui/utils'

interface InlineEditableFieldProps {
  value: string
  onSave: (value: string) => void
  as?: 'input' | 'textarea'
  className?: string
  placeholder?: string
  maxLength?: number
  ariaLabel?: string
}

/**
 * Click-to-edit text field. Renders as read-only text until clicked,
 * then switches to an input or textarea with keyboard support.
 *
 * Enter saves, Escape cancels, blur saves. Shows a brief green border
 * flash on successful save.
 */
export function InlineEditableField({
  value,
  onSave,
  as = 'input',
  className,
  placeholder,
  maxLength,
  ariaLabel,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const [showSuccess, setShowSuccess] = useState(false)
  const originalValue = useRef(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  // Sync if external value changes while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value)
      originalValue.current = value
    }
  }, [value, isEditing])

  const enterEdit = useCallback(() => {
    originalValue.current = draftValue
    setIsEditing(true)
    // Auto-focus after render
    setTimeout(() => {
      inputRef.current?.focus()
      // Select all text for easy replacement
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }, 0)
  }, [draftValue])

  const commitSave = useCallback(() => {
    setIsEditing(false)
    setShowSuccess(true)
    onSave(draftValue)
    // Brief visual confirmation
    setTimeout(() => setShowSuccess(false), 1000)
  }, [draftValue, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitSave()
      } else if (e.key === 'Escape') {
        // Cancel: revert to original value
        setDraftValue(originalValue.current)
        setIsEditing(false)
      }
    },
    [commitSave]
  )

  const handleBlur = useCallback(() => {
    // Blur saves (matches Notion/Linear behavior)
    if (isEditing) {
      commitSave()
    }
  }, [isEditing, commitSave])

  // Stop click propagation to prevent Link navigation on cards
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isEditing) {
        enterEdit()
      }
    },
    [isEditing, enterEdit]
  )

  const commonClasses = cn(
    'w-full min-w-0 rounded-md border px-3 py-1',
    'ring-2 ring-brand ring-offset-2',
    'bg-input-background border-input',
    'transition-[border-color,box-shadow]',
    showSuccess && 'border-success ring-success/50 ring-2',
    className
  )

  if (!isEditing) {
    const Tag = as === 'textarea' ? 'p' : 'span'
    return (
      <Tag
        role="button"
        tabIndex={0}
        aria-label={ariaLabel || `Edit field: ${value || 'empty'}`}
        className={cn(
          'cursor-text outline-none rounded-sm',
          'hover:bg-muted/50 transition-colors',
          'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          as === 'textarea' && 'whitespace-pre-wrap',
          !value && 'text-muted-foreground italic',
          showSuccess && 'border border-success ring-2 ring-success/50',
          className
        )}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            enterEdit()
          }
        }}
      >
        {value || placeholder || 'Click to edit'}
      </Tag>
    )
  }

  if (as === 'textarea') {
    return (
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        value={draftValue}
        onChange={e => setDraftValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={e => e.stopPropagation()}
        maxLength={maxLength}
        rows={3}
        aria-label={ariaLabel || 'Edit field'}
        placeholder={placeholder}
        className={cn(
          commonClasses,
          'resize-none',
          'focus-visible:outline-none'
        )}
      />
    )
  }

  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      type="text"
      value={draftValue}
      onChange={e => setDraftValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onClick={e => e.stopPropagation()}
      maxLength={maxLength}
      aria-label={ariaLabel || 'Edit field'}
      placeholder={placeholder}
      className={cn(
        commonClasses,
        'h-9',
        'focus-visible:outline-none'
      )}
    />
  )
}
