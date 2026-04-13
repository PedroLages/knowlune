/**
 * ContinueConversationPrompt (E73-S05)
 *
 * Inline prompt shown at the top of MessageList when a previous conversation
 * exists for the current lesson that is older than 5 minutes.
 * Lets the learner resume or start fresh.
 */

import { useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { ChatConversation, TutorMessage } from '@/data/types'
import type { TutorMode } from '@/ai/tutor/types'
import { MODE_LABELS } from '@/ai/tutor/modeLabels'

interface ContinueConversationPromptProps {
  conversation: ChatConversation
  onContinue: () => void
  onStartFresh: () => void
}

/** Format timestamp for the prompt display */
function formatPromptTimestamp(epochMs: number): string {
  const now = new Date()
  const date = new Date(epochMs)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (diffDays === 0 && now.toLocaleDateString('sv-SE') === date.toLocaleDateString('sv-SE')) {
    return `Today at ${timeStr}`
  }
  if (diffDays <= 1) {
    return `Yesterday at ${timeStr}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
}

/** Extract topics from first few user messages */
function extractTopics(messages: TutorMessage[]): string[] {
  return messages
    .filter(m => m.role === 'user')
    .slice(0, 3)
    .map(m => {
      const text = m.content.trim()
      return text.length > 50 ? text.slice(0, 47) + '...' : text
    })
    .filter(Boolean)
}

/** Check if conversation is older than 5 minutes */
export function isConversationStale(updatedAt: number, now: number = Date.now()): boolean {
  return now - updatedAt > 5 * 60 * 1000
}

export function ContinueConversationPrompt({
  conversation,
  onContinue,
  onStartFresh,
}: ContinueConversationPromptProps) {
  const topics = useMemo(() => extractTopics(conversation.messages), [conversation.messages])
  const modes = useMemo(() => {
    const modeSet = new Set<TutorMode>()
    for (const msg of conversation.messages) {
      if (msg.mode) modeSet.add(msg.mode)
    }
    return Array.from(modeSet)
      .map(m => MODE_LABELS[m] ?? m)
      .join(', ')
  }, [conversation.messages])

  return (
    <div
      className="bg-brand-soft border border-brand/20 rounded-xl p-4 mx-4 mt-4"
      role="region"
      aria-label="Continue previous conversation"
      data-testid="continue-conversation-prompt"
    >
      <div className="flex items-start gap-3">
        <MessageSquare className="size-5 text-brand-soft-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Continue your previous conversation?</p>
          <p className="text-sm text-muted-foreground mt-1">
            Last active {formatPromptTimestamp(conversation.updatedAt)}
            {modes && <span className="italic"> &middot; {modes}</span>}
          </p>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {topics.map((topic, i) => (
                <span
                  key={i}
                  className="bg-muted rounded-full px-2 py-0.5 text-xs truncate max-w-[200px]"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <Button
          variant="brand"
          onClick={onContinue}
          className="min-h-[44px]"
          data-testid="continue-prev-btn"
        >
          Continue
        </Button>
        <Button
          variant="outline"
          onClick={onStartFresh}
          className="min-h-[44px]"
          data-testid="start-fresh-btn"
        >
          Start Fresh
        </Button>
      </div>
    </div>
  )
}
