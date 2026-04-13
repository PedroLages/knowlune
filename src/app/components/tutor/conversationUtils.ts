/**
 * conversationUtils (E73-S05)
 *
 * Shared utility functions for conversation history and continue prompt components.
 * Extracted to avoid duplication between ConversationHistorySheet and ContinueConversationPrompt.
 */

import type { TutorMessage } from '@/data/types'
import type { TutorMode } from '@/ai/tutor/types'

/** Format timestamp as relative date string */
export function formatTimestamp(epochMs: number, now = new Date()): string {
  const date = new Date(epochMs)
  const diffMs = now.getTime() - epochMs
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (diffDays === 0) {
    // Check if same calendar day
    if (now.toLocaleDateString('sv-SE') === date.toLocaleDateString('sv-SE')) {
      return `Today, ${timeStr}`
    }
    return `Yesterday, ${timeStr}`
  }
  if (diffDays === 1) {
    return `Yesterday, ${timeStr}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Format timestamp for the prompt display (with "at" phrasing) */
export function formatPromptTimestamp(epochMs: number, now = new Date()): string {
  const date = new Date(epochMs)
  const diffMs = now.getTime() - epochMs
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

/** Extract topic labels from conversation messages */
export function extractTopics(messages: TutorMessage[], maxChars = 40, maxTopics = 5): string[] {
  const userMessages = messages.filter(m => m.role === 'user')
  const topics: string[] = []
  for (const msg of userMessages.slice(0, maxTopics)) {
    const text = msg.content.trim()
    if (text.length > 0) {
      topics.push(text.length > maxChars ? text.slice(0, maxChars - 3) + '...' : text)
    }
    if (topics.length >= maxTopics) break
  }
  return topics
}

/** Extract unique modes used in conversation */
export function extractModes(messages: TutorMessage[]): TutorMode[] {
  const modes = new Set<TutorMode>()
  for (const msg of messages) {
    if (msg.mode) modes.add(msg.mode)
  }
  return Array.from(modes)
}
