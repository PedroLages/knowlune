import { describe, expect, it } from 'vitest'
import { formatNoteQAError } from '@/lib/noteQAErrors'
import { ConsentError } from '@/ai/lib/ConsentError'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'
import { LLMError } from '@/ai/llm/types'
import { CONSENT_PURPOSES } from '@/lib/compliance/consentService'

describe('formatNoteQAError', () => {
  it('does not include raw LLMError.message in the default branch', () => {
    const msg = formatNoteQAError(
      new LLMError('Internal upstream secret detail', 'UNKNOWN', 'openai')
    )
    expect(msg).not.toContain('Internal upstream')
    expect(msg).toMatch(/try again|something went wrong/i)
  })

  it('returns a generic message for arbitrary Errors', () => {
    expect(formatNoteQAError(new Error('Do not leak this'))).not.toContain('Do not leak')
  })

  it('formats known LLM error codes without raw messages', () => {
    expect(formatNoteQAError(new LLMError('raw', 'TIMEOUT', 'openai'))).toContain('timed out')
  })

  it('formats consent errors', () => {
    expect(formatNoteQAError(new ConsentError(CONSENT_PURPOSES.AI_TUTOR))).toContain('consent')
  })

  it('formats provider re-consent', () => {
    expect(
      formatNoteQAError(new ProviderReconsentError(CONSENT_PURPOSES.AI_TUTOR, 'anthropic'))
    ).toContain('anthropic')
  })
})
