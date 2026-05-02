import { ConsentError } from '@/ai/lib/ConsentError'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'
import { LLMError } from '@/ai/llm/types'

export function formatNoteQAError(error: unknown): string {
  if (error instanceof ProviderReconsentError) {
    // Aligned with ProviderReconsentModal + AIConsentDeclinedBanner: dialog first, Settings fallback (E119-S09).
    return `The current AI provider (${error.providerId}) needs your confirmation for Q&A. Use the dialog if it opens, or go to Settings → Privacy & Consent.`
  }

  if (error instanceof ConsentError) {
    return 'AI Q&A requires your consent. Enable AI Tutor consent in Settings → Privacy & Consent.'
  }

  if (error instanceof LLMError) {
    switch (error.code) {
      case 'TIMEOUT':
        return 'Request timed out. Please try again.'
      case 'RATE_LIMIT':
      case 'RATE_LIMITED':
        return 'Rate limit exceeded. Please wait a moment before trying again.'
      case 'AUTH_ERROR':
        return `Authentication failed for ${error.providerId ?? 'the selected provider'}. Please check that provider key in Settings.`
      case 'AUTH_REQUIRED':
        return 'Sign in required. Please sign in to use AI Q&A.'
      case 'ENTITLEMENT_ERROR':
        return 'The selected model is not available for this provider key. Choose another Q&A model in Settings.'
      case 'NETWORK_ERROR':
        return 'Network error. Check your connection and try again.'
      default:
        return 'Something went wrong with the AI provider. Try again or pick another model in Settings.'
    }
  }

  return 'Something went wrong while generating the answer. Try again.'
}
