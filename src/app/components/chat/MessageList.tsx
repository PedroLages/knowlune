/**
 * Message List Component
 *
 * Scrollable container for chat messages with auto-scroll to bottom.
 */

import { useEffect, useMemo, useRef } from 'react'
import type { ChatMessage } from '@/ai/rag/types'
import { MessageBubble } from './MessageBubble'
import { EmptyState } from './EmptyState'
import { ModeTransitionMessage } from '@/app/components/tutor/ModeTransitionMessage'

interface MessageListProps {
  /** Array of messages to display */
  messages: ChatMessage[]
  /** Whether AI is currently streaming a response */
  isStreaming: boolean
}

/**
 * Scrollable message list with auto-scroll behavior
 *
 * Features:
 * - Shows EmptyState when no messages
 * - Auto-scrolls to bottom when new messages arrive
 * - Smooth scroll animation
 * - Marks last message as streaming if isStreaming is true
 */
export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollToBottomRef = useRef<HTMLDivElement>(null)

  // Show mode badges only when conversation has messages from 2+ different modes (E72-S02)
  const isMultiMode = useMemo(() => {
    const modes = new Set(messages.map(m => m.mode).filter(Boolean))
    return modes.size > 1
  }, [messages])

  // Auto-scroll to bottom when new messages arrive or streaming updates
  useEffect(() => {
    if (scrollToBottomRef.current) {
      scrollToBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  if (messages.length === 0) {
    return <EmptyState />
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1
          const showStreaming = isStreaming && isLastMessage && message.role === 'assistant'

          // Show mode transition divider when adjacent messages have different modes (E73-S01)
          const prevMessage = index > 0 ? messages[index - 1] : null
          const showTransition =
            isMultiMode &&
            prevMessage?.mode &&
            message.mode &&
            prevMessage.mode !== message.mode

          return (
            <div key={message.id}>
              {showTransition && message.mode && (
                <ModeTransitionMessage newMode={message.mode} />
              )}
              <MessageBubble message={message} isStreaming={showStreaming} showModeBadge={isMultiMode} />
            </div>
          )
        })}

        {/* Invisible element to scroll to */}
        <div ref={scrollToBottomRef} />
      </div>
    </div>
  )
}
