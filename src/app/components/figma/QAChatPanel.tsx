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

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, AlertCircle, BookOpen, X, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { useQAChatStore } from '@/stores/useQAChatStore'
import { retrieveRelevantNotes, generateQAAnswer } from '@/lib/noteQA'
import { getAIConfiguration, getDecryptedApiKey, isAIAvailable } from '@/lib/aiConfiguration'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { db } from '@/db'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'

export function QAChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [hasNotes, setHasNotes] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  const aiAvailable = isAIAvailable()

  // Check if user has any notes
  useEffect(() => {
    let ignore = false
    const checkNotes = async () => {
      const count = await db.notes.count()
      if (!ignore) {
        setHasNotes(count > 0)
      }
    }
    checkNotes()
    return () => {
      ignore = true
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = async () => {
    const query = inputValue.trim()
    if (!query || isGenerating) return

    setInputValue('')
    setError(null)
    addQuestion(query)
    setGenerating(true)

    const startTime = Date.now()

    try {
      // Retrieve relevant notes
      const retrievedNotes = await retrieveRelevantNotes(query)

      if (retrievedNotes.length === 0) {
        addAnswer(
          "No relevant notes found for your question. Try asking about topics you've taken notes on.",
          [],
          []
        )
        return
      }

      // Get AI configuration
      const config = getAIConfiguration()
      const apiKey = await getDecryptedApiKey()

      if (!apiKey) {
        throw new Error('No API key configured. Please add an API key in Settings.')
      }

      // Generate streaming answer
      const answerId = addAnswer('', [], retrievedNotes)
      let fullAnswer = ''

      const generator = generateQAAnswer(query, retrievedNotes, config.provider, apiKey)

      for await (const chunk of generator) {
        fullAnswer += chunk
        updateAnswer(answerId, fullAnswer)
      }

      trackAIUsage('qa', {
        durationMs: Date.now() - startTime,
        metadata: { retrievedNotesCount: retrievedNotes.length },
      }).catch(() => {})
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate answer'
      setError(errorMessage)
      trackAIUsage('qa', {
        status: 'error',
        durationMs: Date.now() - startTime,
        metadata: { error: errorMessage },
      }).catch(() => {})
    } finally {
      setGenerating(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Chat content (shared between Sheet and Popover)
  const chatContent = (
    <div className="flex h-full flex-col">
      {/* Error state - no API key */}
      {!aiAvailable && (
        <div className="rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">AI features unavailable</p>
              <p className="mt-1 text-warning/80">
                Configure an API key in{' '}
                <Link to="/settings" className="underline">
                  Settings
                </Link>{' '}
                to use Q&A.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state - no notes */}
      {aiAvailable && !hasNotes && (
        <div className="rounded-lg border border-info bg-info-soft p-4 text-sm text-info">
          <div className="flex items-start gap-2">
            <BookOpen className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">No notes yet</p>
              <p className="mt-1 text-info/80">
                Start taking notes while watching videos to use Q&A.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active error */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive-soft p-4 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="mt-1 text-destructive/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef as any}>
        <div className="space-y-4 py-4">
          {messages.length === 0 && aiAvailable && hasNotes && (
            <div className="text-center text-muted-foreground">
              <MessageCircle className="mx-auto h-12 w-12 opacity-20" />
              <p className="mt-2 text-sm">Ask a question about your notes</p>
              <p className="mt-1 text-xs opacity-70">
                I'll search your notes and provide answers with citations
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={msg.type === 'question' ? 'text-right' : 'text-left'}>
              {/* Question (user) */}
              {msg.type === 'question' && (
                <div className="inline-block max-w-[80%] rounded-lg bg-brand px-4 py-2 text-sm text-brand-foreground">
                  {msg.content}
                </div>
              )}

              {/* Answer (AI) */}
              {msg.type === 'answer' && (
                <div className="inline-block max-w-[90%] rounded-lg border bg-muted px-4 py-3 text-sm">
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citations */}
                  {msg.retrievedNotes && msg.retrievedNotes.length > 0 && (
                    <div className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                      <p className="font-medium">Sources:</p>
                      {msg.retrievedNotes.map((retrieved, idx) => (
                        <Link
                          key={retrieved.note.id}
                          to={`/courses/${retrieved.note.courseId}/${retrieved.note.videoId}${retrieved.note.timestamp ? `?t=${Math.floor(retrieved.note.timestamp)}` : ''}`}
                          className="block text-brand hover:underline"
                        >
                          [{idx + 1}] {retrieved.note.courseId}/{retrieved.note.videoId}
                          {retrieved.note.timestamp &&
                            ` (${Math.floor(retrieved.note.timestamp)}s)`}
                          {' — '}
                          {(retrieved.similarity * 100).toFixed(0)}% match
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={aiAvailable && hasNotes ? 'Ask about your notes...' : 'No notes available'}
            disabled={!aiAvailable || !hasNotes || isGenerating}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !aiAvailable || !hasNotes || isGenerating}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Answers from your notes (local search, session-only history)
        </p>
      </div>
    </div>
  )

  // Trigger button (shared)
  const triggerButton = (
    <Button variant="outline" size="icon" title="Ask AI about your notes">
      <MessageCircle className="h-5 w-5" />
    </Button>
  )

  // Render mobile version (Sheet)
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader className="mb-4">
            <SheetTitle>Ask AI</SheetTitle>
          </SheetHeader>
          {chatContent}
        </SheetContent>
      </Sheet>
    )
  }

  // Render desktop version (Popover)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="h-[600px] w-[400px] p-0" align="end">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold">Ask AI</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {chatContent}
        </div>
      </PopoverContent>
    </Popover>
  )
}
