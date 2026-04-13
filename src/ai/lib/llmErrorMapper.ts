/**
 * Shared LLM error mapping utility.
 *
 * Maps LLMError codes to user-friendly messages.
 * Used by useTutor and useChatQA hooks.
 */

import { LLMError } from '@/ai/llm/types'

/**
 * Map LLMError codes to user-friendly messages.
 */
export function mapLLMError(err: unknown): string {
  if (err instanceof LLMError) {
    switch (err.code) {
      case 'TIMEOUT':
        return 'Request timed out. Please try again.'
      case 'RATE_LIMIT':
      case 'RATE_LIMITED':
        return 'Rate limit exceeded. Please wait a moment before trying again.'
      case 'AUTH_ERROR':
        return 'Authentication failed. Please check your AI provider settings.'
      case 'AUTH_REQUIRED':
        return 'Sign in required. Please sign in to use AI features.'
      case 'ENTITLEMENT_ERROR':
        return 'Premium subscription required. Configure an AI provider in Settings to use tutoring.'
      case 'NETWORK_ERROR':
        return 'AI provider offline. Configure a provider in Settings to use tutoring.'
      default:
        return `AI provider error: ${err.message}`
    }
  }
  return 'Failed to process your request. Please try again.'
}

/**
 * Error message constants for offline/premium detection.
 * Use these instead of exact string comparison.
 */
export const LLM_ERROR_MESSAGES = {
  OFFLINE: 'AI provider offline. Configure a provider in Settings to use tutoring.',
  PREMIUM: 'Premium subscription required. Configure an AI provider in Settings to use tutoring.',
} as const
