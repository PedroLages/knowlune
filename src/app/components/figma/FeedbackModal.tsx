import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Loader2, Copy, Check } from 'lucide-react'
import { useFeedbackSubmit } from '@/app/hooks/useFeedbackSubmit'
import type { FeedbackMode, FeedbackFormFields } from '@/lib/feedbackService'

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after successful submission (before modal closes). */
  onSuccess?: () => void
}

export function FeedbackModal({ open, onOpenChange, onSuccess }: FeedbackModalProps) {
  // Capture the focused element at the time the modal opens so we can
  // restore focus when it closes (plan critic: use document.activeElement, not triggerRef).
  const priorFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (open) {
      priorFocusRef.current = document.activeElement
    } else {
      // Restore focus to the element that triggered the modal
      if (priorFocusRef.current instanceof HTMLElement) {
        priorFocusRef.current.focus()
      }
      priorFocusRef.current = null
    }
  }, [open])

  const [mode, setMode] = useState<FeedbackMode>('bug')

  // Bug report fields
  const [bugTitle, setBugTitle] = useState('')
  const [bugDescription, setBugDescription] = useState('')
  const [bugSteps, setBugSteps] = useState('')

  // Feedback fields
  const [feedbackTitle, setFeedbackTitle] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const { submit, status, error, fallbackText, mailtoHref, reset } = useFeedbackSubmit()

  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clear the "copied" timer on unmount to avoid state updates on unmounted component
  useEffect(() => {
    return () => {
      clearTimeout(copiedTimerRef.current)
    }
  }, [])

  // Reset form state when modal closes
  useEffect(() => {
    if (!open) {
      setBugTitle('')
      setBugDescription('')
      setBugSteps('')
      setFeedbackTitle('')
      setFeedbackMessage('')
      setCopied(false)
      reset()
    }
  }, [open, reset])

  // Trigger success: notify parent then close
  useEffect(() => {
    if (status === 'success') {
      try {
        onSuccess?.()
      } finally {
        onOpenChange(false)
      }
    }
  }, [status, onSuccess, onOpenChange])

  const isSubmitting = status === 'submitting'
  const isFallback = status === 'fallback'
  const isError = status === 'error'

  // Validate required fields
  const isSubmitDisabled =
    isSubmitting ||
    isFallback ||
    (mode === 'bug'
      ? bugTitle.trim().length === 0 || bugDescription.trim().length < 10
      : feedbackMessage.trim().length === 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const fields: FeedbackFormFields =
      mode === 'bug'
        ? {
            mode: 'bug',
            title: bugTitle.trim(),
            description: bugDescription.trim(),
            stepsToReproduce: bugSteps.trim() || undefined,
          }
        : {
            mode: 'feedback',
            title: feedbackTitle.trim() || undefined,
            message: feedbackMessage.trim(),
          }

    submit(fields)
  }

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fallbackText)
      setCopied(true)
      clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent-catch-ok: clipboard write may fail if permission denied — user can still select-all
    }
  }, [fallbackText])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-modal="true" className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug or share a suggestion. All reports go directly to the team.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle — segmented control */}
        <div
          role="radiogroup"
          aria-label="Feedback type"
          className="flex rounded-lg bg-muted p-0.5 gap-0.5"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              setMode(prev => (prev === 'bug' ? 'feedback' : 'bug'))
            }
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'bug'}
            onClick={() => setMode('bug')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              mode === 'bug'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bug Report
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'feedback'}
            onClick={() => setMode('feedback')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              mode === 'feedback'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Feedback
          </button>
        </div>

        {/* Fallback state: replace form with copyable textarea */}
        {isFallback ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Direct submission is unavailable. Copy the report below and email it, or use the
              mailto link.
            </p>
            <div className="relative">
              <Textarea
                readOnly
                value={fallbackText}
                className="min-h-[160px] font-mono text-xs resize-none pr-12"
                aria-label="Copyable report"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden="true" />
                    Copy report
                  </>
                )}
              </Button>
              {mailtoHref && (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={mailtoHref}>Open in Mail</a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'bug' ? (
              <>
                {/* Bug title */}
                <div className="space-y-1.5">
                  <Label htmlFor="bug-title">
                    Title <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="bug-title"
                    value={bugTitle}
                    onChange={e => setBugTitle(e.target.value)}
                    placeholder="Short summary of the bug"
                    maxLength={120}
                    required
                    disabled={isSubmitting}
                    aria-required="true"
                  />
                </div>

                {/* Bug description */}
                <div className="space-y-1.5">
                  <Label htmlFor="bug-description">
                    Description <span className="text-destructive" aria-hidden="true">*</span>
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (min 10 chars)
                    </span>
                  </Label>
                  <Textarea
                    id="bug-description"
                    value={bugDescription}
                    onChange={e => setBugDescription(e.target.value)}
                    placeholder="What happened? What did you expect?"
                    className="min-h-[80px] resize-none"
                    required
                    disabled={isSubmitting}
                    aria-required="true"
                  />
                </div>

                {/* Steps to reproduce (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="bug-steps">
                    Steps to reproduce{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="bug-steps"
                    value={bugSteps}
                    onChange={e => setBugSteps(e.target.value)}
                    placeholder="1. Open ...\n2. Click ...\n3. See error"
                    className="min-h-[60px] resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Feedback title (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-title">
                    Title{' '}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="feedback-title"
                    value={feedbackTitle}
                    onChange={e => setFeedbackTitle(e.target.value)}
                    placeholder="Short summary"
                    maxLength={120}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Message (required) */}
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-message">
                    Message <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Textarea
                    id="feedback-message"
                    value={feedbackMessage}
                    onChange={e => setFeedbackMessage(e.target.value)}
                    placeholder="Share your feedback or suggestion..."
                    className="min-h-[100px] resize-none"
                    required
                    disabled={isSubmitting}
                    aria-required="true"
                  />
                </div>
              </>
            )}

            {/* Inline error (not a toast — stays visible for retry/copy) */}
            {isError && error && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
              >
                {error}
                {fallbackText && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                    >
                      {copied ? (
                        <>
                          <Check className="size-4" aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-4" aria-hidden="true" />
                          Copy report
                        </>
                      )}
                    </Button>
                    {mailtoHref && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-destructive/30 text-destructive hover:bg-destructive/5"
                      >
                        <a href={mailtoHref}>Open in Mail</a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitDisabled} className="gap-2">
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isSubmitting ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
