/**
 * Q&A Chat Panel - Ask questions about your notes
 *
 * Responsive UI that adapts to viewport:
 * - Mobile/Tablet (< 1024px): Full-screen Sheet
 * - Desktop (≥ 1024px): Anchored Popover
 *
 * Features:
 * - Real-time streaming AI answers
 * - Citation links to source notes/videos
 * - Session-only history (resets on reload)
 * - Error states for no API key / no notes
 *
 * @see docs/implementation-artifacts/9b-2-qa-from-notes-with-vercel-ai-sdk.md
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { MessageCircle, Send, AlertCircle, BookOpen, X, Loader2, Trash2, StopCircle } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/app/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/app/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'
import { ScrollArea, ScrollBar } from '@/app/components/ui/scroll-area'
import { useQAChatStore } from '@/stores/useQAChatStore'
import { retrieveRelevantNotes, generateQAAnswer, getNoteDisplayName } from '@/lib/noteQA'
import { formatTimestamp } from '@/lib/format'
import { classifyQuery, GREETING_RESPONSE, buildMetaResponse } from '@/lib/chatQueryClassifier'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { db } from '@/db'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { useNoteQAAvailability } from '@/app/hooks/useNoteQAAvailability'
import { assertAIFeatureConsent } from '@/ai/llm/factory'
import { formatNoteQAError } from '@/lib/noteQAErrors'
import { getNoteQAUnavailableCopy } from '@/lib/noteQAAvailabilityCopy'
import { useAuthStore } from '@/stores/useAuthStore'
import { useProviderReconsent } from '@/ai/hooks/useProviderReconsent'
import { ProviderReconsentModal } from '@/app/components/compliance/ProviderReconsentModal'
import { AIConsentDeclinedBanner } from '@/app/components/compliance/AIConsentDeclinedBanner'

export interface QAChatPanelProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  tooltipLabel?: string
}

const MAX_TEXTAREA_HEIGHT = 5 * 24

const SUGGESTED_PROMPTS = [
  'Summarize my recent notes',
  "What are key concepts I've studied?",
  'Find notes about React',
] as const

export function QAChatPanel({ open: controlledOpen, onOpenChange: controlledOnOpenChange, tooltipLabel }: QAChatPanelProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen
  const [inputValue, setInputValue] = useState('')
  const [hasNotes, setHasNotes] = useState(false)
  const [notesLoaded, setNotesLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollToBottomRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    isGenerating,
    error,
    addQuestion,
    addAnswer,
    updateAnswer,
    setGenerating,
    setError,
  } = useQAChatStore()

  const isMobile = useMediaQuery('(max-width: 1023px)')
  const userId = useAuthStore(s => s.user?.id)
  const lastQueryRef = useRef('')
  const retryPipelineRef = useRef<() => Promise<void>>(async () => {})

  const reconsentOptions = useMemo(
    () => ({
      onRetry: () => void retryPipelineRef.current(),
    }),
    []
  )
  const { handleAIError, declinedProvider, modalProps } = useProviderReconsent(userId, reconsentOptions)

  const noteQAAvailability = useNoteQAAvailability()
  const aiChecking = noteQAAvailability.status === 'checking'
  const aiAvailable = noteQAAvailability.status === 'available'
  const unavailableCopy = getNoteQAUnavailableCopy(
    noteQAAvailability.status === 'unavailable' ? noteQAAvailability.availability : null
  )

  // Check if user has any notes
  useEffect(() => {
    let ignore = false
    const checkNotes = async () => {
      try {
        const count = await db.notes.count()
        if (!ignore) setHasNotes(count > 0)
      } catch {
        if (!ignore) setHasNotes(false)
      } finally {
        if (!ignore) setNotesLoaded(true)
      }
    }
    void checkNotes()
    return () => {
      ignore = true
    }
  }, [])

  // Auto-scroll to bottom when messages change using sentinel div (more reliable than scrollTop)
  useLayoutEffect(() => {
    if (scrollToBottomRef.current) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollToBottomRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    }
  }, [messages, isGenerating])

  const runQAPipeline = useCallback(
    async (query: string, startTime: number) => {
      const resolved = await assertAIFeatureConsent('noteQA')

      const retrievedNotes = await retrieveRelevantNotes(query)

      if (retrievedNotes.length === 0) {
        addAnswer(
          "No relevant notes found for your question. Try asking about topics you've taken notes on.",
          [],
          []
        )
        return
      }

      const answerId = addAnswer('', [], retrievedNotes)
      let fullAnswer = ''

      // Create AbortController for stopping generation
      const controller = new AbortController()
      abortControllerRef.current = controller
      const signal = controller.signal

      const generator = generateQAAnswer(query, retrievedNotes, { resolved, signal })

      try {
        for await (const chunk of generator) {
          fullAnswer += chunk
          updateAnswer(answerId, fullAnswer)
        }
      } finally {
        // Only clear the ref if we still own the controller (guard against
        // the race where a previous stream's finally block nulls out a
        // newly created controller after a stop-and-re-send).
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
      }

      trackAIUsage('qa', {
        durationMs: Date.now() - startTime,
        metadata: { retrievedNotesCount: retrievedNotes.length },
      }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })
    },
    [addAnswer, updateAnswer]
  )

  retryPipelineRef.current = async () => {
    const query = lastQueryRef.current
    if (!query) return
    setGenerating(true)
    setError(null)
    const startTime = Date.now()
    try {
      await runQAPipeline(query, startTime)
    } catch (err) {
      if (handleAIError(err)) {
        return
      }
      const errorMessage = formatNoteQAError(err)
      setError(errorMessage)
      trackAIUsage('qa', {
        status: 'error',
        durationMs: Date.now() - startTime,
        metadata: { error: errorMessage },
      }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSendMessage = async (explicitQuery?: string) => {
    const query = (explicitQuery ?? inputValue).trim()
    if (!query || isGenerating) return

    lastQueryRef.current = query
    setInputValue('')
    setError(null)
    addQuestion(query)

    // Classify the query to determine routing
    const category = classifyQuery(query)

    // Greeting — canned reply, no RAG
    if (category === 'greeting') {
      addAnswer(GREETING_RESPONSE, [], [])
      return
    }

    // Meta question — note inventory, no RAG
    if (category === 'meta') {
      try {
        const noteCount = await db.notes.count()
        const coursesWithNotes = await db.notes.orderBy('courseId').uniqueKeys()
        const courseNames: string[] = []
        for (const courseId of coursesWithNotes.slice(0, 5)) {
          const course = await db.importedCourses.get(courseId as string)
          if (course?.name) courseNames.push(course.name)
        }
        const metaReply = buildMetaResponse(noteCount, coursesWithNotes.length, courseNames)
        addAnswer(metaReply, [], [])
      } catch {
        addAnswer("I couldn't look up your note inventory right now. Try asking me a specific question!", [], [])
      }
      return
    }

    // Search query — full RAG pipeline
    setGenerating(true)
    const startTime = Date.now()

    try {
      await runQAPipeline(query, startTime)
    } catch (err) {
      if (handleAIError(err)) {
        return
      }
      const errorMessage = formatNoteQAError(err)
      setError(errorMessage)
      trackAIUsage('qa', {
        status: 'error',
        durationMs: Date.now() - startTime,
        metadata: { error: errorMessage },
      }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
      // Reset textarea height after send. Skip rAF height recalc to avoid
      // reading scrollHeight = 0 on React 19's async scheduling boundary
      // (setInputValue('') hasn't flushed to DOM yet at this point).
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
      }
      return
    }
    // Auto-expand on any other key
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        if (textarea.scrollHeight > 0) {
          textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
        }
      }
    })
  }

  // Chat content (shared between Sheet and Popover)
  const chatContent = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Loading state - AI settings check */}
      {aiChecking && (
        <div className="shrink-0 rounded-lg border border-muted bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Loader2 className="size-5 shrink-0 animate-spin" />
            <div>
              <p className="font-medium">Checking AI settings...</p>
              <p className="mt-1">Q&A will be available once your provider settings are verified.</p>
            </div>
          </div>
        </div>
      )}

      {/* Error state - Q&A unavailable */}
      {!aiChecking && !aiAvailable && (
        <div className="shrink-0 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <p className="font-medium">{unavailableCopy.title}</p>
              <p className="mt-1 text-warning/80">
                {unavailableCopy.body}{' '}
                <Link to="/settings?section=integrations" className="underline">
                  Settings
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state - no notes */}
      {aiAvailable && notesLoaded && !hasNotes && (
        <div className="shrink-0 rounded-lg border border-info bg-info-soft p-4 text-sm text-info">
          <div className="flex items-start gap-2">
            <BookOpen className="size-5 shrink-0" />
            <div>
              <p className="font-medium">No notes yet</p>
              <p className="mt-1 text-info/80">
                Start taking notes while watching videos to use Q&A.
              </p>
            </div>
          </div>
        </div>
      )}

      {declinedProvider && (
        <div className="mb-2 shrink-0">
          <AIConsentDeclinedBanner providerId={declinedProvider} />
        </div>
      )}

      {/* Active error */}
      {error && (
        <div className="shrink-0 rounded-lg border border-destructive bg-destructive-soft p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="mt-1 text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages — h-0 flex-1 forces shrink; ScrollArea is the only growing scroll region */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- ScrollArea ref type mismatch */}
      <ScrollArea className="h-0 min-h-0 flex-1 px-4" ref={scrollRef as any} aria-live="polite">
        <div className="space-y-4 py-4">
            {messages.length === 0 && aiAvailable && notesLoaded && hasNotes && (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <MessageCircle className="mx-auto mb-3 size-10 text-muted-foreground/40" strokeWidth={1.5} />
                <h3 className="mb-1 text-base font-medium text-foreground">Ask me anything about your notes!</h3>
                <p className="mb-6 text-xs text-muted-foreground">
                  I'll search your notes and provide answers with citations
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map(
                    prompt => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setInputValue(prompt)
                          handleSendMessage(prompt)
                        }}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                      >
                        {prompt}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={msg.type === 'question' ? 'text-right' : 'text-left'}>
                {/* Question (user) */}
                {msg.type === 'question' && (
                  <div>
                    <div className="inline-block max-w-[80%] min-w-0 rounded-lg bg-brand px-4 py-2 text-sm text-brand-foreground break-words [overflow-wrap:anywhere]">
                      {msg.content}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}

                {/* Answer (AI) */}
                {msg.type === 'answer' && (
                  <div>
                    {/* Check if this is an empty-result reply from RAG (distinct styling) */}
                    {msg.content.startsWith('No relevant notes found') || msg.content.includes("I don't have notes covering") ? (
                      <div className="inline-block max-w-[90%] rounded-lg border border-muted bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-block max-w-[90%] rounded-lg border bg-muted px-4 py-3 text-sm">
                        <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</div>

                        {/* Sources section - human-readable citations */}
                        {msg.retrievedNotes && msg.retrievedNotes.length > 0 && (
                          <div className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                            <p className="font-medium">Sources:</p>
                            {msg.retrievedNotes.map((retrieved, idx) => {
                              const { name: displayName, isFallback: isNameFallback } = getNoteDisplayName(retrieved)
                              const sourceLabel = isNameFallback
                                ? `Note from ${retrieved.note.courseId}`
                                : displayName
                              return (
                                <Link
                                  key={retrieved.note.id}
                                  to={`/courses/${retrieved.note.courseId}/lessons/${retrieved.note.videoId}${retrieved.note.timestamp ? `?t=${Math.floor(retrieved.note.timestamp)}` : ''}`}
                                  className="block text-brand hover:underline"
                                >
                                  <span className="inline-flex items-center justify-center size-4 mr-1 text-[10px] font-medium bg-accent text-accent-foreground rounded">
                                    {idx + 1}
                                  </span>
                                  {sourceLabel}
                                  {retrieved.note.timestamp != null && retrieved.note.timestamp >= 0 &&
                                    ` (${formatTimestamp(retrieved.note.timestamp)})`}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                      {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator with Stop button */}
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Thinking...</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    abortControllerRef.current?.abort()
                    setGenerating(false)
                  }}
                  className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  aria-label="Stop generating"
                  data-testid="qa-panel-stop"
                >
                  <StopCircle className="size-3" />
                  Stop
                </Button>
              </div>
            )}
          </div>

          {/* Sentinel div for auto-scroll */}
          <div ref={scrollToBottomRef} />

          <ScrollBar />
      </ScrollArea>

      {/* Input area with multiline textarea */}
      <div className="shrink-0 border-t p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={e => {
                setInputValue(e.target.value)
                // Auto-expand
                const textarea = textareaRef.current
                if (textarea) {
                  textarea.style.height = 'auto'
                  if (textarea.scrollHeight > 0) {
                    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
                  }
                }
              }}
              onKeyDown={handleKeyPress}
              placeholder={
                aiChecking
                  ? 'Checking AI settings...'
                  : aiAvailable && !notesLoaded
                    ? 'Checking notes...'
                    : aiAvailable && hasNotes
                      ? 'Ask about your notes...'
                      : !aiAvailable
                        ? 'Configure Q&A in Settings'
                        : 'No notes available'
              }
              disabled={aiChecking || !aiAvailable || !hasNotes || isGenerating}
              aria-busy={aiChecking}
              aria-label="Ask a question about your notes"
              data-testid="qa-panel-input"
              rows={1}
              className="min-h-12 w-full px-4 py-3 rounded-xl border border-input
                         bg-background text-foreground placeholder:text-muted-foreground
                         focus:outline-none focus:ring-2 focus:ring-brand
                         disabled:opacity-50 disabled:cursor-not-allowed
                         resize-none overflow-y-auto text-sm"
            />
          </div>
          <Button
            onClick={() => void handleSendMessage()}
            disabled={!inputValue.trim() || aiChecking || !aiAvailable || !hasNotes || isGenerating}
            size="icon"
            aria-label="Send question"
            data-testid="qa-panel-send"
            className="h-12 w-12 shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground" data-testid="qa-panel-keyboard-hint">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to send,{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Shift + Enter</kbd> for new line
        </p>
      </div>
    </div>
  )

  // Trigger button (shared)
  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isOpen ? 'Close Ask AI panel' : 'Open Ask AI panel'}
      data-testid="qa-panel-trigger"
    >
      <MessageCircle className="size-5" />
    </Button>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          {tooltipLabel ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>{triggerButton}</SheetTrigger>
              </TooltipTrigger>
              <TooltipContent>{tooltipLabel}</TooltipContent>
            </Tooltip>
          ) : (
            <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          )}
          <SheetContent
            side="bottom"
            className="flex h-[90vh] max-h-[90vh] min-h-0 flex-col gap-0 overflow-hidden p-0"
          >
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              data-testid="qa-panel-shell"
            >
              <SheetHeader className="mb-0 shrink-0 border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <SheetTitle>Ask AI</SheetTitle>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        abortControllerRef.current?.abort()
                        useQAChatStore.getState().clearHistory()
                      }}
                      aria-label="Clear chat history"
                      data-testid="qa-panel-clear"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </SheetHeader>
              {chatContent}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          {tooltipLabel ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{tooltipLabel}</TooltipContent>
            </Tooltip>
          ) : (
            <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
          )}
          <PopoverContent className="h-[600px] w-[400px] overflow-hidden p-0" align="end">
            <div className="flex h-full flex-col overflow-hidden" data-testid="qa-panel-shell">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <h3 className="font-semibold">Ask AI</h3>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => {
                        abortControllerRef.current?.abort()
                        useQAChatStore.getState().clearHistory()
                      }}
                      aria-label="Clear chat history"
                      data-testid="qa-panel-clear"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close Ask AI panel"
                    data-testid="qa-panel-close"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              {chatContent}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <ProviderReconsentModal {...modalProps} />
    </>
  )
}
