/**
 * Message Bubble Component
 *
 * Renders individual chat messages with role-based styling and citation support.
 */

import { User, Sparkles, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/ai/rag/types'
import { CitationLink } from './CitationLink'
import type { ReactElement } from 'react'

interface MessageBubbleProps {
  /** Message data */
  message: ChatMessage
  /** Whether this message is currently streaming */
  isStreaming?: boolean
}

/**
 * Chat message bubble with role-based styling
 *
 * Features:
 * - User messages: right-aligned, blue background
 * - AI messages: left-aligned, gray background
 * - Citation rendering with clickable links
 * - Streaming indicator (animated dots)
 * - Timestamp display
 */
export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Format timestamp
  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Extract citations from message content
  const renderContentWithCitations = () => {
    if (!message.citations || message.citations.size === 0) {
      return <span>{message.content}</span>
    }

    // Split content by citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g
    const parts: (string | ReactElement)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(message.content)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(message.content.slice(lastIndex, match.index))
      }

      // Add citation link
      const citationIndex = parseInt(match[1], 10)
      const citationMeta = message.citations.get(citationIndex)
      if (citationMeta) {
        parts.push(<CitationLink key={match.index} index={citationIndex} citation={citationMeta} />)
      } else {
        // Fallback if citation metadata not found
        parts.push(match[0])
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < message.content.length) {
      parts.push(message.content.slice(lastIndex))
    }

    return <>{parts}</>
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-brand' : 'bg-accent'
          }`}
          aria-label={isUser ? 'You' : 'AI Assistant'}
          role="img"
        >
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Sparkles className="w-4 h-4 text-accent-foreground" />
          )}
        </div>

        {/* Message content */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser ? 'bg-brand text-white' : 'bg-muted text-foreground'
          }`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {renderContentWithCitations()}
            {isStreaming && (
              <span className="inline-flex items-center ml-1">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>

          {/* Timestamp */}
          <div className={`text-xs mt-2 ${isUser ? 'text-white/80' : 'text-muted-foreground'}`}>
            {timeStr}
          </div>

          {/* Error message */}
          {message.error && (
            <div className="text-xs mt-2 text-destructive bg-destructive/10 rounded px-2 py-1">
              {message.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
