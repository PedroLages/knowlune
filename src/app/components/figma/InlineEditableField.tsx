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
  const focusTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync if external value changes while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value)
      originalValue.current = value
    }
  }, [value, isEditing])

  // Cleanup timers on unmount to avoid stale state updates
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  const enterEdit = useCallback(() => {
    originalValue.current = draftValue
    setIsEditing(true)
    // Auto-focus after render
    focusTimerRef.current = setTimeout(() => {
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
    successTimerRef.current = setTimeout(() => setShowSuccess(false), 1800)
  }, [draftValue, onSave])

  // Keyboard handler for input mode: Enter saves, Escape cancels
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

  // Keyboard handler for textarea mode: Enter inserts newline, Ctrl/Cmd+Enter saves, Escape cancels
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        commitSave()
      } else if (e.key === 'Escape') {
        setDraftValue(originalValue.current)
        setIsEditing(false)
      }
      // Plain Enter passes through to insert newline
    },
    [commitSave]
  )

  const handleBlur = useCallback(() => {
    // Blur saves (matches Notion/Linear behavior)
    if (isEditing) {
      commitSave()
    }
  }, [isEditing, commitSave])

  // Stop click propagation and prevent default to avoid Link navigation on cards
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (!isEditing) {
        enterEdit()
      }
    },
    [isEditing, enterEdit]
  )

  const commonClasses = cn(
    'w-full min-w-0 rounded-md border px-3 py-1',
    'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
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
        onKeyDown={handleTextareaKeyDown}
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
