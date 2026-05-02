import type { NoteQAAvailability } from '@/lib/aiConfiguration'

export function getNoteQAUnavailableCopy(
  availability: Extract<NoteQAAvailability, { available: false }> | null
) {
  if (!availability) {
    return {
      title: 'AI settings unavailable',
      body: 'Unable to check Q&A settings. Review your AI configuration in Settings.',
    }
  }

  switch (availability.reason) {
    case 'feature-disabled':
      return {
        title: 'Q&A from Notes is disabled',
        body: 'Enable Q&A from Notes in Settings to ask questions about your notes.',
      }
    case 'missing-ollama-url':
      return {
        title: 'Ollama is not configured',
        body: 'Add an Ollama server URL in Settings to use Q&A with Ollama.',
      }
    case 'availability-check-failed':
      return {
        title: 'Could not verify AI settings',
        body: 'Something went wrong while checking Q&A availability. Try again, or review AI configuration in Settings.',
      }
    case 'unreadable-provider-key':
      return {
        title: `${availability.providerName} key needs attention`,
        body: `Re-enter your ${availability.providerName} API key in Settings to use Q&A.`,
      }
    case 'missing-provider-key':
    default:
      return {
        title: `${availability.providerName} key required`,
        body: `Add a key for ${availability.providerName} in Settings to use Q&A.`,
      }
  }
}
