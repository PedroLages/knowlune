/**
 * Chat Input Component
 *
 * Multiline textarea with send button and keyboard shortcuts.
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void
  /** Whether AI is currently generating a response */
  isGenerating: boolean
  /** Placeholder text */
  placeholder?: string
}

/**
 * Chat input with multiline textarea and send button
 *
 * Features:
 * - Auto-expand up to 5 lines
 * - Enter to send, Shift+Enter for newline
 * - Disabled while generating
 * - Loading indicator in send button
 */
export function ChatInput({
  onSend,
  isGenerating,
  placeholder = 'Ask a question about your notes...',
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea as content grows (up to 5 lines)
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const maxHeight = 5 * 24 // 5 lines * line-height
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
  }, [message])

  const handleSend = () => {
    const trimmed = message.trim()
    if (!trimmed || isGenerating) return

    onSend(trimmed)
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift = send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex gap-2 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isGenerating}
            rows={1}
            className="min-h-12 w-full px-4 py-3 pr-12 rounded-xl border border-input
                     bg-background text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-brand
                     disabled:opacity-50 disabled:cursor-not-allowed
                     resize-none overflow-y-auto"
          />
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || isGenerating}
          className="h-12 px-6"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Send className="size-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground mt-2 text-center max-w-4xl mx-auto">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">Enter</kbd> to send,{' '}
        <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">Shift + Enter</kbd> for new
        line
      </div>
    </div>
  )
}
