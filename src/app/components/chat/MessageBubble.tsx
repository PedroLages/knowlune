/**
 * Message Bubble Component
 *
 * Renders individual chat messages with role-based styling and citation support.
 */

import { User, Sparkles, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@/ai/rag/types'
import { CitationLink } from './CitationLink'
import { MODE_LABELS } from '@/ai/tutor/modeLabels'
import { DebugTrafficLight } from '@/app/components/tutor/DebugTrafficLight'
import type { ReactElement } from 'react'

interface MessageBubbleProps {
  /** Message data */
  message: ChatMessage
  /** Whether this message is currently streaming */
  isStreaming?: boolean
  /** Whether this conversation uses multiple modes (E72-S02) */
  showModeBadge?: boolean
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
export function MessageBubble({
  message,
  isStreaming = false,
  showModeBadge = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Format timestamp
  const timeStr = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  // Strip protocol markers (SCORE:, ASSESSMENT:) from displayed content
  const displayContent = message.content
    .replace(/^SCORE:\s*(correct|incorrect)\s*$/gim, '')
    .replace(/^ASSESSMENT:\s*(green|yellow|red)\s*$/gim, '')
    .trim()

  // Extract citations from message content
  const renderContentWithCitations = () => {
    if (!message.citations || message.citations.size === 0) {
      return <span>{displayContent}</span>
    }

    // Split content by citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g
    const parts: (string | ReactElement)[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(displayContent)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(displayContent.slice(lastIndex, match.index))
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
    if (lastIndex < displayContent.length) {
      parts.push(displayContent.slice(lastIndex))
    }

    return <>{parts}</>
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-brand' : 'bg-accent'
          }`}
          aria-label={isUser ? 'You' : 'AI Assistant'}
          role="img"
        >
          {isUser ? (
            <User className="size-4 text-white" />
          ) : (
            <Sparkles className="size-4 text-accent-foreground" />
          )}
        </div>

        {/* Message content */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser ? 'bg-brand text-white' : 'bg-muted text-foreground'
          }`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {!isUser && message.debugAssessment && (
              <span className="mb-1.5 block">
                <DebugTrafficLight assessment={message.debugAssessment} />
              </span>
            )}
            {renderContentWithCitations()}
            {isStreaming && (
              <span className="inline-flex items-center ml-1">
                <Loader2 className="size-3 animate-spin" />
              </span>
            )}
          </div>

          {/* Timestamp + mode badge (E72-S02) */}
          {showModeBadge && !isUser && message.mode ? (
            <div
              className={`text-[10px] mt-2 ${isUser ? 'text-white/80' : 'text-muted-foreground'}`}
            >
              {MODE_LABELS[message.mode] ?? message.mode} &middot; {timeStr}
            </div>
          ) : (
            <div className={`text-xs mt-2 ${isUser ? 'text-white/80' : 'text-muted-foreground'}`}>
              {timeStr}
            </div>
          )}

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
